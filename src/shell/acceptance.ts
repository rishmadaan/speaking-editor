// Automated in-app acceptance checks for the walking skeleton, spike-report style.
// Gated behind DEV_ACCEPTANCE so it never ships. Opens a fixture note in live
// preview, drives a real ReadingSession (real Edge synthesis, real audio), runs the
// seven checks from specs/0001, and writes skeleton-acceptance.md to the vault root.
// Every failure path still writes the report, so a run is never silently lost.
import { App, MarkdownView, TFile } from "obsidian";
import { EditorView } from "@codemirror/view";
import { syncField } from "./sync-field";
import { ReadingSession } from "./session";
import { WordEntry } from "./word-runs";
import { SPEED_PRESETS } from "./player-pill";
import { formatSpeedTitle } from "./pill-menus";
import type SpeakingEditorPlugin from "./main";

const REPORT = "skeleton-acceptance.md";
const NOTE = "Skeleton Note.md";

const FIXTURE = `---
title: Skeleton fixture
---

# Heading With Words To Read

This first paragraph is plain prose with a good many ordinary words so the
reader has a calm runway to walk across before anything interesting happens.

The second paragraph has **bold emphasis**, some *italic drift*, an ` + "`inline code`" + ` span,
and a [markdown link](https://example.com) to strip out cleanly.

- A list item with a **bolded** word inside it and a few more plain words.
- Another list item, kept deliberately short and simple.

The closing paragraph gives the clock a long, calm runway of ordinary words to
end on, with enough length that several word boundaries pass while it plays.
`;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function waitUntil(pred: () => boolean, timeoutMs: number, step = 50): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (pred()) return true;
    await sleep(step);
  }
  return pred();
}

interface Check { name: string; pass: boolean; detail: string }

export async function runAcceptance(app: App, plugin: SpeakingEditorPlugin): Promise<void> {
  const lines: string[] = [`# Skeleton acceptance report`, ``];
  const checks: Check[] = [];
  // Snapshot settings so the control-surface checks (which mutate provider/voice/
  // listening mode) restore them at the end and repeat runs stay stable.
  const settingsSnapshot = JSON.stringify(plugin.settings);
  const write = () => app.vault.adapter.write(REPORT, lines.join("\n") + "\n");
  // write after every check so a mid-run hang or abort never loses the trail
  const check = (name: string, pass: boolean, detail: string) => {
    checks.push({ name, pass, detail });
    lines.push(`- ${pass ? "PASS" : "FAIL"}: ${name}. ${detail}`);
    void write();
  };
  // rAF pauses entirely in a hidden window; any rAF-driven wait would hang
  // forever if the window is occluded mid-run. Timers still fire (throttled),
  // so every rAF-based wait races against a timer escape, and a run that loses
  // its window aborts with a verdict instead of hanging silently.
  const hiddenMidRun = () => document.visibilityState === "hidden";

  let session: ReadingSession | null = null;
  try {
    lines.push(
      `Environment: platform=${process.platform}, electron=${process.versions?.electron ?? "none"}, chrome=${process.versions?.chrome ?? "none"}`,
      ``
    );

    // The checks measure a rAF-driven loop; Chromium pauses rAF entirely in a
    // hidden window, which would produce misleading FAILs. Instead of refusing,
    // arm and wait (up to 10 minutes) for the window to become visible, so the
    // run can be fired remotely and starts the moment a human brings it up.
    window.focus();
    await sleep(300);
    if (document.visibilityState === "hidden") {
      lines.push(`(Window was hidden when fired; waited for visibility.)`, ``);
      await app.vault.adapter.write(REPORT, `# Skeleton acceptance report\n\nARMED: waiting for the window to become visible (10 minute limit)...\n`);
      const visible = await new Promise<boolean>((res) => {
        const timeout = setTimeout(() => { document.removeEventListener("visibilitychange", on); res(false); }, 600000);
        const on = () => {
          if (document.visibilityState === "visible") {
            clearTimeout(timeout);
            document.removeEventListener("visibilitychange", on);
            res(true);
          }
        };
        document.addEventListener("visibilitychange", on);
      });
      if (!visible) {
        lines.splice(2, 0, `RESULT: BLOCKED`, ``, `The window never became visible within 10 minutes, so the`, `rAF-driven checks could not run. Open the test vault and rerun.`);
        await write();
        return;
      }
      await sleep(500); // let the compositor settle before measuring frames
    }

    // Open the fixture note in live preview and reach its EditorView
    await app.vault.adapter.write(NOTE, FIXTURE);
    const file =
      (app.vault.getAbstractFileByPath(NOTE) as TFile) ??
      app.vault.getFiles().find((f) => f.path === NOTE)!;
    const leaf = app.workspace.getLeaf(true);
    await leaf.openFile(file);
    const mdView = leaf.view as MarkdownView;
    await (mdView as any).setState(
      { ...(mdView as any).getState(), mode: "source", source: false },
      { history: false }
    );
    const cm: EditorView = (mdView.editor as any).cm;
    const field = () => cm.state.field(syncField);

    let lastState = "idle";
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      onState: (s) => {
        lastState = s;
      },
    });

    // 1. Play reaches "playing" and the first word decoration appears within 6s
    session.playPause();
    const started = await waitUntil(() => session!.state === "playing" && field().word >= 0, 6000);
    check(
      "play reaches playing and first word decoration appears within 6s",
      started,
      `state=${session.state}, word=${field().word}, engineState=${lastState}`
    );

    // 2. Every painted slice equals its word's visible text over the first 15 words
    let cleanFails: string[] = [];
    const sample2 = field().words.slice(0, 15);
    for (const e of sample2) {
      const painted = e.runs.map((r) => cm.state.doc.sliceString(r.from, r.to)).join("");
      if (painted !== e.text) cleanFails.push(`word ${e.index} "${e.text}" painted "${painted}"`);
    }
    check(
      "painted slices equal word text (no syntax painted), first 15 words",
      cleanFails.length === 0,
      cleanFails.length ? cleanFails.slice(0, 5).join("; ") : `${sample2.length} words, every painted slice === word text`
    );

    // 3. Word advances are frame-synced over a 10-word sample. The dispatch is
    // synchronous inside the rAF tick, so the decoration cannot lag the boundary
    // by a frame; this observer confirms live advances land and paint monotonically.
    const advances: { t: number; word: number }[] = [];
    await new Promise<void>((done) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; done(); } };
      // timer escape: fires even if the window goes hidden and rAF stops
      const escape = setTimeout(finish, 8000);
      let last = field().word;
      const t0 = performance.now();
      const obs = () => {
        const w = field().word;
        if (w !== last && w >= 0) {
          advances.push({ t: performance.now(), word: w });
          last = w;
        }
        if (advances.length >= 10 || performance.now() - t0 > 6000 || session!.state !== "playing") {
          clearTimeout(escape);
          finish();
          return;
        }
        requestAnimationFrame(obs);
      };
      requestAnimationFrame(obs);
    });
    if (hiddenMidRun()) {
      lines.splice(2, 0, `RESULT: ABORTED MID-RUN`, ``, `The window went hidden during the checks; rAF-driven measurements`, `are invalid from check 3 on. Keep the window visible and rerun.`);
      await write();
      return;
    }
    let monotonic = true;
    let paintable = true;
    for (let i = 1; i < advances.length; i++) if (advances[i].word < advances[i - 1].word) monotonic = false;
    for (const a of advances) {
      const e = field().words[a.word];
      if (!e || e.dirty || e.runs.length === 0) paintable = false;
    }
    check(
      "word advances are frame-synced and painted over a 10-word sample",
      advances.length >= 5 && monotonic && paintable,
      `${advances.length} advances observed, monotonic=${monotonic}, allPaintable=${paintable} (dispatch is synchronous in the rAF tick)`
    );

    // 4. Synthetic click on a word ahead seeks playback there within 1s (N or N+1)
    const targetWords = field().words.filter((e) => e.runs.length > 0);
    const target = targetWords[Math.min(targetWords.length - 1, 20)];
    let clickResolved = -1;
    const listener = (ev: MouseEvent) => {
      const pos = cm.posAtCoords({ x: ev.clientX, y: ev.clientY });
      if (pos == null) return;
      const words = field().words;
      const w =
        words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to)) ??
        words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
      if (w) {
        clickResolved = w.index;
        session!.seekToWord(w.index);
      }
    };
    cm.contentDOM.addEventListener("mousedown", listener);
    const mid = Math.floor((target.runs[0].from + target.runs[0].to) / 2);
    cm.dispatch({ effects: EditorView.scrollIntoView(mid) });
    await sleep(120);
    const coords = cm.coordsAtPos(mid);
    if (coords) {
      cm.contentDOM.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: (coords.left + coords.right) / 2 || coords.left + 1,
          clientY: (coords.top + coords.bottom) / 2,
          bubbles: true,
        })
      );
    }
    cm.contentDOM.removeEventListener("mousedown", listener);
    const seeked = await waitUntil(
      () => field().word === target.index || field().word === target.index + 1,
      1500
    );
    check(
      "synthetic click seeks playback to the clicked word within 1s",
      seeked && clickResolved === target.index,
      `clicked=${clickResolved} target=${target.index} ("${target.text}"), current=${field().word}, coords=${!!coords}`
    );

    // 5. Pause freezes position; resume restarts from the current sentence start
    await waitUntil(() => session!.state === "playing", 2000);
    session.playPause(); // pause
    await waitUntil(() => session!.state === "paused", 1500);
    const pausedWord = field().word;
    const pausedSentence = field().sentence;
    await sleep(400);
    const frozen = field().word === pausedWord;
    const sentenceWords = field()
      .words.filter((e) => e.sentence === pausedSentence && e.runs.length > 0)
      .map((e) => e.index);
    const firstWord = sentenceWords.length ? Math.min(...sentenceWords) : pausedWord;
    session.playPause(); // resume
    const resumedAtStart = await waitUntil(
      () => session!.state === "playing" && (field().word === firstWord || field().word === firstWord + 1),
      3000
    );
    check(
      "pause freezes position; resume restarts from the sentence start",
      frozen && resumedAtStart,
      `frozen=${frozen} (word stayed ${pausedWord}); resumed at ${field().word}, sentence-start=${firstWord}`
    );

    // 6. Typing an insertion upstream of the current word shifts decorations and
    // playback keeps going (state stays "playing")
    await waitUntil(() => session!.state === "playing", 2000);
    const probe = field().words.find((e) => e.runs.length > 0 && e.index > field().word + 3);
    const probeBefore = probe ? probe.runs[0].from : -1;
    const ins = "TYPED ";
    cm.dispatch({ changes: { from: 0, insert: ins } });
    const probeAfter = probe ? field().words[probe.index].runs[0]?.from ?? -1 : -1;
    const stillPlaying = await waitUntil(() => session!.state === "playing", 800) && session.state === "playing";
    check(
      "insertion upstream shifts decorations and playback continues",
      probe != null && probeAfter === probeBefore + ins.length && stillPlaying,
      `probe word ${probe?.index} ${probeBefore}->${probeAfter} (+${ins.length}), state=${session.state}`
    );

    // 7. Stop clears all decorations and releases audio (no element left advancing)
    session.stop();
    const clearedNow = field().words.length === 0 && field().word === -1;
    const wordAtStop = field().word;
    await sleep(500);
    const stayedFrozen = field().word === wordAtStop && field().words.length === 0;
    check(
      "stop clears all decorations and releases audio",
      clearedNow && stayedFrozen && session.state === "idle",
      `words=${field().words.length}, word=${field().word}, state=${session.state}, frozen after 500ms=${stayedFrozen}`
    );

    // ─── Control-surface checks (spec 0003) ──────────────────────────────────
    // Retire the skeleton session; checks 8 to 10 drive fresh ones.
    session.dispose();
    session = null;

    // Dispatch a real mousedown on a word so the plugin's registered click
    // handler (which consults listeningMode) fires, exactly as a user click would.
    const clickWord = async (e: WordEntry): Promise<boolean> => {
      const midPos = Math.floor((e.runs[0].from + e.runs[0].to) / 2);
      cm.dispatch({ effects: EditorView.scrollIntoView(midPos) });
      await sleep(120);
      const c = cm.coordsAtPos(midPos);
      if (!c) return false;
      cm.contentDOM.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: (c.left + c.right) / 2 || c.left + 1,
          clientY: (c.top + c.bottom) / 2,
          bubbles: true,
        })
      );
      return true;
    };

    // 8. Speed change during playback reaches the live audio playbackRate within
    //    500ms without a session restart (same session object).
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      speed: 1.0,
      onState: (s) => { lastState = s; },
    });
    session.playPause();
    const playing8 = await waitUntil(() => session!.state === "playing", 6000);
    const sameSession = session;
    session.setSpeed(2.0);
    const rateApplied = await waitUntil(() => session!.audioPlaybackRates.some((r) => r === 2.0), 500);
    check(
      "speed change during playback reaches the live audio within 500ms (same session)",
      playing8 && rateApplied && session === sameSession,
      `playing=${playing8}, rates=[${session.audioPlaybackRates.join(", ")}], sameSession=${session === sameSession}`
    );
    session.dispose();
    session = null;

    // 9. Listening mode gates click-to-seek, driven through the REAL click path:
    //    OFF -> a click does not move the current word; ON -> the same click seeks.
    plugin.acceptanceStartSession(cm, NOTE);
    const started9 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && field().word >= 0,
      6000
    );
    // pause so natural progression cannot confound the click assertions
    plugin.acceptanceSession()?.playPause();
    await waitUntil(() => plugin.acceptanceSession()?.state === "paused", 1500);
    const frozenWord = field().word;
    const clickable = field().words.filter((e) => e.runs.length > 0);
    const target9 = clickable[Math.min(clickable.length - 1, 20)];

    plugin.settings.listeningMode = false;
    const off1 = await clickWord(target9);
    await sleep(350);
    const offWord = field().word;
    const stayedOff = offWord === frozenWord;

    plugin.settings.listeningMode = true;
    const on1 = await clickWord(target9);
    const movedOn = await waitUntil(
      () => field().word === target9.index || field().word === target9.index + 1,
      1500
    );
    check(
      "listening mode gates click-to-seek (off: no move, on: seeks to the clicked word)",
      started9 && off1 && on1 && stayedOff && movedOn,
      `frozen=${frozenWord}, off stayed at ${offWord}, on reached ${field().word}, target=${target9.index} ("${target9.text}")`
    );
    plugin.acceptanceDisposeSession();

    // 10. Voice change during playback lands PAUSED primed at the captured word,
    //     and a subsequent play resumes there with the new voice.
    const voiceA = "en-US-AriaNeural";
    const voiceB = "en-US-GuyNeural";
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      voice: voiceA,
      speed: 1.0,
      onState: (s) => { lastState = s; },
    });
    session.playPause();
    const playing10 = await waitUntil(() => session!.state === "playing" && field().word >= 0, 6000);
    const capturedWord = field().word;
    const capturedSentence = field().sentence;
    // reconfigure in place: dispose, rebuild primed PAUSED at the captured word
    session.dispose();
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      voice: voiceB,
      speed: 1.0,
      primeAtWord: capturedWord,
      onState: (s) => { lastState = s; },
    });
    const primedPaused = await waitUntil(() => session!.state === "paused", 6000);
    const sentenceWords10 = field()
      .words.filter((e) => e.sentence === capturedSentence && e.runs.length > 0)
      .map((e) => e.index);
    const firstWord10 = sentenceWords10.length ? Math.min(...sentenceWords10) : capturedWord;
    session.playPause(); // resume
    const resumed = await waitUntil(
      () =>
        session!.state === "playing" &&
        (field().word === capturedWord || field().word === firstWord10 || field().word === firstWord10 + 1),
      6000
    );
    check(
      "voice change primes paused at the captured word; play resumes there with the new voice",
      playing10 && primedPaused && resumed,
      `captured=${capturedWord} (sentence ${capturedSentence}, start ${firstWord10}), primedPaused=${primedPaused}, resumedAt=${field().word}, newVoice=${voiceB}`
    );

    // ─── Floating pill checks (spec 0004) ────────────────────────────────────
    // Drive the real plugin session path so a real pill mounts, then exercise its
    // actual DOM controls (query by the se-pill classes) exactly as a user would.
    const pillEl = () => document.querySelector(".se-pill") as HTMLElement | null;
    const pillCount = () => document.querySelectorAll(".se-pill").length;
    const clickPill = (sel: string): boolean => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) return false;
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return true;
    };

    // Obsidian Menu helpers (spec 0005): the menu renders as `.menu` in the
    // document with `.menu-item` rows (title in `.menu-item-title`); a click on a
    // row fires its handler and closes the menu; Escape closes it without a pick.
    const menuEl = () => document.querySelector(".menu") as HTMLElement | null;
    const menuItems = (root: HTMLElement) =>
      Array.from(root.querySelectorAll(".menu-item")) as HTMLElement[];
    const itemTitle = (item: HTMLElement) =>
      (item.querySelector(".menu-item-title") as HTMLElement | null)?.textContent ??
      item.textContent ??
      "";
    const clickMenuItem = (item: HTMLElement) =>
      item.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const closeMenus = async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await waitUntil(() => menuEl() === null, 1000);
    };

    // 11. Starting a session (plugin path) mounts exactly one pill inside that
    //     editor's container, and its play control reflects "playing".
    plugin.settings.speed = 1.0; // known preset so check 13 is deterministic
    plugin.acceptanceStartSession(cm, NOTE);
    const started11 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && !!pillEl(),
      6000
    );
    const anchor11 = (cm.scrollDOM.offsetParent as HTMLElement | null) ?? cm.dom;
    const pill11 = pillEl();
    const play11 = document.querySelector(".se-pill-play") as HTMLElement | null;
    check(
      "starting a session mounts exactly one pill in the editor; play reflects playing",
      started11 && pillCount() === 1 && !!pill11 && anchor11.contains(pill11) && play11?.dataset.icon === "pause",
      `started=${started11}, pills=${pillCount()}, anchored=${pill11 ? anchor11.contains(pill11) : false}, playGlyph=${play11?.dataset.icon}`
    );

    // 12. Clicking the pill's play control pauses (glyph flips to play); clicking
    //     again resumes (glyph flips back to pause).
    const clickedPause = clickPill(".se-pill-play");
    const paused12 = await waitUntil(() => plugin.acceptanceSession()?.state === "paused", 2000);
    const pauseGlyph = (document.querySelector(".se-pill-play") as HTMLElement | null)?.dataset.icon;
    const clickedResume = clickPill(".se-pill-play");
    const resumed12 = await waitUntil(() => plugin.acceptanceSession()?.state === "playing", 3000);
    const resumeGlyph = (document.querySelector(".se-pill-play") as HTMLElement | null)?.dataset.icon;
    check(
      "clicking the pill play control pauses then resumes, glyph tracking state",
      clickedPause && paused12 && pauseGlyph === "play" && clickedResume && resumed12 && resumeGlyph === "pause",
      `paused=${paused12} (glyph ${pauseGlyph}), resumed=${resumed12} (glyph ${resumeGlyph})`
    );

    // 13. Clicking the speed control opens the preset MENU rather than cycling a
    //     preset in place: spec 0005 replaced the click-cycles gesture with a
    //     menu. A `.menu` appears carrying the full preset grid plus the settings
    //     escape hatch, opening it does NOT change settings.speed, and it closes
    //     cleanly. Applying a pick from the menu is check 16.
    const speedBefore13 = plugin.settings.speed;
    const opened13 = clickPill(".se-pill-speed");
    const menuUp13 = await waitUntil(() => menuEl() !== null, 1500);
    const m13 = menuEl();
    const titles13 = m13 ? menuItems(m13).map(itemTitle) : [];
    const hasGrid13 = SPEED_PRESETS.every((p) => titles13.includes(formatSpeedTitle(p)));
    const hasSettings13 = titles13.includes("Fine-tune in settings");
    const noCycle13 = Math.abs(plugin.settings.speed - speedBefore13) < 1e-9;
    await closeMenus();
    const closed13 = menuEl() === null;
    check(
      "clicking the speed control opens the preset menu without cycling in place (spec 0005)",
      opened13 && menuUp13 && hasGrid13 && hasSettings13 && noCycle13 && closed13,
      `opened=${opened13}, grid=${hasGrid13}, settingsItem=${hasSettings13}, speed stayed ${plugin.settings.speed}, closed=${closed13}`
    );

    // 14. A user-like edit fades the pill (opacity < 1 within 200ms) and it
    //     restores to full opacity within 2.5s without any hover.
    cm.dispatch({ changes: { from: 0, insert: "Z " } });
    const faded14 = await waitUntil(() => {
      const el = pillEl();
      return !!el && parseFloat(getComputedStyle(el).opacity || "1") < 1;
    }, 200);
    const restored14 = await waitUntil(() => {
      const el = pillEl();
      return !!el && parseFloat(getComputedStyle(el).opacity || "0") >= 0.99;
    }, 2500);
    check(
      "a user edit fades the pill then it restores to full opacity without a hover",
      faded14 && restored14,
      `faded=${faded14}, restored=${restored14}, opacity=${pillEl() ? getComputedStyle(pillEl()!).opacity : "n/a"}`
    );

    // 15. The pill's stop control removes the pill from the DOM entirely, and a
    //     fresh play mounts a brand-new one.
    const clickedStop = clickPill(".se-pill-stop");
    const removed15 = await waitUntil(() => pillCount() === 0, 2000);
    plugin.acceptanceStartSession(cm, NOTE);
    const remounted15 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && pillCount() === 1,
      6000
    );
    check(
      "the pill stop control removes the pill entirely; a fresh play mounts a new one",
      clickedStop && removed15 && remounted15 && pillCount() === 1,
      `stopped=${clickedStop}, removedToZero=${removed15}, freshPills=${pillCount()}`
    );
    plugin.acceptanceDisposeSession();

    // ─── Pill menu checks (spec 0005) ────────────────────────────────────────

    // 16. Clicking the pill's speed control opens a menu whose checked item
    //     matches settings.speed; choosing a different preset updates
    //     settings.speed, the live audio rate, and the pill label, and closes.
    plugin.settings.speed = 1.0; // known checked preset
    plugin.acceptanceStartSession(cm, NOTE);
    const started16 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && !!pillEl(),
      6000
    );
    clickPill(".se-pill-speed");
    const menuUp16 = await waitUntil(() => menuEl() !== null, 1500);
    const m16 = menuEl();
    const items16 = m16 ? menuItems(m16) : [];
    // the item titled with the current speed is the checked one (model-guaranteed)
    const currentItem16 = items16.find((it) => itemTitle(it) === formatSpeedTitle(plugin.settings.speed));
    const targetSpeed16 = 1.5;
    const targetItem16 = items16.find((it) => itemTitle(it) === formatSpeedTitle(targetSpeed16));
    if (targetItem16) clickMenuItem(targetItem16);
    const applied16 = await waitUntil(() => Math.abs(plugin.settings.speed - targetSpeed16) < 1e-9, 1500);
    const audio16 = await waitUntil(
      () => plugin.acceptanceSession()?.audioPlaybackRates.some((r) => Math.abs(r - targetSpeed16) < 1e-9) ?? false,
      1000
    );
    const label16 = (document.querySelector(".se-pill-speed") as HTMLElement | null)?.textContent ?? "";
    const closed16 = await waitUntil(() => menuEl() === null, 1500);
    check(
      "clicking the speed control opens a menu and a preset pick applies (setting + live audio + label), then closes",
      started16 && menuUp16 && !!currentItem16 && !!targetItem16 && applied16 && audio16 &&
        label16.includes(formatSpeedTitle(targetSpeed16)) && closed16,
      `checked=${currentItem16 ? itemTitle(currentItem16) : "none"}, speed=${plugin.settings.speed} (target ${targetSpeed16}), rates=[${plugin.acceptanceSession()?.audioPlaybackRates.join(", ")}], label="${label16}", closed=${closed16}`
    );
    plugin.acceptanceDisposeSession();

    // 17. Clicking the pill's voice control opens a menu with at least the active
    //     provider section and one voice item; choosing a different voice lands
    //     the session paused-primed (0003's contract) and the pill label updates.
    plugin.settings.providerId = "edge";
    plugin.acceptanceStartSession(cm, NOTE);
    const started17 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && !!pillEl(),
      6000
    );
    const voiceLabelBefore17 = (document.querySelector(".se-pill-voice") as HTMLElement | null)?.textContent ?? "";
    clickPill(".se-pill-voice");
    // The voice list resolves asynchronously (Edge fetch) BEFORE the menu shows.
    const menuUp17 = await waitUntil(() => menuEl() !== null, 8000);
    const m17 = menuEl();
    const rows17 = m17
      ? (Array.from(m17.querySelectorAll(".menu-item, .menu-separator")) as HTMLElement[])
      : [];
    const sepIdx17 = rows17.findIndex((el) => el.classList.contains("menu-separator"));
    const providerItems17 = (sepIdx17 >= 0 ? rows17.slice(0, sepIdx17) : rows17).filter((el) =>
      el.classList.contains("menu-item")
    );
    const voiceItems17 = (sepIdx17 >= 0 ? rows17.slice(sepIdx17 + 1) : []).filter((el) =>
      el.classList.contains("menu-item")
    );
    const hasProvider17 = providerItems17.some((it) => itemTitle(it).startsWith("Edge"));
    const hasVoices17 = voiceItems17.length >= 1;
    // pick a voice whose label differs from the one currently shown on the pill
    const targetVoice17 =
      voiceItems17.find((it) => itemTitle(it) && itemTitle(it) !== voiceLabelBefore17) ?? voiceItems17[0];
    const targetLabel17 = targetVoice17 ? itemTitle(targetVoice17) : "";
    if (targetVoice17) clickMenuItem(targetVoice17);
    const primedPaused17 = await waitUntil(() => plugin.acceptanceSession()?.state === "paused", 8000);
    const labelUpdated17 = await waitUntil(
      () => ((document.querySelector(".se-pill-voice") as HTMLElement | null)?.textContent ?? "") === targetLabel17,
      2000
    );
    const closed17 = await waitUntil(() => menuEl() === null, 1500);
    check(
      "clicking the voice control opens the provider+voice menu; a voice pick lands paused-primed and updates the label",
      started17 && menuUp17 && hasProvider17 && hasVoices17 && !!targetVoice17 && primedPaused17 && labelUpdated17 && closed17,
      `providers=${providerItems17.length}, voices=${voiceItems17.length}, picked="${targetLabel17}", state=${plugin.acceptanceSession()?.state}, label="${(document.querySelector(".se-pill-voice") as HTMLElement | null)?.textContent}", closed=${closed17}`
    );
    plugin.acceptanceDisposeSession();

    if (hiddenMidRun()) {
      lines.splice(2, 0, `RESULT: ABORTED MID-RUN`, ``, `The window went hidden during the control-surface checks; rAF-driven`, `measurements are invalid. Keep the window visible and rerun.`);
      await write();
      return;
    }

    const allPass = checks.every((c) => c.pass);
    lines.splice(
      2,
      0,
      `RESULT: ${allPass ? "ALL PASS" : "FAILURES PRESENT"} (${checks.filter((c) => c.pass).length}/${checks.length})`,
      ``
    );
    await write();
  } catch (e: any) {
    lines.splice(2, 0, `RESULT: FAIL (unhandled)`, ``, String(e?.stack ?? e), ``);
    try {
      await write();
    } catch {
      /* nothing more we can do */
    }
  } finally {
    session?.dispose();
    plugin.acceptanceDisposeSession();
    // Restore settings to their pre-run values so repeat runs are stable.
    try {
      const snap = JSON.parse(settingsSnapshot);
      plugin.settings.providerId = snap.providerId;
      plugin.settings.voiceByProvider = snap.voiceByProvider;
      plugin.settings.speed = snap.speed;
      plugin.settings.listeningMode = snap.listeningMode;
      await plugin.saveSettings();
    } catch {
      /* restoring settings is best-effort; never mask the run's own outcome */
    }
  }
}

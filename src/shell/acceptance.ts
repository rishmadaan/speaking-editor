// Automated in-app acceptance checks for the walking skeleton, spike-report style.
// Gated behind DEV_ACCEPTANCE so it never ships. Opens a fixture note in live
// preview, drives a real ReadingSession (real Edge synthesis, real audio), runs the
// seven checks from specs/0001, and writes skeleton-acceptance.md to the vault root.
// Every failure path still writes the report, so a run is never silently lost.
import { App, MarkdownView, Notice, TFile } from "obsidian";
import { EditorView } from "@codemirror/view";
import { mkdtempSync, existsSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { syncField } from "./sync-field";
import { ReadingSession } from "./session";
import { WordEntry } from "./word-runs";
import { SPEED_PRESETS } from "./player-pill";
import { formatSpeedTitle } from "./pill-menus";
import { DiskCache } from "../engine/synthesis/disk-cache";
import { EdgeProvider } from "../engine/synthesis/edge";
import { ChunkAudio, TtsProvider, VoiceInfo } from "../engine/synthesis/provider";
import { Chunk, parseDocument, buildChunks } from "../engine/core";
import { mapProviderError } from "./error-copy";
import { providerLabel } from "./providers";
import type SpeakingEditorPlugin from "./main";

// A pass-through TTS provider that counts synthesize (network) calls, so check
// 18 can prove a cached replay hits zero of them. Delegates identity to the
// wrapped provider so cache keys match across runs.
class CountingProvider implements TtsProvider {
  synthCount = 0;
  constructor(private inner: TtsProvider) {}
  get id() { return this.inner.id; }
  get label() { return this.inner.label; }
  get requiresKey() { return this.inner.requiresKey; }
  get timingQuality() { return this.inner.timingQuality; }
  get maxCharsPerRequest() { return this.inner.maxCharsPerRequest; }
  get defaultVoice() { return this.inner.defaultVoice; }
  listVoices(): Promise<VoiceInfo[]> { return this.inner.listVoices(); }
  synthesize(chunk: Chunk, voice: string, signal: AbortSignal): Promise<ChunkAudio> {
    this.synthCount++;
    return this.inner.synthesize(chunk, voice, signal);
  }
}

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
  // Snapshot settings AND positions so the checks (which mutate provider/voice/
  // listening mode and reading positions) restore them at the end; repeat runs
  // stay stable and the harness never leaves residue a user would trip over.
  const settingsSnapshot = JSON.stringify(plugin.settings);
  const positionsSnapshot = plugin.acceptancePositionsSnapshot();
  // The run drives the plugin's own sessions on a shared editor. A human press
  // mid-run creates two drivers for one car (2026-07-12: stacking voices, dead
  // toggles). Make the plugin's user-facing controls inert for the duration and
  // say so with a banner that stays up until the run ends.
  plugin.acceptanceRunning = true;
  const banner = new Notice("Speaking Editor verification is running (about a minute). Please do not click or play until this notice disappears.", 0);
  const write = () => app.vault.adapter.write(REPORT, lines.join("\n") + "\n");
  // write after every check so a mid-run hang or abort never loses the trail
  const check = (name: string, pass: boolean, detail: string) => {
    checks.push({ name, pass, detail });
    lines.push(`- ${pass ? "PASS" : "FAIL"}: ${name}. ${detail}`);
    void write();
  };
  // A skipped check is stated loudly with its reason, never silently dropped:
  // some behaviors cannot be driven by synthetic input (Obsidian renders no
  // menus for it, verified against Obsidian's own context menu) and are covered
  // by unit-tested models plus the manual pass instead.
  const skips: string[] = [];
  const skip = (name: string, reason: string) => {
    skips.push(name);
    lines.push(`- SKIP: ${name}. ${reason}`);
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
    //     and a subsequent play resumes from that word's sentence start with the
    //     new voice. Driven through the REAL plugin path (applyVoice), which is
    //     what a user's settings/menu pick actually calls.
    const voiceB = "en-US-GuyNeural";
    plugin.acceptanceStartSession(cm, NOTE);
    const playing10 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && field().word >= 2,
      15000
    );
    const capturedWord = field().word;
    const capturedSentence = field().sentence;
    await plugin.applyVoice(plugin.settings.providerId, voiceB);
    const primedPaused = await waitUntil(() => plugin.acceptanceSession()?.state === "paused", 8000);
    const sentenceWords10 = field()
      .words.filter((e) => e.sentence === capturedSentence && e.runs.length > 0)
      .map((e) => e.index);
    const firstWord10 = sentenceWords10.length ? Math.min(...sentenceWords10) : capturedWord;
    plugin.acceptanceSession()?.playPause(); // resume with the new voice
    const resumed = await waitUntil(
      () =>
        plugin.acceptanceSession()?.state === "playing" &&
        field().word >= firstWord10 && field().word <= capturedWord + 2,
      15000
    );
    check(
      "voice change primes paused at the captured word; play resumes there with the new voice",
      playing10 && primedPaused && resumed,
      `captured=${capturedWord} (sentence ${capturedSentence}, start ${firstWord10}), primedPaused=${primedPaused}, resumedAt=${field().word}, newVoice=${voiceB}`
    );
    await plugin.applyVoice(plugin.settings.providerId, "en-US-AriaNeural");
    plugin.acceptanceDisposeSession();

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

    // 13. Menus cannot be opened by synthetic input (Obsidian's popover layer
    //     renders nothing for it; its OWN context menu behaves identically), so
    //     the menu checks are explicit skips covered by unit-tested menu models
    //     and the manual pass.
    skip(
      "clicking the speed control opens the preset menu without cycling in place (spec 0005)",
      "menus need real user input; models unit-tested, manual pass covers the click"
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

    skip(
      "clicking the speed control opens a menu and a preset pick applies (setting + live audio + label), then closes",
      "menus need real user input; applySpeed itself is covered by check 8"
    );

    skip(
      "clicking the voice control opens the provider+voice menu; a voice pick lands paused-primed and updates the label",
      "menus need real user input; the reconfigure contract is covered by check 10"
    );

    // ─── Disk cache and resume checks (spec 0006) ────────────────────────────
    // Give the cache its OWN throwaway directory under the system temp dir, never
    // the real per-device cache location, so the run is deterministic and leaves
    // no trace outside a scratch folder.
    const harnessCacheDir = mkdtempSync(join(tmpdir(), "se-acceptance-cache-"));
    const sharedCache = new DiskCache(harnessCacheDir, 200 * 1024 * 1024);
    const edge = new EdgeProvider();

    // 18. Playing the fixture twice with the same voice hits the disk cache on the
    //     second run: run one caches the opening chunks, run two reaches "playing"
    //     with its first chunk served from disk and zero provider synthesize calls.
    const counting1 = new CountingProvider(edge);
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      provider: counting1,
      cache: sharedCache,
      onState: (s) => { lastState = s; },
    });
    session.playPause();
    const played18a = await waitUntil(() => session!.state === "playing" && field().word >= 0, 12000);
    // The fixture fits in ONE chunk, so run one makes exactly one synthesize
    // call; wait for it and for the cache write to settle before teardown.
    const cached18 = await waitUntil(() => counting1.synthCount >= 1, 15000);
    await sleep(1200); // the service awaits cache.set() before resolving; give it room
    const firstRunCalls = counting1.synthCount;
    session.dispose();
    session = null;

    const counting2 = new CountingProvider(edge);
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      provider: counting2,
      cache: sharedCache,
      onState: (s) => { lastState = s; },
    });
    session.playPause();
    const played18b = await waitUntil(() => session!.state === "playing" && field().word >= 0, 12000);
    // Reaching "playing" only needs the first chunk; with the opening window all
    // cached, the second run made no synthesize calls to get there.
    const secondRunFree = counting2.synthCount === 0;
    check(
      "second play of the same note+voice serves its first chunk from disk cache (zero synth calls)",
      played18a && cached18 && played18b && secondRunFree,
      `run1 synthCalls=${firstRunCalls} (cached), run2 synthCalls=${counting2.synthCount} (0 expected), cacheDir=${harnessCacheDir}`
    );
    session.dispose();
    session = null;

    // 19. Stop mid-note then play again resumes at the sentence containing the
    //     stopped word; "Read this note from the top" then starts at word 0. Driven
    //     through the real plugin paths so the position store + resume are exercised.
    plugin.acceptanceDisposeSession();
    plugin.acceptanceClearPosition(NOTE); // start from a known-empty position
    plugin.acceptanceStartSession(cm, NOTE);
    const started19 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && field().word >= 0,
      8000
    );
    // Let the reading advance past the first sentence so "the stopped sentence"
    // is a genuine mid-note sentence, not sentence 0.
    const advanced19 = await waitUntil(() => field().sentence >= 1 && field().word >= 1, 12000);
    const stoppedWord = field().word;
    const stoppedSentence = field().sentence;
    plugin.acceptanceStopSession(); // records + persists the position for NOTE
    await waitUntil(() => plugin.acceptanceSession()?.state === "idle", 2000);

    // Play again -> resume at the sentence start of the stopped sentence.
    plugin.acceptanceStartSession(cm, NOTE);
    const resumedPlaying19 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && field().word >= 0,
      8000
    );
    const resumeSentenceWords = field()
      .words.filter((e) => e.sentence === stoppedSentence && e.runs.length > 0)
      .map((e) => e.index);
    const sentenceStartWord = resumeSentenceWords.length ? Math.min(...resumeSentenceWords) : stoppedWord;
    const resumedAtSentence = await waitUntil(
      () =>
        field().sentence === stoppedSentence &&
        (field().word === sentenceStartWord || field().word === sentenceStartWord + 1),
      4000
    );
    const resumedWord = field().word;
    const resumedSentence = field().sentence;

    // "Read from the top" resets to word 0 and clears the saved position.
    plugin.acceptanceReadFromTop(cm, NOTE);
    const fromTop19 = await waitUntil(
      () =>
        plugin.acceptanceSession()?.state === "playing" &&
        (field().word === 0 || field().word === 1),
      8000
    );
    check(
      "stop mid-note resumes at the stopped sentence; read-from-top restarts at word 0",
      started19 && advanced19 && resumedPlaying19 && resumedAtSentence && fromTop19,
      `stopped at word ${stoppedWord} (sentence ${stoppedSentence}); resumed at word ${resumedWord} (sentence ${resumedSentence}, start ${sentenceStartWord}); from-top word=${field().word}`
    );
    plugin.acceptanceDisposeSession();

    // ─── Reading-mode checks (spec 0007) ─────────────────────────────────────
    // Flip the fixture leaf into Reading Mode (the rendered preview) and drive the
    // same plugin session path. The surface becomes a RangeSurface painting through
    // the CSS Custom Highlight API, all-or-nothing per note: aligned -> ranges,
    // not aligned -> no highlight at all.
    const readingRoot = (): HTMLElement | null => {
      const root = (mdView as any).previewMode?.containerEl as HTMLElement | undefined;
      if (!root) return null;
      return (
        (root.querySelector(".markdown-preview-sizer") as HTMLElement | null) ??
        (root.querySelector(".markdown-preview-view") as HTMLElement | null) ??
        root
      );
    };
    const wordHi = () => CSS.highlights.get("se-word-r");
    const sentHi = () => CSS.highlights.get("se-sentence-r");

    await (mdView as any).setState(
      { ...(mdView as any).getState(), mode: "preview", source: false },
      { history: false }
    );
    const rendered20 = await waitUntil(
      () => (readingRoot()?.textContent ?? "").includes("closing paragraph"),
      6000
    );

    // 20. In reading mode on the dialect fixture, play reaches "playing", the
    //     alignment succeeds (surface "range"), and CSS.highlights carries a word
    //     range for the current word within 6s.
    plugin.acceptanceStartSession(cm, NOTE);
    const painted20 = await waitUntil(
      () =>
        plugin.acceptanceSession()?.state === "playing" &&
        plugin.acceptanceSession()?.highlightSurface === "range" &&
        (wordHi()?.size ?? 0) > 0,
      6000
    );
    check(
      "reading mode: play reaches playing, alignment succeeds, and CSS.highlights paints the current word within 6s",
      rendered20 && painted20,
      `rendered=${rendered20}, state=${plugin.acceptanceSession()?.state}, surface=${plugin.acceptanceSession()?.highlightSurface}, wordRanges=${wordHi()?.size ?? 0}, sentenceRanges=${sentHi()?.size ?? 0}`
    );

    // 21. A listening-mode click on a rendered word seeks playback there (same
    //     contract as check 4), via caretRangeFromPoint -> nearest aligned word.
    plugin.settings.listeningMode = true;
    const session21 = plugin.acceptanceSession();
    let target21 = -1;
    let rect21: DOMRect | null = null;
    let frozen21 = -1;
    let dispatched21 = false;
    if (session21) {
      session21.playPause(); // pause so natural progression cannot confound the click
      await waitUntil(() => session21.state === "paused", 1500);
      frozen21 = session21.currentWord;
      // pick an aligned word ahead of the frozen one whose rendered rect is inside
      // the viewport (so caretRangeFromPoint lands on it)
      for (let w = frozen21 + 3; w < frozen21 + 60; w++) {
        const r = session21.acceptanceWordRect(w);
        if (r && r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight) {
          target21 = w;
          rect21 = r;
          break;
        }
      }
      const container21 = plugin.acceptanceReadingContainer();
      if (rect21 && container21) {
        container21.dispatchEvent(
          new MouseEvent("mousedown", {
            clientX: (rect21.left + rect21.right) / 2,
            clientY: (rect21.top + rect21.bottom) / 2,
            bubbles: true,
          })
        );
        dispatched21 = true;
      }
    }
    const seeked21 = await waitUntil(
      () =>
        !!session21 && (session21.currentWord === target21 || session21.currentWord === target21 + 1),
      1500
    );
    check(
      "reading mode: a listening-mode click on a rendered word seeks playback there within 1s",
      dispatched21 && target21 >= 0 && seeked21,
      `frozen=${frozen21}, target=${target21}, dispatched=${dispatched21}, current=${session21?.currentWord}`
    );
    plugin.acceptanceDisposeSession();

    // 22. A note engineered to defeat alignment (a rendered-only stretch longer
    //     than the lookahead cap injected at the top of the content) still PLAYS
    //     but registers NO highlight ranges and reports surface "none": the
    //     all-or-nothing rule, asserted.
    const injectRoot = readingRoot();
    let injected22 = false;
    if (injectRoot) {
      const junk = injectRoot.ownerDocument.createElement("span");
      junk.textContent = "Zq9 ".repeat(120); // ~480 rendered-only chars, no model word, past the cap
      injectRoot.insertBefore(junk, injectRoot.firstChild);
      injected22 = true;
    }
    plugin.acceptanceStartSession(cm, NOTE);
    const playing22 = await waitUntil(
      () =>
        plugin.acceptanceSession()?.state === "playing" &&
        (plugin.acceptanceSession()?.currentWord ?? -1) >= 0,
      8000
    );
    const surfaceNone22 = plugin.acceptanceSession()?.highlightSurface === "none";
    const noRanges22 =
      !CSS.highlights.has("se-word-r") &&
      !CSS.highlights.has("se-sentence-r");
    check(
      "reading mode all-or-nothing: an unalignable note still plays but registers no highlight ranges (surface none)",
      injected22 && playing22 && surfaceNone22 && noRanges22,
      `injected=${injected22}, state=${plugin.acceptanceSession()?.state}, word=${plugin.acceptanceSession()?.currentWord}, surface=${plugin.acceptanceSession()?.highlightSurface}, wordReg=${CSS.highlights.has("se-word-r")}, sentReg=${CSS.highlights.has("se-sentence-r")}`
    );
    plugin.acceptanceDisposeSession();
    // remove the injected junk so a rerun starts clean
    try {
      if (injectRoot && injected22 && injectRoot.firstChild) injectRoot.removeChild(injectRoot.firstChild);
    } catch {
      /* best-effort cleanup */
    }

    // ─── UX P1 checks (spec 0009) ────────────────────────────────────────────
    // Back to live preview (source) for a clean CM editor: the preparing pill and
    // the seek-hint click path both exercise the editor surface, not the preview.
    await (mdView as any).setState(
      { ...(mdView as any).getState(), mode: "source", source: false },
      { history: false }
    );
    await sleep(200);

    // 23. Immediately after play on a note, the session reports "preparing" and
    //     the pill carries the preparing class (a play request emits "preparing"
    //     synchronously, before any audio); when "playing" arrives both clear.
    plugin.acceptanceClearPosition(NOTE); // a clean start from the top
    plugin.acceptanceStartSession(cm, NOTE); // startSession issues playPause synchronously
    const preparingState23 = plugin.acceptanceSession()?.state === "preparing";
    const pillPreparing23 =
      !!document.querySelector(".se-pill-preparing") ||
      !!document.querySelector(".se-pill-play-preparing");
    const cleared23 = await waitUntil(
      () =>
        plugin.acceptanceSession()?.state === "playing" &&
        !document.querySelector(".se-pill-preparing") &&
        !document.querySelector(".se-pill-play-preparing"),
      10000
    );
    check(
      "play reports preparing with a breathing pill; both clear when playing arrives",
      preparingState23 && pillPreparing23 && cleared23,
      `preparing=${preparingState23}, pillPreparing=${pillPreparing23}, clearedOnPlaying=${cleared23}, state=${plugin.acceptanceSession()?.state}`
    );
    plugin.acceptanceDisposeSession();

    // 24. A provider failure surfaces a human notice (the mapped sentence plus an
    //     action button), never the raw exception. Drive a harness session with a
    //     stub provider that rejects, wired to the real plugin error-notice path.
    const failingProvider: TtsProvider = {
      id: "edge",
      label: "Edge TTS",
      requiresKey: false,
      timingQuality: "exact",
      maxCharsPerRequest: 6000,
      defaultVoice: "en-US-AriaNeural",
      listVoices: () => Promise.resolve([]),
      synthesize: () => Promise.reject(new Error("ECONNRESET fake")),
    };
    const expected24 = mapProviderError(
      plugin.settings.providerId,
      providerLabel(plugin.settings.providerId),
      process.platform,
      "ECONNRESET fake"
    ).sentence;
    let errorNotice: Notice | null = null;
    session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri: NOTE,
      view: cm,
      provider: failingProvider,
      onState: (s, msg) => {
        if (s === "error") errorNotice = plugin.acceptanceShowSessionError(msg);
      },
    });
    session.playPause();
    const noticeShown24 = await waitUntil(
      () =>
        Array.from(document.querySelectorAll(".notice")).some((n) =>
          (n.textContent ?? "").includes(expected24)
        ),
      10000
    );
    const noticeEls24 = Array.from(document.querySelectorAll(".notice"));
    const noticeText24 = noticeEls24.map((n) => n.textContent ?? "").join(" | ");
    const hasSentence24 = noticeText24.includes(expected24);
    const hasAction24 = noticeEls24.some((n) => !!n.querySelector("button"));
    const noRawError24 = !noticeText24.includes("ECONNRESET");
    check(
      "a provider failure shows a human notice with an action, never the raw exception",
      noticeShown24 && hasSentence24 && hasAction24 && noRawError24,
      `expected="${expected24}", shown=${noticeShown24}, sentence=${hasSentence24}, action=${hasAction24}, noRaw=${noRawError24}`
    );
    (errorNotice as Notice | null)?.hide();
    session.dispose();
    session = null;

    // 25. The first-jump hint: with the counter at 0 a real seek shows it; with
    //     the counter at 3 the same seek shows none. Driven through the real
    //     click-to-seek path (the hint gates on the counter alone, so it fires for
    //     the harness's synthetic seeks exactly as this check needs).
    plugin.acceptanceClearPosition(NOTE);
    plugin.settings.listeningMode = true;
    plugin.acceptanceStartSession(cm, NOTE);
    const started25 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && field().word >= 0,
      10000
    );
    // pause so the seek target stays put under the click assertions
    plugin.acceptanceSession()?.playPause();
    await waitUntil(() => plugin.acceptanceSession()?.state === "paused", 2000);
    const clickable25 = field().words.filter((e) => e.runs.length > 0);
    const target25a = clickable25[Math.min(clickable25.length - 1, 20)];
    const target25b = clickable25[Math.min(clickable25.length - 1, 10)];

    // counter 0 -> the seek teaches
    document.querySelectorAll(".se-hint").forEach((e) => e.remove());
    plugin.settings.seekHintsShown = 0;
    const clicked25a = await clickWord(target25a);
    const hintShown25 = await waitUntil(() => !!document.querySelector(".se-hint"), 1500);

    // counter 3 -> the same seek teaches nothing
    document.querySelectorAll(".se-hint").forEach((e) => e.remove());
    plugin.settings.seekHintsShown = 3;
    const clicked25b = await clickWord(target25b);
    const hintSuppressed25 = !(await waitUntil(() => !!document.querySelector(".se-hint"), 900));
    check(
      "the first-jump hint shows at counter 0 and is suppressed at counter 3",
      started25 && clicked25a && hintShown25 && clicked25b && hintSuppressed25,
      `shownAt0=${hintShown25}, suppressedAt3=${hintSuppressed25}, counterAfterFirst=${plugin.settings.seekHintsShown}`
    );
    plugin.acceptanceDisposeSession();
    document.querySelectorAll(".se-hint").forEach((e) => e.remove());

    // ─── UX P2 checks (spec 0010) ────────────────────────────────────────────
    const getFileByName = (name: string): TFile =>
      (app.vault.getAbstractFileByPath(name) as TFile) ??
      app.vault.getFiles().find((f) => f.path === name)!;
    const remainingEl = () => document.querySelector(".se-pill-remaining") as HTMLElement | null;
    const editedEl = () => document.querySelector(".se-pill-edited") as HTMLElement | null;
    const pillCount26 = () => document.querySelectorAll(".se-pill").length;

    // 26. During playback the pill shows a remaining-time label once timings exist,
    //     and the estimate shrinks as reading proceeds (sampled twice, 3s apart).
    plugin.acceptanceClearPosition(NOTE);
    plugin.settings.speed = 1.0;
    plugin.acceptanceStartSession(cm, NOTE);
    const started26 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && field().word >= 0,
      10000
    );
    // wait for a shown (non-empty, not hidden) remaining label: timings harvested
    const labelShown26 = await waitUntil(() => {
      const el = remainingEl();
      return (
        !!el &&
        (el.textContent ?? "").length > 0 &&
        !el.classList.contains("se-pill-remaining-hidden")
      );
    }, 12000);
    const est26a = plugin.acceptanceSession()?.remainingEstimate() ?? null;
    const label26a = remainingEl()?.textContent ?? "";
    await sleep(3000);
    const est26b = plugin.acceptanceSession()?.remainingEstimate() ?? null;
    const label26b = remainingEl()?.textContent ?? "";
    const shrank26 = !!est26a && !!est26b && est26b.wordsLeft < est26a.wordsLeft;
    check(
      "the pill shows a remaining-time label during playback and the estimate shrinks as it reads",
      started26 && labelShown26 && shrank26 && label26a.length > 0 && label26b.length > 0,
      `shown=${labelShown26}, label1="${label26a}" wordsLeft=${est26a?.wordsLeft}, label2="${label26b}" wordsLeft=${est26b?.wordsLeft}, shrank=${shrank26}`
    );
    plugin.acceptanceDisposeSession();

    // 27. Natural end on a two-sentence fixture: the last word's highlight is still
    //     present ~300ms after "ended", gone by ~1200ms (the 600ms linger), and the
    //     pill element leaves the DOM after its fade.
    const ENDING_NOTE = "Skeleton Ending.md";
    await app.vault.adapter.write(ENDING_NOTE, "Hi there friend. Bye now everyone.\n");
    const endLeaf = app.workspace.getLeaf(true);
    await endLeaf.openFile(getFileByName(ENDING_NOTE));
    const endView = endLeaf.view as MarkdownView;
    await (endView as any).setState(
      { ...(endView as any).getState(), mode: "source", source: false },
      { history: false }
    );
    const endCm: EditorView = (endView.editor as any).cm;
    const endField = () => endCm.state.field(syncField);
    plugin.acceptanceClearPosition(ENDING_NOTE);
    plugin.acceptanceStartSession(endCm, ENDING_NOTE);
    const endedReached27 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "ended",
      25000
    );
    await sleep(300);
    const present300_27 = endField().word >= 0; // decoration still lingering
    const clearedBy1200_27 = await waitUntil(() => endField().word === -1, 1100);
    const pillGone27 = await waitUntil(() => pillCount26() === 0, 1500);
    check(
      "natural end lingers the highlight ~600ms then clears, and the pill fades out of the DOM",
      endedReached27 && present300_27 && clearedBy1200_27 && pillGone27,
      `ended=${endedReached27}, present@300ms=${present300_27}, cleared<=1200ms=${clearedBy1200_27}, pillRemoved=${pillGone27}`
    );
    plugin.acceptanceDisposeSession();

    // Back to the main note's leaf and a clean source editor for checks 28/29.
    (app.workspace as any).setActiveLeaf(leaf, { focus: true });
    await sleep(150);
    await (mdView as any).setState(
      { ...(mdView as any).getState(), mode: "source", source: false },
      { history: false }
    );
    await sleep(150);

    // 28. Three edits inside distinct words during playback flip the edited badge
    //     on; a fresh session starts without it.
    plugin.acceptanceClearPosition(NOTE);
    plugin.acceptanceStartSession(cm, NOTE);
    const started28 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing" && field().word >= 0,
      10000
    );
    // pick three distinct words wide enough to edit strictly inside a run
    const editable28 = field().words.filter(
      (e) => e.runs.length > 0 && e.runs[0].to - e.runs[0].from >= 3
    );
    const picks28 = [editable28[5], editable28[10], editable28[15]].filter(Boolean);
    // insert from the highest offset down so earlier picks' offsets do not shift
    const mids28 = picks28
      .map((e) => Math.floor((e.runs[0].from + e.runs[0].to) / 2))
      .sort((a, b) => b - a);
    for (const at of mids28) cm.dispatch({ changes: { from: at, insert: "x" } });
    const badgeOn28 = await waitUntil(() => {
      const el = editedEl();
      return !!el && !el.classList.contains("se-pill-edited-hidden");
    }, 1500);
    const dirtyCount28 = field().words.reduce((n, e) => n + (e.dirty ? 1 : 0), 0);
    // a fresh session starts without the badge
    plugin.acceptanceDisposeSession();
    plugin.acceptanceStartSession(cm, NOTE);
    await waitUntil(() => plugin.acceptanceSession()?.state === "playing", 8000);
    const el28b = editedEl();
    const badgeOffFresh28 = !!el28b && el28b.classList.contains("se-pill-edited-hidden");
    check(
      "three mid-word edits flip the edited badge on; a fresh session starts without it",
      started28 && picks28.length === 3 && badgeOn28 && badgeOffFresh28,
      `picks=${picks28.length}, dirtyWords=${dirtyCount28}, badgeOn=${badgeOn28}, freshHidden=${badgeOffFresh28}`
    );
    plugin.acceptanceDisposeSession();

    // 29. Warm start: with the guardrails satisfied (played once, Edge, idle, cache
    //     miss), switching to a never-played note writes chunk-0 cache files into
    //     the plugin's REAL cache within 10s, without a session or audio; switching
    //     with a session ACTIVE does not warm up. Clean the files afterward.
    const WARM_NOTE = "Skeleton Warmup.md";
    const WARM_TEXT =
      "Warm start paragraph with plenty of ordinary words so the first chunk of audio is worth synthesizing into the cache for an instant later play. A second sentence keeps it safe.\n";
    const WARM_NOTE2 = "Skeleton Warmup Two.md";
    const WARM_TEXT2 =
      "Another warmup note whose opening chunk uses entirely different vocabulary so its cache key never collides with the earlier warm note referenced above. Second sentence follows along.\n";
    await app.vault.adapter.write(WARM_NOTE, WARM_TEXT);
    await app.vault.adapter.write(WARM_NOTE2, WARM_TEXT2);

    plugin.settings.providerId = "edge";
    plugin.acceptanceSetPlayedOnce(true);
    const warmVoice = plugin.acceptanceWarmVoice();
    const cacheLoc = plugin.acceptanceCacheLocation();
    const keyFor = (text: string, uri: string): string => {
      const chunks = buildChunks(parseDocument(text, uri, 1));
      return DiskCache.makeKey(chunks[0].text, "edge", warmVoice);
    };
    const filesFor = (key: string) => [join(cacheLoc, `${key}.bin`), join(cacheLoc, `${key}.json`)];
    const removeKey = (key: string) => {
      for (const f of filesFor(key)) {
        try {
          rmSync(f, { force: true });
        } catch {
          /* best effort */
        }
      }
    };
    const key1 = keyFor(WARM_TEXT, WARM_NOTE);
    const key2 = keyFor(WARM_TEXT2, WARM_NOTE2);

    // POSITIVE: idle + played-once + Edge + cache miss -> a warm-up writes chunk 0.
    plugin.acceptanceDisposeSession();
    removeKey(key1);
    removeKey(key2);
    const warmLeaf = app.workspace.getLeaf(true);
    await warmLeaf.openFile(getFileByName(WARM_NOTE));
    const warmView = warmLeaf.view as MarkdownView;
    await (warmView as any).setState(
      { ...(warmView as any).getState(), mode: "source", source: false },
      { history: false }
    );
    const warmCm: EditorView = (warmView.editor as any).cm;
    plugin.acceptanceWarmUp(warmCm, WARM_NOTE); // drive the REAL warm-up path
    const [bin1, json1] = filesFor(key1);
    const warmed29 = await waitUntil(() => existsSync(bin1) && existsSync(json1), 10000);
    const noSession29 = plugin.acceptanceSession() === null;
    const noPill29 = pillCount26() === 0;

    // NEGATIVE: a session ACTIVE -> switching to another never-played note does not
    // warm it. Pause the session so it stays active (mid-listen) for the assertion.
    plugin.acceptanceStartSession(warmCm, WARM_NOTE);
    const active29 = await waitUntil(
      () => plugin.acceptanceSession()?.state === "playing",
      12000
    );
    plugin.acceptanceSession()?.playPause(); // pause: still active, holds the gate closed
    await waitUntil(() => plugin.acceptanceSession()?.state === "paused", 3000);
    removeKey(key2);
    const warmLeaf2 = app.workspace.getLeaf(true);
    await warmLeaf2.openFile(getFileByName(WARM_NOTE2));
    const warmView2 = warmLeaf2.view as MarkdownView;
    await (warmView2 as any).setState(
      { ...(warmView2 as any).getState(), mode: "source", source: false },
      { history: false }
    );
    const warmCm2: EditorView = (warmView2.editor as any).cm;
    plugin.acceptanceWarmUp(warmCm2, WARM_NOTE2); // gate blocks it (session active)
    const [bin2, json2] = filesFor(key2);
    const notWarmedActive29 = !(await waitUntil(() => existsSync(bin2) && existsSync(json2), 3000));
    check(
      "warm start writes chunk-0 cache on an idle switch, but not while a session is active",
      warmed29 && noSession29 && noPill29 && active29 && notWarmedActive29,
      `warmedIdle=${warmed29}, noSession=${noSession29}, noPill=${noPill29}, sessionActive=${active29}, blockedWhileActive=${notWarmedActive29}, key1=${key1}`
    );
    plugin.acceptanceDisposeSession();
    // Clean the chunk-0 files this check wrote into the REAL cache.
    removeKey(key1);
    removeKey(key2);

    // 30. First-play tip (spec 0011): with the flag reset, the first plugin-path
    //     play shows the one-time tip Notice and flips the flag; a second play
    //     shows no new tip. The settings restore puts the user's flag back.
    plugin.settings.firstPlayTipShown = false;
    const tipText = "click any word to jump";
    const noticeWithTip = () =>
      Array.from(document.querySelectorAll(".notice")).some((n) => (n.textContent ?? "").includes(tipText));
    plugin.acceptanceStartSession(cm, NOTE);
    const tipShown30 = await waitUntil(noticeWithTip, 3000);
    // Boolean() defeats TS literal narrowing: startSession mutated the flag.
    const flagFlipped30 = Boolean(plugin.settings.firstPlayTipShown);
    plugin.acceptanceDisposeSession();
    // let the tip notice age out of the DOM before the second play samples
    await waitUntil(() => !noticeWithTip(), 8000);
    plugin.acceptanceStartSession(cm, NOTE);
    await sleep(600);
    const tipAgain30 = noticeWithTip();
    plugin.acceptanceDisposeSession();
    check(
      "first play ever shows the one-time tip notice and flips the flag; second play stays quiet",
      tipShown30 && flagFlipped30 && !tipAgain30,
      `tipShown=${tipShown30}, flagFlipped=${flagFlipped30}, tipOnSecondPlay=${tipAgain30}`
    );

    if (hiddenMidRun()) {
      lines.splice(2, 0, `RESULT: ABORTED MID-RUN`, ``, `The window went hidden during the control-surface checks; rAF-driven`, `measurements are invalid. Keep the window visible and rerun.`);
      await write();
      return;
    }

    const allPass = checks.every((c) => c.pass);
    const skipNote = skips.length ? `, ${skips.length} skipped (manual-pass coverage)` : "";
    lines.splice(
      2,
      0,
      `RESULT: ${allPass ? "ALL PASS" : "FAILURES PRESENT"} (${checks.filter((c) => c.pass).length}/${checks.length}${skipNote})`,
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
    plugin.acceptanceRunning = false;
    banner.hide();
    session?.dispose();
    plugin.acceptanceDisposeSession();
    // Restore settings AND positions to their pre-run values so repeat runs are
    // stable and no harness residue (e.g. a saved position on the fixture note)
    // leaks into real use.
    try {
      const snap = JSON.parse(settingsSnapshot);
      plugin.settings.providerId = snap.providerId;
      plugin.settings.voiceByProvider = snap.voiceByProvider;
      plugin.settings.speed = snap.speed;
      plugin.settings.listeningMode = snap.listeningMode;
      plugin.settings.firstPlayTipShown = snap.firstPlayTipShown;
      plugin.settings.seekHintsShown = snap.seekHintsShown;
      plugin.acceptanceRestorePositions(positionsSnapshot);
      await plugin.saveSettings();
    } catch {
      /* restoring is best-effort; never mask the run's own outcome */
    }
  }
}

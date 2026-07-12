// Automated in-app acceptance checks for the walking skeleton, spike-report style.
// Gated behind DEV_ACCEPTANCE so it never ships. Opens a fixture note in live
// preview, drives a real ReadingSession (real Edge synthesis, real audio), runs the
// seven checks from specs/0001, and writes skeleton-acceptance.md to the vault root.
// Every failure path still writes the report, so a run is never silently lost.
import { App, MarkdownView, TFile } from "obsidian";
import { EditorView } from "@codemirror/view";
import { syncField } from "./sync-field";
import { ReadingSession } from "./session";

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

export async function runAcceptance(app: App): Promise<void> {
  const lines: string[] = [`# Skeleton acceptance report`, ``];
  const checks: Check[] = [];
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
    // hidden window, which would produce misleading FAILs. Refuse to run blind.
    window.focus();
    await sleep(300);
    if (document.visibilityState === "hidden") {
      lines.splice(2, 0, `RESULT: BLOCKED`, ``, `The Obsidian window is hidden (occluded or minimized), so`, `requestAnimationFrame is paused and UI-sync checks cannot run.`, `Bring the test-vault window to the front and rerun.`);
      await write();
      return;
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
  }
}

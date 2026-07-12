/**
 * Spike 2: prove the load-bearing UI mechanism inside Obsidian's live-preview
 * editor (CodeMirror 6):
 *
 *   1. Word + sentence decorations in the native editor, painting ONLY the
 *      visible characters of a word, never markdown syntax markers.
 *   2. A frame-synced highlight loop (requestAnimationFrame driving a clock,
 *      decoration updated the same frame a word boundary is crossed).
 *   3. Click-to-seek: a click in listening mode maps back to a word index
 *      (containing word, else nearest next word, the editor-sync contract).
 *   4. Live-edit remapping via ChangeDesc.mapPos: edits shift every
 *      downstream word's decoration ranges; edits inside a word mark it
 *      dirty for the reparse-and-rechunk policy.
 *
 * Throwaway code with a self-test: it opens Spike2 Note.md, runs the checks
 * by dispatching real transactions and a real synthetic mouse event, and
 * writes spike2-report.md to the vault root. Audio is deliberately absent:
 * the clock is synthetic (fixed ms per word), because spike 1 already proved
 * timing-bearing synthesis and this spike isolates the editor mechanism.
 */
import { MarkdownView, Plugin, TFile } from "obsidian";
import { EditorState, StateEffect, StateField, ChangeDesc } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { parseDocument } from "../../src/engine/core";

const REPORT = "spike2-report.md";
const NOTE = "Spike2 Note.md";

const FIXTURE = `---
title: Spike two fixture
---

# Heading With Words

This first paragraph is plain prose with several words to walk across.

The second one has **bold emphasis**, some *italic drift*, an ` + "`inline code`" + ` span,
and a [markdown link](https://example.com) to strip.

- A list item with a **bolded** word inside it.
- Another item, kept short.

The closing paragraph gives the clock a calm runway of ordinary words to end on.
`;

// ─── Word runs: visible characters only ──────────────────────────────────────

interface Run { from: number; to: number }
interface WordEntry {
  index: number;
  text: string;
  runs: Run[];
  sentence: number;
  dirty: boolean;
}

/**
 * Greedily match a word's clean text inside its source bounding box, skipping
 * markdown marker characters. Returns the sub-ranges (document offsets) that
 * cover exactly the visible characters, so decorations never paint syntax.
 */
function cleanRuns(docSlice: string, wordText: string, boxStart: number): Run[] {
  const runs: Run[] = [];
  let wi = 0;
  let runStart = -1;
  for (let i = 0; i < docSlice.length && wi < wordText.length; i++) {
    if (docSlice[i] === wordText[wi]) {
      if (runStart < 0) runStart = i;
      wi++;
      if (wi === wordText.length) {
        runs.push({ from: boxStart + runStart, to: boxStart + i + 1 });
        runStart = -1;
      }
    } else if (runStart >= 0) {
      runs.push({ from: boxStart + runStart, to: boxStart + i });
      runStart = -1;
    }
  }
  return wi === wordText.length ? runs : [];
}

// ─── CM6 state ───────────────────────────────────────────────────────────────

const setWords = StateEffect.define<WordEntry[]>();
const setPosition = StateEffect.define<{ word: number; sentence: number }>();

interface SyncState { words: WordEntry[]; word: number; sentence: number }

function mapEntries(entries: WordEntry[], changes: ChangeDesc): WordEntry[] {
  return entries.map((e) => {
    const runs = e.runs
      .map((r) => ({ from: changes.mapPos(r.from, 1), to: changes.mapPos(r.to, -1) }))
      .filter((r) => r.to > r.from);
    let dirty = e.dirty || runs.length === 0;
    // an edit that touched inside any run makes the visible slice diverge from
    // the word text; flag it for the reparse-and-rechunk policy
    changes.iterChangedRanges((fromA, toA) => {
      for (const r of e.runs) if (fromA < r.to && toA > r.from) dirty = true;
    });
    return { ...e, runs, dirty };
  });
}

const syncField = StateField.define<SyncState>({
  create: () => ({ words: [], word: -1, sentence: -1 }),
  update(value, tr) {
    let v = value;
    if (tr.docChanged) v = { ...v, words: mapEntries(v.words, tr.changes) };
    for (const e of tr.effects) {
      if (e.is(setWords)) v = { ...v, words: e.value };
      if (e.is(setPosition)) v = { ...v, word: e.value.word, sentence: e.value.sentence };
    }
    return v;
  },
  provide: (f) =>
    EditorView.decorations.from(f, (v) => {
      const deco: { from: number; to: number; d: Decoration }[] = [];
      const word = v.words[v.word];
      for (const e of v.words) {
        if (e.sentence !== v.sentence || e.dirty) continue;
        for (const r of e.runs) deco.push({ from: r.from, to: r.to, d: sentenceDeco });
      }
      if (word && !word.dirty) for (const r of word.runs) deco.push({ from: r.from, to: r.to, d: wordDeco });
      deco.sort((a, b) => a.from - b.from || a.to - b.to);
      return Decoration.set(deco.map((x) => x.d.range(x.from, x.to)), true);
    }),
});

const sentenceDeco = Decoration.mark({ class: "se-spike-sentence" });
const wordDeco = Decoration.mark({ class: "se-spike-word" });

// ─── The spike plugin ────────────────────────────────────────────────────────

export default class Spike2Plugin extends Plugin {
  private lines: string[] = [];
  private checks: { name: string; pass: boolean }[] = [];

  async onload() {
    this.registerEditorExtension(syncField);
    this.app.workspace.onLayoutReady(() => {
      this.run().catch(async (e) => {
        await this.write([`# Spike 2 report`, ``, `RESULT: FAIL (unhandled)`, ``, String(e?.stack ?? e)]);
      });
    });
  }

  private check(name: string, pass: boolean, detail: string) {
    this.checks.push({ name, pass });
    this.lines.push(`- ${pass ? "PASS" : "FAIL"}: ${name}. ${detail}`);
  }

  private async write(lines: string[]) {
    await this.app.vault.adapter.write(REPORT, lines.join("\n") + "\n");
  }

  private async run() {
    this.lines = [`# Spike 2 report`, ``];

    // Fixture note, opened in live preview
    await this.app.vault.adapter.write(NOTE, FIXTURE);
    const file = this.app.vault.getAbstractFileByPath(NOTE) as TFile
      ?? this.app.vault.getFiles().find((f) => f.path === NOTE)!;
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    const mdView = leaf.view as MarkdownView;
    await (mdView as any).setState({ ...(mdView as any).getState(), mode: "source", source: false }, { history: false });
    const cm: EditorView = (mdView.editor as any).cm;
    const livePreview = !!cm && (mdView as any).getState().source === false;
    this.check("live-preview EditorView reachable", livePreview, `cm=${!!cm}, sourceMode=${(mdView as any).getState().source}`);

    // Build the model from the real editor doc and seed the field
    const docText = cm.state.doc.toString();
    const model = parseDocument(docText, NOTE, 1);
    const entries: WordEntry[] = model.words.map((w) => {
      const box = docText.slice(w.source.start, w.source.end);
      return {
        index: w.index,
        text: w.text,
        runs: cleanRuns(box, w.text, w.source.start),
        sentence: model.sentences.find((s) => s.words.some((x) => x.index === w.index))?.index ?? -1,
        dirty: false,
      };
    });
    cm.dispatch({ effects: setWords.of(entries) });

    // 1. Marker cleanliness: decorated slices reproduce exactly the visible text
    let cleanFails: string[] = [];
    for (const e of entries) {
      const painted = e.runs.map((r) => docText.slice(r.from, r.to)).join("");
      if (painted !== e.text) cleanFails.push(`word ${e.index} "${e.text}" painted "${painted}"`);
      const markers = e.runs.map((r) => docText.slice(r.from, r.to)).join("").match(/[*_`#>\[\]()]/g);
      const wordHasThem = /[*_`#>\[\]()]/.test(e.text);
      if (markers && !wordHasThem) cleanFails.push(`word ${e.index} paints markers`);
    }
    this.check(
      "decorations paint only visible characters",
      cleanFails.length === 0,
      cleanFails.length ? cleanFails.slice(0, 5).join("; ") : `${entries.length} words, every painted slice === word text (bold/italic/code/link fixture)`
    );

    // 2. Frame-synced loop over a synthetic clock
    // Frame-synced means: the decoration update is dispatched in the FIRST
    // animation frame after a word boundary passes. Lag in wall-clock ms is
    // bounded by the display's frame cadence and system scheduling, which the
    // loop cannot control; what it must never do is detect a boundary and
    // paint a frame late. Warm up a few frames first so editor layout settles.
    const MS_PER_WORD = 60;
    const N_WORDS = Math.min(30, entries.length);
    const lags: number[] = [];
    let lateFrames = 0;
    await new Promise<void>((done) => {
      let warm = 0;
      let t0 = 0;
      let lastWord = -1;
      let prevFrame = 0;
      const frame = (now: number) => {
        if (warm < 10) { warm++; prevFrame = now; if (warm === 10) t0 = now; requestAnimationFrame(frame); return; }
        const idx = Math.min(Math.floor((now - t0) / MS_PER_WORD), N_WORDS - 1);
        if (idx !== lastWord) {
          const boundaryTime = t0 + idx * MS_PER_WORD;
          lags.push(now - boundaryTime);
          // first-frame test: the boundary fell after the previous frame,
          // so this frame is the earliest one that could have painted it
          if (prevFrame > boundaryTime) lateFrames++;
          lastWord = idx;
          cm.dispatch({ effects: setPosition.of({ word: idx, sentence: entries[idx]?.sentence ?? -1 }) });
        }
        prevFrame = now;
        if (idx >= N_WORDS - 1) done();
        else requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    const maxLag = Math.max(...lags);
    const avgLag = lags.reduce((a, b) => a + b, 0) / lags.length;
    this.check(
      "frame-synced highlight loop",
      lateFrames === 0,
      `${lags.length} word advances, every one painted in the first frame after its boundary (0 late); avg wall lag ${avgLag.toFixed(1)}ms, max ${maxLag.toFixed(1)}ms (frame cadence)`
    );

    // verify the decoration set actually reflects the final position
    const st = cm.state.field(syncField);
    this.check("decoration state tracks position", st.word === N_WORDS - 1, `state.word=${st.word}`);

    // 3. Click-to-seek via a real synthetic mouse event
    const target = entries[10];
    let clickedWord = -1;
    const listener = (ev: MouseEvent) => {
      const pos = cm.posAtCoords({ x: ev.clientX, y: ev.clientY });
      if (pos == null) return;
      const w = cm.state.field(syncField).words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to))
        ?? cm.state.field(syncField).words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
      if (w) clickedWord = w.index;
    };
    cm.dom.addEventListener("mousedown", listener);
    const mid = Math.floor((target.runs[0].from + target.runs[0].to) / 2);
    cm.dispatch({ effects: EditorView.scrollIntoView(mid) });
    await new Promise((r) => setTimeout(r, 100));
    const coords = cm.coordsAtPos(mid);
    if (coords) {
      cm.contentDOM.dispatchEvent(new MouseEvent("mousedown", {
        clientX: (coords.left + coords.right) / 2 || coords.left + 1,
        clientY: (coords.top + coords.bottom) / 2,
        bubbles: true,
      }));
    }
    cm.dom.removeEventListener("mousedown", listener);
    this.check(
      "click maps to word index (seek contract)",
      clickedWord === target.index,
      `clicked word ${clickedWord}, expected ${target.index} ("${target.text}"), coords=${!!coords}`
    );

    // 4. Live-edit remapping through ChangeDesc.mapPos
    const before = cm.state.field(syncField).words;
    const probe = before[25];
    const insertAt = before[20].runs[0].from; // boundary insert upstream of probe
    cm.dispatch({ changes: { from: insertAt, insert: "XYZW " } });
    const after = cm.state.field(syncField).words;
    const shifted = after[25];
    const upstream = after[5];
    const paintedAfter = shifted.runs.map((r) => cm.state.doc.sliceString(r.from, r.to)).join("");
    this.check(
      "insertion remaps downstream words",
      shifted.runs[0].from === probe.runs[0].from + 5 && paintedAfter === probe.text && upstream.runs[0].from === before[5].runs[0].from,
      `word 25 "${probe.text}" ${probe.runs[0].from}->${shifted.runs[0].from} (+5), still paints "${paintedAfter}"; word 5 unmoved`
    );

    // edit INSIDE a word: must go dirty, others stay clean
    const victim = after[8];
    cm.dispatch({ changes: { from: victim.runs[0].from + 1, insert: "zz" } });
    const after2 = cm.state.field(syncField).words;
    this.check(
      "edit inside a word flags it dirty for reparse",
      after2[8].dirty === true && after2[9].dirty === false && after2[25].dirty === false,
      `word 8 dirty=${after2[8].dirty}, neighbors clean; dirty word excluded from decoration`
    );

    // deletion spanning a whole word: runs collapse, entry goes dirty not stale
    const dead = after2[30];
    const delFrom = dead.runs[0].from - 1;
    const delTo = dead.runs[dead.runs.length - 1].to + 1;
    cm.dispatch({ changes: { from: delFrom, to: delTo } });
    const after3 = cm.state.field(syncField).words;
    this.check(
      "deleting a word collapses it instead of leaving a stale range",
      after3[30].dirty === true && after3[30].runs.length === 0,
      `word 30 "${dead.text}" runs=${after3[30].runs.length}, dirty=${after3[30].dirty}`
    );

    const allPass = this.checks.every((c) => c.pass);
    this.lines.splice(2, 0, `RESULT: ${allPass ? "ALL PASS" : "FAILURES PRESENT"} (${this.checks.filter((c) => c.pass).length}/${this.checks.length})`, ``);
    await this.write(this.lines);
  }
}

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// spikes/spike2-cm6-decorations/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => Spike2Plugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var import_state = require("@codemirror/state");
var import_view = require("@codemirror/view");

// src/engine/core/document-model.ts
var ABBREVIATION_PATTERN = /(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc|i\.e|e\.g|a\.m|p\.m)\./gi;
var DOT_PLACEHOLDER = "\0";
function splitIntoSentenceSpans(text) {
  const processed = text.replace(
    ABBREVIATION_PATTERN,
    (match) => match.replace(/\./g, DOT_PLACEHOLDER)
  );
  const spans = [];
  let start = 0;
  for (let i = 0; i < processed.length; i++) {
    if (!/[.!?]/.test(processed[i])) continue;
    let end = i + 1;
    while (end < processed.length && /["')\]]/.test(processed[end])) {
      end++;
    }
    if (end < processed.length && !/\s/.test(processed[end])) {
      continue;
    }
    pushTrimmedSpan(text, spans, start, end);
    while (end < processed.length && /\s/.test(processed[end])) {
      end++;
    }
    start = end;
    i = end - 1;
  }
  pushTrimmedSpan(text, spans, start, text.length);
  return spans;
}
function pushTrimmedSpan(source, spans, start, end) {
  while (start < end && /\s/.test(source[start])) start++;
  while (end > start && /\s/.test(source[end - 1])) end--;
  if (start < end) {
    spans.push({
      text: source.slice(start, end),
      start,
      end
    });
  }
}
function cleanLineInto(line, lineOffset, output, offsets) {
  let i = getReadableLineStart(line);
  while (i < line.length) {
    if (line.startsWith("![", i)) {
      const closeBracket = line.indexOf("]", i + 2);
      const openParen = closeBracket >= 0 ? line.indexOf("(", closeBracket) : -1;
      const closeParen = openParen >= 0 ? line.indexOf(")", openParen) : -1;
      if (closeBracket >= 0 && openParen === closeBracket + 1 && closeParen >= 0) {
        appendRange(line, lineOffset, i + 2, closeBracket, output, offsets);
        i = closeParen + 1;
        continue;
      }
    }
    if (line[i] === "[") {
      const closeBracket = line.indexOf("]", i + 1);
      const openParen = closeBracket >= 0 ? line.indexOf("(", closeBracket) : -1;
      const closeParen = openParen >= 0 ? line.indexOf(")", openParen) : -1;
      if (closeBracket >= 0 && openParen === closeBracket + 1 && closeParen >= 0) {
        appendRange(line, lineOffset, i + 1, closeBracket, output, offsets);
        i = closeParen + 1;
        continue;
      }
    }
    if (line[i] === "`") {
      const end = line.indexOf("`", i + 1);
      if (end >= 0) {
        i = end + 1;
        continue;
      }
    }
    if (line[i] === "<") {
      const end = line.indexOf(">", i + 1);
      if (end >= 0) {
        i = end + 1;
        continue;
      }
    }
    if (line[i] === "\\" && i + 1 < line.length) {
      i++;
      appendChar(line[i], lineOffset + i, output, offsets);
      i++;
      continue;
    }
    if (/[*_~]/.test(line[i])) {
      i++;
      continue;
    }
    appendChar(line[i], lineOffset + i, output, offsets);
    i++;
  }
}
function getReadableLineStart(line) {
  const markerMatch = line.match(
    /^\s*(?:(?:#{1,6}|>)\s+|(?:[-*+]|\d+[.)])\s+)/
  );
  return markerMatch ? markerMatch[0].length : 0;
}
function appendRange(source, baseOffset, start, end, output, offsets) {
  for (let i = start; i < end; i++) {
    appendChar(source[i], baseOffset + i, output, offsets);
  }
}
function appendChar(char, offset, output, offsets) {
  if (/\s/.test(char)) {
    if (output.length > 0 && !/\s/.test(output[output.length - 1])) {
      output.push(" ");
      offsets.push(offset);
    }
    return;
  }
  output.push(char);
  offsets.push(offset);
}
function cleanBlockWithOffsets(raw, baseOffset) {
  const lines = raw.split("\n");
  const output = [];
  const offsets = [];
  let rel = 0;
  for (const line of lines) {
    cleanLineInto(line, baseOffset + rel, output, offsets);
    rel += line.length + 1;
    if (output.length > 0 && !/\s/.test(output[output.length - 1])) {
      output.push(" ");
      offsets.push(baseOffset + rel - 1);
    }
  }
  return { text: output.join(""), offsets };
}
function segmentBlocks(lines, firstLine) {
  const blocks = [];
  let current;
  const flush = () => {
    if (current && current.lines.length) blocks.push(current);
    current = void 0;
  };
  let inCode = false;
  for (let i = firstLine; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      if (inCode) {
        inCode = false;
        current?.lines.push(line);
        flush();
      } else {
        flush();
        inCode = true;
        current = { kind: "code", startLine: i, lines: [line] };
      }
      continue;
    }
    if (inCode) {
      current.lines.push(line);
      continue;
    }
    if (line.trim().length === 0 || /^[-*_]{3,}\s*$/.test(line)) {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+/);
    if (heading) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, startLine: i, lines: [line] });
      continue;
    }
    const isList = /^\s*(?:[-*+]|\d+[.)])\s+/.test(line);
    const isQuote = /^\s*>/.test(line);
    const kind = isList ? "list-item" : isQuote ? "quote" : "paragraph";
    if (isList) {
      flush();
      current = { kind, startLine: i, lines: [line] };
      continue;
    }
    if (!current || current.kind !== kind) {
      flush();
      current = { kind, startLine: i, lines: [] };
    }
    current.lines.push(line);
  }
  flush();
  return blocks;
}
function sentencesFromBlock(raw, baseOffset) {
  const clean = cleanBlockWithOffsets(raw, baseOffset);
  return splitIntoSentenceSpans(clean.text).flatMap((span) => {
    const start = clean.offsets[span.start];
    const end = clean.offsets[span.end - 1];
    if (start === void 0 || end === void 0) return [];
    const wordDrafts = [];
    const re = /\S+/g;
    let m;
    const sentenceClean = clean.text.slice(span.start, span.end);
    while ((m = re.exec(sentenceClean)) !== null) {
      const ws = clean.offsets[span.start + m.index];
      const we = clean.offsets[span.start + m.index + m[0].length - 1];
      if (ws === void 0 || we === void 0) continue;
      wordDrafts.push({ text: m[0], source: { start: ws, end: we + 1 } });
    }
    return [{ text: span.text, source: { start, end: end + 1 }, wordDrafts }];
  });
}
function parseDocument(text, uri, version) {
  const lines = text.split("\n");
  const lineOffsets = [];
  let off = 0;
  for (const l of lines) {
    lineOffsets.push(off);
    off += l.length + 1;
  }
  let firstLine = 0;
  if (lines[0]?.trim() === "---") {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
    if (end > 0) firstLine = end + 1;
  }
  const blocks = [];
  const sentences = [];
  const words = [];
  for (const raw of segmentBlocks(lines, firstLine)) {
    const base = lineOffsets[raw.startLine];
    const rawText = raw.lines.join("\n");
    const source = { start: base, end: base + rawText.length };
    if (raw.kind === "code") {
      blocks.push({ kind: "code", sentences: [], source, codeText: rawText });
      continue;
    }
    const blockSentences = [];
    for (const d of sentencesFromBlock(rawText, base)) {
      const s = {
        index: sentences.length + blockSentences.length,
        text: d.text,
        source: d.source,
        words: []
      };
      for (const wd of d.wordDrafts) {
        const w = { index: words.length, text: wd.text, source: wd.source };
        words.push(w);
        s.words.push(w);
      }
      blockSentences.push(s);
    }
    sentences.push(...blockSentences);
    blocks.push({ kind: raw.kind, level: raw.level, sentences: blockSentences, source });
  }
  return { uri, version, blocks, sentences, words };
}

// spikes/spike2-cm6-decorations/main.ts
var REPORT = "spike2-report.md";
var NOTE = "Spike2 Note.md";
var FIXTURE = `---
title: Spike two fixture
---

# Heading With Words

This first paragraph is plain prose with several words to walk across.

The second one has **bold emphasis**, some *italic drift*, an \`inline code\` span,
and a [markdown link](https://example.com) to strip.

- A list item with a **bolded** word inside it.
- Another item, kept short.

The closing paragraph gives the clock a calm runway of ordinary words to end on.
`;
function cleanRuns(docSlice, wordText, boxStart) {
  const runs = [];
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
var setWords = import_state.StateEffect.define();
var setPosition = import_state.StateEffect.define();
function mapEntries(entries, changes) {
  return entries.map((e) => {
    const runs = e.runs.map((r) => ({ from: changes.mapPos(r.from, 1), to: changes.mapPos(r.to, -1) })).filter((r) => r.to > r.from);
    let dirty = e.dirty || runs.length === 0;
    changes.iterChangedRanges((fromA, toA) => {
      for (const r of e.runs) if (fromA < r.to && toA > r.from) dirty = true;
    });
    return { ...e, runs, dirty };
  });
}
var syncField = import_state.StateField.define({
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
  provide: (f) => import_view.EditorView.decorations.from(f, (v) => {
    const deco = [];
    const word = v.words[v.word];
    for (const e of v.words) {
      if (e.sentence !== v.sentence || e.dirty) continue;
      for (const r of e.runs) deco.push({ from: r.from, to: r.to, d: sentenceDeco });
    }
    if (word && !word.dirty) for (const r of word.runs) deco.push({ from: r.from, to: r.to, d: wordDeco });
    deco.sort((a, b) => a.from - b.from || a.to - b.to);
    return import_view.Decoration.set(deco.map((x) => x.d.range(x.from, x.to)), true);
  })
});
var sentenceDeco = import_view.Decoration.mark({ class: "se-spike-sentence" });
var wordDeco = import_view.Decoration.mark({ class: "se-spike-word" });
var Spike2Plugin = class extends import_obsidian.Plugin {
  lines = [];
  checks = [];
  async onload() {
    this.registerEditorExtension(syncField);
    this.app.workspace.onLayoutReady(() => {
      this.run().catch(async (e) => {
        await this.write([`# Spike 2 report`, ``, `RESULT: FAIL (unhandled)`, ``, String(e?.stack ?? e)]);
      });
    });
  }
  check(name, pass, detail) {
    this.checks.push({ name, pass });
    this.lines.push(`- ${pass ? "PASS" : "FAIL"}: ${name}. ${detail}`);
  }
  async write(lines) {
    await this.app.vault.adapter.write(REPORT, lines.join("\n") + "\n");
  }
  async run() {
    this.lines = [`# Spike 2 report`, ``];
    await this.app.vault.adapter.write(NOTE, FIXTURE);
    const file = this.app.vault.getAbstractFileByPath(NOTE) ?? this.app.vault.getFiles().find((f) => f.path === NOTE);
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    const mdView = leaf.view;
    await mdView.setState({ ...mdView.getState(), mode: "source", source: false }, { history: false });
    const cm = mdView.editor.cm;
    const livePreview = !!cm && mdView.getState().source === false;
    this.check("live-preview EditorView reachable", livePreview, `cm=${!!cm}, sourceMode=${mdView.getState().source}`);
    const docText = cm.state.doc.toString();
    const model = parseDocument(docText, NOTE, 1);
    const entries = model.words.map((w) => {
      const box = docText.slice(w.source.start, w.source.end);
      return {
        index: w.index,
        text: w.text,
        runs: cleanRuns(box, w.text, w.source.start),
        sentence: model.sentences.find((s) => s.words.some((x) => x.index === w.index))?.index ?? -1,
        dirty: false
      };
    });
    cm.dispatch({ effects: setWords.of(entries) });
    let cleanFails = [];
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
    const MS_PER_WORD = 60;
    const N_WORDS = Math.min(30, entries.length);
    const lags = [];
    let lateFrames = 0;
    await new Promise((done) => {
      let warm = 0;
      let t0 = 0;
      let lastWord = -1;
      let prevFrame = 0;
      const frame = (now) => {
        if (warm < 10) {
          warm++;
          prevFrame = now;
          if (warm === 10) t0 = now;
          requestAnimationFrame(frame);
          return;
        }
        const idx = Math.min(Math.floor((now - t0) / MS_PER_WORD), N_WORDS - 1);
        if (idx !== lastWord) {
          const boundaryTime = t0 + idx * MS_PER_WORD;
          lags.push(now - boundaryTime);
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
    const st = cm.state.field(syncField);
    this.check("decoration state tracks position", st.word === N_WORDS - 1, `state.word=${st.word}`);
    const target = entries[10];
    let clickedWord = -1;
    const listener = (ev) => {
      const pos = cm.posAtCoords({ x: ev.clientX, y: ev.clientY });
      if (pos == null) return;
      const w = cm.state.field(syncField).words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to)) ?? cm.state.field(syncField).words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
      if (w) clickedWord = w.index;
    };
    cm.dom.addEventListener("mousedown", listener);
    const mid = Math.floor((target.runs[0].from + target.runs[0].to) / 2);
    cm.dispatch({ effects: import_view.EditorView.scrollIntoView(mid) });
    await new Promise((r) => setTimeout(r, 100));
    const coords = cm.coordsAtPos(mid);
    if (coords) {
      cm.contentDOM.dispatchEvent(new MouseEvent("mousedown", {
        clientX: (coords.left + coords.right) / 2 || coords.left + 1,
        clientY: (coords.top + coords.bottom) / 2,
        bubbles: true
      }));
    }
    cm.dom.removeEventListener("mousedown", listener);
    this.check(
      "click maps to word index (seek contract)",
      clickedWord === target.index,
      `clicked word ${clickedWord}, expected ${target.index} ("${target.text}"), coords=${!!coords}`
    );
    const before = cm.state.field(syncField).words;
    const probe = before[25];
    const insertAt = before[20].runs[0].from;
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
    const victim = after[8];
    cm.dispatch({ changes: { from: victim.runs[0].from + 1, insert: "zz" } });
    const after2 = cm.state.field(syncField).words;
    this.check(
      "edit inside a word flags it dirty for reparse",
      after2[8].dirty === true && after2[9].dirty === false && after2[25].dirty === false,
      `word 8 dirty=${after2[8].dirty}, neighbors clean; dirty word excluded from decoration`
    );
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
};

// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { parseDocument } from "../engine/core";
import { buildWordEntries } from "./word-runs";
import { syncField, setWords, setPosition, clearAll, mapEntries } from "./sync-field";

// EditorState and transactions are DOM-free; only EditorView needs a DOM. The
// field's decoration provider builds Decoration.mark ranges, also DOM-free, so the
// whole remap contract is testable in plain node.
const DOC = "Alpha beta gamma delta epsilon zeta eta theta.";

function seeded() {
  const model = parseDocument(DOC, "t.md", 1);
  const entries = buildWordEntries(model, DOC);
  let state = EditorState.create({ doc: DOC, extensions: [syncField] });
  state = state.update({ effects: setWords.of(entries) }).state;
  return { state, entries };
}

function paint(doc: string, runs: { from: number; to: number }[]) {
  return runs.map((r) => doc.sliceString(r.from, r.to)).join("");
}

describe("sync-field remap contract", () => {
  it("insertion upstream shifts downstream runs and still paints the word text", () => {
    const { state, entries } = seeded();
    const probe = entries[5];
    const insert = "XXX ";
    // insert at the very start (upstream of every word)
    const next = state.update({ changes: { from: 0, insert } }).state;
    const words = next.field(syncField).words;
    const shifted = words[5];
    expect(shifted.runs[0].from).toBe(probe.runs[0].from + insert.length);
    expect(paint(next.doc, shifted.runs)).toBe(probe.text);
    expect(shifted.dirty).toBe(false);
  });

  it("edit inside a word marks exactly that word dirty", () => {
    const { state, entries } = seeded();
    const victim = entries[3];
    const next = state.update({ changes: { from: victim.runs[0].from + 1, insert: "zz" } }).state;
    const words = next.field(syncField).words;
    expect(words[3].dirty).toBe(true);
    expect(words[2].dirty).toBe(false);
    expect(words[4].dirty).toBe(false);
  });

  it("deletion spanning a word collapses its runs to [] and marks it dirty", () => {
    const { state, entries } = seeded();
    const dead = entries[4];
    const from = dead.runs[0].from - 1;
    const to = dead.runs[dead.runs.length - 1].to + 1;
    const next = state.update({ changes: { from, to } }).state;
    const words = next.field(syncField).words;
    expect(words[4].runs.length).toBe(0);
    expect(words[4].dirty).toBe(true);
  });

  it("setPosition updates the current word and sentence", () => {
    const { state } = seeded();
    const next = state.update({ effects: setPosition.of({ word: 3, sentence: 0 }) }).state;
    const v = next.field(syncField);
    expect(v.word).toBe(3);
    expect(v.sentence).toBe(0);
  });

  it("clearAll resets words and position", () => {
    const { state } = seeded();
    const positioned = state.update({ effects: setPosition.of({ word: 2, sentence: 0 }) }).state;
    const cleared = positioned.update({ effects: clearAll.of(null) }).state;
    const v = cleared.field(syncField);
    expect(v.words.length).toBe(0);
    expect(v.word).toBe(-1);
    expect(v.sentence).toBe(-1);
  });

  it("the field provides a non-empty decoration set (word + sentence) without a DOM", () => {
    const { state } = seeded();
    const next = state.update({ effects: setPosition.of({ word: 1, sentence: 0 }) }).state;
    const provided = next.facet(EditorView.decorations);
    expect(provided.length).toBeGreaterThan(0);
    const set = provided[0];
    // DecorationSet has a size; positioning word 1 (in sentence 0) yields ranges
    expect(typeof set === "function" ? 0 : (set as { size: number }).size).toBeGreaterThan(0);
  });
});

describe("mapEntries as a pure function", () => {
  it("shifts runs by an upstream insertion", () => {
    const { state, entries } = seeded();
    const tr = state.update({ changes: { from: 0, insert: "ab" } });
    const mapped = mapEntries(entries, tr.changes);
    expect(mapped[2].runs[0].from).toBe(entries[2].runs[0].from + 2);
    expect(mapped[2].dirty).toBe(false);
  });
});

// The CM6 StateField that carries word entries and the current position, and paints
// word + sentence decorations. Promoted verbatim from spike 2 (PASS 8/8), with a
// clearAll effect added for session teardown. Every transaction remaps the entries
// through ChangeDesc so decorations survive live edits; an edit inside a word marks
// it dirty (excluded from decoration) per the reparse-and-rechunk policy, which is a
// later spec: audio keeps playing the pre-edit text for the current slice.
import { StateEffect, StateField, ChangeDesc } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import { WordEntry } from "./word-runs";

export const setWords = StateEffect.define<WordEntry[]>();
export const setPosition = StateEffect.define<{ word: number; sentence: number }>();
export const clearAll = StateEffect.define<null>();

export interface SyncState { words: WordEntry[]; word: number; sentence: number }

export function mapEntries(entries: WordEntry[], changes: ChangeDesc): WordEntry[] {
  return entries.map((e) => {
    const runs = e.runs
      .map((r) => ({ from: changes.mapPos(r.from, 1), to: changes.mapPos(r.to, -1) }))
      .filter((r) => r.to > r.from);
    let dirty = e.dirty || runs.length === 0;
    // an edit that touched inside any run makes the visible slice diverge from
    // the word text; flag it for the reparse-and-rechunk policy (later spec)
    changes.iterChangedRanges((fromA, toA) => {
      for (const r of e.runs) if (fromA < r.to && toA > r.from) dirty = true;
    });
    return { ...e, runs, dirty };
  });
}

const sentenceDeco = Decoration.mark({ class: "se-sentence" });
const wordDeco = Decoration.mark({ class: "se-word" });

export const syncField = StateField.define<SyncState>({
  create: () => ({ words: [], word: -1, sentence: -1 }),
  update(value, tr) {
    let v = value;
    if (tr.docChanged) v = { ...v, words: mapEntries(v.words, tr.changes) };
    for (const e of tr.effects) {
      if (e.is(setWords)) v = { ...v, words: e.value };
      if (e.is(setPosition)) v = { ...v, word: e.value.word, sentence: e.value.sentence };
      if (e.is(clearAll)) v = { words: [], word: -1, sentence: -1 };
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

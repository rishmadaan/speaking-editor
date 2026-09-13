// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Pure word-run computation, promoted verbatim from spike 2 (PASS 8/8). A word's
// source offsets are a BOUNDING BOX (first to last clean character in the source),
// so the box may contain markdown markers between the visible characters. cleanRuns
// walks the box and returns only the sub-ranges that cover the word's visible text,
// so decorations never paint syntax markers.
import { DocumentModel } from "../engine/core";

export interface Run { from: number; to: number }

export interface WordEntry {
  index: number;
  text: string;
  runs: Run[];
  sentence: number;
  dirty: boolean;
}

/**
 * Greedily match a word's clean text inside its source bounding box, skipping
 * markdown marker characters. Returns document-offset sub-ranges covering exactly
 * the visible characters. Returns [] when the word text cannot be matched (the
 * box does not contain the whole word, e.g. after a spanning deletion).
 */
export function cleanRuns(docSlice: string, wordText: string, boxStart: number): Run[] {
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

/**
 * Map a parsed document model to the word entries the sync field decorates: index,
 * visible text, clean runs over the source, owning sentence, and a dirty flag
 * (false at build time; set later by edits inside a word).
 */
export function buildWordEntries(model: DocumentModel, docText: string): WordEntry[] {
  const wordToSentence = new Map<number, number>();
  for (const s of model.sentences) for (const w of s.words) wordToSentence.set(w.index, s.index);
  return model.words.map((w) => {
    const box = docText.slice(w.source.start, w.source.end);
    return {
      index: w.index,
      text: w.text,
      runs: cleanRuns(box, w.text, w.source.start),
      sentence: wordToSentence.get(w.index) ?? -1,
      dirty: false,
    };
  });
}

// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Fast-start splitter (spec 0012 Part 2 point 1). Time-to-first-audio on a cold
// big note is dominated by synthesizing the whole first chunk before a single
// word can play. This splits an oversized chunk 0 at the first sentence boundary
// at or after `minChars` into a small 0a (synthesizes in a fraction of the time)
// and a 0b remainder, renumbering the tail. A pure wrapper over buildChunks
// output: it never touches the vendored chunker and preserves every chunk
// invariant (word refs, offsets, text identity, sentence partition).
import { Chunk, ChunkWordRef } from "../engine/core/chunker";
import { DocumentModel } from "../engine/core";

export function splitFirstChunk(
  chunks: Chunk[],
  model: DocumentModel,
  minChars = 300,
  threshold = 600
): Chunk[] {
  if (chunks.length === 0) return chunks;
  const first = chunks[0];
  // Small enough already: leave it alone (the disk cache identity is unchanged).
  if (first.text.length <= threshold) return chunks;
  const sents = first.sentenceIndexes;
  // A single sentence cannot be split without cutting mid-sentence, which the
  // vendored provider's timing alignment forbids.
  if (sents.length < 2) return chunks;

  // Cumulative end offset of each sentence within the chunk text. buildChunks
  // joins sentences with a single space, so sentence k starts one char after the
  // previous sentence's end.
  const ends: number[] = [];
  let pos = 0;
  for (let k = 0; k < sents.length; k++) {
    if (k > 0) pos += 1; // the joining space before sentence k
    pos += model.sentences[sents[k]].text.length;
    ends.push(pos);
  }

  // Split AFTER the first sentence whose end reaches minChars, provided a tail
  // sentence remains to become 0b. If the only boundary at or after minChars is
  // the very end, there is nothing to split into: no-op.
  let splitAfter = -1;
  for (let k = 0; k < sents.length - 1; k++) {
    if (ends[k] >= minChars) {
      splitAfter = k;
      break;
    }
  }
  if (splitAfter < 0) return chunks;

  const cutEnd = ends[splitAfter]; // end offset of 0a's last sentence
  const secondStart = cutEnd + 1; // 0b begins after the joining space

  const firstWords: ChunkWordRef[] = [];
  const secondWords: ChunkWordRef[] = [];
  for (const w of first.words) {
    if (w.charStart < secondStart) {
      firstWords.push(w);
    } else {
      // Rebase 0b's word offsets onto its own text (which starts at secondStart).
      secondWords.push({
        wordIndex: w.wordIndex,
        charStart: w.charStart - secondStart,
        charEnd: w.charEnd - secondStart,
      });
    }
  }

  const chunk0a: Chunk = {
    index: 0,
    text: first.text.slice(0, cutEnd),
    sentenceIndexes: sents.slice(0, splitAfter + 1),
    words: firstWords,
  };
  const chunk0b: Chunk = {
    index: 1,
    text: first.text.slice(secondStart),
    sentenceIndexes: sents.slice(splitAfter + 1),
    words: secondWords,
  };
  // Renumber the untouched tail so indexes stay contiguous.
  const rest = chunks.slice(1).map((c) => ({ ...c, index: c.index + 1 }));
  return [chunk0a, chunk0b, ...rest];
}

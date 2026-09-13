// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { splitFirstChunk } from "./chunk-split";
import { buildChunks, parseDocument } from "../engine/core";

// A paragraph of many short sentences so buildChunks yields a single big first
// chunk (one block, under maxChars), which the splitter then divides.
const sentence = (n: number) => `Sentence number ${n} fills the runway with words.`;
const bigDoc = parseDocument(
  Array.from({ length: 40 }, (_, i) => sentence(i + 1)).join(" "),
  "big.md",
  1
);

describe("splitFirstChunk", () => {
  it("splits a long first chunk at the first sentence boundary at or after minChars", () => {
    const chunks = buildChunks(bigDoc);
    expect(chunks.length).toBe(1);
    const original = chunks[0];
    expect(original.text.length).toBeGreaterThan(600);

    const split = splitFirstChunk(chunks, bigDoc, 300, 600);
    expect(split.length).toBe(2);
    const [a, b] = split;
    // piece 0a reaches at least minChars (the first boundary >= 300) and is
    // strictly smaller than the original (a genuine split happened)
    expect(a.text.length).toBeGreaterThanOrEqual(300);
    expect(a.text.length).toBeLessThan(original.text.length);
    // 0a ends exactly on a sentence boundary (its last sentence's text)
    const lastSentIn0a = a.sentenceIndexes[a.sentenceIndexes.length - 1];
    expect(a.text.endsWith(bigDoc.sentences[lastSentIn0a].text)).toBe(true);
  });

  it("renumbers chunk indexes sequentially", () => {
    // three chunks so there is a tail to renumber
    const chunks = buildChunks(bigDoc, 800, 400);
    expect(chunks.length).toBeGreaterThan(1);
    const split = splitFirstChunk(chunks, bigDoc, 300, 600);
    split.forEach((c, i) => expect(c.index).toBe(i));
    // the split added exactly one chunk
    expect(split.length).toBe(chunks.length + 1);
  });

  it("preserves every word ref across the split, in order", () => {
    const chunks = buildChunks(bigDoc);
    const original = chunks[0];
    const [a, b] = splitFirstChunk(chunks, bigDoc, 300, 600);
    const rejoined = [...a.words, ...b.words].map((w) => w.wordIndex);
    expect(rejoined).toEqual(original.words.map((w) => w.wordIndex));
  });

  it("keeps word offsets valid: each ref slices its own chunk text back to the word", () => {
    const chunks = buildChunks(bigDoc);
    const split = splitFirstChunk(chunks, bigDoc, 300, 600);
    for (const c of split) {
      for (const ref of c.words) {
        expect(c.text.slice(ref.charStart, ref.charEnd)).toBe(bigDoc.words[ref.wordIndex].text);
      }
    }
  });

  it("text concatenation is identical (rejoined with the single joiner space)", () => {
    const chunks = buildChunks(bigDoc);
    const original = chunks[0].text;
    const [a, b] = splitFirstChunk(chunks, bigDoc, 300, 600);
    expect(a.text + " " + b.text).toBe(original);
  });

  it("partitions the sentence indexes cleanly", () => {
    const chunks = buildChunks(bigDoc);
    const original = chunks[0].sentenceIndexes;
    const [a, b] = splitFirstChunk(chunks, bigDoc, 300, 600);
    expect([...a.sentenceIndexes, ...b.sentenceIndexes]).toEqual(original);
    // no overlap
    expect(new Set([...a.sentenceIndexes, ...b.sentenceIndexes]).size).toBe(original.length);
  });

  it("is a no-op when the first chunk is at or below the threshold", () => {
    const smallDoc = parseDocument([sentence(1), sentence(2)].join(" "), "small.md", 1);
    const chunks = buildChunks(smallDoc);
    expect(chunks[0].text.length).toBeLessThanOrEqual(600);
    const split = splitFirstChunk(chunks, smallDoc, 300, 600);
    expect(split).toBe(chunks); // unchanged, same array reference
  });

  it("is a no-op when the first chunk is a single (long) sentence", () => {
    const longSentence = "word ".repeat(200).trim() + "."; // ~1000 chars, no internal boundary
    const doc = parseDocument(longSentence, "one.md", 1);
    const chunks = buildChunks(doc);
    expect(chunks[0].text.length).toBeGreaterThan(600);
    expect(chunks[0].sentenceIndexes.length).toBe(1);
    const split = splitFirstChunk(chunks, doc, 300, 600);
    expect(split).toBe(chunks); // cannot split a single sentence
  });

  it("is a no-op when the only boundary at or after minChars is the final one", () => {
    // A short lead sentence (< 300) then one very long sentence: the first boundary
    // at or after 300 is the end of the chunk, so there is no tail to split into.
    const doc = parseDocument("Short lead here. " + "word ".repeat(200).trim() + ".", "lead.md", 1);
    const chunks = buildChunks(doc);
    expect(chunks[0].text.length).toBeGreaterThan(600);
    // lead sentence ends well before 300 chars
    expect(doc.sentences[0].text.length).toBeLessThan(300);
    const split = splitFirstChunk(chunks, doc, 300, 600);
    expect(split).toBe(chunks);
  });
});

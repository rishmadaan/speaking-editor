// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { parseDocument } from "../engine/core";
import { cleanRuns, buildWordEntries, WordEntry } from "./word-runs";

// Build entries from a markdown string and pair each with its painted slice
// (the visible characters the decorations would actually cover).
function painted(md: string): { e: WordEntry; slice: string }[] {
  const model = parseDocument(md, "t.md", 1);
  return buildWordEntries(model, md).map((e) => ({
    e,
    slice: e.runs.map((r) => md.slice(r.from, r.to)).join(""),
  }));
}

// The load-bearing invariant: for EVERY word, the painted slices concatenated
// reproduce exactly the word's visible text, so decorations never paint syntax.
function expectCleanPaint(md: string) {
  const rows = painted(md);
  expect(rows.length).toBeGreaterThan(0);
  for (const { e, slice } of rows) {
    expect(slice).toBe(e.text);
    // no markdown marker leaks unless the word text itself contains them
    if (!/[*_`#>\[\]()]/.test(e.text)) {
      expect(slice).not.toMatch(/[*_`#>\[\]()]/);
    }
  }
}

describe("cleanRuns", () => {
  it("matches a plain word to one run", () => {
    expect(cleanRuns("word", "word", 0)).toEqual([{ from: 0, to: 4 }]);
  });

  it("skips markers around a word and paints only visible chars", () => {
    // "**word**." bounding box, word text keeps the trailing period
    const runs = cleanRuns("**word**.", "word.", 0);
    expect(runs.map((r) => "**word**.".slice(r.from, r.to)).join("")).toBe("word.");
    // none of the painted slices contain a marker
    expect(runs.map((r) => "**word**.".slice(r.from, r.to)).join("")).not.toMatch(/\*/);
  });

  it("returns [] when the word text cannot be matched inside the box", () => {
    expect(cleanRuns("abc", "xyz", 0)).toEqual([]);
    expect(cleanRuns("wor", "word", 0)).toEqual([]);
  });

  it("offsets runs by boxStart", () => {
    expect(cleanRuns("word", "word", 100)).toEqual([{ from: 100, to: 104 }]);
  });
});

describe("buildWordEntries clean-paint invariant", () => {
  it("plain prose", () => {
    expectCleanPaint("Alpha beta gamma delta epsilon words.");
  });

  it("bold", () => {
    expectCleanPaint("A line with **bold emphasis** inside it.");
  });

  it("italic", () => {
    expectCleanPaint("A line with *italic drift* inside it.");
  });

  it("inline code", () => {
    expectCleanPaint("A line with `inline code` inside it.");
  });

  it("markdown link", () => {
    expectCleanPaint("A [markdown link](https://example.com) to strip out.");
  });

  it("heading words after the hashes", () => {
    expectCleanPaint("# Heading With Several Words");
  });

  it("list item words after the dash", () => {
    expectCleanPaint("- A list item with words inside it.");
  });

  it("a marker-heavy mixed fixture, every word clean", () => {
    expectCleanPaint(
      "# Title Here\n\nThe **second** one has *italic drift*, an `inline code` span,\n" +
        "and a [markdown link](https://example.com) to strip.\n\n" +
        "- A list item with a **bolded** word inside it.\n"
    );
  });
});

describe("buildWordEntries shape", () => {
  it("indexes, sentence, and dirty are populated", () => {
    const model = parseDocument("First sentence here. Second sentence too.", "t.md", 1);
    const entries = buildWordEntries(model, "First sentence here. Second sentence too.");
    expect(entries.length).toBe(model.words.length);
    entries.forEach((e, i) => {
      expect(e.index).toBe(model.words[i].index);
      expect(e.text).toBe(model.words[i].text);
      expect(e.dirty).toBe(false);
      expect(e.sentence).toBeGreaterThanOrEqual(0);
      expect(e.runs.length).toBeGreaterThan(0);
    });
    // two sentences -> two distinct sentence ids present
    expect(new Set(entries.map((e) => e.sentence)).size).toBe(2);
  });
});

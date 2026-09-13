// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.
// Inherited TalkToMeBaby MIT grant: see VENDOR.md and THIRD_PARTY_NOTICES.md.

import { describe, it, expect } from "vitest";
import { parseDocument } from "./document-model";
import { cleanRuns, buildWordEntries } from "../../shell/word-runs";

// Spoken text = the sentence texts the parser produces, in order.
function spoken(src: string): string[] {
  return parseDocument(src, "t.md", 1).sentences.map((s) => s.text);
}

// Markers that must never survive into a painted slice (spec 0002 invariant 2).
const MARKERS = ["[[", "]]", "![", "==", "%%", "[!"];

// Well-formed fixtures swept by both invariants across EVERY word. The unclosed
// wikilink is intentionally left literal (its visible chars include "[["), so it
// is excluded from the no-marker sweep and checked on its own below.
const FIXTURES: { name: string; src: string }[] = [
  { name: "wikilink basic", src: "See [[Target]] now." },
  { name: "wikilink with alias", src: "See [[Target|alias]] now." },
  { name: "alias several words", src: "Read [[Note|the full guide]] today." },
  { name: "wikilink heading anchor", src: "Jump to [[Target#Heading]] here." },
  { name: "wikilink then period", src: "Done [[Target]]." },
  { name: "wikilink inside bold", src: "A **[[Concept]]** word." },
  { name: "adjacent wikilinks", src: "[[One]] [[Two]] here." },
  { name: "embed inline", src: "Look ![[image.png]] here." },
  { name: "markdown image", src: "See ![alt text](img.png) now." },
  { name: "callout with title", src: "> [!note] Remember this." },
  {
    name: "callout with body",
    src: ["> [!tip] Pro tip here.", "> Body line of the callout."].join("\n"),
  },
  { name: "callout fold plus", src: "> [!info]+ Folded title." },
  { name: "callout fold minus", src: "> [!warning]- Collapsed note." },
  { name: "inline tag", src: "Working on #project today." },
  { name: "nested tag", src: "Filed under #area/work here." },
  { name: "non-tag hash", src: "Issue #42 is still open." },
  { name: "highlight span", src: "This is ==really important== stuff." },
  { name: "comment mid-sentence", src: "Before %%hidden note%% after." },
  { name: "standard link still works", src: "Go to [the site](https://x.com) now." },
];

describe("obsidian dialect: offset ledger + no-marker invariants", () => {
  for (const { name, src } of FIXTURES) {
    it(`holds both invariants for: ${name}`, () => {
      const model = parseDocument(src, "t.md", 1);

      // buildWordEntries must agree with a direct cleanRuns call per word.
      const entries = buildWordEntries(model, src);
      expect(entries.length).toBe(model.words.length);

      for (const w of model.words) {
        const box = src.slice(w.source.start, w.source.end);
        const runs = cleanRuns(box, w.text, w.source.start);

        // Ledger invariant: non-empty runs whose painted slices rebuild the word.
        expect(runs.length, `runs for "${w.text}"`).toBeGreaterThan(0);
        const painted = runs.map((r) => src.slice(r.from, r.to));
        expect(painted.join(""), `painted "${w.text}"`).toBe(w.text);

        // No-marker invariant: no painted slice carries a dialect marker.
        for (const slice of painted) {
          for (const marker of MARKERS) {
            expect(
              slice.includes(marker),
              `slice "${slice}" contains ${marker}`
            ).toBe(false);
          }
        }
      }
    });
  }
});

describe("obsidian dialect: wikilinks", () => {
  it("speaks a plain wikilink target without brackets", () => {
    expect(spoken("See [[Target]] now.")).toEqual(["See Target now."]);
  });

  it("speaks only the alias, never the target", () => {
    expect(spoken("See [[Target|alias]] now.")).toEqual(["See alias now."]);
  });

  it("speaks a multi-word alias", () => {
    expect(spoken("Read [[Note|the full guide]] today.")).toEqual([
      "Read the full guide today.",
    ]);
  });

  it("keeps a heading anchor as written, minus brackets", () => {
    expect(spoken("Jump to [[Target#Heading]] here.")).toEqual([
      "Jump to Target#Heading here.",
    ]);
  });

  it("speaks a wikilink inside bold", () => {
    expect(spoken("A **[[Concept]]** word.")).toEqual(["A Concept word."]);
  });

  it("speaks adjacent wikilinks", () => {
    expect(spoken("[[One]] [[Two]] here.")).toEqual(["One Two here."]);
  });

  it("leaves an unclosed wikilink literal", () => {
    expect(spoken("Broken [[Target here.")).toEqual(["Broken [[Target here."]);
  });
});

describe("obsidian dialect: embeds and images", () => {
  it("skips an inline embed entirely", () => {
    expect(spoken("Look ![[image.png]] here.")).toEqual(["Look here."]);
  });

  it("produces no words for an embed-only line", () => {
    expect(parseDocument("![[note]]", "t.md", 1).words).toHaveLength(0);
  });

  it("skips a markdown image alt (spec 0002 point 2)", () => {
    expect(spoken("See ![alt text](img.png) now.")).toEqual(["See now."]);
  });
});

describe("obsidian dialect: callouts", () => {
  it("strips the callout marker and speaks the title", () => {
    expect(spoken("> [!note] Remember this.")).toEqual(["Remember this."]);
  });

  it("speaks title and body together", () => {
    const src = ["> [!tip] Pro tip here.", "> Body line of the callout."].join(
      "\n"
    );
    expect(spoken(src)).toEqual(["Pro tip here.", "Body line of the callout."]);
  });

  it("strips a fold marker", () => {
    expect(spoken("> [!info]+ Folded title.")).toEqual(["Folded title."]);
    expect(spoken("> [!warning]- Collapsed note.")).toEqual(["Collapsed note."]);
  });

  it("produces no words for a titleless callout marker", () => {
    expect(parseDocument("> [!warning]", "t.md", 1).words).toHaveLength(0);
  });
});

describe("obsidian dialect: tags", () => {
  it("speaks an inline tag without the hash", () => {
    expect(spoken("Working on #project today.")).toEqual([
      "Working on project today.",
    ]);
  });

  it("keeps a nested tag intact", () => {
    expect(spoken("Filed under #area/work here.")).toEqual([
      "Filed under area/work here.",
    ]);
  });

  it("leaves a non-tag hash literal", () => {
    expect(spoken("Issue #42 is still open.")).toEqual([
      "Issue #42 is still open.",
    ]);
  });

  it("skips a tag-only line entirely", () => {
    expect(parseDocument("#todo #urgent", "t.md", 1).words).toHaveLength(0);
  });
});

describe("obsidian dialect: highlights and comments", () => {
  it("speaks highlighted text without the equals marks", () => {
    expect(spoken("This is ==really important== stuff.")).toEqual([
      "This is really important stuff.",
    ]);
  });

  it("keeps a single equals literal", () => {
    expect(spoken("Set x = 5 now.")).toEqual(["Set x = 5 now."]);
  });

  it("skips an inline comment", () => {
    expect(spoken("Before %%hidden note%% after.")).toEqual(["Before after."]);
  });
});

describe("obsidian dialect: unclosed wikilink ledger", () => {
  // The unclosed "[[" is expected to stay visible, so it satisfies the ledger
  // invariant (painted slices rebuild the word) but not the no-marker sweep.
  it("paints the literal characters faithfully", () => {
    const src = "Broken [[Target here.";
    const model = parseDocument(src, "t.md", 1);
    for (const w of model.words) {
      const box = src.slice(w.source.start, w.source.end);
      const runs = cleanRuns(box, w.text, w.source.start);
      expect(runs.length).toBeGreaterThan(0);
      expect(runs.map((r) => src.slice(r.from, r.to)).join("")).toBe(w.text);
    }
  });
});

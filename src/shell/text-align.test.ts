// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { alignWords, AlignNode, WordRange, DEFAULT_LOOKAHEAD } from "./text-align";

// Extract text nodes from a rendered HTML fragment in document order, exactly
// as the RangeSurface will from a reading container. This mirrors real rendered
// markdown (inline splits, anchors, callout structure) so the walker is driven
// by realistic node lists, not just hand-built strings.
function nodesFromHtml(html: string): AlignNode[] {
  document.body.innerHTML = html;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const out: AlignNode[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) out.push({ text: n.nodeValue ?? "" });
  return out;
}

// Reconstruct the visible text a WordRange covers, crossing node boundaries the
// way a DOM Range would, so we can assert every word maps to exactly its text.
function textOf(nodes: AlignNode[], r: WordRange): string {
  if (r.startNode === r.endNode) return nodes[r.startNode].text.slice(r.startOffset, r.endOffset);
  let s = nodes[r.startNode].text.slice(r.startOffset);
  for (let n = r.startNode + 1; n < r.endNode; n++) s += nodes[n].text;
  s += nodes[r.endNode].text.slice(0, r.endOffset);
  return s;
}

function expectAligns(words: string[], nodes: AlignNode[]) {
  const res = alignWords(words, nodes);
  expect(res.ok).toBe(true);
  if (!res.ok) return;
  expect(res.ranges.length).toBe(words.length);
  res.ranges.forEach((r, i) => expect(textOf(nodes, r)).toBe(words[i]));
  return res;
}

describe("alignWords: plain and hand-built lists", () => {
  it("maps each word of a single node to a clean range", () => {
    const nodes: AlignNode[] = [{ text: "Alpha beta gamma." }];
    const res = expectAligns(["Alpha", "beta", "gamma."], nodes)!;
    // ranges are in document order and non-overlapping
    expect(res.ranges[0].startOffset).toBe(0);
    expect(res.ranges[1].startOffset).toBe(6);
  });

  it("spans a word split across two inline nodes (bold/italic)", () => {
    // "wo" then "rd" (a <strong> split) form the single word "word"
    const nodes: AlignNode[] = [{ text: "A " }, { text: "wo" }, { text: "rd" }, { text: " here." }];
    const res = expectAligns(["A", "word", "here."], nodes)!;
    const wordRange = res.ranges[1];
    expect(wordRange.startNode).toBe(1);
    expect(wordRange.endNode).toBe(2);
    expect(textOf(nodes, wordRange)).toBe("word");
  });

  it("does not match a word as a substring of a longer rendered token", () => {
    // model "cat" must not match inside "scatter"; boundaries are enforced
    const nodes: AlignNode[] = [{ text: "a scatter of cat food" }];
    const res = alignWords(["cat"], nodes);
    expect(res.ok).toBe(true);
    if (res.ok) expect(textOf(nodes, res.ranges[0])).toBe("cat"); // the standalone "cat", not "scatter"
  });
});

describe("alignWords: rendered-markdown fixtures (happy-dom)", () => {
  it("bold and italic splits across inline nodes", () => {
    const nodes = nodesFromHtml(
      "<p>The <strong>bold</strong> and <em>italic</em> words wo<strong>rd</strong> here.</p>"
    );
    expectAligns(["The", "bold", "and", "italic", "words", "word", "here."], nodes);
  });

  it("wikilink rendered as an anchor speaks the alias", () => {
    const nodes = nodesFromHtml('<p>See <a class="internal-link">Alias</a> right now.</p>');
    expectAligns(["See", "Alias", "right", "now."], nodes);
  });

  it("callout title element words align in order with the body", () => {
    const nodes = nodesFromHtml(
      '<div class="callout"><div class="callout-title"><div class="callout-title-inner">Note Title</div></div>' +
        '<div class="callout-content"><p>Body text here.</p></div></div>'
    );
    expectAligns(["Note", "Title", "Body", "text", "here."], nodes);
  });

  it("skips an embed stretch the model omits, within the lookahead cap", () => {
    // The embed renders "embedded content" which the model never speaks; the
    // walker must skip it and still align Alpha/beta/gamma.
    const nodes = nodesFromHtml(
      '<p>Alpha <span class="internal-embed">embedded content</span> beta gamma.</p>'
    );
    expectAligns(["Alpha", "beta", "gamma."], nodes);
  });
});

describe("alignWords: all-or-nothing failure", () => {
  it("fails cleanly when a model word is absent from the rendered text", () => {
    const nodes: AlignNode[] = [{ text: "Alpha beta gamma." }];
    const res = alignWords(["Alpha", "zebra", "gamma."], nodes);
    expect(res.ok).toBe(false);
  });

  it("fails when a rendered-only stretch pushes the next word past the cap", () => {
    // a stretch longer than the lookahead cap sits between the two model words
    const filler = "X".repeat(DEFAULT_LOOKAHEAD + 40);
    const nodes: AlignNode[] = [{ text: `Alpha ${filler} beta` }];
    const res = alignWords(["Alpha", "beta"], nodes);
    expect(res.ok).toBe(false);
  });

  it("fails when the whole word sequence cannot be found in order", () => {
    const nodes: AlignNode[] = [{ text: "gamma beta Alpha" }]; // reversed order
    const res = alignWords(["Alpha", "beta", "gamma"], nodes);
    expect(res.ok).toBe(false);
  });
});

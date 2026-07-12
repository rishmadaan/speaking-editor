// The reading-mode highlight surface: paints the current word and sentence on the
// rendered (preview) note through the CSS Custom Highlight API, with NO DOM
// mutation of the note (no span wrapping). At seed time it walks the reading
// container's text nodes and aligns them to the model's word sequence (text-align).
// Alignment is all-or-nothing per note: if every model word maps to a range, it
// registers two highlights and paints; if not, it stays "none" and paints nothing,
// so a note with embeds or a rendering that diverges never highlights WRONGLY.
import { WordEntry } from "./word-runs";
import { HighlightSurface } from "./highlight-surface";
import { alignWords } from "./text-align";

const WORD_HIGHLIGHT = "se-word-r";
const SENTENCE_HIGHLIGHT = "se-sentence-r";

// Collect a container's Text nodes in document order, the same order the walker
// aligns against and the RangeSurface builds DOM Ranges from.
function collectTextNodes(root: HTMLElement): Text[] {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) out.push(n as Text);
  return out;
}

export class RangeSurface implements HighlightSurface {
  private _kind: "range" | "none" = "none";
  private entries: WordEntry[] = [];
  // model word index -> its DOM Range (only for aligned notes)
  private rangeByWord = new Map<number, Range>();
  // the same ranges in document order, for click hit-testing
  private ordered: { word: number; range: Range }[] = [];
  private wordHi = new Highlight();
  private sentenceHi = new Highlight();
  private registered = false;

  constructor(private container: HTMLElement) {}

  get kind(): "range" | "none" {
    return this._kind;
  }

  seed(entries: WordEntry[]): void {
    this.entries = entries;
    const textNodes = collectTextNodes(this.container);
    const words = entries.map((e) => e.text);
    const result = alignWords(
      words,
      textNodes.map((t) => ({ text: t.data }))
    );
    if (!result.ok) {
      this._kind = "none";
      return;
    }
    try {
      result.ranges.forEach((wr, i) => {
        const range = this.container.ownerDocument.createRange();
        range.setStart(textNodes[wr.startNode], wr.startOffset);
        range.setEnd(textNodes[wr.endNode], wr.endOffset);
        const wordIndex = entries[i].index;
        this.rangeByWord.set(wordIndex, range);
        this.ordered.push({ word: wordIndex, range });
      });
    } catch {
      // Building a Range can only fail if the DOM shifted under us between the
      // walk and now. Never paint a half-built (wrong) highlight: fall back to
      // none, the safe outcome.
      this.rangeByWord.clear();
      this.ordered = [];
      this._kind = "none";
      return;
    }
    CSS.highlights.set(WORD_HIGHLIGHT, this.wordHi);
    CSS.highlights.set(SENTENCE_HIGHLIGHT, this.sentenceHi);
    this.registered = true;
    this._kind = "range";
  }

  onPosition(word: number, sentence: number): void {
    if (this._kind !== "range") return; // no alignment: playback with no highlight
    this.wordHi.clear();
    this.sentenceHi.clear();
    // sentence band: every aligned word in this sentence (mirrors the CM6 field,
    // which marks each word's runs, not the gaps between them)
    for (const e of this.entries) {
      if (e.sentence !== sentence) continue;
      const r = this.rangeByWord.get(e.index);
      if (r) this.sentenceHi.add(r);
    }
    const wr = this.rangeByWord.get(word);
    if (wr) this.wordHi.add(wr);
    this.follow(sentence);
  }

  clear(): void {
    this.wordHi.clear();
    this.sentenceHi.clear();
    if (this.registered) {
      CSS.highlights.delete(WORD_HIGHLIGHT);
      CSS.highlights.delete(SENTENCE_HIGHLIGHT);
      this.registered = false;
    }
    this.rangeByWord.clear();
    this.ordered = [];
    this._kind = "none";
  }

  // Map a viewport point to the nearest aligned word: the word whose range
  // contains the caret, else the first aligned word that begins after it (the
  // same nearest-following rule live preview uses).
  hitTest(x: number, y: number): number | null {
    if (this._kind !== "range") return null;
    const caret = this.container.ownerDocument.caretRangeFromPoint(x, y);
    if (!caret) return null;
    const node = caret.startContainer;
    const offset = caret.startOffset;
    for (const { word, range } of this.ordered) {
      try {
        if (range.comparePoint(node, offset) === 0) return word;
      } catch {
        /* point in a different document subtree: skip this range */
      }
    }
    for (const { word, range } of this.ordered) {
      try {
        if (range.comparePoint(node, offset) === -1) return word; // range begins after the point
      } catch {
        /* skip */
      }
    }
    return null;
  }

  acceptanceWordRect(word: number): DOMRect | null {
    const r = this.rangeByWord.get(word);
    return r ? r.getBoundingClientRect() : null;
  }

  // Gentle follow: scroll the sentence's first aligned range into view with block
  // "nearest", which only moves the viewport when the anchor has left the visible
  // band, matching the live-preview leave-the-band policy.
  private follow(sentence: number): void {
    const first = this.entries.find((e) => e.sentence === sentence && this.rangeByWord.has(e.index));
    if (!first) return;
    const range = this.rangeByWord.get(first.index);
    if (!range) return;
    const node = range.startContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    try {
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    } catch {
      /* scrolling can throw if the node detached mid-teardown; skip the follow */
    }
  }
}

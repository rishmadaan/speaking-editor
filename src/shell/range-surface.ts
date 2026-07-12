// The reading-mode highlight surface: paints the current word and sentence on the
// rendered (preview) note through the CSS Custom Highlight API, with NO DOM
// mutation of the note (no span wrapping). At seed time it walks the reading
// container's text nodes and aligns them to the model's word sequence (text-align).
// Alignment is all-or-nothing per note: if every model word maps to a range, it
// registers two highlights and paints; if not, it stays "none" and paints nothing,
// so a note with embeds or a rendering that diverges never highlights WRONGLY.
import { WordEntry } from "./word-runs";
import { HighlightSurface, FollowHooks } from "./highlight-surface";
import { alignWords } from "./text-align";
import { FollowPolicy } from "./follow-policy";

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
  private lastSentence = -1;
  private policy: FollowPolicy;
  private scroller: HTMLElement;
  private scrollAborter = new AbortController();
  private torn = false;

  constructor(private container: HTMLElement, hooks: FollowHooks = {}) {
    this.policy = new FollowPolicy({
      showChip: () => hooks.onFollowBreak?.(),
      hideChip: () => hooks.onFollowReturn?.(),
      scrollToCurrent: () => this.scrollSentenceToCenter(this.lastSentence),
    });
    // The reading scroller is the preview view (the overflow container); the
    // aligned container is the inner sizer. A user scroll of it breaks following.
    this.scroller =
      (container.closest(".markdown-preview-view") as HTMLElement | null) ?? container;
    this.scroller.addEventListener("scroll", () => this.policy.handleScroll(), {
      passive: true,
      signal: this.scrollAborter.signal,
    });
    this.scroller.addEventListener("scrollend", () => this.policy.handleScrollEnd(), {
      passive: true,
      signal: this.scrollAborter.signal,
    });
  }

  get kind(): "range" | "none" {
    return this._kind;
  }

  get following(): boolean {
    return this.policy.following;
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
    this.lastSentence = sentence;
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
    if (this.policy.following) this.follow(sentence);
  }

  clear(): void {
    if (!this.torn) {
      this.torn = true;
      this.scrollAborter.abort();
      this.policy.destroy();
    }
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

  // Return chip: re-engage following and re-centre the current sentence.
  engageFollow(): void {
    this.policy.handleReturnClick();
  }

  // Click-to-seek: re-engage following in place, no scroll.
  notifyJump(): void {
    this.policy.handleJump();
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

  // Comfort-band follow (spec 0012 Part 1 point 4): scroll only when the sentence
  // anchor has left the middle 50% of the scroller (25% margins), centring
  // smoothly. Our own scroll is fenced by policy.beginSelfScroll() so it does not
  // read as a user scroll and break following.
  private follow(sentence: number): void {
    const el = this.anchorEl(sentence);
    if (!el) return;
    try {
      const rect = el.getBoundingClientRect();
      const view = this.scroller.getBoundingClientRect();
      const margin = view.height * 0.25;
      if (rect.top < view.top + margin || rect.bottom > view.bottom - margin) {
        this.policy.beginSelfScroll();
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    } catch {
      /* scrolling can throw if the node detached mid-teardown; skip the follow */
    }
  }

  // Unconditional centre scroll for the return chip.
  private scrollSentenceToCenter(sentence: number): void {
    const el = this.anchorEl(sentence);
    if (!el) return;
    try {
      this.policy.beginSelfScroll();
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    } catch {
      /* node detached mid-teardown; skip */
    }
  }

  // The element hosting a sentence's first aligned range, for scroll measurement.
  private anchorEl(sentence: number): HTMLElement | null {
    const first = this.entries.find((e) => e.sentence === sentence && this.rangeByWord.has(e.index));
    if (!first) return null;
    const range = this.rangeByWord.get(first.index);
    if (!range) return null;
    const node = range.startContainer;
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element);
    return (el as HTMLElement | null) ?? null;
  }
}

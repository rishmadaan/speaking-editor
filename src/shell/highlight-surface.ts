// The highlight surface seam. A ReadingSession owns the model, audio, and the
// frame loop; where the current word actually gets PAINTED is pluggable behind
// this interface. Live preview paints through the CM6 sync field (CmSurface,
// below); reading mode paints through the CSS Custom Highlight API (RangeSurface,
// in range-surface.ts). The session drives whichever surface it is given with the
// same three calls, so the model/audio half never learns which mode it is in.
import { StateEffect } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { WordEntry } from "./word-runs";
import { setWords, setPosition, clearAll, syncField } from "./sync-field";
import { FollowPolicy } from "./follow-policy";

// The DOM effects a surface's follow policy triggers, injected by the shell so the
// return chip (mounted by main.ts near the pill) shows/hides as following breaks
// and resumes. Optional: the default CmSurface built inside the session (node
// tests, no chip) omits them and still follows correctly.
export interface FollowHooks {
  onFollowBreak?: () => void; // user scrolled away: show the return chip
  onFollowReturn?: () => void; // returned or jumped: hide the return chip
}

export interface HighlightSurface {
  // What kind of surface this is, for observability and the all-or-nothing rule.
  // A RangeSurface whose alignment failed reports "none": playback continues with
  // no highlight rather than a wrong one.
  readonly kind: "cm" | "range" | "none";

  // Seed the surface with the note's word entries once, at session start, so a
  // position can paint the instant it arrives.
  seed(entries: WordEntry[]): void;

  // Report the current word and its sentence; the surface repaints and does its
  // gentle follow. Called from inside the frame loop, in order.
  onPosition(word: number, sentence: number): void;

  // Tear the surface down (session end/teardown): clear every decoration.
  clear(): void;

  // Reading-mode click-to-seek: map a viewport point to the nearest aligned model
  // word index, or null. Live preview does its own hit-testing on the editor, so
  // CmSurface leaves this undefined.
  hitTest?(x: number, y: number): number | null;

  // Acceptance-only observability: the viewport rect of a word's painted range,
  // so the harness can click a rendered word. Undefined off the range surface.
  acceptanceWordRect?(word: number): DOMRect | null;

  // Follow policy (spec 0012 Part 1). A user scroll breaks following; the return
  // chip re-engages it (engageFollow) and re-centres; a click-to-seek re-engages
  // it in place (notifyJump). Undefined on surfaces with no follow (fakes).
  engageFollow?(): void;
  notifyJump?(): void;

  // Observability for the acceptance checks: whether the surface is currently
  // following the reading. Undefined on fakes.
  readonly following?: boolean;
}

// The live-preview surface: the exact CM6 path this plugin has always used,
// extracted verbatim from the session so its behaviour is byte-identical. The
// sync field carries the entries, remaps them through every edit, and paints the
// word + sentence marks; the gentle follow scrolls the sentence's first live run
// back into the viewport band when it drifts out.
export class CmSurface implements HighlightSurface {
  readonly kind = "cm" as const;
  private entries: WordEntry[] = [];
  private lastSentence = -1;
  private policy: FollowPolicy;
  private scrollAborter = new AbortController();
  private torn = false;

  constructor(private view: EditorView, hooks: FollowHooks = {}) {
    this.policy = new FollowPolicy({
      showChip: () => hooks.onFollowBreak?.(),
      hideChip: () => hooks.onFollowReturn?.(),
      scrollToCurrent: () => this.scrollSentenceToCenter(this.lastSentence),
    });
    // A user scroll of the editor breaks following; scrollend (or the policy's
    // 600ms fallback) clears the self-scroll guard. Our own scrollIntoView is
    // fenced by policy.beginSelfScroll() so it never reads as a user scroll.
    const scroller = this.view.scrollDOM;
    scroller.addEventListener("scroll", () => this.policy.handleScroll(), {
      passive: true,
      signal: this.scrollAborter.signal,
    });
    scroller.addEventListener("scrollend", () => this.policy.handleScrollEnd(), {
      passive: true,
      signal: this.scrollAborter.signal,
    });
  }

  get following(): boolean {
    return this.policy.following;
  }

  seed(entries: WordEntry[]): void {
    this.entries = entries;
    // Reset the position along with the entries: the field keeps the previous
    // session's word until the new session's first tick, and that stale word
    // would paint (and be read back by capture logic) as if it were current.
    this.dispatch([setWords.of(entries), setPosition.of({ word: -1, sentence: -1 })]);
  }

  onPosition(word: number, sentence: number): void {
    this.lastSentence = sentence;
    const effects: StateEffect<unknown>[] = [setPosition.of({ word, sentence })];
    // Comfort-band follow (spec 0012 Part 1 point 4): only when following IS on,
    // and only when the sentence anchor has left the middle 50% of the viewport.
    if (this.policy.following) {
      const pos = this.firstRunPos(sentence);
      if (pos != null) {
        try {
          const coords = this.view.coordsAtPos(pos);
          const rect = this.view.scrollDOM.getBoundingClientRect();
          const margin = rect.height * 0.25;
          if (!coords || coords.top < rect.top + margin || coords.bottom > rect.bottom - margin) {
            this.policy.beginSelfScroll();
            effects.push(EditorView.scrollIntoView(pos, { y: "center" }));
          }
        } catch {
          /* measurement can fail if the view is mid-teardown; skip the follow */
        }
      }
    }
    this.dispatch(effects);
  }

  clear(): void {
    if (!this.torn) {
      this.torn = true;
      this.scrollAborter.abort();
      this.policy.destroy();
    }
    this.dispatch([clearAll.of(null)]);
  }

  // Return chip: re-engage following and re-centre the current sentence.
  engageFollow(): void {
    this.policy.handleReturnClick();
  }

  // Click-to-seek: the click is the new reading position, so re-engage without
  // scrolling (the word is already where the user is looking).
  notifyJump(): void {
    this.policy.handleJump();
  }

  // The first clean live run of a sentence, in document offsets. Read LIVE entries
  // from the field, not the seed-time copy: edits during playback remap field
  // entries, and a stale anchor would scroll to pre-edit offsets.
  private firstRunPos(sentence: number): number | null {
    const live = this.view.state.field(syncField, false)?.words ?? this.entries;
    const first = live.find((e) => e.sentence === sentence && e.runs.length > 0 && !e.dirty);
    return first ? first.runs[0].from : null;
  }

  private scrollSentenceToCenter(sentence: number): void {
    const pos = this.firstRunPos(sentence);
    if (pos == null) return;
    this.policy.beginSelfScroll();
    this.dispatch([EditorView.scrollIntoView(pos, { y: "center" })]);
  }

  private dispatch(effects: StateEffect<unknown>[]): void {
    try {
      this.view.dispatch({ effects });
    } catch {
      /* the view may be detached during teardown; a lost dispatch is harmless */
    }
  }
}

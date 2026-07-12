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
}

// The live-preview surface: the exact CM6 path this plugin has always used,
// extracted verbatim from the session so its behaviour is byte-identical. The
// sync field carries the entries, remaps them through every edit, and paints the
// word + sentence marks; the gentle follow scrolls the sentence's first live run
// back into the viewport band when it drifts out.
export class CmSurface implements HighlightSurface {
  readonly kind = "cm" as const;
  private entries: WordEntry[] = [];

  constructor(private view: EditorView) {}

  seed(entries: WordEntry[]): void {
    this.entries = entries;
    // Reset the position along with the entries: the field keeps the previous
    // session's word until the new session's first tick, and that stale word
    // would paint (and be read back by capture logic) as if it were current.
    this.dispatch([setWords.of(entries), setPosition.of({ word: -1, sentence: -1 })]);
  }

  onPosition(word: number, sentence: number): void {
    const effects: StateEffect<unknown>[] = [setPosition.of({ word, sentence })];
    // Gentle follow: if the sentence's first run is outside the visible viewport,
    // scroll it back. Read LIVE entries from the field, not the seed-time copy:
    // edits during playback remap field entries, and a stale anchor would scroll
    // to pre-edit offsets.
    const live = this.view.state.field(syncField, false)?.words ?? this.entries;
    const first = live.find((e) => e.sentence === sentence && e.runs.length > 0 && !e.dirty);
    if (first) {
      const pos = first.runs[0].from;
      try {
        const coords = this.view.coordsAtPos(pos);
        const rect = this.view.scrollDOM.getBoundingClientRect();
        if (!coords || coords.top < rect.top || coords.bottom > rect.bottom) {
          effects.push(EditorView.scrollIntoView(pos, { y: "nearest" }));
        }
      } catch {
        /* measurement can fail if the view is mid-teardown; skip the follow */
      }
    }
    this.dispatch(effects);
  }

  clear(): void {
    this.dispatch([clearAll.of(null)]);
  }

  private dispatch(effects: StateEffect<unknown>[]): void {
    try {
      this.view.dispatch({ effects });
    } catch {
      /* the view may be detached during teardown; a lost dispatch is harmless */
    }
  }
}

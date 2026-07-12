# 0007: Reading Mode support

Status: draft (builds after 0006 lands)
Date: 2026-07-12
Depends on: 0001-0006. The v1 scope commits play/pause/resume from
Reading Mode; live preview stays the flagship karaoke surface.

## Goal

A note open in Reading Mode (the rendered preview) can be played,
paused, resumed, seeked, and followed exactly like live preview, with
word highlighting rendered through the CSS Custom Highlight API when the
rendered text aligns perfectly with the document model, and NO highlight
at all when it does not (all-or-nothing per note: a wrong highlight is
worse than none; the flawless bar is "never visibly wrong").

## Mechanism

1. Text alignment: walk the reading-mode container's text nodes in
   document order and greedily match the model's word sequence (each
   word's clean text) against their contents, producing per-word DOM
   `Range`s. The dialect rules (0002) make the model's spoken text a
   subsequence of the rendered text for standard notes; embeds render
   content the model skips, so the walker must skip non-matching stretches
   bounded by a per-word lookahead cap rather than failing outright.
   Alignment SUCCEEDS only if every model word found its range in order;
   otherwise the note gets playback without highlight (and the session
   records `highlightSurface: "none"` so the acceptance checks can assert
   the all-or-nothing rule).
2. Painting: CSS Custom Highlight API (`CSS.highlights`, supported in
   this Electron), two registered highlights (`se-word-r`, `se-sentence-r`)
   with `::highlight(...)` rules in styles.css mirroring the live-preview
   colors. No DOM mutation of the rendered note, no span wrapping.
3. Follow: scroll the current sentence's first range into view (same
   band policy as live preview, `scrollIntoView` on the range's node).
4. Click-to-seek in listening mode: mousedown in the reading container
   maps via `document.caretRangeFromPoint` to the nearest aligned word.
5. Session plumbing: ReadingSession already separates model/audio from
   the decoration surface (the sync field). Introduce a small surface
   interface: live preview keeps the CM6 field path untouched; reading
   mode supplies a RangeHighlighter implementing the same
   onPosition/clear contract. The session takes the surface as an option;
   main.ts picks the surface by the view's current mode.
6. Mode flips mid-session (user toggles preview/edit): stop the session
   cleanly (Notice: "Reading stopped: the view changed"). Continuous
   cross-mode sessions are out of scope for v1.
7. The pill mounts in the reading view's container the same way, all
   controls identical.

## Out of scope

Cross-mode session continuity, PDF/embed reading, highlight in popover
previews, mobile.

## Test-first requirements

- The text-alignment walker as a pure function over a lightweight node
  list abstraction (unit-tested in happy-dom with fixtures mirroring
  rendered markdown: bold/italic splits words across nodes, wikilinks
  render as anchors, callout titles, an embed stretch the model skips,
  and a deliberately mismatched note that must return failure).
- Surface interface: the session drives a fake surface in a node test
  (onPosition ordering, clear on teardown).

## Acceptance (in-app checks appended)

20. In reading mode on the dialect fixture, play reaches "playing", the
    alignment succeeds, and CSS.highlights contains ranges for the
    current word within 6s.
21. Listening-mode click on a rendered word seeks (same contract as
    check 4).
22. A note engineered to defeat alignment (the harness injects a
    rendered-only element mid-paragraph) still PLAYS but registers no
    highlight ranges and reports surface "none" (the all-or-nothing
    rule, asserted).

Manual (Rishabh): flip a familiar note to Reading Mode, play it, watch
the karaoke on rendered text; click around in listening mode; confirm
nothing ever highlights wrongly on notes with embeds/callouts.

## Constraints

No em dashes. No vendored-file changes. No DOM mutation of rendered
notes (Highlight API only). Never a wrong highlight: on any alignment
doubt, none.

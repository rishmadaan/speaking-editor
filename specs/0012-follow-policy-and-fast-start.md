# 0012: The follow policy (ported from TalkToMeBaby) and fast starts

Status: built (332 tests; live checks 31-34 in the next hands-off run)
Date: 2026-07-12
Depends on: 0001-0011. Driven by a live bug report on a 63-minute note:
auto-follow yanked the view back to the reading position whenever Rishabh
scrolled away to click a different word, and cold starts on big notes
felt endless. The parent repo already solved the first problem
(packages/vscode-extension/src/webview/highlight.ts); this spec ports its
policy and attacks time-to-first-audio.

## Part 1: user scroll breaks following (the parent's policy, exactly)

State per session: `following`, default true.

1. Any USER scroll of the reading surface turns following off. Guard
   against self-triggered scrolls the parent's way: set a `scrolling`
   flag before our own scrollIntoView, clear it on the surface's
   scrollend (with a 600ms timer fallback since smooth-scroll end
   detection can be missed); scroll events during the flag are ours and
   do not break following.
2. While following is off, position changes NEVER scroll. The highlight
   keeps painting wherever the reading is.
3. A "Return to reading" affordance appears when following breaks: a
   small floating chip (se-return class family, same manners as the
   pill: opacity transitions only, never in the tab order), anchored
   above the pill. Click: following=true, chip hides, smooth-scroll the
   current sentence to center.
4. Comfort band: when following IS on, scroll only when the current
   sentence's anchor leaves the middle 50% of the viewport (25% margins,
   parent's numbers), centering smoothly (CM6: EditorView.scrollIntoView
   with y "center"; reading mode: scrollIntoView block "center",
   behavior "smooth").
5. A user click-to-jump re-engages following at the new spot (the click
   IS the new reading position; the parent's onReturn equivalent).
6. Live preview attaches the scroll listener to cm.scrollDOM; reading
   mode to the reading container's scroller. Both surfaces share the
   policy object (one small module, pure-logic core unit-tested:
   following/scrolling flag transitions given event sequences).

## Part 2: fast starts on big notes

1. Fast first audio: shell-side, after buildChunks, if chunk 0 is longer
   than ~600 characters, split it at the first sentence boundary at or
   after 300 characters into chunk 0a (small, synthesizes in a fraction
   of the time) and chunk 0b, renumbering chunks and word refs
   accordingly (pure function, unit-tested against the chunker's
   invariants: every word ref preserved, offsets intact, text
   concatenation identical). Time-to-first-audio on a cold big note
   drops roughly 3x. The disk cache keys on chunk text, so this changes
   cache identity for the first chunk only (acceptable; caches refill).
2. Optimistic click acknowledgment: a click-to-jump paints the clicked
   word's highlight IMMEDIATELY (setPosition to the clicked word) even
   though audio for that chunk may still be synthesizing (the preparing
   pulse already runs during the wait since 0009). The tick corrects
   position the moment real audio starts. No more did-my-click-even-land
   silence.
3. Jump priority hygiene: verify (and assert in a unit test) that a
   seek's chunk request goes to the FRONT of the synthesis queue ahead
   of any queued prefetches (the vendored service's priority flag does
   this; the test pins the behavior so a regression is loud).

## Out of scope

Preempting an in-flight synthesis (the vendored service completes the
current job; a jump still waits for at most one foreign chunk),
progressive/streaming synthesis, virtualized reading-mode re-alignment.

## Test-first requirements

- Follow-policy flag machine (event sequences: our-scroll vs user-scroll
  vs scrollend vs jump vs return-click).
- Chunk-0 splitter invariants (word refs, offsets, text identity,
  renumbering, no-op below threshold, single-sentence chunk 0).
- Queue-priority pin test against the vendored SynthesisService with a
  fake provider.

## Acceptance (in-app checks appended)

31. During playback with following on, a synthetic user scroll (dispatch
    a wheel/scroll on scrollDOM) stops auto-scroll: the next sentence
    change does not move scrollTop, and the return chip is visible.
32. Clicking the return chip scrolls the current sentence back into the
    comfort band and hides the chip; following resumes (next
    out-of-band sentence change scrolls again).
33. On a large fixture (generate ~8k words), press play: first audio
    (state "playing") arrives in under half the time of an unsplit
    chunk-0 baseline is impractical to measure in-app, so assert the
    structural truth instead: the session's chunk 0 text length is under
    700 characters and playback reaches "playing" with word 0 painted.
34. Click a word in a far, unloaded chunk: the word highlight moves to
    the clicked word within 200ms (optimistic), state shows preparing,
    and audio eventually arrives there (state "playing" with the current
    word inside the clicked sentence, generous timeout).

Manual (Rishabh): replay the 63-minute note. Scroll away mid-listen:
the view stays where YOU put it and a quiet "Return to reading" chip
waits above the pill; click it to snap back. Click a far word: the
highlight lands there instantly, the pill pulses while the voice
catches up. Press play on the big note cold: the voice starts in a
couple of seconds now.

## Constraints

No em dashes. No vendored-file changes (the splitter wraps buildChunks
output; the follow policy lives in the shell surfaces). Opacity-only
transitions. The return chip never steals focus.

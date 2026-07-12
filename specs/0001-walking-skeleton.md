# 0001: Walking skeleton, the first playable slice

Status: building
Date: 2026-07-12
Depends on: spike 1 (Edge synthesis in Obsidian, PASS 6/6), spike 2 (CM6
decorations/seek/remap, PASS 8/8). This spec wires the two proven halves
together into the first thing a human can press play on.

## Goal

Open a markdown note in live preview, press play, hear it read by the
zero-key Edge voice while the current word and sentence highlight in the
native editor and the view follows; click a word to jump playback there;
pause and resume. Real plugin id (`speaking-editor`), real plugin layout,
in the throwaway test vault only.

## In scope

- Plugin `speaking-editor` v0.1.0 (manifest: isDesktopOnly true, minAppVersion
  1.5.0), built from `src/shell/main.ts` into `dist/` and installed into
  `spikes/test-vault/.obsidian/plugins/speaking-editor/` by a root `build.mjs`.
- Commands: "Play or pause reading" (one toggle command) and "Stop reading".
  A ribbon icon that mirrors the toggle (icon swaps between play and pause
  states; stop clears it).
- Pipeline per play press: editor text -> `parseDocument` -> `buildChunks` ->
  `SynthesisService` (EdgeProvider, voice `en-US-AriaNeural` hardcoded, no
  disk cache yet, in-memory only via the service's in-flight map) -> the
  vendored playback `Engine` driving real `Audio` elements via blob URLs
  (the spike 1 recipe).
- Word + sentence decorations via the spike 2 mechanism, promoted to real
  shell modules: clean-runs computation (only visible characters ever
  painted), a CM6 StateField mapped through `ChangeDesc.mapPos` on every
  transaction, frame-synced position loop (rAF driving `Engine.tick()`,
  decoration dispatched in the first frame after a word boundary).
- Click-to-seek while a session is active: clicking a word seeks playback
  there (containing word, else nearest next word). When nothing is playing,
  clicks edit as normal. (The full listening-mode toggle is a later spec.)
- Gentle follow: when the current sentence's first run leaves the visible
  viewport, scroll it back into view (CM6 scrollIntoView, y "nearest").
- Editing while reading must never break highlights: edits remap ranges
  live; an edit inside a word marks it dirty and it is skipped by
  decorations. Audio keeps playing the pre-edit text for this slice
  (reparse-and-rechunk is a later spec; say so in the code comment).
- Stop (and plugin unload) tears down: audio paused, blob URLs revoked,
  synthesis aborted, decorations cleared.
- Styling: `styles.css` using Obsidian theme variables only
  (`--text-highlight-bg` family for the word, a translucent accent for the
  sentence band), so light and dark both work with no hardcoded colors.

## Out of scope (later specs)

Settings tab, provider choice, premium keys, speed control, per-note
position memory, listening-mode toggle, Obsidian markdown dialect
(wikilinks/callouts/tags/embeds), reading mode, disk cache, auto-scroll
pill, resume-after-restart, release pipeline.

## Module layout (new code)

- `src/shell/word-runs.ts`: pure. `cleanRuns()` + `buildWordEntries(model,
  docText)` (word index, text, runs, sentence, dirty). Unit-tested first.
- `src/shell/sync-field.ts`: the CM6 StateField + effects (set entries, set
  position, clear), decoration provider, `mapEntries` through ChangeDesc.
  Logic identical to spike 2's proven field.
- `src/shell/session.ts`: one reading session. Owns model, chunks,
  SynthesisService, playback Engine, rAF loop, audio elements. Exposes
  playPause/stop/seekToWord/dispose and an onState callback for the ribbon.
  EngineCallbacks implementation is the spike 1 recipe (blob URL, Audio).
- `src/shell/main.ts`: the Plugin subclass. Commands, ribbon, click handler
  (mousedown on the editor DOM -> posAtCoords -> word -> seek), wiring a
  session to the active MarkdownView, acceptance-check command.
- Unit tests: `word-runs.test.ts` (marker fixtures: bold, italic, inline
  code, links, headings, list markers; painted slices always equal word
  text), `sync-field.test.ts` (remap invariants on insert/inside-edit/
  delete, using EditorState without DOM if feasible; otherwise cover
  mapEntries as a pure function).

## Acceptance checks

Automated, in-app (command "Speaking Editor: Run acceptance checks", spike
pattern, writes `skeleton-acceptance.md` to the vault root; command only
present in dev builds, gated by a `DEV_ACCEPTANCE` esbuild define):

1. Play on the fixture note reaches state "playing" and the first word
   decoration appears within 6s (Edge round trip included).
2. While playing, every painted slice equals its word's visible text (no
   syntax characters painted), sampled over the first 15 words.
3. Word advances are frame-synced (first frame after boundary, spike 2
   criterion) over a 10-word sample.
4. Synthetic click on word N while playing seeks: within 1s the current
   word decoration is at word N (allow N or N+1 for tick granularity).
5. Pause freezes position; resume restarts from the current sentence start
   (the vendored Engine's contract).
6. Typing an insertion upstream of the current word shifts decorations and
   playback continues (state stays "playing").
7. Stop clears all decorations and releases audio (no element left playing).

Manual checklist (Rishabh, in the test vault):

- Open Spike2 Note.md, press ribbon play: voice starts, karaoke follows.
- Watch the bold/italic/link lines: highlights never touch the markers.
- Click a word two paragraphs ahead: playback jumps there.
- Type a few words above the highlight while it reads: nothing visually
  breaks.
- Toggle pause/resume from both ribbon and command palette.
- Switch between light and dark theme: both highlight styles readable.

## Verification gates

`npm test` green (inherited 78 + new unit tests), `npm run typecheck`
clean, `node build.mjs` clean, all seven automated acceptance checks PASS
in a live Obsidian, manual checklist walked by Rishabh.

## Constraints carried from doctrine

No em dashes anywhere including generated docs and reports. No API keys in
this slice at all (Edge is keyless); when keys arrive they go to
localStorage, never data.json. Audio cache, when it arrives, lives outside
the vault. Nothing in this plugin ever writes to the real vault; all
testing happens in spikes/test-vault.

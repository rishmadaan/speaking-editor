# 0004: The floating pill player

Status: built (185 tests green; live 15-check run armed; feel pass pending)
Date: 2026-07-12
Depends on: 0001-0003. Rishabh picked Option A from the player UI mockups
(outputs/speaking-editor-player-ui-mockups-2026-07-12.html in the mycroft
repo): a floating pill near the bottom of the editor, quick controls in
it, with its manners built in.

## Goal

While a reading session exists, a rounded pill floats bottom-center of
that editor with the session's quick controls. It appears when a session
starts, disappears when the session ends or is stopped, fades politely
while the user types, and never moves or resizes on its own (the calm
rule: no layout shift, no position animation, opacity transitions only).

## The pill's contents (left to right)

1. Play/pause button (circular, accent-colored): mirrors session state
   (playing shows pause glyph, paused shows play glyph). Click toggles.
2. Speed control: a compact text button showing the current rate ("1.2x").
   Click cycles presets [0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0] starting from
   the closest current value; each click applies live via the existing
   `plugin.applySpeed` (persists + live audio). Right-click (contextmenu)
   steps backwards through the same presets.
3. Voice label: the current voice's display label, dimmed, truncated with
   ellipsis past 14ch. Click opens the plugin's settings tab (the standard
   `app.setting.open()` + `openTabById` pair).
4. Listening-mode ear toggle: shows active state by accent color vs
   dimmed. Click flips the setting via the existing toggle path (persist +
   Notice comes from that path unchanged).
5. Stop button (X, dimmed): stops the session (which also hides the pill).

## Manners (the reason A won)

- Mount: absolutely positioned inside the session editor's container
  (anchor to the CM6 `scrollDOM`'s offset parent so it does not scroll
  with the text), bottom-center, ~14px up. Never in the way of the status
  bar; never a separate window.
- Fade while typing: any user-initiated docChanged transaction on that
  editor drops the pill to 0.35 opacity immediately; it returns to full
  opacity 1.5s after the last such edit, or instantly on pointer hover
  over the pill. Opacity transitions ~150ms; nothing else animates.
- Hidden when no session exists. Removed from the DOM on session end,
  stop, plugin unload, and when the session moves to another editor
  (exactly one pill ever exists).
- Pointer events stay on: the pill is clickable even while faded.
- Styling in styles.css with Obsidian theme variables only (background
  `--background-secondary`, border `--background-modifier-border`, text
  `--text-normal`/`--text-muted`, accent `--interactive-accent`); readable
  in light and dark without hardcoded colors. Subtle shadow, 999px radius.

## Module layout

- `src/shell/player-pill.ts`: a `PlayerPill` class owning the DOM element
  and its state (`mount(container)`, `setState(sessionState)`,
  `setSpeed(rate)`, `setVoiceLabel(label)`, `setListening(on)`,
  `notifyTyping()`, `destroy()`), taking callbacks for the five controls.
  Pure DOM, no Obsidian imports, so it unit-tests in happy-dom or via
  DOM-free logic extraction: at minimum the preset-cycling logic
  (`nextPreset(current, direction)`) is a pure exported function with
  unit tests (closest-preset resolution, wraparound both directions).
- `src/shell/main.ts`: owns one `PlayerPill | null`. Creates it on
  session start (mounted to the session editor's container), routes
  session state changes to `setState`, routes settings changes
  (speed/listening/voice) into the pill so it always reflects reality
  (including changes made from the settings tab while playing), forwards
  user typing (reuse the sync-field remap path: a docChanged transaction
  on the session editor) via `notifyTyping()`, and destroys it whenever
  the session goes away. Voice label resolves from the cached voice list
  when available, falling back to the raw voice id.

## Out of scope

Progress bar / scrubber (later, needs design), dragging the pill,
per-editor multi-pill (one session, one pill), reading-mode surface,
minimal status-bar mode (the mockup's option B as a v2 setting).

## Test-first requirements

- `nextPreset` pure logic: exact preset hit cycles to the next; between
  presets resolves to closest then cycles; wraparound at both ends;
  backwards direction.
- PlayerPill DOM behavior where testable without a real editor: mounts
  with all five controls, setState swaps play/pause glyphs, notifyTyping
  drops opacity and restores after the delay (fake timers), destroy
  removes the element and cancels timers.

## Acceptance (in-app checks appended to the harness)

11. Starting a session (plugin path) mounts exactly one pill inside that
    editor's container; its play control reflects "playing".
12. Clicking the pill's play control pauses the session (state "paused",
    glyph flips); clicking again resumes.
13. Clicking the speed control advances to the next preset: settings.speed
    and the live audio playbackRate both change; the label shows the new
    value.
14. Dispatching a user-like edit fades the pill (opacity < 1 within
    200ms), and it restores to full opacity within 2.5s without a hover.
15. Stop removes the pill from the DOM entirely (no hidden element left),
    and a fresh play mounts a fresh one.

Manual (Rishabh): the feel pass. Play a long note; type while it reads
and watch the pill step back; hover it mid-fade; cycle speeds by
clicking; flip the ear; click the voice name and land in settings; stop
and watch it leave. Both themes.

## Constraints

No em dashes anywhere. No vendored-file changes. The pill never captures
keyboard focus (buttons are click-only, `tabindex="-1"`), so writing flow
is never interrupted. Class names prefixed `se-pill`.

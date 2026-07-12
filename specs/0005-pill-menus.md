# 0005: Pill menus (pick speed and voice from the pill)

Status: built (194 tests; live checks 16-17 pending the final armed run)
Date: 2026-07-12
Depends on: 0004. Rishabh: "make a pill player that has menus and stuff,
like you click on it and then you change the speed or the voice right
from there itself." Cycling presets by repeated clicking was a stopgap;
picking from a menu is the real interaction.

## Goal

The pill's speed and voice controls open native Obsidian menus anchored
to the pill, so the two most-touched settings are one click away without
ever opening the settings tab. Everything stays theme-native and calm.

## Behavior

1. Speed button click opens an Obsidian `Menu` at the button showing the
   presets [0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0], each item titled "1.2x"
   style, the current speed checked (`setChecked(true)`), pick applies via
   the existing `plugin.applySpeed` (persists, live audio, pill label).
   A final item "Fine-tune in settings" opens the settings tab. The
   right-click step-backward gesture is REMOVED (menus replace gestures;
   one obvious way).
2. Voice button click opens an Obsidian `Menu` with two sections:
   - Providers: one item per available provider (Edge, macOS say,
     ElevenLabs when it has a key; an ElevenLabs item without a key shows
     "(needs key)" and opens the settings tab instead of switching), the
     active one checked; pick calls `plugin.applyProvider`.
   - Voices: the ACTIVE provider's voices from the voice cache (resolve
     asynchronously BEFORE showing the menu if uncached, with the pill
     button showing a brief loading state; on fetch failure show the
     provider default), each `setChecked` on the current voice; pick
     calls `plugin.applyVoice`. Obsidian menus scroll natively for long
     voice lists (Edge has ~47); this is acceptable for v1.
3. Both menus honor listening-mode semantics not at all: they are UI
   chrome, clicks in them never seek. Opening a menu does not pause
   playback; a voice/provider pick lands in the existing
   reconfigure-in-place path (paused, primed, per 0003).
4. The pill's PlayerPill class stays pure DOM and Obsidian-free: it only
   gains the notion that speed/voice clicks are delegated to callbacks
   (already true) plus an optional transient loading state on the voice
   control (`setVoiceLoading(on)`). The Menu construction lives in
   main.ts (or a small `src/shell/pill-menus.ts` if main.ts would grow
   past ~300 lines; prefer the separate module).

## Out of scope

Search/filter inside the voice menu, voice preview ("hear a sample"),
per-note speed, moving the listening toggle into a menu (it stays a
one-click ear: mode toggles must never hide behind menus).

## Test-first requirements

- pill-menus logic that is pure: menu MODEL builders, unit-tested:
  `speedMenuModel(currentSpeed)` returns items with titles, checked
  flags, and the action payloads; `voiceMenuModel(providers, activeId,
  voices, currentVoice, hasKey)` returns the two sections with checked
  flags and disabled/needs-key markers. The Obsidian Menu is then a thin
  renderer over these models (untested shell, exercised in-app).
- PlayerPill: setVoiceLoading toggles a class and disables the button
  (happy-dom test).

## Acceptance (in-app checks appended)

16. Clicking the pill's speed control opens a menu (a `.menu` element
    appears in the DOM) whose checked item matches settings.speed;
    choosing a different preset updates settings.speed, the live audio
    rate, and the pill label, and the menu closes.
17. Clicking the pill's voice control opens a menu containing at least
    the active provider section and one voice item; choosing a different
    voice lands the session paused-primed (0003's contract) and the pill
    label updates.

Manual (Rishabh): the feel pass. Menus open snappily anchored at the
pill, look native in both themes, scroll comfortably through Edge's
voice list, and never seek the audio.

## Constraints

No em dashes. No vendored-file changes. Menus use Obsidian's `Menu` API
only (no custom popover framework). Keep the pill keyboard-focus-free.

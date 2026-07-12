# 0003: Control surface (settings, providers, speed, listening mode)

Status: building
Date: 2026-07-12
Depends on: 0001, 0002. The player bar's on-screen placement is a separate
taste decision (mockups with Rishabh); this spec is everything the player
bar will merely surface: the settings tab, provider and voice selection,
speed, key storage, listening mode, and mid-session reconfiguration.

## Goal

The plugin becomes configurable without touching code: pick a provider and
voice, set speed, store a premium key safely, and decide whether clicks
seek. Settings changes during playback follow the parent repo's proven
reconfigure-in-place contract instead of restarting from the top.

## In scope

1. Settings model, persisted via plugin `saveData`/`loadData` (data.json):
   `{ providerId, voiceByProvider: Record<string,string>, speed,
   listeningMode }`. Defaults: edge, per-provider default voice, 1.0, true.
   Per-provider voice memory: switching provider away and back restores
   that provider's last voice (parent-repo behavior).
2. API keys NEVER enter data.json (hard rule: a synced vault must never
   carry a secret). A small key store wraps `localStorage`
   (`speaking-editor:key:<providerId>`), unit-tested behind an injectable
   storage interface. The settings description says keys are per-device.
3. Providers surfaced in this slice, built from the vendored adapters:
   Edge TTS (free, exact timing, default), macOS say (offline fallback,
   estimated timing), ElevenLabs (premium, requires key). Use the vendored
   `provider-catalog` for platform filtering and construction; read its
   API and the adapters (`say.ts`, `elevenlabs.ts`) before wiring, and pass
   the key from the key store at construction/synthesis per the adapter's
   actual contract. OpenAI and Sarvam adapters stay unsurfaced (later).
4. Settings tab (standard Obsidian `PluginSettingTab`):
   - Provider dropdown (only providers valid on this platform).
   - Voice dropdown for the active provider, populated async via
     `listVoices()` through the vendored voice cache (fallback lists are
     never cached, its existing rule). While loading, show the remembered
     value; on failure, fall back to the provider's default voice list.
   - Speed slider 0.5 to 3.0, step 0.1, live label.
   - Listening mode toggle ("clicking a word jumps playback there").
   - ElevenLabs key field (password-type input), stored via the key store,
     with a presence indicator and a clear button; never rendered back as
     plain text.
5. Listening mode enforcement: the click-to-seek handler seeks only when
   `listeningMode` is true; otherwise clicks edit as normal even during
   playback. Plus a command "Toggle listening mode" that flips the setting,
   persists it, and shows a brief Notice with the new state.
6. Live application of changes to an ACTIVE session:
   - Speed: applies immediately via the engine's `setSpeed` (no rebuild).
   - Provider or voice change: reconfigure-in-place. Capture the current
     word, dispose the old session's synthesis and audio, build a new
     session for the same editor, and prime it PAUSED at that word via the
     vendored `Engine.primeAt` (the parent's "surprise audio on switch is
     jarring" rule: never auto-play after a reconfigure). Implement by
     giving ReadingSession an optional `primeAtWord` so construction can
     prime-paused instead of starting playback.
   - No active session: changes simply apply to the next session.
7. Ribbon behavior unchanged. The acceptance harness gains checks 8 to 10
   below. Session constructor accepts `speed` so new sessions start at the
   configured rate.

## Out of scope (later specs)

The player bar itself (0004, after the mockup pick), Speechify adapter,
OpenAI/Sarvam surfacing, disk cache, per-note position memory, reading
mode, release pipeline. Also out: migrating settings shapes (v0 has no
users).

## Test-first requirements

Unit tests written before implementation:
- Settings model: defaults, merge of partial saved data, per-provider
  voice memory round trip.
- Key store: set/get/clear against an injected fake storage; keys never
  appear in the settings model object that goes to saveData.
- Provider wiring: given a catalog and a key store, the active provider is
  constructed with the right voice and key (fakes, no network).

## Acceptance (in-app checks appended to the existing harness)

8. Speed change during playback changes the live audio playbackRate within
   500ms without a session restart (same session object).
9. With listening mode OFF, the synthetic click from check 4's mechanism
   does NOT move the current word; turned ON, it does. (Drive the real
   click path, not the session API directly.)
10. Voice change during playback lands in state "paused" primed at the
    captured word (allow the same-sentence start word), and a subsequent
    play resumes from there with the new voice.

Manual (Rishabh): open Settings -> Speaking Editor; switch voice while a
note reads (it should pause primed, not blast on); drag speed while
playing; flip listening mode and feel clicks change meaning; paste a dummy
ElevenLabs key and confirm data.json never contains it (the check is
`grep -c` on the vault's plugin data.json).

## Constraints

No em dashes anywhere. Keys in localStorage only. Vendored files under
`src/engine/` and `src/playback/` stay untouched EXCEPT no exceptions are
expected here; if one seems required, stop and flag it. Settings tab copy
is plain language, no jargon.

# 0006: Audio disk cache and per-note resume

Status: built (222 tests; live checks 18-19 pending the final armed run)
Date: 2026-07-12
Depends on: 0003. Two inherited behaviors finally wired: an unchanged
paragraph is never paid for twice, and a note remembers where you left
off.

## Goal

Synthesized audio persists on disk OUTSIDE the vault with a size cap and
LRU eviction (the vendored DiskCache does all of this already; this spec
is the wiring and the location decision), and each note remembers its
reading position so play resumes where the listener left off.

## Part 1: disk cache

1. Location (per-device, never vault-synced, never inside any vault):
   macOS `~/Library/Caches/speaking-editor/`, otherwise
   `$XDG_CACHE_HOME/speaking-editor` falling back to
   `~/.cache/speaking-editor`. A small pure function
   `cacheDir(platform, env, home)` returns it (unit-tested).
2. Wiring: construct ONE vendored `DiskCache(dir, maxBytes)` in main.ts
   and pass it to every SynthesisService (session constructor gains an
   optional `cache`). The vendored service already does cache-through
   with `DiskCache.makeKey(chunk.text, providerId, voiceId)`; timings are
   stored with audio, so replays cost zero network.
3. Size cap: setting "Audio cache size" with choices 50 MB, 200 MB
   (default), 500 MB, 1 GB. Stored in settings; the DiskCache instance is
   rebuilt on change.
4. Settings tab addition (below the key field): show the resolved cache
   location as muted text, the size-cap dropdown, and a "Clear cache now"
   button that empties the directory (only files matching the cache's
   own `*.bin`/`*.json` naming) and shows a Notice with how much was
   freed. Copy in plain language: "Audio you have already listened to is
   kept so replaying is instant and free. It never lives inside your
   vault."

## Part 2: per-note resume

1. Position record: `{ wordIndex, ts }` per note path, kept in data.json
   under `positions` (positions are not secrets, and syncing them across
   devices is a feature). Entries expire after 12 hours (parent-repo
   rule) and the map is capped at 200 notes, oldest dropped.
2. Persistence cadence: update the in-memory position on every
   sentence-start position change; write through to data.json throttled
   (at most every 5 seconds, plus once on session end/stop/dispose and
   plugin unload).
3. Resume behavior (calm, no dialogs): pressing play on a note with a
   fresh (<12h) position starts from the START OF THE SENTENCE containing
   the saved word, and shows a one-line Notice "Resumed where you left
   off". A new command "Read this note from the top" starts at word 0 and
   clears the note's saved position. Natural end of a note CLEARS its
   position (finished = nothing to resume).
4. Interaction with 0003's reconfigure: reconfigure-in-place already
   preserves the position by priming; resume storage is orthogonal (it
   observes the same position changes).

## Out of scope

Cross-note playlists, resume UI in the pill (the Notice is enough for
v1), cache statistics view, cache pre-warming.

## Test-first requirements

- `cacheDir` platform/env matrix.
- Position store pure logic (module `src/shell/positions.ts`): record,
  expiry at 12h, 200-entry cap dropping oldest, clear-on-finish,
  sentence-start resolution given a model (reuse DocumentModel fixtures).
- Throttle behavior with fake timers.

## Acceptance (in-app checks appended)

18. Playing the fixture twice with the same voice hits the disk cache on
    the second run: the second session reaches "playing" with its first
    chunk served without a provider network call (assert via a counting
    wrapper provider in the harness, or by verifying the cache dir
    gained files after run one and run two started faster than a network
    round trip; prefer the counting wrapper for determinism).
19. Stop mid-note, then play again: playback resumes at the sentence
    containing the stopped word (field().word lands there), and "Read
    this note from the top" then starts at word 0.

Manual (Rishabh): listen to half a note, stop, come back later, press
play (it resumes, one quiet Notice); Settings shows the cache location
and clearing it works.

## Constraints

No em dashes. No vendored-file changes (DiskCache is used as-is). The
cache directory must never resolve to a path inside ANY vault. Keys and
cache stay per-device; positions intentionally sync via data.json.

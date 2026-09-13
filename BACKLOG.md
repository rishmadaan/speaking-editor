# Backlog

The roadmap after v1. Everything here was discussed and deliberately deferred so v1 could ship a flawless core. Nothing is a commitment or a date; it is the ordered pool of what comes next. Promote an item to a numbered spec in `specs/` when it is picked up.

## Providers and voices

- **Kokoro local neural voices.** A true offline neural free tier with real word timestamps. Means bundling a model runtime and roughly an 80 MB download, so it is one adapter plus a model-download flow, not just an adapter.
- **Speechify adapter, plus the spike 3 premium round trip.** Speechify follows the same provider contract (list voices, synthesize with word marks). The ElevenLabs key already exists and the premium lane is wired, but the premium round trip (a real note synthesized with exact word marks, alignment held against the rendered text) has not yet been live-validated end to end; do that spike, then add the Speechify adapter against the free 50k-characters-per-month tier. Not a v1 blocker, since Edge already gives exact word timing with no key.
- **Surface the already-vendored OpenAI and Sarvam adapters.** Both exist in `src/engine/synthesis/` but are not offered in the picker yet. Surfacing each is a small shell change, judged by voice quality, timing support, and demand.
- **More providers** (Azure, Polly, Google), each judged by voice quality, timing support, and demand, through the one-adapter-file contract.

## Playback and export

- **MP3 export** of a note's synthesized audio. Proven demand in the existing TTS plugin user base.
- **Note-to-note playlist chaining** (notes as chapters), so a set of notes reads end to end.
- **Timing-fidelity upgrades for estimated-timing providers** (better interpolation for voices that lack true word marks, e.g. macOS `say`). The highlight loop itself and marker-clean highlighting already shipped in v1.

## Platform

- **Mobile support.** An Obsidian plugin does not automatically run on the phone: mobile Obsidian has no Node environment, and v1's Edge transport, disk cache, and `say` fallback all touch Node, which is why v1 ships desktop-only. The engine core is already mobile-safe pure TypeScript; the gate is rewriting the Edge transport on the native browser WebSocket and swapping the Node conveniences. Phone listening for study notes is the payoff.

## Reading fidelity and text rules

- **Reading view re-alignment for virtualized long notes.** Reading view can virtualize (unload) offscreen text in long notes, which v1 cannot align against, so v1 fails safe to no highlight rather than a wrong one (Live Preview is unaffected). A re-alignment pass that re-binds the surface as text scrolls into view would restore highlighting for long notes in Reading view.
- **Tables speech rules.** How table cells are read aloud (row by row, header context, skipping formatting) so tables sound sensible instead of like a run of pipes.
- **Multi-line `%%` comments.** v1 handles the single-line comment case; multi-line `%% ... %%` blocks spanning lines need their own skip rule so commented text is not read.

## UI

- **Option B: a minimal status-bar mode, offered as a setting.** The floating pill is v1's player; a compact status-bar control was the runner-up. Offer it as a setting for users who want the quietest possible surface.
- **Voice search and preview in the pill menu.** As voice lists grow, add a search filter and a short spoken preview so picking a voice from the pill is fast.
- **Cross-mode session continuity.** Today, flipping a note between Live Preview and Reading view ends the reading session by design. Continuity would keep the session alive across the flip, re-mounting the highlight surface for the new mode instead of stopping.

## Engine

- **Engine extraction.** Once the v1 APIs settle, extract the vendored engine (`src/engine/`, `src/playback/`) into a shared package under explicitly chosen compatible terms that both TalkToMeBaby and Speaking Editor can consume, closing the long-standing engine-extraction thread. Extraction later is cheap; coordination now would be expensive (see [VENDOR.md](VENDOR.md)).

## Further horizons (separate decisions, with lived data)

- **A VS Code chapter two:** the TalkToMeBaby custom-editor surface (an editable reader as the default markdown view, optionally served in a browser via code-server). Nothing in v1 blocks or presumes it.
- **Mounting the reader engine on other hosts** (for example a dashboard that renders notes for listening), which the engine/shell split keeps open.

## Launch work (tracked here, done outside these specs)

- The demo GIF that carries the whole pitch (README has the placeholder block).
- Beta channel via BRAT before the community-list review clears.
- The launch sequence: Obsidian forum Share and Showcase, Obsidian Discord, r/ObsidianMD, and a possible creator-grade launch video.
- A docs site (port the TalkToMeBaby netlify pattern) if design fidelity or a self-serve hub becomes the point.

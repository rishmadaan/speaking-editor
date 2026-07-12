# Vendored code

Vendored on 2026-07-12 from TalkToMeBaby (`~/labs/projects/talktomebaby`,
MIT, same author), per the reuse map of the same date
(`~/labs/projects/mycroft/outputs/speaking-editor-reuse-map-2026-07-12.html`).
Strategy: vendor now, extract later. Once Speaking Editor v1 ships and the
APIs settle, the engine gets extracted into a standalone MIT package that
both projects consume.

## What was vendored

- `src/engine/` <- `packages/engine/src/` (whole package: core document
  model, chunker, timing normalizer; provider layer with Edge TTS,
  ElevenLabs, OpenAI, Sarvam, macOS say adapters; synthesis service, voice
  cache, disk cache; CLI audio playback module; all tests). Verbatim.
- `src/playback/engine.ts` <- `packages/vscode-extension/src/webview/engine.ts`
  (the playback brain: chunk-chained playback, prefetch, sentence-restart
  resume, click-to-jump with deferred seek, prime-without-autoplay, speed
  control, position tick). Host-agnostic, tested against a fake audio device.
- `src/playback/engine.test.ts` <- its test suite.
- `reference/editor-sync.ts` <- `packages/vscode-extension/src/ui/editor-sync.ts`.
  VS Code-coupled, so it is NOT compiled or tested here; kept verbatim as the
  reference for the CodeMirror adaptation (its click-to-word logic with the
  nearest-next-word fallback is the contract the Obsidian shell reimplements).

## Mechanical changes made while vendoring

- `src/playback/engine.ts` and `engine.test.ts`: imports rewritten from
  `@talktomebaby/engine/core` to the relative `../engine/core`. No logic
  changes.

## Left behind, deliberately (per the reuse map)

The VS Code host-to-webview message protocol, the pause-and-prompt answer to
editing while reading, the CLI package, the vsce publishing docs, and the
docs-site nav pattern.

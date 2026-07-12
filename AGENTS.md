# AGENTS.md

Guidance for agents (Codex, Claude, Cursor) and humans working in this repo. This
file is **mirrored with `CLAUDE.md`**: change one, change the other in the same
commit.

## What this repo is

Speaking Editor is an Obsidian plugin that reads notes aloud inside the native
editor: press play and the note speaks in a natural voice while the current word
highlights and the view follows along; click a word (in listening mode) to jump the
reading there. It ships a free zero-key voice (Edge TTS) with an offline fallback
(macOS `say`) and a bring-your-own-key premium tier (ElevenLabs). Notes stay plain
markdown; the plugin never changes where they live.

For users: [`README.md`](README.md). Roadmap: [`BACKLOG.md`](BACKLOG.md).

## Engine / shell split (the core architecture)

The code splits in two, from the first commit:

- **`src/engine/`** is host-agnostic TypeScript: markdown text extraction, provider
  adapters (Edge, ElevenLabs, OpenAI, Sarvam, macOS say), word-timestamp
  normalization, chunking, audio disk cache, voice cache, playback state. It knows
  nothing about Obsidian. `src/playback/engine.ts` is the host-agnostic playback
  brain.
- **`src/shell/`** is the thin Obsidian layer: the CodeMirror sync field and
  highlight surfaces, the floating pill player, the settings tab, click-to-seek,
  session wiring. This is where Obsidian APIs are allowed.

Keep the boundary clean: Obsidian imports live only in the shell. The point is that
the hard part (the engine) travels unchanged to another host later.

## Vendored-file policy

The engine and playback brain were **vendored from TalkToMeBaby** (MIT, same author)
on 2026-07-12; see [`VENDOR.md`](VENDOR.md) for exactly what was copied and changed.
Strategy: vendor now, evolve freely in this repo, extract into a shared MIT package
once v1 APIs settle.

- `reference/editor-sync.ts` is VS Code-coupled reference only: **not compiled, not
  tested, do not import it.** It is the contract the shell reimplements for
  CodeMirror.
- The vendored engine may be edited here (it is ours), but record any non-trivial
  divergence in `VENDOR.md` so the eventual extraction is clean.

## Spec-driven loop

Every increment starts as a numbered spec in [`specs/`](specs/) (`NNNN-name.md`:
goal, scope, behavior, acceptance). See [`specs/README.md`](specs/README.md).

1. No implementation before its spec.
2. Pure logic is built test-first (vitest, red before green).
3. Editor-coupled behavior gets an in-app acceptance check (the spike pattern: a dev
   command drives a real Obsidian and writes a report), plus a manual checklist for
   what only eyes can judge.
4. A spec is Done only when its acceptance checks pass in the test vault and the
   checklist is walked. **The commit that closes a spec cites it.**

## Commands

```sh
node build.mjs                       # dev build -> dist/, installed into the test vault.
                                     #   Keeps the dev-only acceptance command (DEV_ACCEPTANCE).
node build.mjs --prod                # production build; strips the acceptance command/module.
npx vitest run                       # run the whole test suite.
npx tsc -p tsconfig.json --noEmit    # typecheck.
node scripts/bump-version.mjs 0.2.0  # bump manifest.json + versions.json + package.json together.
```

**Acceptance checks (in Obsidian).** A dev build (not `--prod`) registers a "Run
acceptance checks" command. It opens a fixture note, drives a real reading session,
runs the numbered checks for the shipped specs, and writes a report file to the test
vault root. It is gated behind the `DEV_ACCEPTANCE` esbuild define so it is genuinely
absent from `--prod` bundles.

## Verify gates (before calling a change done)

- `npx vitest run` is green.
- `npx tsc -p tsconfig.json --noEmit` is clean.
- `node build.mjs --prod` strips the dev-only acceptance harness: the acceptance
  command, its `runAcceptance` entrypoint, and the `acceptance.ts` module must be
  genuinely absent, so `grep -c "runAcceptance" dist/main.js` returns **0**. (A few
  dev-only helper method names and code comments containing "acceptance" remain by
  design, since the build preserves identifiers for readable output; a bare
  `grep -c "acceptance"` is therefore nonzero and is not the gate.)
- For editor-coupled work: the in-app acceptance checks pass in the test vault and
  the manual checklist is walked.

## Standing constraints

- **No em dashes** anywhere, including generated docs and copy. Use commas, hyphens,
  or rephrase.
- **API keys go in `localStorage`, never in `data.json`.** `data.json` is inside the
  vault and can sync; a synced vault must never carry a secret. Keys live under
  `speaking-editor:key:<provider>` via the `KeyStore`.
- **The audio cache lives outside the vault**, in a per-device cache directory (see
  `src/shell/cache-dir.ts`). Never write the cache into a vault.
- **No claims the code does not honor**, especially in the privacy and disclaimer
  docs. Verify each user-facing statement against the source.
- **US spelling**, plain language.
- Follow the vendored-file policy and the engine/shell boundary above.

## Release

On a version tag (`git tag 0.2.0 && git push origin 0.2.0`),
`.github/workflows/release.yml` runs the gates, builds `--prod`, and attaches
`dist/main.js`, `dist/manifest.json`, and `dist/styles.css` to a GitHub release. Bump
versions first with `scripts/bump-version.mjs`. Creating the GitHub repo, pushing,
and the community-list PR are deliberate human steps, not automated.

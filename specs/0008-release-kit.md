# 0008: Release kit (docs, legal, pipeline, repo hygiene)

Status: done (250 tests; docs lead-read; publish steps await Rishabh)
Date: 2026-07-12
Depends on: everything. The last v1 slice: the repo becomes releasable.
Nothing here publishes anything; creating the GitHub repo, pushing, and
the community-list PR are explicit Rishabh actions after review.

## Deliverables

1. README.md, written for two audiences at once (GitHub/Google and the
   Obsidian plugin reviewer), leading with the search terms people
   actually use: read aloud, text to speech, TTS, listen to your notes.
   Structure: one-line pitch, the listening-mode explanation in plain
   words (what a click means; Rishabh had to ask, so users will), feature
   list, voice tiers table (Edge free default / macOS say offline /
   ElevenLabs BYOK), quick start, settings guide including where keys and
   the audio cache live (and why not in the vault), the Edge TTS
   best-effort disclaimer summary, troubleshooting, attribution to
   TalkToMeBaby, license. A placeholder block marks where the demo GIF
   goes (the GIF itself is launch work, not this spec).
2. LICENSE (MIT, Rishabh Madaan), THIRD_PARTY_NOTICES.md (TalkToMeBaby
   attribution + msedge-tts + CodeMirror/Obsidian API notes, adapted from
   the parent repo's format), DISCLAIMER.md (port the parent's Edge TTS
   "unofficial and best effort" wording VERBATIM per the reuse map),
   PRIVACY.md (adapted honestly: keys in localStorage per-device, no
   OS keychain claims, cache location, what leaves the machine and when:
   note text goes to the selected TTS provider only on play).
3. BACKLOG.md seeded from the v1 scope doc's "V2 and beyond" section
   (Kokoro local voices, mobile via browser-WebSocket Edge transport, MP3
   export, playlist chaining, timing-fidelity upgrades, more providers,
   engine extraction, Speechify adapter + spike 3, option B minimal
   status-bar mode, voice search/preview in the pill menu, cross-mode
   session continuity, reading-mode alignment for exotic notes, tables
   speech rules).
4. Repo docs for agents and humans: CLAUDE.md + AGENTS.md (mirrored,
   short: what this repo is, engine/shell split, spec-driven loop from
   specs/README.md, commands, the standing constraints: no em dashes,
   keys in localStorage, cache outside vault, vendored-file policy,
   verify gates), COMMIT_CHECKLIST.md (gates + spec citation + path-
   limited commits).
5. Release pipeline: `.github/workflows/release.yml` that on a version
   tag builds `--prod`, verifies gates (vitest, tsc), and attaches
   main.js/manifest.json/styles.css to a GitHub release (the standard
   obsidian-plugin release shape); `versions.json` (manifest version ->
   minAppVersion); a `scripts/bump-version.mjs` that updates
   manifest.json + versions.json + package.json together. Manifest
   description gets its final SEO pass ("Read your notes aloud with
   word-perfect highlighting. Text to speech that follows along, free
   voices included.") within Obsidian's length norms.
6. Housekeeping: `node build.mjs --prod` output verified to exclude the
   acceptance command; .gitignore covers dist/ (built per release) BUT
   keep installing the dev build into the test vault as today.

## Out of scope

Actually creating the GitHub repo, pushing, BRAT beta channel setup, the
demo GIF, forum/Discord/Reddit launch posts, docs site. All follow-on
launch work with Rishabh in the loop.

## Test-first requirements

- bump-version script logic as a pure function (given three file
  contents and a new version, returns the three updated contents;
  rejects non-semver and version regressions).

## Acceptance

- All gates green; `node build.mjs --prod` bundle contains no acceptance
  strings; README renders clean (no em dashes, no broken links to repo
  files); every doc references only paths that exist.
- Lead review reads every document fully before commit (docs are
  outward-facing; the delegate drafts, the lead edits).

## Constraints

No em dashes anywhere, including all generated docs. No claims the code
does not honor (the privacy doc especially: verify each statement
against the source before writing it). British/US spelling consistent
(US). Plain language throughout.

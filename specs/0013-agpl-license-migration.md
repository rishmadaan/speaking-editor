# 0013: AGPL license migration

Status: done (335 tests, 31/31 in-app checks, manual menus, clean source rebuild)
Date: 2026-09-13
Depends on: 0008 (release kit)

## Goal

Release future versions of Speaking Editor under GNU AGPLv3, with clear
copyright provenance, permission to work with Obsidian, and complete license
and source materials for recipients. The user selected AGPLv3 during planning.
Implementation authorized on 2026-09-13 after review of this plan.

## Findings from the repository

- LICENSE, README.md, package.json, the root package-lock.json entry,
  DISCLAIMER.md, and THIRD_PARTY_NOTICES.md currently identify the project as MIT.
- Local tag v0.1.0 contains the MIT license. Preserve that historical release.
- Local history lists one author identity, Rishabh Madaan. This is evidence,
  not proof of exclusive copyright ownership or the absence of outside code.
- VENDOR.md records MIT code copied from TalkToMeBaby, including src/engine/,
  the playback brain and tests, and reference/editor-sync.ts.
- VENDOR.md, BACKLOG.md, THIRD_PARTY_NOTICES.md, AGENTS.md, and CLAUDE.md promise
  future extraction of an MIT engine. That promise needs a deliberate revision.
- The dependency notice lists MIT, ISC, and BSD-3-Clause runtime packages.
  Verify actual bundled inputs and upstream notices before relying on this list.
- build.mjs externalizes Obsidian, Electron, and CodeMirror. Externalization
  alone does not establish copyleft compatibility with the proprietary host.
- The release workflow uploads main.js, manifest.json, and styles.css only.
  Separate license documents are not currently copied by build.mjs.
- manifest.json is 0.1.0, while package.json is 0.0.1. Local tag v0.1.0 also
  uses a prefix the documented release procedure does not use.
- node_modules is absent. Tests and builds were not run for this planning pass.

## Adopted decisions

Proceed with AGPL-3.0-only, future first-party engine changes included, a narrow
Obsidian permission under section 7, and version 0.2.0. The existing owner has
authorized the migration. HEAD has one human author identity; contribution
trailers identify AI assistance. Retain prior MIT grants rather than claiming
exclusive ownership of third-party material. The remote has only v0.1.0.
The exception will permit combining with the official Obsidian host, without
waiving plugin source obligations or purporting to license Obsidian itself.
This is an implementation review, not an external legal opinion.

Use preserved main.js comments for installed legal notices. No editor behavior
or interactive UI is being added. Packaging acceptance will exercise the files
installed in the test vault; record any unavailable live-Obsidian check honestly.

The following rationale from planning is retained:

Production verification exposed surviving external imports from acceptance.ts
after its static import was tree-shaken. Move that import inside the existing
DEV_ACCEPTANCE command callback so the production build omits the module entirely.
The failing artifact verification is the regression check; preserve dev behavior.

The first Windows live run passed 30/31 checks, with three menu checks reserved
for manual coverage. Check 32 exposed a harness setup error: check 31 dispatched
a scroll event without moving the viewport, so returning to the current sentence
could correctly leave scrollTop unchanged. Move the fixture scroller one viewport
away, use a fixed 240px test viewport and 2x playback, and allow up to 60 seconds
for the subsequent automatic scroll. A follow-up diagnostic showed sentence 13
still fit inside the original viewport after 60 seconds. Restore fixture geometry
and user settings afterward. Preserve product behavior.

1. Use AGPL-3.0-only as the base license, matching the selected version exactly.
2. Cover first-party plugin code and future engine changes with AGPL. Retain
   inherited permissive notices and clearly identify their scope. Do not
   silently keep licensing new engine work under MIT, which would allow that
   work to be reused independently without AGPL obligations.
3. Replace the unconditional MIT extraction promise with extraction under an
   explicitly chosen compatible license. Separately licensing owner-controlled
   code remains an option, but future contributions can change the rights needed.
   Do not change TalkToMeBaby's own repository or license in this increment.
4. Adopt LICENSE-EXCEPTION.md as a narrow additional permission for combining
   this plugin with Obsidian and distributing it for that purpose. Do not exempt arbitrary
   proprietary derivatives or waive source duties for plugin modifications.
5. Prepare version 0.2.0; the remote release check found only v0.1.0.
   Do not replace existing tags or imply that already granted MIT rights vanish.

GNU discusses proprietary-host plugin exceptions in its
[licensing FAQ](https://www.gnu.org/licenses/gpl-faq.en.html#GPLPluginsInNF).
Applying that guidance to this AGPL plugin is a proposed approach requiring
review, not a conclusion that an exception is automatically necessary or sufficient.

## Scope and behavior

The migration changes licensing, notices, contributor guidance, and release
packaging. Reading, voices, settings, storage, and editor behavior stay as they
are unless a reviewed legal-notice requirement calls for a small UI addition.

AGPL section 13 requires modified versions supporting remote interaction to
offer their corresponding source to those remote users. A local plugin sending
requests to a separate TTS provider does not, by that fact alone, make the provider
AGPL software. Notes and generated audio are not automatically relicensed.
Commercial use remains permitted. See the
[AGPL text](https://www.gnu.org/licenses/agpl-3.0.html), especially sections 0,
6, 7, and 13. These explanations must remain qualified and accurate in user copy.

## Implementation sequence

### 1. Resolve rights and scope

- Inspect all relevant authors, contribution trailers, copied files, and the
  recorded upstream revision. Confirm authority over original code and any
  proposed additional permission; retain third-party grants and attribution.
- Check remote tags/releases read-only and record the last MIT release and
  first intended AGPL release. Existing MIT copies retain their MIT permissions.
- Review bundled dependency license files and copyrights, using the lockfile
  plus esbuild's actual inputs. Inventory fonts, images, fixtures, and reference
  code too. Do not label dev-only dependencies as bundled without evidence.
- Check current Obsidian developer terms and directory policies. Obtain focused
  legal review if the host exception or ownership remains unresolved.
- Finalize only/or-later, engine scope, and exception text in this spec before
  implementation. No blanket contributor consent is needed merely to combine
  compatible MIT code, but MIT notices must remain where applicable.

### 2. Update license declarations and documentation

| File or area | Planned change |
|---|---|
| LICENSE | Exact, unmodified official AGPLv3 text. Keep project copyright in notices rather than replacing the FSF's copyright on the license document. |
| LICENSE-EXCEPTION.md, if adopted | Reviewed Obsidian additional permission, its scope, and its relationship to AGPL. |
| package.json and root package-lock.json metadata | Matching license declaration. Use AGPL-3.0-only when no exception is adopted; with a custom exception, use an accurate package declaration such as SEE LICENSE IN LICENSE-NOTICE.md and explain both documents there. Do not invent a registered SPDX exception identifier. |
| LICENSE-NOTICE.md | Project copyright, license version, exception reference if applicable, license scope, and release transition. |
| First-party TypeScript, JavaScript, CSS, and build scripts | Appropriate copyright and license notices, with exception references where applicable. Preserve inherited notices; use a path mapping for files that cannot contain comments. |
| README.md | AGPL license section, source access, first affected release, and concise redistribution/network-use explanation. |
| THIRD_PARTY_NOTICES.md | Updated project license; verbatim upstream license texts and actual copyright notices for shipped code, including TalkToMeBaby and reference material. |
| DISCLAIMER.md | Replace MIT reference; remove or rewrite acceptance/indemnity wording that could impose extra restrictions on AGPL rights. Keep provider information distinct from software-license conditions. |
| VENDOR.md and BACKLOG.md | Preserve MIT origin as historical fact; document current scope and revise the future extraction promise. |
| AGENTS.md and CLAUDE.md | Identical updates reflecting license boundaries and future contribution rules. |
| CONTRIBUTING.md | Short contribution-license statement consistent with AGPL and any host permission; no automatic copyright assignment or speculative CLA system. |
| COMMIT_CHECKLIST.md | Release license/source verification where needed. |

Keep historical specs, especially 0008, intact as historical records. Add a
supersession reference if useful. Search remaining MIT references contextually;
dependency licenses and provenance must not be globally replaced.

Follow [GNU's application guidance](https://www.gnu.org/licenses/gpl-howto.en.html)
for copyright notices, clear license-version declarations, and license copies.
Preserve official legal text verbatim. If its typography conflicts with the
repo's no-em-dash rule, record a narrow verbatim-legal-text exception in both
mirrored instruction files rather than editing the license.

### 3. Make distributed artifacts complete

- Update build.mjs to copy the license, project notice, any exception, and
  third-party notices into dist/ and the development install as appropriate.
- Preserve license material in the installed plugin: the community updater
  fetches the three standard plugin assets, so extra GitHub attachments alone
  are insufficient. Prefer embedding full legal texts and a version-specific
  source pointer in a preserved main.js comment, without a new UI feature.
- Review whether an interactive legal-notice surface is required. If it is,
  add a compact settings notice and extend the real-Obsidian acceptance check
  and manual checklist. Do not make an acceptance dialog a condition of use.
- Keep the three standard release assets. Also attach legal files and a
  corresponding-source archive for the exact release.
- Include preferred source, build scripts, configuration, lockfile, relevant
  interface definitions, and source for bundled runtime dependencies in that
  archive. Exclude secrets, local settings, audio caches, and personal vault data.
  Do not assume a repository archive or a lockfile alone includes dependency source.
- Link the exact source archive next to binary downloads in release notes;
  keep source available while distributing that release. Include rebuild
  instructions and verify the archive independently from the working tree.

AGPL's source-distribution terms are in
[section 6](https://www.gnu.org/licenses/agpl-3.0.html#section6).
Obsidian requires a declared license and compliance with upstream licenses in its
[developer policies](https://docs.obsidian.md/community-directory/developer-policies).

### 4. Verify and prepare the release

- Install locked dependencies with npm ci, then run npx vitest run,
  npx tsc -p tsconfig.json --noEmit, and node build.mjs --prod.
- Confirm runAcceptance and the acceptance module are absent from production.
- Inspect output legal notices and source links using the three-file install
  path as well as the complete release download.
- Verify first-party declarations, package metadata, notices, and chosen
  exception agree. Confirm retained dependency attribution is accurate.
- Verify AGENTS.md and CLAUDE.md remain identical and new prose has no em dashes.
- Perform a clean rebuild from the proposed source archive. A byte-for-byte
  reproducible build is not a new requirement, but the archive must be sufficient.
- Add tests only for new pure packaging logic, red before green. Prefer direct
  artifact checks for copy operations and notice presence.
- Walk the test-vault acceptance/checklist required by repository policy before
  marking this spec done. If there is UI work, include its dedicated checks.
- Bump with scripts/bump-version.mjs, synchronize root lockfile version metadata,
  and verify package/manifest/tag alignment without rewriting historical tags.
- Prepare a commit citing specs/0013 and release notes announcing the license
  transition, source location, and any Obsidian exception.
- Tagging, pushing, publishing, and community-directory changes remain human
  release actions under this repository's policy.

## Acceptance checklist

- [x] Rights, license version, engine scope, and host permission are resolved.
- [x] Current declarations consistently describe the adopted AGPL terms.
- [x] Historical MIT grants and upstream notices are retained accurately.
- [x] No disclaimer adds incompatible conditions to AGPL permissions.
- [x] A three-file plugin install retains required legal material.
- [x] Release packaging provides corresponding source for its exact artifacts.
- [x] Source archive rebuild, tests, typecheck, and production-strip gate pass.
- [x] Required test-vault acceptance and manual review are recorded.
- [x] Release versions agree and existing tags are unchanged.
- [x] Closing commit cites this spec; publication is handled separately.

## Implementation results

- LICENSE matches the SPDX AGPL-3.0-only text byte for byte. SHA-256:
  d8a6cc31abc16b6748c7a21f21611f5a1ec33f67d22ca23d7da1c19b95496bee.
- First-party license headers, package metadata, documentation, contributor
  terms, and engine extraction guidance now agree. The MIT reference file and
  upstream grants remain intact. No runtime engine logic changed.
- Removed the disclaimer's broad indemnity and acceptance conditions; it is
  explicitly informational and does not add restrictions to the software grant.
- Exact upstream notices cover 39 locked runtime packages. esbuild identifies
  32 direct package roots; the wider inventory also covers inlined and omitted
  transitive packages. Obsidian's API type definitions are correctly identified
  as MIT, distinct from the proprietary host.
- Four pinned, checksummed source archives supplement npm's missing original
  source/build files: msedge-tts, agent-base, https-proxy-agent, and axios.
- Build embeds complete legal texts and the version-specific source URL in
  main.js. The release workflow verifies versions, publishes source beside the
  three plugin files, and requires a clean archive rebuild.
- New packaging tests were red before implementation, then passed. The initial
  full suite and clean-archive rebuild passed all 335 tests and typechecking.
- Production verification initially caught acceptance.ts's surviving external
  imports. The guarded dynamic import removes the entire module from production;
  dev command registration and execution were verified in real Obsidian.
- Final live run: ALL PASS, 31/31 automated checks on Windows, Obsidian 1.13.7,
  Electron 39.8.3. Report: spikes/test-vault/skeleton-acceptance.md.
- Walked all three menu checks with real Windows input. Speed opened a menu
  without cycling; selecting 1.5x closed it and set both the label and live
  audioPlaybackRates to 1.5. The voice menu showed providers and free voices;
  selecting en-GB-SoniaNeural updated the label, closed the menu, and left the
  session paused. Play resumed with the chosen voice.
- Visually checked word/sentence highlights, player placement and controls,
  and cleanup after stop. No new UI was introduced by this migration.
- Final full suite: 335/335 passed, typecheck clean, production build and legal
  verification passed. A fresh extraction repeated npm ci, all 335 tests,
  typecheck, build, and release verification successfully. The installed
  production plugin loaded as 0.2.0 and exposed only its four normal commands.
- Archive inspection found no vault state, .git metadata, or .env files.
  Test settings and generated note fixtures were restored to their initial
  contents. The two trailing spaces in bundled upstream XML template strings
  already existed in the tracked bundle and were preserved, not rewritten.
- No tag is created, no changes are pushed, and no release is published by this
  increment. Human release steps remain in docs/RELEASING.md.

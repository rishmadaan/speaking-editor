# 0014: License review fixes

Status: done
Date: 2026-09-13
Depends on: 0013 (AGPL license migration)

## Goal

Resolve both findings from the independent migration review before merging.

## Scope and behavior

- Restore TalkToMeBaby's historical MIT notice, including its original copyright,
  from upstream `4e32db7^:LICENSE`. The vendored section accidentally copied the
  later GPL license. Preserve the current plugin's AGPL terms and host permission.
- Accept LF and CRLF dependency notice headings in release verification while
  retaining exact package name and version checks.
- Rebuild the embedded notices, test-vault copies, and corresponding source.
  No editor behavior changes are needed.

## Acceptance

- [x] The vendored notice matches the historical MIT text verbatim.
- [x] Production build and release verification pass in a CRLF checkout.
- [x] A missing dependency notice still fails verification.
- [x] Full tests, typecheck, and production strip checks pass.
- [x] A fresh source archive extraction rebuilds and verifies successfully.
- [x] Independent review finds no remaining actionable issues.

## Regression evidence before fixes

The historical MIT text is absent from the vendored notice. A production build
from a fresh checkout with `core.autocrlf=true` succeeds, but release verification
fails with `Missing notice for node_modules/agent-base` at line 36.

## Results

- The historical notice matches upstream exactly; copied and embedded notices
  match it too. The independent reviewer confirmed executable bundle content
  did not change.
- All 335 tests, typecheck, production build, and release verification passed
  both locally and after a fresh source archive extraction with `npm ci`.
- A fresh CRLF checkout with its own `npm ci` installation built, verified, and
  packaged successfully. Changing the agent-base heading to an incorrect version
  still failed verification; restoring it returned the check to green.
- The independent reviewer found no remaining actionable issues. No editor code
  changed, so the in-app acceptance results in spec 0013 remain applicable.

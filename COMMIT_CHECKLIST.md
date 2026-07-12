# Commit checklist

Run through this before every commit. It is short on purpose.

## Gates (all must pass)

- [ ] `npx vitest run` is green (the whole suite).
- [ ] `npx tsc -p tsconfig.json --noEmit` is clean.
- [ ] If shell or engine code changed: `node build.mjs --prod` succeeds and the
      dev-only acceptance harness is stripped, so `grep -c "runAcceptance" dist/main.js`
      returns **0** (the acceptance command and its module must not ship). A bare
      `grep -c "acceptance"` stays nonzero by design: the build preserves identifiers
      for readable output, so dev-only helper method names and comments remain.
- [ ] For editor-coupled behavior: the in-app acceptance checks pass in the test
      vault and the manual checklist for the spec is walked.

## Content

- [ ] **No em dashes** anywhere in the diff (code, docs, copy). Grep the changed
      files for the em dash character (U+2014) and its HTML entity form.
- [ ] No secrets, no API keys, no private vault contents in the diff.
- [ ] API keys still go through the `KeyStore` (`localStorage`), never into
      `data.json`. The audio cache still resolves outside the vault.
- [ ] User-facing docs (README, PRIVACY, DISCLAIMER) make no claim the code does not
      honor.
- [ ] `CLAUDE.md` and `AGENTS.md` changed together if either changed.

## Spec citation

- [ ] If this commit closes or advances a spec, it **cites the spec** (e.g.
      "specs/0006") in the message, and the spec's status is updated.

## Path-limited commits

- [ ] Stage named paths, not `git add -A` / `git add .`, when untracked or unknown
      files are in the tree.
- [ ] Commit path-limited with the message first, then the separator and paths:
      `git commit -m "msg" -- <paths>`. An `-m` placed after `--` is parsed as a
      pathspec and the commit fails.
- [ ] Re-check `git status` right before committing so a concurrent change is not
      swept in.

# Specs

Spec-driven development, the repo's build discipline:

1. Every increment starts as a numbered spec here (`NNNN-name.md`): goal,
   scope, behavior, acceptance checks. No implementation before its spec.
2. Pure logic is built test-first against the spec (vitest, red before green).
3. Editor-coupled behavior gets executable acceptance checks that run inside
   a real Obsidian (the spike pattern: a check command writes a report file),
   plus a manual checklist for what only eyes can judge.
4. A spec is Done only when its acceptance checks pass in the test vault and
   the checklist is walked. The commit that closes a spec cites it.

Statuses: `draft` -> `building` -> `done` (or `dropped`, kept for the record).

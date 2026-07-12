# 0002: The Obsidian markdown dialect

Status: building
Date: 2026-07-12
Depends on: 0001 (walking skeleton). This is the flawless-versus-janky
battleground from the reuse map: the vendored parser handles standard
markdown but has zero Obsidian-flavor coverage, so today a wikilink is
spoken and highlighted WITH its brackets.

## Goal

The parser speaks what live preview renders, and only that. Every clean
character still carries a source offset (the offset ledger is the one
invariant that must never break: no synthetic characters may enter the
clean text, because word-run painting greedily rematches word text inside
each word's source bounding box and an unsourced character would make the
match fail).

## Where the work lives

`src/engine/core/document-model.ts` (vendored code now evolves; that was
always the strategy). Inline rules extend `cleanLineInto`; line rules
extend `getReadableLineStart` or its call site; block rules extend
`segmentBlocks`. New tests in `src/engine/core/obsidian-dialect.test.ts`
(keep the inherited test file untouched so vendor drift stays visible).

## Behavior (each with offset preservation)

1. Wikilinks. `[[Target]]` speaks "Target"; `[[Target|alias]]` speaks only
   "alias" (the target is invisible in live preview and is neither spoken
   nor painted); `[[Target#Heading]]` speaks "Target#Heading" as written
   minus brackets. An unclosed `[[` on the line stays literal (spoken as
   the characters that are visibly there).
2. Embeds. `![[anything]]` is skipped entirely, silently (images, notes,
   PDFs alike: announcing every embed is noise, decided here). Standard
   markdown images `![alt](url)` change from speak-alt to skipped too, for
   the same reason: live preview renders the image, not the alt text.
3. Callouts. On a quote line, a leading `[!type]` marker (with optional
   fold suffix `+` or `-`) is stripped along with trailing whitespace; the
   title after it is spoken as normal text. The type word itself is not
   spoken (injecting "Warning." would need synthetic characters; the
   title carries the meaning). Callout body lines are already quote lines
   and need no change.
4. Tags. An inline `#tag` speaks "tag" (hash stripped from clean text, so
   it is never painted; the tag word itself still highlights). A line
   consisting only of tags and whitespace is skipped entirely (scope doc
   rule: skip tag lines). Only valid Obsidian tag characters count
   (letters, digits, hyphen, underscore, slash, at least one non-digit).
   A `#` that does not start a valid tag (e.g. "issue #42") stays literal.
5. Highlight marks. `==highlighted text==` speaks the inner text, `==`
   never spoken or painted (add doubled `=` to the marker-skip logic;
   a single `=` stays literal).
6. Comments. `%%hidden%%` within a line is skipped entirely (invisible in
   preview). Multi-line `%%` blocks are OUT of scope (noted limit, rare).
7. Explicitly out of scope for this spec: tables (own spec; today they
   read with pipes, honestly janky), `~~~` fences and setext headings
   (pre-existing TODOs in the vendored parser), bare URLs, footnotes,
   math. Each stays exactly as it behaves today.

## Test-first requirements

Write the failing tests before touching the parser. Fixtures must cover:
each behavior above; a wikilink inside bold (`**[[X]]**`); an alias with
several words; adjacent wikilinks; a callout with title, without title,
with fold marker; tag lines vs inline tags vs non-tag hashes; highlights
spanning several words; comments mid-sentence.

Two invariants asserted across EVERY fixture word, reusing the shell's
own functions (import from `src/shell/word-runs.ts`):

- Ledger invariant: for every word, `cleanRuns(box, word.text, start)`
  returns non-empty runs and the concatenated painted slices equal the
  word text exactly (nothing invisible is ever painted).
- No-marker invariant: no painted slice contains `[[`, `]]`, `![`, `==`,
  `%%`, or a callout `[!` marker.

Also: the existing 98 tests must stay green untouched; any behavior change
they encode that this spec supersedes (the image-alt case) is adjusted in
the INHERITED test only if one exists for it, with a comment citing this
spec.

## Acceptance

- `npx vitest run` green, `npx tsc --noEmit` clean, `node build.mjs` clean.
- Manual (Rishabh, test vault): a fixture note with wikilinks, an embed,
  a callout, tags, and a highlight reads aloud naturally: no brackets
  spoken, no marker ever highlighted, embed silently skipped.

## Constraints

No em dashes anywhere. No changes outside `document-model.ts`, the new
test file, and (only if an inherited test encodes superseded image-alt
behavior) the minimal inherited-test adjustment. The offset ledger
invariant is non-negotiable.

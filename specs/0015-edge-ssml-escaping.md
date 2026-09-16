# 0015: Edge TTS escapes XML-special characters

Status: done (vitest red->green, guard mutation-tested; live on docs/fleet-context.md: 190KB audio, 74/75 words timed)
Date: 2026-09-16
Depends on: 0001. Driven by a live bug: Edge TTS failed on
`docs/fleet-context.md` in the Mycroft vault ("Stream closed before the
synthesis completed").

## Cause

msedge-tts wraps the text in SSML (XML) without escaping it. A chunk
containing `&` or `<` is malformed XML, so the Edge service closes the socket
with no audio. Verified live: `Context & Requirements.` fails,
`Context &amp; Requirements.` succeeds, `a < b.` fails.

Edge reports word boundaries in the escaped form (`&amp;`, `&lt;`, `&gt;`).

## Behavior

1. `EdgeProvider.synthesize` sends the chunk text with `&`, `<`, `>` escaped
   (`&amp;`, `&lt;`, `&gt;`). Quotes need no escaping in element content.
2. Word-boundary text is unescaped before timing alignment, so `&amp;` never
   prefix-matches a real word like "ample".
3. Nothing else changes: chunk text, word refs, and the cache key stay the
   unescaped note text.

## Acceptance

- vitest: the text handed to msedge-tts is escaped; a boundary `&amp;` is not
  matched to a following word starting with "amp". Both fail with the fix
  removed.
- Live: reading `docs/fleet-context.md` (contains `&`) in the Mycroft vault
  returns audio instead of an error.

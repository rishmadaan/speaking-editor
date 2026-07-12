# Spike 2 report

RESULT: ALL PASS (8/8)

- PASS: live-preview EditorView reachable. cm=true, sourceMode=false
- PASS: decorations paint only visible characters. 60 words, every painted slice === word text (bold/italic/code/link fixture)
- PASS: frame-synced highlight loop. 30 word advances, every one painted in the first frame after its boundary (0 late); avg wall lag 4.2ms, max 9.4ms (frame cadence)
- PASS: decoration state tracks position. state.word=29
- PASS: click maps to word index (seek contract). clicked word 10, expected 10 ("several"), coords=true
- PASS: insertion remaps downstream words. word 25 "span," 204->209 (+5), still paints "span,"; word 5 unmoved
- PASS: edit inside a word flags it dirty for reparse. word 8 dirty=true, neighbors clean; dirty word excluded from decoration
- PASS: deleting a word collapses it instead of leaving a stale range. word 30 "to" runs=0, dirty=true

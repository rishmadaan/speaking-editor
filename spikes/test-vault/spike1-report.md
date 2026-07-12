# Spike 1 report

RESULT: ALL PASS (6/6)

Environment: platform=darwin, node=20.18.1, electron=33.3.2, chrome=130.0.6723.191

- PASS: document model in Obsidian. 7 blocks, 7 sentences, 91 words, 1 chunk(s)
- PASS: frontmatter and code block skipped. frontmatterLeak=false codeLeak=false
- PASS: live voice list (network reached). 47 en voices (5 would mean fallback list)
- PASS: Edge synthesis in Obsidian. 191520 bytes mp3 in 1061ms for 502 chars
- PASS: word timings exact and sane. unit=ms, 91/91 words timed (100%), monotonic=true
  First timings: "The" 100..275ms, "Spike" 288..638ms, "Note" 650..913ms, "Speaking" 925..1400ms, "Editor" 1413..1775ms
- PASS: audio playback in renderer. metadata=true, duration=31.92s, position after 1.5s=1.43s

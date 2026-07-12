# Skeleton acceptance report

RESULT: ALL PASS (26/26, 3 skipped (manual-pass coverage))

Environment: platform=darwin, electron=33.3.2, chrome=130.0.6723.191

(Window was hidden when fired; waited for visibility.)

- PASS: play reaches playing and first word decoration appears within 6s. state=playing, word=0, engineState=playing
- PASS: painted slices equal word text (no syntax painted), first 15 words. 15 words, every painted slice === word text
- PASS: word advances are frame-synced and painted over a 10-word sample. 10 advances observed, monotonic=true, allPaintable=true (dispatch is synchronous in the rAF tick)
- PASS: synthetic click seeks playback to the clicked word within 1s. clicked=20 target=20 ("has"), current=21, coords=true
- PASS: pause freezes position; resume restarts from the sentence start. frozen=true (word stayed 21); resumed at 6, sentence-start=5
- PASS: insertion upstream shifts decorations and playback continues. probe word 10 93->99 (+6), state=playing
- PASS: stop clears all decorations and releases audio. words=0, word=-1, state=idle, frozen after 500ms=true
- PASS: speed change during playback reaches the live audio within 500ms (same session). playing=true, rates=[2], sameSession=true
- PASS: listening mode gates click-to-seek (off: no move, on: seeks to the clicked word). frozen=11, off stayed at 11, on reached 21, target=20 ("ordinary")
- PASS: voice change primes paused at the captured word; play resumes there with the new voice. captured=11 (sentence 2, start 10), primedPaused=true, resumedAt=11, newVoice=en-US-GuyNeural
- PASS: starting a session mounts exactly one pill in the editor; play reflects playing. started=true, pills=1, anchored=true, playGlyph=pause
- PASS: clicking the pill play control pauses then resumes, glyph tracking state. paused=true (glyph play), resumed=true (glyph pause)
- SKIP: clicking the speed control opens the preset menu without cycling in place (spec 0005). menus need real user input; models unit-tested, manual pass covers the click
- PASS: a user edit fades the pill then it restores to full opacity without a hover. faded=true, restored=true, opacity=0.998842
- PASS: the pill stop control removes the pill entirely; a fresh play mounts a new one. stopped=true, removedToZero=true, freshPills=1
- SKIP: clicking the speed control opens a menu and a preset pick applies (setting + live audio + label), then closes. menus need real user input; applySpeed itself is covered by check 8
- SKIP: clicking the voice control opens the provider+voice menu; a voice pick lands paused-primed and updates the label. menus need real user input; the reconfigure contract is covered by check 10
- PASS: second play of the same note+voice serves its first chunk from disk cache (zero synth calls). run1 synthCalls=1 (cached), run2 synthCalls=0 (0 expected), cacheDir=/var/folders/r4/kjtcv_pd6_l75qy1q8v225tc0000gn/T/se-acceptance-cache-es7qtk
- PASS: stop mid-note resumes at the stopped sentence; read-from-top restarts at word 0. stopped at word 6 (sentence 1); resumed at word 7 (sentence 1, start 6); from-top word=0
- PASS: reading mode: play reaches playing, alignment succeeds, and CSS.highlights paints the current word within 6s. rendered=true, state=playing, surface=range, wordRanges=1, sentenceRanges=6
- PASS: reading mode: a listening-mode click on a rendered word seeks playback there within 1s. frozen=1, target=4, dispatched=true, current=5
- PASS: reading mode all-or-nothing: an unalignable note still plays but registers no highlight ranges (surface none). injected=true, state=playing, word=1, surface=none, wordReg=false, sentReg=false
- PASS: play reports preparing with a breathing pill; both clear when playing arrives. preparing=true, pillPreparing=true, clearedOnPlaying=true, state=playing
- PASS: a provider failure shows a human notice with an action, never the raw exception. expected="The free Edge voice could not be reached.", shown=true, sentence=true, action=true, noRaw=true
- PASS: the first-jump hint shows at counter 0 and is suppressed at counter 3. shownAt0=true, suppressedAt3=true, counterAfterFirst=3
- PASS: the pill shows a remaining-time label during playback and the estimate shrinks as it reads. shown=true, label1="~1 min left" wordsLeft=105, label2="~1 min left" wordsLeft=97, shrank=true
- PASS: natural end lingers the highlight ~600ms then clears, and the pill fades out of the DOM. ended=true, present@300ms=true, cleared<=1200ms=true, pillRemoved=true
- PASS: three mid-word edits flip the edited badge on; a fresh session starts without it. picks=3, dirtyWords=3, badgeOn=true, freshHidden=true
- PASS: warm start writes chunk-0 cache on an idle switch, but not while a session is active. warmedIdle=true, noSession=true, noPill=true, sessionActive=true, blockedWhileActive=true, key1=1697a4446cfa7c8367519408

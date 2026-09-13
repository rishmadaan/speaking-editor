# Skeleton acceptance report

RESULT: ALL PASS (31/31, 3 skipped (manual-pass coverage))

Environment: platform=win32, electron=39.8.3, chrome=142.0.7444.265

- PASS: play reaches playing and first word decoration appears within 6s. state=playing, word=0, engineState=playing
- PASS: painted slices equal word text (no syntax painted), first 15 words. 15 words, every painted slice === word text
- PASS: word advances are frame-synced and painted over a 10-word sample. 10 advances observed, monotonic=true, allPaintable=true (dispatch is synchronous in the rAF tick)
- PASS: synthetic click seeks playback to the clicked word within 1s. clicked=20 target=20 ("has"), current=20, coords=true
- PASS: pause freezes position; resume restarts from the sentence start. frozen=true (word stayed 20); resumed at 6, sentence-start=5
- PASS: insertion upstream shifts decorations and playback continues. probe word 10 93->99 (+6), state=playing
- PASS: stop clears all decorations and releases audio. words=0, word=-1, state=idle, frozen after 500ms=true
- PASS: speed change during playback reaches the live audio within 500ms (same session). playing=true, rates=[2], sameSession=true
- PASS: listening mode gates click-to-seek (off: no move, on: seeks to the clicked word). frozen=0, off stayed at 0, on reached 20, target=20 ("ordinary")
- PASS: voice change primes paused at the captured word; play resumes there with the new voice. captured=2 (sentence 0, start 0), primedPaused=true, resumedAt=2, newVoice=en-US-GuyNeural
- PASS: starting a session mounts exactly one pill in the editor; play reflects playing. started=true, pills=1, anchored=true, playGlyph=pause
- PASS: clicking the pill play control pauses then resumes, glyph tracking state. paused=true (glyph play), resumed=true (glyph pause)
- SKIP: clicking the speed control opens the preset menu without cycling in place (spec 0005). menus need real user input; models unit-tested, manual pass covers the click
- PASS: a user edit fades the pill then it restores to full opacity without a hover. faded=true, restored=true, opacity=0.99548
- PASS: the pill stop control removes the pill entirely; a fresh play mounts a new one. stopped=true, removedToZero=true, freshPills=1
- SKIP: clicking the speed control opens a menu and a preset pick applies (setting + live audio + label), then closes. menus need real user input; applySpeed itself is covered by check 8
- SKIP: clicking the voice control opens the provider+voice menu; a voice pick lands paused-primed and updates the label. menus need real user input; the reconfigure contract is covered by check 10
- PASS: second play of the same note+voice serves its first chunk from disk cache (zero synth calls). run1 synthCalls=2 (cached), run2 synthCalls=0 (0 expected), cacheDir=C:\Users\rishabh\AppData\Local\Temp\se-acceptance-cache-wCDqAU
- PASS: stop mid-note resumes at the stopped sentence; read-from-top restarts at word 0. stopped at word 6 (sentence 1); resumed at word 7 (sentence 1, start 6); from-top word=0
- PASS: reading mode: play reaches playing, alignment succeeds, and CSS.highlights paints the current word within 6s. rendered=true, state=playing, surface=range, wordRanges=1, sentenceRanges=6
- PASS: reading mode: a listening-mode click on a rendered word seeks playback there within 1s. frozen=1, target=4, dispatched=true, current=4
- PASS: reading mode all-or-nothing: an unalignable note still plays but registers no highlight ranges (surface none). injected=true, state=playing, word=1, surface=none, wordReg=false, sentReg=false
- PASS: play reports preparing with a breathing pill; both clear when playing arrives. preparing=true, pillPreparing=true, clearedOnPlaying=true, state=playing
- PASS: a provider failure shows a human notice with an action, never the raw exception. expected="The free Edge voice could not be reached.", shown=true, sentence=true, action=true, noRaw=true
- PASS: the first-jump hint shows at counter 0 and is suppressed at counter 3. shownAt0=true, suppressedAt3=true, counterAfterFirst=3
- PASS: the pill shows a remaining-time label during playback and the estimate shrinks as it reads. shown=true, label1="~1 min left" wordsLeft=105, label2="~1 min left" wordsLeft=97, shrank=true
- PASS: natural end lingers the highlight ~600ms then clears, and the pill fades out of the DOM. ended=true, present@300ms=true, cleared<=1200ms=true, pillRemoved=true
- PASS: three mid-word edits flip the edited badge on; a fresh session starts without it. picks=3, dirtyWords=3, badgeOn=true, freshHidden=true
- PASS: warm start writes chunk-0 cache on an idle switch, but not while a session is active. warmedIdle=true, noSession=true, noPill=true, sessionActive=true, blockedWhileActive=true, key1=1697a4446cfa7c8367519408
- PASS: first play ever shows the one-time tip notice and flips the flag; second play stays quiet. tipShown=true, flagFlipped=true, tipOnSecondPlay=false
- PASS: spec 0012: a user scroll breaks following (chip shows) and stops auto-scroll on the next sentence change. started=true, broke=true, chipVisible=true, sentenceAdvanced=true, scrollFrozen=true (scrollTop stayed 240)
- PASS: spec 0012: the return chip re-centres, hides, and following resumes (auto-scroll returns). chipHidden=true, followingResumed=true, recentred=true, autoScrollsAgain=true, state=playing, following=true, sentence=5, scrollTop=112
- PASS: spec 0012 fast start: split chunk 0 is under 700 chars and playback reaches playing with word 0 painted. chunk0Length=354 (<700 expected), reachedPlaying=true, sawWord0=true, word=0
- PASS: spec 0012 optimistic seek: a far-chunk click paints the word within 200ms (preparing), audio arrives there. paintedWithin200ms=true (9ms), stateAfterSeek=preparing, arrivedAtSentence=true, target word=8320 sentence=640, current word=8320

## Manual menu coverage for spec 0013 (2026-09-13)

- PASS: speed click opens the menu without cycling; picking 1.5x closes the menu and updates the label, setting, and live audio rate to 1.5.
- PASS: provider and voice menu opens with real input; selecting en-GB-SoniaNeural updates the label, closes the menu, and leaves playback paused.
- PASS: play resumes with the selected voice; highlights and player controls remain visible and correctly placed.

All three automated SKIP entries above have manual coverage. Test settings and generated fixtures were restored after verification.

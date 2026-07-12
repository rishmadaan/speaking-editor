# Speaking Editor: User Guide

Everything the plugin does, explained for a person using it. The
[README](../README.md) is the quick tour; this is the reference.

## The one-minute mental model

Speaking Editor gives your normal Obsidian editor a voice. You never leave
your note: press play, the note reads itself, the current word and sentence
highlight in place, and the view follows along. A small pill floats at the
bottom of the editor while reading; it is the whole control surface. One
switch (listening mode) decides what a click means: jump-the-voice-here, or
edit-as-usual.

## Starting and stopping

| You do | It does |
|---|---|
| Click the play ribbon icon (left sidebar) | Starts reading the active note, or pauses/resumes if already reading |
| Command palette: "Play or pause reading" | Same as the ribbon |
| Command palette: "Stop reading" | Ends the session, clears highlights, removes the pill |
| Command palette: "Read this note from the top" | Forgets your saved spot in this note and starts over |
| Switch to another note and press play | The old note stops, the new one starts |
| Flip a note between editing and reading view mid-listen | The session stops (a notice says so); press play to restart in the new view |

The first moments after play: the pill's button pulses gently while the
voice is being prepared (a couple of seconds on a note you have never
played; near-instant when it is cached or pre-warmed). If a note was
stopped partway within the last 12 hours, play resumes from the sentence
you were on and shows one quiet "Resumed where you left off" notice.

## The pill, left to right

1. **Play/pause**: mirrors the session; pulses while preparing.
2. **Speed** (e.g. "1.2x"): click for the preset menu (0.8x to 3x); a
   pick applies to the live audio instantly. "Fine-tune in settings"
   opens the settings tab for exact values.
3. **Voice name**: click for the voice menu: switch provider (Edge free,
   macOS say offline, ElevenLabs with your key) or pick any voice of the
   active provider. Changing voice mid-listen pauses primed at your
   current word: press play and the new voice continues from there. It
   never blasts audio at you on a switch.
4. **~N min left**: how much listening remains at your current speed.
   Appears once the voice has produced enough audio to estimate from.
5. **The ear ("listening")**: the listening-mode toggle. Accent-colored
   when on, dim when off.
6. **X**: stop.

The pill's manners: it fades while you type and returns when you pause or
hover it; it never moves, never resizes, and never steals your keyboard
focus.

## Listening mode, precisely

- **On** (default): while a note reads, clicking a word jumps the voice
  there. Your first few jumps show a small hint so the behavior is never
  a surprise.
- **Off**: clicks place your cursor and edit as normal; the voice keeps
  reading. Toggle from the pill's ear, the settings tab, or the "Toggle
  listening mode" command.

## Editing while it reads

Type freely: highlights shift with your edits and never break. If you
edit inside words the voice has not reached yet, those words go
un-highlighted and a dim "edited" badge appears on the pill: the voice is
finishing the text it started from. Stop and play to re-read your new
text. (Live re-reading of edits is on the roadmap.)

## Reading view (rendered preview)

Play, pause, click-to-jump, and the karaoke all work on the rendered
note. One honesty rule: if the rendered text cannot be matched perfectly
to the note (some embeds; very long notes that Obsidian renders lazily),
you get audio with NO highlight rather than a wrong highlight.

## Voices and keys

| Provider | Cost | Timing | Notes |
|---|---|---|---|
| Edge TTS (default) | Free, no key | Exact per word | Needs internet; unofficial and best effort (see [DISCLAIMER](../DISCLAIMER.md)) |
| macOS say | Free, offline | Estimated | Nothing leaves your machine; macOS only |
| ElevenLabs | Your API key | Exact per word | Key stays on this device (localStorage), never in your vault |

If the free voice ever fails mid-read, the error notice says so in plain
words and offers one tap to switch to the offline voice and continue from
the same word.

## What is stored where

- **Audio cache**: outside your vault (`~/Library/Caches/speaking-editor`
  on macOS), size-capped in settings, clearable anytime. Cached notes
  replay instantly and cost no API credits. Once you have played anything
  in a session, opening a note quietly pre-warms its opening audio (free
  Edge voice only, never your paid key).
- **Reading positions**: in the plugin's `data.json` (they sync with your
  vault on purpose; positions are not secrets). Expire after 12 hours.
- **API keys**: this device's `localStorage` only. Never `data.json`,
  never synced, never shown back as text.
- Full data-flow detail: [PRIVACY](../PRIVACY.md).

## Suggested setup for heavy listeners

1. Assign a hotkey to "Play or pause reading" (Settings -> Hotkeys).
2. Set your cruising speed once; the pill's menu is for moments.
3. Leave listening mode on when consuming, off when writing; the ear is
   one click.
4. Raise the cache size (Settings) if you relisten to long notes often.

## FAQ

**Why is the first play of a new note slow?** The voice is synthesized in
chunks over the network; later chunks prefetch while you listen, and
everything replays instantly from cache afterward.

**Why did the voice keep reading my old text after I rewrote a
paragraph?** The audio for that stretch was already made from the old
text. The "edited" badge marks this state; stop and play re-reads.

**Why no highlight on this long note in reading view?** Obsidian unloads
off-screen parts of long rendered notes, so a perfect match is not
possible; the plugin refuses to guess. Live Preview highlights fully.

**Does it work on mobile?** Not yet; the current transports need desktop.
It is on the [roadmap](../BACKLOG.md).

**Where do bugs go?** GitHub issues, once the repo is public; until then,
tell the author.

// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// One reading session: owns the parsed model, chunks, synthesis, the vendored
// playback Engine, the rAF loop, and the audio elements. It seeds a highlight
// SURFACE with word entries, drives the current-word paint frame-by-frame through
// that surface, and tears everything down cleanly. The frame-synced property lives
// here: the rAF loop calls engine.tick() every frame; tick detects the boundary
// and calls onPosition, which repaints in that same frame. The surface is
// pluggable: live preview paints through CmSurface (the CM6 sync field), reading
// mode through RangeSurface (the CSS Custom Highlight API); the session never
// learns which mode it is in.
import { EditorView } from "@codemirror/view";
import { parseDocument, buildChunks, DocumentModel, Chunk } from "../engine/core";
import { SynthesisService } from "../engine/synthesis/synthesis-service";
import { EdgeProvider } from "../engine/synthesis/edge";
import { TtsProvider, ChunkAudio } from "../engine/synthesis/provider";
import { Engine, EngineCallbacks, AudioLike } from "../playback/engine";
import { buildWordEntries, WordEntry } from "./word-runs";
import { HighlightSurface, CmSurface } from "./highlight-surface";
import { splitFirstChunk } from "./chunk-split";

// How long the final word's highlight lingers after a natural end before the
// surface clears, so the ending breathes instead of snapping (spec 0010 point 2).
const ENDED_LINGER_MS = 600;

// "preparing" is a shell-derived state (the vendored engine never emits it): a
// playback request has been made (start / resume with an unloaded chunk / seek to
// an unloaded chunk) but the first audio has not started yet. The session enters
// it on the request and leaves it when the engine reports "playing" (audio
// started), the user pauses ("pause during preparing -> paused"), synthesis fails
// ("error"), or the note ends. A prime-paused construction rests at "paused", not
// "preparing", because no play was requested.
export type SessionState = "idle" | "preparing" | "playing" | "paused" | "ended" | "error";

// The subset of the vendored DiskCache the session needs. Kept structural so a
// DiskCache instance drops in without the session importing the disk module.
export interface CacheLike {
  get(key: string): Promise<ChunkAudio | undefined>;
  set(key: string, value: ChunkAudio): Promise<void>;
}

export interface ReadingSessionOptions {
  docText: string;
  uri: string;
  // The editor view. Required when no surface is supplied (the session builds the
  // default CmSurface from it); optional when an explicit surface is given (e.g.
  // a RangeSurface for reading mode, or a fake surface in a node test).
  view?: EditorView;
  // The highlight surface. Defaults to a CmSurface over `view` (live preview) when
  // omitted, so the existing construction path is unchanged.
  surface?: HighlightSurface;
  onState: (state: SessionState, message?: string) => void;
  // Synthesis provider instance; defaults to Edge (our default) when omitted.
  provider?: TtsProvider;
  // Voice id for that provider; defaults to the provider's own default voice.
  voice?: string;
  // Initial playback rate; defaults to 1.
  speed?: number;
  // When set, construction primes PAUSED at this word (via Engine.primeAt)
  // instead of starting playback, so a later play resumes exactly there.
  primeAtWord?: number;
  // Optional disk cache shared across sessions: synthesized audio persists so an
  // unchanged paragraph is never paid for twice. Omit for no caching.
  cache?: CacheLike;
  // Called with the current word each time the reading crosses into a NEW
  // sentence (sentence-granularity position reporting), so the shell can persist
  // where the listener is for later resume. The natural end of a note is exposed
  // via onState("ended"), which the shell uses to clear the saved position.
  onPositionSaved?: (wordIndex: number) => void;
}

export class ReadingSession {
  private model: DocumentModel;
  private chunks: Chunk[];
  private entries: WordEntry[];
  private synthesis: SynthesisService;
  private engine: Engine;
  private surface: HighlightSurface;
  private onStateCb: (state: SessionState, message?: string) => void;
  private onPositionSaved?: (wordIndex: number) => void;
  // The last sentence we reported a position for, so we notify the shell only on
  // a genuine sentence change, not on every word advance.
  private lastReportedSentence = -1;
  // The last word/sentence the surface was told to paint, for observability (the
  // reading-mode acceptance checks read these; there is no sync field to inspect).
  private _currentWord = -1;
  private _currentSentence = -1;

  // Chunk timings harvested shell-side, keyed by chunk index (the vendored Engine
  // owns loaded chunks and must not be touched, so we harvest every ChunkAudio in
  // the requestChunk resolution path). Only ms-unit timings carry real durations
  // shell-side; fraction-unit timings need the audio duration the engine holds, so
  // they are skipped. spanMs is the last word's end minus the first word's start.
  private chunkTimings = new Map<number, { spanMs: number; wordCount: number }>();
  // The pending natural-end linger, if any: a delayed surface.clear() that a new
  // request (enterPreparing) or teardown cancels.
  private endedLingerTimer: ReturnType<typeof setTimeout> | null = null;

  private rafId: number | null = null;
  private _state: SessionState = "idle";
  private active = false; // between a play/resume/seek and teardown/ended
  private disposed = false;
  // Handles to the audio elements the engine created through us, so the
  // acceptance harness can observe the live playbackRate (check 8).
  private createdAudios: AudioLike[] = [];

  constructor(opts: ReadingSessionOptions) {
    this.onStateCb = opts.onState;
    this.onPositionSaved = opts.onPositionSaved;
    // Default the surface to the CM6 live-preview path; require a view for that.
    if (opts.surface) {
      this.surface = opts.surface;
    } else if (opts.view) {
      this.surface = new CmSurface(opts.view);
    } else {
      throw new Error("ReadingSession needs a surface or a view to build one");
    }
    this.model = parseDocument(opts.docText, opts.uri, 1);
    // Fast start (spec 0012 Part 2): split an oversized chunk 0 so first audio
    // arrives in a fraction of the time on a cold big note. A pure wrapper over
    // buildChunks; word refs and offsets are preserved so the engine is unaffected.
    this.chunks = splitFirstChunk(buildChunks(this.model), this.model);
    this.entries = buildWordEntries(this.model, opts.docText);
    // The shared disk cache (when provided) lets the service serve a replayed
    // chunk from disk with zero network; it still de-dupes in-flight requests.
    const provider = opts.provider ?? new EdgeProvider();
    const voice = opts.voice ?? provider.defaultVoice;
    this.synthesis = new SynthesisService(provider, voice, opts.cache);

    const cb: EngineCallbacks = {
      requestChunk: (i, priority) => this.requestChunk(i, priority),
      onPosition: (word, sentence) => this.onPosition(word, sentence),
      onState: (s) => this.handleEngineState(s),
      createAudio: () => {
        const a = new Audio() as unknown as AudioLike;
        this.createdAudios.push(a);
        return a;
      },
      makeUrl: (bytes, format) =>
        URL.createObjectURL(
          new Blob([bytes.slice().buffer as ArrayBuffer], {
            type: format === "mp3" ? "audio/mpeg" : "audio/wav",
          })
        ),
      revokeUrl: (url) => URL.revokeObjectURL(url),
    };
    this.engine = new Engine(this.model, this.chunks, cb);
    if (opts.speed != null) this.engine.setSpeed(opts.speed);

    // seed the surface so a position can paint the moment it arrives
    this.surface.seed(this.entries);

    // A reconfigure (provider/voice change) primes the new session PAUSED at the
    // word the listener was on, so a later play resumes there instead of blasting
    // audio on switch. Construction primes; it never auto-plays.
    if (opts.primeAtWord != null) this.engine.primeAt(opts.primeAtWord);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  playPause() {
    if (this.disposed) return;
    // A press while playing OR while preparing pauses: preparing shows the pause
    // affordance, so a press there cancels the pending start exactly like a pause
    // (engine.pause() sets playing=false, so a chunk that arrives later loads and
    // seeks but does not auto-play). No dead controls during the synthesis gap.
    if (this._state === "playing" || this._state === "preparing") {
      this.engine.pause();
      return;
    }
    if (this._state === "paused") {
      this.enterPreparing();
      this.engine.resume();
      this.startLoop();
      return;
    }
    if (this._state === "ended") {
      // replay: engine.start() no-ops on an already-loaded chunk (receiveChunk
      // ignores duplicates), so jump to the first word, which seeks and plays
      this.enterPreparing();
      this.engine.jumpToWord(0);
      this.startLoop();
      return;
    }
    // idle: start from the top
    this.enterPreparing();
    this.engine.start(0);
    this.startLoop();
  }

  stop() {
    if (this.disposed) return;
    this._state = "idle";
    this.teardown();
    this.onStateCb("idle");
  }

  seekToWord(wordIndex: number) {
    if (this.disposed) return;
    // The click is the new reading position: re-engage following (in place, no
    // scroll) and paint the clicked word IMMEDIATELY (spec 0012 Part 2 point 2),
    // even though audio for that chunk may still be synthesizing. The engine tick
    // corrects the position the moment real audio starts.
    this.surface.notifyJump?.();
    const sentence = this.entries[wordIndex]?.sentence ?? -1;
    if (wordIndex >= 0 && sentence >= 0) {
      this._currentWord = wordIndex;
      this._currentSentence = sentence;
      this.surface.onPosition(wordIndex, sentence);
    }
    // A seek requests playback: enter "preparing". If the target chunk is already
    // loaded the engine reports "playing" synchronously and overwrites it; if not,
    // we hold "preparing" until the chunk arrives and starts.
    this.enterPreparing();
    this.engine.jumpToWord(wordIndex);
    this.startLoop();
  }

  // Return-chip click: re-engage following and re-centre the current sentence.
  engageFollow() {
    if (this.disposed) return;
    this.surface.engageFollow?.();
  }

  // Whether the surface is currently following the reading (acceptance checks).
  get following(): boolean {
    return this.surface.following ?? true;
  }

  // Acceptance-only: the character length of the (possibly split) first chunk, so
  // check 33 can assert the fast-start split made chunk 0 small.
  get acceptanceChunk0Length(): number {
    return this.chunks[0]?.text.length ?? 0;
  }

  // Reading-mode click-to-seek: hand a viewport point to the surface, which maps
  // it to the nearest aligned word, and seek there. Returns true when a word was
  // hit and a seek was issued, false on a miss (so the shell knows whether to show
  // the first-jump hint). A no-op on surfaces that do not hit-test (live preview
  // does its own click handling on the editor).
  seekReading(x: number, y: number): boolean {
    if (this.disposed) return false;
    const w = this.surface.hitTest?.(x, y);
    if (w != null && w >= 0) {
      this.seekToWord(w);
      return true;
    }
    return false;
  }

  // Apply a new playback rate to the live audio without a rebuild. The caller
  // (main.ts) also persists the rate so future sessions start at it.
  setSpeed(rate: number) {
    if (this.disposed) return;
    this.engine.setSpeed(rate);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._state = "idle";
    this.teardown();
  }

  get state(): SessionState {
    return this._state;
  }

  // The remaining-time estimate the pill renders (spec 0010 point 1). msPerWord is
  // the word-count-weighted MEAN across every harvested (ms-unit) chunk; wordsLeft
  // is the model words remaining after the current word. Null when no timings have
  // been harvested yet, so the pill shows nothing rather than a wrong number. The
  // pure remainingLabel() divides by the current speed; the session does not.
  remainingEstimate(): { msPerWord: number; wordsLeft: number } | null {
    let totalSpan = 0;
    let totalWords = 0;
    for (const t of this.chunkTimings.values()) {
      totalSpan += t.spanMs;
      totalWords += t.wordCount;
    }
    if (totalWords <= 0) return null;
    const msPerWord = totalSpan / totalWords;
    const wordsLeft = Math.max(this.model.words.length - (this._currentWord + 1), 0);
    return { msPerWord, wordsLeft };
  }

  // The word/sentence currently painted. In reading mode there is no sync field
  // to read, so the acceptance checks and the reconfigure path read these.
  get currentWord(): number {
    return this._currentWord;
  }
  get currentSentence(): number {
    return this._currentSentence;
  }

  // Which surface is painting: "cm" (live preview), "range" (reading mode aligned),
  // or "none" (reading mode where alignment failed: playback with no highlight,
  // the all-or-nothing rule). Read by the acceptance checks.
  get highlightSurface(): "cm" | "range" | "none" {
    return this.surface.kind;
  }

  // Acceptance-only observability: the playbackRate every audio element the
  // engine created is currently set to (check 8 reads this to confirm a live
  // speed change reached the audio without a session restart).
  get audioPlaybackRates(): number[] {
    return this.createdAudios.map((a) => a.playbackRate);
  }

  // Acceptance-only observability: the viewport rect of a reading-mode word's
  // painted range, so check 21 can click a rendered word. Null off the range
  // surface or when the word has no range.
  acceptanceWordRect(word: number): DOMRect | null {
    return this.surface.acceptanceWordRect?.(word) ?? null;
  }

  // ─── Engine callbacks ────────────────────────────────────────────────────────

  private requestChunk(i: number, priority: boolean) {
    this.synthesis
      .request(this.chunks[i], priority)
      .then((a) => {
        if (this.disposed) return;
        // Harvest timings shell-side before handing the audio to the vendored
        // engine, so remainingEstimate() has data the moment a chunk lands.
        this.harvestTimings(i, a);
        this.engine.receiveChunk(i, a);
      })
      .catch((err) => {
        // aborts on teardown reject here too; only surface a real failure while active
        if (this.disposed || !this.active) return;
        this._state = "error";
        this.active = false;
        this.stopLoop();
        this.onStateCb("error", err instanceof Error ? err.message : String(err));
      });
  }

  // Record a chunk's ms-per-word span from its harvested audio. Only ms-unit
  // timings carry real durations shell-side; fraction-unit timings resolve to ms
  // inside the engine (from the audio duration), so they are skipped here. Keyed by
  // chunk index so a re-request overwrites rather than double-counts.
  private harvestTimings(index: number, audio: ChunkAudio) {
    const t = audio.timings;
    if (t.unit !== "ms") return;
    const words = t.words;
    if (words.length === 0) return;
    const span = words[words.length - 1].end - words[0].start;
    this.chunkTimings.set(index, { spanMs: Math.max(span, 0), wordCount: words.length });
  }

  private onPosition(word: number, sentence: number) {
    this._currentWord = word;
    this._currentSentence = sentence;
    // Sentence-granularity position report: only when the reading crosses into a
    // new sentence. At that instant `word` is that sentence's first word, so the
    // shell persists a clean sentence-start position for resume.
    if (sentence !== this.lastReportedSentence) {
      this.lastReportedSentence = sentence;
      this.onPositionSaved?.(word);
    }
    this.surface.onPosition(word, sentence);
  }

  private handleEngineState(s: "playing" | "paused" | "ended") {
    this._state = s;
    if (s === "playing") this.startLoop();
    else this.stopLoop(); // paused or ended
    if (s === "ended") {
      this.active = false;
      // Let the final word's highlight breathe: clear the surface after a linger
      // instead of snapping. Cancelable if a new request or teardown arrives.
      this.cancelEndedLinger();
      this.endedLingerTimer = setTimeout(() => {
        this.endedLingerTimer = null;
        if (!this.disposed) this.surface.clear();
      }, ENDED_LINGER_MS);
    }
    this.onStateCb(s);
  }

  private cancelEndedLinger() {
    if (this.endedLingerTimer != null) {
      clearTimeout(this.endedLingerTimer);
      this.endedLingerTimer = null;
    }
  }

  // ─── Internals ────────────────────────────────────────────────────────────────

  // Mark a playback request in flight: expose "preparing" now so the UI answers
  // the press immediately (breathing pill / loader ribbon). The engine reports
  // "playing" when audio actually starts, overwriting this; a synchronous start
  // (already-loaded chunk) overwrites it within the same call, so no flicker.
  private enterPreparing() {
    // A fresh request supersedes a pending natural-end linger (e.g. replay after
    // the note ended), so the surface is not cleared out from under the new play.
    this.cancelEndedLinger();
    this.active = true;
    this._state = "preparing";
    this.onStateCb("preparing");
  }

  private loop = () => {
    this.engine.tick();
    this.rafId = requestAnimationFrame(this.loop);
  };

  private startLoop() {
    if (this.rafId == null) this.rafId = requestAnimationFrame(this.loop);
  }

  private stopLoop() {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private teardown() {
    this.active = false;
    this.cancelEndedLinger(); // no delayed clear after an immediate teardown clear
    this.stopLoop();
    this.engine.stop(); // pauses every audio element and revokes its blob URL
    this.synthesis.abortAll();
    this.surface.clear();
  }
}

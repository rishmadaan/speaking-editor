// One reading session: owns the parsed model, chunks, synthesis, the vendored
// playback Engine, the rAF loop, and the audio elements. It seeds the sync field
// with word entries, drives the current-word decoration frame-by-frame, and tears
// everything down cleanly. The frame-synced property lives here: the rAF loop calls
// engine.tick() every frame; tick detects the boundary and calls onPosition, which
// dispatches the decoration in that same frame.
import { EditorView } from "@codemirror/view";
import { StateEffect } from "@codemirror/state";
import { parseDocument, buildChunks, DocumentModel, Chunk } from "../engine/core";
import { SynthesisService } from "../engine/synthesis/synthesis-service";
import { EdgeProvider } from "../engine/synthesis/edge";
import { TtsProvider } from "../engine/synthesis/provider";
import { Engine, EngineCallbacks, AudioLike } from "../playback/engine";
import { buildWordEntries, WordEntry } from "./word-runs";
import { setWords, setPosition, clearAll, syncField } from "./sync-field";

export type SessionState = "idle" | "playing" | "paused" | "ended" | "error";

export interface ReadingSessionOptions {
  docText: string;
  uri: string;
  view: EditorView;
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
}

export class ReadingSession {
  private model: DocumentModel;
  private chunks: Chunk[];
  private entries: WordEntry[];
  private synthesis: SynthesisService;
  private engine: Engine;
  private view: EditorView;
  private onStateCb: (state: SessionState, message?: string) => void;

  private rafId: number | null = null;
  private _state: SessionState = "idle";
  private active = false; // between a play/resume/seek and teardown/ended
  private disposed = false;
  // Handles to the audio elements the engine created through us, so the
  // acceptance harness can observe the live playbackRate (check 8).
  private createdAudios: AudioLike[] = [];

  constructor(opts: ReadingSessionOptions) {
    this.view = opts.view;
    this.onStateCb = opts.onState;
    this.model = parseDocument(opts.docText, opts.uri, 1);
    this.chunks = buildChunks(this.model);
    this.entries = buildWordEntries(this.model, opts.docText);
    // no disk cache in this slice; the service still de-dupes in-flight requests
    const provider = opts.provider ?? new EdgeProvider();
    const voice = opts.voice ?? provider.defaultVoice;
    this.synthesis = new SynthesisService(provider, voice);

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

    // seed the field so decorations can paint the moment a position arrives
    this.dispatch([setWords.of(this.entries)]);

    // A reconfigure (provider/voice change) primes the new session PAUSED at the
    // word the listener was on, so a later play resumes there instead of blasting
    // audio on switch. Construction primes; it never auto-plays.
    if (opts.primeAtWord != null) this.engine.primeAt(opts.primeAtWord);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  playPause() {
    if (this.disposed) return;
    if (this._state === "playing") {
      this.engine.pause();
      return;
    }
    if (this._state === "paused") {
      this.active = true;
      this.engine.resume();
      this.startLoop();
      return;
    }
    if (this._state === "ended") {
      // replay: engine.start() no-ops on an already-loaded chunk (receiveChunk
      // ignores duplicates), so jump to the first word, which seeks and plays
      this.active = true;
      this.engine.jumpToWord(0);
      this.startLoop();
      return;
    }
    // idle: start from the top
    this.active = true;
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
    this.active = true;
    this.engine.jumpToWord(wordIndex);
    this.startLoop();
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

  // Acceptance-only observability: the playbackRate every audio element the
  // engine created is currently set to (check 8 reads this to confirm a live
  // speed change reached the audio without a session restart).
  get audioPlaybackRates(): number[] {
    return this.createdAudios.map((a) => a.playbackRate);
  }

  // ─── Engine callbacks ────────────────────────────────────────────────────────

  private requestChunk(i: number, priority: boolean) {
    this.synthesis
      .request(this.chunks[i], priority)
      .then((a) => {
        if (!this.disposed) this.engine.receiveChunk(i, a);
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

  private onPosition(word: number, sentence: number) {
    const effects: StateEffect<unknown>[] = [setPosition.of({ word, sentence })];
    // gentle follow: if the sentence's first run is outside the visible viewport,
    // scroll it back into view. Cheap guard: only measure the one anchor position.
    // Read LIVE entries from the field, not the construction-time copy: edits
    // during playback remap field entries, and a stale anchor would scroll to
    // pre-edit offsets.
    const live = this.view.state.field(syncField, false)?.words ?? this.entries;
    const first = live.find((e) => e.sentence === sentence && e.runs.length > 0 && !e.dirty);
    if (first) {
      const pos = first.runs[0].from;
      try {
        const coords = this.view.coordsAtPos(pos);
        const rect = this.view.scrollDOM.getBoundingClientRect();
        if (!coords || coords.top < rect.top || coords.bottom > rect.bottom) {
          effects.push(EditorView.scrollIntoView(pos, { y: "nearest" }));
        }
      } catch {
        /* measurement can fail if the view is mid-teardown; skip the follow */
      }
    }
    this.dispatch(effects);
  }

  private handleEngineState(s: "playing" | "paused" | "ended") {
    this._state = s;
    if (s === "playing") this.startLoop();
    else this.stopLoop(); // paused or ended
    if (s === "ended") this.active = false;
    this.onStateCb(s);
  }

  // ─── Internals ────────────────────────────────────────────────────────────────

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
    this.stopLoop();
    this.engine.stop(); // pauses every audio element and revokes its blob URL
    this.synthesis.abortAll();
    this.dispatch([clearAll.of(null)]);
  }

  private dispatch(effects: StateEffect<unknown>[]) {
    try {
      this.view.dispatch({ effects });
    } catch {
      /* the view may be detached during teardown; a lost dispatch is harmless */
    }
  }
}

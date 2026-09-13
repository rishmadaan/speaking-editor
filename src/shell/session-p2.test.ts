// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ReadingSession } from "./session";
import { HighlightSurface } from "./highlight-surface";
import { WordEntry } from "./word-runs";
import { Chunk, parseDocument } from "../engine/core";
import { ChunkAudio, TtsProvider, VoiceInfo } from "../engine/synthesis/provider";
import { ChunkTimings } from "../engine/core";

// spec 0010: the session harvests chunk timings shell-side (the vendored Engine is
// untouched), exposes remainingEstimate(), and lingers 600ms before clearing the
// surface on a natural end. All driven through the existing fake-provider/surface
// seams (session-state.test.ts patterns), no DOM, no real audio, no network.

const DOC = "First sentence here. Second sentence follows on. Third one closes it out.";
const TOTAL_WORDS = parseDocument(DOC, "t.md", 1).words.length;

class FakeSurface implements HighlightSurface {
  readonly kind = "cm" as const;
  clears = 0;
  seed(_entries: WordEntry[]): void {}
  onPosition(_word: number, _sentence: number): void {}
  clear(): void {
    this.clears++;
  }
}

// Builds a ChunkAudio whose ms-unit timings mimic N contiguous words of D ms each,
// so the harvested mean ms-per-word is exactly D.
function timedAudio(nWords: number, dMs: number): ChunkAudio {
  const words = Array.from({ length: nWords }, (_, i) => ({
    wordIndex: i,
    start: i * dMs,
    end: (i + 1) * dMs,
  }));
  const timings: ChunkTimings = { unit: "ms", words };
  return { audio: new Uint8Array(0), format: "mp3", timings };
}

// Resolves synthesis with ms timings built from the chunk's own words (100ms each),
// so the real requestChunk resolution path harvests them.
class FakeTimedProvider implements TtsProvider {
  readonly id = "edge";
  readonly label = "Edge";
  readonly requiresKey = false;
  readonly timingQuality = "exact" as const;
  readonly maxCharsPerRequest = 6000;
  readonly defaultVoice = "v";
  listVoices(): Promise<VoiceInfo[]> {
    return Promise.resolve([{ id: "v", label: "V" }]);
  }
  synthesize(chunk: Chunk, _v: string, _s: AbortSignal): Promise<ChunkAudio> {
    return Promise.resolve(timedAudio(chunk.words.length, 100));
  }
}

// Never resolves: pins the session in preparing without ever harvesting timings.
class NeverProvider implements TtsProvider {
  readonly id = "edge";
  readonly label = "Edge";
  readonly requiresKey = false;
  readonly timingQuality = "exact" as const;
  readonly maxCharsPerRequest = 6000;
  readonly defaultVoice = "v";
  listVoices(): Promise<VoiceInfo[]> {
    return Promise.resolve([{ id: "v", label: "V" }]);
  }
  synthesize(_c: Chunk, _v: string, _s: AbortSignal): Promise<ChunkAudio> {
    return new Promise<ChunkAudio>(() => {});
  }
}

function makeSession(provider: TtsProvider, surface: FakeSurface) {
  return new ReadingSession({
    docText: DOC,
    uri: "t.md",
    surface,
    provider,
    onState: () => {},
  });
}

function fireEngineState(session: ReadingSession, s: "playing" | "paused" | "ended") {
  (session as unknown as { handleEngineState(s: "playing" | "paused" | "ended"): void }).handleEngineState(s);
}

function harvest(session: ReadingSession, index: number, audio: ChunkAudio) {
  (session as unknown as { harvestTimings(i: number, a: ChunkAudio): void }).harvestTimings(index, audio);
}

function report(session: ReadingSession, word: number, sentence: number) {
  (session as unknown as { onPosition(w: number, s: number): void }).onPosition(word, sentence);
}

async function flushUntil(pred: () => boolean, ms = 1000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 5));
  }
  return pred();
}

describe("session remainingEstimate", () => {
  beforeEach(() => {
    (globalThis as any).requestAnimationFrame = () => 1;
    (globalThis as any).cancelAnimationFrame = () => {};
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is null before any timings are harvested", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    expect(session.remainingEstimate()).toBeNull();
    session.dispose();
  });

  it("harvests the mean ms-per-word across loaded chunks (word-count weighted)", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    // chunk 0: 3 words at 100ms (span 300, 3 words); chunk 1: 1 word at 300ms
    harvest(session, 0, timedAudio(3, 100));
    harvest(session, 1, timedAudio(1, 300));
    const est = session.remainingEstimate();
    expect(est).not.toBeNull();
    // (300 + 300) / (3 + 1) = 150
    expect(est!.msPerWord).toBe(150);
    session.dispose();
  });

  it("does not double-count a chunk harvested twice", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    harvest(session, 0, timedAudio(4, 100)); // span 400, 4 words -> 100
    harvest(session, 0, timedAudio(4, 100)); // same index, must overwrite not add
    expect(session.remainingEstimate()!.msPerWord).toBe(100);
    session.dispose();
  });

  it("ignores fraction-unit timings (no reliable ms shell-side)", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    const fraction: ChunkAudio = {
      audio: new Uint8Array(0),
      format: "mp3",
      timings: { unit: "fraction", words: [{ wordIndex: 0, start: 0, end: 1 }] },
    };
    harvest(session, 0, fraction);
    expect(session.remainingEstimate()).toBeNull();
    session.dispose();
  });

  it("computes wordsLeft as the words remaining after the current word", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    harvest(session, 0, timedAudio(3, 100));
    // currentWord is -1 before playback: all words remain
    expect(session.remainingEstimate()!.wordsLeft).toBe(TOTAL_WORDS);
    // advance to word 2: words after it remain
    report(session, 2, 0);
    expect(session.remainingEstimate()!.wordsLeft).toBe(TOTAL_WORDS - 3);
    session.dispose();
  });

  it("harvests timings through the real requestChunk resolution path", async () => {
    // Stub the audio/url globals the engine touches so the resolution path runs
    // without a DOM (the timings are harvested before the engine ever plays).
    class FakeAudio {
      preservesPitch = false;
      playbackRate = 1;
      src = "";
      currentTime = 0;
      duration = Number.NaN;
      paused = true;
      onended: (() => void) | null = null;
      onloadedmetadata: (() => void) | null = null;
      play(): Promise<void> {
        return Promise.resolve();
      }
      pause(): void {}
    }
    (globalThis as any).Audio = FakeAudio;
    (URL as any).createObjectURL = () => "blob:x";
    (URL as any).revokeObjectURL = () => {};

    const surface = new FakeSurface();
    const session = makeSession(new FakeTimedProvider(), surface);
    session.playPause(); // idle -> request chunk 0
    const harvested = await flushUntil(() => session.remainingEstimate() !== null);
    expect(harvested).toBe(true);
    const est = session.remainingEstimate()!;
    expect(est.msPerWord).toBe(100); // every word 100ms
    expect(est.wordsLeft).toBe(TOTAL_WORDS); // currentWord still -1
    session.dispose();

    delete (URL as any).createObjectURL;
    delete (URL as any).revokeObjectURL;
    delete (globalThis as any).Audio;
  });
});

describe("session ended-linger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).requestAnimationFrame = () => 1;
    (globalThis as any).cancelAnimationFrame = () => {};
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("delays the surface clear by 600ms on a natural end", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    session.playPause();
    fireEngineState(session, "playing");
    fireEngineState(session, "ended");
    expect(surface.clears).toBe(0);
    vi.advanceTimersByTime(599);
    expect(surface.clears).toBe(0);
    vi.advanceTimersByTime(2);
    expect(surface.clears).toBe(1);
    session.dispose();
  });

  it("a new play cancels the pending ended-linger (no clear)", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    session.playPause();
    fireEngineState(session, "playing");
    fireEngineState(session, "ended");
    session.playPause(); // replay from the top -> cancels the linger
    vi.advanceTimersByTime(1000);
    expect(surface.clears).toBe(0);
    session.dispose();
  });

  it("dispose during the linger clears exactly once, with no delayed second clear", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    session.playPause();
    fireEngineState(session, "playing");
    fireEngineState(session, "ended");
    session.dispose(); // immediate teardown clear + cancels the pending linger
    expect(surface.clears).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(surface.clears).toBe(1);
  });

  it("manual stop clears immediately (no linger)", () => {
    const surface = new FakeSurface();
    const session = makeSession(new NeverProvider(), surface);
    session.playPause();
    fireEngineState(session, "playing");
    session.stop(); // user asked for silence NOW: decorations clear at once
    expect(surface.clears).toBe(1);
  });
});

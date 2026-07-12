import { describe, it, expect } from "vitest";
import { ReadingSession } from "./session";
import { HighlightSurface } from "./highlight-surface";
import { WordEntry } from "./word-runs";
import { Chunk } from "../engine/core";
import { ChunkAudio, TtsProvider, VoiceInfo } from "../engine/synthesis/provider";

// The session-to-surface contract, driven with a fake surface in plain node (no
// DOM, no view): the session seeds the surface once at construction, forwards
// each engine position report to onPosition in order, and clears the surface on
// teardown. This pins the seam the CM6 and reading surfaces both sit behind.

// Records every surface call in a shared log so ordering across calls is testable.
class FakeSurface implements HighlightSurface {
  readonly kind = "range" as const;
  readonly log: string[] = [];
  seededEntries: WordEntry[] | null = null;
  positions: { word: number; sentence: number }[] = [];
  clears = 0;
  seed(entries: WordEntry[]): void {
    this.seededEntries = entries;
    this.log.push("seed");
  }
  onPosition(word: number, sentence: number): void {
    this.positions.push({ word, sentence });
    this.log.push(`pos:${word}:${sentence}`);
  }
  clear(): void {
    this.clears++;
    this.log.push("clear");
  }
}

// A no-op TTS provider so construction never reaches the network.
class FakeProvider implements TtsProvider {
  readonly id = "fake";
  readonly label = "Fake";
  readonly requiresKey = false;
  readonly timingQuality = "exact" as const;
  readonly maxCharsPerRequest = 6000;
  readonly defaultVoice = "fake-voice";
  listVoices(): Promise<VoiceInfo[]> {
    return Promise.resolve([{ id: "fake-voice", label: "Fake" }]);
  }
  synthesize(_chunk: Chunk, _voice: string, _signal: AbortSignal): Promise<ChunkAudio> {
    return new Promise<ChunkAudio>(() => {}); // never resolves; construction never awaits it
  }
}

const DOC = "First sentence here. Second sentence follows on. Third one closes it out.";

function makeSession(surface: FakeSurface) {
  return new ReadingSession({
    docText: DOC,
    uri: "t.md",
    surface,
    provider: new FakeProvider(),
    onState: () => {},
  });
}

describe("session-to-surface contract", () => {
  it("seeds the surface exactly once at construction, with the note's entries", () => {
    const surface = new FakeSurface();
    makeSession(surface);
    expect(surface.log.filter((l) => l === "seed").length).toBe(1);
    expect(surface.seededEntries).not.toBeNull();
    expect(surface.seededEntries!.length).toBeGreaterThan(0);
    // seed carries real word entries (text + runs), not an empty stand-in
    expect(surface.seededEntries!.every((e) => e.text.length > 0)).toBe(true);
  });

  it("forwards engine position reports to onPosition in order, after the seed", () => {
    const surface = new FakeSurface();
    const session = makeSession(surface);
    // Simulate the engine callback firing (the same path engine.tick() drives).
    const report = (session as unknown as { onPosition(w: number, s: number): void }).onPosition.bind(session);
    report(0, 0);
    report(1, 0);
    report(4, 1);
    expect(surface.positions).toEqual([
      { word: 0, sentence: 0 },
      { word: 1, sentence: 0 },
      { word: 4, sentence: 1 },
    ]);
    // seed strictly precedes every position paint
    expect(surface.log[0]).toBe("seed");
    expect(surface.log.slice(1)).toEqual(["pos:0:0", "pos:1:0", "pos:4:1"]);
    // the session mirrors the last painted word/sentence for observability
    expect(session.currentWord).toBe(4);
    expect(session.currentSentence).toBe(1);
    expect(session.highlightSurface).toBe("range");
  });

  it("clears the surface on teardown (dispose), exactly once, without re-seeding", () => {
    const surface = new FakeSurface();
    const session = makeSession(surface);
    session.dispose();
    expect(surface.clears).toBe(1);
    expect(surface.log.filter((l) => l === "seed").length).toBe(1);
    expect(surface.log[surface.log.length - 1]).toBe("clear");
  });

  it("clears the surface on stop as well", () => {
    const surface = new FakeSurface();
    const session = makeSession(surface);
    session.stop();
    expect(surface.clears).toBe(1);
  });
});

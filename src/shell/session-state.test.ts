// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ReadingSession, SessionState } from "./session";
import { HighlightSurface } from "./highlight-surface";
import { WordEntry } from "./word-runs";
import { Chunk } from "../engine/core";
import { ChunkAudio, TtsProvider, VoiceInfo } from "../engine/synthesis/provider";

// The preparing-state derivation, driven the cleanest way: a fake provider whose
// synthesis never resolves (so no chunk ever arrives) pins the session in the
// "requested but not yet playing" window, and the engine-facing callbacks are
// invoked directly (as the vendored suite drives the engine) to simulate the
// engine reporting "playing"/"paused"/"ended". requestAnimationFrame is stubbed to
// a no-op so the rAF loop never actually runs in node, keeping the test
// deterministic and free of DOM/audio.

class FakeSurface implements HighlightSurface {
  readonly kind = "cm" as const;
  seed(_entries: WordEntry[]): void {}
  onPosition(_word: number, _sentence: number): void {}
  clear(): void {}
}

// Never resolves: construction never awaits it and a play/seek request stays in
// "preparing" because no chunk ever arrives to reach "playing".
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

// Rejects on synthesis (twice, since the service retries once) so the session's
// requestChunk catch drives the "error" transition through the real path.
class RejectProvider implements TtsProvider {
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
    return Promise.reject(new Error("ECONNRESET boom"));
  }
}

const DOC = "First sentence here. Second sentence follows on. Third one closes it out.";

// Records the onState stream so ordering (idle -> preparing -> playing) is testable.
function makeSession(
  provider: TtsProvider,
  opts: { primeAtWord?: number } = {}
): { session: ReadingSession; states: SessionState[] } {
  const states: SessionState[] = [];
  const session = new ReadingSession({
    docText: DOC,
    uri: "t.md",
    surface: new FakeSurface(),
    provider,
    onState: (s) => states.push(s),
    primeAtWord: opts.primeAtWord,
  });
  return { session, states };
}

// The engine-facing state callback the vendored engine would fire. Casting mirrors
// the session-surface suite's access to the private onPosition seam.
function fireEngineState(session: ReadingSession, s: "playing" | "paused" | "ended") {
  (session as unknown as { handleEngineState(s: "playing" | "paused" | "ended"): void }).handleEngineState(s);
}

async function flushUntil(pred: () => boolean, ms = 1000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (pred()) return true;
    await new Promise((r) => setTimeout(r, 5));
  }
  return pred();
}

describe("session preparing-state transitions", () => {
  beforeEach(() => {
    // No-op rAF/cancel so startLoop()/stopLoop() never schedule a real frame.
    (globalThis as any).requestAnimationFrame = () => 1;
    (globalThis as any).cancelAnimationFrame = () => {};
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts idle", () => {
    const { session } = makeSession(new NeverProvider());
    expect(session.state).toBe("idle");
    session.dispose();
  });

  it("request from idle enters preparing (start) and stays there until audio starts", () => {
    const { session, states } = makeSession(new NeverProvider());
    session.playPause(); // idle -> request
    expect(session.state).toBe("preparing");
    expect(states).toEqual(["preparing"]);
    session.dispose();
  });

  it("engine playing while preparing transitions to playing", () => {
    const { session, states } = makeSession(new NeverProvider());
    session.playPause();
    expect(session.state).toBe("preparing");
    fireEngineState(session, "playing"); // audio started
    expect(session.state).toBe("playing");
    expect(states).toEqual(["preparing", "playing"]);
    session.dispose();
  });

  it("pause during preparing transitions to paused (cancels the pending start)", () => {
    const { session, states } = makeSession(new NeverProvider());
    session.playPause(); // -> preparing
    session.playPause(); // press again during preparing -> engine.pause() -> paused
    expect(session.state).toBe("paused");
    expect(states).toEqual(["preparing", "paused"]);
    session.dispose();
  });

  it("seek to an unloaded chunk enters preparing", () => {
    const { session } = makeSession(new NeverProvider());
    session.seekToWord(5); // no chunk loaded -> request in flight
    expect(session.state).toBe("preparing");
    session.dispose();
  });

  it("engine ended while preparing transitions to ended", () => {
    const { session } = makeSession(new NeverProvider());
    session.playPause();
    fireEngineState(session, "ended");
    expect(session.state).toBe("ended");
    session.dispose();
  });

  it("synthesis failure while preparing transitions to error, message not to state label", async () => {
    const { session, states } = makeSession(new RejectProvider());
    session.playPause(); // -> preparing, requests chunk 0 which rejects
    expect(session.state).toBe("preparing");
    const reachedError = await flushUntil(() => session.state === "error");
    expect(reachedError).toBe(true);
    expect(states[0]).toBe("preparing");
    expect(states[states.length - 1]).toBe("error");
    session.dispose();
  });

  it("prime-paused construction rests at paused, never preparing", () => {
    const { session, states } = makeSession(new NeverProvider(), { primeAtWord: 2 });
    expect(session.state).toBe("paused");
    expect(states).toEqual(["paused"]);
    // resuming from the primed pause is a request -> preparing
    session.playPause();
    expect(session.state).toBe("preparing");
    session.dispose();
  });

  it("resume from paused enters preparing", () => {
    const { session } = makeSession(new NeverProvider());
    session.playPause(); // preparing
    fireEngineState(session, "playing"); // playing
    fireEngineState(session, "paused"); // paused (user pause)
    expect(session.state).toBe("paused");
    session.playPause(); // resume -> request
    expect(session.state).toBe("preparing");
    session.dispose();
  });
});

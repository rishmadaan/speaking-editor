// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { SynthesisService } from "../engine/synthesis/synthesis-service";
import { ChunkAudio, TtsProvider } from "../engine/synthesis/provider";
import { Chunk } from "../engine/core";

// Spec 0012 Part 2 point 3: a seek's chunk request must reach the FRONT of the
// synthesis queue, ahead of any queued prefetches, so a far jump preempts the
// prefetch backlog even while chunk 0 is still synthesizing. This pins the
// vendored service's priority behavior so a regression is loud.

const mkChunk = (i: number): Chunk => ({ index: i, text: `chunk ${i}`, sentenceIndexes: [i], words: [] });
const mkAudio = (): ChunkAudio => ({ audio: new Uint8Array(4), format: "mp3", timings: { unit: "ms", words: [] } });

describe("synthesis queue priority (fast-start jump hygiene)", () => {
  it("a priority request lands before queued prefetches while chunk 0 is in flight", async () => {
    const started: number[] = [];
    // Hold chunk 0 in flight until every other job has been queued, so we prove
    // the priority job jumps AHEAD of the already-waiting prefetches.
    let releaseChunk0!: () => void;
    const gate = new Promise<void>((r) => (releaseChunk0 = r));

    const provider: TtsProvider = {
      id: "fake",
      label: "Fake",
      requiresKey: false,
      timingQuality: "exact",
      maxCharsPerRequest: 9999,
      defaultVoice: "v",
      listVoices: async () => [],
      synthesize: async (chunk: Chunk) => {
        started.push(chunk.index);
        if (chunk.index === 0) await gate; // block chunk 0
        return mkAudio();
      },
    };

    const svc = new SynthesisService(provider, "v");
    const p0 = svc.request(mkChunk(0)); // starts immediately, then blocks
    const p1 = svc.request(mkChunk(1)); // prefetch
    const p2 = svc.request(mkChunk(2)); // prefetch
    const p9 = svc.request(mkChunk(9), true); // the seek: priority

    releaseChunk0();
    await Promise.all([p0, p1, p2, p9]);

    expect(started[0]).toBe(0); // chunk 0 was already running
    // the priority seek ran before either prefetch
    expect(started.indexOf(9)).toBe(1);
    expect(started.indexOf(9)).toBeLessThan(started.indexOf(1));
    expect(started.indexOf(9)).toBeLessThan(started.indexOf(2));
  });
});

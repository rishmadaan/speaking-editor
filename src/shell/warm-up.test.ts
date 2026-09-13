// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { shouldWarmUp, warmUp, WarmUpState } from "./warm-up";
import { Chunk, parseDocument, buildChunks } from "../engine/core";
import { ChunkAudio, TtsProvider, VoiceInfo } from "../engine/synthesis/provider";
import { DiskCache } from "../engine/synthesis/disk-cache";

const DOC = "First sentence here. Second sentence follows on. Third one closes it out.";

// A minimal in-memory CacheLike (the shape the SynthesisService and warm-up share).
class MemCache {
  store = new Map<string, ChunkAudio>();
  get(key: string): Promise<ChunkAudio | undefined> {
    return Promise.resolve(this.store.get(key));
  }
  set(key: string, value: ChunkAudio): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }
}

function fakeAudio(): ChunkAudio {
  return { audio: new Uint8Array([1, 2, 3]), format: "mp3", timings: { unit: "ms", words: [] } };
}

// Counts synthesize calls; resolves immediately (no network).
class CountingProvider implements TtsProvider {
  synthCount = 0;
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
    this.synthCount++;
    return Promise.resolve(fakeAudio());
  }
}

// Rejects (twice, since the service retries once on a non-abort failure).
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
    return Promise.reject(new Error("boom"));
  }
}

// Never resolves unless its signal aborts, then rejects: models an in-flight
// synthesis a single-flight abort must cancel.
class HangingProvider implements TtsProvider {
  readonly id = "edge";
  readonly label = "Edge";
  readonly requiresKey = false;
  readonly timingQuality = "exact" as const;
  readonly maxCharsPerRequest = 6000;
  readonly defaultVoice = "v";
  listVoices(): Promise<VoiceInfo[]> {
    return Promise.resolve([{ id: "v", label: "V" }]);
  }
  synthesize(_c: Chunk, _v: string, signal: AbortSignal): Promise<ChunkAudio> {
    return new Promise<ChunkAudio>((_res, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }
}

const BASE: WarmUpState = { playedOnce: true, providerId: "edge", sessionActive: false };

describe("shouldWarmUp gate", () => {
  it("passes when every synchronous guardrail is satisfied", () => {
    expect(shouldWarmUp(BASE)).toBe(true);
  });

  it("fails until the plugin has played at least once this session", () => {
    expect(shouldWarmUp({ ...BASE, playedOnce: false })).toBe(false);
  });

  it("fails for any non-Edge provider (never spend paid credits speculatively)", () => {
    expect(shouldWarmUp({ ...BASE, providerId: "elevenlabs" })).toBe(false);
    expect(shouldWarmUp({ ...BASE, providerId: "say" })).toBe(false);
  });

  it("fails while a session is active", () => {
    expect(shouldWarmUp({ ...BASE, sessionActive: true })).toBe(false);
  });
});

describe("warmUp async flow", () => {
  const key = () => {
    const chunks = buildChunks(parseDocument(DOC, "t.md", 1));
    return DiskCache.makeKey(chunks[0].text, "edge", "v");
  };

  it("cache miss: synthesizes chunk 0 and writes it to the shared cache", async () => {
    const cache = new MemCache();
    const provider = new CountingProvider();
    await warmUp({ docText: DOC, uri: "t.md", provider, voice: "v", cache, signal: new AbortController().signal });
    expect(provider.synthCount).toBe(1);
    expect(cache.store.has(key())).toBe(true);
  });

  it("cache hit: does not synthesize (nothing to warm)", async () => {
    const cache = new MemCache();
    cache.store.set(key(), fakeAudio());
    const provider = new CountingProvider();
    await warmUp({ docText: DOC, uri: "t.md", provider, voice: "v", cache, signal: new AbortController().signal });
    expect(provider.synthCount).toBe(0);
  });

  it("already-aborted signal: swallows and does not synthesize", async () => {
    const cache = new MemCache();
    const provider = new CountingProvider();
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      warmUp({ docText: DOC, uri: "t.md", provider, voice: "v", cache, signal: ctrl.signal })
    ).resolves.toBeUndefined();
    expect(provider.synthCount).toBe(0);
  });

  it("mid-flight abort cancels synthesis and resolves (single-flight)", async () => {
    const cache = new MemCache();
    const provider = new HangingProvider();
    const ctrl = new AbortController();
    const p = warmUp({ docText: DOC, uri: "t.md", provider, voice: "v", cache, signal: ctrl.signal });
    await new Promise((r) => setTimeout(r, 10)); // let it reach synthesize
    ctrl.abort();
    await expect(p).resolves.toBeUndefined();
    expect(cache.store.size).toBe(0); // nothing written on an aborted warm-up
  });

  it("swallows a synthesis failure (opportunistic)", async () => {
    const cache = new MemCache();
    const provider = new RejectProvider();
    await expect(
      warmUp({ docText: DOC, uri: "t.md", provider, voice: "v", cache, signal: new AbortController().signal })
    ).resolves.toBeUndefined();
    expect(cache.store.size).toBe(0);
  });

  it("no-ops on an empty document (no chunk 0 to warm)", async () => {
    const cache = new MemCache();
    const provider = new CountingProvider();
    await warmUp({ docText: "", uri: "t.md", provider, voice: "v", cache, signal: new AbortController().signal });
    expect(provider.synthCount).toBe(0);
  });
});

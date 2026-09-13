// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Warm start for the free voice (spec 0010 point 4). When the active note changes
// and every guardrail passes, quietly synthesize chunk 0 into the SAME disk cache
// sessions use, so a later play starts near-instantly. It is INVISIBLE: no audio
// element, no UI, no Notice, no state change beyond the cache write. It composes a
// SynthesisService over the shared cache exactly like buildSession does, but with
// no Engine and no audio, and swallows every failure (warm-up is opportunistic).
import { parseDocument, buildChunks } from "../engine/core";
import { TtsProvider, ChunkAudio } from "../engine/synthesis/provider";
import { SynthesisService } from "../engine/synthesis/synthesis-service";
import { DiskCache } from "../engine/synthesis/disk-cache";

// The synchronous guardrails, as a pure gate so each one is unit-testable. The two
// effectful guardrails (chunk-0 cache miss, at most one warm-up in flight) live in
// warmUp() and its single-flight AbortController, since they need I/O and state.
export interface WarmUpState {
  // The plugin has played at least once this app session (never warm before the
  // user has shown intent to listen).
  playedOnce: boolean;
  // The active provider id: only Edge (keyless) warms; paid providers never spend
  // credits speculatively.
  providerId: string;
  // Whether a reading session is currently active (mid-listen).
  sessionActive: boolean;
}

export function shouldWarmUp(state: WarmUpState): boolean {
  return state.playedOnce && state.providerId === "edge" && !state.sessionActive;
}

// The structural cache the warm-up shares with sessions.
export interface WarmUpCache {
  get(key: string): Promise<ChunkAudio | undefined>;
  set(key: string, value: ChunkAudio): Promise<void>;
}

export interface WarmUpDeps {
  docText: string;
  uri: string;
  provider: TtsProvider;
  voice: string;
  cache: WarmUpCache;
  // Aborts this warm-up when a newer note switch supersedes it (single-flight).
  signal: AbortSignal;
}

export async function warmUp(deps: WarmUpDeps): Promise<void> {
  try {
    const model = parseDocument(deps.docText, deps.uri, 1);
    const chunks = buildChunks(model);
    if (chunks.length === 0) return; // nothing to warm
    const chunk0 = chunks[0];
    // Guardrail: only warm on a chunk-0 cache MISS, using the same key scheme play
    // would request, so the warmed chunk is exactly what a later play serves.
    const key = DiskCache.makeKey(chunk0.text, deps.provider.id, deps.voice);
    const existing = await deps.cache.get(key);
    if (existing) return; // already warm
    if (deps.signal.aborted) return;

    const service = new SynthesisService(deps.provider, deps.voice, deps.cache);
    // Requesting chunk 0 synthesizes it and (inside the service) writes it to the
    // shared cache: no Engine, no audio, no UI, purely a cache write. Race it
    // against the single-flight abort so a superseding note switch stops waiting
    // at once; on abort we also cancel the service's in-flight synthesis.
    await new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        deps.signal.removeEventListener("abort", onAbort);
        resolve();
      };
      const onAbort = () => {
        service.abortAll();
        finish();
      };
      deps.signal.addEventListener("abort", onAbort, { once: true });
      service.request(chunk0, true).then(finish, finish);
    });
  } catch {
    // Opportunistic: swallow every failure (abort, network, malformed audio).
  }
}

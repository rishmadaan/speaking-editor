// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Per-note reading position: where the listener left off, so play resumes there.
// Pure logic only (no Obsidian, no fs): the map lives in data.json and syncs
// across devices intentionally (a position is not a secret, and remembering it
// everywhere is the feature). Records expire after 12 hours and the map is
// capped at 200 notes, oldest dropped, so it never grows without bound.
import { DocumentModel } from "../engine/core";

export interface PositionRecord {
  wordIndex: number;
  ts: number;
}

// Note path -> last-known position.
export type Positions = Record<string, PositionRecord>;

export const POSITION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours (parent-repo rule)
export const POSITION_CAP = 200; // most-recent notes kept

// Record (or update) a note's position, then enforce the 200-note cap by
// dropping the oldest entries. Returns a new map; never mutates the input.
export function recordPosition(
  positions: Positions,
  path: string,
  wordIndex: number,
  now: number,
  cap: number = POSITION_CAP
): Positions {
  const next: Positions = { ...positions, [path]: { wordIndex, ts: now } };
  return capOldest(next, cap);
}

function capOldest(positions: Positions, cap: number): Positions {
  const keys = Object.keys(positions);
  if (keys.length <= cap) return positions;
  const sorted = keys.sort((a, b) => positions[a].ts - positions[b].ts); // oldest first
  const drop = sorted.slice(0, keys.length - cap);
  const next: Positions = { ...positions };
  for (const k of drop) delete next[k];
  return next;
}

// The note's position if it exists and is younger than the 12h TTL, else
// undefined (an expired position is treated as absent).
export function getFreshPosition(
  positions: Positions,
  path: string,
  now: number,
  ttl: number = POSITION_TTL_MS
): PositionRecord | undefined {
  const rec = positions[path];
  if (!rec) return undefined;
  if (now - rec.ts >= ttl) return undefined;
  return rec;
}

// Drop a note's position (finished playing, or "read from the top"). Returns a
// new map; never mutates the input.
export function clearPosition(positions: Positions, path: string): Positions {
  if (!(path in positions)) return positions;
  const next: Positions = { ...positions };
  delete next[path];
  return next;
}

// Hydrate the positions map from a raw data.json payload, dropping any malformed
// entry. Old payloads (no `positions` key) yield an empty map. See settings.ts
// for the payload shape (positions is a sibling of the settings fields).
export function readPositions(saved: unknown): Positions {
  const p = (saved as { positions?: unknown } | null | undefined)?.positions;
  if (!p || typeof p !== "object") return {};
  const out: Positions = {};
  for (const [path, v] of Object.entries(p as Record<string, unknown>)) {
    const rec = v as { wordIndex?: unknown; ts?: unknown } | null;
    if (rec && typeof rec.wordIndex === "number" && typeof rec.ts === "number") {
      out[path] = { wordIndex: rec.wordIndex, ts: rec.ts };
    }
  }
  return out;
}

// Given a document model and a saved word index, return the index of the first
// word of the sentence that contains it, so resume starts calmly at a sentence
// boundary rather than mid-sentence. Falls back to the given index if the word
// is not found in the model.
export function resolveSentenceStart(model: DocumentModel, wordIndex: number): number {
  for (const s of model.sentences) {
    if (s.words.length === 0) continue;
    const first = s.words[0].index;
    const last = s.words[s.words.length - 1].index;
    if (wordIndex >= first && wordIndex <= last) return first;
  }
  return wordIndex;
}

// Write-through throttle for persisting positions: at most one write per
// interval, leading-edge (the first request writes immediately) with a single
// coalesced trailing write for a burst, plus flush() for a forced immediate
// write on session end/stop/dispose and plugin unload. The clock is injectable
// so it can be driven with fake timers; setTimeout is used for the trailing run
// (fake timers mock it too).
export class WriteThrottle {
  private lastRun = -Infinity;
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private intervalMs: number,
    private write: () => void,
    private now: () => number = () => Date.now()
  ) {}

  request(): void {
    const t = this.now();
    if (t - this.lastRun >= this.intervalMs) {
      this.run();
      return;
    }
    this.pending = true;
    if (this.timer == null) {
      const wait = this.intervalMs - (t - this.lastRun);
      this.timer = setTimeout(() => {
        this.timer = null;
        if (this.pending) this.run();
      }, wait);
    }
  }

  // Force an immediate write and cancel any pending trailing run.
  flush(): void {
    if (this.timer != null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.run();
  }

  private run(): void {
    this.pending = false;
    this.lastRun = this.now();
    this.write();
  }
}

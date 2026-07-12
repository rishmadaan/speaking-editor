import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  recordPosition,
  getFreshPosition,
  clearPosition,
  readPositions,
  resolveSentenceStart,
  WriteThrottle,
  POSITION_TTL_MS,
  POSITION_CAP,
  Positions,
} from "./positions";
import { parseDocument } from "../engine/core";

describe("recordPosition", () => {
  it("stores a { wordIndex, ts } record under the note path", () => {
    const p = recordPosition({}, "a.md", 12, 1000);
    expect(p["a.md"]).toEqual({ wordIndex: 12, ts: 1000 });
  });

  it("overwrites the same path's record (updates word and ts) without growing", () => {
    let p = recordPosition({}, "a.md", 5, 1000);
    p = recordPosition(p, "a.md", 9, 2000);
    expect(p["a.md"]).toEqual({ wordIndex: 9, ts: 2000 });
    expect(Object.keys(p)).toHaveLength(1);
  });

  it("does not mutate the input map", () => {
    const before: Positions = { "a.md": { wordIndex: 1, ts: 1 } };
    const after = recordPosition(before, "b.md", 2, 2);
    expect(before).toEqual({ "a.md": { wordIndex: 1, ts: 1 } });
    expect(Object.keys(after)).toHaveLength(2);
  });

  it("caps the map at 200 notes, dropping the oldest by ts", () => {
    let p: Positions = {};
    // 200 notes, ascending timestamps so note-0 is oldest
    for (let i = 0; i < POSITION_CAP; i++) p = recordPosition(p, `note-${i}.md`, i, 1000 + i);
    expect(Object.keys(p)).toHaveLength(POSITION_CAP);
    // the 201st note evicts the oldest (note-0)
    p = recordPosition(p, "note-new.md", 999, 5000);
    expect(Object.keys(p)).toHaveLength(POSITION_CAP);
    expect(p["note-0.md"]).toBeUndefined();
    expect(p["note-1.md"]).toBeDefined();
    expect(p["note-new.md"]).toEqual({ wordIndex: 999, ts: 5000 });
  });
});

describe("getFreshPosition (12h expiry)", () => {
  it("returns the record when it is younger than 12 hours", () => {
    const p = recordPosition({}, "a.md", 7, 1_000_000);
    const rec = getFreshPosition(p, "a.md", 1_000_000 + POSITION_TTL_MS - 1);
    expect(rec).toEqual({ wordIndex: 7, ts: 1_000_000 });
  });

  it("returns undefined at or beyond 12 hours old", () => {
    const p = recordPosition({}, "a.md", 7, 1_000_000);
    expect(getFreshPosition(p, "a.md", 1_000_000 + POSITION_TTL_MS)).toBeUndefined();
    expect(getFreshPosition(p, "a.md", 1_000_000 + POSITION_TTL_MS + 60_000)).toBeUndefined();
  });

  it("returns undefined for an unknown path", () => {
    expect(getFreshPosition({}, "missing.md", 0)).toBeUndefined();
  });

  it("confirms the TTL is 12 hours", () => {
    expect(POSITION_TTL_MS).toBe(12 * 60 * 60 * 1000);
  });
});

describe("clearPosition", () => {
  it("removes the note's record and returns a new map", () => {
    const before = recordPosition({}, "a.md", 3, 1);
    const after = clearPosition(before, "a.md");
    expect(after["a.md"]).toBeUndefined();
    expect(before["a.md"]).toBeDefined(); // input untouched
  });

  it("is a no-op for an unknown path", () => {
    const before: Positions = { "a.md": { wordIndex: 1, ts: 1 } };
    expect(clearPosition(before, "missing.md")).toEqual(before);
  });
});

describe("readPositions (data.json hydration)", () => {
  it("reads a positions map from the saved payload, ignoring malformed entries", () => {
    const saved = {
      providerId: "edge",
      positions: {
        "a.md": { wordIndex: 4, ts: 100 },
        "bad-1.md": { wordIndex: "x", ts: 5 },
        "bad-2.md": { ts: 5 },
        "bad-3.md": 42,
      },
    };
    expect(readPositions(saved)).toEqual({ "a.md": { wordIndex: 4, ts: 100 } });
  });

  it("returns an empty map for old payloads with no positions key", () => {
    expect(readPositions({ providerId: "edge" })).toEqual({});
    expect(readPositions(null)).toEqual({});
    expect(readPositions(undefined)).toEqual({});
  });
});

describe("resolveSentenceStart", () => {
  const model = parseDocument(
    "First one here. Second sentence follows on. Third and last one.",
    "x.md",
    1
  );

  it("resolves a mid-sentence word to the first word of its sentence", () => {
    // sentence 1 is "Second sentence follows on."; pick its second word
    const s1 = model.sentences[1];
    const midWord = s1.words[1].index;
    expect(resolveSentenceStart(model, midWord)).toBe(s1.words[0].index);
  });

  it("returns the same index for a word already at a sentence start", () => {
    const s2 = model.sentences[2];
    expect(resolveSentenceStart(model, s2.words[0].index)).toBe(s2.words[0].index);
  });

  it("falls back to the given index for an unknown word", () => {
    expect(resolveSentenceStart(model, 99999)).toBe(99999);
  });
});

describe("WriteThrottle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("writes immediately on the first request (leading edge)", () => {
    const fn = vi.fn();
    const t = new WriteThrottle(5000, fn);
    t.request();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("coalesces bursts within the window into a single trailing write", () => {
    const fn = vi.fn();
    const t = new WriteThrottle(5000, fn);
    t.request(); // leading write (1)
    t.request();
    t.request();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000); // trailing write (2)
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not schedule a trailing write when nothing came in during the window", () => {
    const fn = vi.fn();
    const t = new WriteThrottle(5000, fn);
    t.request(); // leading write
    vi.advanceTimersByTime(20000);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("allows another leading write once the window has fully elapsed", () => {
    const fn = vi.fn();
    const t = new WriteThrottle(5000, fn);
    t.request();
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6000);
    t.request();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("flush() writes immediately and cancels a pending trailing write", () => {
    const fn = vi.fn();
    const t = new WriteThrottle(5000, fn);
    t.request(); // leading (1)
    t.request(); // schedules trailing
    t.flush(); // forces (2), cancels trailing
    expect(fn).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(10000);
    expect(fn).toHaveBeenCalledTimes(2); // no extra trailing fired
  });
});

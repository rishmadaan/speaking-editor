// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  shouldShowSeekHint,
  createSeekHint,
  SEEK_HINT_LIMIT,
  SEEK_HINT_TEXT,
  SEEK_HINT_VISIBLE_MS,
  SEEK_HINT_FADE_MS,
} from "./hint";

describe("shouldShowSeekHint", () => {
  it("shows at 0, 1, 2 and never at 3+", () => {
    expect(shouldShowSeekHint(0)).toBe(true);
    expect(shouldShowSeekHint(1)).toBe(true);
    expect(shouldShowSeekHint(2)).toBe(true);
    expect(shouldShowSeekHint(3)).toBe(false);
    expect(shouldShowSeekHint(4)).toBe(false);
    expect(shouldShowSeekHint(99)).toBe(false);
  });

  it("stops exactly at the documented limit of 3", () => {
    expect(SEEK_HINT_LIMIT).toBe(3);
  });
});

describe("createSeekHint", () => {
  let container: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
  });
  afterEach(() => {
    vi.useRealTimers();
    container.remove();
  });

  it("builds an se-hint element carrying the teaching copy", () => {
    const el = createSeekHint(document);
    expect(el.classList.contains("se-hint")).toBe(true);
    expect(el.textContent).toBe(SEEK_HINT_TEXT);
    expect(el.textContent).toContain("listening mode");
    // no em dashes in the copy
    expect(el.textContent).not.toContain("\u2014");
  });

  it("fades in on the next tick, holds for the visible window, then removes itself", () => {
    const onDone = vi.fn();
    const el = createSeekHint(document, { onDone });
    container.appendChild(el);

    // not visible yet (base opacity), becomes visible after the 0ms tick
    expect(el.classList.contains("se-hint-visible")).toBe(false);
    vi.advanceTimersByTime(0);
    expect(el.classList.contains("se-hint-visible")).toBe(true);

    // still up just before the window closes
    vi.advanceTimersByTime(SEEK_HINT_VISIBLE_MS - 1);
    expect(el.isConnected).toBe(true);
    expect(el.classList.contains("se-hint-visible")).toBe(true);

    // window closes: fade out (visible class removed), element still present
    vi.advanceTimersByTime(1);
    expect(el.classList.contains("se-hint-visible")).toBe(false);
    expect(el.isConnected).toBe(true);
    expect(onDone).not.toHaveBeenCalled();

    // after the fade, it removes itself and reports done
    vi.advanceTimersByTime(SEEK_HINT_FADE_MS);
    expect(el.isConnected).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("honors a shortened visible window for callers that want a quicker dismiss", () => {
    const el = createSeekHint(document, { visibleMs: 100 });
    container.appendChild(el);
    vi.advanceTimersByTime(0);
    expect(el.classList.contains("se-hint-visible")).toBe(true);
    vi.advanceTimersByTime(100 + SEEK_HINT_FADE_MS);
    expect(el.isConnected).toBe(false);
  });
});

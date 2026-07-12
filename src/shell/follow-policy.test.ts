import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FollowPolicy, SCROLLEND_FALLBACK_MS } from "./follow-policy";

// A recording set of injected callbacks so each event sequence can be asserted
// against both the flag state (following / chipVisible) and the DOM effects the
// surfaces would run.
function makePolicy(fallbackMs?: number) {
  const calls = { showChip: 0, hideChip: 0, scrollToCurrent: 0 };
  const policy = new FollowPolicy(
    {
      showChip: () => calls.showChip++,
      hideChip: () => calls.hideChip++,
      scrollToCurrent: () => calls.scrollToCurrent++,
    },
    fallbackMs
  );
  return { policy, calls };
}

describe("FollowPolicy", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("defaults to following, no chip", () => {
    const { policy, calls } = makePolicy();
    expect(policy.following).toBe(true);
    expect(policy.chipVisible).toBe(false);
    expect(calls.showChip).toBe(0);
  });

  it("a user scroll breaks following and shows the chip once", () => {
    const { policy, calls } = makePolicy();
    policy.handleScroll();
    expect(policy.following).toBe(false);
    expect(policy.chipVisible).toBe(true);
    expect(calls.showChip).toBe(1);
    // a second user scroll while already broken does not re-show the chip
    policy.handleScroll();
    expect(calls.showChip).toBe(1);
  });

  it("guards our own scroll: a scroll during a self-scroll does not break following", () => {
    const { policy, calls } = makePolicy();
    policy.beginSelfScroll();
    policy.handleScroll(); // this scroll is ours
    expect(policy.following).toBe(true);
    expect(policy.chipVisible).toBe(false);
    expect(calls.showChip).toBe(0);
    // scrollend clears the guard, so the NEXT scroll is the user's and breaks
    policy.handleScrollEnd();
    policy.handleScroll();
    expect(policy.following).toBe(false);
    expect(calls.showChip).toBe(1);
  });

  it("clears the self-scroll guard on the 600ms fallback when scrollend never fires", () => {
    const { policy, calls } = makePolicy();
    expect(SCROLLEND_FALLBACK_MS).toBe(600);
    policy.beginSelfScroll();
    policy.handleScroll(); // ours, ignored
    expect(policy.following).toBe(true);
    // no scrollend arrives; advance past the fallback
    vi.advanceTimersByTime(SCROLLEND_FALLBACK_MS);
    policy.handleScroll(); // now the guard is gone, this breaks
    expect(policy.following).toBe(false);
    expect(calls.showChip).toBe(1);
  });

  it("does not clear the guard a hair before the fallback fires", () => {
    const { policy } = makePolicy();
    policy.beginSelfScroll();
    vi.advanceTimersByTime(SCROLLEND_FALLBACK_MS - 1);
    policy.handleScroll(); // still guarded
    expect(policy.following).toBe(true);
  });

  it("a jump re-engages following and hides the chip WITHOUT scrolling", () => {
    const { policy, calls } = makePolicy();
    policy.handleScroll(); // break
    expect(policy.following).toBe(false);
    policy.handleJump();
    expect(policy.following).toBe(true);
    expect(policy.chipVisible).toBe(false);
    expect(calls.hideChip).toBe(1);
    expect(calls.scrollToCurrent).toBe(0); // a jump paints where you clicked
  });

  it("a return-chip click re-engages, hides the chip, and scrolls to the current sentence", () => {
    const { policy, calls } = makePolicy();
    policy.handleScroll(); // break
    policy.handleReturnClick();
    expect(policy.following).toBe(true);
    expect(policy.chipVisible).toBe(false);
    expect(calls.hideChip).toBe(1);
    expect(calls.scrollToCurrent).toBe(1);
  });

  it("hideChip is not called when the chip was not visible", () => {
    const { policy, calls } = makePolicy();
    policy.handleJump(); // already following, chip already hidden
    expect(calls.hideChip).toBe(0);
    policy.handleReturnClick();
    expect(calls.hideChip).toBe(0);
    expect(calls.scrollToCurrent).toBe(1); // still scrolls to re-centre
  });

  it("a fresh beginSelfScroll re-arms the fallback timer", () => {
    const { policy } = makePolicy();
    policy.beginSelfScroll();
    vi.advanceTimersByTime(400);
    policy.beginSelfScroll(); // re-arm; the first timer is cancelled
    vi.advanceTimersByTime(400); // 800 since the first, only 400 since the second
    policy.handleScroll();
    expect(policy.following).toBe(true); // still guarded (second timer not yet fired)
    vi.advanceTimersByTime(200); // now 600 since the second
    policy.handleScroll();
    expect(policy.following).toBe(false);
  });

  it("destroy releases the fallback timer", () => {
    const { policy } = makePolicy();
    policy.beginSelfScroll();
    policy.destroy();
    // the timer is cleared; advancing does nothing and leaves the guard as-is
    vi.advanceTimersByTime(SCROLLEND_FALLBACK_MS);
    expect(policy.following).toBe(true);
  });
});

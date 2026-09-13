// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.
// Inherited TalkToMeBaby MIT grant: see VENDOR.md and THIRD_PARTY_NOTICES.md.

// The shared follow policy, ported from TalkToMeBaby's highlight.ts. A tiny flag
// machine that both highlight surfaces (live preview and reading mode) drive: it
// owns whether the reading FOLLOWS the highlight, guards our own programmatic
// scrolls so they are not mistaken for a user scroll, and decides when the
// "Return to reading" chip is shown or hidden. Pure logic (no DOM), so it
// unit-tests against event sequences; the surfaces inject the DOM effects.

// How long to wait for a scrollend before assuming our self-scroll finished. A
// smooth scroll's scrollend can be missed by the platform, so this timer clears
// the guard as a fallback (the parent's number).
export const SCROLLEND_FALLBACK_MS = 600;

export interface FollowPolicyCallbacks {
  // Following just broke because the user scrolled: show the return chip.
  showChip(): void;
  // Returning to the reading (chip click or a jump): hide the chip.
  hideChip(): void;
  // Smooth-scroll the current sentence back to the centre of the viewport. Called
  // only on an explicit return-chip click; a plain jump paints where the user
  // already clicked, so it never scrolls.
  scrollToCurrent(): void;
}

export class FollowPolicy {
  private _following = true;
  private _chipVisible = false;
  // True while one of OUR programmatic scrolls is in flight, so the scroll events
  // it emits do not read as a user scroll and break following.
  private selfScrolling = false;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private cb: FollowPolicyCallbacks,
    private fallbackMs: number = SCROLLEND_FALLBACK_MS
  ) {}

  get following(): boolean {
    return this._following;
  }
  get chipVisible(): boolean {
    return this._chipVisible;
  }

  // A surface is about to run its own scrollIntoView: guard the scroll events it
  // will emit. Arms the scrollend fallback in case scrollend never fires.
  beginSelfScroll(): void {
    this.selfScrolling = true;
    this.armFallback();
  }

  // A scroll happened on the surface's scroller. Ours -> ignored; the user's ->
  // following breaks and the chip appears (once).
  handleScroll(): void {
    if (this.selfScrolling) return;
    if (this._following) {
      this._following = false;
      if (!this._chipVisible) {
        this._chipVisible = true;
        this.cb.showChip();
      }
    }
  }

  // The surface's scroller reported scrollend: our self-scroll is done.
  handleScrollEnd(): void {
    this.selfScrolling = false;
    this.clearFallback();
  }

  // A user jump (click-to-seek): the click IS the new reading position, so
  // following re-engages and the chip hides, but nothing scrolls.
  handleJump(): void {
    this._following = true;
    this.hideChipIfVisible();
  }

  // The return chip was clicked: re-engage, hide the chip, and scroll the current
  // sentence back to centre.
  handleReturnClick(): void {
    this._following = true;
    this.hideChipIfVisible();
    this.cb.scrollToCurrent();
  }

  // Release timers (surface teardown).
  destroy(): void {
    this.clearFallback();
  }

  private hideChipIfVisible(): void {
    if (this._chipVisible) {
      this._chipVisible = false;
      this.cb.hideChip();
    }
  }

  private armFallback(): void {
    this.clearFallback();
    this.fallbackTimer = setTimeout(() => {
      this.fallbackTimer = null;
      this.selfScrolling = false;
    }, this.fallbackMs);
  }

  private clearFallback(): void {
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }
}

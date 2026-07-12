// The first-jump teaching hint (spec 0009 point 3). Two parts, both small:
//   1. a pure gate, shouldShowSeekHint(count), so the shell decides whether to
//      teach, and
//   2. a DOM factory that builds a transient hint element (se-hint family) which
//      self-dismisses after 4 seconds, opacity-only, never blocking input.
// No Obsidian imports, so it unit-tests in happy-dom with fake timers.

// The first N (3) real seeks teach; after that the reader knows and we stop
// forever. Persisted as settings.seekHintsShown.
export const SEEK_HINT_LIMIT = 3;

export const SEEK_HINT_TEXT =
  "Jumped here. That is listening mode; the ear turns it off.";

// How long the hint stays fully visible before it fades itself out.
export const SEEK_HINT_VISIBLE_MS = 4000;
// The opacity fade duration, matched in styles.css (opacity transition only).
export const SEEK_HINT_FADE_MS = 250;

// Pure gate: show at 0, 1, 2; never at 3+.
export function shouldShowSeekHint(count: number): boolean {
  return count < SEEK_HINT_LIMIT;
}

export interface SeekHintOptions {
  // Override the visible window (tests shorten it); defaults to 4s.
  visibleMs?: number;
  // Fired once the hint has fully removed itself, so the shell can clear its
  // "a hint is already up" guard.
  onDone?: () => void;
}

// Build the hint element. The caller appends it near the pill; the element owns
// its own lifecycle: fade in, hold, fade out, remove, then onDone. Only opacity
// animates (via the se-hint-visible class toggling); nothing moves.
export function createSeekHint(doc: Document, opts: SeekHintOptions = {}): HTMLElement {
  const visibleMs = opts.visibleMs ?? SEEK_HINT_VISIBLE_MS;
  const el = doc.createElement("div");
  el.className = "se-hint";
  el.setAttribute("role", "status");
  el.textContent = SEEK_HINT_TEXT;

  // Fade in on the next tick so the opacity transition from the base (0) to
  // visible (1) actually runs rather than snapping.
  setTimeout(() => el.classList.add("se-hint-visible"), 0);

  // Hold, then fade out and remove.
  setTimeout(() => {
    el.classList.remove("se-hint-visible");
    setTimeout(() => {
      el.remove();
      opts.onDone?.();
    }, SEEK_HINT_FADE_MS);
  }, visibleMs);

  return el;
}

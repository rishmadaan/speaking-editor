// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// The pure remaining-time label for the pill (spec 0010 point 1). The session owns
// the timings and exposes { msPerWord, wordsLeft }; this function turns that plus
// the current speed into a calm, dim label. msPerWord is the MEAN across every
// loaded chunk's timings; dividing by speed accounts for faster/slower playback,
// and multiplying by the words remaining gives the milliseconds left to read.
//
// Rounding table:
//   >= 90s  -> "~N min left" (N = round(ms / 60000))
//   20..90s -> "~1 min left"
//   < 20s   -> "almost done"
//   unknown -> "" (no timings yet, or a degenerate estimate)

const MINUTES_FLOOR_MS = 90_000; // at/above this, show whole minutes
const NEARLY_DONE_MS = 20_000; // below this, "almost done"

export function remainingLabel(
  msPerWord: number | null,
  wordsLeft: number,
  speed: number
): string {
  if (msPerWord == null || !Number.isFinite(msPerWord) || msPerWord <= 0) return "";
  const speedFactor = speed > 0 ? speed : 1;
  const remainingMs = (msPerWord / speedFactor) * Math.max(wordsLeft, 0);
  if (remainingMs >= MINUTES_FLOOR_MS) {
    return `~${Math.round(remainingMs / 60_000)} min left`;
  }
  if (remainingMs >= NEARLY_DONE_MS) return "~1 min left";
  return "almost done";
}

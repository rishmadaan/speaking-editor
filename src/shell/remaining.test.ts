import { describe, it, expect } from "vitest";
import { remainingLabel } from "./remaining";

// The pure remaining-time label: mean ms-per-word (from the session), divided by
// the current speed, times the words left, bucketed by the spec's rounding table.
describe("remainingLabel", () => {
  it("renders empty when the estimate is unknown (null ms-per-word)", () => {
    expect(remainingLabel(null, 500, 1)).toBe("");
  });

  it("renders empty for a non-positive or non-finite ms-per-word", () => {
    expect(remainingLabel(0, 500, 1)).toBe("");
    expect(remainingLabel(-100, 500, 1)).toBe("");
    expect(remainingLabel(Number.NaN, 500, 1)).toBe("");
  });

  it("says 'almost done' under 20s and with no words left", () => {
    // 300ms/word * 30 words = 9000ms -> under 20s
    expect(remainingLabel(300, 30, 1)).toBe("almost done");
    // no words left is 0ms remaining -> almost done
    expect(remainingLabel(300, 0, 1)).toBe("almost done");
  });

  it("says '~1 min left' between 20s and 90s", () => {
    // 300ms/word * 100 words = 30000ms (30s)
    expect(remainingLabel(300, 100, 1)).toBe("~1 min left");
    // just under the 90s ceiling: 89s
    expect(remainingLabel(890, 100, 1)).toBe("~1 min left");
  });

  it("rounds to whole minutes at or above 90s", () => {
    // 300ms/word * 3000 words = 900000ms = 15 min
    expect(remainingLabel(300, 3000, 1)).toBe("~15 min left");
    // 200ms/word * 3600 words = 720000ms = 12 min
    expect(remainingLabel(200, 3600, 1)).toBe("~12 min left");
  });

  it("treats exactly 90s as the minutes bucket (rounds 1.5 -> 2)", () => {
    // 900ms/word * 100 words = 90000ms -> Math.round(1.5) = 2
    expect(remainingLabel(900, 100, 1)).toBe("~2 min left");
  });

  it("divides by the current speed", () => {
    // 300ms/word * 240 words = 72000ms at speed 1 -> ~1 min left (20s..90s)
    expect(remainingLabel(300, 240, 1)).toBe("~1 min left");
    // at half speed the audio takes twice as long: 144000ms -> ~2 min left
    expect(remainingLabel(300, 240, 0.5)).toBe("~2 min left");
    // at double speed: 36000ms -> ~1 min left
    expect(remainingLabel(300, 240, 2)).toBe("~1 min left");
  });

  it("guards against a zero or negative speed by treating it as 1x", () => {
    expect(remainingLabel(300, 100, 0)).toBe("~1 min left");
  });
});

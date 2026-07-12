// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PlayerPill, nextPreset, SPEED_PRESETS, PlayerPillCallbacks } from "./player-pill";

// ─── nextPreset: pure preset-cycling logic ─────────────────────────────────────
describe("nextPreset", () => {
  it("exposes the seven presets in order", () => {
    expect(SPEED_PRESETS).toEqual([0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0]);
  });

  it("exact preset hit cycles to the next one forward", () => {
    expect(nextPreset(1.2, 1)).toBe(1.5);
    expect(nextPreset(1.0, 1)).toBe(1.2);
    expect(nextPreset(2.0, 1)).toBe(2.5);
  });

  it("exact preset hit steps to the previous one backward", () => {
    expect(nextPreset(1.2, -1)).toBe(1.0);
    expect(nextPreset(1.5, -1)).toBe(1.2);
  });

  it("wraps forward from the top back to the bottom", () => {
    expect(nextPreset(3.0, 1)).toBe(0.8);
  });

  it("wraps backward from the bottom to the top", () => {
    expect(nextPreset(0.8, -1)).toBe(3.0);
  });

  it("between presets resolves to the closest, then cycles forward", () => {
    // 1.15 is closest to 1.2 (idx 2); forward => 1.5
    expect(nextPreset(1.15, 1)).toBe(1.5);
    // 1.05 is closest to 1.0 (idx 1); forward => 1.2
    expect(nextPreset(1.05, 1)).toBe(1.2);
  });

  it("between presets resolves to the closest, then cycles backward", () => {
    // 1.15 closest to 1.2 (idx 2); backward => 1.0
    expect(nextPreset(1.15, -1)).toBe(1.0);
  });

  it("clamps an out-of-range value to the nearest end then cycles", () => {
    // below the floor: closest is 0.8 (idx 0)
    expect(nextPreset(0.4, 1)).toBe(1.0);
    expect(nextPreset(0.4, -1)).toBe(3.0); // wraps
    // above the ceiling: closest is 3.0 (idx 6)
    expect(nextPreset(5.0, 1)).toBe(0.8); // wraps
    expect(nextPreset(5.0, -1)).toBe(2.5);
  });
});

// ─── PlayerPill DOM behavior ────────────────────────────────────────────────────
function noopCallbacks(): PlayerPillCallbacks {
  return {
    onPlayPause: vi.fn(),
    onSpeed: vi.fn(),
    onVoice: vi.fn(),
    onListening: vi.fn(),
    onStop: vi.fn(),
  };
}

describe("PlayerPill DOM", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  it("mounts a single pill with all five controls, each unfocusable", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);

    const root = container.querySelector(".se-pill");
    expect(root).not.toBeNull();
    const controls = [
      ".se-pill-play",
      ".se-pill-speed",
      ".se-pill-voice",
      ".se-pill-ear",
      ".se-pill-stop",
    ];
    for (const sel of controls) {
      const el = root!.querySelector(sel) as HTMLElement | null;
      expect(el, sel).not.toBeNull();
      expect(el!.getAttribute("tabindex")).toBe("-1");
    }
    expect(root!.querySelectorAll("button").length).toBe(5);
  });

  it("routes each control to its callback; right-click steps speed back", () => {
    const cb = noopCallbacks();
    const pill = new PlayerPill(cb);
    pill.mount(container);
    const q = (s: string) => container.querySelector(s) as HTMLElement;

    q(".se-pill-play").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onPlayPause).toHaveBeenCalledTimes(1);

    q(".se-pill-speed").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onSpeed).toHaveBeenCalledWith(1);

    const ctx = new Event("contextmenu", { bubbles: true, cancelable: true });
    q(".se-pill-speed").dispatchEvent(ctx);
    expect(cb.onSpeed).toHaveBeenCalledWith(-1);
    expect(ctx.defaultPrevented).toBe(true);

    q(".se-pill-voice").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onVoice).toHaveBeenCalledTimes(1);

    q(".se-pill-ear").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onListening).toHaveBeenCalledTimes(1);

    q(".se-pill-stop").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onStop).toHaveBeenCalledTimes(1);
  });

  it("setState swaps the play/pause glyph", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const play = container.querySelector(".se-pill-play") as HTMLElement;

    pill.setState("playing");
    expect(play.dataset.icon).toBe("pause");
    pill.setState("paused");
    expect(play.dataset.icon).toBe("play");
    pill.setState("idle");
    expect(play.dataset.icon).toBe("play");
  });

  it("setSpeed renders the current rate", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const speed = container.querySelector(".se-pill-speed") as HTMLElement;
    pill.setSpeed(1.2);
    expect(speed.textContent).toContain("1.2");
    pill.setSpeed(1.0);
    expect(speed.textContent).toContain("1");
  });

  it("setVoiceLabel sets the text and a hover title", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const voice = container.querySelector(".se-pill-voice") as HTMLElement;
    pill.setVoiceLabel("Aria");
    expect(voice.textContent).toBe("Aria");
    expect(voice.getAttribute("title")).toBe("Aria");
  });

  it("setListening toggles the ear active class", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const ear = container.querySelector(".se-pill-ear") as HTMLElement;
    pill.setListening(true);
    expect(ear.classList.contains("se-pill-ear-active")).toBe(true);
    pill.setListening(false);
    expect(ear.classList.contains("se-pill-ear-active")).toBe(false);
  });

  it("notifyTyping fades immediately and restores after the delay", () => {
    vi.useFakeTimers();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const root = container.querySelector(".se-pill") as HTMLElement;

    pill.notifyTyping();
    expect(root.classList.contains("se-pill-faded")).toBe(true);

    vi.advanceTimersByTime(1499);
    expect(root.classList.contains("se-pill-faded")).toBe(true);
    vi.advanceTimersByTime(2);
    expect(root.classList.contains("se-pill-faded")).toBe(false);
  });

  it("a fresh notifyTyping resets the restore timer", () => {
    vi.useFakeTimers();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const root = container.querySelector(".se-pill") as HTMLElement;

    pill.notifyTyping();
    vi.advanceTimersByTime(1000);
    pill.notifyTyping(); // restarts the 1.5s window
    vi.advanceTimersByTime(1000);
    expect(root.classList.contains("se-pill-faded")).toBe(true);
    vi.advanceTimersByTime(600);
    expect(root.classList.contains("se-pill-faded")).toBe(false);
  });

  it("pointer hover restores opacity instantly, before the timer fires", () => {
    vi.useFakeTimers();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const root = container.querySelector(".se-pill") as HTMLElement;

    pill.notifyTyping();
    expect(root.classList.contains("se-pill-faded")).toBe(true);
    root.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    expect(root.classList.contains("se-pill-faded")).toBe(false);
  });

  it("destroy removes the element and cancels the pending restore timer", () => {
    vi.useFakeTimers();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    pill.notifyTyping(); // schedule a timer

    pill.destroy();
    expect(container.querySelector(".se-pill")).toBeNull();
    // advancing past the restore delay must not throw on the detached element
    expect(() => vi.advanceTimersByTime(2000)).not.toThrow();
    expect(container.querySelector(".se-pill")).toBeNull();
  });
});

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

  it("routes each control to its callback; speed and voice hand off their click event", () => {
    const cb = noopCallbacks();
    const pill = new PlayerPill(cb);
    pill.mount(container);
    const q = (s: string) => container.querySelector(s) as HTMLElement;

    q(".se-pill-play").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onPlayPause).toHaveBeenCalledTimes(1);

    // Speed and voice now open menus in the host, so they hand the click event
    // (used to anchor the Obsidian Menu) straight through. No right-click gesture.
    const speedClick = new MouseEvent("click", { bubbles: true });
    q(".se-pill-speed").dispatchEvent(speedClick);
    expect(cb.onSpeed).toHaveBeenCalledTimes(1);
    expect(cb.onSpeed).toHaveBeenCalledWith(speedClick);

    const voiceClick = new MouseEvent("click", { bubbles: true });
    q(".se-pill-voice").dispatchEvent(voiceClick);
    expect(cb.onVoice).toHaveBeenCalledTimes(1);
    expect(cb.onVoice).toHaveBeenCalledWith(voiceClick);

    q(".se-pill-ear").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onListening).toHaveBeenCalledTimes(1);

    q(".se-pill-stop").dispatchEvent(new Event("click", { bubbles: true }));
    expect(cb.onStop).toHaveBeenCalledTimes(1);
  });

  it("setVoiceLoading toggles a loading class and disables the voice button", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const voice = container.querySelector(".se-pill-voice") as HTMLButtonElement;

    pill.setVoiceLoading(true);
    expect(voice.classList.contains("se-pill-voice-loading")).toBe(true);
    expect(voice.hasAttribute("disabled")).toBe(true);

    pill.setVoiceLoading(false);
    expect(voice.classList.contains("se-pill-voice-loading")).toBe(false);
    expect(voice.hasAttribute("disabled")).toBe(false);
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
    // preparing keeps the pause glyph: a press during the gap pauses/cancels
    pill.setState("preparing");
    expect(play.dataset.icon).toBe("pause");
  });

  it("setPreparing toggles the pulse class on the play control and marks the root", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const root = container.querySelector(".se-pill") as HTMLElement;
    const play = container.querySelector(".se-pill-play") as HTMLElement;
    expect(play.classList.contains("se-pill-play-preparing")).toBe(false);
    expect(root.classList.contains("se-pill-preparing")).toBe(false);
    pill.setPreparing(true);
    expect(play.classList.contains("se-pill-play-preparing")).toBe(true);
    expect(root.classList.contains("se-pill-preparing")).toBe(true);
    pill.setPreparing(false);
    expect(play.classList.contains("se-pill-play-preparing")).toBe(false);
    expect(root.classList.contains("se-pill-preparing")).toBe(false);
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

  it("setRemaining shows dim text and hides the slot when empty (spec 0010)", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const el = container.querySelector(".se-pill-remaining") as HTMLElement;
    expect(el).not.toBeNull();
    // starts hidden (no estimate yet)
    expect(el.classList.contains("se-pill-remaining-hidden")).toBe(true);
    pill.setRemaining("~12 min left");
    expect(el.textContent).toBe("~12 min left");
    expect(el.classList.contains("se-pill-remaining-hidden")).toBe(false);
    pill.setRemaining("");
    expect(el.textContent).toBe("");
    expect(el.classList.contains("se-pill-remaining-hidden")).toBe(true);
  });

  it("setEdited toggles the badge and carries the explaining title (spec 0010)", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const el = container.querySelector(".se-pill-edited") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.textContent).toBe("edited");
    // hidden by default
    expect(el.classList.contains("se-pill-edited-hidden")).toBe(true);
    pill.setEdited(true);
    expect(el.classList.contains("se-pill-edited-hidden")).toBe(false);
    expect(el.getAttribute("title")).toContain("finishing the text it started");
    pill.setEdited(false);
    expect(el.classList.contains("se-pill-edited-hidden")).toBe(true);
  });

  it("the remaining/edited slots are not buttons (still exactly five controls)", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    expect(container.querySelectorAll(".se-pill button").length).toBe(5);
  });

  it("fadeOutAndRemove adds the leaving class and removes on the 300ms fallback", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const root = container.querySelector(".se-pill") as HTMLElement;
    pill.fadeOutAndRemove(cb);
    expect(root.classList.contains("se-pill-leaving")).toBe(true);
    expect(cb).not.toHaveBeenCalled();
    expect(container.querySelector(".se-pill")).not.toBeNull();
    vi.advanceTimersByTime(300);
    expect(container.querySelector(".se-pill")).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fadeOutAndRemove removes on an opacity transitionend, once, cancelling the fallback", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    const root = container.querySelector(".se-pill") as HTMLElement;
    pill.fadeOutAndRemove(cb);
    // a non-opacity transition is ignored
    const other = new Event("transitionend") as any;
    other.propertyName = "transform";
    root.dispatchEvent(other);
    expect(container.querySelector(".se-pill")).not.toBeNull();
    // the opacity transition end removes it
    const opacityEnd = new Event("transitionend") as any;
    opacityEnd.propertyName = "opacity";
    root.dispatchEvent(opacityEnd);
    expect(container.querySelector(".se-pill")).toBeNull();
    expect(cb).toHaveBeenCalledTimes(1);
    // the 300ms fallback must not fire a second removal/callback
    vi.advanceTimersByTime(300);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fadeOutAndRemove on an already-destroyed pill calls back immediately", () => {
    const cb = vi.fn();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    pill.destroy();
    pill.fadeOutAndRemove(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("destroy after fadeOutAndRemove is safe and does not double-call the callback", () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(container);
    pill.fadeOutAndRemove(cb);
    expect(() => pill.destroy()).not.toThrow();
    vi.advanceTimersByTime(300);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".se-pill")).toBeNull();
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
describe("ear label (spec 0011)", () => {
  it("renders the listening word inside the ear control and tracks the mode", () => {
    const pill = new PlayerPill(noopCallbacks());
    pill.mount(document.body);
    const label = document.querySelector(".se-pill-ear .se-pill-ear-label");
    expect(label?.textContent).toBe("listening");
    pill.setListening(true);
    expect(document.querySelector(".se-pill-ear")?.classList.contains("se-pill-ear-active")).toBe(true);
    pill.setListening(false);
    expect(document.querySelector(".se-pill-ear")?.classList.contains("se-pill-ear-off")).toBe(true);
    pill.destroy();
  });
});


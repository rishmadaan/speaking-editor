// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { speedMenuModel, voiceMenuModel, formatSpeedTitle } from "./pill-menus";
import { SPEED_PRESETS } from "./player-pill";
import { ProviderDescriptor } from "../engine/synthesis/provider-catalog";
import { VoiceInfo } from "../engine/synthesis/provider";

// ─── formatSpeedTitle ──────────────────────────────────────────────────────────
describe("formatSpeedTitle", () => {
  it("renders whole rates without a trailing zero and others to two places", () => {
    expect(formatSpeedTitle(1.0)).toBe("1x");
    expect(formatSpeedTitle(1.2)).toBe("1.2x");
    expect(formatSpeedTitle(2.5)).toBe("2.5x");
    expect(formatSpeedTitle(0.8)).toBe("0.8x");
  });
});

// ─── speedMenuModel ────────────────────────────────────────────────────────────
describe("speedMenuModel", () => {
  it("emits one item per preset in order plus a trailing settings escape hatch", () => {
    const model = speedMenuModel(1.0);
    expect(model.length).toBe(SPEED_PRESETS.length + 1);

    // preset items carry an apply-speed action with the matching preset
    for (let i = 0; i < SPEED_PRESETS.length; i++) {
      expect(model[i].action).toEqual({ type: "apply-speed", speed: SPEED_PRESETS[i] });
      expect(model[i].title).toBe(formatSpeedTitle(SPEED_PRESETS[i]));
    }
    // final item opens the settings tab, never checked
    const last = model[model.length - 1];
    expect(last.action).toEqual({ type: "open-settings" });
    expect(last.title).toBe("Fine-tune in settings");
    expect(last.checked).toBe(false);
  });

  it("checks exactly the item matching the current speed", () => {
    const model = speedMenuModel(1.2);
    const checked = model.filter((i) => i.checked);
    expect(checked.length).toBe(1);
    expect(checked[0].action).toEqual({ type: "apply-speed", speed: 1.2 });
  });

  it("checks nothing when the current speed is off the preset grid", () => {
    const model = speedMenuModel(1.3);
    expect(model.some((i) => i.checked)).toBe(false);
  });
});

// ─── voiceMenuModel ────────────────────────────────────────────────────────────
const PROVIDERS: ProviderDescriptor[] = [
  { id: "edge", label: "Edge TTS", description: "", requiresKey: false },
  { id: "elevenlabs", label: "ElevenLabs", description: "", requiresKey: true },
  { id: "say", label: "macOS say", description: "", requiresKey: false, darwinOnly: true },
];
const VOICES: VoiceInfo[] = [
  { id: "aria", label: "Aria" },
  { id: "guy", label: "Guy" },
];

describe("voiceMenuModel", () => {
  it("marks the active provider checked and appends '(needs key)' to a key-less premium provider", () => {
    const model = voiceMenuModel(PROVIDERS, "edge", VOICES, "guy", (id) => id !== "elevenlabs" /* elevenlabs has no key */);
    expect(model.providers).toEqual([
      { id: "edge", title: "Edge TTS", checked: true, needsKey: false },
      { id: "elevenlabs", title: "ElevenLabs (needs key)", checked: false, needsKey: true },
      { id: "say", title: "macOS say", checked: false, needsKey: false },
    ]);
  });

  it("drops the needs-key marker once the premium provider has a key", () => {
    const model = voiceMenuModel(PROVIDERS, "elevenlabs", VOICES, "guy", () => true);
    const el = model.providers.find((p) => p.id === "elevenlabs")!;
    expect(el.title).toBe("ElevenLabs");
    expect(el.needsKey).toBe(false);
    expect(el.checked).toBe(true);
  });

  it("maps voices to items with the current voice checked", () => {
    const model = voiceMenuModel(PROVIDERS, "edge", VOICES, "guy", () => true);
    expect(model.voices).toEqual([
      { id: "aria", title: "Aria", checked: false },
      { id: "guy", title: "Guy", checked: true },
    ]);
  });

  it("handles an empty voice list", () => {
    const model = voiceMenuModel(PROVIDERS, "edge", [], "guy", () => true);
    expect(model.voices).toEqual([]);
  });
});

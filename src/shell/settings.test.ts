import { describe, it, expect } from "vitest";
import {
  DEFAULT_SETTINGS,
  mergeSettings,
  voiceForProvider,
  rememberVoice,
  SpeakingEditorSettings,
  CACHE_SIZE_CHOICES,
} from "./settings";

describe("DEFAULT_SETTINGS", () => {
  it("is edge, empty voice memory, 1.0, listening on", () => {
    expect(DEFAULT_SETTINGS.providerId).toBe("edge");
    expect(DEFAULT_SETTINGS.voiceByProvider).toEqual({});
    expect(DEFAULT_SETTINGS.speed).toBe(1.0);
    expect(DEFAULT_SETTINGS.listeningMode).toBe(true);
    expect(DEFAULT_SETTINGS.cacheSizeMb).toBe(200);
  });

  it("carries no api key field of any kind", () => {
    expect(Object.keys(DEFAULT_SETTINGS)).toEqual(
      expect.arrayContaining(["providerId", "voiceByProvider", "speed", "listeningMode"])
    );
    expect(JSON.stringify(DEFAULT_SETTINGS).toLowerCase()).not.toMatch(/key|secret|token/);
  });
});

describe("mergeSettings", () => {
  it("returns defaults for null / undefined / empty", () => {
    expect(mergeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("fills only the missing fields from a partial", () => {
    const merged = mergeSettings({ speed: 1.5 });
    expect(merged.speed).toBe(1.5);
    expect(merged.providerId).toBe("edge");
    expect(merged.listeningMode).toBe(true);
    expect(merged.voiceByProvider).toEqual({});
  });

  it("keeps a saved provider, speed, and listening flag", () => {
    const merged = mergeSettings({ providerId: "say", speed: 2, listeningMode: false });
    expect(merged.providerId).toBe("say");
    expect(merged.speed).toBe(2);
    expect(merged.listeningMode).toBe(false);
  });

  it("preserves the saved per-provider voice map", () => {
    const merged = mergeSettings({ voiceByProvider: { edge: "en-GB-SoniaNeural", say: "Daniel" } });
    expect(merged.voiceByProvider).toEqual({ edge: "en-GB-SoniaNeural", say: "Daniel" });
  });

  it("does not mutate the saved object", () => {
    const saved = { voiceByProvider: { edge: "x" } };
    const merged = mergeSettings(saved);
    merged.voiceByProvider.say = "y";
    expect(saved.voiceByProvider).toEqual({ edge: "x" });
  });

  it("ignores unknown extra fields", () => {
    const merged = mergeSettings({ speed: 1.2, elevenLabsKey: "leak", junk: 5 } as any);
    expect(merged).toEqual({ ...DEFAULT_SETTINGS, speed: 1.2 });
    expect(JSON.stringify(merged)).not.toContain("leak");
  });
});

describe("cacheSizeMb", () => {
  it("offers the four documented choices with 200 the default", () => {
    expect(CACHE_SIZE_CHOICES).toEqual([50, 200, 500, 1000]);
    expect(DEFAULT_SETTINGS.cacheSizeMb).toBe(200);
  });

  it("keeps a valid saved choice and defaults an invalid one", () => {
    expect(mergeSettings({ cacheSizeMb: 500 }).cacheSizeMb).toBe(500);
    expect(mergeSettings({ cacheSizeMb: 1000 }).cacheSizeMb).toBe(1000);
    // not one of the choices -> default
    expect(mergeSettings({ cacheSizeMb: 137 } as any).cacheSizeMb).toBe(200);
    expect(mergeSettings({ cacheSizeMb: "500" } as any).cacheSizeMb).toBe(200);
  });

  it("defaults cacheSizeMb for old payloads that lack it", () => {
    expect(mergeSettings({ providerId: "say" }).cacheSizeMb).toBe(200);
  });
});

describe("seekHintsShown", () => {
  it("defaults to 0", () => {
    expect(DEFAULT_SETTINGS.seekHintsShown).toBe(0);
    expect(mergeSettings({}).seekHintsShown).toBe(0);
  });

  it("defaults seekHintsShown for old payloads that lack it (mergeSettings stays green)", () => {
    expect(mergeSettings({ providerId: "say", speed: 2 }).seekHintsShown).toBe(0);
  });

  it("keeps a valid saved count and floors it", () => {
    expect(mergeSettings({ seekHintsShown: 2 }).seekHintsShown).toBe(2);
    expect(mergeSettings({ seekHintsShown: 3 }).seekHintsShown).toBe(3);
    expect(mergeSettings({ seekHintsShown: 2.9 } as any).seekHintsShown).toBe(2);
  });

  it("clamps a negative, non-number, or non-finite count to 0", () => {
    expect(mergeSettings({ seekHintsShown: -1 } as any).seekHintsShown).toBe(0);
    expect(mergeSettings({ seekHintsShown: "3" } as any).seekHintsShown).toBe(0);
    expect(mergeSettings({ seekHintsShown: NaN } as any).seekHintsShown).toBe(0);
  });
});

describe("voiceForProvider", () => {
  it("returns the remembered voice when one exists", () => {
    const s: SpeakingEditorSettings = { ...DEFAULT_SETTINGS, voiceByProvider: { edge: "en-GB-SoniaNeural" } };
    expect(voiceForProvider(s, "edge", "en-US-AriaNeural")).toBe("en-GB-SoniaNeural");
  });

  it("falls back to the provider default when nothing is remembered", () => {
    expect(voiceForProvider(DEFAULT_SETTINGS, "elevenlabs", "21m00Tcm4TlvDq8ikWAM")).toBe(
      "21m00Tcm4TlvDq8ikWAM"
    );
  });
});

describe("rememberVoice round trip", () => {
  it("stores a voice per provider and restores it after switching away and back", () => {
    let s = DEFAULT_SETTINGS;
    s = rememberVoice(s, "edge", "en-GB-SoniaNeural");
    s = rememberVoice(s, "say", "Daniel");
    // switching provider away and back is a providerId change; the voice memory persists
    expect(voiceForProvider(s, "edge", "en-US-AriaNeural")).toBe("en-GB-SoniaNeural");
    expect(voiceForProvider(s, "say", "Samantha")).toBe("Daniel");
  });

  it("returns a new object and does not mutate the input", () => {
    const s = DEFAULT_SETTINGS;
    const next = rememberVoice(s, "edge", "en-GB-SoniaNeural");
    expect(next).not.toBe(s);
    expect(s.voiceByProvider).toEqual({});
    expect(next.voiceByProvider).toEqual({ edge: "en-GB-SoniaNeural" });
  });

  it("overwrites the same provider's remembered voice", () => {
    let s = rememberVoice(DEFAULT_SETTINGS, "edge", "a");
    s = rememberVoice(s, "edge", "b");
    expect(s.voiceByProvider).toEqual({ edge: "b" });
  });
});
describe("firstPlayTipShown (spec 0011)", () => {
  it("defaults false and merges a saved true", () => {
    expect(mergeSettings(undefined).firstPlayTipShown).toBe(false);
    expect(mergeSettings({ firstPlayTipShown: true }).firstPlayTipShown).toBe(true);
    expect(mergeSettings({ firstPlayTipShown: "yes" }).firstPlayTipShown).toBe(false);
  });
});


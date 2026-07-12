import { describe, it, expect } from "vitest";
import { buildProvider, availableProviders, defaultVoiceFor } from "./providers";
import { EdgeProvider } from "../engine/synthesis/edge";
import { SayProvider } from "../engine/synthesis/say";
import { ElevenLabsProvider } from "../engine/synthesis/elevenlabs";
import { KeyStore, StorageLike } from "./key-store";

function fakeStorage(seed: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem: (k) => (map.has(k) ? map.get(k)! : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("buildProvider", () => {
  it("builds Edge with no arguments", () => {
    const p = buildProvider("edge", new KeyStore(fakeStorage()));
    expect(p).toBeInstanceOf(EdgeProvider);
    expect(p.id).toBe("edge");
  });

  it("builds macOS say with no arguments", () => {
    const p = buildProvider("say", new KeyStore(fakeStorage()));
    expect(p).toBeInstanceOf(SayProvider);
    expect(p.id).toBe("say");
  });

  it("builds ElevenLabs with the key pulled from the key store", () => {
    const store = new KeyStore(fakeStorage({ "speaking-editor:key:elevenlabs": "sk-secret" }));
    const p = buildProvider("elevenlabs", store);
    expect(p).toBeInstanceOf(ElevenLabsProvider);
    expect((p as any).apiKey).toBe("sk-secret");
  });

  it("builds ElevenLabs with an empty key when none is stored", () => {
    const p = buildProvider("elevenlabs", new KeyStore(fakeStorage()));
    expect(p).toBeInstanceOf(ElevenLabsProvider);
    expect((p as any).apiKey).toBe("");
  });

  it("defaults an unknown or unsurfaced provider id to Edge (never the say default)", () => {
    expect(buildProvider("openai", new KeyStore(fakeStorage()))).toBeInstanceOf(EdgeProvider);
    expect(buildProvider("nonsense", new KeyStore(fakeStorage()))).toBeInstanceOf(EdgeProvider);
  });
});

describe("availableProviders", () => {
  it("on macOS surfaces edge, elevenlabs, and say (openai/sarvam stay unsurfaced)", () => {
    const ids = availableProviders("darwin").map((p) => p.id);
    expect(ids).toEqual(["edge", "elevenlabs", "say"]);
  });

  it("off macOS drops say and still hides openai/sarvam", () => {
    expect(availableProviders("linux").map((p) => p.id)).toEqual(["edge", "elevenlabs"]);
    expect(availableProviders("win32").map((p) => p.id)).toEqual(["edge", "elevenlabs"]);
  });

  it("leads with edge on every platform (default provider identity)", () => {
    expect(availableProviders("darwin")[0].id).toBe("edge");
    expect(availableProviders("linux")[0].id).toBe("edge");
  });
});

describe("defaultVoiceFor", () => {
  it("returns the provider's own default voice", () => {
    expect(defaultVoiceFor(new EdgeProvider())).toBe("en-US-AriaNeural");
    expect(defaultVoiceFor(new SayProvider())).toBe("Samantha");
  });
});

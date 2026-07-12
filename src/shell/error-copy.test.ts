import { describe, it, expect } from "vitest";
import { mapProviderError } from "./error-copy";

const RAW = "ECONNRESET: socket hang up at TLSSocket._onError";

describe("mapProviderError", () => {
  it("macOS + a network provider offers the offline fallback, naming the voice", () => {
    const { sentence, action } = mapProviderError("edge", "Edge TTS", "darwin", new Error(RAW));
    expect(action).toBe("offline-fallback");
    expect(sentence).toBe("The free Edge voice could not be reached.");
  });

  it("macOS + ElevenLabs also offers the offline fallback", () => {
    const { sentence, action } = mapProviderError("elevenlabs", "ElevenLabs", "darwin", new Error(RAW));
    expect(action).toBe("offline-fallback");
    expect(sentence).toBe("The ElevenLabs voice could not be reached.");
  });

  it("off macOS there is no say to fall back to, so it opens settings", () => {
    // the say-not-available-off-macOS branch: same provider, different platform
    for (const platform of ["linux", "win32"] as NodeJS.Platform[]) {
      const { sentence, action } = mapProviderError("edge", "Edge TTS", platform, new Error(RAW));
      expect(action).toBe("open-settings");
      expect(sentence).toBe("The free Edge voice could not be reached.");
    }
  });

  it("the say provider failing on macOS opens settings (no falling back to itself)", () => {
    const { sentence, action } = mapProviderError("say", "macOS say", "darwin", new Error(RAW));
    expect(action).toBe("open-settings");
    expect(sentence).toBe("The offline macOS voice could not be started.");
  });

  it("an unsurfaced provider still reads as a plain sentence via its label", () => {
    const { sentence, action } = mapProviderError("sarvam", "Sarvam AI", "darwin", new Error(RAW));
    expect(action).toBe("offline-fallback");
    expect(sentence).toBe("The Sarvam AI voice could not be reached.");
  });

  it("never leaks the raw exception text into the sentence", () => {
    for (const platform of ["darwin", "linux", "win32"] as NodeJS.Platform[]) {
      for (const id of ["edge", "elevenlabs", "openai", "say"]) {
        const { sentence } = mapProviderError(id, id, platform, new Error(RAW));
        expect(sentence).not.toContain("ECONNRESET");
        expect(sentence).not.toContain("socket");
        expect(sentence).not.toContain("TLSSocket");
      }
    }
  });
});

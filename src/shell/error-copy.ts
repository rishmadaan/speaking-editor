// Turn a synthesis failure into human error copy plus the one way out to offer.
// Pure: no DOM, no Notice, no Obsidian. The raw exception is never woven into the
// sentence (it goes to console.error at the call site); the user reads a plain
// line naming the voice that failed, and gets a single action.
//
// The action fork: on macOS, any non-"say" provider can fall back to the offline
// macOS voice, so we offer that ("offline-fallback"). Off macOS the "say" provider
// does not exist, so there is nothing to fall back to and we send the user to
// settings ("open-settings"); "say" itself failing (only possible on macOS) also
// routes to settings, since falling back to the thing that just failed is no fix.

export type ErrorActionKind = "offline-fallback" | "open-settings";

export interface ErrorCopy {
  sentence: string;
  action: ErrorActionKind;
}

// A friendly noun phrase for the provider, keyed by id with a label fallback so an
// unsurfaced provider still reads as a real sentence.
function providerPhrase(providerId: string, providerLabel: string): string {
  switch (providerId) {
    case "edge":
      return "The free Edge voice";
    case "elevenlabs":
      return "The ElevenLabs voice";
    case "openai":
      return "The OpenAI voice";
    case "say":
      return "The offline macOS voice";
    default:
      return `The ${providerLabel} voice`;
  }
}

export function mapProviderError(
  providerId: string,
  providerLabel: string,
  platform: NodeJS.Platform,
  _error: unknown
): ErrorCopy {
  const phrase = providerPhrase(providerId, providerLabel);
  // "say" is local, so it "could not be started"; every other provider is fetched
  // over the network, so it "could not be reached". No exception text either way.
  const sentence =
    providerId === "say"
      ? `${phrase} could not be started.`
      : `${phrase} could not be reached.`;
  // Offline fallback is only real on macOS for a non-say provider.
  const action: ErrorActionKind =
    platform === "darwin" && providerId !== "say" ? "offline-fallback" : "open-settings";
  return { sentence, action };
}

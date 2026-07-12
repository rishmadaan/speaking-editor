// Construct the vendored provider adapters from a provider id + the key store,
// and surface the subset of the catalog this slice supports. The parent product
// defaults macOS to "say" for reliability; Speaking Editor's identity is exact
// word sync, so our default provider is "edge" on EVERY platform. We resolve our
// own default here and use the catalog for availability/labels only, never
// letting the vendored darwin "say" default leak through.
import { TtsProvider } from "../engine/synthesis/provider";
import { EdgeProvider } from "../engine/synthesis/edge";
import { SayProvider } from "../engine/synthesis/say";
import { ElevenLabsProvider } from "../engine/synthesis/elevenlabs";
import {
  availableProviders as catalogAvailable,
  ProviderDescriptor,
  PROVIDER_CATALOG,
} from "../engine/synthesis/provider-catalog";
import { KeyStore } from "./key-store";

export const DEFAULT_PROVIDER_ID = "edge";

// Providers wired in this slice; OpenAI and Sarvam adapters stay unsurfaced.
const SURFACED_PROVIDER_IDS = new Set(["edge", "elevenlabs", "say"]);

// Build the constructed adapter. Unknown or unsurfaced ids resolve to Edge (our
// default), never to the vendored say default.
export function buildProvider(providerId: string, keyStore: KeyStore): TtsProvider {
  switch (providerId) {
    case "edge":
      return new EdgeProvider();
    case "say":
      return new SayProvider();
    case "elevenlabs":
      return new ElevenLabsProvider(keyStore.get("elevenlabs") ?? "");
    default:
      return new EdgeProvider();
  }
}

// Catalog entries valid on this platform AND surfaced in this slice, in display
// order (edge leads everywhere).
export function availableProviders(
  platform: NodeJS.Platform = process.platform
): ProviderDescriptor[] {
  return catalogAvailable(platform).filter((p) => SURFACED_PROVIDER_IDS.has(p.id));
}

export function defaultVoiceFor(provider: TtsProvider): string {
  return provider.defaultVoice;
}

// The display label for a provider id (for error copy and menus), from the
// catalog; falls back to the raw id for an unknown provider.
export function providerLabel(providerId: string): string {
  return PROVIDER_CATALOG.find((p) => p.id === providerId)?.label ?? providerId;
}

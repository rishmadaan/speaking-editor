// The persisted settings model (goes to data.json via saveData). Pure functions
// and types only: no api keys ever live here (keys go to the KeyStore /
// localStorage), so a synced vault never carries a secret. Per-provider voice
// memory lets switching provider away and back restore that provider's voice.

export interface SpeakingEditorSettings {
  providerId: string;
  voiceByProvider: Record<string, string>;
  speed: number;
  listeningMode: boolean;
}

export const DEFAULT_SETTINGS: SpeakingEditorSettings = {
  providerId: "edge",
  voiceByProvider: {},
  speed: 1.0,
  listeningMode: true,
};

// Merge partial saved data over the defaults, reading only known fields so an
// unknown or stray key (e.g. a mistakenly persisted secret) can never survive.
export function mergeSettings(saved: unknown): SpeakingEditorSettings {
  const s = (saved ?? {}) as Partial<SpeakingEditorSettings>;
  return {
    providerId: typeof s.providerId === "string" ? s.providerId : DEFAULT_SETTINGS.providerId,
    voiceByProvider:
      s.voiceByProvider && typeof s.voiceByProvider === "object"
        ? { ...s.voiceByProvider }
        : {},
    speed: typeof s.speed === "number" ? s.speed : DEFAULT_SETTINGS.speed,
    listeningMode:
      typeof s.listeningMode === "boolean" ? s.listeningMode : DEFAULT_SETTINGS.listeningMode,
  };
}

// The voice to use for a provider: its remembered value, else the provider's own
// default voice.
export function voiceForProvider(
  settings: SpeakingEditorSettings,
  providerId: string,
  providerDefaultVoice: string
): string {
  return settings.voiceByProvider[providerId] ?? providerDefaultVoice;
}

// Return new settings with the provider's remembered voice updated (immutable).
export function rememberVoice(
  settings: SpeakingEditorSettings,
  providerId: string,
  voice: string
): SpeakingEditorSettings {
  return {
    ...settings,
    voiceByProvider: { ...settings.voiceByProvider, [providerId]: voice },
  };
}

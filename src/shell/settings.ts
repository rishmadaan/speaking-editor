// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// The persisted settings model (goes to data.json via saveData). Pure functions
// and types only: no api keys ever live here (keys go to the KeyStore /
// localStorage), so a synced vault never carries a secret. Per-provider voice
// memory lets switching provider away and back restore that provider's voice.

export interface SpeakingEditorSettings {
  providerId: string;
  voiceByProvider: Record<string, string>;
  speed: number;
  listeningMode: boolean;
  // Disk-cache size cap in megabytes. One of CACHE_SIZE_CHOICES.
  cacheSizeMb: number;
  // How many times the first-jump teaching hint has shown. Counts up to 3 then
  // stops forever (see hint.ts). Persisted so the lesson is not re-taught across
  // restarts; resetting is deliberately not surfaced in the UI.
  seekHintsShown: number;
  // One-time tip on the first play ever ("click any word to jump").
  firstPlayTipShown: boolean;
}

// The offered "Audio cache size" choices, in MB; 200 is the default.
export const CACHE_SIZE_CHOICES = [50, 200, 500, 1000] as const;

export const DEFAULT_SETTINGS: SpeakingEditorSettings = {
  providerId: "edge",
  voiceByProvider: {},
  speed: 1.0,
  listeningMode: true,
  cacheSizeMb: 200,
  seekHintsShown: 0,
  firstPlayTipShown: false,
};

// NOTE ON DATA.JSON SHAPE: the persisted payload is the settings object's fields
// PLUS a sibling `positions` map (see positions.ts), i.e.
// { providerId, voiceByProvider, speed, listeningMode, cacheSizeMb, positions }.
// Positions live outside the SpeakingEditorSettings shape on purpose: they are
// per-note runtime state, not user preferences, so mergeSettings never reads or
// writes them and old payloads (no positions / no cacheSizeMb) stay valid.

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
    cacheSizeMb: (CACHE_SIZE_CHOICES as readonly number[]).includes(s.cacheSizeMb as number)
      ? (s.cacheSizeMb as number)
      : DEFAULT_SETTINGS.cacheSizeMb,
    // A non-negative integer, else 0. Clamps a stray/negative payload so the gate
    // stays sane; old payloads without the field default to 0 (hint still teaches).
    seekHintsShown:
      typeof s.seekHintsShown === "number" && Number.isFinite(s.seekHintsShown) && s.seekHintsShown >= 0
        ? Math.floor(s.seekHintsShown)
        : DEFAULT_SETTINGS.seekHintsShown,
    firstPlayTipShown:
      typeof s.firstPlayTipShown === "boolean" ? s.firstPlayTipShown : DEFAULT_SETTINGS.firstPlayTipShown,
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

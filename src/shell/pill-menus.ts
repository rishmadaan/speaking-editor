// Menu models for the pill's speed and voice controls, plus the tiny Obsidian
// Menu renderers over them and the async voice-menu flow. The MODELS carry all
// the logic (titles, checked flags, needs-key routing) and are unit-tested; the
// renderers are dumb glue exercised only in-app; the async flow orchestrates the
// uncached-voice resolve with a transient loading state on the pill. The pill
// itself stays Obsidian-free, so all Menu contact lives here and in main.ts.
import type { Menu } from "obsidian";
import { SPEED_PRESETS } from "./player-pill";
import type { ProviderDescriptor } from "../engine/synthesis/provider-catalog";
import type { TtsProvider, VoiceInfo } from "../engine/synthesis/provider";
import type { VoiceCache } from "../engine/synthesis/voice-cache";

// Float slop when matching a live speed to a preset (speeds are stored as the
// preset values, but keep the compare tolerant so 1.2000001 still checks 1.2x).
const SPEED_EPS = 1e-9;

// ─── Speed menu model ──────────────────────────────────────────────────────────

export type SpeedMenuAction =
  | { type: "apply-speed"; speed: number }
  | { type: "open-settings" };

export interface SpeedMenuItem {
  title: string; // "1.2x"
  checked: boolean;
  action: SpeedMenuAction;
}

// "1x", "1.2x", "2.5x": whole rates lose the trailing zero (matches the pill label).
export function formatSpeedTitle(rate: number): string {
  return `${Number(rate.toFixed(2))}x`;
}

// One item per preset (the current speed checked) then a "Fine-tune in settings"
// escape hatch that opens the settings tab for anything off the preset grid.
export function speedMenuModel(currentSpeed: number): SpeedMenuItem[] {
  const items: SpeedMenuItem[] = SPEED_PRESETS.map((speed) => ({
    title: formatSpeedTitle(speed),
    checked: Math.abs(speed - currentSpeed) < SPEED_EPS,
    action: { type: "apply-speed", speed },
  }));
  items.push({ title: "Fine-tune in settings", checked: false, action: { type: "open-settings" } });
  return items;
}

// ─── Voice menu model ──────────────────────────────────────────────────────────

export interface VoiceMenuProviderItem {
  id: string;
  title: string; // provider label, with " (needs key)" when it needs a key it lacks
  checked: boolean; // the active provider
  needsKey: boolean; // requires a key but has none: a pick opens settings, not a switch
}

export interface VoiceMenuVoiceItem {
  id: string;
  title: string; // the voice label
  checked: boolean; // the current voice
}

export interface VoiceMenuModel {
  providers: VoiceMenuProviderItem[];
  voices: VoiceMenuVoiceItem[];
}

// The two-section voice menu: providers (active checked, key-less premium ones
// flagged) then the active provider's voices (current checked).
export function voiceMenuModel(
  providers: ProviderDescriptor[],
  activeId: string,
  voices: VoiceInfo[],
  currentVoice: string,
  hasKey: (providerId: string) => boolean
): VoiceMenuModel {
  return {
    providers: providers.map((p) => {
      const needsKey = p.requiresKey && !hasKey(p.id);
      return {
        id: p.id,
        title: needsKey ? `${p.label} (needs key)` : p.label,
        checked: p.id === activeId,
        needsKey,
      };
    }),
    voices: voices.map((v) => ({
      id: v.id,
      title: v.label,
      checked: v.id === currentVoice,
    })),
  };
}

// ─── Renderers (dumb glue over an Obsidian Menu; untested, exercised in-app) ─────

export interface SpeedMenuHandlers {
  applySpeed: (speed: number) => void;
  openSettings: () => void;
}

export function renderSpeedMenu(menu: Menu, items: SpeedMenuItem[], handlers: SpeedMenuHandlers): void {
  for (const item of items) {
    const action = item.action;
    if (action.type === "open-settings") menu.addSeparator();
    menu.addItem((mi) => {
      mi.setTitle(item.title);
      if (action.type === "apply-speed") mi.setChecked(item.checked);
      mi.onClick(() => {
        if (action.type === "apply-speed") handlers.applySpeed(action.speed);
        else handlers.openSettings();
      });
    });
  }
}

export interface VoiceMenuHandlers {
  applyProvider: (providerId: string) => void;
  applyVoice: (voice: string) => void;
  openSettings: () => void;
}

export function renderVoiceMenu(menu: Menu, model: VoiceMenuModel, handlers: VoiceMenuHandlers): void {
  for (const p of model.providers) {
    menu.addItem((mi) => {
      mi.setTitle(p.title)
        .setChecked(p.checked)
        .onClick(() => {
          // A key-less premium provider cannot be switched to blind: send the
          // user to settings to paste a key instead of silently doing nothing.
          if (p.needsKey) handlers.openSettings();
          else handlers.applyProvider(p.id);
        });
    });
  }
  if (model.voices.length > 0) menu.addSeparator();
  for (const v of model.voices) {
    menu.addItem((mi) => {
      mi.setTitle(v.title)
        .setChecked(v.checked)
        .onClick(() => handlers.applyVoice(v.id));
    });
  }
}

// ─── Async voice-menu flow (used by main.ts) ─────────────────────────────────────

export interface OpenVoiceMenuDeps {
  activeProviderId: string;
  provider: TtsProvider; // the active provider adapter (listVoices + defaultVoice)
  voiceCache: VoiceCache;
  providers: ProviderDescriptor[];
  currentVoice: string;
  hasKey: (providerId: string) => boolean;
  handlers: VoiceMenuHandlers;
  setVoiceLoading: (on: boolean) => void;
  buildMenu: () => Menu;
  showMenu: (menu: Menu) => void;
}

// Resolve the active provider's voices (cache hit, else fetch with a brief
// loading state on the pill), fall back to the provider default on a fetch
// failure, then build and show the voice menu. Loading is always cleared, even
// when the fetch throws, so the pill's voice button never stays disabled.
export async function openVoiceMenu(deps: OpenVoiceMenuDeps): Promise<void> {
  deps.setVoiceLoading(true);
  let voices: VoiceInfo[];
  try {
    voices = await deps.voiceCache.resolve(deps.activeProviderId, () => deps.provider.listVoices());
  } catch {
    voices = [{ id: deps.provider.defaultVoice, label: deps.provider.defaultVoice }];
  } finally {
    deps.setVoiceLoading(false);
  }
  const model = voiceMenuModel(deps.providers, deps.activeProviderId, voices, deps.currentVoice, deps.hasKey);
  const menu = deps.buildMenu();
  renderVoiceMenu(menu, model, deps.handlers);
  deps.showMenu(menu);
}

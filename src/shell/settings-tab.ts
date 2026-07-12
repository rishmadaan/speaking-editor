// The Settings -> Speaking Editor tab: pick a provider and voice, set speed,
// toggle listening mode, and store a premium key per device. Plain-language copy,
// no jargon. Keys go through the KeyStore (localStorage) and are never rendered
// back as text. Voices fill asynchronously through the vendored VoiceCache so the
// tab opens instantly and shows the remembered value while it loads.
import { App, PluginSettingTab, Setting } from "obsidian";
import type SpeakingEditorPlugin from "./main";
import { availableProviders, buildProvider } from "./providers";
import { voiceForProvider } from "./settings";
import { VoiceInfo } from "../engine/synthesis/provider";

export class SpeakingEditorSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: SpeakingEditorPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    const settings = this.plugin.settings;
    const provider = buildProvider(settings.providerId, this.plugin.keyStore);

    new Setting(containerEl)
      .setName("Voice provider")
      .setDesc("Where the spoken audio comes from. Edge is free and keeps words in exact sync.")
      .addDropdown((dd) => {
        for (const p of availableProviders()) dd.addOption(p.id, p.label);
        dd.setValue(settings.providerId);
        dd.onChange(async (id) => {
          await this.plugin.applyProvider(id);
          this.display(); // refresh the voice list and key field for the new provider
        });
      });

    const currentVoice = voiceForProvider(settings, settings.providerId, provider.defaultVoice);
    new Setting(containerEl)
      .setName("Voice")
      .setDesc("The specific voice to read in.")
      .addDropdown((dd) => {
        // While voices load, show the remembered value so the control is never empty.
        dd.addOption(currentVoice, currentVoice);
        dd.setValue(currentVoice);
        dd.onChange((voice) => void this.plugin.applyVoice(settings.providerId, voice));

        const fill = (voices: VoiceInfo[]) => {
          dd.selectEl.empty();
          for (const v of voices) dd.addOption(v.id, v.label);
          // keep the remembered value selectable even if the list does not include it
          if (!voices.some((v) => v.id === currentVoice)) dd.addOption(currentVoice, currentVoice);
          dd.setValue(currentVoice);
        };

        // The vendored cache never stores a fetch failure, so a transient error
        // can be retried; on failure we fall back to the provider's default voice.
        this.plugin.voiceCache
          .resolve(settings.providerId, () => provider.listVoices())
          .then(fill)
          .catch(() => fill([{ id: provider.defaultVoice, label: provider.defaultVoice }]));
      });

    const speedSetting = new Setting(containerEl)
      .setName("Reading speed")
      .setDesc(speedDesc(settings.speed));
    speedSetting.addSlider((sl) => {
      sl.setLimits(0.5, 3.0, 0.1);
      sl.setValue(settings.speed);
      sl.setInstant(true);
      sl.onChange((v) => {
        speedSetting.setDesc(speedDesc(v));
        void this.plugin.applySpeed(v);
      });
    });

    new Setting(containerEl)
      .setName("Listening mode")
      .setDesc("When on, clicking a word jumps the reading there. When off, clicking edits as normal.")
      .addToggle((tg) => {
        tg.setValue(settings.listeningMode);
        tg.onChange(async (on) => {
          this.plugin.settings.listeningMode = on;
          await this.plugin.saveSettings();
        });
      });

    // Only providers that need a key show the key field, and only for the one in
    // use. In this slice that is ElevenLabs.
    if (provider.requiresKey) {
      const hasKey = this.plugin.keyStore.has(settings.providerId);
      const keySetting = new Setting(containerEl)
        .setName(`${provider.label} API key`)
        .setDesc(
          hasKey
            ? "A key is saved on this device. Paste a new one to replace it."
            : "No key saved. Paste your key to use this provider. Keys stay on this device and are never synced."
        );
      keySetting.addText((tx) => {
        tx.inputEl.type = "password";
        tx.setPlaceholder(hasKey ? "Saved (hidden)" : "Paste key");
        tx.onChange((val) => {
          const key = val.trim();
          if (!key) return;
          this.plugin.keyStore.set(settings.providerId, key);
          // a new key may surface a different voice list (e.g. a new plan tier)
          this.plugin.voiceCache.invalidate(settings.providerId);
        });
      });
      keySetting.addExtraButton((btn) => {
        btn
          .setIcon("trash")
          .setTooltip("Clear the saved key")
          .onClick(() => {
            this.plugin.keyStore.clear(settings.providerId);
            this.plugin.voiceCache.invalidate(settings.providerId);
            this.display();
          });
      });
    }
  }
}

function speedDesc(speed: number): string {
  return `How fast to read. Currently ${speed.toFixed(1)}x.`;
}

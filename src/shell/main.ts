// The Speaking Editor plugin: registers the sync-field editor extension, wires a
// ReadingSession to the active markdown view on play, mirrors state on a ribbon
// icon, and maps clicks to seeks while a session is active (only in listening
// mode). Owns the persisted settings, the per-device key store, and the settings
// tab, and applies setting changes to an active session in place. Acceptance-check
// command is dev-only (DEV_ACCEPTANCE esbuild define).
import { MarkdownView, Notice, Plugin, setIcon } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { syncField } from "./sync-field";
import { ReadingSession, SessionState } from "./session";
import { runAcceptance } from "./acceptance";
import { SpeakingEditorSettings, mergeSettings, rememberVoice, voiceForProvider } from "./settings";
import { KeyStore } from "./key-store";
import { buildProvider } from "./providers";
import { VoiceCache } from "../engine/synthesis/voice-cache";
import { SpeakingEditorSettingTab } from "./settings-tab";
import { PlayerPill, nextPreset } from "./player-pill";

export default class SpeakingEditorPlugin extends Plugin {
  // `declare` narrows the base Plugin's `settings?: unknown` slot (the sanctioned
  // Obsidian pattern) instead of redeclaring and colliding with it.
  declare settings: SpeakingEditorSettings;
  keyStore!: KeyStore;
  voiceCache!: VoiceCache;

  private session: ReadingSession | null = null;
  private sessionView: EditorView | null = null;
  private sessionUri = "untitled";
  private ribbonEl: HTMLElement | null = null;
  private boundDoms = new WeakSet<HTMLElement>();
  // Exactly one pill ever exists, tied to the active session's UI.
  private pill: PlayerPill | null = null;

  async onload() {
    this.settings = mergeSettings(await this.loadData());
    this.keyStore = new KeyStore(window.localStorage);
    this.voiceCache = new VoiceCache();

    // Register the sync field plus a tiny update listener that forwards a user's
    // typing on the session editor into the pill (spec 0004's polite fade). Only
    // doc-changing transactions on the session editor count; our own effect-only
    // dispatches (position, scroll) never change the doc, so they never fade.
    this.registerEditorExtension([
      syncField,
      EditorView.updateListener.of((u) => this.onEditorUpdate(u)),
    ]);

    this.ribbonEl = this.addRibbonIcon("play-circle", "Play or pause reading", () => this.playPause());

    this.addCommand({
      id: "play-pause",
      name: "Play or pause reading",
      callback: () => this.playPause(),
    });
    this.addCommand({
      id: "stop",
      name: "Stop reading",
      callback: () => this.stopSession(),
    });
    this.addCommand({
      id: "toggle-listening-mode",
      name: "Toggle listening mode",
      callback: () => void this.toggleListeningMode(),
    });

    this.addSettingTab(new SpeakingEditorSettingTab(this.app, this));

    if (DEV_ACCEPTANCE) {
      this.addCommand({
        id: "run-acceptance-checks",
        name: "Run acceptance checks",
        callback: () => {
          // clear any live session so the harness drives a clean editor
          this.disposeSession();
          void runAcceptance(this.app, this);
        },
      });
    }
  }

  onunload() {
    this.disposeSession();
  }

  // ─── Settings persistence ────────────────────────────────────────────────────

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async toggleListeningMode() {
    await this.applyListeningMode(!this.settings.listeningMode);
    new Notice(`Listening mode ${this.settings.listeningMode ? "on" : "off"}`);
  }

  // ─── Live setting application (called by the settings tab and the pill) ────────

  // Persist the listening flag and reflect it in the pill's ear. The pill ear and
  // the command go through the toggle wrapper (which adds the Notice); the settings
  // tab calls this directly (no Notice), so both surfaces keep the pill in sync.
  async applyListeningMode(on: boolean) {
    this.settings.listeningMode = on;
    await this.saveSettings();
    this.pill?.setListening(on);
  }

  // Speed applies immediately to the live audio, no rebuild.
  async applySpeed(rate: number) {
    this.settings.speed = rate;
    await this.saveSettings();
    this.session?.setSpeed(rate);
    this.pill?.setSpeed(rate);
  }

  // Provider change: persist, then reconfigure any active session in place.
  async applyProvider(providerId: string) {
    this.settings.providerId = providerId;
    await this.saveSettings();
    this.reconfigureActiveSession();
    this.pill?.setVoiceLabel(this.currentVoiceLabel());
  }

  // Voice change for a provider: remember it, then reconfigure only if that
  // provider is the one currently playing.
  async applyVoice(providerId: string, voice: string) {
    this.settings = rememberVoice(this.settings, providerId, voice);
    await this.saveSettings();
    if (providerId === this.settings.providerId) {
      this.reconfigureActiveSession();
      this.pill?.setVoiceLabel(this.currentVoiceLabel());
    }
  }

  // The parent's "surprise audio on switch is jarring" rule: capture the current
  // word, dispose the old session's synthesis and audio, and build a fresh one
  // primed PAUSED at that word. Never auto-plays.
  private reconfigureActiveSession() {
    if (!this.session || !this.sessionView) return;
    const cm = this.sessionView;
    const word = cm.state.field(syncField, false)?.word ?? -1;
    this.session.dispose();
    this.session = this.buildSession(cm, this.sessionUri, word >= 0 ? word : undefined);
  }

  // ─── Session wiring ──────────────────────────────────────────────────────────

  private buildSession(cm: EditorView, uri: string, primeAtWord?: number): ReadingSession {
    const provider = buildProvider(this.settings.providerId, this.keyStore);
    const voice = voiceForProvider(this.settings, this.settings.providerId, provider.defaultVoice);
    return new ReadingSession({
      docText: cm.state.doc.toString(),
      uri,
      view: cm,
      provider,
      voice,
      speed: this.settings.speed,
      primeAtWord,
      onState: (s) => this.onSessionState(s),
    });
  }

  private playPause() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const cm = (view.editor as any).cm as EditorView | undefined;
    if (!cm) return;

    // toggle the existing session only if it belongs to this same editor
    if (this.session && this.sessionView === cm) {
      this.session.playPause();
      return;
    }
    // starting on a different note stops the old session first
    this.disposeSession();
    this.startSession(cm, view.file?.path ?? "untitled");
  }

  private startSession(cm: EditorView, uri: string) {
    this.sessionView = cm;
    this.sessionUri = uri;
    this.session = this.buildSession(cm, uri);
    this.bindClickToSeek(cm);
    this.ensurePill(); // appears the moment a session starts
    this.session.playPause(); // begin playing
  }

  private stopSession() {
    if (!this.session) return;
    this.session.stop(); // fires onState "idle", which removes the pill
    this.updateRibbon("idle");
  }

  private disposeSession() {
    this.destroyPill();
    this.session?.dispose();
    this.session = null;
    this.sessionView = null;
    this.updateRibbon("idle");
  }

  private onSessionState(state: SessionState) {
    this.updateRibbon(state);
    // The pill lives only while a session is live: a live state ensures it exists
    // and reflects reality; a terminal state (stop -> idle, natural end, error)
    // removes it. A later play on a still-alive session recreates a fresh pill.
    if (state === "playing" || state === "paused") {
      this.ensurePill();
      this.pill?.setState(state);
    } else {
      this.destroyPill();
    }
  }

  // ─── Pill lifecycle ──────────────────────────────────────────────────────────

  private ensurePill() {
    if (this.pill || !this.session || !this.sessionView) return;
    // Anchor to the scroller's offset parent (the positioned .cm-editor) so the
    // pill holds its spot and does not scroll with the text; fall back to the
    // editor root if the offset parent is not resolvable yet.
    const anchor = (this.sessionView.scrollDOM.offsetParent as HTMLElement | null) ?? this.sessionView.dom;
    this.pill = new PlayerPill(
      {
        onPlayPause: () => this.session?.playPause(),
        onSpeed: (dir) => void this.applySpeed(nextPreset(this.settings.speed, dir)),
        onVoice: () => this.openSettingsTab(),
        onListening: () => void this.toggleListeningMode(),
        onStop: () => this.stopSession(),
      },
      { renderIcon: (el, icon) => setIcon(el, icon) }
    );
    this.pill.mount(anchor);
    this.pill.setState(this.session.state);
    this.pill.setSpeed(this.settings.speed);
    this.pill.setListening(this.settings.listeningMode);
    this.pill.setVoiceLabel(this.currentVoiceLabel());
  }

  private destroyPill() {
    this.pill?.destroy();
    this.pill = null;
  }

  // The current voice's display label from the resolved voice cache, else the raw
  // voice id (the cache may not have filled yet).
  private currentVoiceLabel(): string {
    const provider = buildProvider(this.settings.providerId, this.keyStore);
    const voiceId = voiceForProvider(this.settings, this.settings.providerId, provider.defaultVoice);
    const cached = this.voiceCache.get(this.settings.providerId);
    return cached?.find((v) => v.id === voiceId)?.label ?? voiceId;
  }

  private openSettingsTab() {
    const setting = (this.app as any).setting;
    setting.open();
    setting.openTabById(this.manifest.id);
  }

  // A doc-changing edit on the session editor politely fades the pill.
  private onEditorUpdate(update: ViewUpdate) {
    if (!this.pill || this.sessionView !== update.view) return;
    if (update.docChanged) this.pill.notifyTyping();
  }

  private updateRibbon(state: SessionState) {
    if (!this.ribbonEl) return;
    const icon = state === "playing" ? "pause" : state === "paused" ? "play" : "play-circle";
    setIcon(this.ribbonEl, icon);
  }

  // ─── Acceptance helpers (dev-only, used by the harness) ───────────────────────

  // Start the plugin's own session on a specific editor so the harness can
  // exercise the real click-to-seek path (which consults listeningMode).
  acceptanceStartSession(cm: EditorView, uri: string) {
    this.disposeSession();
    this.startSession(cm, uri);
  }

  acceptanceSession(): ReadingSession | null {
    return this.session;
  }

  acceptanceDisposeSession() {
    this.disposeSession();
  }

  // ─── Click-to-seek ───────────────────────────────────────────────────────────

  // Bind once per editor DOM (sessions come and go on the same editor); the
  // handler is a no-op unless the active session belongs to this editor.
  private bindClickToSeek(view: EditorView) {
    const dom = view.contentDOM;
    if (this.boundDoms.has(dom)) return;
    this.boundDoms.add(dom);
    this.registerDomEvent(dom, "mousedown", (evt) => this.onEditorMouseDown(view, evt));
  }

  private onEditorMouseDown(view: EditorView, evt: MouseEvent) {
    if (!this.session || this.sessionView !== view) return; // no session: click edits normally
    if (!this.settings.listeningMode) return; // listening mode off: click edits normally
    const pos = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
    if (pos == null) return;
    const words = view.state.field(syncField).words;
    const w =
      words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to)) ??
      words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
    if (w) this.session.seekToWord(w.index);
  }
}

// The Speaking Editor plugin: registers the sync-field editor extension, wires a
// ReadingSession to the active markdown view on play, mirrors state on a ribbon
// icon, and maps clicks to seeks while a session is active (only in listening
// mode). Owns the persisted settings, the per-device key store, and the settings
// tab, and applies setting changes to an active session in place. Acceptance-check
// command is dev-only (DEV_ACCEPTANCE esbuild define).
import { MarkdownView, Notice, Plugin, setIcon } from "obsidian";
import { EditorView } from "@codemirror/view";
import { syncField } from "./sync-field";
import { ReadingSession, SessionState } from "./session";
import { runAcceptance } from "./acceptance";
import { SpeakingEditorSettings, mergeSettings, rememberVoice, voiceForProvider } from "./settings";
import { KeyStore } from "./key-store";
import { buildProvider } from "./providers";
import { VoiceCache } from "../engine/synthesis/voice-cache";
import { SpeakingEditorSettingTab } from "./settings-tab";

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

  async onload() {
    this.settings = mergeSettings(await this.loadData());
    this.keyStore = new KeyStore(window.localStorage);
    this.voiceCache = new VoiceCache();

    this.registerEditorExtension(syncField);

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
    this.settings.listeningMode = !this.settings.listeningMode;
    await this.saveSettings();
    new Notice(`Listening mode ${this.settings.listeningMode ? "on" : "off"}`);
  }

  // ─── Live setting application (called by the settings tab) ────────────────────

  // Speed applies immediately to the live audio, no rebuild.
  async applySpeed(rate: number) {
    this.settings.speed = rate;
    await this.saveSettings();
    this.session?.setSpeed(rate);
  }

  // Provider change: persist, then reconfigure any active session in place.
  async applyProvider(providerId: string) {
    this.settings.providerId = providerId;
    await this.saveSettings();
    this.reconfigureActiveSession();
  }

  // Voice change for a provider: remember it, then reconfigure only if that
  // provider is the one currently playing.
  async applyVoice(providerId: string, voice: string) {
    this.settings = rememberVoice(this.settings, providerId, voice);
    await this.saveSettings();
    if (providerId === this.settings.providerId) this.reconfigureActiveSession();
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
    this.session.playPause(); // begin playing
  }

  private stopSession() {
    if (!this.session) return;
    this.session.stop();
    this.updateRibbon("idle");
  }

  private disposeSession() {
    this.session?.dispose();
    this.session = null;
    this.sessionView = null;
    this.updateRibbon("idle");
  }

  private onSessionState(state: SessionState) {
    this.updateRibbon(state);
    // a natural end leaves the session in place so a later play restarts it
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

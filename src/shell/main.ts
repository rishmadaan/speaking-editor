// The Speaking Editor plugin: registers the sync-field editor extension, wires a
// ReadingSession to the active markdown view on play, mirrors state on a ribbon
// icon, and maps clicks to seeks while a session is active (only in listening
// mode). Owns the persisted settings, the per-device key store, and the settings
// tab, and applies setting changes to an active session in place. Acceptance-check
// command is dev-only (DEV_ACCEPTANCE esbuild define).
import { MarkdownView, Menu, Notice, Plugin, setIcon } from "obsidian";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { promises as fs } from "fs";
import { homedir } from "os";
import { join } from "path";
import { syncField } from "./sync-field";
import { ReadingSession, SessionState } from "./session";
import { runAcceptance } from "./acceptance";
import { SpeakingEditorSettings, mergeSettings, rememberVoice, voiceForProvider } from "./settings";
import { KeyStore } from "./key-store";
import { availableProviders, buildProvider } from "./providers";
import { VoiceCache } from "../engine/synthesis/voice-cache";
import { DiskCache } from "../engine/synthesis/disk-cache";
import { SpeakingEditorSettingTab } from "./settings-tab";
import { PlayerPill } from "./player-pill";
import { openVoiceMenu, renderSpeedMenu, speedMenuModel } from "./pill-menus";
import { cacheDir } from "./cache-dir";
import { parseDocument } from "../engine/core";
import {
  Positions,
  readPositions,
  recordPosition,
  getFreshPosition,
  clearPosition,
  resolveSentenceStart,
  WriteThrottle,
} from "./positions";

const POSITION_WRITE_INTERVAL_MS = 5000; // persist positions at most this often

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

  // ONE disk cache for every session, built at load and rebuilt on a size change.
  private cache!: DiskCache;
  // Per-note reading positions, mirrored to data.json (throttled).
  private positions: Positions = {};
  private positionThrottle!: WriteThrottle;

  async onload() {
    const saved = await this.loadData();
    this.settings = mergeSettings(saved);
    this.positions = readPositions(saved);
    this.keyStore = new KeyStore(window.localStorage);
    this.voiceCache = new VoiceCache();
    this.cache = new DiskCache(this.cacheLocation(), this.settings.cacheSizeMb * 1024 * 1024);
    this.positionThrottle = new WriteThrottle(POSITION_WRITE_INTERVAL_MS, () => void this.persist());

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
      id: "read-from-top",
      name: "Read this note from the top",
      callback: () => this.readFromTop(),
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
    // Persist the latest reading position before tearing down.
    this.positionThrottle?.flush();
    this.disposeSession();
  }

  // ─── Settings persistence ────────────────────────────────────────────────────

  async saveSettings() {
    await this.persist();
  }

  // The single writer to data.json: settings fields plus the positions sibling
  // (see settings.ts for the payload shape). Everything that saves goes through
  // here so a settings write never drops positions and vice versa.
  private async persist() {
    await this.saveData({ ...this.settings, positions: this.positions });
  }

  // ─── Disk cache ──────────────────────────────────────────────────────────────

  // The resolved, per-device cache directory (never inside a vault).
  cacheLocation(): string {
    return cacheDir(process.platform, process.env, homedir());
  }

  // Rebuild the cache instance against the new size cap. New sessions use it;
  // any live session keeps the cache it was built with until it ends.
  async applyCacheSize(mb: number) {
    this.settings.cacheSizeMb = mb;
    await this.saveSettings();
    this.cache = new DiskCache(this.cacheLocation(), mb * 1024 * 1024);
  }

  // Empty the cache directory of the DiskCache's own *.bin/*.json files and
  // return how many bytes were freed. The vendored DiskCache stays untouched, so
  // clearing lives here rather than as a method on it.
  async clearCache(): Promise<number> {
    const dir = this.cacheLocation();
    let freed = 0;
    try {
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (!f.endsWith(".bin") && !f.endsWith(".json")) continue;
        const p = join(dir, f);
        try {
          const st = await fs.stat(p);
          await fs.rm(p, { force: true });
          freed += st.size;
        } catch {
          /* a file that vanished under us is already "freed" enough */
        }
      }
    } catch {
      /* no directory yet means nothing to clear */
    }
    return freed;
  }

  // ─── Per-note resume ─────────────────────────────────────────────────────────

  // A session crossed into a new sentence: remember the spot for this note and
  // schedule a throttled write-through.
  private onSessionPosition(wordIndex: number) {
    this.positions = recordPosition(this.positions, this.sessionUri, wordIndex, Date.now());
    this.positionThrottle.request();
  }

  // "Read this note from the top": clear any saved position and start fresh at
  // word 0, restarting a live session on this note if there is one.
  private readFromTop() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const cm = (view.editor as any).cm as EditorView | undefined;
    if (!cm) return;
    this.restartFromTop(cm, view.file?.path ?? "untitled");
  }

  private restartFromTop(cm: EditorView, uri: string) {
    this.disposeSession();
    this.positions = clearPosition(this.positions, uri);
    this.positionThrottle.flush(); // persist the clear now
    this.sessionView = cm;
    this.sessionUri = uri;
    this.session = this.buildSession(cm, uri); // no prime -> starts at word 0
    this.bindClickToSeek(cm);
    this.ensurePill();
    this.session.playPause();
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
      cache: this.cache,
      onState: (s) => this.onSessionState(s),
      onPositionSaved: (w) => this.onSessionPosition(w),
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
    // Resume-on-play: a fresh (<12h) saved position starts the note from the
    // START OF THE SENTENCE containing that word, with one quiet Notice. The
    // session is primed PAUSED at that word and immediately played (resume snaps
    // to the sentence start). No saved position means a normal start from the top.
    const fresh = getFreshPosition(this.positions, uri, Date.now());
    let primeAtWord: number | undefined;
    if (fresh) {
      const model = parseDocument(cm.state.doc.toString(), uri, 1);
      primeAtWord = resolveSentenceStart(model, fresh.wordIndex);
    }
    this.session = this.buildSession(cm, uri, primeAtWord);
    this.bindClickToSeek(cm);
    this.ensurePill(); // appears the moment a session starts
    this.session.playPause(); // begin playing (or resume from the primed word)
    if (primeAtWord != null) new Notice("Resumed where you left off");
  }

  private stopSession() {
    if (!this.session) return;
    this.session.stop(); // fires onState "idle", which removes the pill
    this.positionThrottle.flush(); // persist where the listener stopped
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
    // A note that finished has nothing to resume: clear its saved position and
    // persist the clear now.
    if (state === "ended") {
      this.positions = clearPosition(this.positions, this.sessionUri);
      this.positionThrottle.flush();
    }
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
        onSpeed: (evt) => this.showSpeedMenu(evt),
        onVoice: (evt) => void this.showVoiceMenu(evt),
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

  // ─── Pill menus (spec 0005) ──────────────────────────────────────────────────

  // Speed control: a native menu of the presets anchored at the button, the
  // current speed checked, picks routed through applySpeed (persist + live audio
  // + label), plus a "Fine-tune in settings" escape hatch.
  private showSpeedMenu(evt: MouseEvent) {
    const menu = new Menu();
    renderSpeedMenu(menu, speedMenuModel(this.settings.speed), {
      applySpeed: (speed) => void this.applySpeed(speed),
      openSettings: () => this.openSettingsTab(),
    });
    menu.showAtMouseEvent(evt);
  }

  // Voice control: the async two-section menu (providers + the active provider's
  // voices). The voice list resolves through the cache first, fetching with a
  // brief loading state on the pill when uncached, before the menu shows.
  private async showVoiceMenu(evt: MouseEvent) {
    const providerId = this.settings.providerId;
    const provider = buildProvider(providerId, this.keyStore);
    const currentVoice = voiceForProvider(this.settings, providerId, provider.defaultVoice);
    await openVoiceMenu({
      activeProviderId: providerId,
      provider,
      voiceCache: this.voiceCache,
      providers: availableProviders(),
      currentVoice,
      hasKey: (id) => this.keyStore.has(id),
      handlers: {
        applyProvider: (id) => void this.applyProvider(id),
        applyVoice: (voice) => void this.applyVoice(providerId, voice),
        openSettings: () => this.openSettingsTab(),
      },
      setVoiceLoading: (on) => this.pill?.setVoiceLoading(on),
      buildMenu: () => new Menu(),
      showMenu: (menu) => menu.showAtMouseEvent(evt),
    });
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

  // Resume/position helpers so check 19 drives the real plugin paths.
  acceptanceStopSession() {
    this.stopSession();
  }

  acceptanceReadFromTop(cm: EditorView, uri: string) {
    this.restartFromTop(cm, uri);
  }

  acceptanceClearPosition(uri: string) {
    this.positions = clearPosition(this.positions, uri);
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

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
import { CmSurface, HighlightSurface } from "./highlight-surface";
import { RangeSurface } from "./range-surface";
import { runAcceptance } from "./acceptance";
import { SpeakingEditorSettings, mergeSettings, rememberVoice, voiceForProvider } from "./settings";
import { KeyStore } from "./key-store";
import { availableProviders, buildProvider, providerLabel } from "./providers";
import { mapProviderError } from "./error-copy";
import { shouldShowSeekHint, createSeekHint } from "./hint";
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
  // The active session's markdown view and mode, so the mode-flip watcher can
  // tell when the user toggled edit/preview mid-session (reading mode only mounts
  // over the rendered surface; a flip ends the session).
  private sessionMdView: MarkdownView | null = null;
  private sessionMode: "reading" | "live" = "live";
  // The rendered reading container the reading session aligned against (null in
  // live preview): the click surface and the harness's reading container.
  private sessionReadingContainer: HTMLElement | null = null;
  // Where the pill mounts: the reading container's positioned parent in reading
  // mode, the editor's in live preview.
  private pillAnchor: HTMLElement | null = null;
  private ribbonEl: HTMLElement | null = null;
  private boundDoms = new WeakSet<HTMLElement>();
  // Exactly one pill ever exists, tied to the active session's UI.
  private pill: PlayerPill | null = null;
  // The first-jump teaching hint currently on screen, if any: while one is up we
  // do not create a second (spec 0009 point 3). Cleared when it self-dismisses.
  private seekHint: HTMLElement | null = null;

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
      // guarded: the harness owns sessions while a verification run is live
      callback: () => (this.acceptanceRunning ? undefined : this.stopSession()),
    });
    this.addCommand({
      id: "read-from-top",
      name: "Read this note from the top",
      callback: () => (this.acceptanceRunning ? undefined : this.readFromTop()),
    });
    this.addCommand({
      id: "toggle-listening-mode",
      name: "Toggle listening mode",
      callback: () => void this.toggleListeningMode(),
    });

    // Mode-flip watcher: toggling a note between editing and reading changes the
    // leaf's view state, which fires "layout-change". If that flips the mode of
    // the note a session is playing, stop cleanly (cross-mode continuity is out of
    // scope for v1). layout-change is the reliable signal for a preview/edit
    // toggle; active-leaf-change would miss an in-place toggle on the same leaf.
    this.registerEvent(this.app.workspace.on("layout-change", () => this.checkModeFlip()));

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
    const ctx = this.resolveSurfaceContext();
    this.sessionView = cm;
    this.sessionUri = uri;
    this.sessionMdView = ctx.view;
    this.sessionMode = ctx.mode;
    this.sessionReadingContainer = ctx.container;
    this.session = this.buildSession(cm, uri); // no prime -> starts at word 0
    this.bindSeekSurface(cm, ctx.mode, ctx.container);
    this.setPillAnchor(cm, ctx.mode, ctx.container);
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
    // Read the current word from the session (works in both modes; reading mode
    // has no sync field to inspect). The mode/container persist, so the rebuilt
    // session keeps the same surface kind.
    const word = this.session.currentWord;
    this.session.dispose();
    this.session = this.buildSession(cm, this.sessionUri, word >= 0 ? word : undefined);
  }

  // ─── Session wiring ──────────────────────────────────────────────────────────

  private buildSession(cm: EditorView, uri: string, primeAtWord?: number): ReadingSession {
    const provider = buildProvider(this.settings.providerId, this.keyStore);
    const voice = voiceForProvider(this.settings, this.settings.providerId, provider.defaultVoice);
    // Pick the paint surface by the session's mode (set by the caller): the CSS
    // Highlight surface over the rendered container in reading mode, the CM6 sync
    // field in live preview. The RangeSurface may fall back to "none" internally
    // if the rendered text does not align with the model.
    const surface: HighlightSurface =
      this.sessionMode === "reading" && this.sessionReadingContainer
        ? new RangeSurface(this.sessionReadingContainer)
        : new CmSurface(cm);
    return new ReadingSession({
      docText: cm.state.doc.toString(),
      uri,
      view: cm,
      surface,
      provider,
      voice,
      speed: this.settings.speed,
      primeAtWord,
      cache: this.cache,
      onState: (s, msg) => this.onSessionState(s, msg),
      onPositionSaved: (w) => this.onSessionPosition(w),
    });
  }

  // The active markdown view's mode: "reading" for the rendered preview, "live"
  // for source/live-preview editing.
  private modeOf(view: MarkdownView): "reading" | "live" {
    return view.getMode() === "preview" ? "reading" : "live";
  }

  // The rendered content element to align and bind clicks against, preferring the
  // inner sizer so leading chrome (properties, inline title) is minimal.
  private readingContainerOf(view: MarkdownView): HTMLElement {
    const root = view.previewMode.containerEl;
    return (
      (root.querySelector(".markdown-preview-sizer") as HTMLElement | null) ??
      (root.querySelector(".markdown-preview-view") as HTMLElement | null) ??
      root
    );
  }

  // Resolve the surface context for a session about to start on the active view.
  private resolveSurfaceContext(): {
    view: MarkdownView | null;
    mode: "reading" | "live";
    container: HTMLElement | null;
  } {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view && this.modeOf(view) === "reading") {
      return { view, mode: "reading", container: this.readingContainerOf(view) };
    }
    return { view, mode: "live", container: null };
  }

  // Bind the right click-to-seek surface for the mode, and remember where the pill
  // mounts. Both are derived once at session start.
  private bindSeekSurface(cm: EditorView, mode: "reading" | "live", container: HTMLElement | null) {
    if (mode === "reading" && container) this.bindReadingClickToSeek(container);
    else this.bindClickToSeek(cm);
  }

  private setPillAnchor(cm: EditorView, mode: "reading" | "live", container: HTMLElement | null) {
    this.pillAnchor =
      mode === "reading" && container
        ? (container.offsetParent as HTMLElement | null) ?? container
        : (cm.scrollDOM.offsetParent as HTMLElement | null) ?? cm.dom;
  }

  // Stop a running reading session when its view flips edit/preview mid-session.
  private checkModeFlip() {
    if (!this.session || !this.sessionMdView) return;
    if (this.modeOf(this.sessionMdView) !== this.sessionMode) {
      this.disposeSession();
      new Notice("Reading stopped: the view changed");
    }
  }

  private playPause() {
    // While the dev verification run drives the plugin's own sessions, a human
    // press would put two drivers on one editor (stacking voices). Refuse gently.
    if (this.acceptanceRunning) {
      new Notice("Verification is running; playback controls return in a moment.");
      return;
    }
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
    // Pick the surface by the active view's mode BEFORE building the session, so
    // the reading-mode branch aligns against the rendered container.
    const ctx = this.resolveSurfaceContext();
    this.sessionView = cm;
    this.sessionUri = uri;
    this.sessionMdView = ctx.view;
    this.sessionMode = ctx.mode;
    this.sessionReadingContainer = ctx.container;
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
    this.bindSeekSurface(cm, ctx.mode, ctx.container);
    this.setPillAnchor(cm, ctx.mode, ctx.container);
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
    // Remove any lingering teaching hint with its session.
    this.seekHint?.remove();
    this.seekHint = null;
    this.session?.dispose();
    this.session = null;
    this.sessionView = null;
    this.sessionMdView = null;
    this.sessionReadingContainer = null;
    this.pillAnchor = null;
    this.updateRibbon("idle");
  }

  private onSessionState(state: SessionState, message?: string) {
    this.updateRibbon(state);
    // A note that finished has nothing to resume: clear its saved position and
    // persist the clear now.
    if (state === "ended") {
      this.positions = clearPosition(this.positions, this.sessionUri);
      this.positionThrottle.flush();
    }
    // A failure surfaces a human Notice with one way out (the raw error goes to
    // console, never the user), then the pill retires like any terminal state.
    if (state === "error") {
      this.showSessionError(message);
      this.destroyPill();
      return;
    }
    // The pill lives only while a session is live: a live state (preparing while
    // the first audio synthesizes, playing, paused) ensures it exists and reflects
    // reality; a terminal state (stop -> idle, natural end, error) removes it. A
    // later play on a still-alive session recreates a fresh pill.
    if (state === "playing" || state === "paused" || state === "preparing") {
      this.ensurePill();
      this.pill?.setState(state);
      this.pill?.setPreparing(state === "preparing");
    } else {
      this.destroyPill();
    }
  }

  // Build the persistent error Notice (spec 0009 point 2): a plain sentence naming
  // the provider that failed, plus exactly one action. On macOS with a non-say
  // provider the action switches to the offline voice and restarts reading from
  // the current position (the reconfigure machinery); otherwise it opens settings.
  // The raw exception goes to the console for debuggability, never to the user.
  private showSessionError(rawMessage?: string): Notice {
    if (rawMessage) console.error("[Speaking Editor] synthesis failed:", rawMessage);
    const providerId = this.settings.providerId;
    const copy = mapProviderError(providerId, providerLabel(providerId), process.platform, rawMessage);

    const frag = document.createDocumentFragment();
    const line = frag.appendChild(document.createElement("div"));
    line.textContent = copy.sentence;
    const btn = frag.appendChild(document.createElement("button"));
    btn.type = "button";
    btn.className = "se-error-action";
    btn.textContent = copy.action === "offline-fallback" ? "Switch to the offline voice" : "Open settings";

    // timeout 0 keeps it up until the user acts or dismisses it.
    const notice = new Notice(frag, 0);
    btn.addEventListener("click", () => {
      notice.hide();
      if (copy.action === "offline-fallback") {
        // Switch to the offline "say" voice, which reconfigures the active session
        // primed PAUSED at the current word, then resume so reading continues from
        // exactly where it failed.
        void this.applyProvider("say").then(() => this.session?.playPause());
      } else {
        this.openSettingsTab();
      }
    });
    return notice;
  }

  // ─── Pill lifecycle ──────────────────────────────────────────────────────────

  private ensurePill() {
    if (this.pill || !this.session) return;
    // Mount at the anchor derived at session start: the reading container's
    // positioned parent in reading mode, the editor's in live preview. The pill
    // holds its spot and does not scroll with the text.
    const anchor = this.pillAnchor ?? this.sessionView?.dom;
    if (!anchor) return;
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
    // showAtPosition, not showAtMouseEvent: the position API depends only on
    // coordinates, so it behaves identically for real clicks and for the
    // verification harness's synthetic ones (which have no dispatch context).
    menu.showAtPosition({ x: evt.clientX, y: evt.clientY });
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
      showMenu: (menu) => menu.showAtPosition({ x: evt.clientX, y: evt.clientY }),
    });
  }

  // A doc-changing edit on the session editor politely fades the pill.
  private onEditorUpdate(update: ViewUpdate) {
    if (!this.pill || this.sessionView !== update.view) return;
    if (update.docChanged) this.pill.notifyTyping();
  }

  private updateRibbon(state: SessionState) {
    if (!this.ribbonEl) return;
    // Preparing shows a loader glyph that pulses (opacity-only, via the class);
    // every other state clears the pulse and shows its normal glyph.
    const preparing = state === "preparing";
    const icon = preparing
      ? "loader-2"
      : state === "playing"
      ? "pause"
      : state === "paused"
      ? "play"
      : "play-circle";
    setIcon(this.ribbonEl, icon);
    this.ribbonEl.classList.toggle("se-preparing-pulse", preparing);
  }

  // ─── Acceptance helpers (dev-only, used by the harness) ───────────────────────

  // True while the verification run owns the plugin; user-facing playback
  // controls refuse gently for the duration (see playPause/stopSession).
  acceptanceRunning = false;

  acceptancePositionsSnapshot(): string {
    return JSON.stringify(this.positions);
  }

  acceptanceRestorePositions(json: string) {
    this.positions = JSON.parse(json);
  }

  // Start the plugin's own session on a specific editor so the harness can
  // exercise the real click-to-seek path (which consults listeningMode).
  acceptanceStartSession(cm: EditorView, uri: string) {
    this.disposeSession();
    this.startSession(cm, uri);
  }

  acceptanceSession(): ReadingSession | null {
    return this.session;
  }

  // Drive the real error-Notice path from a harness session's onState("error"),
  // so check 24 can assert the user sees the mapped sentence and an action button,
  // never the raw exception. Returns the Notice so the check can dismiss it.
  acceptanceShowSessionError(message?: string): Notice {
    return this.showSessionError(message);
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
    if (this.sessionMode !== "live") return; // reading mode seeks via its own handler
    if (!this.settings.listeningMode) return; // listening mode off: click edits normally
    const pos = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
    if (pos == null) return;
    const words = view.state.field(syncField).words;
    const w =
      words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to)) ??
      words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
    if (w) {
      this.session.seekToWord(w.index);
      this.maybeShowSeekHint();
    }
  }

  // Reading-mode click-to-seek: bound to the rendered container (bubbling), gated
  // on a live reading session and listening mode. The RangeSurface maps the point
  // via caretRangeFromPoint to the nearest aligned word; a miss is a no-op (the
  // click behaves normally). Bind once per container.
  private bindReadingClickToSeek(container: HTMLElement) {
    if (this.boundDoms.has(container)) return;
    this.boundDoms.add(container);
    this.registerDomEvent(container, "mousedown", (evt) => this.onReadingMouseDown(container, evt));
  }

  private onReadingMouseDown(container: HTMLElement, evt: MouseEvent) {
    if (!this.session || this.sessionMode !== "reading") return;
    if (this.sessionReadingContainer !== container) return; // stale binding from a prior session
    if (!this.settings.listeningMode) return;
    // seekReading returns true only when a rendered word was actually hit, so a
    // miss (click on whitespace) does not teach.
    if (this.session.seekReading(evt.clientX, evt.clientY)) this.maybeShowSeekHint();
  }

  // Show the first-jump teaching hint on a real seek, the first few times only.
  // Gated on the persisted counter ALONE (not acceptanceRunning): the hint is a
  // passive, self-dismissing overlay, so it is allowed to fire during the harness,
  // which is exactly what the seek-hint acceptance check exercises. A hint already
  // on screen is not re-created; each shown hint increments and persists the count.
  private maybeShowSeekHint() {
    if (!shouldShowSeekHint(this.settings.seekHintsShown)) return;
    if (this.seekHint) return; // one at a time
    const anchor = this.pillAnchor ?? this.sessionView?.dom ?? document.body;
    this.seekHint = createSeekHint(document, { onDone: () => (this.seekHint = null) });
    anchor.appendChild(this.seekHint);
    this.settings.seekHintsShown += 1;
    void this.saveSettings();
  }

  // Acceptance-only: the rendered container the current reading session aligned
  // against, so the harness can dispatch a real mousedown on it (check 21).
  acceptanceReadingContainer(): HTMLElement | null {
    return this.sessionReadingContainer;
  }
}

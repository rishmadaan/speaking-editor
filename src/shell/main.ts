// The Speaking Editor plugin: registers the sync-field editor extension, wires a
// ReadingSession to the active markdown view on play, mirrors state on a ribbon
// icon, and maps clicks to seeks while a session is active. Acceptance-check
// command is dev-only (DEV_ACCEPTANCE esbuild define).
import { MarkdownView, Plugin, setIcon } from "obsidian";
import { EditorView } from "@codemirror/view";
import { syncField } from "./sync-field";
import { ReadingSession, SessionState } from "./session";
import { runAcceptance } from "./acceptance";

export default class SpeakingEditorPlugin extends Plugin {
  private session: ReadingSession | null = null;
  private sessionView: EditorView | null = null;
  private ribbonEl: HTMLElement | null = null;
  private boundDoms = new WeakSet<HTMLElement>();

  async onload() {
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

    if (DEV_ACCEPTANCE) {
      this.addCommand({
        id: "run-acceptance-checks",
        name: "Run acceptance checks",
        callback: () => {
          // clear any live session so the harness drives a clean editor
          this.disposeSession();
          void runAcceptance(this.app);
        },
      });
    }
  }

  onunload() {
    this.disposeSession();
  }

  // ─── Session wiring ──────────────────────────────────────────────────────────

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
    this.session = new ReadingSession({
      docText: cm.state.doc.toString(),
      uri,
      view: cm,
      onState: (s) => this.onSessionState(s),
    });
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
    const pos = view.posAtCoords({ x: evt.clientX, y: evt.clientY });
    if (pos == null) return;
    const words = view.state.field(syncField).words;
    const w =
      words.find((e) => e.runs.some((r) => pos >= r.from && pos < r.to)) ??
      words.find((e) => e.runs.length > 0 && e.runs[0].from >= pos);
    if (w) this.session.seekToWord(w.index);
  }
}

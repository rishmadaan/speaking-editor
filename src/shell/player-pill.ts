// The floating pill player: a rounded control cluster that hovers bottom-center of
// the reading editor while a session exists (spec 0004). Pure DOM, no Obsidian
// imports, so it unit-tests in happy-dom; the host (main.ts) supplies the five
// control callbacks and an optional icon renderer (Obsidian's setIcon) so the
// glyphs draw as real lucide icons in-app and as plain data-icon markers in tests.
//
// Manners live here and in styles.css: opacity is the ONLY thing that animates,
// typing fades the pill politely, hover or a 1.5s lull restores it, and the pill
// never captures keyboard focus (buttons are tabindex -1 and mousedown is
// swallowed) so the writing flow is never interrupted.

import { SessionState } from "./session";

// The speed presets the pill cycles through, low to high.
export const SPEED_PRESETS: readonly number[] = [0.8, 1.0, 1.2, 1.5, 2.0, 2.5, 3.0];

// Pure preset-cycling logic: snap `current` to the closest preset, then step one
// place in `direction` (+1 faster, -1 slower) with wraparound at both ends. Exact
// hits step to the neighbour; between-preset values resolve to the closest first.
export function nextPreset(current: number, direction: 1 | -1): number {
  const n = SPEED_PRESETS.length;
  let closest = 0;
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const d = Math.abs(SPEED_PRESETS[i] - current);
    if (d < best) {
      best = d;
      closest = i;
    }
  }
  const idx = (closest + direction + n) % n;
  return SPEED_PRESETS[idx];
}

// The five things the pill can do; the host owns what each one means.
export interface PlayerPillCallbacks {
  onPlayPause(): void;
  // +1 on a plain click (faster), -1 on right-click (slower).
  onSpeed(direction: 1 | -1): void;
  onVoice(): void;
  onListening(): void;
  onStop(): void;
}

export interface PlayerPillOptions {
  // Draw a real icon into a control (Obsidian's setIcon). Omitted in tests, where
  // the pill falls back to a text glyph and always stamps a data-icon marker.
  renderIcon?: (el: HTMLElement, icon: string) => void;
}

// Restore delay after the last user edit before the pill fades back in.
const FADE_RESTORE_MS = 1500;

// Text fallbacks used only when no icon renderer is supplied (i.e. in tests).
const FALLBACK_GLYPH: Record<string, string> = {
  play: "▶", // right-pointing triangle
  pause: "⏸", // double bar
  ear: "◑", // half circle (stand-in)
  x: "✕", // multiplication x
};

function formatRate(rate: number): string {
  return `${Number(rate.toFixed(2))}x`;
}

export class PlayerPill {
  private root: HTMLElement;
  private playBtn!: HTMLButtonElement;
  private speedBtn!: HTMLButtonElement;
  private voiceBtn!: HTMLButtonElement;
  private earBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;

  private renderIcon?: (el: HTMLElement, icon: string) => void;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(private cb: PlayerPillCallbacks, opts: PlayerPillOptions = {}) {
    this.renderIcon = opts.renderIcon;

    this.root = document.createElement("div");
    this.root.className = "se-pill";
    this.root.setAttribute("role", "toolbar");
    this.root.setAttribute("aria-label", "Reading controls");
    // Never steal keyboard focus from the editor: swallow the focusing mousedown
    // (click still fires on mouseup, so the controls stay usable while faded).
    this.root.addEventListener("mousedown", (e) => e.preventDefault());
    // Hover restores full opacity instantly, ahead of the timer.
    this.root.addEventListener("pointerenter", () => this.restore());

    this.buildControls();

    // Initial glyphs; text controls fill in via setSpeed / setVoiceLabel.
    this.setControlIcon(this.playBtn, "play");
    this.setControlIcon(this.earBtn, "ear");
    this.setControlIcon(this.stopBtn, "x");
    this.setSpeed(1.0);
    this.setVoiceLabel("");
    this.setListening(true);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  mount(container: HTMLElement): void {
    container.appendChild(this.root);
  }

  setState(state: SessionState): void {
    // Playing shows the pause glyph; anything else shows play.
    this.setControlIcon(this.playBtn, state === "playing" ? "pause" : "play");
  }

  setSpeed(rate: number): void {
    this.speedBtn.textContent = formatRate(rate);
  }

  setVoiceLabel(label: string): void {
    this.voiceBtn.textContent = label;
    this.voiceBtn.setAttribute("title", label);
  }

  setListening(on: boolean): void {
    this.earBtn.classList.toggle("se-pill-ear-active", on);
    this.earBtn.classList.toggle("se-pill-ear-off", !on);
  }

  // A user edit landed: fade now, and arm the restore for a lull.
  notifyTyping(): void {
    if (this.destroyed) return;
    this.root.classList.add("se-pill-faded");
    if (this.fadeTimer != null) clearTimeout(this.fadeTimer);
    this.fadeTimer = setTimeout(() => {
      this.fadeTimer = null;
      this.root.classList.remove("se-pill-faded");
    }, FADE_RESTORE_MS);
  }

  destroy(): void {
    this.destroyed = true;
    if (this.fadeTimer != null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.root.remove();
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  private buildControls(): void {
    this.playBtn = this.makeControl("se-pill-play", "Play or pause");
    this.playBtn.addEventListener("click", () => this.cb.onPlayPause());

    this.speedBtn = this.makeControl("se-pill-speed", "Reading speed (right-click to slow)");
    this.speedBtn.addEventListener("click", () => this.cb.onSpeed(1));
    this.speedBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.cb.onSpeed(-1);
    });

    this.voiceBtn = this.makeControl("se-pill-voice", "Change voice");
    this.voiceBtn.addEventListener("click", () => this.cb.onVoice());

    this.earBtn = this.makeControl("se-pill-ear", "Listening mode");
    this.earBtn.addEventListener("click", () => this.cb.onListening());

    this.stopBtn = this.makeControl("se-pill-stop", "Stop reading");
    this.stopBtn.addEventListener("click", () => this.cb.onStop());
  }

  private makeControl(cls: string, aria: string): HTMLButtonElement {
    const b = document.createElement("button");
    b.className = cls;
    b.type = "button";
    b.setAttribute("tabindex", "-1"); // never in the tab order
    b.setAttribute("aria-label", aria);
    this.root.appendChild(b);
    return b;
  }

  private setControlIcon(el: HTMLElement, icon: string): void {
    el.dataset.icon = icon;
    if (this.renderIcon) {
      el.textContent = "";
      this.renderIcon(el, icon);
    } else {
      el.textContent = FALLBACK_GLYPH[icon] ?? "";
    }
  }

  private restore(): void {
    if (this.fadeTimer != null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    this.root.classList.remove("se-pill-faded");
  }
}

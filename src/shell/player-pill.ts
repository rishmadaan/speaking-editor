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

// The five things the pill can do; the host owns what each one means. Speed and
// voice open Obsidian menus in the host, so they hand their click event straight
// through for the host to anchor the menu at the button.
export interface PlayerPillCallbacks {
  onPlayPause(): void;
  onSpeed(evt: MouseEvent): void;
  onVoice(evt: MouseEvent): void;
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

// The leaving fade fallback: if the opacity transitionend never fires (occluded
// window, no compositor), remove the pill after this instead (spec 0010 point 2).
const LEAVING_FALLBACK_MS = 300;

// The edited badge's hover explanation (spec 0010 point 3).
const EDITED_TITLE =
  "The note changed while reading; the voice is finishing the text it started. Stop and play again to re-read.";

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
  private earIcon!: HTMLElement;
  private stopBtn!: HTMLButtonElement;
  private remainingEl!: HTMLSpanElement;
  private editedEl!: HTMLSpanElement;

  private renderIcon?: (el: HTMLElement, icon: string) => void;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private leavingTimer: ReturnType<typeof setTimeout> | null = null;
  private leaving = false;
  // The one-shot completion of an in-flight leaving fade, so transitionend, the
  // timer fallback, and an early destroy() all funnel through it exactly once.
  private leavingDone: (() => void) | null = null;
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
    this.setControlIcon(this.earIcon, "ear");
    this.setControlIcon(this.stopBtn, "x");
    this.setSpeed(1.0);
    this.setVoiceLabel("");
    this.setRemaining(""); // hidden until an estimate exists
    this.setEdited(false); // hidden until the note is edited mid-read
    this.setListening(true);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  mount(container: HTMLElement): void {
    container.appendChild(this.root);
  }

  setState(state: SessionState): void {
    // Playing shows the pause glyph; preparing does too, since a press during the
    // synthesis gap pauses/cancels the pending start. Anything else shows play.
    const showPause = state === "playing" || state === "preparing";
    this.setControlIcon(this.playBtn, showPause ? "pause" : "play");
  }

  // Toggle the quiet preparing pulse (opacity-only keyframes in styles.css). The
  // animation rides the play control (se-pill-play-preparing); the root also
  // carries se-pill-preparing so the whole pill reads as "preparing" for callers
  // that inspect the root. On while a start is pending, off once audio plays.
  setPreparing(on: boolean): void {
    this.playBtn.classList.toggle("se-pill-play-preparing", on);
    this.root.classList.toggle("se-pill-preparing", on);
  }

  setSpeed(rate: number): void {
    this.speedBtn.textContent = formatRate(rate);
  }

  setVoiceLabel(label: string): void {
    this.voiceBtn.textContent = label;
    this.voiceBtn.setAttribute("title", label);
  }

  // A transient loading state while the voice list resolves: dims the button and
  // disables it so a second click cannot fire a second fetch mid-flight.
  setVoiceLoading(on: boolean): void {
    this.voiceBtn.classList.toggle("se-pill-voice-loading", on);
    if (on) this.voiceBtn.setAttribute("disabled", "");
    else this.voiceBtn.removeAttribute("disabled");
  }

  setListening(on: boolean): void {
    this.earBtn.classList.toggle("se-pill-ear-active", on);
    this.earBtn.classList.toggle("se-pill-ear-off", !on);
  }

  // The dim remaining-time label (spec 0010 point 1). Hidden entirely when empty
  // (no estimate yet), so the pill shows nothing rather than a wrong number.
  setRemaining(label: string): void {
    this.remainingEl.textContent = label;
    this.remainingEl.classList.toggle("se-pill-remaining-hidden", label.length === 0);
  }

  // The dim "edited" degradation badge (spec 0010 point 3). Its title explains that
  // the voice finishes the text it started; a fresh session starts it hidden.
  setEdited(on: boolean): void {
    this.editedEl.classList.toggle("se-pill-edited-hidden", !on);
  }

  // Graceful leaving (spec 0010 point 2): fade the pill out (opacity only, via the
  // se-pill-leaving class) then remove it, instead of popping. The host calls this
  // on the ended/stop path and clears its reference in the callback. Removal fires
  // on the opacity transitionend, with a timer fallback for occluded windows; both
  // paths run the removal exactly once. Idempotent while already leaving.
  fadeOutAndRemove(onRemoved?: () => void): void {
    if (this.destroyed) {
      onRemoved?.();
      return;
    }
    if (this.leaving) return;
    this.leaving = true;
    // A pending typing-restore timer would fight the fade; cancel it.
    if (this.fadeTimer != null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    const done = () => {
      if (this.destroyed) return;
      this.destroyed = true;
      this.leavingDone = null;
      if (this.leavingTimer != null) {
        clearTimeout(this.leavingTimer);
        this.leavingTimer = null;
      }
      this.root.removeEventListener("transitionend", onEnd);
      this.root.remove();
      onRemoved?.();
    };
    const onEnd = (e: Event) => {
      if ((e as TransitionEvent).propertyName === "opacity") done();
    };
    this.leavingDone = done;
    this.root.addEventListener("transitionend", onEnd);
    this.root.classList.add("se-pill-leaving"); // triggers the 200ms opacity fade
    this.leavingTimer = setTimeout(done, LEAVING_FALLBACK_MS);
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
    if (this.fadeTimer != null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    // Complete an in-flight leaving fade through its one-shot path (removes the
    // element and fires its onRemoved exactly once), rather than racing it.
    if (this.leavingDone) {
      this.leavingDone();
      return;
    }
    this.destroyed = true;
    if (this.leavingTimer != null) {
      clearTimeout(this.leavingTimer);
      this.leavingTimer = null;
    }
    this.root.remove();
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  private buildControls(): void {
    this.playBtn = this.makeControl("se-pill-play", "Play or pause");
    this.playBtn.addEventListener("click", () => this.cb.onPlayPause());

    this.speedBtn = this.makeControl("se-pill-speed", "Reading speed");
    this.speedBtn.addEventListener("click", (e) => this.cb.onSpeed(e));

    this.voiceBtn = this.makeControl("se-pill-voice", "Change voice");
    this.voiceBtn.addEventListener("click", (e) => this.cb.onVoice(e));

    // Dim, non-interactive status slots between the voice label and the ear: the
    // remaining-time estimate and the "edited" degradation badge (spec 0010).
    this.remainingEl = this.makeSpan("se-pill-remaining");
    this.editedEl = this.makeSpan("se-pill-edited");
    this.editedEl.textContent = "edited";
    this.editedEl.setAttribute("title", EDITED_TITLE);

    this.earBtn = this.makeControl("se-pill-ear", "Listening mode");
    // The ear carries its word: an icon span plus a small text label, so the
    // mode is readable at a glance without hovering (UX review P3).
    this.earIcon = this.earBtn.appendChild(document.createElement("span"));
    this.earIcon.className = "se-pill-ear-icon";
    const earLabel = this.earBtn.appendChild(document.createElement("span"));
    earLabel.className = "se-pill-ear-label";
    earLabel.textContent = "listening";
    this.earBtn.addEventListener("click", () => this.cb.onListening());

    this.stopBtn = this.makeControl("se-pill-stop", "Stop reading");
    this.stopBtn.addEventListener("click", () => this.cb.onStop());
  }

  private makeSpan(cls: string): HTMLSpanElement {
    const s = document.createElement("span");
    s.className = cls;
    this.root.appendChild(s);
    return s;
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

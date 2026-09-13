// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// The "Return to reading" chip (spec 0012 Part 1 point 3). A small floating
// affordance that appears when the user scrolls away mid-listen and following
// breaks; clicking it re-engages following and snaps the current sentence back to
// centre. Same manners as the pill: opacity-only transitions (se-return classes),
// and it NEVER takes focus (tabindex -1, mousedown preventDefault) so a click
// cannot pull the caret out of the note. No Obsidian imports, so it is a plain
// DOM factory the shell mounts near the pill anchor and destroys with the session.

export interface ReturnChipHandle {
  el: HTMLButtonElement;
  show(): void;
  hide(): void;
  destroy(): void;
}

export function createReturnChip(
  doc: Document,
  opts: { onReturn: () => void }
): ReturnChipHandle {
  const el = doc.createElement("button");
  el.className = "se-return";
  el.type = "button";
  el.tabIndex = -1; // never in the tab order
  el.setAttribute("aria-hidden", "true");
  el.textContent = "Return to reading";
  // Never steal focus: preventDefault on mousedown keeps the caret in the note.
  el.addEventListener("mousedown", (e) => e.preventDefault());
  el.addEventListener("click", () => opts.onReturn());
  return {
    el,
    show() {
      el.classList.add("se-return-visible");
    },
    hide() {
      el.classList.remove("se-return-visible");
    },
    destroy() {
      el.remove();
    },
  };
}

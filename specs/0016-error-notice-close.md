# 0016: Error notice gets a visible close button

Status: building (code in, 336 tests and prod build green 2026-10-05; live in-app check and eyes pass pending)
Date: 2026-09-16
Depends on: 0009 (the persistent error notice). Driven by Rishabh: the
"could not be reached" notice stays up with no visible way to close it;
clicking the top-right corner happened to work (Obsidian closes a notice on
any click) but nothing shows that.

## Behavior

1. The error notice shows an "x" close button at the top right, next to the
   sentence, with `aria-label="Dismiss"`.
2. Clicking it hides the notice and does nothing else (no provider switch,
   no settings).
3. The existing action button behaves exactly as before.

## Acceptance

- Live (Obsidian eval): the notice built by `showSessionError` contains the
  close button; clicking it removes the notice from the DOM without changing
  `settings.providerId`.
- Eyes: the "x" sits top right and reads as a close control in light and dark
  themes.

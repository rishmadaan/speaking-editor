// Where the audio disk cache lives: per-device, never inside any vault, never
// synced. A pure function so the platform matrix is unit-tested without touching
// the real filesystem. macOS keeps caches under ~/Library/Caches; elsewhere we
// honour $XDG_CACHE_HOME, falling back to ~/.cache (the freedesktop convention).
import { join } from "path";

const APP = "speaking-editor";

export function cacheDir(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  home: string
): string {
  if (platform === "darwin") return join(home, "Library", "Caches", APP);
  const xdg = env.XDG_CACHE_HOME;
  if (typeof xdg === "string" && xdg.trim().length > 0) return join(xdg, APP);
  return join(home, ".cache", APP);
}

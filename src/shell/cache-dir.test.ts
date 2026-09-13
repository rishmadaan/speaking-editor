// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, it, expect } from "vitest";
import { join } from "path";
import { cacheDir } from "./cache-dir";

const HOME = "/Users/tester";

describe("cacheDir", () => {
  it("macOS uses ~/Library/Caches/speaking-editor regardless of XDG", () => {
    expect(cacheDir("darwin", {}, HOME)).toBe(join(HOME, "Library", "Caches", "speaking-editor"));
    // XDG is ignored on macOS
    expect(cacheDir("darwin", { XDG_CACHE_HOME: "/xdg/cache" }, HOME)).toBe(
      join(HOME, "Library", "Caches", "speaking-editor")
    );
  });

  it("non-macOS uses $XDG_CACHE_HOME when set", () => {
    expect(cacheDir("linux", { XDG_CACHE_HOME: "/xdg/cache" }, HOME)).toBe(
      join("/xdg/cache", "speaking-editor")
    );
  });

  it("non-macOS falls back to ~/.cache when XDG is unset or blank", () => {
    expect(cacheDir("linux", {}, HOME)).toBe(join(HOME, ".cache", "speaking-editor"));
    expect(cacheDir("linux", { XDG_CACHE_HOME: "" }, HOME)).toBe(
      join(HOME, ".cache", "speaking-editor")
    );
    expect(cacheDir("linux", { XDG_CACHE_HOME: "   " }, HOME)).toBe(
      join(HOME, ".cache", "speaking-editor")
    );
  });

  it("Windows (non-darwin) follows the same XDG-or-.cache rule", () => {
    expect(cacheDir("win32", { XDG_CACHE_HOME: "/xdg/cache" }, HOME)).toBe(
      join("/xdg/cache", "speaking-editor")
    );
    expect(cacheDir("win32", {}, HOME)).toBe(join(HOME, ".cache", "speaking-editor"));
  });

  it("never resolves inside a vault path", () => {
    const vault = "/Users/tester/Vaults/Notes";
    for (const p of [
      cacheDir("darwin", {}, HOME),
      cacheDir("linux", {}, HOME),
      cacheDir("linux", { XDG_CACHE_HOME: "/xdg/cache" }, HOME),
    ]) {
      expect(p.startsWith(vault)).toBe(false);
    }
  });
});

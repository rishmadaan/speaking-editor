// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

import { describe, expect, it } from "vitest";
import { productionPackages, sourceFiles, legalComment } from "./release-lib.mjs";

describe("release materials", () => {
  it("includes runtime and nested packages, excluding tools and invalid paths", () => {
    expect(productionPackages({ packages: {
      "": {}, "node_modules/voice": {}, "node_modules/tool": { dev: true },
      "node_modules/voice/node_modules/@scope/helper": {},
    } })).toEqual(["node_modules/voice", "node_modules/voice/node_modules/@scope/helper"]);
    expect(() => productionPackages({ packages: { "node_modules/../secret": {} } })).toThrow();
  });

  it("archives source while excluding vault data, secrets, generated output and git state", () => {
    expect(sourceFiles([
      "LICENSE", "package-lock.json", "src/shell/main.ts", "scripts/release-lib.mjs",
      "reference/editor-sync.ts", "specs/0013-agpl-license-migration.md",
      "third-party/sources/voice.tar.gz", ".github/workflows/release.yml",
      "spikes/spike1-edge-in-obsidian/main.ts", "docs/USER-GUIDE.md",
      "spikes/test-vault/Personal.md", "spikes/test-vault/.obsidian/plugins/x/data.json",
      ".git/config", ".env", "src/.env", "src/private.json", "dist/main.js",
      "node_modules/voice/index.js", "src/../../secret.ts",
    ])).toEqual([
      ".github/workflows/release.yml", "LICENSE", "docs/USER-GUIDE.md",
      "package-lock.json", "reference/editor-sync.ts", "scripts/release-lib.mjs",
      "specs/0013-agpl-license-migration.md", "spikes/spike1-edge-in-obsidian/main.ts",
      "src/shell/main.ts", "third-party/sources/voice.tar.gz",
    ]);
  });

  it("preserves legal text without letting comment terminators become executable", () => {
    const text = "Copyright Someone\r\n*/ throw Error('executed'); /*\n";
    const comment = legalComment(text);
    expect(() => new Function(comment)()).not.toThrow();
    expect(comment.split("\n").map(line => line.slice(3)).join("\n")).toBe(text.replaceAll("\r\n", "\n"));
    expect(comment.split("\n").every(line => line === line.trimEnd())).toBe(true);
  });
});

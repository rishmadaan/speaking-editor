// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Build the Speaking Editor plugin from src/shell/main.ts into dist/, then install
// the built plugin into the throwaway test vault. Dev builds keep the acceptance
// command (DEV_ACCEPTANCE=true); pass --prod to strip it.
// Usage: node build.mjs [--prod]
import { build } from "esbuild";
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { legalComment } from "./scripts/release-lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const prod = process.argv.includes("--prod");
const dev = !prod;
const version = JSON.parse(readFileSync(join(here, "manifest.json"), "utf8")).version;
const legalFiles = ["LICENSE", "LICENSE-NOTICE.md", "LICENSE-EXCEPTION.md", "THIRD_PARTY_NOTICES.md"];
const sourceUrl = `https://github.com/rishmadaan/speaking-editor/releases/download/${version}/speaking-editor-${version}-source.tar.gz`;
const legalText = `Speaking Editor ${version}\nCorresponding source for published releases: ${sourceUrl}\nFor modified distributions, provide the matching corresponding source.\n\n`
  + legalFiles.map(file => `${file}\n\n${readFileSync(join(here, file), "utf8")}`).join("\n\n");

const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [join(here, "src", "shell", "main.ts")],
  outfile: join(dist, "main.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2022",
  define: { DEV_ACCEPTANCE: String(dev) },
  // syntax-level DCE only (names preserved, output stays readable): folds the
  // DEV_ACCEPTANCE guard so the acceptance command and module are genuinely
  // absent from --prod builds, not just skipped at runtime.
  minifySyntax: true,
  metafile: true,
  legalComments: "inline",
  banner: { js: legalComment(legalText) },
  external: [
    "obsidian", "electron", "bufferutil", "utf-8-validate",
    // Obsidian provides the CodeMirror packages at runtime; bundling a second
    // copy would break instanceof checks against the live editor.
    "@codemirror/state", "@codemirror/view", "@codemirror/language",
  ],
  logLevel: "info",
});
writeFileSync(join(dist, "build-meta.json"), JSON.stringify(result.metafile, null, 2) + "\n");

copyFileSync(join(here, "manifest.json"), join(dist, "manifest.json"));
copyFileSync(join(here, "styles.css"), join(dist, "styles.css"));
for (const file of legalFiles) copyFileSync(join(here, file), join(dist, file));

// Install into the test vault so a live Obsidian picks it up.
const vaultPlugin = join(here, "spikes", "test-vault", ".obsidian", "plugins", "speaking-editor");
mkdirSync(vaultPlugin, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css", ...legalFiles]) {
  copyFileSync(join(dist, f), join(vaultPlugin, f));
}

console.log(`built speaking-editor (${dev ? "dev" : "prod"}) -> dist/ and installed -> ${vaultPlugin}`);

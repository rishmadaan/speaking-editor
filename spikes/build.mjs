// Build a spike plugin into the test vault's plugins directory.
// Usage: node spikes/build.mjs <spike-dir-name>
import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const spike = process.argv[2];
if (!spike) { console.error("usage: node spikes/build.mjs <spike-dir>"); process.exit(1); }

const src = join(here, spike);
const manifest = JSON.parse((await import("fs")).readFileSync(join(src, "manifest.json"), "utf8"));
const out = join(here, "test-vault", ".obsidian", "plugins", manifest.id);
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(src, "main.ts")],
  outfile: join(out, "main.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "es2022",
  external: [
    "obsidian", "electron", "bufferutil", "utf-8-validate",
    // Obsidian provides the CodeMirror packages at runtime; bundling a second
    // copy would break instanceof checks against the live editor.
    "@codemirror/state", "@codemirror/view", "@codemirror/language",
  ],
  logLevel: "info",
});
copyFileSync(join(src, "manifest.json"), join(out, "manifest.json"));
console.log(`built ${manifest.id} -> ${out}`);

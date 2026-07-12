// Build the Speaking Editor plugin from src/shell/main.ts into dist/, then install
// the built plugin into the throwaway test vault. Dev builds keep the acceptance
// command (DEV_ACCEPTANCE=true); pass --prod to strip it.
// Usage: node build.mjs [--prod]
import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
const prod = process.argv.includes("--prod");
const dev = !prod;

const dist = join(here, "dist");
mkdirSync(dist, { recursive: true });

await build({
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
  external: [
    "obsidian", "electron", "bufferutil", "utf-8-validate",
    // Obsidian provides the CodeMirror packages at runtime; bundling a second
    // copy would break instanceof checks against the live editor.
    "@codemirror/state", "@codemirror/view", "@codemirror/language",
  ],
  logLevel: "info",
});

copyFileSync(join(here, "manifest.json"), join(dist, "manifest.json"));
copyFileSync(join(here, "styles.css"), join(dist, "styles.css"));

// Install into the test vault so a live Obsidian picks it up.
const vaultPlugin = join(here, "spikes", "test-vault", ".obsidian", "plugins", "speaking-editor");
mkdirSync(vaultPlugin, { recursive: true });
for (const f of ["main.js", "manifest.json", "styles.css"]) {
  copyFileSync(join(dist, f), join(vaultPlugin, f));
}

console.log(`built speaking-editor (${dev ? "dev" : "prod"}) -> dist/ and installed -> ${vaultPlugin}`);

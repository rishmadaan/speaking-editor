// Bump the plugin version across manifest.json, versions.json, and package.json in
// one step, keeping them in lockstep (the standard obsidian-plugin release chore).
// All the logic lives in the pure, unit-tested core (bump-version-lib.mjs); this
// wrapper only reads the three files, calls the core, and writes them back.
//
// Usage: node scripts/bump-version.mjs <new-version>
//   e.g. node scripts/bump-version.mjs 0.2.0
//
// After bumping, commit the three files, then tag the release with the same version
// (the tag drives .github/workflows/release.yml).
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { bumpFiles } from "./bump-version-lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "manifest.json");
const versionsPath = join(root, "versions.json");
const packagePath = join(root, "package.json");

const newVersion = process.argv[2];
if (!newVersion) {
  console.error("usage: node scripts/bump-version.mjs <new-version>  (e.g. 0.2.0)");
  process.exit(1);
}

try {
  const out = bumpFiles(
    {
      manifestText: readFileSync(manifestPath, "utf8"),
      versionsText: readFileSync(versionsPath, "utf8"),
      packageText: readFileSync(packagePath, "utf8"),
    },
    newVersion
  );
  writeFileSync(manifestPath, out.manifestText);
  writeFileSync(versionsPath, out.versionsText);
  writeFileSync(packagePath, out.packageText);
  console.log(`bumped to ${newVersion}: manifest.json, versions.json, package.json`);
  console.log(`next: commit the three files, then tag ${newVersion} to cut the release.`);
} catch (err) {
  console.error(`bump failed: ${err.message}`);
  process.exit(1);
}

// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.
// Run after npm ci and node build.mjs --prod. Uses the platform's tar utility.
import { cpSync, copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { productionPackages, sourceFiles } from "./release-lib.mjs";
import "./verify-release.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
const version = lock.version;
const packages = productionPackages(lock);
const snapshots = JSON.parse(readFileSync(join(root, "third-party/source-archives.json"), "utf8"));
for (const snapshot of snapshots) {
  if (lock.packages[`node_modules/${snapshot.name}`]?.version !== snapshot.version) {
    throw new Error(`Update source snapshot for ${snapshot.name}`);
  }
  const hash = createHash("sha256").update(readFileSync(join(root, snapshot.file))).digest("hex");
  if (hash !== snapshot.sha256) throw new Error(`Source snapshot checksum mismatch: ${snapshot.file}`);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (["node_modules", ".git", ".obsidian", "dist", "test-vault"].includes(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Source contains a symlink: ${path}`);
    return entry.isDirectory() ? walk(path) : [relative(root, path).replaceAll("\\", "/")];
  });
}

const stage = mkdtempSync(join(dist, "source-"));
const folder = `speaking-editor-${version}`;
const source = join(stage, folder);
try {
  for (const file of sourceFiles(walk(root))) {
    const target = join(source, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, file), target);
  }
  // Include the installed runtime packages plus upstream source/build snapshots
  // for packages whose npm publication omits preferred source or build files.
  for (const path of packages) {
    cpSync(join(root, path), join(source, "runtime-dependencies", path), {
      recursive: true,
      filter: input => input === join(root, path) || !relative(join(root, path), input).split(/[\\/]/).includes("node_modules"),
    });
  }
  writeFileSync(join(source, "runtime-dependencies", "packages.json"), JSON.stringify(packages, null, 2) + "\n");
  const archive = join(dist, `${folder}-source.tar.gz`);
  execFileSync("tar", ["-czf", archive, "-C", stage, folder]);
  const url = `https://github.com/rishmadaan/speaking-editor/releases/download/${version}/${folder}-source.tar.gz`;
  const notes = `Speaking Editor ${version}\n\nLicensed under GNU AGPLv3 only with the Obsidian additional permission. Earlier MIT grants remain intact.\n\n[Download corresponding source](${url}). The archive includes first-party source, build instructions, runtime dependencies, and supplemental upstream source. Legal notices are attached and embedded in main.js.\n`;
  writeFileSync(join(dist, "release-notes.md"), notes);
  console.log(`Created ${archive}`);
} finally {
  // Only remove the fresh staging directory directly inside this project's dist.
  if (dirname(resolve(stage)) !== dist) throw new Error("Unsafe staging cleanup path");
  rmSync(stage, { recursive: true, force: true });
}

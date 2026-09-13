// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { legalComment, productionPackages } from "./release-lib.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = path => readFileSync(join(root, path), "utf8");
const json = path => JSON.parse(read(path));
const pkg = json("package.json"), manifest = json("manifest.json"), lock = json("package-lock.json");
for (const version of [manifest.version, lock.version, lock.packages[""].version, json("dist/manifest.json").version]) {
  assert.equal(version, pkg.version, "Release versions must agree");
}
if (process.env.GITHUB_REF_TYPE === "tag") assert.equal(process.env.GITHUB_REF_NAME, pkg.version, "Tag must equal manifest version");
assert.equal(pkg.license, "SEE LICENSE IN LICENSE-NOTICE.md");
assert.equal(lock.packages[""].license, pkg.license);
assert.equal(json("versions.json")[pkg.version], manifest.minAppVersion);
assert.equal(read("AGENTS.md"), read("CLAUDE.md"));

const bundle = read("dist/main.js");
assert(!bundle.includes("runAcceptance"), "Production bundle contains the acceptance harness");
const meta = json("dist/build-meta.json");
assert(!Object.values(meta.outputs).some(output => Object.keys(output.inputs).some(path => path.endsWith("/acceptance.ts"))), "Production bundle contains acceptance.ts");
for (const file of ["LICENSE", "LICENSE-NOTICE.md", "LICENSE-EXCEPTION.md", "THIRD_PARTY_NOTICES.md"]) {
  assert.equal(read(`dist/${file}`), read(file));
  assert(bundle.includes(legalComment(read(file))), `Installed main.js must carry ${file}`);
}
assert(bundle.includes(`/releases/download/${pkg.version}/speaking-editor-${pkg.version}-source.tar.gz`));
const packages = productionPackages(lock);
for (const path of packages) {
  const installed = json(`${path}/package.json`);
  assert.equal(installed.version, lock.packages[path].version);
  assert(read("THIRD_PARTY_NOTICES.md").replaceAll("\r\n", "\n").includes(`## ${installed.name} ${installed.version}\n`), `Missing notice for ${path}`);
}
for (const path of Object.keys(meta.inputs).filter(path => path.includes("node_modules/"))) {
  const packagePath = path.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//)?.[1];
  assert(packages.includes(packagePath), `Unaccounted bundled dependency: ${path}`);
}
console.log("Release versions, embedded licenses, dependency coverage, and production strip checks passed");

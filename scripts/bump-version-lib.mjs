// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

// Pure version-bump core. No filesystem, no process access: it takes the three
// version-carrying file contents as strings plus a target version and returns the
// three updated strings, so the whole thing is unit-testable without touching disk.
// The thin CLI wrapper (bump-version.mjs) is the only part that reads and writes.
//
// The three files kept in lockstep:
//   - manifest.json  ("version" + "minAppVersion")
//   - versions.json  (map of plugin version -> the minAppVersion it shipped with)
//   - package.json   ("version")
//
// Rules enforced here:
//   - the new version must be plain semver (major.minor.patch, all integers)
//   - it must be strictly greater than the current manifest version (no regression,
//     no re-release of the same version)

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Parse "x.y.z" into [major, minor, patch]. Throws on anything else. */
export function parseSemver(version) {
  if (typeof version !== "string") {
    throw new Error(`version must be a string, got ${typeof version}`);
  }
  const m = SEMVER.exec(version.trim());
  if (!m) {
    throw new Error(`not a valid semver version: "${version}" (expected major.minor.patch)`);
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Compare two semver strings. Returns -1, 0, or 1 (a relative to b). */
export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] < pb[i]) return -1;
    if (pa[i] > pb[i]) return 1;
  }
  return 0;
}

// Reserialize an object with 2-space indentation and a trailing newline, matching
// the repo's existing JSON files so a bump produces a minimal diff.
function stringify(obj) {
  return JSON.stringify(obj, null, 2) + "\n";
}

/**
 * Produce the three updated file contents for a new version.
 *
 * @param {{ manifestText: string, versionsText: string, packageText: string }} files
 * @param {string} newVersion  target version, plain semver, strictly greater than current
 * @returns {{ manifestText: string, versionsText: string, packageText: string }}
 */
export function bumpFiles(files, newVersion) {
  const { manifestText, versionsText, packageText } = files;

  // Validate the target first so a bad input never half-writes.
  parseSemver(newVersion);

  const manifest = JSON.parse(manifestText);
  const versions = JSON.parse(versionsText);
  const pkg = JSON.parse(packageText);

  const current = manifest.version;
  if (typeof current !== "string") {
    throw new Error('manifest.json has no "version" string');
  }
  if (typeof manifest.minAppVersion !== "string") {
    throw new Error('manifest.json has no "minAppVersion" string');
  }
  if (compareSemver(newVersion, current) <= 0) {
    throw new Error(
      `version regression: ${newVersion} is not greater than the current ${current}`
    );
  }

  // manifest: new version. minAppVersion is not touched by a bump (a maintainer
  // edits it deliberately when the floor moves).
  manifest.version = newVersion;

  // versions.json: record newVersion -> the minAppVersion it ships with, preserving
  // history. Insertion order stays chronological because JSON.parse keeps key order
  // and we append.
  versions[newVersion] = manifest.minAppVersion;

  // package.json: keep in lockstep.
  pkg.version = newVersion;

  return {
    manifestText: stringify(manifest),
    versionsText: stringify(versions),
    packageText: stringify(pkg),
  };
}

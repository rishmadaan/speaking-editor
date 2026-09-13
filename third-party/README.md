# Supplemental dependency source

source-archives.json records upstream commits, versions, download URLs, and
SHA-256 checksums for the archives in sources/. These are source and build files,
not extra runtime dependencies. They retain their upstream licenses.

- msedge-tts 2.0.7: TypeScript source is omitted from its npm publication. The
  upstream version-bump commit matches package version 2.0.7; npm supplies no
  gitHead for this package.
- https-proxy-agent 5.0.1: TypeScript source is omitted from npm. The commit is
  the published npm gitHead.
- agent-base 6.0.2: npm includes src/ but omits upstream build configuration.
  The commit is the published npm gitHead.
- axios 1.18.1: npm includes lib/ source but omits its Rollup build configuration.
  The commit is the published npm gitHead. Its prebuilt bundle also inlines code
  from proxy-from-env, whose notice and installed source are included separately.

The release script verifies versions and archive checksums before packaging.
Extract an archive with tar -xzf FILE in a separate directory. Consult the
upstream README and package.json scripts for development dependencies and build
commands. msedge-tts uses pnpm and tsc; the two agent packages use npm and tsc;
axios uses npm and Rollup. Upstream build configurations and any upstream
lockfiles are included. The exact installed JavaScript used by the plugin is
also included in runtime-dependencies/node_modules/ in the release archive.

When upgrading a dependency, verify the upstream source corresponds to the npm
version, update this inventory and checksums, and preserve notices. Never replace
an archive silently or label a current upstream branch as an older release.

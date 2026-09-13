# Building and releasing

Speaking Editor 0.2.0 and later use AGPLv3 only with the Obsidian additional
permission. Keep prior MIT releases and their tags intact. The license change
does not revoke permissions already granted for those copies.

## Build from source

Install Node.js 20 or later and npm. Extract the corresponding-source archive,
open a terminal in its speaking-editor-VERSION directory, and run:

```sh
npm ci
npx vitest run
npx tsc -p tsconfig.json --noEmit
node build.mjs --prod
node scripts/verify-release.mjs
```

The build produces dist/main.js, dist/manifest.json, and dist/styles.css. Copy
those three files to VAULT/.obsidian/plugins/speaking-editor/. The build also
copies them and standalone legal notices into spikes/test-vault/ for development.
The full license and notices are embedded as comments in main.js, so the
standard three-file Obsidian installation retains them.

The archive includes runtime-dependencies/node_modules/ with the locked runtime
packages, plus pinned upstream archives in third-party/sources/ for packages
whose npm publications omit original source or build files. npm ci downloads
build tools and the locked packages; it does not modify the archived copies.
Those tools are not bundled in the plugin. See third-party/README.md to rebuild
or modify supplemental upstream source. Obsidian is supplied separately under
its own terms, and is not included in the source archive.

The preferred first-party source is TypeScript. To change a dependency, edit its
original source and rebuild it with its upstream instructions, then point the
plugin build at your modified package. Include your modified dependency source
when distributing the resulting plugin.

## Prepare a release

1. Update the version with node scripts/bump-version.mjs VERSION. Synchronize
   package-lock.json's root version and root package metadata without changing
   unrelated dependency versions. The tag must be exactly VERSION, without v.
2. Keep license declarations and third-party notices current. After a dependency
   upgrade, review its preferred source and licenses, refresh any affected source
   archives/checksums, and update THIRD_PARTY_NOTICES.md with exact upstream texts.
3. Run the build and verification commands above, then
   node scripts/package-source.mjs. It creates
   dist/speaking-editor-VERSION-source.tar.gz and dist/release-notes.md.
4. Extract that source archive to a clean directory and repeat the build checks.
   Check that the archive contains source and dependency notices and excludes
   vault data, settings, keys, caches, and .git metadata.
5. Walk the applicable test-vault acceptance checklist. Record results in the
   numbered spec before closing it; editor behavior changes require live checks.
6. Commit the reviewed change with its spec citation. A human creates and pushes
   the version tag. The workflow checks tag/version alignment, runs the gates,
   builds the plugin, packages source, checks a clean rebuild, and publishes the
   assets with the source link from dist/release-notes.md.

Each release from 0.2.0 must attach the three standard assets, LICENSE,
LICENSE-NOTICE.md, LICENSE-EXCEPTION.md, THIRD_PARTY_NOTICES.md, and the complete
corresponding-source archive. Keep source accessible while offering that release.
Forks must update the release URLs in build.mjs, scripts/package-source.mjs, and
scripts/verify-release.mjs to point to their own corresponding source.

## License references

The unmodified AGPLv3 license text is stored in LICENSE, obtained from the
[SPDX license text collection](https://github.com/spdx/license-list-data/blob/main/text/AGPL-3.0-only.txt).
See [GNU's AGPLv3](https://www.gnu.org/licenses/agpl-3.0.html) for distribution,
additional permissions, and remote-interaction terms. The Obsidian permission is
specific to this project, not a registered SPDX exception or an Obsidian license.

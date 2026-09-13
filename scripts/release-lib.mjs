// Copyright (c) 2026 Rishabh Madaan
// AGPL-3.0-only with the additional permission in LICENSE-EXCEPTION.md.
// See LICENSE and LICENSE-NOTICE.md.

export function productionPackages(lock) {
  return Object.entries(lock.packages).filter(([path, pkg]) => path && !pkg.dev).map(([path]) => {
    if (!/^(?:node_modules\/(?:@[\w.-]+\/)?[\w.-]+)(?:\/node_modules\/(?:@[\w.-]+\/)?[\w.-]+)*$/.test(path)
      || path.split("/").some(part => part === "." || part === "..")) {
      throw new Error(`Invalid dependency path: ${path}`);
    }
    return path;
  }).sort();
}

export function sourceFiles(paths) {
  const roots = new Set([
    "LICENSE", "LICENSE-NOTICE.md", "LICENSE-EXCEPTION.md", "THIRD_PARTY_NOTICES.md",
    "README.md", "DISCLAIMER.md", "PRIVACY.md", "VENDOR.md", "BACKLOG.md",
    "AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md", "COMMIT_CHECKLIST.md",
    "build.mjs", "styles.css", "package.json", "package-lock.json", "manifest.json",
    "versions.json", "tsconfig.json", "vitest.config.ts",
  ]);
  return paths.filter(path => !path.split("/").some(part => part === ".." || part === "."))
    .filter(path => roots.has(path)
      || /^(src|scripts|reference)\/[\w./-]+\.(ts|mjs)$/.test(path)
      || /^(specs|docs)\/[\w/-]+\.(md|gif)$/.test(path)
      || /^third-party\/[\w./-]+\.(md|json|txt|tar\.gz)$/.test(path)
      || /^\.github\/workflows\/[\w-]+\.yml$/.test(path)
      || /^spikes\/[\w-]+\.mjs$/.test(path)
      || /^spikes\/spike[12]-[\w-]+\/(main\.ts|manifest\.json)$/.test(path))
    .sort();
}

export function legalComment(text) {
  return text.replaceAll("\r\n", "\n").split("\n").map(line => line ? `// ${line}` : "//").join("\n");
}

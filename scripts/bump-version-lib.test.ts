import { describe, it, expect } from "vitest";
// @ts-expect-error - pure ESM helper, no .d.ts (not part of the tsc program)
import { parseSemver, compareSemver, bumpFiles } from "./bump-version-lib.mjs";

const manifest = (version: string, minAppVersion = "1.5.0") =>
  JSON.stringify(
    {
      id: "speaking-editor",
      name: "Speaking Editor",
      version,
      minAppVersion,
      description: "d",
      author: "Rishabh",
      isDesktopOnly: true,
    },
    null,
    2
  ) + "\n";

const versions = (map: Record<string, string>) => JSON.stringify(map, null, 2) + "\n";
const pkg = (version: string) =>
  JSON.stringify({ name: "speaking-editor", version, private: true }, null, 2) + "\n";

describe("parseSemver", () => {
  it("parses a plain version", () => {
    expect(parseSemver("1.2.3")).toEqual([1, 2, 3]);
  });
  it("trims surrounding whitespace", () => {
    expect(parseSemver("  0.1.0 ")).toEqual([0, 1, 0]);
  });
  it("rejects a two-part version", () => {
    expect(() => parseSemver("1.2")).toThrow(/valid semver/);
  });
  it("rejects a v-prefixed tag", () => {
    expect(() => parseSemver("v1.2.3")).toThrow(/valid semver/);
  });
  it("rejects a prerelease", () => {
    expect(() => parseSemver("1.2.3-beta.1")).toThrow(/valid semver/);
  });
  it("rejects non-string input", () => {
    // @ts-expect-error deliberate bad input
    expect(() => parseSemver(123)).toThrow();
  });
});

describe("compareSemver", () => {
  it("orders by major, then minor, then patch", () => {
    expect(compareSemver("1.0.0", "0.9.9")).toBe(1);
    expect(compareSemver("1.2.0", "1.10.0")).toBe(-1);
    expect(compareSemver("1.2.3", "1.2.4")).toBe(-1);
  });
  it("reports equality", () => {
    expect(compareSemver("2.0.0", "2.0.0")).toBe(0);
  });
});

describe("bumpFiles", () => {
  it("updates manifest, versions, and package together", () => {
    const out = bumpFiles(
      {
        manifestText: manifest("0.1.0"),
        versionsText: versions({ "0.1.0": "1.5.0" }),
        packageText: pkg("0.1.0"),
      },
      "0.2.0"
    );
    expect(JSON.parse(out.manifestText).version).toBe("0.2.0");
    expect(JSON.parse(out.packageText).version).toBe("0.2.0");
    expect(JSON.parse(out.versionsText)).toEqual({ "0.1.0": "1.5.0", "0.2.0": "1.5.0" });
  });

  it("records the new version against the manifest's current minAppVersion", () => {
    const out = bumpFiles(
      {
        manifestText: manifest("1.0.0", "1.6.0"),
        versionsText: versions({ "1.0.0": "1.5.0" }),
        packageText: pkg("1.0.0"),
      },
      "1.1.0"
    );
    expect(JSON.parse(out.versionsText)["1.1.0"]).toBe("1.6.0");
    // an existing bump never rewrites minAppVersion
    expect(JSON.parse(out.manifestText).minAppVersion).toBe("1.6.0");
  });

  it("preserves 2-space indentation and a trailing newline", () => {
    const out = bumpFiles(
      {
        manifestText: manifest("0.1.0"),
        versionsText: versions({ "0.1.0": "1.5.0" }),
        packageText: pkg("0.1.0"),
      },
      "0.1.1"
    );
    expect(out.manifestText.endsWith("}\n")).toBe(true);
    expect(out.manifestText).toContain('\n  "version": "0.1.1"');
  });

  it("rejects a non-semver target", () => {
    expect(() =>
      bumpFiles(
        {
          manifestText: manifest("0.1.0"),
          versionsText: versions({ "0.1.0": "1.5.0" }),
          packageText: pkg("0.1.0"),
        },
        "latest"
      )
    ).toThrow(/valid semver/);
  });

  it("rejects a version regression", () => {
    expect(() =>
      bumpFiles(
        {
          manifestText: manifest("1.2.0"),
          versionsText: versions({ "1.2.0": "1.5.0" }),
          packageText: pkg("1.2.0"),
        },
        "1.1.0"
      )
    ).toThrow(/regression/);
  });

  it("rejects re-releasing the same version", () => {
    expect(() =>
      bumpFiles(
        {
          manifestText: manifest("1.2.0"),
          versionsText: versions({ "1.2.0": "1.5.0" }),
          packageText: pkg("1.2.0"),
        },
        "1.2.0"
      )
    ).toThrow(/regression/);
  });
});

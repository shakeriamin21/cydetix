import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("explicit development and release boundaries", () => {
  it("preserves every verification step while validating historical release evidence separately", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["verify:development"]).toBe(
      pkg.scripts.verify
        ?.replace("npm run validate:version", "npm run validate:development")
        .replace(" && npm run validate:release-report", ""),
    );
    const result = spawnSync(process.execPath, ["scripts/validate-development.mjs"], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "historical evidence files and immutable alpha.11 identity preserved",
    );
  });

  it("refuses to substitute development evidence in a release context", () => {
    const result = spawnSync(process.execPath, ["scripts/validate-development.mjs"], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      env: { ...process.env, CYDETIX_EXPECTED_TAG: "v0.6.0-alpha.12" },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Development validation cannot validate a release tag");
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain("run: npm run verify\n");
    expect(workflow).not.toContain("verify:development");
  });
});

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function developmentChildEnvironment(): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.CYDETIX_EXPECTED_TAG;
  delete environment.GITHUB_REF_TYPE;
  return environment;
}

function removeDirectoryIfEmpty(directory: string): void {
  try {
    rmdirSync(directory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") throw error;
  }
}

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
      env: developmentChildEnvironment(),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(
      "historical evidence files and immutable release identities preserved",
    );
  });

  it("allows development validation to coexist with newer versioned current evidence", () => {
    const directory = "validation/releases/v0.6.0-beta.1";
    const reportPath = `${directory}/validation-report.json`;
    const report = JSON.parse(
      readFileSync("validation/releases/v0.6.0-alpha.11/validation-report.json", "utf8"),
    ) as { product: { version: string; publicSourceCommit?: string }; [key: string]: unknown };
    const head = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    report.product.version = "0.6.0-beta.1";
    report.product.publicSourceCommit = head;
    const existingReport = existsSync(reportPath) ? readFileSync(reportPath) : undefined;
    mkdirSync(directory, { recursive: true });
    try {
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      const result = spawnSync(process.execPath, ["scripts/validate-development.mjs"], {
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 30_000,
        env: developmentChildEnvironment(),
      });
      expect(result.status, result.stderr).toBe(0);
    } finally {
      if (existingReport === undefined) {
        rmSync(reportPath, { force: true });
        removeDirectoryIfEmpty(directory);
      } else {
        writeFileSync(reportPath, existingReport);
      }
    }
  });

  it.each([
    ["CYDETIX_EXPECTED_TAG", { CYDETIX_EXPECTED_TAG: "v0.6.0-alpha.12" }],
    ["GITHUB_REF_TYPE", { GITHUB_REF_TYPE: "tag" }],
  ])("refuses a release context selected by %s", (_selector, releaseEnvironment) => {
    const result = spawnSync(process.execPath, ["scripts/validate-development.mjs"], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      env: { ...developmentChildEnvironment(), ...releaseEnvironment },
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Development validation cannot validate a release tag");
  });

  it("keeps complete verification in the release workflow", () => {
    const workflow = readFileSync(".github/workflows/release.yml", "utf8");
    expect(workflow).toContain("run: npm run verify\n");
    expect(workflow).not.toContain("verify:development");
  });
});

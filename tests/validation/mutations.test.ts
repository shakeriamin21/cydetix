import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";

const temporaryDirectories: string[] = [];

async function copyFixture(name: string): Promise<string> {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "cydetix-mutation-"));
  temporaryDirectories.push(temporary);
  const target = path.join(temporary, "repo");
  await cp(path.resolve("fixtures", "phase3", name), target, { recursive: true });
  return target;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("security-preserving and security-breaking mutations", () => {
  it("preserves JWT trust conclusions across formatting, comments, and variable renaming", async () => {
    const root = await copyFixture("jwt-unverified");
    const target = path.join(root, "src", "auth.ts");
    const source = await readFile(target, "utf8");
    await writeFile(
      target,
      `// semantics-preserving wrapper comment\n${source.replaceAll("claims", "decodedIdentity").replaceAll("  ", "    ")}`,
      "utf8",
    );
    const report = await scanRepository({ path: root });
    expect(report.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTH-JWT-001"]);
  });

  it("detects replacing cryptographic verification with decoding", async () => {
    const root = await copyFixture("jwt-verified");
    const target = path.join(root, "src", "auth.ts");
    const source = await readFile(target, "utf8");
    await writeFile(target, source.replace("jwt.verify(", "jwt.decode("), "utf8");
    const report = await scanRepository({ path: root });
    expect(report.findings.map((finding) => finding.ruleId)).toContain("AS-AUTH-JWT-001");
  });

  it("detects a security-breaking PKCE method mutation without benchmark-specific behavior", async () => {
    const root = await copyFixture("oauth-secure");
    const target = path.join(root, "src", "oauth.ts");
    const source = await readFile(target, "utf8");
    await writeFile(
      target,
      source.replace(
        'parameters.set("code_challenge_method", "S256");',
        'parameters.set("code_challenge_method", "plain");',
      ),
      "utf8",
    );
    const report = await scanRepository({ path: root });
    expect(report.findings.map((finding) => finding.ruleId)).toContain("AS-AUTH-OAUTH-002");
  });
});

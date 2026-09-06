import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { runRemediation } from "../../src/remediation/fix.js";
import { temporaryDirectory } from "../helpers/temporary.js";

describe("SAFE transactional remediation", () => {
  it("dry-runs with a unified diff and zero writes, then proves the invariant and is idempotent", async () => {
    const temp = await temporaryDirectory("cydetix-fix-");
    const target = path.join(temp, "repo");
    await cp(path.resolve("fixtures", "autofix", "vulnerable"), target, { recursive: true });
    const targetFile = path.join(target, "app.py");
    const original = await readFile(targetFile, "utf8");
    const directoryBefore = await readdir(target);
    const before = await scanRepository({ path: target });
    const finding = before.findings.find(
      (candidate) => candidate.ruleId === "AS-SESSION-001" && candidate.autofix === "SAFE",
    );
    if (!finding) throw new Error("Expected a SAFE session-cookie finding.");

    const dryRun = await runRemediation({
      path: target,
      finding: finding.fingerprint,
      dryRun: true,
      applySafe: true,
    });
    expect(dryRun.plans).toHaveLength(1);
    expect(dryRun.plans[0]?.transformations[0]?.unifiedDiff).toContain("-app.config");
    expect(dryRun.plans[0]?.transformations[0]?.unifiedDiff).toContain("+app.config");
    expect(await readFile(targetFile, "utf8")).toBe(original);
    expect(await readdir(target)).toEqual(directoryBefore);

    const result = await runRemediation({
      path: target,
      finding: finding.fingerprint,
      applySafe: true,
    });
    expect(result.transactions[0]?.finalState).toBe("APPLIED_VERIFIED");
    expect(result.transactions[0]?.findingStateTransitions).toContainEqual(
      expect.objectContaining({
        invariant: "SESSION_COOKIE_HTTPONLY",
        before: "PROVEN_INSECURE",
        after: "PROVEN_SECURE",
        result: "RESOLVED_VERIFIED",
      }),
    );
    expect(await readFile(targetFile, "utf8")).toBe(
      await readFile(path.resolve("fixtures", "autofix", "secure", "app.py"), "utf8"),
    );

    const secureHash = await readFile(targetFile);
    const second = await runRemediation({
      path: target,
      finding: finding.fingerprint,
      applySafe: true,
      nonInteractive: true,
    });
    expect(second.transactions).toEqual([]);
    expect(second.findingsConsidered).toBe(0);
    expect(await readFile(targetFile)).toEqual(secureHash);
  });

  it("redacts credential material from proposed and applied unified diffs", async () => {
    const root = await temporaryDirectory("cydetix-fix-redaction-");
    const credential = ["CYDETIX", "TEST", "SECRET", "A1B2C3D4E5F6G7H8J9K0L1M2"].join("_");
    await writeFile(
      path.join(root, "app.py"),
      `from flask import Flask\napp = Flask(__name__)\nAPI_TOKEN = "${credential}"\napp.config["SESSION_COOKIE_HTTPONLY"] = False\n`,
      "utf8",
    );
    const report = await runRemediation({ path: root, dryRun: true });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(credential);
    expect(serialized).toContain("[REDACTED synthetic-cydetix credential;");
  });
});

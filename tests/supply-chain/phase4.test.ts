import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import type { AdvisoryProvider } from "../../src/supply-chain/advisories.js";
import type { NormalizedAdvisory } from "../../src/supply-chain/model.js";
import { cycloneDx17Schema, generateCycloneDxSbom } from "../../src/supply-chain/sbom.js";

const PHASE4 = path.resolve("fixtures", "phase4");

const affectedProvider: AdvisoryProvider = {
  name: "OSV-fixture",
  endpoint: "https://example.invalid/osv-fixture",
  query(packages) {
    return Promise.resolve(
      packages
        .filter((component) => component.name.endsWith("-vuln"))
        .map((component): NormalizedAdvisory => ({
          id:
            component.name === "direct-vuln"
              ? "GHSA-AUTH-SHIELD-DIRECT"
              : "OSV-AUTH-SHIELD-TRANSITIVE",
          aliases: component.name === "direct-vuln" ? ["CVE-2099-0001"] : [],
          packagePurl: component.purl,
          severity: "HIGH",
          fixedVersions: component.name === "direct-vuln" ? ["1.0.1"] : ["3.1.1"],
          references: ["https://example.invalid/advisory"],
          provider: "OSV-fixture",
        })),
    );
  },
};

describe("Phase 4 supply-chain intelligence", () => {
  it("reconstructs direct/transitive npm packages and correlates exact advisory versions", async () => {
    const report = await scanRepository({
      path: path.join(PHASE4, "dependencies-vulnerable"),
      advisories: "online",
      advisoryProvider: affectedProvider,
      now: new Date("2026-09-02T00:00:00.000Z"),
    });
    const analysis = report.securityAnalysis.supplyChainAnalysis;
    expect(analysis?.inventory.status).toBe("COMPLETE");
    expect(analysis?.inventory.directCount).toBe(2);
    expect(analysis?.inventory.transitiveCount).toBe(1);
    expect(analysis?.inventory.packages.map((component) => component.purl)).toContain(
      "pkg:npm/transitive-vuln@3.1.0",
    );
    expect(analysis?.advisories.state).toBe("CHECKED_FINDINGS");
    const findings = report.findings.filter((finding) => finding.ruleId === "AS-SCA-001");
    expect(findings).toHaveLength(2);
    expect(findings.some((finding) => (finding.evidencePath?.length ?? 0) >= 3)).toBe(true);
    expect(findings.every((finding) => finding.reachability === "unknown")).toBe(true);
  });

  it("keeps offline and provider failure distinct from a checked-clean result", async () => {
    const target = path.join(PHASE4, "dependencies-secure");
    const offline = await scanRepository({ path: target });
    expect(offline.securityAnalysis.supplyChainAnalysis?.advisories.state).toBe(
      "NOT_CHECKED_OFFLINE",
    );
    const failingProvider: AdvisoryProvider = {
      name: "unavailable-fixture",
      endpoint: "https://example.invalid/unavailable",
      query() {
        return Promise.reject(new Error("synthetic provider outage"));
      },
    };
    const unavailable = await scanRepository({
      path: target,
      advisories: "online",
      advisoryProvider: failingProvider,
    });
    expect(unavailable.securityAnalysis.supplyChainAnalysis?.advisories.state).toBe(
      "PROVIDER_UNAVAILABLE",
    );
    expect(unavailable.findings.filter((finding) => finding.ruleId === "AS-SCA-001")).toHaveLength(
      0,
    );
  });

  it("detects a nonfunctional synthetic secret, redacts every report surface, and ignores placeholders", async () => {
    const exposed = await scanRepository({ path: path.join(PHASE4, "secret-exposed") });
    expect(exposed.findings.map((finding) => finding.ruleId)).toContain("AS-SECRET-001");
    const serialized = JSON.stringify(exposed);
    expect(serialized).not.toContain("7G9L2Q4M6R8T1V3X5Z7B9D2F4H6J8K");
    expect(serialized).toContain("[REDACTED synthetic-vibeshield credential;");
    const placeholder = await scanRepository({ path: path.join(PHASE4, "secret-placeholder") });
    expect(
      placeholder.findings.filter((finding) => finding.ruleId === "AS-SECRET-001"),
    ).toHaveLength(0);
  });

  it("distinguishes full-SHA, mutable, and local Action references", async () => {
    const secure = await scanRepository({ path: path.join(PHASE4, "actions-secure") });
    const tagged = await scanRepository({ path: path.join(PHASE4, "actions-tagged") });
    const local = await scanRepository({ path: path.join(PHASE4, "actions-local") });
    expect(secure.findings.filter((finding) => finding.ruleId === "AS-CI-001")).toHaveLength(0);
    expect(tagged.findings.filter((finding) => finding.ruleId === "AS-CI-001")).toHaveLength(1);
    expect(local.findings.filter((finding) => finding.ruleId === "AS-CI-001")).toHaveLength(0);
  });

  it("flags write-all but preserves a narrowly required write permission", async () => {
    const broad = await scanRepository({ path: path.join(PHASE4, "actions-write-all") });
    const narrow = await scanRepository({ path: path.join(PHASE4, "actions-required-write") });
    expect(broad.findings.map((finding) => finding.ruleId)).toContain("AS-CI-002");
    expect(narrow.findings.filter((finding) => finding.ruleId === "AS-CI-002")).toHaveLength(0);
  });

  it("correlates a dangerous pull_request_target chain without flagging benign metadata use", async () => {
    const dangerous = await scanRepository({
      path: path.join(PHASE4, "actions-pr-target-dangerous"),
    });
    const benign = await scanRepository({ path: path.join(PHASE4, "actions-pr-target-benign") });
    const finding = dangerous.findings.find((candidate) => candidate.ruleId === "AS-CI-003");
    expect(finding?.evidencePath?.length).toBeGreaterThanOrEqual(3);
    expect(benign.findings.filter((candidate) => candidate.ruleId === "AS-CI-003")).toHaveLength(0);
  });

  it("detects direct context-to-shell interpolation but not environment indirection", async () => {
    const unsafe = await scanRepository({
      path: path.join(PHASE4, "actions-expression-injection"),
    });
    const safe = await scanRepository({ path: path.join(PHASE4, "actions-expression-safe") });
    expect(unsafe.findings.map((finding) => finding.ruleId)).toContain("AS-CI-004");
    expect(safe.findings.filter((finding) => finding.ruleId === "AS-CI-004")).toHaveLength(0);
  });

  it("generates a schema-validated CycloneDX 1.7 dependency graph", async () => {
    const report = await scanRepository({ path: path.join(PHASE4, "sbom") });
    const inventory = report.securityAnalysis.supplyChainAnalysis?.inventory;
    if (inventory === undefined) throw new Error("expected dependency inventory");
    const bom = generateCycloneDxSbom(inventory, new Date("2026-09-02T00:00:00.000Z"));
    expect(cycloneDx17Schema.parse(bom).specVersion).toBe("1.7");
    expect(bom.components).toHaveLength(2);
    expect(
      bom.dependencies.find((dependency) => dependency.ref.includes("sbom-fixture"))?.dependsOn,
    ).toHaveLength(2);
  });

  it("finds a removed secret in an isolated ephemeral Git repository", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "invariantsec-history-"));
    const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";
    const git = (...args: string[]) => {
      const result = spawnSync("git", ["-C", root, "-c", `core.hooksPath=${nullDevice}`, ...args], {
        shell: false,
        windowsHide: true,
        encoding: "utf8",
        env: {
          ...process.env,
          GIT_CONFIG_NOSYSTEM: "1",
          GIT_CONFIG_GLOBAL: nullDevice,
          GIT_TERMINAL_PROMPT: "0",
        },
      });
      if (result.status !== 0) throw new Error(`git ${args[0] ?? ""} failed`);
    };
    try {
      git("init", "--quiet");
      git("config", "user.name", "InvariantSec Fixture");
      git("config", "user.email", "fixture@invalid.example");
      const historyCredential = [
        "INVARIANTSEC_TEST_",
        "SECRET_M2N4P6R8T1V3X5Z7B9D2F4H6J8K1L3Q5",
      ].join("");
      await writeFile(path.join(root, "config.txt"), `${historyCredential}\n`, "utf8");
      git("add", "config.txt");
      git("commit", "--quiet", "-m", "add synthetic fixture exposure");
      await writeFile(path.join(root, "config.txt"), "credential supplied at runtime\n", "utf8");
      git("add", "config.txt");
      git("commit", "--quiet", "-m", "remove synthetic fixture exposure");

      const report = await scanRepository({ path: root, history: true });
      const secrets = report.securityAnalysis.supplyChainAnalysis?.secrets;
      expect(secrets?.workingTree).toBe("CHECKED_NO_FINDINGS");
      expect(secrets?.history).toBe("CHECKED");
      expect(secrets?.exposures.some((exposure) => exposure.sourceCategory === "git-history")).toBe(
        true,
      );
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain("M2N4P6R8T1V3X5Z7B9D2F4H6J8K1L3Q5");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

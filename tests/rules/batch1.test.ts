import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { RULE_BY_ID } from "../../src/rule-engine/catalogue.js";
import { temporaryDirectory } from "../helpers/temporary.js";

const CASES = [
  {
    name: "SQL injection",
    slug: "sql",
    ruleId: "AS-INJECTION-SQL-001",
    positives: 6,
    owasp: "A05:2025",
  },
  {
    name: "OS command injection",
    slug: "command",
    ruleId: "AS-INJECTION-CMD-001",
    positives: 7,
    owasp: "A05:2025",
  },
  {
    name: "path traversal",
    slug: "path",
    ruleId: "AS-PATH-001",
    positives: 7,
    owasp: "A01:2025",
  },
  {
    name: "SSRF",
    slug: "ssrf",
    ruleId: "AS-SSRF-001",
    positives: 6,
    owasp: "A01:2025",
  },
] as const;

async function scanFixture(slug: string, kind: string) {
  return scanRepository({ path: path.resolve("fixtures", "batch1", slug, kind) });
}

describe.each(CASES)("Batch 1 $name admission", ({ slug, ruleId, positives }) => {
  it("reports every positive and cross-function fixture with proof", async () => {
    const report = await scanFixture(slug, "positive");
    const findings = report.findings.filter((finding) => finding.ruleId === ruleId);
    expect(findings).toHaveLength(positives);
    for (const finding of findings) {
      expect(finding.confidence).toBe("high");
      expect(finding.proofState).toBe("PROVEN_INSECURE");
      expect(finding.analysisCompleteness).toBe("COMPLETE");
      expect(finding.proof?.source.kind).toBe("SOURCE");
      expect(finding.proof?.sink.kind).toBe("SINK");
      expect(finding.proof?.securityControlEvaluation).toBe("ABSENT");
      expect(finding.autofix).toBe("REVIEW_REQUIRED");
      expect(finding.remediationAssessment?.ceiling).toBe("REVIEW_REQUIRED");
    }
  });

  it("does not report negative or near-miss fixtures", async () => {
    const report = await scanFixture(slug, "negative");
    expect(report.findings.filter((finding) => finding.ruleId === ruleId)).toHaveLength(0);
  });

  it("resists adversarial comments, strings, dead code, and shadowed names", async () => {
    const report = await scanFixture(slug, "adversarial");
    const findings = report.findings.filter((finding) => finding.ruleId === ruleId);
    if (slug === "ssrf") expect(findings).toHaveLength(1);
    else expect(findings).toHaveLength(0);
  });

  it("reports UNKNOWN rather than an insecure proof for custom sanitizer semantics", async () => {
    const report = await scanFixture(slug, "unknown");
    expect(report.findings.filter((finding) => finding.ruleId === ruleId)).toHaveLength(0);
    expect(
      report.securityAnalysis.applicationDataflow?.unknowns.some(
        (unknown) => unknown.ruleId === ruleId && unknown.reasonCodes.includes("SANITIZER_UNKNOWN"),
      ),
    ).toBe(true);
    expect(report.securityAnalysis.applicationDataflow?.completeness).toBe("PARTIAL");
  });
});

describe("Batch 1 shared assurance", () => {
  it("gives every production runtime rule a complete admission record", () => {
    for (const rule of RULE_BY_ID.values()) {
      if ((rule.maturity ?? "PRODUCTION") !== "PRODUCTION") continue;
      expect(rule.maxRemediationClass).toBeTruthy();
      expect(rule.adversarialTests?.length).toBeGreaterThan(0);
      expect(rule.falsePositiveAnalysis).toBeTruthy();
      expect(rule.limitations?.length).toBeGreaterThan(0);
      expect(rule.verificationStrategy).toBeTruthy();
      expect(rule.userDocumentation).toBeTruthy();
    }
  });

  it("admits the four rules as production with reviewed standards and REVIEW_REQUIRED ceilings", () => {
    for (const { ruleId, owasp } of CASES) {
      const rule = RULE_BY_ID.get(ruleId);
      expect(rule).toMatchObject({
        maturity: "PRODUCTION",
        maxRemediationClass: "REVIEW_REQUIRED",
        autofix: "REVIEW_REQUIRED",
      });
      expect(rule?.standards.owaspTop10).toEqual([owasp]);
      expect(rule?.standards.asvs.length).toBeGreaterThan(0);
      expect(rule?.adversarialTests?.length).toBeGreaterThan(0);
      expect(rule?.falsePositiveAnalysis).toBeTruthy();
      expect(rule?.limitations?.length).toBeGreaterThan(0);
      expect(rule?.verificationStrategy).toBeTruthy();
      expect(rule?.userDocumentation).toMatch(/^docs\/security\//);
    }
  });

  it("produces stable finding, proof, catalogue, configuration, and suppression fingerprints", async () => {
    const target = path.resolve("fixtures", "batch1", "sql", "positive");
    const first = await scanRepository({ path: target, now: new Date("2026-09-11T00:00:00Z") });
    const second = await scanRepository({ path: target, now: new Date("2026-09-11T00:00:00Z") });
    expect(first.findings).toEqual(second.findings);
    expect(first.reproducibility?.ruleCatalogueFingerprint).toBe(
      second.reproducibility?.ruleCatalogueFingerprint,
    );
    expect(first.reproducibility?.configurationFingerprint).toBe(
      second.reproducibility?.configurationFingerprint,
    );
    expect(first.reproducibility?.suppressionFingerprint).toBe(
      second.reproducibility?.suppressionFingerprint,
    );
  });

  it("surfaces TRUNCATED and emits no Batch 1 proof when the AST bound is exceeded", async () => {
    const target = await temporaryDirectory("cydetix-batch1-bound-");
    const statements = Array.from(
      { length: 13_000 },
      (_, index) => `const value${index} = ${index};`,
    ).join("\n");
    await writeFile(path.join(target, "huge.ts"), statements, "utf8");
    const report = await scanRepository({ path: target });
    expect(report.securityAnalysis.applicationDataflow?.completeness).toBe("TRUNCATED");
    expect(report.reproducibility?.analysisCompleteness).toBe("TRUNCATED");
    expect(
      report.findings.filter((finding) => CASES.some((item) => item.ruleId === finding.ruleId)),
    ).toHaveLength(0);
  });

  it("surfaces parser failures as PARTIAL rather than a secure conclusion", async () => {
    const report = await scanRepository({
      path: path.resolve("fixtures", "batch1", "incomplete"),
    });
    expect(report.securityAnalysis.applicationDataflow?.completeness).toBe("PARTIAL");
    expect(report.reproducibility?.analysisCompleteness).toBe("PARTIAL");
    expect(report.coverage.analysisCompleteness).toContainEqual(
      expect.objectContaining({ engine: "syntax-parsing", status: "PARTIAL" }),
    );
    expect(report.findings).toHaveLength(0);
  });

  it("ignores nested FastAPI annotation fragments that are not parameter identifiers", async () => {
    const target = await temporaryDirectory("cydetix-batch1-fastapi-annotation-");
    await writeFile(
      path.join(target, "app.py"),
      [
        "from typing import Annotated",
        "from fastapi import FastAPI, Header",
        "",
        "app = FastAPI()",
        "",
        '@app.get("/items")',
        "def items(user_agent: Annotated[str | None, Header()] = None):",
        "    return {\"user_agent\": user_agent}",
        "",
      ].join("\n"),
      "utf8",
    );

    const report = await scanRepository({ path: target });
    expect(report.securityAnalysis.applicationDataflow?.completeness).toBe("COMPLETE");
    expect(
      report.findings.filter((finding) => CASES.some((item) => item.ruleId === finding.ruleId)),
    ).toHaveLength(0);
  });
});

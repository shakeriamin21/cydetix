import { writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { RULE_BY_ID } from "../../src/rule-engine/catalogue.js";
import {
  SECURITY_CONTROLS,
  securityControlRegistryFingerprint,
} from "../../src/security-controls/registry.js";
import { temporaryDirectory } from "../helpers/temporary.js";

const CASES = [
  { name: "context-aware XSS", slug: "xss", ruleId: "AS-XSS-001", positives: 10 },
  {
    name: "open redirect",
    slug: "redirect",
    ruleId: "AS-REDIRECT-001",
    positives: 8,
  },
  { name: "CSRF", slug: "csrf", ruleId: "AS-CSRF-001", positives: 4 },
] as const;

async function scanFixture(slug: string, kind: string) {
  return scanRepository({ path: path.resolve("fixtures", "batch2", slug, kind) });
}

describe.each(CASES)("Batch 2 $name admission", ({ slug, ruleId, positives }) => {
  it("reports every admitted positive with proof and a REVIEW_REQUIRED ceiling", async () => {
    const report = await scanFixture(slug, "positive");
    const findings = report.findings.filter((finding) => finding.ruleId === ruleId);
    expect(findings).toHaveLength(positives);
    for (const finding of findings) {
      expect(finding.confidence).toBe("high");
      expect(finding.proofState).toBe("PROVEN_INSECURE");
      expect(finding.analysisCompleteness).toBe("COMPLETE");
      expect(finding.proof?.source.kind).toBe("SOURCE");
      expect(finding.proof?.sink.kind).toBe("SINK");
      expect(finding.proof?.propagationPath.length).toBeLessThanOrEqual(16);
      expect(finding.autofix).toBe("REVIEW_REQUIRED");
      expect(finding.remediationAssessment?.ceiling).toBe("REVIEW_REQUIRED");
    }
  });

  it("does not report secure negative fixtures", async () => {
    const report = await scanFixture(slug, "negative");
    expect(report.findings.filter((finding) => finding.ruleId === ruleId)).toHaveLength(0);
    expect(
      report.securityAnalysis.applicationDataflow?.unknowns.filter(
        (unknown) => unknown.ruleId === ruleId,
      ),
    ).toHaveLength(0);
  });

  it("emits UNKNOWN instead of an insecure proof for opaque security semantics", async () => {
    const report = await scanFixture(slug, "unknown");
    expect(report.findings.filter((finding) => finding.ruleId === ruleId)).toHaveLength(0);
    expect(
      report.securityAnalysis.applicationDataflow?.unknowns.some(
        (unknown) => unknown.ruleId === ruleId,
      ),
    ).toBe(true);
    expect(report.securityAnalysis.applicationDataflow?.completeness).toBe("PARTIAL");
  });
});

describe("Batch 2 context and control semantics", () => {
  it("rejects HTML escaping as proof inside JavaScript context", async () => {
    const report = await scanFixture("xss", "adversarial");
    const findings = report.findings.filter((finding) => finding.ruleId === "AS-XSS-001");
    expect(findings).toHaveLength(1);
    expect(findings[0]?.proof?.securityControlEncountered).toBe(true);
    expect(findings[0]?.proof?.securityControlEvaluation).toBe("RECOGNIZED_INEFFECTIVE");
    expect(
      findings[0]?.proof?.propagationPath.some(
        (step) => step.kind === "CONTROL" && step.label.includes("HTML_ESCAPE"),
      ),
    ).toBe(true);
  });

  it("does not treat a custom component prop or non-DOM property as a raw HTML sink", async () => {
    const report = await scanFixture("xss", "adversarial");
    expect(
      report.findings.filter(
        (finding) =>
          finding.ruleId === "AS-XSS-001" && finding.location.path !== "wrong-context.ts",
      ),
    ).toHaveLength(0);
  });

  it("keeps a slash-prefix redirect check actionable for protocol-relative destinations", async () => {
    const report = await scanFixture("redirect", "adversarial");
    const findings = report.findings.filter((finding) => finding.ruleId === "AS-REDIRECT-001");
    expect(findings).toHaveLength(2);
    expect(
      findings.find((finding) => finding.location.path === "protocol-relative.ts")?.proof
        ?.securityControlEvaluation,
    ).toBe("RECOGNIZED_INEFFECTIVE");
    expect(
      findings.find((finding) => finding.location.path === "non-dominating-check.ts")?.proof
        ?.securityControlEvaluation,
    ).toBe("ABSENT");
  });

  it("uses Security IR to correlate cross-file Express session middleware and a mutating route", async () => {
    const report = await scanFixture("csrf", "positive");
    const finding = report.findings.find(
      (candidate) => candidate.ruleId === "AS-CSRF-001" && candidate.location.path === "routes.ts",
    );
    expect(finding?.proof?.source.location.path).toBe("session-auth.ts");
    expect(finding?.affectedComponent).toContain("POST /account/email");
  });

  it("binds a preceding structural global Express session-auth guard to later routes", async () => {
    const report = await scanFixture("csrf", "positive");
    const finding = report.findings.find(
      (candidate) =>
        candidate.ruleId === "AS-CSRF-001" && candidate.location.path === "global-session.ts",
    );
    expect(finding?.proof?.source.label).toContain("ambient browser credential");
    expect(finding?.affectedComponent).toContain("POST /profile/name");
  });

  it("keeps SameSite-only and custom authentication evidence UNKNOWN", async () => {
    const report = await scanFixture("csrf", "unknown");
    const unknowns = report.securityAnalysis.applicationDataflow?.unknowns.filter(
      (unknown) => unknown.ruleId === "AS-CSRF-001",
    );
    expect(unknowns).toHaveLength(3);
    expect(unknowns?.some((unknown) => unknown.explanation.includes("SameSite"))).toBe(true);
  });

  it("does not apply SameSite evidence from an unrelated module to admitted routes", async () => {
    const report = await scanRepository({ path: path.resolve("fixtures", "batch2", "csrf") });
    const findings = report.findings
      .filter((finding) => finding.ruleId === "AS-CSRF-001")
      .map((finding) => finding.location.path)
      .sort();
    expect(findings).toEqual([
      "positive/flask-login.py",
      "positive/flask-session.py",
      "positive/global-session.ts",
      "positive/routes.ts",
    ]);
    expect(
      report.securityAnalysis.applicationDataflow?.unknowns.some(
        (unknown) =>
          unknown.ruleId === "AS-CSRF-001" &&
          unknown.path === "unknown/same-site.ts" &&
          unknown.explanation.includes("SameSite"),
      ),
    ).toBe(true);
  });

  it("publishes every typed Batch 2 control through a stable registry fingerprint", () => {
    const ids = new Set(SECURITY_CONTROLS.map((control) => control.id));
    for (const id of [
      "HTML_ESCAPE",
      "HTML_SANITIZE",
      "TRUSTED_HTML_CONSTRUCTION",
      "REDIRECT_DESTINATION_ALLOWLIST",
      "SAME_ORIGIN_REDIRECT_POLICY",
      "CSRF_TOKEN_VERIFICATION",
      "ORIGIN_VALIDATION",
      "NON_AMBIENT_AUTH",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
    expect(securityControlRegistryFingerprint()).toMatch(/^[a-f0-9]{64}$/u);
    expect(securityControlRegistryFingerprint()).toBe(securityControlRegistryFingerprint());
  });
});

describe("Batch 2 shared assurance", () => {
  it("requires the complete 28-field admission record for each Batch 2 rule", () => {
    for (const { ruleId } of CASES) {
      const rule = RULE_BY_ID.get(ruleId);
      expect(rule).toMatchObject({
        maturity: "PRODUCTION",
        maxRemediationClass: "REVIEW_REQUIRED",
        autofix: "REVIEW_REQUIRED",
      });
      expect(rule?.supportedSourcePatterns?.length).toBeGreaterThan(0);
      expect(rule?.supportedSinkPatterns?.length).toBeGreaterThan(0);
      expect(rule?.controlSemantics?.length).toBeGreaterThan(0);
      expect(rule?.boundedPropagationModel).toBeTruthy();
      expect(rule?.confidenceModel).toBeTruthy();
      expect(rule?.proofRequirements?.length).toBeGreaterThan(0);
      expect(rule?.positiveTests.length).toBeGreaterThan(0);
      expect(rule?.negativeTests.length).toBeGreaterThan(0);
      expect(rule?.adversarialTests?.length).toBeGreaterThan(0);
      expect(rule?.falsePositiveAnalysis).toBeTruthy();
      expect(rule?.limitations?.length).toBeGreaterThan(0);
      expect(rule?.verificationStrategy).toBeTruthy();
      expect(rule?.userDocumentation).toMatch(/^docs\/security\//u);
    }
  });

  it("is deterministic across paired scans", async () => {
    const target = path.resolve("fixtures", "batch2");
    const now = new Date("2026-09-12T00:00:00Z");
    const first = await scanRepository({ path: target, now });
    const second = await scanRepository({ path: target, now });
    expect(first.findings).toEqual(second.findings);
    expect(first.securityAnalysis.applicationDataflow).toEqual(
      second.securityAnalysis.applicationDataflow,
    );
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

  it("fails closed with no Batch 2 findings when a resource bound is exceeded", async () => {
    const target = await temporaryDirectory("cydetix-batch2-bound-");
    await writeFile(
      path.join(target, "huge.ts"),
      Array.from({ length: 13_000 }, (_, index) => `const value${index} = ${index};`).join("\n"),
      "utf8",
    );
    const report = await scanRepository({ path: target });
    expect(report.securityAnalysis.applicationDataflow?.completeness).toBe("TRUNCATED");
    expect(
      report.findings.filter((finding) => CASES.some((item) => item.ruleId === finding.ruleId)),
    ).toHaveLength(0);
  });

  it("surfaces malformed supported input as PARTIAL and emits no Batch 2 proof", async () => {
    const target = await temporaryDirectory("cydetix-batch2-malformed-");
    await writeFile(
      path.join(target, "broken.ts"),
      "import express from 'express'; app.post('/x', (req, res) => { res.send(req.body.x);",
      "utf8",
    );
    const report = await scanRepository({ path: target });
    expect(report.reproducibility?.analysisCompleteness).toBe("PARTIAL");
    expect(
      report.findings.filter((finding) => CASES.some((item) => item.ruleId === finding.ruleId)),
    ).toHaveLength(0);
  });
});

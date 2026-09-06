import { describe, expect, it } from "vitest";

import type { Finding } from "../../src/core/schema.js";
import { evaluateCorpus } from "../../src/validation/evaluator.js";
import type { CorpusLabels, CorpusManifest } from "../../src/validation/model.js";

const manifest: CorpusManifest = {
  schemaVersion: "1.0.0",
  corpusId: "independent-fixture",
  kind: "EXTERNAL_LABELED",
  source: "https://example.test/corpus",
  sourceProject: "Independent fixture",
  immutableRevision: "a".repeat(40),
  license: "Apache-2.0",
  language: ["TypeScript"],
  frameworks: ["Express"],
  acquisition: "GIT_PINNED_COMMIT",
  labelsPath: "labels.json",
  inventory: {
    totalCases: 7,
    languageCompatible: 6,
    candidateRuleCompatible: 5,
    evaluatedCases: 7,
  },
  notes: ["Synthetic evaluator unit fixture; labels never enter the scanner."],
};

function finding(ruleId: string, path: string, line: number): Finding {
  return {
    fingerprint: `${line}`.repeat(64).slice(0, 64),
    ruleId,
    ruleVersion: "1.0.0",
    severity: "high",
    confidence: "high",
    reachability: "confirmed",
    title: "fixture",
    category: "fixture",
    affectedComponent: path,
    location: {
      path,
      start: { line, column: 0, offset: 0 },
      end: { line, column: 1, offset: 1 },
    },
    evidence: [{ message: "fixture", excerpt: "fixture", redacted: false }],
    securityInvariant: "FIXTURE",
    attackPrerequisite: "fixture",
    impact: "fixture",
    standards: { cwe: [], owaspTop10: [], asvs: [], nist: [] },
    remediation: "fixture",
    autofix: "REVIEW_REQUIRED",
    verificationStatus: "not_attempted",
  };
}

describe("external validation evaluator", () => {
  it("derives valid metrics while excluding UNKNOWN, unsupported, and not-applicable cases", () => {
    const labels: CorpusLabels = {
      schemaVersion: "1.0.0",
      corpusId: manifest.corpusId,
      completeness: "COMPLETE_APPLICABLE_LABELS",
      expectedCases: [
        {
          caseId: "tp",
          ruleId: "AS-X-001",
          path: "tp.ts",
          expected: "VULNERABLE",
          languageCompatible: true,
          ruleCompatible: true,
          expectedUnknown: false,
          rationale: "positive",
        },
        {
          caseId: "fn",
          ruleId: "AS-X-001",
          path: "fn.ts",
          expected: "VULNERABLE",
          languageCompatible: true,
          ruleCompatible: true,
          expectedUnknown: false,
          rationale: "miss",
        },
        {
          caseId: "tn",
          ruleId: "AS-X-001",
          path: "tn.ts",
          expected: "SECURE",
          languageCompatible: true,
          ruleCompatible: true,
          expectedUnknown: false,
          rationale: "negative",
        },
        {
          caseId: "fp",
          ruleId: "AS-X-001",
          path: "fp.ts",
          expected: "SECURE",
          languageCompatible: true,
          ruleCompatible: true,
          expectedUnknown: false,
          rationale: "noise",
        },
        {
          caseId: "unknown",
          ruleId: "AS-X-001",
          path: "unknown.ts",
          expected: "VULNERABLE",
          languageCompatible: true,
          ruleCompatible: true,
          expectedUnknown: true,
          rationale: "insufficient static evidence",
        },
        {
          caseId: "unsupported",
          ruleId: "AS-X-001",
          path: "unsupported.java",
          expected: "VULNERABLE",
          languageCompatible: false,
          ruleCompatible: false,
          expectedUnknown: false,
          rationale: "language unsupported",
        },
        {
          caseId: "not-applicable",
          ruleId: "AS-X-001",
          path: "adjacent.ts",
          expected: "SECURE",
          languageCompatible: true,
          ruleCompatible: false,
          expectedUnknown: false,
          rationale: "rule prerequisite absent",
        },
      ],
      manualAdjudications: [],
    };
    const report = evaluateCorpus(manifest, labels, [
      finding("AS-X-001", "tp.ts", 1),
      finding("AS-X-001", "fp.ts", 1),
    ]);
    expect(report.counts).toMatchObject({
      truePositive: 1,
      falsePositive: 1,
      trueNegative: 1,
      falseNegative: 1,
      unknown: 1,
      unsupported: 1,
      notApplicable: 1,
      languageCompatible: 6,
      ruleCompatible: 5,
      executed: 4,
    });
    expect(report.metrics.precision).toEqual({ value: 0.5, numerator: 1, denominator: 2 });
    expect(report.metrics.recall?.value).toBe(0.5);
    expect(report.metrics.falsePositiveRate?.value).toBe(0.5);
    expect(report.metrics.specificity?.value).toBe(0.5);
    expect(report.metrics.f1?.value).toBe(0.5);
    expect(report.metrics.youden?.value).toBe(0);
  });

  it("withholds recall and records every unadjudicated emitted finding", () => {
    const labels: CorpusLabels = {
      schemaVersion: "1.0.0",
      corpusId: manifest.corpusId,
      completeness: "FINDINGS_ONLY",
      expectedCases: [],
      manualAdjudications: [
        {
          caseId: "reviewed",
          ruleId: "AS-X-001",
          path: "reviewed.ts",
          line: 4,
          disposition: "TRUE_POSITIVE",
          reviewer: "independent reviewer",
          rationale: "reviewed",
        },
      ],
    };
    const report = evaluateCorpus(manifest, labels, [
      finding("AS-X-001", "reviewed.ts", 4),
      finding("AS-X-002", "unreviewed.ts", 8),
    ]);
    expect(report.counts.truePositive).toBe(1);
    expect(report.counts.unknown).toBe(1);
    expect(report.metrics.precision?.denominator).toBe(1);
    expect(report.metrics.recall).toBeUndefined();
  });
});

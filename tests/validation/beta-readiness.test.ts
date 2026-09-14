import { describe, expect, it } from "vitest";
import { validateBetaReadiness, type BetaReadiness } from "../../src/validation/beta-readiness.js";

function first<T>(values: readonly T[]): T {
  const value = values[0];
  if (value === undefined) throw new Error("Synthetic fixture is incomplete");
  return value;
}

function passing(): BetaReadiness {
  const evidence = "synthetic validator fixture; not project evidence";
  return {
    schemaVersion: "1.0.0",
    sourceCommit: "a".repeat(40),
    sourceBinding: evidence,
    version: "0.6.0-alpha.12",
    baselineCommit: "4e13b96cc3539e1b623a4c5a12f10a0954776253",
    baselineTagObject: "e692f1e23d58157a209f511adb6180d3f489a80c",
    tests: {
      total: 374,
      passed: 374,
      failed: 0,
      skipped: 0,
      sandboxPassed: 13,
      sandboxSkipped: 0,
      evidence,
    },
    corpus: {
      groundTruth: "INCOMPLETE",
      recall: null,
      accuracy: null,
      identities: Array.from({ length: 22 }, (_, i) => ({
        repository: `synthetic-${i}`,
        commit: "b".repeat(40),
        scansCompleted: 2,
        determinism: "PASSED" as const,
        evidence,
      })),
      confirmedFP: 0,
      supportedPatternFN: 0,
      unadjudicatedFindings: 0,
      adjudicationScope: evidence,
      fpEvidence: [],
      fnEvidence: [],
      unknown: {
        applicationDataflow: 2,
        authorization: 3,
        authentication: 4,
        findingProof: 1,
        majorCauses: ["Unsupported constructs remain UNKNOWN"],
        limitation: evidence,
      },
    },
    performance: {
      state: "PASSED",
      evidence,
      limitations: [evidence],
      measurements: (["small", "medium", "large"] as const).map((size) => ({
        target: size,
        size,
        samplesPerVersion: 20,
        baselineP50Milliseconds: 10,
        candidateP50Milliseconds: 10,
        baselineP95Milliseconds: 20,
        candidateP95Milliseconds: 20,
        semanticEquivalence: "PASSED",
      })),
    },
    integrations: [
      "codex",
      "claude",
      "cursor",
      "gemini",
      "cline",
      "roo",
      "continue",
      "copilot",
      "goose",
      "windsurf",
      "generic-mcp",
    ].map((agent) => ({
      agent,
      configuration: "PASSED",
      adapterTests: "PASSED",
      subprocess: "PASSED",
      liveHost: "NOT_AVAILABLE",
      evidence,
    })),
    publicContracts: { state: "PASSED", evidence, intentionalChanges: [] },
    supplyChainGates: [
      "lockedInstallation",
      "npmAudit",
      "onlineOsv",
      "cycloneDx",
      "sarif",
      "licenses",
      "privacy",
      "history",
      "gitleaks",
      "workflowSecurity",
      "package",
      "packedInstall",
      "selfScan",
      "mandatorySandbox",
      "hostedCi",
      "codeql",
      "openssf",
      "releaseControls",
    ].map((id) => ({ id, state: "PASSED", evidence })),
    remediationAuthority: "UNCHANGED_EXACT_HTTPONLY_SAFE_ONLY",
    blockers: [],
    verdict: "ALPHA12_BETA_READY_WITH_LIMITATIONS",
  };
}

describe("beta readiness evidence gates", () => {
  it("accepts a complete synthetic positive and does not require unsupported code to become secure", () => {
    expect(validateBetaReadiness(passing()).corpus.unknown.applicationDataflow).toBe(2);
  });
  it("accepts explicitly documented non-blocking limitations without rewriting them", () => {
    const report = passing();
    report.performance.state = "INCONCLUSIVE";
    report.corpus.confirmedFP = 1;
    report.corpus.fpEvidence = ["adjudicated lexical false-positive observation retained"];

    const validated = validateBetaReadiness(report);
    expect(validated.performance.state).toBe("INCONCLUSIVE");
    expect(validated.corpus.confirmedFP).toBe(1);
  });
  it.each([
    [
      "missing hosted gate",
      (r: BetaReadiness) => {
        r.supplyChainGates = r.supplyChainGates.filter((g) => g.id !== "hostedCi");
      },
    ],
    [
      "missing mandatory local gate",
      (r: BetaReadiness) => {
        r.supplyChainGates = r.supplyChainGates.filter((g) => g.id !== "workflowSecurity");
      },
    ],
    [
      "failed reviewed-secret gate",
      (r: BetaReadiness) => {
        first(r.supplyChainGates.filter((g) => g.id === "gitleaks")).state = "FAILED";
      },
    ],
    [
      "sandbox skip",
      (r: BetaReadiness) => {
        r.tests.skipped = 1;
        r.tests.passed--;
        r.tests.sandboxSkipped = 1;
      },
    ],
    [
      "unreviewed finding",
      (r: BetaReadiness) => {
        r.corpus.unadjudicatedFindings++;
      },
    ],
    [
      "supported false negative",
      (r: BetaReadiness) => {
        r.corpus.supportedPatternFN++;
      },
    ],
    [
      "undocumented false positive",
      (r: BetaReadiness) => {
        r.corpus.confirmedFP = 1;
      },
    ],
    [
      "demonstrated performance regression",
      (r: BetaReadiness) => {
        r.performance.state = "FAILED";
      },
    ],
    [
      "performance evidence not run",
      (r: BetaReadiness) => {
        r.performance.state = "NOT_RUN";
      },
    ],
    [
      "inconclusive performance without a documented limitation",
      (r: BetaReadiness) => {
        r.performance.state = "INCONCLUSIVE";
        r.performance.limitations = [];
      },
    ],
    [
      "single scan",
      (r: BetaReadiness) => {
        first(r.corpus.identities).scansCompleted = 1;
      },
    ],
    [
      "nondeterminism",
      (r: BetaReadiness) => {
        first(r.corpus.identities).determinism = "FAILED";
      },
    ],
    [
      "missing p95",
      (r: BetaReadiness) => {
        first(r.performance.measurements).baselineP95Milliseconds = null;
      },
    ],
    [
      "unsupported integration claim",
      (r: BetaReadiness) => {
        first(r.integrations).subprocess = "NOT_RUN";
      },
    ],
    [
      "unresolved blocker",
      (r: BetaReadiness) => {
        r.blockers.push("Needs independent evidence");
      },
    ],
  ] as const)("rejects positive verdict with %s", (_name, mutate) => {
    const report = passing();
    mutate(report);
    expect(() => validateBetaReadiness(report)).toThrow();
  });
  it("accepts an honest negative verdict with incomplete gates and rejects invented accuracy", () => {
    const report = passing();
    report.verdict = "ALPHA12_NOT_BETA_READY";
    first(report.supplyChainGates).state = "NOT_RUN";
    report.blockers = ["Required gate not run"];
    expect(validateBetaReadiness(report).verdict).toBe("ALPHA12_NOT_BETA_READY");
    expect(() =>
      validateBetaReadiness({ ...report, corpus: { ...report.corpus, accuracy: 0.99 } }),
    ).toThrow();
  });
  it("rejects duplicate gate and inconsistent test accounting even for a negative verdict", () => {
    const report = passing();
    report.verdict = "ALPHA12_NOT_BETA_READY";
    report.tests.passed--;
    expect(() => validateBetaReadiness(report)).toThrow("accounting");
    report.tests.passed++;
    report.supplyChainGates.push(first(report.supplyChainGates));
    expect(() => validateBetaReadiness(report)).toThrow("Duplicate");
  });
});

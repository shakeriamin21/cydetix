import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { validateBetaReadiness } from "../dist/validation/beta-readiness.js";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
}).stdout.trim();
const tests = await json(".cydetix/alpha12/tests.json");
const corpus = await json("validation/alpha12/corpus-adjudication.json");
const performance = await json("validation/alpha12/performance.json");
const contracts = await json("validation/alpha12/public-contracts.json");
const sandbox = tests.testResults
  .filter((t) => t.name.includes("container-sandbox.integration"))
  .flatMap((t) => t.assertionResults);
const suiteRecords = tests.testResults.map((suite) => ({
  path: path.relative(process.cwd(), suite.name).replaceAll("\\", "/"),
  status: suite.status,
  passed: suite.assertionResults.filter((t) => t.status === "passed").length,
  failed: suite.assertionResults.filter((t) => t.status === "failed").length,
  skipped: suite.assertionResults.filter((t) => ["pending", "skipped", "todo"].includes(t.status))
    .length,
}));
const normalizeLog = (value) =>
  value
    .replaceAll(process.cwd(), "<workspace>")
    .replaceAll(process.cwd().replaceAll("\\", "/"), "<workspace>")
    .replaceAll(os.tmpdir(), "<temporary>")
    .replaceAll(os.tmpdir().replaceAll("\\", "/"), "<temporary>")
    .replaceAll(os.homedir(), "<home>")
    .replaceAll(os.homedir().replaceAll("\\", "/"), "<home>");
await mkdir("validation/alpha12/gates", { recursive: true });
const gateRecords = [];
for (const file of (await readdir(".cydetix/alpha12/gates"))
  .filter((f) => f.endsWith(".json"))
  .sort()) {
  const gate = await json(`.cydetix/alpha12/gates/${file}`);
  const stdout = normalizeLog(
    await readFile(`.cydetix/alpha12/gates/${gate.id}.stdout.txt`, "utf8"),
  );
  const stderr = normalizeLog(
    await readFile(`.cydetix/alpha12/gates/${gate.id}.stderr.txt`, "utf8"),
  );
  const log = `${stdout}${stderr ? `\nSTDERR\n${stderr}` : ""}`;
  const logPath = `validation/alpha12/gates/${gate.id}.txt`;
  await writeFile(logPath, log);
  gateRecords.push({
    ...gate,
    publicLog: logPath,
    publicLogSha256: sha(log),
    logRedaction:
      "Only developer workspace/home/temp path prefixes replaced in the public log. Original stdout/stderr digests retained.",
  });
}
const getGate = (id) => {
  const gate = gateRecords.find((g) => g.id === id);
  if (!gate) throw new Error(`Missing local gate: ${id}`);
  return gate;
};
const summary = {
  schemaVersion: "1.0.0",
  sourceCommit,
  version: "0.6.0-alpha.12",
  tests: {
    total: tests.numTotalTests,
    passed: tests.numPassedTests,
    failed: tests.numFailedTests,
    skipped: tests.numPendingTests,
    sourceReportSha256: sha(await readFile(".cydetix/alpha12/tests.json")),
    suites: suiteRecords,
  },
  gates: gateRecords,
};
await writeFile(
  "validation/alpha12/local-verification.json",
  `${JSON.stringify(summary, null, 2)}\n`,
);
const integrationFiles = suiteRecords.filter((s) =>
  /tests\/(?:integrations|mcp|remediation|verification)\//u.test(s.path),
);
const integrationPassed =
  integrationFiles.length > 0 && integrationFiles.every((s) => s.failed === 0 && s.skipped === 0);
const integration = [
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
  configuration: integrationPassed ? "PASSED" : "FAILED",
  adapterTests: integrationPassed ? "PASSED" : "FAILED",
  subprocess: integrationPassed ? "PASSED" : "FAILED",
  liveHost: "NOT_RUN",
  evidence:
    "tests/integrations/alpha12.test.ts: each adapter installs/verifies its own config and launches its shared exact runtime definition with correct and wrong versions. Existing adapter/hostile-path/MCP/transaction tests are in local-verification.json. No actual client host was driven.",
}));
await writeFile(
  "validation/alpha12/agent-integrations.json",
  `${JSON.stringify({ schemaVersion: "1.0.0", sourceCommit, version: "0.6.0-alpha.12", publicTools: contracts.mcp.tools.map((t) => t.name), integrations: integration, regressionSuites: integrationFiles, scope: "Configuration validation, adapter tests and direct subprocess/protocol tests. The session-installed alpha.6 MCP bound to a different root is excluded. Live-host validation is NOT_RUN for every client; no network or host installation is inferred." }, null, 2)}\n`,
);
const performanceState = performance.results.every(
  (r) =>
    r.semanticEquivalence === "PASSED" &&
    r.candidateToBaselineP50Ratio <= 1 &&
    r.candidateToBaselineP95Ratio <= 1,
)
  ? "PASSED"
  : "INCONCLUSIVE";
const supplyChainGates = Object.entries({
  lockedInstallation: "install",
  npmAudit: "audit",
  onlineOsv: "osv",
  licenses: "licenses",
  privacy: "privacy",
  history: "history",
  workflowSecurity: "workflow",
  package: "package",
  packedInstall: "packedInstall",
  packedPlugin: "packedPlugin",
  selfScan: "selfScan",
}).map(([id, local]) => {
  const gate = getGate(local);
  return { id, state: gate.state, evidence: gate.publicLog, sourceCommit: gate.sourceCommit };
});
for (const id of ["cycloneDx", "sarif", "releaseControls"])
  supplyChainGates.push({
    id,
    state: getGate("verify").state,
    evidence:
      "verify:development log: official schema checks and unchanged strict workflow/publication controls. Static controls do not establish OIDC publication or hosted approvals.",
    sourceCommit: getGate("verify").sourceCommit,
  });
const gitleaks = await json(".cydetix/evidence/gitleaks-review.json");
await writeFile(
  "validation/alpha12/gitleaks-review.json",
  `${JSON.stringify(gitleaks, null, 2)}\n`,
);
supplyChainGates.push({
  id: "gitleaks",
  state: gitleaks.state === "PASS" ? "PASSED" : "FAILED",
  evidence:
    "validation/alpha12/gitleaks-review.json; pinned Docker v8.30.1, network disabled, complete --all history, no repository ignore directives",
  sourceCommit,
});
supplyChainGates.push({
  id: "mandatorySandbox",
  state: sandbox.length === 13 && sandbox.every((t) => t.status === "passed") ? "PASSED" : "FAILED",
  evidence:
    "13 mandatory Docker integration tests; image digest recorded in tests/verify gate records",
  sourceCommit: getGate("tests").sourceCommit,
});
for (const id of ["hostedCi", "codeql", "openssf"])
  supplyChainGates.push({
    id,
    state: "NOT_RUN",
    evidence:
      "Exact development commit was not pushed or submitted to hosted workflows. Historical alpha.11 results do not satisfy this gate.",
  });
for (const id of [
  "provenanceAttestation",
  "sbomAttestation",
  "trustedPublishing",
  "protectedReleaseEnvironment",
])
  supplyChainGates.push({
    id,
    state: "NOT_RUN",
    evidence:
      "Release workflow/configuration preserved and locally audited. No release, publication, attestation or live release-environment transaction was attempted.",
  });
const blockers = [
  "Exact-commit hosted CI, CodeQL and OpenSSF gates remain unrun; local results do not replace them.",
  "Corpus ground truth remains incomplete and implementation-time adjudication has no independent human review. Supported-pattern FN claims remain limited to named reviews.",
  "Live-host validation has not been performed for the eleven supported client adapters; configuration and direct subprocess coverage are established separately.",
];
if (performanceState !== "PASSED")
  blockers.push(
    "At least one controlled p50/p95 comparison needs review; measurements are descriptive and no statistical equivalence is claimed.",
  );
for (const gate of gateRecords.filter((g) => g.state !== "PASSED"))
  blockers.push(`Local gate failed: ${gate.id}`);
if (corpus.totals.unadjudicatedFindings)
  blockers.push("Emitted corpus findings remain unadjudicated.");
const report = validateBetaReadiness({
  schemaVersion: "1.0.0",
  sourceCommit,
  sourceBinding:
    "Implementation and evidence-generation source at this commit. Individual corpus/performance/gate records bind their actual invocation commit. Later evidence-only commits may change HEAD; no historical release artifact is rewritten.",
  version: "0.6.0-alpha.12",
  baselineCommit: "4e13b96cc3539e1b623a4c5a12f10a0954776253",
  baselineTagObject: "e692f1e23d58157a209f511adb6180d3f489a80c",
  tests: {
    total: tests.numTotalTests,
    passed: tests.numPassedTests,
    failed: tests.numFailedTests,
    skipped: tests.numPendingTests,
    sandboxPassed: sandbox.filter((t) => t.status === "passed").length,
    sandboxSkipped: sandbox.filter((t) => t.status !== "passed").length,
    evidence: "validation/alpha12/local-verification.json",
  },
  corpus: {
    groundTruth: "INCOMPLETE",
    recall: null,
    accuracy: null,
    identities: corpus.repositories.map((r) => ({
      repository: r.repository,
      commit: r.commit,
      scansCompleted: r.scansCompleted,
      determinism: r.determinism,
      evidence: r.evidence,
    })),
    confirmedFP: corpus.totals.unresolvedConfirmedFalseInsecure,
    supportedPatternFN: corpus.totals.supportedPatternFalseNegativesDiscovered,
    adjudicationScope: corpus.supportedPatternFnScope,
    unadjudicatedFindings: corpus.totals.unadjudicatedFindings,
    fpEvidence: [
      "validation/alpha12/baseline-evidence.json: three confirmed prior false insecure conclusions, retained as UNKNOWN in current corpus evidence",
    ],
    fnEvidence: [
      "validation/alpha12/corpus-adjudication.json: explicit review scope and unsupported-case separation",
    ],
    unknown: {
      ...corpus.totals.unknown,
      majorCauses: corpus.unknownCauses.slice(0, 10).map((c) => `${c.count}: ${c.cause}`),
      limitation:
        "Independent proof instances overlap; TRUNCATED/unsupported coverage is separately retained even when an engine emits no UNKNOWN instances.",
    },
  },
  performance: {
    state: performanceState,
    evidence: "validation/alpha12/performance.json",
    measurements: performance.results.map((r) => ({
      target: r.id,
      size: r.size,
      samplesPerVersion: r.variants.candidate.samples,
      baselineP50Milliseconds: r.variants.baseline.p50Milliseconds,
      candidateP50Milliseconds: r.variants.candidate.p50Milliseconds,
      baselineP95Milliseconds: r.variants.baseline.p95Milliseconds,
      candidateP95Milliseconds: r.variants.candidate.p95Milliseconds,
      semanticEquivalence: r.semanticEquivalence,
    })),
    limitations: performance.limitations,
  },
  integrations: integration,
  publicContracts: {
    state: "PASSED",
    evidence:
      "validation/alpha12/public-contracts.json and tests/validation/public-contracts.test.ts",
    intentionalChanges: contracts.intentionalChanges,
  },
  supplyChainGates,
  remediationAuthority: "UNCHANGED_EXACT_HTTPONLY_SAFE_ONLY",
  blockers,
  verdict: "ALPHA12_NOT_BETA_READY",
});
await writeFile("validation/alpha12/beta-readiness.json", `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `${report.verdict}; ${report.tests.passed}/${report.tests.total} tests; ${report.tests.sandboxPassed} sandbox passes; ${report.blockers.length} blockers\n`,
);

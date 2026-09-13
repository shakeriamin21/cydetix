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
const closure = await json("validation/alpha12/closure/blocker-closure.json");
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
  integrationFiles.some(
    (s) => s.path === "tests/integrations/alpha12.test.ts" && s.passed === 11,
  ) && integrationFiles.every((s) => s.status === "passed" && s.failed === 0 && s.skipped === 0);
const contractsPassed = suiteRecords.some(
  (s) =>
    s.path === "tests/validation/public-contracts.test.ts" &&
    s.status === "passed" &&
    s.passed >= 2 &&
    s.failed === 0 &&
    s.skipped === 0,
);
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
  liveHost: agent === "codex" ? "PASSED" : "NOT_RUN",
  evidence: `tests/integrations/alpha12.test.ts: configuration/adapter/direct subprocess with correct and wrong versions. ${agent === "codex" ? "LIVE_HOST_VALIDATED only for scan, explain and path-escape rejection (codex-cli 0.154.0). Fix planning was BLOCKED by host noninteractive approval policy; no mutation tested. See closure/codex-live-host.json." : agent === "claude" ? "Live host NOT_RUN: Claude Code 2.1.197 initialized/listed MCP but model request failed because login is unavailable. See closure/claude-live-host.json." : "Live host NOT_RUN; no actual host session exercised."}`,
}));
await writeFile(
  "validation/alpha12/agent-integrations.json",
  `${JSON.stringify({ schemaVersion: "1.0.0", sourceCommit, version: "0.6.0-alpha.12", publicTools: contracts.mcp.tools.map((t) => t.name), integrations: integration, regressionSuites: integrationFiles, scope: "Configuration, adapter and subprocess tests for all eleven clients; live Codex scan/explain/boundary only. Fix-plan approval is blocked. Claude requires login; other hosts NOT_RUN. The session-installed alpha.6 MCP bound elsewhere is excluded. Host model network access was explicit; routine Cydetix analysis remained offline." }, null, 2)}\n`,
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
  licenses: "verify",
  privacy: "verify",
  history: "history",
  workflowSecurity: "workflow",
  package: "verify",
  packedInstall: "verify",
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
const gitleaksExecution = await json("validation/alpha12/gitleaks-execution.json");
const gitleaks = gitleaksExecution.review;
await writeFile(
  "validation/alpha12/gitleaks-review.json",
  `${JSON.stringify(gitleaks, null, 2)}\n`,
);
supplyChainGates.push({
  id: "gitleaks",
  state: gitleaks.state === "PASS" ? "PASSED" : "FAILED",
  evidence:
    "validation/alpha12/gitleaks-review.json; pinned Docker v8.30.1, network disabled, complete --all history, no repository ignore directives",
  sourceCommit: gitleaksExecution.sourceCommit,
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
    evidence: `validation/alpha12/closure/hosted-checks.json: ${closure.hosted.conclusion}, ${closure.hosted.workflowRuns} workflow runs. Historical alpha.11 results do not satisfy this gate.`,
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
const blockers = [...closure.blockers];
for (const gate of gateRecords.filter((g) => g.state !== "PASSED"))
  blockers.push(
    gate.id === "history"
      ? "All-refs history author audit flags a pre-existing Dependabot noreply identity outside HEAD ancestry. Frozen publication approval metadata was preserved; the separate HEAD audit does not replace this failed gate."
      : `Local gate failed: ${gate.id}`,
  );
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
    confirmedFP:
      corpus.totals.unresolvedConfirmedFalseInsecure +
      closure.corpusReview.confirmedLexicalObservationNoise,
    supportedPatternFN: corpus.totals.supportedPatternFalseNegativesDiscovered,
    adjudicationScope: corpus.supportedPatternFnScope,
    unadjudicatedFindings: corpus.totals.unadjudicatedFindings,
    fpEvidence: [
      "validation/alpha12/baseline-evidence.json: three confirmed prior false insecure conclusions, retained as UNKNOWN in current corpus evidence",
      "validation/alpha12/closure/independent-corpus-review.json: one confirmed narrative-string lexical false-positive observation remains UNKNOWN; no current false-insecure proof established. confirmedFP includes this observation noise.",
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
    evidence:
      "validation/alpha12/performance.json; validation/alpha12/closure/fastapi-repeated.json (80 additional samples/version, paired-cluster interval)",
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
    limitations: [
      ...performance.limitations,
      closure.fastapi.conclusion,
      ...closure.fastapi.limitations,
    ],
  },
  integrations: integration,
  publicContracts: {
    state: contractsPassed ? "PASSED" : "FAILED",
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

import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const base = "validation/alpha12/closure/";
const review = await json(`${base}independent-corpus-review.json`);
const adjudication = await json("validation/alpha12/corpus-adjudication.json");
const repeated = await json(`${base}fastapi-repeated.json`);
const codex = await json(`${base}codex-live-host.json`);
const claude = await json(`${base}claude-live-host.json`);
const hosted = await json(`${base}hosted-checks.json`);
const policy = await json("validation/history-author-allowances.json");
const history = await json(".cydetix/alpha12/gates/history.json");
const historyLog = await readFile(".cydetix/alpha12/gates/history.stdout.txt", "utf8");
const historyReport = JSON.parse(historyLog.slice(historyLog.indexOf("{\n")));
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
}).stdout.trim();
const truncated = review.repositories.filter((r) => r.scanCompleteness === "TRUNCATED");
const byTrigger = (trigger) =>
  truncated.filter((r) => r.truncation.actualTriggers.some((t) => t.trigger === trigger)).length;
const parser = truncated.filter(
  (r) => r.truncation.cooccurringLimitations.parser.totalFailedFiles > 0,
);
const corrections = [
  {
    id: "IR-CORPUS-001",
    state: "RECONCILED",
    evidence:
      "corpus-adjudication.json payatu: identity iteration and file-size bounds, no application truncation",
  },
  {
    id: "IR-CORPUS-002",
    state: "RECONCILED",
    evidence:
      "corpus-adjudication.json SirAppSec: three oversized assets, no application truncation",
  },
  {
    id: "IR-CORPUS-003",
    state: "RECONCILED",
    evidence:
      "corpus-adjudication.json FastAPI lab report_service.py:179 classified LEXICAL_NARRATIVE_ONLY_UNKNOWN; runtime wording noise remains a documented limitation",
  },
  {
    id: "IR-CORPUS-004",
    state: "RECONCILED",
    evidence:
      "docs/security/RULE_COVERAGE.md explicitly lists Python HTML call sinks and excludes implicit Flask returns/callback closure propagation",
  },
];
if (
  !review.decision.independentReviewScopeComplete ||
  review.totals.deferredOmissionCandidates !== 0 ||
  review.repositories.length !== adjudication.repositories.length ||
  review.repositories.some(
    (r) => !adjudication.repositories.some((a) => a.id === r.id && a.commit === r.commit),
  ) ||
  adjudication.repositories
    .find((r) => r.id === "fastapi-appsec-lab")
    .findings.find((f) => f.path === "app/services/report_service.py" && f.line === 179)
    .classification !== "LEXICAL_NARRATIVE_ONLY_UNKNOWN"
)
  throw new Error("Independent review reconciliation is incomplete");
const evidenceFiles = [
  "independent-corpus-review.json",
  "fastapi-plan.json",
  "fastapi-repeated.json",
  "codex-live-host.json",
  "claude-live-host.json",
  "hosted-checks.json",
];
const evidence = await Promise.all(
  evidenceFiles.map(async (file) => ({
    path: `${base}${file}`,
    sha256: digest(await readFile(`${base}${file}`)),
  })),
);
const report = {
  schemaVersion: "1.0.0",
  sourceCommit,
  version: "0.6.0-alpha.12",
  startingCommit: "f16680007b835e7c6b4163ac9a3d5cc4eec27616",
  sourceBinding:
    "Supplemental blocker-closure assembly. Every input retains its actual invocation/review source and SHA-256. No runtime engine, proof, bounds or remediation adapter changed during closure.",
  evidence,
  hosted: {
    state: "NOT_RUN",
    checkedCommit: hosted.sourceCommit,
    conclusion: hosted.conclusion,
    workflowRuns: hosted.results.workflowRuns.totalCount ?? null,
    statuses: hosted.results.status.totalCount ?? null,
    limitation:
      "No exact-commit CI, CodeQL or OpenSSF success exists in the observed public API evidence. No push or dispatch was performed. A pending combined status with zero contexts is not a running or passing check.",
  },
  corpusReview: {
    state: "CLOSED_WITH_LIMITATIONS",
    reviewer: "Independent fresh-context model, not human/third-party certification",
    corrections,
    repositories: review.totals.repositories,
    findingsReviewed: review.totals.emittedFindings,
    unknownReviewed: review.totals.unknownRecordsIncludingFindingProof,
    supportedPatternFN: review.totals.confirmedSupportedPatternFalseNegativesDiscovered,
    confirmedHistoricalFalseInsecureCorrections: 3,
    currentFalseInsecureConclusions: 0,
    confirmedLexicalObservationNoise: 1,
    unsupportedOmissionsReviewed: 2,
    groundTruth: "INCOMPLETE",
    recall: null,
    accuracy: null,
    limitation:
      "Zero supported-pattern FNs applies only to named selective reviews. One Python narrative string remains an UNKNOWN lexical false-positive observation with overstated hash-operation wording; it is not an insecure proof.",
  },
  truncated: {
    total: truncated.length,
    resourceTriggered: truncated.filter((r) =>
      r.truncation.actualTriggers.some((t) => t.category === "RESOURCE"),
    ).length,
    triggerRepositoryCounts: {
      identityIteration: byTrigger("ITERATION_CAP"),
      applicationBounds: byTrigger("APPLICATION_BOUND_EVENTS"),
      fileSize: byTrigger("FILE_SIZE_BOUND"),
    },
    parserCooccurrenceRepositories: parser.length,
    parserFailedFiles: parser.reduce(
      (sum, r) => sum + r.truncation.cooccurringLimitations.parser.totalFailedFiles,
      0,
    ),
    resourceOnlyRepositories: truncated.length - parser.length,
    resourceWithParserRepositories: parser.length,
    solelyParserTriggered: 0,
    solelyFrameworkTriggered: 0,
    repositories: truncated.map((r) => ({
      id: r.id,
      repository: r.repository,
      commit: r.commit,
      ...r.truncation,
    })),
    limitation:
      "Trigger counts overlap. Parser failures contribute PARTIAL coverage and framework limits remain separate. All six application-bound repos exceed 200000 aggregate AST nodes, but per-event subtype/location was not serialized; no exact AST/file/fact/path split is invented.",
  },
  liveHosts: {
    state: "PARTIALLY_CLOSED",
    codex: {
      state: codex.state,
      hostVersion: codex.hostVersion,
      capabilities: codex.transcriptReview.liveValidated,
      fixPlan: codex.transcriptReview.fixPlan,
      fixtureUnchanged: codex.fixtureUnchanged,
    },
    claude: { state: claude.state, hostVersion: claude.hostVersion, reason: claude.blocker },
    otherHosts:
      "NOT_RUN; existing per-adapter configuration and subprocess tests remain separately validated",
    limitation:
      "Representative Codex CLI scan/explain/boundary behavior is live validated. Interactive fix-plan approval and another authenticated representative host remain unestablished. No host UI or live remediation transaction is claimed.",
  },
  fastapi: {
    state: "INCONCLUSIVE",
    samplesPerVersion: repeated.samplesPerVersion,
    p50Ratio: repeated.p50Ratio,
    p95Ratio: repeated.p95Ratio,
    baseline: repeated.baseline,
    candidate: repeated.candidate,
    originalP95Ratio: repeated.originalP95Ratio,
    pairedClusterP95RatioInterval95: repeated.pairedClusterP95RatioInterval95,
    slowerRounds: repeated.slowerRounds,
    rounds: repeated.rounds.map((r) => ({
      round: r.round,
      order: r.order,
      baseline: r.baseline,
      candidate: r.candidate,
      p95Ratio: r.p95Ratio,
    })),
    semanticEquivalenceToOriginalPerVersion: repeated.semanticEquivalenceToOriginalPerVersion,
    conclusion:
      "The original +20.6% p95 slowdown was not consistently reproduced, but the paired-cluster interval includes it and 1.0. Neither a repeated regression nor non-inferiority is established. No optimization or analysis change was made.",
    limitations: repeated.limitations,
  },
  allRefs: {
    state: history.state,
    sourceCommit: history.sourceCommit,
    commitsReviewed: historyReport.commitsReviewed,
    issues: historyReport.issues,
    authorAllowances: historyReport.authorAllowances,
    identities: policy.entries,
    reason:
      "Nine pre-existing remote commits share one public Dependabot identity. The old audit deduplicated issues by email hash and hid eight commits. It now reports each commit. Each allowance is an exact immutable author/committer tuple; future bot commits still fail. No ref/history/release configuration changed.",
  },
  blockers: [
    "Exact development-commit hosted CI, CodeQL and OpenSSF remain NOT_RUN; GitHub has no observed matching commit/workflow evidence.",
    "Representative live-host coverage is partial: Codex scan/explain/boundary passed, noninteractive fix planning was withheld by host approval policy, and Claude requires login. Other live hosts remain NOT_RUN.",
    "FastAPI tail performance remains inconclusive after 80 samples/version: high host variability leaves the original +20.6% p95 change within the descriptive paired-cluster interval. A controlled independent-host comparison remains necessary before accepting performance readiness.",
  ],
  verdict: "ALPHA12_NOT_BETA_READY",
};
if (history.state !== "PASSED") report.blockers.push("All-refs privacy audit has not passed.");
await writeFile(`${base}blocker-closure.json`, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `${report.verdict}: independent review reconciled; all-refs ${history.state}; ${report.blockers.length} remaining blockers.\n`,
);

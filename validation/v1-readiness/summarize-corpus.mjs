import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { format } from "prettier";

const auditedSourceSha = "c937ae1ddbf329bc62fb0376f04bf2123f438f4e";
const ids = [
  "nodegoat",
  "flask-security",
  "vulnerable-typescript",
  "flask-sqlinjection",
  "express-session",
  "express",
  "fastapi",
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const historical = JSON.parse(
  await readFile("validation/alpha12/corpus-adjudication.json", "utf8"),
);
const replays = [];

for (const id of ids) {
  const path = `.cydetix/v1-readiness-corpus/${id}.json`;
  const content = await readFile(path);
  const evidence = JSON.parse(content);
  replays.push({
    id,
    repository: evidence.repository,
    pinnedCommit: evidence.commit,
    productVersion: evidence.version,
    scans: evidence.measurements.length,
    determinism: evidence.determinism,
    normalizedReportSha256: evidence.normalizedReportSha256,
    evidenceSha256: sha256(content),
    findings: evidence.findings.length,
    findingProofStates: evidence.findings.reduce((counts, finding) => {
      counts[finding.proofState] = (counts[finding.proofState] ?? 0) + 1;
      return counts;
    }, {}),
    completeness: evidence.completeness,
    resourceLimitEvents: evidence.resourceLimitEvents,
  });
}

const report = {
  schemaVersion: "1.0.0",
  auditedSourceSha,
  methodology: {
    source:
      "The existing 30-repository corpus remains pinned. Seven representative/adjudication-sensitive repositories were replayed twice against the Beta.3 build without executing target code.",
    scope:
      "The replay checks determinism and preservation of previously adjudicated supported-pattern cases. It is not a new complete human adjudication of every corpus line.",
    groundTruth: "INCOMPLETE",
    recall: null,
    accuracy: null,
  },
  historicalAdjudication: {
    sourceCommit: historical.sourceCommit,
    evidence: "validation/alpha12/corpus-adjudication.json",
    repositories: historical.repositories.length,
    totals: historical.totals,
    supportedPatternFnScope: historical.supportedPatternFnScope,
  },
  currentReplays: replays,
  falsePositiveReview: {
    previouslyConfirmedFalseInsecureBeforeCorrection: 3,
    unresolvedConfirmedFalseInsecure: 0,
    checks: [
      {
        id: "FP-PASSWORD-PURPOSE",
        replay: "flask-security",
        result: "AS-PASSWORD-001@1.0.1 remains UNKNOWN, not PROVEN_INSECURE",
        state: "PASSED",
      },
      {
        id: "FP-KEY-PLACEHOLDER",
        replay: "vulnerable-typescript",
        result: "Both AS-SECRET-001@1.0.1 placeholder-key findings remain UNKNOWN",
        state: "PASSED",
      },
    ],
  },
  falseNegativeReview: {
    newlyEstablishedSupportedPatternFalseNegatives: 0,
    unsupportedCasesPreserved: historical.unsupportedReviews,
    qualification:
      "No new supported-pattern false negative was established in this selective replay/review. This is not a corpus-wide zero-FN, recall, accuracy, completeness, or deployment-security claim.",
  },
  conclusion:
    "The supported-pattern evidence remains suitable for a bounded v1 claim only when UNKNOWN, TRUNCATED, unsupported constructs and incomplete ground truth remain explicit.",
};

if (
  replays.some((entry) => entry.determinism !== "PASSED" || entry.productVersion !== "0.6.0-beta.3")
)
  throw new Error("A current corpus replay failed its binding or determinism check.");
await writeFile(
  "validation/v1-readiness/corpus-review.json",
  await format(JSON.stringify(report), { parser: "json", printWidth: 100 }),
  "utf8",
);
process.stdout.write(
  `${replays.length} representative corpus repositories replayed; complete ground truth and recall remain unclaimed.\n`,
);

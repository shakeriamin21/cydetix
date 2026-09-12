import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportPath = process.argv[2] ?? ".cydetix/evidence/gitleaks.json";
const scope = process.argv[3] ?? "history";
if (scope !== "history")
  throw new Error("Gitleaks report validation supports complete history only.");

const manifestPath = path.resolve("validation", "gitleaks-reviewed-findings.json");
const reportSource = await readFile(reportPath, "utf8");
const manifestSource = await readFile(manifestPath, "utf8");
function parseJson(source, label) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}
const findings = parseJson(reportSource, "Gitleaks report");
const manifest = parseJson(manifestSource, "Gitleaks reviewed-finding manifest");
if (!Array.isArray(findings)) throw new Error("Gitleaks report must be a JSON array.");
if (
  manifest === null ||
  typeof manifest !== "object" ||
  Array.isArray(manifest) ||
  manifest.schemaVersion !== "1.0.0" ||
  manifest.gitleaksVersion !== "8.30.1" ||
  !Array.isArray(manifest.reviewedFindings)
)
  throw new Error("Gitleaks reviewed-finding manifest is malformed.");

const classifications = new Set([
  "PUBLIC_NON_SECRET_IDENTIFIER",
  "INTENTIONAL_TEST_FIXTURE",
  "DOCUMENTATION_EVIDENCE",
  "FALSE_POSITIVE_PATTERN",
]);
const stringFields = ["fingerprint", "ruleId", "description", "file", "commit", "matchDigest"];
const integerFields = ["startLine", "endLine", "startColumn", "endColumn"];

function normalizeFile(value, source) {
  if (typeof value !== "string" || value === "")
    throw new Error(`${source} File must be a non-empty string.`);
  const segments = value.split("/");
  const hasControlCharacter = [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
  if (
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:\//u.test(value) ||
    hasControlCharacter ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  )
    throw new Error(`${source} has a non-canonical path.`);
  return value;
}

function validateReview(review, index) {
  if (review === null || typeof review !== "object" || Array.isArray(review))
    throw new Error(`Reviewed Gitleaks finding ${index} must be an object.`);
  if (review.scope !== "history")
    throw new Error(`Reviewed Gitleaks finding ${index} has an invalid scope.`);
  for (const field of stringFields) {
    if (typeof review[field] !== "string" || review[field] === "")
      throw new Error(`Reviewed Gitleaks finding ${index} has an invalid ${field}.`);
  }
  for (const field of integerFields) {
    if (!Number.isSafeInteger(review[field]) || review[field] < 1)
      throw new Error(`Reviewed Gitleaks finding ${index} has an invalid ${field}.`);
  }
  if (normalizeFile(review.file, `Reviewed Gitleaks finding ${index}`) !== review.file)
    throw new Error(`Reviewed Gitleaks finding ${index} has a non-canonical file.`);
  if (!/^[0-9a-f]{40}$/u.test(review.commit))
    throw new Error(`Reviewed Gitleaks finding ${index} has an invalid commit.`);
  if (!/^[0-9a-f]{64}$/u.test(review.matchDigest))
    throw new Error(`Reviewed Gitleaks finding ${index} has an invalid match digest.`);
  if (review.fingerprint !== `${review.commit}:${review.file}:${review.ruleId}:${review.startLine}`)
    throw new Error(`Reviewed Gitleaks finding ${index} has an inconsistent fingerprint.`);
  if (!classifications.has(review.classification))
    throw new Error(`Reviewed Gitleaks finding ${index} has an unapprovable classification.`);
  if (typeof review.rationale !== "string" || review.rationale.trim().length < 20)
    throw new Error(`Reviewed Gitleaks finding ${index} lacks an explicit rationale.`);
  if (
    !new Set(["PRESENT_NON_SECRET", "HISTORICAL_SUPERSEDED"]).has(review.currentState) ||
    review.reachableHistory !== true
  )
    throw new Error(`Reviewed Gitleaks finding ${index} lacks review-state metadata.`);
}

const reviewsByFingerprint = new Map();
for (const [index, review] of manifest.reviewedFindings.entries()) {
  validateReview(review, index);
  if (reviewsByFingerprint.has(review.fingerprint))
    throw new Error(`Duplicate reviewed Gitleaks fingerprint: ${review.fingerprint}`);
  reviewsByFingerprint.set(review.fingerprint, review);
}

function requireString(finding, field, index) {
  if (typeof finding[field] !== "string" || finding[field] === "")
    throw new Error(`Gitleaks finding ${index} has an invalid ${field}.`);
  return finding[field];
}

function requireInteger(finding, field, index) {
  if (!Number.isSafeInteger(finding[field]) || finding[field] < 1)
    throw new Error(`Gitleaks finding ${index} has an invalid ${field}.`);
  return finding[field];
}

const reviewedClassifications = new Map();
const commits = new Set();
const seenReportFingerprints = new Set();
for (const [index, finding] of findings.entries()) {
  if (finding === null || typeof finding !== "object" || Array.isArray(finding))
    throw new Error(`Gitleaks finding ${index} must be an object.`);
  const fingerprint = requireString(finding, "Fingerprint", index);
  if (seenReportFingerprints.has(fingerprint))
    throw new Error(`Gitleaks finding ${index} duplicates an earlier fingerprint.`);
  seenReportFingerprints.add(fingerprint);
  const file = normalizeFile(requireString(finding, "File", index), `Gitleaks finding ${index}`);
  const ruleId = requireString(finding, "RuleID", index);
  const commit = requireString(finding, "Commit", index);
  const startLine = requireInteger(finding, "StartLine", index);
  if (fingerprint !== `${commit}:${file}:${ruleId}:${startLine}`)
    throw new Error(`Gitleaks finding ${index} has an inconsistent fingerprint.`);
  if (
    finding.SymlinkFile !== "" ||
    !Array.isArray(finding.Tags) ||
    finding.Tags.some((tag) => typeof tag !== "string")
  )
    throw new Error(`Gitleaks finding ${index} has unsupported link or tag metadata.`);
  const review = reviewsByFingerprint.get(fingerprint);
  if (review === undefined || review.scope !== scope)
    throw new Error(`Gitleaks finding ${index} is unreviewed.`);

  const comparisons = [
    ["ruleId", ruleId],
    ["description", requireString(finding, "Description", index)],
    ["file", file],
    ["commit", commit],
    ["startLine", startLine],
    ["endLine", requireInteger(finding, "EndLine", index)],
    ["startColumn", requireInteger(finding, "StartColumn", index)],
    ["endColumn", requireInteger(finding, "EndColumn", index)],
    [
      "matchDigest",
      createHash("sha256")
        .update(requireString(finding, "Match", index))
        .digest("hex"),
    ],
  ];
  if (
    finding.Secret !== "REDACTED" ||
    comparisons.some(([field, value]) => review[field] !== value)
  )
    throw new Error(`Reviewed Gitleaks finding ${index} has an evidence mismatch.`);

  commits.add(review.commit);
  reviewedClassifications.set(
    review.classification,
    (reviewedClassifications.get(review.classification) ?? 0) + 1,
  );
}

const result = {
  schemaVersion: "1.0.0",
  state: "PASS",
  tool: "gitleaks",
  version: manifest.gitleaksVersion,
  scope,
  findings: findings.length,
  reviewedFindings: findings.length,
  unreviewedFindings: 0,
  commitsWithReviewedFindings: commits.size,
  classifications: Object.fromEntries(
    [...reviewedClassifications.entries()].sort(([left], [right]) => left.localeCompare(right)),
  ),
  reportSha256: createHash("sha256").update(reportSource).digest("hex"),
  reviewManifestSha256: createHash("sha256").update(manifestSource).digest("hex"),
  disposition: "EXACT_REVIEWED_NON_SECRET_FINDINGS",
};
const evidenceDirectory = path.resolve(".cydetix", "evidence");
await mkdir(evidenceDirectory, { recursive: true });
await writeFile(
  path.join(
    evidenceDirectory,
    scope === "history" ? "gitleaks-review.json" : "gitleaks-current-review.json",
  ),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

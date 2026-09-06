import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportPath = process.argv[2] ?? ".cydetix/evidence/gitleaks.json";
const scope = process.argv[3] ?? "history";
if (!new Set(["history", "current-tree"]).has(scope))
  throw new Error("Gitleaks scope must be history or current-tree.");
const findings = JSON.parse(await readFile(reportPath, "utf8"));
if (!Array.isArray(findings)) throw new Error("Gitleaks report must be a JSON array.");

const reviewedSyntheticPaths = new Set([
  "dist/remediation/model.d.ts",
  "fixtures/phase4/secret-exposed/config.ts",
  "tests/remediation/safe-fix.test.ts",
  "tests/verification/container-sandbox.integration.test.ts",
]);
for (const finding of findings) {
  const file = String(finding.File)
    .replaceAll("\\", "/")
    .replace(/^\/repo\//u, "");
  if (
    finding.RuleID !== "generic-api-key" ||
    !reviewedSyntheticPaths.has(file) ||
    finding.Secret !== "REDACTED"
  )
    throw new Error(`Unreviewed Gitleaks finding in ${file}.`);
}
const commits = new Set(
  findings
    .map((finding) => finding.Commit)
    .filter((commit) => typeof commit === "string" && commit !== ""),
);
const result = {
  schemaVersion: "1.0.0",
  state: "PASS",
  tool: "gitleaks",
  version: "8.30.1",
  scope,
  findings: findings.length,
  commitsWithReviewedSyntheticFindings: commits.size,
  disposition: "REVIEWED_SYNTHETIC_OR_SCHEMA_TERMS",
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

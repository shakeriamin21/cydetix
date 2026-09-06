import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const reportPath = process.argv[2] ?? ".vibeshield/evidence/gitleaks.json";
const findings = JSON.parse(await readFile(reportPath, "utf8"));
if (!Array.isArray(findings)) throw new Error("Gitleaks report must be a JSON array.");

const reviewedSyntheticPaths = new Set([
  "dist/remediation/model.d.ts",
  "fixtures/phase4/secret-exposed/config.ts",
  "tests/remediation/safe-fix.test.ts",
  "tests/verification/container-sandbox.integration.test.ts",
]);
for (const finding of findings) {
  if (
    finding.RuleID !== "generic-api-key" ||
    !reviewedSyntheticPaths.has(finding.File) ||
    finding.Secret !== "REDACTED"
  )
    throw new Error(`Unreviewed Gitleaks finding in ${String(finding.File)}.`);
}
const commits = new Set(findings.map((finding) => finding.Commit));
const result = {
  schemaVersion: "1.0.0",
  state: "PASS",
  tool: "gitleaks",
  version: "8.30.1",
  findings: findings.length,
  commitsWithReviewedSyntheticFindings: commits.size,
  disposition: "REVIEWED_SYNTHETIC_OR_SCHEMA_TERMS",
};
const evidenceDirectory = path.resolve(".vibeshield", "evidence");
await mkdir(evidenceDirectory, { recursive: true });
await writeFile(
  path.join(evidenceDirectory, "gitleaks-review.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

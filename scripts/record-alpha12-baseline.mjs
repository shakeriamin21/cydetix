import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const sha = (value) => createHash("sha256").update(value).digest("hex");
const tests = JSON.parse(await readFile(".cydetix/alpha12/baseline-tests.json", "utf8"));
const corrections = [];
for (const id of ["flask-security", "vulnerable-typescript"]) {
  const report = JSON.parse(await readFile(`.cydetix/alpha12/baseline-${id}.json`, "utf8"));
  corrections.push({
    id,
    repository: report.repository,
    commit: report.commit,
    version: report.version,
    determinism: report.determinism,
    normalizedReportSha256: report.normalizedReportSha256,
    reviewedFindings: report.findings
      .filter((f) =>
        id === "flask-security" ? f.ruleId === "AS-PASSWORD-001" : f.ruleId === "AS-SECRET-001",
      )
      .map((f) => ({
        fingerprint: f.fingerprint,
        ruleId: f.ruleId,
        ruleVersion: f.ruleVersion,
        path: f.location.path,
        line: f.location.start.line,
        proofState: f.proofState,
        confidence: f.confidence,
        reachability: f.reachability,
        analysisCompleteness: f.analysisCompleteness,
      })),
  });
}
await writeFile(
  "validation/alpha12/baseline-evidence.json",
  `${JSON.stringify(
    {
      schemaVersion: "1.0.0",
      baselineCommit: "4e13b96cc3539e1b623a4c5a12f10a0954776253",
      baselineTagObject: "e692f1e23d58157a209f511adb6180d3f489a80c",
      version: "0.6.0-alpha.11",
      methodology:
        "Runtime built and copied from the clean immutable baseline before existing source modifications. Same Node and locked dependencies. Historical evidence was read only. Corrected observations were replayed twice with that preserved baseline runtime.",
      tests: {
        total: tests.numTotalTests,
        passed: tests.numPassedTests,
        failed: tests.numFailedTests,
        pending: tests.numPendingTests,
        reportSha256: sha(await readFile(".cydetix/alpha12/baseline-tests.json")),
        sandboxPassed: tests.testResults
          .filter((t) => t.name.includes("container-sandbox.integration"))
          .flatMap((t) => t.assertionResults)
          .filter((t) => t.status === "passed").length,
      },
      corrections,
    },
    null,
    2,
  )}\n`,
);

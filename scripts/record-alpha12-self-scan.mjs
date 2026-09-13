import { writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { scanRepository } from "../dist/core/engine.js";
import { toSarif } from "../dist/reporting/sarif.js";
import { generateCycloneDxSbom, cycloneDx17Schema } from "../dist/supply-chain/sbom.js";

const report = await scanRepository({
  path: ".",
  advisories: "offline",
  now: new Date("2026-09-13T00:00:00Z"),
});
const inventory = report.securityAnalysis.supplyChainAnalysis?.inventory;
if (!inventory) throw new Error("Self-scan dependency inventory missing");
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
}).stdout.trim();
const evidence = {
  schemaVersion: "1.0.0",
  sourceCommit,
  version: report.tool.version,
  state: report.findings.length === 0 ? "PASSED" : "FAILED",
  scope:
    "Existing active-finding release gate, not a claim of repository security. Full configured scan includes deliberate fixtures; existing suppressions and limits remain active.",
  filesExamined: report.manifest.filesExamined,
  bytesExamined: report.manifest.bytesExamined,
  findings: report.findings,
  suppressedFindings: report.suppressedFindings.map((f) => ({
    ruleId: f.ruleId,
    fingerprint: f.fingerprint,
    proofState: f.proofState,
    suppression: f.suppression,
  })),
  completeness: report.reproducibility?.analysisCompleteness,
  engines: report.coverage.analysisCompleteness,
  applicationDataflow: report.securityAnalysis.applicationDataflow,
  identityBounds: report.securityAnalysis.securityIr.propagationBounds ?? null,
  authorizationUnknown: report.securityAnalysis.authorizationProofs.filter(
    (p) => p.state === "UNKNOWN",
  ).length,
  authenticationUnknown: report.securityAnalysis.authenticationAnalysis?.results.filter(
    (p) =>
      p.applicability === "UNKNOWN" ||
      (p.applicability === "APPLICABLE" && p.conclusion === "UNKNOWN"),
  ).length,
  advisoryState: report.securityAnalysis.supplyChainAnalysis?.advisories.state,
  limitations: report.coverage.limitations,
};
await writeFile("validation/alpha12/self-scan.json", `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(
  "validation/alpha12/cydetix.cdx.json",
  `${JSON.stringify(cycloneDx17Schema.parse(generateCycloneDxSbom(inventory)), null, 2)}\n`,
);
await writeFile(
  "validation/alpha12/self-scan.sarif.json",
  `${JSON.stringify(toSarif(report), null, 2)}\n`,
);
process.stdout.write(
  `Self-scan ${evidence.state}; ${report.findings.length} active; ${report.suppressedFindings.length} suppressed; ${evidence.completeness}.\n`,
);
if (evidence.state !== "PASSED") process.exitCode = 1;

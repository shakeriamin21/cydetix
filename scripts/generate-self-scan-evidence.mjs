import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";

const root = path.resolve(".");
const report = await scanRepository({
  path: root,
  advisories: "offline",
  now: new Date("2026-09-05T00:00:00.000Z"),
});
const evidence = {
  schemaVersion: "1.0.0",
  state: report.findings.length === 0 ? "PASSED" : "FAILED",
  filesExamined: report.manifest.filesExamined,
  bytesExamined: report.manifest.bytesExamined,
  activeFindings: report.findings.length,
  suppressedFindings: report.suppressedFindings.length,
  rulesEnabled: report.coverage.enabledRuleIds.length,
  securityIrModules: report.securityAnalysis.securityIr.modules.length,
  authenticationNodes: report.authGraph.nodes.length,
};
const evidenceDirectory = path.resolve(".cydetix", "evidence");
await mkdir(evidenceDirectory, { recursive: true });
await writeFile(
  path.join(evidenceDirectory, "self-scan.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Self-scan ${evidence.state}: ${evidence.activeFindings} active, ${evidence.suppressedFindings} suppressed.\n`,
);
if (evidence.state !== "PASSED") process.exitCode = 1;

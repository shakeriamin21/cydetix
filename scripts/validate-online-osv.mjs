import { scanRepository } from "../dist/core/engine.js";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const report = await scanRepository({ path: ".", advisories: "online" });
const analysis = report.securityAnalysis.supplyChainAnalysis;
if (analysis === undefined) throw new Error("Supply-chain analysis was not produced.");
if (!analysis.advisories.state.startsWith("CHECKED_"))
  throw new Error(`OSV gate did not complete: ${analysis.advisories.state}.`);
const identities = analysis.inventory.packages.length;
if (identities === 0) throw new Error("OSV gate had no resolved package identities.");
const result = {
  schemaVersion: "1.0.0",
  state: "PASS",
  provider: "OSV",
  advisoryState: analysis.advisories.state,
  resolvedPackageIdentities: identities,
  sourceTransmitted: false,
};
const evidenceDirectory = path.resolve(".cydetix", "evidence");
await mkdir(evidenceDirectory, { recursive: true });
await writeFile(
  path.join(evidenceDirectory, "osv-online.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

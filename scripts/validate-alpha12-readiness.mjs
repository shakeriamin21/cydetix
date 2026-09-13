import { readFile } from "node:fs/promises";
import { validateBetaReadiness } from "../dist/validation/beta-readiness.js";

const report = validateBetaReadiness(
  JSON.parse(await readFile("validation/alpha12/beta-readiness.json", "utf8")),
);
const prose = await readFile("docs/security/ALPHA12_BETA_READINESS.md", "utf8");
if (!prose.includes(report.verdict)) throw new Error("Human and machine verdict disagree.");
process.stdout.write(
  `Validated alpha.12 beta-readiness schema and evidence gates: ${report.verdict}\n`,
);

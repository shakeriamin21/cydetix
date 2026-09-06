import { readFile } from "node:fs/promises";

import { releaseValidationReportSchema } from "../dist/validation/release.js";

const report = releaseValidationReportSchema.parse(
  JSON.parse(await readFile("validation/validation-report.json", "utf8")),
);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
if (report.product.name !== packageJson.name)
  throw new Error(
    `Release evidence product ${report.product.name} does not match package ${packageJson.name}.`,
  );
if (report.product.version !== packageJson.version)
  throw new Error(
    `Release evidence version ${report.product.version} does not match package ${packageJson.version}.`,
  );
process.stdout.write(
  `Validated release evidence for ${report.product.version}: ${report.verdict}.\n`,
);

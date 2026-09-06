import { readFile } from "node:fs/promises";

import { releaseValidationReportSchema } from "../dist/validation/release.js";

const report = releaseValidationReportSchema.parse(
  JSON.parse(await readFile("validation/validation-report.json", "utf8")),
);
process.stdout.write(
  `Validated release evidence for ${report.product.version}: ${report.verdict}.\n`,
);

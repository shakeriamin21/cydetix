import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { runRemediation } from "../dist/remediation/fix.js";
import { remediationReportSchema } from "../dist/remediation/model.js";

const temporary = await mkdtemp(path.join(os.tmpdir(), "cydetix-remediation-validation-"));
const target = path.join(temporary, "repo");
try {
  await cp(path.resolve("fixtures", "autofix", "vulnerable"), target, { recursive: true });
  const targetFile = path.join(target, "app.py");
  const before = await readFile(targetFile);
  const dryRun = remediationReportSchema.parse(
    await runRemediation({ path: target, dryRun: true, applySafe: true }),
  );
  if (!(await readFile(targetFile)).equals(before) || dryRun.transactions.length !== 0)
    throw new Error("Dry-run mutated the remediation fixture.");
  const applied = remediationReportSchema.parse(
    await runRemediation({ path: target, applySafe: true, nonInteractive: true }),
  );
  if (applied.transactions[0]?.finalState !== "APPLIED_VERIFIED")
    throw new Error("SAFE remediation did not reach APPLIED_VERIFIED.");
  const after = await readFile(targetFile);
  const second = remediationReportSchema.parse(
    await runRemediation({ path: target, applySafe: true, nonInteractive: true }),
  );
  if (second.transactions.length !== 0 || !(await readFile(targetFile)).equals(after))
    throw new Error("SAFE remediation is not idempotent.");
  process.stdout.write(
    "Validated remediation report v1, zero-write dry-run, APPLIED_VERIFIED proof, and idempotent second run.\n",
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}

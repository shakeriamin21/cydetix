import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  sourceBoundEvidenceEnvelopeSchema,
  sourceBoundEvidenceIndexSchema,
} from "../dist/validation/source-bound-evidence.js";
import { establishEvidenceSource, writeEvidenceAtomically } from "./lib/source-bound-evidence.mjs";

const outputIndex = process.argv.indexOf("--output");
if (outputIndex === -1 || process.argv[outputIndex + 1] === undefined)
  throw new Error("An explicit --output path is required.");
const output = path.resolve(process.argv[outputIndex + 1]);
const files = process.argv.slice(outputIndex + 2);
if (files.length === 0) throw new Error("At least one explicit evidence path is required.");
const source = await establishEvidenceSource();
const evidence = [];
for (const file of files) {
  const absolute = path.resolve(file);
  const bytes = await readFile(absolute);
  let decoded;
  try {
    decoded = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error(`Evidence input is not valid JSON: ${file}`);
  }
  const envelope = sourceBoundEvidenceEnvelopeSchema.parse(decoded);
  if (envelope.repository !== source.repository)
    throw new Error(`Evidence repository mismatch: ${file}`);
  if (envelope.sourceCommit !== source.sourceCommit)
    throw new Error(`Evidence source mismatch: ${file}`);
  evidence.push({
    evidenceType: envelope.evidenceType,
    path: path.relative(source.root, absolute).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    required: true,
  });
}
const index = sourceBoundEvidenceIndexSchema.parse({
  evidenceFormatVersion: "1.0.0",
  repository: source.repository,
  sourceCommit: source.sourceCommit,
  evidence,
});
await writeEvidenceAtomically(output, index);
process.stdout.write(
  `Indexed ${evidence.length} explicit evidence records for ${source.sourceCommit}.\n`,
);

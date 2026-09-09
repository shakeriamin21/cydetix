import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { toJSONSchema } from "zod";

import {
  findingSchema,
  repositoryManifestSchema,
  ruleDefinitionSchema,
  scanReportSchema,
} from "../dist/core/schema.js";
import { authorizationProofSchema } from "../dist/authorization-analysis/model.js";
import { authenticationAnalysisSchema } from "../dist/authentication-analysis/model.js";
import { securityIrSchema } from "../dist/security-ir/model.js";
import { supplyChainAnalysisSchema } from "../dist/supply-chain/model.js";
import { cycloneDx17Schema } from "../dist/supply-chain/sbom.js";
import { remediationReportSchema } from "../dist/remediation/model.js";
import {
  sandboxCapabilitySchema,
  verificationExecutionResultSchema,
} from "../dist/verification/model.js";
import {
  corpusManifestSchema,
  corpusLabelsSchema,
  corpusValidationResultSchema,
} from "../dist/validation/model.js";
import { releaseValidationReportSchema } from "../dist/validation/release.js";
import { RULES } from "../dist/rule-engine/catalogue.js";
import { agentCompatibilityReportSchema } from "../dist/integrations/compatibility.js";

const schemas = new Map([
  ["rule.schema.json", toJSONSchema(ruleDefinitionSchema, { target: "draft-7" })],
  ["finding.schema.json", toJSONSchema(findingSchema, { target: "draft-7" })],
  [
    "repository-manifest.schema.json",
    toJSONSchema(repositoryManifestSchema, { target: "draft-7" }),
  ],
  ["scan-report.schema.json", toJSONSchema(scanReportSchema, { target: "draft-7" })],
  ["security-ir.schema.json", toJSONSchema(securityIrSchema, { target: "draft-7" })],
  [
    "authorization-proof.schema.json",
    toJSONSchema(authorizationProofSchema, { target: "draft-7" }),
  ],
  [
    "authentication-analysis.schema.json",
    toJSONSchema(authenticationAnalysisSchema, { target: "draft-7" }),
  ],
  [
    "supply-chain-analysis.schema.json",
    toJSONSchema(supplyChainAnalysisSchema, { target: "draft-7" }),
  ],
  ["cyclonedx-1.7.schema.json", toJSONSchema(cycloneDx17Schema, { target: "draft-7" })],
  ["remediation-report.schema.json", toJSONSchema(remediationReportSchema, { target: "draft-7" })],
  ["sandbox-capability.schema.json", toJSONSchema(sandboxCapabilitySchema, { target: "draft-7" })],
  [
    "verification-execution.schema.json",
    toJSONSchema(verificationExecutionResultSchema, { target: "draft-7" }),
  ],
  ["validation-corpus.schema.json", toJSONSchema(corpusManifestSchema, { target: "draft-7" })],
  ["validation-labels.schema.json", toJSONSchema(corpusLabelsSchema, { target: "draft-7" })],
  [
    "validation-result.schema.json",
    toJSONSchema(corpusValidationResultSchema, { target: "draft-7" }),
  ],
  [
    "release-validation.schema.json",
    toJSONSchema(releaseValidationReportSchema, { target: "draft-7" }),
  ],
  [
    "agent-compatibility.schema.json",
    toJSONSchema(agentCompatibilityReportSchema, { target: "draft-7" }),
  ],
]);
const check = process.argv.includes("--check");
const outputDirectory = path.resolve("schemas");
await mkdir(outputDirectory, { recursive: true });
for (const [name, schema] of schemas) {
  const schemaGeneration = name === "scan-report.schema.json" ? "v2" : "v1";
  const output = `${JSON.stringify({ $id: `https://cydetix.dev/schemas/${schemaGeneration}/${name}`, ...schema }, null, 2)}\n`;
  const target = path.join(outputDirectory, name);
  if (check) {
    const existing = await readFile(target, "utf8").catch(() => undefined);
    if (existing !== output) throw new Error(`Generated schema is stale: ${target}`);
  } else {
    await writeFile(target, output, "utf8");
  }
}
const catalogueDirectory = path.resolve("rules");
const cataloguePath = path.join(catalogueDirectory, "catalogue.json");
const catalogueOutput = `${JSON.stringify({ schemaVersion: "1.0.0", rules: RULES }, null, 2)}\n`;
if (check) {
  const existing = await readFile(cataloguePath, "utf8").catch(() => undefined);
  if (existing !== catalogueOutput)
    throw new Error(`Generated catalogue is stale: ${cataloguePath}`);
} else {
  await mkdir(catalogueDirectory, { recursive: true });
  await writeFile(cataloguePath, catalogueOutput, "utf8");
}
process.stdout.write(
  `${check ? "Checked" : "Wrote"} ${schemas.size} versioned JSON schemas and ${RULES.length} rule definitions.\n`,
);

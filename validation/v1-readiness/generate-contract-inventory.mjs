import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import process from "node:process";
import { format } from "prettier";

import { analysisCompletenessSchema } from "../../dist/core/analysis.js";
import { EXIT } from "../../dist/core/errors.js";
import {
  confidenceSchema,
  configSchema,
  proofStateSchema,
  reachabilitySchema,
  remediationClassSchema,
} from "../../dist/core/schema.js";
import { INTEGRATION_ADAPTERS } from "../../dist/integrations/setup.js";
import { COMPATIBILITY_TIERS } from "../../dist/integrations/types.js";
import { CYDETIX_MCP_TOOLS } from "../../dist/mcp/server.js";
import {
  remediationStateSchema,
  securityProofConclusionSchema,
} from "../../dist/remediation/model.js";
import { RULES } from "../../dist/rule-engine/catalogue.js";

const gitHead = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
  timeout: 10_000,
});
if (
  gitHead.error !== undefined ||
  gitHead.status !== 0 ||
  !/^[a-f0-9]{40}\n?$/u.test(gitHead.stdout)
)
  throw new Error("Could not resolve the audited source SHA.");
const auditedSourceSha = gitHead.stdout.trim();
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const source = await readFile("src/cli/main.ts", "utf8");
const sha256 = (content) => createHash("sha256").update(content).digest("hex");
const stable = "STABLE";
const experimental = "EXPERIMENTAL";

const cliClassifications = new Map([
  ["cydetix", stable],
  ["init", stable],
  ["scan", stable],
  ["dependencies", stable],
  ["secrets", stable],
  ["supply-chain", stable],
  ["sbom", stable],
  ["fix", stable],
  ["mcp", stable],
  ["verify", stable],
  ["remediation", stable],
  ["remediation show", stable],
  ["explain", stable],
  ["rules", stable],
  ["trust", stable],
  ["ci", stable],
  ["version", stable],
  ["setup", experimental],
  ["status", experimental],
  ["auth", experimental],
  ["graph", experimental],
  ["mcp-config", experimental],
  ["standards", experimental],
  ["doctor", experimental],
]);

const cli = [
  {
    command: "cydetix",
    classification: stable,
    arguments: [],
    flags: ["-V, --version", "-h, --help"],
  },
];
for (const match of source
  .slice(source.indexOf("export function buildProgram"))
  .matchAll(
    /\.command\("([^"]+)"\)|\.(?:option|requiredOption)\(\s*"([^"]+)"|\.argument\("([^"]+)"/gu,
  )) {
  if (match[1]) {
    const command = match[1] === "show" ? "remediation show" : match[1];
    cli.push({
      command,
      classification: cliClassifications.get(command) ?? "UNREVIEWED",
      arguments: [],
      flags: ["-h, --help"],
    });
  } else if (match[2]) cli.at(-1).flags.push(match[2]);
  else cli.at(-1).arguments.push(match[3]);
}

const schemaClassifications = new Map([
  ["scan-report.schema.json", stable],
  ["finding.schema.json", stable],
  ["rule.schema.json", stable],
  ["remediation-report.schema.json", stable],
  ["cyclonedx-1.7.schema.json", stable],
]);
const schemas = [];
for (const file of (await readdir("schemas")).filter((name) => name.endsWith(".json")).sort()) {
  const content = await readFile(`schemas/${file}`);
  schemas.push({
    path: `schemas/${file}`,
    sha256: sha256(content),
    classification: schemaClassifications.get(file) ?? experimental,
  });
}

const inventory = {
  schemaVersion: "1.0.0",
  auditedSourceSha,
  immutableBaseline: {
    version: "0.6.0-beta.3",
    commit: "c937ae1ddbf329bc62fb0376f04bf2123f438f4e",
    tag: "v0.6.0-beta.3",
    annotatedTagObject: "29203b647094604184bdd84386a1e7f23809ac28",
    releaseWorkflow: 34947037844,
  },
  package: {
    name: packageJson.name,
    version: packageJson.version,
    type: packageJson.type,
    bin: packageJson.bin,
    files: packageJson.files,
    engines: packageJson.engines,
    exports: packageJson.exports ?? null,
    lifecycleScripts: ["preinstall", "install", "postinstall", "prepare"].filter(
      (name) => packageJson.scripts?.[name] !== undefined,
    ),
    contractAssessment:
      packageJson.exports === undefined
        ? "UNBOUNDED_DEEP_IMPORT_SURFACE"
        : "EXPLICIT_EXPORT_BOUNDARY",
  },
  cli: {
    entries: cli,
    defaults: {
      command: "scan current directory with concise human output",
      scanFormat: "text",
      scanSeverity: "info",
      scanConfidence: "low",
      scanOffline: true,
      ciFormat: "sarif",
      ciFailOn: "high",
      fixDryRun: false,
      fixVerificationRunner: "local",
    },
    exitCodes: EXIT,
    semantics:
      "Default and scan exit 0 after a completed scan even when findings exist; ci/verify exit 1 at policy threshold. Usage is 2, scan failure 3, verification failure 4, verified SAFE application 5, withheld mutation 6, and required-provider unavailability 7. UNKNOWN never means secure.",
  },
  states: {
    proof: proofStateSchema.options,
    confidence: confidenceSchema.options,
    reachability: reachabilitySchema.options,
    completeness: analysisCompletenessSchema.options,
    remediationAuthority: remediationClassSchema.options,
    remediation: remediationStateSchema.options,
    verificationConclusion: securityProofConclusionSchema.options,
  },
  configuration: {
    file: ".cydetix.json",
    schemaVersion: "1.0.0",
    strictDataOnly: true,
    maxBytes: 65_536,
    keys: Object.keys(configSchema.shape),
    limits: {
      maxFileBytes: { default: 1_048_576, minimum: 1_024, maximum: 10_485_760 },
      maxFiles: { default: 100_000, minimum: 1, maximum: 500_000 },
      maxDepth: { default: 40, minimum: 1, maximum: 100 },
      additionalIgnoreMaximumEntries: 100,
    },
    suppressionRequiredFields: ["rule", "scope", "reason", "owner", "created"],
    suppressionOptionalFields: ["fingerprint", "expires"],
  },
  schemas,
  sarif: {
    version: "2.1.0",
    schema:
      "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
    levels: { critical: "error", high: "error", medium: "warning", low: "note", info: "note" },
    partialFingerprint: "cydetix/v1",
    codeFlows: "emitted when a finding has an evidencePath",
    fixes: "emitted only for exact SAFE findings with a concrete replacement",
    properties:
      "Existing Cydetix proof, confidence, reachability, completeness, verification, impact and remediation property names and meanings are stable; new properties may be additive. Other invocation diagnostics are experimental.",
  },
  rules: {
    count: RULES.length,
    entries: RULES.map((rule) => ({
      id: rule.id,
      version: rule.version,
      maturity: rule.maturity ?? "PRODUCTION",
      maxRemediationClass: rule.maxRemediationClass ?? rule.autofix,
    })),
    versionSemantics:
      "IDs are stable security-invariant identities and are not reused. Material changes to meaning, applicability, evidence anchors, proof requirements, default severity, false-positive behavior, or remediation ceiling require explicit review, a rule-version decision, and release documentation; authority never silently increases.",
  },
  mcp: {
    transport: "stdio newline-delimited JSON-RPC",
    retainedRequestCharacterLimit: 1_048_576,
    tools: CYDETIX_MCP_TOOLS,
    exactToolNames: CYDETIX_MCP_TOOLS.map((tool) => tool.name),
    rootBinding: "canonical configured project root; request paths may only narrow inside it",
    versionBinding: "--require-version rejects mismatch before serving requests",
  },
  agents: {
    compatibilityTiers: COMPATIBILITY_TIERS,
    adapters: INTEGRATION_ADAPTERS.map((adapter) => ({
      id: adapter.id,
      displayName: adapter.displayName,
      compatibilityTier: adapter.compatibilityTier,
      capabilities: adapter.capabilities,
    })),
    contract:
      "Persistent configuration binds canonical project root, exact Node executable, exact installed entrypoint and exact Cydetix version. Host configuration formats and live invocation behavior remain best-effort/experimental.",
  },
  compatibilityRisks: [
    {
      id: "CONTRACT-PACKAGE-EXPORTS",
      severity: "V1_BLOCKER",
      state: "CLOSED",
      evidence:
        "package.json now exports only five reviewed stable JSON schemas and package metadata. The CLI bin remains public; package root, dist, MCP implementation, declarations, and experimental schemas reject deep imports in source and packed-consumer tests.",
    },
    {
      id: "CONTRACT-STABILITY-TIERS",
      severity: "V1_BLOCKER",
      state: "CLOSED",
      evidence:
        "docs/V1_COMPATIBILITY.md and contract-policy.json classify every required surface as STABLE, EXPERIMENTAL, or INTERNAL and define evolution rules.",
    },
    {
      id: "CONTRACT-RULE-VERSION-POLICY",
      severity: "DOCUMENTATION_GAP",
      state: "CLOSED",
      evidence:
        "The V1 policy freezes public rule IDs as invariant identities and requires explicit rule-version review for meaning, applicability, proof, anchor, severity, false-positive, or remediation-ceiling changes.",
    },
    {
      id: "CONTRACT-INVENTORY-REQUIRED-OPTION",
      severity: "DOCUMENTATION_GAP",
      state: "CLOSED",
      evidence:
        "The historical Alpha.12 static inventory omitted required graph --auth even though CLI help, implementation and tests expose it; this inventory includes requiredOption declarations.",
    },
  ],
};

const output = await format(JSON.stringify(inventory), { parser: "json", printWidth: 100 });
const target = "validation/v1-readiness/contract-inventory.json";
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== output)
    throw new Error("V1 public contract inventory drifted; review compatibility before updating.");
} else await writeFile(target, output, "utf8");
process.stdout.write(
  `Inventoried ${cli.length} CLI entries, ${schemas.length} schemas, ${RULES.length} rules, ${INTEGRATION_ADAPTERS.length} agent adapters, and exactly ${CYDETIX_MCP_TOOLS.length} MCP tools.\n`,
);

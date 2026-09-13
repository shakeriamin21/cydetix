import { readFile, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { CYDETIX_MCP_TOOLS } from "../dist/mcp/server.js";
import { RULES } from "../dist/rule-engine/catalogue.js";
import { EXIT } from "../dist/core/errors.js";
import {
  proofStateSchema,
  confidenceSchema,
  reachabilitySchema,
  remediationClassSchema,
  configSchema,
} from "../dist/core/schema.js";
import { analysisCompletenessSchema } from "../dist/core/analysis.js";
import {
  remediationStateSchema,
  securityProofConclusionSchema,
} from "../dist/remediation/model.js";

const candidate = "PUBLIC_STABLE_CANDIDATE";
const experimental = "PUBLIC_EXPERIMENTAL";
const source = await readFile("src/cli/main.ts", "utf8");
const cli = [
  {
    command: "cydetix",
    classification: candidate,
    arguments: [],
    flags: ["-V, --version", "-h, --help"],
  },
];
for (const match of source
  .slice(source.indexOf("export function buildProgram"))
  .matchAll(/\.command\("([^"]+)"\)|\.option\(\s*"([^"]+)"|\.argument\("([^"]+)"/gu)) {
  if (match[1]) {
    const command = match[1] === "show" ? "remediation show" : match[1];
    cli.push({
      command,
      classification: [
        "setup",
        "status",
        "doctor",
        "graph",
        "auth",
        "mcp-config",
        "standards",
      ].includes(command)
        ? experimental
        : candidate,
      arguments: [],
      flags: ["-h, --help"],
    });
  } else if (match[2]) cli.at(-1).flags.push(match[2]);
  else cli.at(-1).arguments.push(match[3]);
}
const schemas = [];
for (const file of (await readdir("schemas")).filter((file) => file.endsWith(".json")).sort()) {
  const content = await readFile(`schemas/${file}`);
  schemas.push({
    path: `schemas/${file}`,
    sha256: createHash("sha256").update(content).digest("hex"),
    classification: [
      "scan-report.schema.json",
      "finding.schema.json",
      "rule.schema.json",
      "remediation-report.schema.json",
      "cyclonedx-1.7.schema.json",
    ].includes(file)
      ? candidate
      : experimental,
  });
}
const inventory = {
  schemaVersion: "1.0.0",
  version: "0.6.0-alpha.12",
  cli,
  states: {
    classification: candidate,
    proof: proofStateSchema.options,
    confidence: confidenceSchema.options,
    reachability: reachabilitySchema.options,
    remediationAuthority: remediationClassSchema.options,
    completeness: analysisCompletenessSchema.options,
    remediation: remediationStateSchema.options,
    verificationConclusion: securityProofConclusionSchema.options,
    findingVerification: ["not_attempted", "verified", "failed"],
    verificationStage: ["PASSED", "FAILED", "SKIPPED", "NOT_AUTHORIZED", "UNAVAILABLE"],
  },
  exitCodes: {
    classification: candidate,
    values: EXIT,
    semantics:
      "scan/default 0 means completed; use ci/verify for a finding policy gate. fix success is 5 when applied and verified. UNKNOWN never means secure, regardless of process exit.",
  },
  mcp: {
    classification: candidate,
    tools: CYDETIX_MCP_TOOLS,
    transport: "stdio newline-delimited JSON-RPC; 1048576 retained characters per request",
    results: [
      "content plus structuredContent.report",
      "content plus structuredContent.remediationReport",
      "content plus structuredContent.rule or finding",
    ],
    errors: {
      parse: -32700,
      invalidRequest: -32600,
      methodNotFound: -32601,
      invalidParameters: -32602,
    },
  },
  rules: {
    classification: candidate,
    entries: RULES.map((rule) => ({
      id: rule.id,
      version: rule.version,
      ceiling: rule.maxRemediationClass ?? rule.autofix,
    })),
  },
  schemas,
  otherInterfaces: [
    {
      name: "Human headings, ordering and wording",
      classification: experimental,
      contract:
        "Locations and independent proof/confidence/reachability/completeness/verification/authority are required. Text is not a parsing API; no-findings never guarantees security.",
    },
    {
      name: "SARIF 2.1.0 results, codeFlows and cydetix/v1 partial fingerprints",
      classification: candidate,
      contract:
        "Severity mapping and file coordinates are stable candidates; Cydetix property bags remain additive experimental evidence.",
    },
    {
      name: ".cydetix.json",
      classification: candidate,
      keys: Object.keys(configSchema.shape),
      contract:
        "Strict data-only schema; no executable configuration. Exact baseline hashes and rule/scope/fingerprint suppressions remain auditable; expiration is evaluated at scan time.",
    },
    {
      name: "Finding fingerprints",
      classification: candidate,
      contract:
        "SHA-256 of rule identity, normalized relative path and detector evidence anchor joined by NUL. Rule-specific anchor changes require documented compatibility review; identical finding context is stable, arbitrary edits are not promised stable.",
    },
    {
      name: "Catalogue/configuration/suppression fingerprints",
      classification: candidate,
      contract:
        "Canonical sorted-key JSON SHA-256; array order preserved. Never normalize security evidence to force matching results.",
    },
    {
      name: "Host configuration layouts and managed skills",
      classification: experimental,
      contract:
        "Exact Node/entrypoint/project root/version binding; atomic managed edits. Host versions and live execution need separate validation.",
    },
    {
      name: "release validation JSON",
      classification: experimental,
      contract:
        "Versioned release-validation.schema.json; historical artifacts immutable. No local-only report establishes hosted gates or authorization.",
    },
    {
      name: "beta readiness and corpus evidence",
      classification: experimental,
      contract:
        "Internal validation methodology exposed publicly; incomplete adjudication, failures and gate provenance remain explicit.",
    },
    {
      name: "dist module imports, Security IR builders, parser nodes, internal caches and hooks",
      classification: "INTERNAL",
      contract:
        "No public SDK or ABI promise. Versioned diagnostic projections do not stabilize implementation functions.",
    },
  ],
  intentionalChanges: [
    "Complete-history Gitleaks validation rejects empty/subset reports missing immutable reviewed findings; Git scan failures no longer pass through an empty JSON report.",
    "MCP rejects unknown keys, wrong types, non-object arguments and invalid IDs rather than accepting inputs contrary to its published schema.",
    "MCP retained request text is bounded before a terminating newline arrives; oversized frames cannot consume unbounded retained memory.",
    "explain defaults to human text; --format json preserves structured rule access. status aliases read-only setup --status.",
    "Human finding counts no longer deduplicate distinct evidence. UNKNOWN means proof uncertainty rather than unknown reachability; both remain visible independently.",
    "SARIF property bags additionally retain full finding proof and UNKNOWN instances. Scan/remediation schema versions are unchanged.",
    "AS-PASSWORD-001@1.0.1 preserves the observed hash signal but reports UNKNOWN for unestablished credential-storage purpose and runtime reachability; high confidence in a hash operation does not prove insecure password storage.",
    "AS-SECRET-001@1.0.1 preserves private-key header observations as UNKNOWN for working-tree and history findings; marker-only matching does not prove key material or a deployed credential. Other credential patterns retain their existing proof semantics and every remediation ceiling remains unchanged.",
    "Babel scope failures are explicit file-local analysis limitations. Propagation iteration/evidence-path exhaustion is TRUNCATED with no actionable application-dataflow proof; numeric bounds are unchanged.",
    "Security identity propagation now enforces 10000 facts/eight iterations and discards incomplete propagated trust on exhaustion; optional securityIr.propagationBounds and TRUNCATED coverage retain counters while dependent authorization/tenant proofs remain UNKNOWN.",
    "Commander usage errors are printed once with unchanged exit 2; a missing scan directory retains scan-failure exit 3.",
    "verify:development validates current versions and immutable historical evidence. Strict release gates remain unchanged and reject the unprepared development candidate.",
    "Blocker closure: history audit now reports every offending commit instead of collapsing a shared email hash; adds exact commit/author/committer privacy allowances in validation/history-author-allowances.json. No future bot/domain/ref-pattern exemption or historical publication change. Python HTML sink documentation explicitly excludes existing unsupported implicit Flask returns and callback/closure flows; engine coverage unchanged.",
  ],
};
const output = `${JSON.stringify(inventory, null, 2)}\n`;
const target = "validation/alpha12/public-contracts.json";
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== output)
    throw new Error(
      "Public contract inventory changed; review and document compatibility before updating it.",
    );
} else await writeFile(target, output);
process.stdout.write(
  `Inventoried ${cli.length} CLI entries, ${schemas.length} schemas, ${RULES.length} rules and exactly ${CYDETIX_MCP_TOOLS.length} MCP tools.\n`,
);

import { z } from "zod";

import { PRODUCT } from "../core/brand.js";
import { remediationClassSchema, ruleMaturitySchema } from "../core/schema.js";
import { DATAFLOW_RESOURCE_BOUNDS } from "../dataflow-analysis/bounded-engine.js";
import { remediationCeiling } from "../remediation/assessment.js";
import { RULES, ruleCatalogueFingerprint } from "../rule-engine/catalogue.js";
import {
  SECURITY_CONTROLS,
  securityControlRegistryFingerprint,
} from "../security-controls/registry.js";

const publicRuleSchema = z
  .object({
    id: z.string().min(1),
    version: z.string().min(1),
    maturity: ruleMaturitySchema,
    title: z.string().min(1),
    category: z.string().min(1),
    cwe: z.array(z.string()),
    owaspTop10: z.array(z.string()),
    asvs: z.array(z.string()),
    supportedLanguages: z.array(z.string()),
    supportedFrameworks: z.array(z.string()),
    maxRemediationClass: remediationClassSchema,
  })
  .strict();

export const rulesReportSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    cydetixVersion: z.string().min(1),
    catalogueFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    rules: z.array(publicRuleSchema),
  })
  .strict();

export const trustReportSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    version: z.string().min(1),
    catalogueFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    controlRegistryFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    maturityCounts: z
      .object({
        experimental: z.number().int().nonnegative(),
        validated: z.number().int().nonnegative(),
        production: z.number().int().nonnegative(),
      })
      .strict(),
    analysisEngines: z.array(z.string().min(1)),
    proofCapabilities: z.array(z.string().min(1)),
    safeRemediationAdapters: z.array(z.string().min(1)),
    verificationStrategies: z.array(z.string().min(1)),
    securityControls: z.array(
      z
        .object({
          id: z.string().min(1),
          version: z.string().min(1),
          context: z.string().min(1),
          proofEffect: z.string().min(1),
        })
        .strict(),
    ),
    resourceBounds: z.record(z.string(), z.number().int().positive()),
    unsupportedOrIncomplete: z.array(z.string().min(1)),
  })
  .strict();

export function createRulesReport(): z.infer<typeof rulesReportSchema> {
  return rulesReportSchema.parse({
    schemaVersion: "1.0.0",
    cydetixVersion: PRODUCT.version,
    catalogueFingerprint: ruleCatalogueFingerprint(),
    rules: [...RULES]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((rule) => ({
        id: rule.id,
        version: rule.version,
        maturity: rule.maturity ?? "PRODUCTION",
        title: rule.title,
        category: rule.category,
        cwe: rule.standards.cwe,
        owaspTop10: rule.standards.owaspTop10,
        asvs: rule.standards.asvs,
        supportedLanguages: rule.supportedLanguages,
        supportedFrameworks: rule.supportedFrameworks,
        maxRemediationClass: remediationCeiling(rule),
      })),
  });
}

export function createTrustReport(): z.infer<typeof trustReportSchema> {
  const maturities = RULES.map((rule) => rule.maturity ?? "PRODUCTION");
  return trustReportSchema.parse({
    schemaVersion: "1.0.0",
    version: PRODUCT.version,
    catalogueFingerprint: ruleCatalogueFingerprint(),
    controlRegistryFingerprint: securityControlRegistryFingerprint(),
    maturityCounts: {
      experimental: maturities.filter((value) => value === "EXPERIMENTAL").length,
      validated: maturities.filter((value) => value === "VALIDATED").length,
      production: maturities.filter((value) => value === "PRODUCTION").length,
    },
    analysisEngines: [
      "bounded repository discovery",
      "Babel JavaScript/TypeScript parser",
      "Lezer Python parser",
      "bounded application source-propagation-control-sink engine 1.0.0",
      "authentication invariant proof engine",
      "supply-chain correlation engine",
    ],
    proofCapabilities: [
      "request source provenance",
      "direct assignment and alias propagation",
      "template and concatenation propagation",
      "object-property propagation",
      "same-file argument and return propagation",
      "recognized contextual controls",
      "reachable route-to-sink evidence paths",
      "explicit UNKNOWN and TRUNCATED outcomes",
    ],
    safeRemediationAdapters: [
      "AS-SESSION-001 HttpOnly false-to-true exact local transform with source hash and invariant rescan",
    ],
    verificationStrategies: [
      "source hash precondition",
      "parser validation",
      "targeted rescan",
      "security invariant state transition",
      "transaction rollback on failed verification",
    ],
    securityControls: SECURITY_CONTROLS.map((control) => ({
      id: control.id,
      version: control.version,
      context: control.context,
      proofEffect: control.proofEffect,
    })),
    resourceBounds: DATAFLOW_RESOURCE_BOUNDS,
    unsupportedOrIncomplete: [
      "general cross-file Batch 1 and Batch 2 dataflow outside explicit Security IR route and middleware edges",
      "Python cross-function Batch 1 and Batch 2 dataflow",
      "dynamic dispatch, reflection, eval, and generated code",
      "unknown custom sanitizer semantics",
      "whole-program reachability and dependency implementation reachability",
      "SSRF DNS resolution, redirect, proxy, and IP-range policy",
      "path traversal symlink/junction race proof",
      "XSS CSS contexts, arbitrary template engines, stored-data provenance, and runtime sanitizer configuration",
      "open-redirect encoded destinations, alternate schemes, framework normalization, and custom URL wrappers",
      "CSRF custom middleware, deployment topology, method override, and SameSite-only proof",
    ],
  });
}

export function renderRulesText(report = createRulesReport()): string {
  const lines = [
    `Cydetix ${report.cydetixVersion} rules`,
    `Catalogue fingerprint: ${report.catalogueFingerprint}`,
    "",
  ];
  for (const rule of report.rules) {
    lines.push(
      `${rule.id}@${rule.version} [${rule.maturity}] ${rule.title}`,
      `  ${rule.category}; ${rule.cwe.join(", ")}; OWASP ${rule.owaspTop10.join(", ")}; ASVS ${rule.asvs.join(", ") || "not mapped"}; ceiling ${rule.maxRemediationClass}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderTrustText(report = createTrustReport()): string {
  return [
    `Cydetix ${report.version} trust report`,
    `Catalogue fingerprint: ${report.catalogueFingerprint}`,
    `Control registry fingerprint: ${report.controlRegistryFingerprint}`,
    `Rule maturity: ${report.maturityCounts.production} production, ${report.maturityCounts.validated} validated, ${report.maturityCounts.experimental} experimental`,
    `SAFE adapters: ${report.safeRemediationAdapters.length}`,
    `Unsupported/incomplete areas: ${report.unsupportedOrIncomplete.length}`,
    "",
  ].join("\n");
}

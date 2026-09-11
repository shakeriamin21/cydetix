import { z } from "zod";

import { analysisCompletenessSchema, remediationReasonCodeSchema } from "./analysis.js";

import {
  authorizationProofSchema,
  evidencePathStepSchema,
} from "../authorization-analysis/model.js";
import {
  authenticationAnalysisSchema,
  authenticationStandardMappingSchema,
} from "../authentication-analysis/model.js";
import { securityIrSchema } from "../security-ir/model.js";
import { supplyChainAnalysisSchema } from "../supply-chain/model.js";
import { applicationDataflowAnalysisSchema } from "../dataflow-analysis/model.js";

export const severitySchema = z.enum(["info", "low", "medium", "high", "critical"]);
export const confidenceSchema = z.enum(["low", "medium", "high"]);
export const reachabilitySchema = z.enum([
  "unknown",
  "unlikely",
  "possible",
  "likely",
  "confirmed",
]);
export const remediationClassSchema = z.enum(["SAFE", "REVIEW_REQUIRED", "ARCHITECTURAL"]);
export const ruleMaturitySchema = z.enum(["EXPERIMENTAL", "VALIDATED", "PRODUCTION"]);
export const proofStateSchema = z.enum([
  "PROVEN_SECURE",
  "PROVEN_INSECURE",
  "UNKNOWN",
  "NOT_APPLICABLE",
]);

export const standardsMappingSchema = z
  .object({
    cwe: z.array(z.string().regex(/^CWE-\d+$/)),
    owaspTop10: z.array(z.string().regex(/^A\d{2}:2025$/)),
    asvs: z.array(z.string().regex(/^v5\.0\.0-\d+\.\d+\.\d+$/)),
    nist: z.array(z.string()),
  })
  .strict();

export const supplyChainStandardMappingSchema = z
  .object({
    standard: z.string().min(1),
    control: z.string().min(1),
    requirement: z.enum(["REQUIRED", "RECOMMENDED", "CONTEXT_DEPENDENT"]),
  })
  .strict();

export const ruleDefinitionSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    id: z.string().regex(/^AS-(?:[A-Z]+-)*[A-Z]+-\d{3}$/),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    title: z.string().min(1),
    category: z.enum([
      "session",
      "password-storage",
      "token-validation",
      "secrets",
      "configuration",
      "authorization",
      "authentication",
      "password-reset",
      "oauth",
      "injection",
      "path-traversal",
      "ssrf",
      "dependency-security",
      "ci-cd",
      "supply-chain",
    ]),
    description: z.string().min(1),
    severity: severitySchema,
    confidence: confidenceSchema,
    standards: standardsMappingSchema,
    supplyChainStandards: z.array(supplyChainStandardMappingSchema).optional(),
    standardsTraceability: z.array(authenticationStandardMappingSchema).optional(),
    supportedLanguages: z.array(z.enum(["javascript", "typescript", "python", "configuration"])),
    supportedFrameworks: z.array(z.string()),
    detectionStrategy: z.enum([
      "ast",
      "ast-plus-context",
      "configuration",
      "lexical-secret",
      "security-ir",
      "authentication-invariant",
      "dependency-inventory",
      "advisory-correlation",
      "secret-correlation",
      "workflow-correlation",
      "bounded-dataflow",
    ]),
    evidenceRequirements: z.array(z.string().min(1)).min(1),
    reachabilityAssessment: z.string().min(1),
    securityInvariant: z.string().min(1),
    attackPrerequisite: z.string().min(1),
    impact: z.string().min(1),
    remediation: z.string().min(1),
    maturity: ruleMaturitySchema.optional(),
    maxRemediationClass: remediationClassSchema.optional(),
    autofix: remediationClassSchema,
    references: z.array(z.url()),
    positiveTests: z.array(z.string().min(1)).min(1),
    negativeTests: z.array(z.string().min(1)).min(1),
    adversarialTests: z.array(z.string().min(1)).optional(),
    falsePositiveAnalysis: z.string().min(1).optional(),
    limitations: z.array(z.string().min(1)).optional(),
    verificationStrategy: z.string().min(1).optional(),
    userDocumentation: z.string().min(1).optional(),
  })
  .strict();

export const sourcePointSchema = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  })
  .strict();

export const locationSchema = z
  .object({
    path: z.string().min(1),
    start: sourcePointSchema,
    end: sourcePointSchema,
  })
  .strict();

export const evidenceSchema = z
  .object({
    message: z.string().min(1),
    excerpt: z.string().min(1),
    redacted: z.boolean(),
  })
  .strict();

export const fixEditSchema = z
  .object({
    path: z.string().min(1),
    startOffset: z.number().int().nonnegative(),
    endOffset: z.number().int().nonnegative(),
    expectedTextSha256: z.string().regex(/^[a-f0-9]{64}$/),
    replacement: z.string(),
    description: z.string().min(1),
  })
  .strict();

export const remediationAssessmentSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    ceiling: remediationClassSchema,
    requestedClass: remediationClassSchema,
    finalClass: remediationClassSchema,
    reasonCodes: z.array(remediationReasonCodeSchema).min(1),
    safeConditions: z
      .object({
        deterministicTransformation: z.boolean(),
        boundedLocalBlastRadius: z.boolean(),
        sourceHashVerified: z.boolean(),
        noBusinessPolicyDecision: z.boolean(),
        noAuthorizationPolicyInvention: z.boolean(),
        noArchitectureChange: z.boolean(),
        noSemanticAmbiguity: z.boolean(),
        noUnknownSecurityDependency: z.boolean(),
        independentInvariantVerification: z.boolean(),
      })
      .strict(),
    verificationStrength: z.enum(["NONE", "PATTERN", "INVARIANT"]),
  })
  .strict();

const proofLocationSchema = z
  .object({
    path: z.string().min(1),
    line: z.number().int().positive(),
    column: z.number().int().nonnegative(),
  })
  .strict();

const proofStepSchema = z
  .object({
    kind: z.enum(["SOURCE", "PROPAGATION", "TRANSFORMATION", "CONTROL", "SINK"]),
    label: z.string().min(1),
    location: proofLocationSchema,
  })
  .strict();

export const findingProofSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    source: proofStepSchema,
    propagationPath: z.array(proofStepSchema),
    sink: proofStepSchema,
    securityControlEncountered: z.boolean(),
    securityControlEvaluation: z.enum([
      "ABSENT",
      "RECOGNIZED_EFFECTIVE",
      "RECOGNIZED_INEFFECTIVE",
      "UNKNOWN",
    ]),
    reachability: reachabilitySchema,
    invariant: z.string().min(1),
    conclusion: z.string().min(1),
    proofState: proofStateSchema,
    ruleId: z.string().min(1),
    ruleVersion: z.string().min(1),
    ruleMaturity: ruleMaturitySchema,
    cwe: z.array(z.string().regex(/^CWE-\d+$/)).min(1),
    asvs: z.array(z.string().regex(/^v5\.0\.0-\d+\.\d+\.\d+$/)),
    owaspTop10: z.array(z.string().regex(/^A\d{2}:2025$/)),
    analysisLimitations: z.array(z.string().min(1)),
  })
  .strict();

export const findingSchema = z
  .object({
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    ruleId: z.string(),
    ruleVersion: z.string(),
    severity: severitySchema,
    confidence: confidenceSchema,
    reachability: reachabilitySchema,
    title: z.string(),
    category: z.string(),
    affectedComponent: z.string(),
    location: locationSchema,
    evidence: z.array(evidenceSchema).min(1),
    evidencePath: z.array(evidencePathStepSchema).min(2).optional(),
    securityInvariant: z.string(),
    attackPrerequisite: z.string(),
    impact: z.string(),
    standards: standardsMappingSchema,
    remediation: z.string(),
    autofix: remediationClassSchema,
    ruleMaturity: ruleMaturitySchema.optional(),
    proofState: proofStateSchema.optional(),
    analysisCompleteness: analysisCompletenessSchema.optional(),
    proof: findingProofSchema.optional(),
    remediationAssessment: remediationAssessmentSchema.optional(),
    fix: fixEditSchema.optional(),
    verificationStatus: z.enum(["not_attempted", "verified", "failed"]),
    suppression: z
      .object({
        rule: z.string().min(1).optional(),
        findingFingerprint: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        scope: z.string().min(1).optional(),
        reason: z.string(),
        owner: z.string(),
        created: z.iso.date().optional(),
        expires: z.iso.date().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const skippedFileSchema = z
  .object({
    path: z.string(),
    reason: z.enum([
      "binary",
      "too_large",
      "symlink",
      "ignored",
      "archive",
      "depth_limit",
      "unreadable",
      "file_limit",
    ]),
  })
  .strict();

export const repositoryManifestSchema = z
  .object({
    root: z.string(),
    filesExamined: z.number().int().nonnegative(),
    bytesExamined: z.number().int().nonnegative(),
    files: z.array(z.string()),
    skipped: z.array(skippedFileSchema),
    languages: z.array(z.string()),
    frameworks: z.array(z.string()),
    packageManagers: z.array(z.string()),
    lockfiles: z.array(z.string()),
    applicationEntrypoints: z.array(z.string()),
    apiRoutes: z.array(z.string()),
    authenticationLibraries: z.array(z.string()),
    ormAndDatabases: z.array(z.string()),
    sessionAndTokenTechnology: z.array(z.string()),
    oauthOidcProviders: z.array(z.string()),
    infrastructure: z.array(z.string()),
    ci: z.array(z.string()),
    monorepoBoundaries: z.array(z.string()),
    testFrameworks: z.array(z.string()),
  })
  .strict();

export const coverageSchema = z
  .object({
    tier: z.enum(["phase-one", "phase-two", "phase-three", "phase-four"]),
    analyzedLanguages: z.array(z.string()),
    analyzedFrameworks: z.array(z.string()),
    enginesRun: z.array(z.string()),
    enginesUnavailable: z.array(z.string()),
    enabledRuleIds: z.array(z.string()),
    limitations: z.array(z.string()),
    analysisCompleteness: z
      .array(
        z
          .object({
            engine: z.string().min(1),
            status: analysisCompletenessSchema,
            details: z.string().min(1),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

export const reproducibleScanManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    cydetixVersion: z.string().min(1),
    ruleCatalogueFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    enabledRules: z.array(z.object({ id: z.string().min(1), version: z.string().min(1) }).strict()),
    configurationFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    suppressionFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    canonicalRepositoryRoot: z.string().min(1),
    gitCommit: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
    workingTreeState: z.enum(["CLEAN", "DIRTY", "UNKNOWN", "NOT_A_GIT_REPOSITORY"]),
    detectedLanguages: z.array(z.string()),
    detectedFrameworks: z.array(z.string()),
    dependencyContext: z.array(z.string()),
    advisoryMode: z.enum(["OFFLINE", "ONLINE"]),
    scanId: z.string().min(1),
    analysisTimestamp: z.iso.datetime(),
    analysisCompleteness: analysisCompletenessSchema,
  })
  .strict();

export const authGraphSchema = z
  .object({
    nodes: z.array(
      z
        .object({
          id: z.string(),
          kind: z.enum([
            "identity",
            "subject",
            "action",
            "credential",
            "credential-input",
            "login-endpoint",
            "registration-endpoint",
            "session",
            "session-creation",
            "session-validation",
            "session-storage",
            "session-revocation",
            "cookie",
            "jwt",
            "refresh-token",
            "logout-endpoint",
            "password-change",
            "password-reset",
            "email-verification",
            "magic-link",
            "mfa",
            "totp",
            "webauthn",
            "oauth",
            "oidc",
            "sso",
            "api-key",
            "service-credential",
            "role",
            "permission",
            "tenant",
            "authorization-middleware",
            "enforcement-point",
            "resource-access-check",
            "ownership-check",
            "tenant-scope",
            "impersonation",
            "resource",
            "policy",
            "credential-verifier",
            "authentication-success",
            "session-lookup",
            "session-rotate",
            "session-revoke-all",
            "session-expiry",
            "jwt-issue",
            "jwt-validate",
            "jwt-decode-without-verify",
            "jwks-resolve",
            "claim-validate",
            "token-accept",
            "access-token-issue",
            "refresh-token-issue",
            "refresh-token-validate",
            "refresh-token-rotate",
            "refresh-token-revoke",
            "password-reset-request",
            "password-reset-credential-issue",
            "password-reset-validate",
            "password-reset-consume",
            "oauth-authorization-request",
            "oauth-callback",
            "authorization-code-exchange",
            "pkce-verifier",
            "oauth-state-validation",
            "oidc-nonce-validation",
            "oidc-issuer-validation",
            "oidc-audience-validation",
            "mfa-challenge",
            "mfa-validation",
            "privilege-change",
            "reauthentication-boundary",
          ]),
          label: z.string(),
          path: z.string().optional(),
          confidence: confidenceSchema,
          sourceEvidence: z
            .array(
              z
                .object({
                  location: locationSchema,
                  message: z.string().min(1),
                })
                .strict(),
            )
            .optional(),
        })
        .strict(),
    ),
    edges: z.array(
      z
        .object({
          from: z.string(),
          to: z.string(),
          relation: z.enum([
            "accepts",
            "consumes",
            "verifies",
            "creates",
            "stores",
            "transports",
            "validates",
            "rotates",
            "expires",
            "protects",
            "authorizes",
            "enforces",
            "owns",
            "checks-ownership",
            "checks-tenant",
            "scopes",
            "revokes",
            "resets",
            "recovers",
            "links",
            "impersonates",
            "unknown",
          ]),
          evidence: z.string(),
        })
        .strict(),
    ),
    limitations: z.array(z.string()),
  })
  .strict();

export const scanReportSchema = z
  .object({
    schemaVersion: z.literal("2.0.0"),
    tool: z.object({ name: z.literal("cydetix"), version: z.string() }).strict(),
    scan: z
      .object({
        id: z.string(),
        startedAt: z.iso.datetime(),
        completedAt: z.iso.datetime(),
        offline: z.boolean(),
        mutatedRepository: z.literal(false),
        performanceMilliseconds: z
          .object({
            repositoryDiscovery: z.number().nonnegative(),
            parsing: z.number().nonnegative(),
            callGraph: z.number().nonnegative(),
            securityGraph: z.number().nonnegative(),
            authenticationGraph: z.number().nonnegative(),
            invariantEvaluation: z.number().nonnegative(),
            applicationDataflow: z.number().nonnegative().optional(),
            reportGeneration: z.number().nonnegative(),
          })
          .strict()
          .optional(),
      })
      .strict(),
    manifest: repositoryManifestSchema,
    authGraph: authGraphSchema,
    securityAnalysis: z
      .object({
        schemaVersion: z.literal("1.0.0"),
        securityIr: securityIrSchema,
        authorizationProofs: z.array(authorizationProofSchema),
        authenticationAnalysis: authenticationAnalysisSchema.optional(),
        supplyChainAnalysis: supplyChainAnalysisSchema.optional(),
        applicationDataflow: applicationDataflowAnalysisSchema.optional(),
      })
      .strict(),
    coverage: coverageSchema,
    reproducibility: reproducibleScanManifestSchema.optional(),
    findings: z.array(findingSchema),
    suppressedFindings: z.array(findingSchema),
    summary: z
      .object({
        critical: z.number().int().nonnegative(),
        high: z.number().int().nonnegative(),
        medium: z.number().int().nonnegative(),
        low: z.number().int().nonnegative(),
        info: z.number().int().nonnegative(),
        suppressed: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const suppressionSchema = z
  .object({
    rule: z.string().min(1),
    fingerprint: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    scope: z.string().min(1),
    reason: z.string().min(3),
    owner: z.string().min(1),
    created: z.iso.date(),
    expires: z.iso.date().optional(),
  })
  .strict();

export const configSchema = z
  .object({
    schemaVersion: z.literal("1.0.0"),
    maxFileBytes: z.number().int().min(1024).max(10_485_760).default(1_048_576),
    maxFiles: z.number().int().min(1).max(500_000).default(100_000),
    maxDepth: z.number().int().min(1).max(100).default(40),
    additionalIgnore: z.array(z.string().min(1).max(200)).max(100).default([]),
    baseline: z.array(z.string().regex(/^[a-f0-9]{64}$/)).default([]),
    suppressions: z.array(suppressionSchema).default([]),
  })
  .strict();

export type Severity = z.infer<typeof severitySchema>;
export type Confidence = z.infer<typeof confidenceSchema>;
export type Reachability = z.infer<typeof reachabilitySchema>;
export type RemediationClass = z.infer<typeof remediationClassSchema>;
export type RuleMaturity = z.infer<typeof ruleMaturitySchema>;
export type ProofState = z.infer<typeof proofStateSchema>;
export type { AnalysisCompleteness } from "./analysis.js";
export type { RemediationReasonCode } from "./analysis.js";
export type RemediationAssessment = z.infer<typeof remediationAssessmentSchema>;
export type FindingProof = z.infer<typeof findingProofSchema>;
export type RuleDefinition = z.infer<typeof ruleDefinitionSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type EvidencePathStep = z.infer<typeof evidencePathStepSchema>;
export type FixEdit = z.infer<typeof fixEditSchema>;
export type RepositoryManifest = z.infer<typeof repositoryManifestSchema>;
export type Coverage = z.infer<typeof coverageSchema>;
export type AuthGraph = z.infer<typeof authGraphSchema>;
export type ScanReport = z.infer<typeof scanReportSchema>;
export type CydetixConfig = z.infer<typeof configSchema>;

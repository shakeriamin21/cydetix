import { z } from "zod";

export const supplyChainVersion = "1.0.0" as const;
const confidenceSchema = z.enum(["low", "medium", "high"]);
const sourcePointSchema = z
  .object({
    line: z.number().int().positive(),
    column: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
  })
  .strict();
const locationSchema = z
  .object({
    path: z.string().min(1),
    start: sourcePointSchema,
    end: sourcePointSchema,
  })
  .strict();
export const advisoryProviderStateSchema = z.enum([
  "CHECKED_NO_FINDINGS",
  "CHECKED_FINDINGS",
  "NOT_CHECKED_OFFLINE",
  "PROVIDER_UNAVAILABLE",
  "UNKNOWN",
]);
export const historyAnalysisStateSchema = z.enum([
  "CHECKED",
  "NOT_CHECKED",
  "GIT_UNAVAILABLE",
  "NOT_A_GIT_REPOSITORY",
  "TRUNCATED",
  "FAILED",
]);
export const supplyChainControlStateSchema = z.enum([
  "PROVEN",
  "PARTIAL",
  "UNKNOWN",
  "NOT_PRESENT",
]);

export const supplyChainEvidenceSchema = z
  .object({
    id: z.string().regex(/^supply-evidence:[a-f0-9]{16}$/),
    kind: z.enum([
      "manifest",
      "lockfile",
      "dependency",
      "workflow",
      "action-reference",
      "permission",
      "workflow-step",
      "secret-exposure",
      "history",
      "provenance",
    ]),
    location: locationSchema,
    message: z.string().min(1),
    redacted: z.boolean(),
  })
  .strict();

export const packageDependencyKindSchema = z.enum([
  "direct",
  "dev",
  "optional",
  "peer",
  "transitive",
]);

export const packageComponentSchema = z
  .object({
    id: z.string().regex(/^package:[a-f0-9]{16}$/),
    ecosystem: z.literal("npm"),
    name: z.string().min(1),
    version: z.string().min(1),
    purl: z.string().regex(/^pkg:npm\//),
    kind: packageDependencyKindSchema,
    resolved: z.boolean(),
    integrity: z.string().min(1).optional(),
    source: z.enum(["registry", "git", "http", "workspace", "unknown"]),
    dev: z.boolean(),
    optional: z.boolean(),
    evidenceIds: z.array(z.string().regex(/^supply-evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict();

export const dependencyEdgeSchema = z
  .object({
    from: z.string().min(1),
    to: z.string().regex(/^package:[a-f0-9]{16}$/),
    relationship: z.literal("DEPENDS_ON"),
    evidenceIds: z.array(z.string().regex(/^supply-evidence:[a-f0-9]{16}$/)).min(1),
  })
  .strict();

export const dependencyPathSchema = z
  .object({
    packageId: z.string().regex(/^package:[a-f0-9]{16}$/),
    path: z.array(z.string().min(1)).min(2),
  })
  .strict();

export const dependencyInventorySchema = z
  .object({
    status: z.enum(["COMPLETE", "PARTIAL", "NOT_PRESENT", "UNSUPPORTED"]),
    ecosystems: z.array(z.literal("npm")),
    manifests: z.array(z.string().min(1)),
    lockfiles: z.array(z.string().min(1)),
    rootComponent: z.string().min(1).optional(),
    lifecycleScripts: z.array(
      z
        .object({
          manifest: z.string().min(1),
          name: z.enum(["preinstall", "install", "postinstall", "prepare"]),
          location: locationSchema,
        })
        .strict(),
    ),
    packages: z.array(packageComponentSchema),
    edges: z.array(dependencyEdgeSchema),
    paths: z.array(dependencyPathSchema),
    directCount: z.number().int().nonnegative(),
    transitiveCount: z.number().int().nonnegative(),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export const normalizedAdvisorySchema = z
  .object({
    id: z.string().min(1),
    aliases: z.array(z.string().min(1)),
    packagePurl: z.string().regex(/^pkg:/),
    severity: z.string().min(1).optional(),
    fixedVersions: z.array(z.string().min(1)),
    references: z.array(z.url()),
    provider: z.string().min(1),
  })
  .strict();

export const advisoryAnalysisSchema = z
  .object({
    provider: z.string().min(1),
    state: advisoryProviderStateSchema,
    checkedAt: z.iso.datetime().optional(),
    endpoint: z.url().optional(),
    packagesSubmitted: z.number().int().nonnegative(),
    advisories: z.array(normalizedAdvisorySchema),
    message: z.string().min(1),
  })
  .strict();

export const secretExposureSchema = z
  .object({
    id: z.string().regex(/^secret:[a-f0-9]{16}$/),
    provider: z.string().min(1),
    type: z.string().min(1),
    location: locationSchema,
    redactedPreview: z.string().startsWith("[REDACTED"),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    confidence: confidenceSchema,
    sourceCategory: z.enum(["working-tree", "git-history", "external-tool"]),
    historyState: z.enum(["current", "historical", "not-checked"]),
    rotationGuidance: z.array(
      z.enum([
        "CURRENT_TREE_REMOVAL",
        "CREDENTIAL_ROTATION_REQUIRED",
        "HISTORY_REWRITE_CONSIDER",
        "PROVIDER_REVOCATION_REQUIRED",
      ]),
    ),
    validationState: z.literal("PASSIVE_NOT_VALIDATED"),
    engine: z.string().min(1),
  })
  .strict();

export const secretAnalysisSchema = z
  .object({
    workingTree: z.enum(["CHECKED_NO_FINDINGS", "CHECKED_FINDINGS"]),
    history: historyAnalysisStateSchema,
    exposures: z.array(secretExposureSchema),
    redactionGuaranteed: z.literal(true),
    activeValidation: z.literal("NOT_PERFORMED"),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export const actionReferenceSchema = z
  .object({
    id: z.string().regex(/^action:[a-f0-9]{16}$/),
    workflow: z.string().min(1),
    job: z.string().min(1),
    repository: z.string().min(1),
    reference: z.string().min(1),
    kind: z.enum(["external-action", "reusable-workflow", "local-action", "docker"]),
    pinning: z.enum(["full-sha", "short-sha", "tag", "branch", "local", "digest", "unknown"]),
    location: locationSchema,
  })
  .strict();

export const workflowPermissionSchema = z
  .object({
    workflow: z.string().min(1),
    job: z.string().min(1).optional(),
    name: z.string().min(1),
    access: z.enum(["read", "write", "none", "write-all", "read-all"]),
    location: locationSchema,
  })
  .strict();

export const workflowAnalysisSchema = z
  .object({
    workflows: z.array(z.string().min(1)),
    actionReferences: z.array(actionReferenceSchema),
    permissions: z.array(workflowPermissionSchema),
    pullRequestTargetWorkflows: z.array(z.string().min(1)),
    provenanceWorkflows: z.array(z.string().min(1)),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export const supplyChainIrSchema = z
  .object({
    schemaVersion: z.literal(supplyChainVersion),
    packages: z.array(packageComponentSchema),
    workflows: z.array(z.string().min(1)),
    actions: z.array(actionReferenceSchema),
    secrets: z.array(secretExposureSchema),
    evidence: z.array(supplyChainEvidenceSchema),
    edges: z.array(dependencyEdgeSchema),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export const supplyChainAnalysisSchema = z
  .object({
    schemaVersion: z.literal(supplyChainVersion),
    inventory: dependencyInventorySchema,
    advisories: advisoryAnalysisSchema,
    secrets: secretAnalysisSchema,
    ci: workflowAnalysisSchema,
    controls: z
      .object({
        sourceIntegrity: supplyChainControlStateSchema,
        buildProvenance: supplyChainControlStateSchema,
        artifactIdentity: supplyChainControlStateSchema,
        signing: supplyChainControlStateSchema,
        dependencyInventory: supplyChainControlStateSchema,
        ciPermissions: supplyChainControlStateSchema,
      })
      .strict(),
    ir: supplyChainIrSchema,
    performanceMilliseconds: z
      .object({
        dependencyParsing: z.number().nonnegative(),
        advisoryProcessing: z.number().nonnegative(),
        secretScan: z.number().nonnegative(),
        historyScan: z.number().nonnegative(),
        workflowAnalysis: z.number().nonnegative(),
        sbomGeneration: z.number().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type AdvisoryProviderState = z.infer<typeof advisoryProviderStateSchema>;
export type PackageComponent = z.infer<typeof packageComponentSchema>;
export type DependencyInventory = z.infer<typeof dependencyInventorySchema>;
export type NormalizedAdvisory = z.infer<typeof normalizedAdvisorySchema>;
export type AdvisoryAnalysis = z.infer<typeof advisoryAnalysisSchema>;
export type SecretExposure = z.infer<typeof secretExposureSchema>;
export type SecretAnalysis = z.infer<typeof secretAnalysisSchema>;
export type ActionReference = z.infer<typeof actionReferenceSchema>;
export type WorkflowAnalysis = z.infer<typeof workflowAnalysisSchema>;
export type SupplyChainEvidence = z.infer<typeof supplyChainEvidenceSchema>;
export type SupplyChainAnalysis = z.infer<typeof supplyChainAnalysisSchema>;

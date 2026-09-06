import { z } from "zod";
import { remediationClassSchema } from "../core/schema.js";
import { verificationExecutionResultSchema } from "../verification/model.js";
export const remediationSchemaVersion = "1.0.0";
export const remediationStateSchema = z.enum([
    "PLANNED",
    "NOT_APPLICABLE",
    "UNSUPPORTED",
    "REQUIRES_REVIEW",
    "APPLIED_UNVERIFIED",
    "APPLIED_VERIFIED",
    "VERIFICATION_FAILED",
    "ROLLBACK_SUCCEEDED",
    "ROLLBACK_FAILED",
    "PARTIALLY_REMEDIATED",
    "RESIDUAL_RISK",
    "STALE_FINDING",
    "RESCAN_REQUIRED",
    "SANDBOX_UNAVAILABLE",
    "SANDBOX_MISCONFIGURED",
]);
export const verificationScopeSchema = z.enum([
    "FILE",
    "MODULE",
    "AUTH_FLOW",
    "WORKFLOW",
    "DEPENDENCY_GRAPH",
    "REPOSITORY",
]);
export const securityProofConclusionSchema = z.enum([
    "PROVEN_SECURE",
    "PROVEN_INSECURE",
    "UNKNOWN",
    "NOT_APPLICABLE",
]);
export const remediationStepSchema = z.enum([
    "SOURCE_REMOVAL",
    "ROTATION_REQUIRED",
    "REVOCATION_REQUIRED",
    "HISTORY_REVIEW_REQUIRED",
    "HISTORY_REWRITE_REQUIRED",
    "MONITORING_REVIEW",
    "DEPENDENCY_UPGRADE_REVIEW",
    "LOCKFILE_RESOLUTION_REQUIRED",
    "ACTION_SHA_RESOLUTION_REQUIRED",
    "BUSINESS_POLICY_REVIEW",
    "ARCHITECTURE_CHANGE_REQUIRED",
]);
export const fileBaselineSchema = z
    .object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    gitState: z.enum(["CLEAN", "DIRTY", "UNKNOWN"]),
})
    .strict();
export const plannedTransformationSchema = z
    .object({
    id: z.string().regex(/^transformation:[a-f0-9]{16}$/),
    adapter: z.enum([
        "session-http-only-v1",
        "github-action-pin-plan-v1",
        "dependency-upgrade-plan-v1",
        "secret-incident-plan-v1",
        "review-plan-v1",
        "architectural-plan-v1",
    ]),
    kind: z.enum(["TEXT_REPLACEMENT", "PLAN_ONLY"]),
    path: z.string().min(1),
    startOffset: z.number().int().nonnegative().optional(),
    endOffset: z.number().int().nonnegative().optional(),
    expectedTextSha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    replacement: z.string().optional(),
    description: z.string().min(1),
    unifiedDiff: z.string().optional(),
})
    .strict();
export const remediationCandidateSchema = z
    .object({
    planId: z.string().regex(/^plan:[a-f0-9]{16}$/),
    findingFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    stableFindingId: z.string().regex(/^[a-f0-9]{64}$/),
    ruleId: z.string().min(1),
    classification: remediationClassSchema,
    state: remediationStateSchema,
    affectedFiles: z.array(z.string().min(1)).min(1),
    fileBaselines: z.array(fileBaselineSchema),
    preconditions: z.array(z.string().min(1)),
    transformations: z.array(plannedTransformationSchema),
    expectedSecurityInvariant: z.string().min(1),
    verificationStrategy: z
        .object({
        scope: verificationScopeSchema,
        stages: z.array(z.enum([
            "PATCH_STRUCTURE",
            "PARSER",
            "TRUSTED_COMMANDS",
            "TARGETED_RESCAN",
            "SECURITY_INVARIANT",
        ])),
        externalCommandsAuthorized: z.boolean(),
    })
        .strict(),
    rollbackStrategy: z.string().min(1),
    remediationSteps: z.array(remediationStepSchema),
    residualRisk: z.array(z.string().min(1)),
})
    .strict();
export const verificationResultSchema = z
    .object({
    stage: z.enum([
        "PRECONDITION",
        "PATCH_STRUCTURE",
        "PARSER",
        "TRUSTED_COMMAND",
        "TARGETED_RESCAN",
        "SECURITY_INVARIANT",
        "ROLLBACK",
    ]),
    status: z.enum(["PASSED", "FAILED", "SKIPPED", "NOT_AUTHORIZED", "UNAVAILABLE"]),
    message: z.string().min(1),
    durationMilliseconds: z.number().nonnegative(),
    commandFingerprint: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    execution: verificationExecutionResultSchema.optional(),
})
    .strict();
export const actualChangeSchema = z
    .object({
    path: z.string().min(1),
    beforeSha256: z.string().regex(/^[a-f0-9]{64}$/),
    afterSha256: z.string().regex(/^[a-f0-9]{64}$/),
    unifiedDiff: z.string().min(1),
})
    .strict();
export const findingStateTransitionSchema = z
    .object({
    findingFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    stableFindingId: z.string().regex(/^[a-f0-9]{64}$/),
    ruleId: z.string().min(1),
    invariant: z.string().min(1),
    before: securityProofConclusionSchema,
    after: securityProofConclusionSchema,
    result: z.enum(["RESOLVED_VERIFIED", "UNRESOLVED", "UNKNOWN"]),
    evidencePaths: z.array(z.string().min(1)),
})
    .strict();
export const remediationTransactionSchema = z
    .object({
    schemaVersion: z.literal(remediationSchemaVersion),
    transactionId: z.string().regex(/^transaction:[a-f0-9-]{36}$/),
    findingFingerprints: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
    ruleIds: z.array(z.string().min(1)).min(1),
    repositoryBaseline: z
        .object({
        identity: z.string().regex(/^[a-f0-9]{64}$/),
        gitHead: z
            .string()
            .regex(/^[a-f0-9]{40}$/)
            .optional(),
        changedPaths: z.array(z.string()),
        files: z.array(fileBaselineSchema).min(1),
    })
        .strict(),
    classification: z.literal("SAFE"),
    expectedSecurityInvariants: z.array(z.string().min(1)).min(1),
    plannedTransformations: z.array(plannedTransformationSchema).min(1),
    actualChanges: z.array(actualChangeSchema),
    verificationResults: z.array(verificationResultSchema),
    findingStateTransitions: z.array(findingStateTransitionSchema),
    finalState: remediationStateSchema,
    residualRisk: z.array(z.string().min(1)),
    startedAt: z.iso.datetime(),
    completedAt: z.iso.datetime(),
    performanceMilliseconds: z
        .object({
        planning: z.number().nonnegative(),
        transformation: z.number().nonnegative(),
        fileTransaction: z.number().nonnegative(),
        targetedRescan: z.number().nonnegative(),
        verification: z.number().nonnegative(),
    })
        .strict(),
})
    .strict();
export const remediationReportSchema = z
    .object({
    schemaVersion: z.literal(remediationSchemaVersion),
    generatedAt: z.iso.datetime(),
    dryRun: z.boolean(),
    repository: z
        .object({
        identity: z.string().regex(/^[a-f0-9]{64}$/),
        gitHead: z
            .string()
            .regex(/^[a-f0-9]{40}$/)
            .optional(),
        changedPaths: z.array(z.string()),
    })
        .strict(),
    findingsConsidered: z.number().int().nonnegative(),
    plans: z.array(remediationCandidateSchema),
    transactions: z.array(remediationTransactionSchema),
    summary: z
        .object({
        safe: z.number().int().nonnegative(),
        reviewRequired: z.number().int().nonnegative(),
        architectural: z.number().int().nonnegative(),
        applied: z.number().int().nonnegative(),
        verified: z.number().int().nonnegative(),
        verificationFailed: z.number().int().nonnegative(),
        rolledBack: z.number().int().nonnegative(),
        residualFindings: z.number().int().nonnegative(),
    })
        .strict(),
    limitations: z.array(z.string().min(1)),
})
    .strict();
//# sourceMappingURL=model.js.map
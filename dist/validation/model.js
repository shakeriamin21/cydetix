import { z } from "zod";
export const validationSchemaVersion = "1.0.0";
export const corpusKindSchema = z.enum([
    "INTERNAL_REGRESSION",
    "EXTERNAL_LABELED",
    "DELIBERATELY_VULNERABLE_APPLICATION",
    "REAL_WORLD_BENIGN",
    "HOSTILE_REPOSITORY",
    "PERFORMANCE",
]);
export const validationDispositionSchema = z.enum([
    "TRUE_POSITIVE",
    "FALSE_POSITIVE",
    "TRUE_NEGATIVE",
    "FALSE_NEGATIVE",
    "EXPECTED_BUT_DUPLICATE",
    "UNKNOWN",
    "UNSUPPORTED",
    "NOT_APPLICABLE",
    "NEEDS_DOMAIN_CONTEXT",
]);
export const corpusManifestSchema = z
    .object({
    schemaVersion: z.literal(validationSchemaVersion),
    corpusId: z.string().regex(/^[a-z0-9][a-z0-9-]+$/),
    kind: corpusKindSchema,
    source: z.url(),
    sourceProject: z.string().min(1),
    immutableRevision: z.string().regex(/^[a-f0-9]{40}$/),
    license: z.string().min(1),
    language: z.array(z.string().min(1)).min(1),
    frameworks: z.array(z.string().min(1)),
    acquisition: z.enum(["GIT_PINNED_COMMIT", "RELEASE_ARCHIVE_CHECKSUM"]),
    checksum: z
        .string()
        .regex(/^sha256:[a-f0-9]{64}$/)
        .optional(),
    labelsPath: z.string().min(1),
    inventory: z
        .object({
        totalCases: z.number().int().nonnegative(),
        languageCompatible: z.number().int().nonnegative(),
        candidateRuleCompatible: z.number().int().nonnegative(),
        evaluatedCases: z.number().int().nonnegative(),
    })
        .strict(),
    notes: z.array(z.string().min(1)),
})
    .strict();
export const expectedValidationCaseSchema = z
    .object({
    caseId: z.string().min(1),
    ruleId: z.string().min(1),
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    expected: z.enum(["VULNERABLE", "SECURE"]),
    languageCompatible: z.boolean(),
    ruleCompatible: z.boolean(),
    expectedUnknown: z.boolean().default(false),
    cwe: z
        .string()
        .regex(/^CWE-\d+$/)
        .optional(),
    rationale: z.string().min(1),
})
    .strict();
export const manualAdjudicationSchema = z
    .object({
    caseId: z.string().min(1),
    ruleId: z.string().min(1),
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    disposition: validationDispositionSchema,
    reviewer: z.string().min(1),
    rationale: z.string().min(1),
    projectDocumentation: z.url().optional(),
})
    .strict();
export const corpusLabelsSchema = z
    .object({
    schemaVersion: z.literal(validationSchemaVersion),
    corpusId: z.string().min(1),
    expectedCases: z.array(expectedValidationCaseSchema),
    manualAdjudications: z.array(manualAdjudicationSchema),
    completeness: z.enum(["COMPLETE_APPLICABLE_LABELS", "PARTIAL", "FINDINGS_ONLY"]),
})
    .strict();
export const metricSchema = z
    .object({
    value: z.number().min(-1).max(1),
    numerator: z.number().int(),
    denominator: z.number().int().positive(),
})
    .strict();
const countFields = {
    total: z.number().int().nonnegative(),
    languageCompatible: z.number().int().nonnegative(),
    ruleCompatible: z.number().int().nonnegative(),
    executed: z.number().int().nonnegative(),
    truePositive: z.number().int().nonnegative(),
    falsePositive: z.number().int().nonnegative(),
    trueNegative: z.number().int().nonnegative(),
    falseNegative: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
    unsupported: z.number().int().nonnegative(),
    notApplicable: z.number().int().nonnegative(),
    duplicate: z.number().int().nonnegative(),
    needsDomainContext: z.number().int().nonnegative(),
};
export const validationCountsSchema = z.object(countFields).strict();
export const validationMetricsSchema = z
    .object({
    precision: metricSchema.optional(),
    recall: metricSchema.optional(),
    falsePositiveRate: metricSchema.optional(),
    specificity: metricSchema.optional(),
    f1: metricSchema.optional(),
    youden: metricSchema.optional(),
    limitations: z.array(z.string().min(1)),
})
    .strict();
export const validationCaseResultSchema = z
    .object({
    caseId: z.string().min(1),
    ruleId: z.string().min(1),
    path: z.string().min(1),
    line: z.number().int().positive().optional(),
    languageCompatible: z.boolean(),
    ruleCompatible: z.boolean(),
    disposition: validationDispositionSchema,
    rationale: z.string().min(1),
})
    .strict();
export const corpusValidationResultSchema = z
    .object({
    schemaVersion: z.literal(validationSchemaVersion),
    corpusId: z.string().min(1),
    immutableRevision: z.string().regex(/^[a-f0-9]{40}$/),
    counts: validationCountsSchema,
    metrics: validationMetricsSchema,
    perRule: z.array(z
        .object({
        ruleId: z.string().min(1),
        counts: validationCountsSchema,
        metrics: validationMetricsSchema,
    })
        .strict()),
    cases: z.array(validationCaseResultSchema),
})
    .strict();
//# sourceMappingURL=model.js.map
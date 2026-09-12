import { z } from "zod";
import { analysisCompletenessSchema, remediationReasonCodeSchema } from "../core/analysis.js";
export const applicationDataflowKindSchema = z.enum([
    "SQL_INJECTION",
    "COMMAND_INJECTION",
    "PATH_TRAVERSAL",
    "SSRF",
    "XSS",
    "OPEN_REDIRECT",
    "CSRF",
]);
export const applicationDataflowMetricSchema = z
    .object({
    filesAnalyzed: z.number().int().nonnegative(),
    astNodesVisited: z.number().int().nonnegative(),
    factsCreated: z.number().int().nonnegative(),
    pathsConsidered: z.number().int().nonnegative(),
    iterations: z.number().int().nonnegative(),
    truncationEvents: z.number().int().nonnegative(),
})
    .strict();
export const applicationDataflowUnknownSchema = z
    .object({
    ruleId: z.string().min(1),
    path: z.string().min(1),
    line: z.number().int().positive(),
    reasonCodes: z.array(remediationReasonCodeSchema).min(1),
    explanation: z.string().min(1),
})
    .strict();
export const applicationDataflowAnalysisSchema = z
    .object({
    schemaVersion: z.literal("1.0.0"),
    engineVersion: z.literal("1.0.0"),
    completeness: analysisCompletenessSchema,
    metrics: applicationDataflowMetricSchema,
    unknowns: z.array(applicationDataflowUnknownSchema),
    limitations: z.array(z.string().min(1)),
})
    .strict();
//# sourceMappingURL=model.js.map
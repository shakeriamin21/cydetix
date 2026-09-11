import { z } from "zod";
export declare const applicationDataflowKindSchema: z.ZodEnum<{
    SQL_INJECTION: "SQL_INJECTION";
    COMMAND_INJECTION: "COMMAND_INJECTION";
    PATH_TRAVERSAL: "PATH_TRAVERSAL";
    SSRF: "SSRF";
}>;
export declare const applicationDataflowMetricSchema: z.ZodObject<{
    filesAnalyzed: z.ZodNumber;
    astNodesVisited: z.ZodNumber;
    factsCreated: z.ZodNumber;
    pathsConsidered: z.ZodNumber;
    iterations: z.ZodNumber;
    truncationEvents: z.ZodNumber;
}, z.core.$strict>;
export declare const applicationDataflowUnknownSchema: z.ZodObject<{
    ruleId: z.ZodString;
    path: z.ZodString;
    line: z.ZodNumber;
    reasonCodes: z.ZodArray<z.ZodEnum<{
        EXACT_LOCAL_TRANSFORM: "EXACT_LOCAL_TRANSFORM";
        DYNAMIC_EXPRESSION: "DYNAMIC_EXPRESSION";
        AMBIGUOUS_SEMANTICS: "AMBIGUOUS_SEMANTICS";
        BUSINESS_POLICY_REQUIRED: "BUSINESS_POLICY_REQUIRED";
        AUTHORIZATION_POLICY_REQUIRED: "AUTHORIZATION_POLICY_REQUIRED";
        SCHEMA_CHANGE_REQUIRED: "SCHEMA_CHANGE_REQUIRED";
        CROSS_MODULE_UNCERTAINTY: "CROSS_MODULE_UNCERTAINTY";
        UNSUPPORTED_FRAMEWORK_PATTERN: "UNSUPPORTED_FRAMEWORK_PATTERN";
        INSUFFICIENT_DATAFLOW_PROOF: "INSUFFICIENT_DATAFLOW_PROOF";
        SANITIZER_UNKNOWN: "SANITIZER_UNKNOWN";
        VERIFICATION_INSUFFICIENT: "VERIFICATION_INSUFFICIENT";
        MULTI_FILE_SEMANTIC_CHANGE: "MULTI_FILE_SEMANTIC_CHANGE";
        ARCHITECTURE_CHANGE_REQUIRED: "ARCHITECTURE_CHANGE_REQUIRED";
    }>>;
    explanation: z.ZodString;
}, z.core.$strict>;
export declare const applicationDataflowAnalysisSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    engineVersion: z.ZodLiteral<"1.0.0">;
    completeness: z.ZodEnum<{
        COMPLETE: "COMPLETE";
        PARTIAL: "PARTIAL";
        UNSUPPORTED: "UNSUPPORTED";
        TRUNCATED: "TRUNCATED";
    }>;
    metrics: z.ZodObject<{
        filesAnalyzed: z.ZodNumber;
        astNodesVisited: z.ZodNumber;
        factsCreated: z.ZodNumber;
        pathsConsidered: z.ZodNumber;
        iterations: z.ZodNumber;
        truncationEvents: z.ZodNumber;
    }, z.core.$strict>;
    unknowns: z.ZodArray<z.ZodObject<{
        ruleId: z.ZodString;
        path: z.ZodString;
        line: z.ZodNumber;
        reasonCodes: z.ZodArray<z.ZodEnum<{
            EXACT_LOCAL_TRANSFORM: "EXACT_LOCAL_TRANSFORM";
            DYNAMIC_EXPRESSION: "DYNAMIC_EXPRESSION";
            AMBIGUOUS_SEMANTICS: "AMBIGUOUS_SEMANTICS";
            BUSINESS_POLICY_REQUIRED: "BUSINESS_POLICY_REQUIRED";
            AUTHORIZATION_POLICY_REQUIRED: "AUTHORIZATION_POLICY_REQUIRED";
            SCHEMA_CHANGE_REQUIRED: "SCHEMA_CHANGE_REQUIRED";
            CROSS_MODULE_UNCERTAINTY: "CROSS_MODULE_UNCERTAINTY";
            UNSUPPORTED_FRAMEWORK_PATTERN: "UNSUPPORTED_FRAMEWORK_PATTERN";
            INSUFFICIENT_DATAFLOW_PROOF: "INSUFFICIENT_DATAFLOW_PROOF";
            SANITIZER_UNKNOWN: "SANITIZER_UNKNOWN";
            VERIFICATION_INSUFFICIENT: "VERIFICATION_INSUFFICIENT";
            MULTI_FILE_SEMANTIC_CHANGE: "MULTI_FILE_SEMANTIC_CHANGE";
            ARCHITECTURE_CHANGE_REQUIRED: "ARCHITECTURE_CHANGE_REQUIRED";
        }>>;
        explanation: z.ZodString;
    }, z.core.$strict>>;
    limitations: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export type ApplicationDataflowKind = z.infer<typeof applicationDataflowKindSchema>;
export type ApplicationDataflowAnalysis = z.infer<typeof applicationDataflowAnalysisSchema>;
//# sourceMappingURL=model.d.ts.map
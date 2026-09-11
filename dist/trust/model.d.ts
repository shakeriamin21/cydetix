import { z } from "zod";
export declare const rulesReportSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    cydetixVersion: z.ZodString;
    catalogueFingerprint: z.ZodString;
    rules: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodString;
        maturity: z.ZodEnum<{
            EXPERIMENTAL: "EXPERIMENTAL";
            VALIDATED: "VALIDATED";
            PRODUCTION: "PRODUCTION";
        }>;
        title: z.ZodString;
        category: z.ZodString;
        cwe: z.ZodArray<z.ZodString>;
        owaspTop10: z.ZodArray<z.ZodString>;
        asvs: z.ZodArray<z.ZodString>;
        supportedLanguages: z.ZodArray<z.ZodString>;
        supportedFrameworks: z.ZodArray<z.ZodString>;
        maxRemediationClass: z.ZodEnum<{
            SAFE: "SAFE";
            REVIEW_REQUIRED: "REVIEW_REQUIRED";
            ARCHITECTURAL: "ARCHITECTURAL";
        }>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export declare const trustReportSchema: z.ZodObject<{
    schemaVersion: z.ZodLiteral<"1.0.0">;
    version: z.ZodString;
    catalogueFingerprint: z.ZodString;
    controlRegistryFingerprint: z.ZodString;
    maturityCounts: z.ZodObject<{
        experimental: z.ZodNumber;
        validated: z.ZodNumber;
        production: z.ZodNumber;
    }, z.core.$strict>;
    analysisEngines: z.ZodArray<z.ZodString>;
    proofCapabilities: z.ZodArray<z.ZodString>;
    safeRemediationAdapters: z.ZodArray<z.ZodString>;
    verificationStrategies: z.ZodArray<z.ZodString>;
    securityControls: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        version: z.ZodString;
        context: z.ZodString;
        proofEffect: z.ZodString;
    }, z.core.$strict>>;
    resourceBounds: z.ZodRecord<z.ZodString, z.ZodNumber>;
    unsupportedOrIncomplete: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
export declare function createRulesReport(): z.infer<typeof rulesReportSchema>;
export declare function createTrustReport(): z.infer<typeof trustReportSchema>;
export declare function renderRulesText(report?: {
    schemaVersion: "1.0.0";
    cydetixVersion: string;
    catalogueFingerprint: string;
    rules: {
        id: string;
        version: string;
        maturity: "EXPERIMENTAL" | "VALIDATED" | "PRODUCTION";
        title: string;
        category: string;
        cwe: string[];
        owaspTop10: string[];
        asvs: string[];
        supportedLanguages: string[];
        supportedFrameworks: string[];
        maxRemediationClass: "SAFE" | "REVIEW_REQUIRED" | "ARCHITECTURAL";
    }[];
}): string;
export declare function renderTrustText(report?: {
    schemaVersion: "1.0.0";
    version: string;
    catalogueFingerprint: string;
    controlRegistryFingerprint: string;
    maturityCounts: {
        experimental: number;
        validated: number;
        production: number;
    };
    analysisEngines: string[];
    proofCapabilities: string[];
    safeRemediationAdapters: string[];
    verificationStrategies: string[];
    securityControls: {
        id: string;
        version: string;
        context: string;
        proofEffect: string;
    }[];
    resourceBounds: Record<string, number>;
    unsupportedOrIncomplete: string[];
}): string;
//# sourceMappingURL=model.d.ts.map
import { type RuleDefinition } from "../core/schema.js";
export declare const RULES: readonly RuleDefinition[];
export declare const RULE_BY_ID: Map<string, {
    schemaVersion: "1.0.0";
    id: string;
    version: string;
    title: string;
    category: "secrets" | "authentication" | "session" | "oauth" | "password-reset" | "password-storage" | "token-validation" | "configuration" | "authorization" | "injection" | "path-traversal" | "ssrf" | "dependency-security" | "ci-cd" | "supply-chain";
    description: string;
    severity: "low" | "medium" | "high" | "info" | "critical";
    confidence: "low" | "medium" | "high";
    standards: {
        cwe: string[];
        owaspTop10: string[];
        asvs: string[];
        nist: string[];
    };
    supportedLanguages: ("javascript" | "typescript" | "configuration" | "python")[];
    supportedFrameworks: string[];
    detectionStrategy: "configuration" | "ast" | "ast-plus-context" | "lexical-secret" | "security-ir" | "authentication-invariant" | "dependency-inventory" | "advisory-correlation" | "secret-correlation" | "workflow-correlation" | "bounded-dataflow";
    evidenceRequirements: string[];
    reachabilityAssessment: string;
    securityInvariant: string;
    attackPrerequisite: string;
    impact: string;
    remediation: string;
    autofix: "SAFE" | "REVIEW_REQUIRED" | "ARCHITECTURAL";
    references: string[];
    positiveTests: string[];
    negativeTests: string[];
    supplyChainStandards?: {
        standard: string;
        control: string;
        requirement: "REQUIRED" | "RECOMMENDED" | "CONTEXT_DEPENDENT";
    }[] | undefined;
    standardsTraceability?: {
        source: string;
        control: string;
        relationship: "REQUIRED" | "RECOMMENDED" | "CONTEXT_DEPENDENT";
        url: string;
    }[] | undefined;
    maturity?: "EXPERIMENTAL" | "VALIDATED" | "PRODUCTION" | undefined;
    maxRemediationClass?: "SAFE" | "REVIEW_REQUIRED" | "ARCHITECTURAL" | undefined;
    adversarialTests?: string[] | undefined;
    falsePositiveAnalysis?: string | undefined;
    limitations?: string[] | undefined;
    verificationStrategy?: string | undefined;
    userDocumentation?: string | undefined;
}>;
export declare function ruleCatalogueFingerprint(): string;
export declare function requireRule(id: string): RuleDefinition;
//# sourceMappingURL=catalogue.d.ts.map
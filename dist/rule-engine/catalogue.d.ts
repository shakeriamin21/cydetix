import { type RuleDefinition } from "../core/schema.js";
export declare const RULES: readonly RuleDefinition[];
export declare const RULE_BY_ID: Map<string, {
    schemaVersion: "1.0.0";
    id: string;
    version: string;
    title: string;
    category: "secrets" | "authentication" | "session" | "oauth" | "password-reset" | "password-storage" | "token-validation" | "configuration" | "authorization" | "dependency-security" | "ci-cd" | "supply-chain";
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
    detectionStrategy: "configuration" | "ast" | "ast-plus-context" | "lexical-secret" | "security-ir" | "authentication-invariant" | "dependency-inventory" | "advisory-correlation" | "secret-correlation" | "workflow-correlation";
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
}>;
export declare function requireRule(id: string): RuleDefinition;
//# sourceMappingURL=catalogue.d.ts.map
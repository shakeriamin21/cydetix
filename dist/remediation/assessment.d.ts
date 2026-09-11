import { type FixEdit, type RemediationAssessment, type RemediationClass, type RemediationReasonCode, type RuleDefinition } from "../core/schema.js";
export interface SafeConditionInput {
    readonly deterministicTransformation?: boolean;
    readonly boundedLocalBlastRadius?: boolean;
    readonly sourceHashVerified?: boolean;
    readonly noBusinessPolicyDecision?: boolean;
    readonly noAuthorizationPolicyInvention?: boolean;
    readonly noArchitectureChange?: boolean;
    readonly noSemanticAmbiguity?: boolean;
    readonly noUnknownSecurityDependency?: boolean;
    readonly independentInvariantVerification?: boolean;
}
export interface RemediationAssessmentInput {
    readonly rule: RuleDefinition;
    readonly requestedClass?: RemediationClass;
    readonly fix?: FixEdit;
    readonly safeConditions?: SafeConditionInput;
    readonly reasonCodes?: readonly RemediationReasonCode[];
    readonly verificationStrength?: RemediationAssessment["verificationStrength"];
}
export declare function remediationCeiling(rule: RuleDefinition): RemediationClass;
export declare function assessRemediation(input: RemediationAssessmentInput): RemediationAssessment;
export declare function assertRemediationMonotonicity(ceiling: RemediationClass, finalClass: RemediationClass): void;
//# sourceMappingURL=assessment.d.ts.map
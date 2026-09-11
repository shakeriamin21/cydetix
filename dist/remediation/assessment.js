import { remediationAssessmentSchema, } from "../core/schema.js";
const RANK = {
    SAFE: 0,
    REVIEW_REQUIRED: 1,
    ARCHITECTURAL: 2,
};
export function remediationCeiling(rule) {
    return rule.maxRemediationClass ?? rule.autofix;
}
function moreConservative(left, right) {
    return RANK[left] >= RANK[right] ? left : right;
}
export function assessRemediation(input) {
    const ceiling = remediationCeiling(input.rule);
    const requestedClass = input.requestedClass ?? ceiling;
    const explicit = input.safeConditions ?? {};
    const safeConditions = {
        deterministicTransformation: explicit.deterministicTransformation ?? input.fix !== undefined,
        boundedLocalBlastRadius: explicit.boundedLocalBlastRadius ?? input.fix !== undefined,
        sourceHashVerified: explicit.sourceHashVerified ?? input.fix !== undefined,
        noBusinessPolicyDecision: explicit.noBusinessPolicyDecision ?? true,
        noAuthorizationPolicyInvention: explicit.noAuthorizationPolicyInvention ?? true,
        noArchitectureChange: explicit.noArchitectureChange ?? true,
        noSemanticAmbiguity: explicit.noSemanticAmbiguity ?? true,
        noUnknownSecurityDependency: explicit.noUnknownSecurityDependency ?? true,
        independentInvariantVerification: explicit.independentInvariantVerification ?? input.fix !== undefined,
    };
    const safeEvidenceComplete = Object.values(safeConditions).every(Boolean);
    let finalClass = moreConservative(ceiling, requestedClass);
    if (finalClass === "SAFE" && !safeEvidenceComplete)
        finalClass = "REVIEW_REQUIRED";
    const reasons = new Set(input.reasonCodes ?? []);
    if (finalClass === "SAFE")
        reasons.add("EXACT_LOCAL_TRANSFORM");
    if (!safeConditions.deterministicTransformation)
        reasons.add("DYNAMIC_EXPRESSION");
    if (!safeConditions.boundedLocalBlastRadius)
        reasons.add("MULTI_FILE_SEMANTIC_CHANGE");
    if (!safeConditions.noBusinessPolicyDecision)
        reasons.add("BUSINESS_POLICY_REQUIRED");
    if (!safeConditions.noAuthorizationPolicyInvention)
        reasons.add("AUTHORIZATION_POLICY_REQUIRED");
    if (!safeConditions.noArchitectureChange)
        reasons.add("ARCHITECTURE_CHANGE_REQUIRED");
    if (!safeConditions.noSemanticAmbiguity)
        reasons.add("AMBIGUOUS_SEMANTICS");
    if (!safeConditions.noUnknownSecurityDependency)
        reasons.add("SANITIZER_UNKNOWN");
    if (!safeConditions.independentInvariantVerification)
        reasons.add("VERIFICATION_INSUFFICIENT");
    if (reasons.size === 0) {
        reasons.add(finalClass === "ARCHITECTURAL" ? "ARCHITECTURE_CHANGE_REQUIRED" : "AMBIGUOUS_SEMANTICS");
    }
    return remediationAssessmentSchema.parse({
        schemaVersion: "1.0.0",
        ceiling,
        requestedClass,
        finalClass,
        reasonCodes: [...reasons].sort(),
        safeConditions,
        verificationStrength: input.verificationStrength ?? (input.fix === undefined ? "NONE" : "INVARIANT"),
    });
}
export function assertRemediationMonotonicity(ceiling, finalClass) {
    if (RANK[finalClass] < RANK[ceiling]) {
        throw new Error(`Remediation class ${finalClass} exceeds rule ceiling ${ceiling}.`);
    }
}
//# sourceMappingURL=assessment.js.map
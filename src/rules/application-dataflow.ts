import type { Finding, FindingProof, RemediationReasonCode } from "../core/schema.js";
import type {
  DataflowBuildResult,
  DataflowCandidate,
} from "../dataflow-analysis/bounded-engine.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding } from "../rule-engine/finding.js";

const RULE_ID = {
  SQL_INJECTION: "AS-INJECTION-SQL-001",
  COMMAND_INJECTION: "AS-INJECTION-CMD-001",
  PATH_TRAVERSAL: "AS-PATH-001",
  SSRF: "AS-SSRF-001",
} as const;

function completeProof(candidate: DataflowCandidate): FindingProof {
  const rule = requireRule(RULE_ID[candidate.kind]);
  return {
    ...candidate.proof,
    ruleId: rule.id,
    ruleVersion: rule.version,
    ruleMaturity: rule.maturity ?? "PRODUCTION",
    cwe: rule.standards.cwe,
    asvs: rule.standards.asvs,
    owaspTop10: rule.standards.owaspTop10,
  };
}

function policyReasons(candidate: DataflowCandidate): RemediationReasonCode[] {
  if (candidate.kind === "PATH_TRAVERSAL" || candidate.kind === "SSRF") {
    return [...candidate.remediationReasons, "BUSINESS_POLICY_REQUIRED"];
  }
  return [...candidate.remediationReasons];
}

export function buildApplicationDataflowFindings(result: DataflowBuildResult): Finding[] {
  if (result.analysis.completeness === "TRUNCATED") return [];
  return result.candidates.map((candidate) => {
    const rule = requireRule(RULE_ID[candidate.kind]);
    return makeFinding({
      rule,
      file: candidate.file,
      startOffset: candidate.startOffset,
      endOffset: candidate.endOffset,
      message: candidate.message,
      affectedComponent: candidate.affectedComponent,
      reachability: candidate.proof.reachability,
      proof: completeProof(candidate),
      analysisCompleteness: "COMPLETE",
      remediationReasons: policyReasons(candidate),
      safeConditions: {
        deterministicTransformation: false,
        boundedLocalBlastRadius: false,
        sourceHashVerified: false,
        noBusinessPolicyDecision: candidate.kind !== "PATH_TRAVERSAL" && candidate.kind !== "SSRF",
        noAuthorizationPolicyInvention: true,
        noArchitectureChange: true,
        noSemanticAmbiguity: false,
        noUnknownSecurityDependency: true,
        independentInvariantVerification: false,
      },
      fingerprintAnchor: candidate.fingerprintAnchor,
    });
  });
}

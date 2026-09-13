import type { Finding, RuleDefinition, ScanReport } from "../core/schema.js";
import { RULE_BY_ID } from "../rule-engine/catalogue.js";
import { terminalSafe } from "./terminal.js";
import { renderUncertainty } from "./uncertainty.js";

export function renderRule(rule: RuleDefinition): string {
  return (
    [
      `${rule.id}@${rule.version}: ${rule.title}`,
      rule.description,
      `Evidence required: ${rule.evidenceRequirements.join(" ")}`,
      `Invariant: ${rule.securityInvariant}`,
      `Impact: ${rule.impact}`,
      `Confidence: ${rule.confidence}; ${rule.confidenceModel ?? "based on the declared evidence requirements"}`,
      `Reachability scope: ${rule.reachabilityAssessment}`,
      "Proof: a rule description is not a finding or proof about your repository.",
      `Maximum remediation authority: ${rule.maxRemediationClass ?? rule.autofix}`,
      `Next: ${rule.remediation}`,
      `Verification: ${rule.verificationStrategy ?? "Rescan and review the invariant."}`,
      `Limitations: ${(rule.limitations ?? []).join(" ")}`,
    ]
      .map(terminalSafe)
      .join("\n") + "\n"
  );
}

export function remediationExplanation(finding: Finding): string {
  if (finding.autofix === "SAFE")
    return `SAFE: ${finding.fix?.description ?? "Only the admitted exact local transformation is permitted."} Verify the source hash, parse the changed file, rescan and independently verify the invariant; failed verification triggers rollback. No target command runs without separate authorization.`;
  if (finding.autofix === "ARCHITECTURAL")
    return "ARCHITECTURAL: a local deterministic patch cannot establish the required system or lifecycle invariant. Review the design and migration, implement it explicitly, then verify the invariant.";
  return "REVIEW_REQUIRED: Cydetix has no independently verifiable SAFE transformation for this finding. Review the control semantics and application policy before modifying code, then rescan.";
}

export function renderFinding(finding: Finding): string {
  const rule = RULE_BY_ID.get(finding.ruleId);
  const limitations = [
    ...new Set([
      ...(finding.proof?.analysisLimitations ?? []),
      ...(rule?.limitations ?? []),
      ...(finding.reachability === "confirmed"
        ? []
        : [rule?.reachabilityAssessment ?? "Runtime reachability is not confirmed."]),
    ]),
  ];
  const proofPath =
    finding.proof === undefined
      ? []
      : [finding.proof.source, ...finding.proof.propagationPath, finding.proof.sink];
  const mapping = [
    ...finding.standards.cwe,
    ...finding.standards.owaspTop10,
    ...finding.standards.asvs,
    ...finding.standards.nist,
  ]
    .map(terminalSafe)
    .join(", ");
  return [
    `${finding.severity.toUpperCase()}  ${terminalSafe(finding.ruleId)}  ${terminalSafe(finding.title)}`,
    `  Location: ${terminalSafe(finding.location.path)}:${finding.location.start.line}:${finding.location.start.column + 1}`,
    `  Confidence: ${finding.confidence}  Reachability: ${finding.reachability}`,
    `  Proof: ${finding.proofState ?? "UNAVAILABLE"}  Analysis: ${finding.analysisCompleteness ?? "UNAVAILABLE"}  Maturity: ${finding.ruleMaturity ?? "PRODUCTION"}`,
    `  Evidence: ${terminalSafe(finding.evidence[0]?.message ?? "(none)")}`,
    ...finding.evidence.slice(1).map((evidence) => `  Evidence: ${terminalSafe(evidence.message)}`),
    ...(finding.proof === undefined
      ? []
      : [
          `  Control: ${finding.proof.securityControlEvaluation}`,
          ...proofPath
            .slice(0, 16)
            .map(
              (step) =>
                `    ${step.kind} ${terminalSafe(step.location.path)}:${step.location.line}: ${terminalSafe(step.label)}`,
            ),
          ...(proofPath.length > 16 ? ["    Additional steps retained in JSON proof."] : []),
        ]),
    `  Invariant: ${terminalSafe(finding.securityInvariant)}`,
    `  Impact: ${terminalSafe(finding.impact)}`,
    `  Remediation: ${terminalSafe(finding.remediation)}`,
    `  Autofix: ${finding.autofix}`,
    `  Maximum remediation authority: ${finding.remediationAssessment?.ceiling ?? rule?.maxRemediationClass ?? finding.autofix}; permitted for this finding: ${finding.autofix}`,
    `  ${terminalSafe(remediationExplanation(finding))}`,
    `  Verification: ${finding.verificationStatus} (separate from proof and confidence)`,
    `  Not established: ${terminalSafe(limitations.join(" ") || "Whole-program security and deployed runtime behavior.")}`,
    ...(finding.remediationAssessment === undefined
      ? []
      : [
          `  Remediation assessment: ceiling ${finding.remediationAssessment.ceiling}; final ${finding.remediationAssessment.finalClass}; ${finding.remediationAssessment.reasonCodes.join(", ")}`,
        ]),
    `  Standards: ${mapping || "none"}`,
    `  Fingerprint: ${finding.fingerprint}`,
  ].join("\n");
}

export function renderText(report: ScanReport): string {
  const summary = report.summary;
  const lines = [
    `${terminalSafe(report.tool.name)} ${terminalSafe(report.tool.version)}`,
    `Target: ${terminalSafe(report.manifest.root)}`,
    `Findings: ${summary.critical} critical, ${summary.high} high, ${summary.medium} medium, ${summary.low} low, ${summary.info} info (${summary.suppressed} suppressed)`,
    "",
    "COVERAGE",
    ...renderUncertainty(report).map((line) => `  ${line}`),
    `  Files examined: ${report.manifest.filesExamined} (${report.manifest.bytesExamined} bytes)`,
    `  Files/directories skipped: ${report.manifest.skipped.length}`,
    `  Languages: ${report.manifest.languages.map(terminalSafe).join(", ") || "none detected"}`,
    `  Frameworks: ${report.manifest.frameworks.map(terminalSafe).join(", ") || "none detected"}`,
    `  Analyzed languages: ${report.coverage.analyzedLanguages.map(terminalSafe).join(", ") || "none"}`,
    `  Analyzed frameworks: ${report.coverage.analyzedFrameworks.map(terminalSafe).join(", ") || "none"}`,
    `  Engines run: ${report.coverage.enginesRun.map(terminalSafe).join("; ")}`,
    `  Engines unavailable: ${report.coverage.enginesUnavailable.map(terminalSafe).join("; ")}`,
    `  Rules enabled: ${report.coverage.enabledRuleIds.map(terminalSafe).join(", ")}`,
    ...(report.reproducibility === undefined
      ? []
      : [
          `  Analysis completeness: ${report.reproducibility.analysisCompleteness}`,
          `  Rule catalogue fingerprint: ${report.reproducibility.ruleCatalogueFingerprint}`,
        ]),
    "  Limitations:",
    ...report.coverage.limitations.map((limitation) => `    - ${terminalSafe(limitation)}`),
    "",
    `AUTHENTICATION GRAPH: ${report.authGraph.nodes.length} nodes, ${report.authGraph.edges.length} edges`,
    ...report.authGraph.limitations.map((limitation) => `  - ${terminalSafe(limitation)}`),
    "",
    `SECURITY IR: ${report.securityAnalysis.securityIr.modules.length} modules, ${report.securityAnalysis.securityIr.calls.length} calls, ${report.securityAnalysis.securityIr.resourceOperations.length} resource operations`,
    `AUTHORIZATION PROOFS: ${report.securityAnalysis.authorizationProofs.filter((proof) => proof.state === "PROVEN").length} proven, ${report.securityAnalysis.authorizationProofs.filter((proof) => proof.state === "VIOLATED").length} violated, ${report.securityAnalysis.authorizationProofs.filter((proof) => proof.state === "UNKNOWN").length} unknown`,
    ...(report.securityAnalysis.authenticationAnalysis === undefined
      ? []
      : [
          `AUTHENTICATION INVARIANTS: ${report.securityAnalysis.authenticationAnalysis.metrics.provenSecure} proven secure, ${report.securityAnalysis.authenticationAnalysis.metrics.provenInsecure} proven insecure, ${report.securityAnalysis.authenticationAnalysis.metrics.unknown} applicable unknown, ${report.securityAnalysis.authenticationAnalysis.metrics.notApplicable} not applicable`,
        ]),
    ...report.securityAnalysis.securityIr.limitations.map(
      (limitation) => `  - ${terminalSafe(limitation)}`,
    ),
    ...(report.securityAnalysis.supplyChainAnalysis === undefined
      ? []
      : [
          "",
          `SUPPLY CHAIN: ${report.securityAnalysis.supplyChainAnalysis.inventory.packages.length} resolved dependencies, advisory state ${report.securityAnalysis.supplyChainAnalysis.advisories.state}`,
          `SECRETS: ${report.securityAnalysis.supplyChainAnalysis.secrets.workingTree}; history ${report.securityAnalysis.supplyChainAnalysis.secrets.history}`,
          `GITHUB ACTIONS: ${report.securityAnalysis.supplyChainAnalysis.ci.actionReferences.length} references across ${report.securityAnalysis.supplyChainAnalysis.ci.workflows.length} workflows`,
        ]),
    "",
  ];
  if (report.findings.length === 0) {
    lines.push("No active findings were produced within the coverage described above.");
  } else {
    lines.push(...report.findings.flatMap((finding) => [renderFinding(finding), ""]));
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

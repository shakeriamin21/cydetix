import type { RemediationReport } from "../remediation/model.js";
import { terminalSafe } from "./terminal.js";

export function renderRemediationText(report: RemediationReport): string {
  const lines = [
    "REMEDIATION SUMMARY",
    "",
    `Findings considered: ${report.findingsConsidered}`,
    `SAFE: ${report.summary.safe}`,
    `REVIEW_REQUIRED: ${report.summary.reviewRequired}`,
    `ARCHITECTURAL: ${report.summary.architectural}`,
    `Applied transactions: ${report.summary.applied}`,
    `Verified transactions: ${report.summary.verified}`,
    `Verification failed: ${report.summary.verificationFailed}`,
    `Rolled back: ${report.summary.rolledBack}`,
    `Residual findings: ${report.summary.residualFindings}`,
  ];
  for (const plan of report.plans) {
    lines.push(
      "",
      `${plan.ruleId} ${plan.classification} ${plan.state}`,
      `Finding: ${plan.findingFingerprint}`,
      `Invariant: ${terminalSafe(plan.expectedSecurityInvariant)}`,
      `Files: ${plan.affectedFiles.map(terminalSafe).join(", ")}`,
    );
    for (const transformation of plan.transformations) {
      lines.push(`Transformation: ${terminalSafe(transformation.description)}`);
      if (transformation.unifiedDiff !== undefined)
        lines.push("", transformation.unifiedDiff.split("\n").map(terminalSafe).join("\n"));
    }
    for (const risk of plan.residualRisk) lines.push(`Residual risk: ${terminalSafe(risk)}`);
  }
  for (const transaction of report.transactions) {
    lines.push(
      "",
      `TRANSACTION ${transaction.transactionId}`,
      `Final state: ${transaction.finalState}`,
    );
    for (const transition of transaction.findingStateTransitions)
      lines.push(
        `${transition.invariant}: ${transition.before} -> ${transition.after} (${transition.result})`,
      );
  }
  for (const limitation of report.limitations)
    lines.push("", `Limitation: ${terminalSafe(limitation)}`);
  return `${lines.join("\n")}\n`;
}

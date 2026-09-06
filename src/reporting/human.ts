import path from "node:path";

import type { Finding, ScanReport, Severity } from "../core/schema.js";
import type { RemediationReport } from "../remediation/model.js";
import { terminalSafe } from "./terminal.js";

export type DecisionCategory = "FIX NOW" | "REVIEW" | "UNKNOWN";

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function decisionCategory(finding: Finding): DecisionCategory {
  if (finding.confidence === "low" || finding.reachability === "unknown") return "UNKNOWN";
  if (SEVERITY_RANK[finding.severity] >= SEVERITY_RANK.high) return "FIX NOW";
  return "REVIEW";
}

function relevantAreas(report: ScanReport): string[] {
  const areas = new Set<string>();
  if (report.manifest.filesExamined > 0) areas.add("Application");
  if (
    report.manifest.authenticationLibraries.length > 0 ||
    report.manifest.sessionAndTokenTechnology.length > 0 ||
    report.manifest.oauthOidcProviders.length > 0
  )
    areas.add("Authentication");
  if (report.securityAnalysis.authorizationProofs.length > 0) areas.add("Authorization");
  const supplyChain = report.securityAnalysis.supplyChainAnalysis;
  if (report.manifest.packageManagers.length > 0 || report.manifest.lockfiles.length > 0)
    areas.add("Dependencies");
  if (supplyChain !== undefined) areas.add("Secrets");
  if (report.manifest.ci.length > 0 || (supplyChain?.ci.workflows.length ?? 0) > 0)
    areas.add("CI/CD");
  return [...areas];
}

function sortedFindings(findings: readonly Finding[]): Finding[] {
  const decisionRank: Record<DecisionCategory, number> = {
    "FIX NOW": 2,
    REVIEW: 1,
    UNKNOWN: 0,
  };
  return [...findings].sort((left, right) => {
    const byDecision = decisionRank[decisionCategory(right)] - decisionRank[decisionCategory(left)];
    if (byDecision !== 0) return byDecision;
    const bySeverity = SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity];
    if (bySeverity !== 0) return bySeverity;
    return left.title.localeCompare(right.title);
  });
}

export function renderHuman(report: ScanReport): string {
  const project = terminalSafe(path.basename(report.manifest.root) || report.manifest.root);
  const seen = new Set<string>();
  const categorized = sortedFindings(report.findings)
    .map((finding) => ({ finding, category: decisionCategory(finding) }))
    .filter(({ finding, category }) => {
      const key = [
        category,
        finding.ruleId,
        finding.title,
        finding.location.path,
        finding.location.start.line,
      ].join("\0");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const needsAttention = categorized.filter(({ category }) => category !== "UNKNOWN");
  const unknown = categorized.filter(({ category }) => category === "UNKNOWN");
  const shown = needsAttention.slice(0, 5);
  const counts: Record<DecisionCategory, number> = { "FIX NOW": 0, REVIEW: 0, UNKNOWN: 0 };
  for (const item of categorized) counts[item.category] += 1;
  const safe = categorized.filter(
    ({ finding, category }) => finding.autofix === "SAFE" && category !== "UNKNOWN",
  ).length;
  const status =
    needsAttention.length > 0
      ? "NEEDS ATTENTION"
      : unknown.length > 0
        ? "REVIEW COVERAGE"
        : "NO ACTIONABLE ISSUES";
  const lines = ["Cydetix", "", `Scanning ${project}...`, ""];
  for (const area of relevantAreas(report)) lines.push(`  ${area}`);
  lines.push(
    "",
    `Security status: ${status}`,
    "",
    `FIX NOW   ${counts["FIX NOW"]}`,
    `REVIEW    ${counts.REVIEW}`,
    `UNKNOWN   ${counts.UNKNOWN}`,
  );
  if (shown.length > 0) lines.push("");
  for (const { finding, category } of shown) {
    const title = terminalSafe(finding.title);
    lines.push(
      category,
      finding.severity.toUpperCase(),
      `${title}${title.endsWith(".") ? "" : "."}`,
      "",
    );
  }
  const other = categorized.length - shown.length;
  if (other > 0) {
    lines.push(`${other} other review/unknown ${other === 1 ? "item" : "items"}`, "");
  }
  if (safe > 0)
    lines.push(`${safe} ${safe === 1 ? "issue can" : "issues can"} be safely remediated.`, "");
  if (needsAttention.length > 0) {
    lines.push("Run:", "", "  cydetix fix");
  } else if (unknown.length > 0) {
    lines.push("Run cydetix --details to review UNKNOWN evidence and coverage limitations.");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderRemediationHuman(report: RemediationReport): string {
  const lines = ["Cydetix Fix", ""];
  if (report.dryRun) {
    lines.push("Dry run complete. No source files were changed.", "");
  } else if (report.summary.verified > 0) {
    lines.push(
      `${report.summary.verified} SAFE ${report.summary.verified === 1 ? "fix was" : "fixes were"} applied and verified.`,
      "",
    );
  } else {
    lines.push("No SAFE source changes were applied.", "");
  }
  lines.push(
    `SAFE: ${report.summary.safe}`,
    `REVIEW_REQUIRED: ${report.summary.reviewRequired}`,
    `ARCHITECTURAL: ${report.summary.architectural}`,
    `Residual findings: ${report.summary.residualFindings}`,
  );
  if (report.summary.reviewRequired > 0 || report.summary.architectural > 0) {
    lines.push("", "Review-required and architectural work was not applied automatically.");
  }
  if (!report.dryRun && report.summary.verificationFailed > 0) {
    lines.push("", "Verification failed; Cydetix preserved or restored the repository safely.");
  }
  return `${lines.join("\n")}\n`;
}

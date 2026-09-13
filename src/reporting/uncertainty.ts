import type { ScanReport } from "../core/schema.js";
import { terminalSafe } from "./terminal.js";

/** Proof instances, not a count of unique vulnerabilities or affected routes. */
export function unknownEvidence(report: ScanReport): string[] {
  return [
    ...(report.securityAnalysis.applicationDataflow?.unknowns ?? []).map(
      (item) => `${item.ruleId} ${item.path}:${item.line}: ${item.explanation}`,
    ),
    ...report.securityAnalysis.authorizationProofs
      .filter((item) => item.state === "UNKNOWN")
      .map(
        (item) =>
          `${item.invariant} ${item.evidencePath[0]?.location.path ?? "unresolved path"}: ${item.explanation}`,
      ),
    ...(report.securityAnalysis.authenticationAnalysis?.results ?? [])
      .filter(
        (item) =>
          item.applicability === "UNKNOWN" ||
          (item.applicability === "APPLICABLE" && item.conclusion === "UNKNOWN"),
      )
      .map(
        (item) => `${item.invariantId}: ${item.explanation} ${item.unresolvedConditions.join(" ")}`,
      ),
  ];
}

export function renderUncertainty(report: ScanReport, limit = Number.POSITIVE_INFINITY): string[] {
  const unknown = unknownEvidence(report);
  return [
    `Analysis completeness: ${report.reproducibility?.analysisCompleteness ?? "UNAVAILABLE"} (within supported patterns)`,
    `UNKNOWN proof instances: ${unknown.length} (may refer to the same code)`,
    "UNKNOWN means the available evidence cannot establish the invariant; review the missing control or unsupported path and rescan after changes.",
    ...unknown.slice(0, limit).map((item) => `  - ${terminalSafe(item)}`),
    ...(unknown.length > limit
      ? [
          `  ${unknown.length - limit} more UNKNOWN instances; use --details or --json for all evidence.`,
        ]
      : []),
    ...(report.coverage.analysisCompleteness ?? [])
      .filter((item) => item.status !== "COMPLETE")
      .map((item) => `  ${item.engine}: ${item.status}. ${terminalSafe(item.details)}`),
    `Dependency advisories: ${report.securityAnalysis.supplyChainAnalysis?.advisories.state ?? "UNAVAILABLE"}`,
    "No findings is not a security guarantee. Runtime behavior, unsupported constructs and unchecked advisories remain outside the proof.",
  ];
}

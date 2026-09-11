import type { ScanReport } from "../core/schema.js";

/** Removes documented run-local fields before byte-equivalence comparisons. */
export function normalizeScanForDeterminism(report: ScanReport): unknown {
  const normalized = structuredClone(report);
  normalized.scan.id = "00000000-0000-0000-0000-000000000000";
  normalized.scan.startedAt = "1970-01-01T00:00:00.000Z";
  normalized.scan.completedAt = "1970-01-01T00:00:00.000Z";
  normalized.scan.performanceMilliseconds = {
    repositoryDiscovery: 0,
    parsing: 0,
    callGraph: 0,
    securityGraph: 0,
    authenticationGraph: 0,
    invariantEvaluation: 0,
    reportGeneration: 0,
  };
  normalized.manifest.root = ".";
  if (normalized.reproducibility !== undefined) {
    normalized.reproducibility.scanId = "00000000-0000-0000-0000-000000000000";
    normalized.reproducibility.analysisTimestamp = "1970-01-01T00:00:00.000Z";
    normalized.reproducibility.canonicalRepositoryRoot = ".";
  }
  const supplyChain = normalized.securityAnalysis.supplyChainAnalysis;
  if (supplyChain !== undefined) {
    supplyChain.performanceMilliseconds = {
      dependencyParsing: 0,
      advisoryProcessing: 0,
      secretScan: 0,
      historyScan: 0,
      workflowAnalysis: 0,
      sbomGeneration: 0,
    };
    if (supplyChain.advisories.checkedAt !== undefined)
      supplyChain.advisories.checkedAt = "1970-01-01T00:00:00.000Z";
  }
  return normalized;
}

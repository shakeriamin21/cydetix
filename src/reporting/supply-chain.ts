import type { SupplyChainAnalysis } from "../supply-chain/model.js";
import { terminalSafe } from "./terminal.js";

export function renderSupplyChainText(analysis: SupplyChainAnalysis): string {
  const fullPins = analysis.ci.actionReferences.filter(
    (reference) => reference.pinning === "full-sha",
  ).length;
  const localPins = analysis.ci.actionReferences.filter(
    (reference) => reference.pinning === "local",
  ).length;
  const historical = analysis.secrets.exposures.filter(
    (exposure) => exposure.sourceCategory === "git-history",
  ).length;
  return `${[
    "SUPPLY CHAIN",
    "",
    "Dependencies",
    `  Status: ${analysis.inventory.status}`,
    `  ${analysis.inventory.packages.length} resolved (${analysis.inventory.directCount} direct, ${analysis.inventory.transitiveCount} transitive)`,
    "",
    "Advisories",
    `  ${terminalSafe(analysis.advisories.provider)}: ${analysis.advisories.state}`,
    `  ${analysis.advisories.advisories.length} affected resolved package record(s)`,
    "",
    "Secrets",
    `  Working tree: ${analysis.secrets.workingTree}`,
    `  Git history: ${analysis.secrets.history}${historical > 0 ? ` (${historical} redacted exposure(s))` : ""}`,
    "  Active validation: NOT_PERFORMED",
    "",
    "GitHub Actions",
    `  ${analysis.ci.workflows.length} workflow(s), ${analysis.ci.actionReferences.length} external/local reference(s)`,
    `  ${fullPins} full-SHA pinned, ${localPins} local`,
    `  ${analysis.ci.pullRequestTargetWorkflows.length} pull_request_target workflow(s)`,
    "",
    "SBOM",
    `  CycloneDX 1.7: ${analysis.inventory.status === "COMPLETE" ? "available" : "partial"}`,
    "  SPDX: not implemented",
    "",
    "Supply-chain controls",
    `  Source integrity: ${analysis.controls.sourceIntegrity}`,
    `  Build provenance: ${analysis.controls.buildProvenance}`,
    `  Artifact identity: ${analysis.controls.artifactIdentity}`,
    `  Signing: ${analysis.controls.signing}`,
    `  Dependency inventory: ${analysis.controls.dependencyInventory}`,
    `  CI permissions: ${analysis.controls.ciPermissions}`,
  ].join("\n")}\n`;
}

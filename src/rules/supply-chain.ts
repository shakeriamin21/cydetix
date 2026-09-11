import { stableFingerprint } from "../core/hash.js";
import type { Finding, RuleDefinition } from "../core/schema.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding, pointAt } from "../rule-engine/finding.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SupplyChainBuildResult } from "../supply-chain/engine.js";
import { assessRemediation } from "../remediation/assessment.js";

const vulnerableDependency = requireRule("AS-SCA-001");
const actionPinning = requireRule("AS-CI-001");
const broadPermissions = requireRule("AS-CI-002");
const dangerousPrTarget = requireRule("AS-CI-003");
const contextInjection = requireRule("AS-CI-004");
const committedSecret = requireRule("AS-SECRET-001");

function fileByPath(files: readonly SourceFile[], filePath: string): SourceFile | undefined {
  return files.find((file) => file.relativePath === filePath);
}

function historicalSecretFinding(
  exposure: SupplyChainBuildResult["analysis"]["secrets"]["exposures"][number],
): Finding {
  const remediationAssessment = assessRemediation({
    rule: committedSecret,
    requestedClass: "ARCHITECTURAL",
    reasonCodes: ["ARCHITECTURE_CHANGE_REQUIRED"],
  });
  return {
    fingerprint: stableFingerprint([
      committedSecret.id,
      "git-history",
      exposure.location.path,
      exposure.fingerprint,
    ]),
    ruleId: committedSecret.id,
    ruleVersion: committedSecret.version,
    severity: committedSecret.severity,
    confidence: exposure.confidence,
    reachability: "unknown",
    title: "Credential-like secret remains in Git history",
    category: committedSecret.category,
    affectedComponent: "Git object history",
    location: exposure.location,
    evidence: [
      {
        message: `${exposure.provider} ${exposure.type} was detected in an added historical line by ${exposure.engine}; contents are redacted and were not validated.`,
        excerpt: exposure.redactedPreview,
        redacted: true,
      },
    ],
    securityInvariant: committedSecret.securityInvariant,
    attackPrerequisite: committedSecret.attackPrerequisite,
    impact: committedSecret.impact,
    standards: committedSecret.standards,
    remediation:
      "Treat the credential as potentially compromised: revoke or rotate it at the provider, remove current copies, evaluate repository-history removal, review provider logs, move delivery to a secret manager, and verify equivalent copies are absent.",
    autofix: "ARCHITECTURAL",
    ruleMaturity: committedSecret.maturity ?? "PRODUCTION",
    proofState: "PROVEN_INSECURE",
    analysisCompleteness: "COMPLETE",
    remediationAssessment,
    verificationStatus: "not_attempted",
  };
}

function workflowFinding(
  rule: RuleDefinition,
  file: SourceFile,
  offset: number,
  needle: string,
  message: string,
  evidencePath?: Finding["evidencePath"],
): Finding {
  return makeFinding({
    rule,
    file,
    startOffset: offset,
    endOffset: offset + Math.max(1, needle.length),
    message,
    affectedComponent: "GitHub Actions workflow",
    reachability: "likely",
    ...(evidencePath === undefined ? {} : { evidencePath }),
    fingerprintAnchor: `${rule.id}:${file.relativePath}:${needle}:${offset}`,
  });
}

export function buildSupplyChainFindings(
  result: SupplyChainBuildResult,
  files: readonly SourceFile[],
): Finding[] {
  const findings: Finding[] = [];
  const analysis = result.analysis;
  const evidenceById = new Map(analysis.ir.evidence.map((item) => [item.id, item]));
  const packageByPurl = new Map(
    analysis.inventory.packages.map((component) => [component.purl, component]),
  );

  for (const advisory of analysis.advisories.advisories) {
    const component = packageByPurl.get(advisory.packagePurl);
    if (component === undefined) continue;
    const packageEvidence = evidenceById.get(component.evidenceIds[0] ?? "");
    const file =
      packageEvidence === undefined ? undefined : fileByPath(files, packageEvidence.location.path);
    if (file === undefined || packageEvidence === undefined) continue;
    const dependencyPath = analysis.inventory.paths.find((item) => item.packageId === component.id)
      ?.path ?? [analysis.inventory.rootComponent ?? "application", component.purl];
    const advisoryNames = [advisory.id, ...advisory.aliases].join(", ");
    const fixed =
      advisory.fixedVersions.length === 0 ? "not supplied" : advisory.fixedVersions.join(", ");
    const evidencePath = [
      ...dependencyPath.map((entry, index) => ({
        order: index,
        kind: "dependency" as const,
        irId: index === 0 ? `root:${stableFingerprint([entry]).slice(0, 16)}` : component.id,
        location: packageEvidence.location,
        message:
          index === 0 ? `dependency root ${entry}` : `resolved dependency path includes ${entry}`,
      })),
      {
        order: dependencyPath.length,
        kind: "advisory" as const,
        irId: `advisory:${stableFingerprint([advisory.provider, advisory.id]).slice(0, 16)}`,
        location: packageEvidence.location,
        message: `${advisory.provider} reports ${advisory.id} for the exact resolved version`,
      },
    ];
    findings.push(
      makeFinding({
        rule: vulnerableDependency,
        file,
        startOffset: packageEvidence.location.start.offset,
        endOffset: packageEvidence.location.end.offset,
        message: `${component.purl} is affected by ${advisoryNames}; fixed version(s): ${fixed}. Reachability remains UNKNOWN.`,
        affectedComponent: component.purl,
        reachability: "unknown",
        evidencePath,
        fingerprintAnchor: `${component.purl}:${advisory.id}`,
      }),
    );
  }

  for (const reference of analysis.ci.actionReferences) {
    if (["full-sha", "local", "digest"].includes(reference.pinning)) continue;
    const file = fileByPath(files, reference.workflow);
    if (file === undefined) continue;
    findings.push(
      workflowFinding(
        actionPinning,
        file,
        reference.location.start.offset,
        `${reference.repository}@${reference.reference}`,
        `${reference.repository} uses ${reference.pinning} reference ${reference.reference}; no authoritative SHA was invented.`,
      ),
    );
  }

  for (const permission of analysis.ci.permissions) {
    if (permission.access !== "write-all") continue;
    const file = fileByPath(files, permission.workflow);
    if (file === undefined) continue;
    findings.push(
      workflowFinding(
        broadPermissions,
        file,
        permission.location.start.offset,
        "permissions: write-all",
        `${permission.job === undefined ? "Workflow" : `Job ${permission.job}`} explicitly grants write-all permissions.`,
      ),
    );
  }

  for (const signal of result.workflowSignals) {
    const rule =
      signal.kind === "dangerous-pull-request-target" ? dangerousPrTarget : contextInjection;
    const first = signal.locations[0];
    if (first === undefined) continue;
    const evidencePath = signal.locations.map((item, index) => ({
      order: index,
      kind: "workflow" as const,
      irId: `workflow:${stableFingerprint([signal.workflow.relativePath, signal.kind, String(index), item.message]).slice(0, 16)}`,
      location: {
        path: signal.workflow.relativePath,
        start: pointAt(signal.workflow.text, item.offset),
        end: pointAt(signal.workflow.text, item.offset + item.needle.length),
      },
      message: item.message,
    }));
    findings.push(
      workflowFinding(
        rule,
        signal.workflow,
        first.offset,
        first.needle,
        signal.message,
        evidencePath.length >= 2 ? evidencePath : undefined,
      ),
    );
  }

  findings.push(
    ...analysis.secrets.exposures
      .filter((exposure) => exposure.sourceCategory === "git-history")
      .map(historicalSecretFinding),
  );
  return findings;
}

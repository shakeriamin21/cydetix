import { findingSchema, type Finding } from "../core/schema.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding } from "../rule-engine/finding.js";
import type { AnalysisContext, SecurityRule } from "../rule-engine/types.js";
import { detectSecretsInText } from "../supply-chain/secrets.js";

const definition = requireRule("AS-SECRET-001");

/** A PEM header alone proves neither key material nor credential exposure. */
export function privateKeyMarkerFinding(finding: Finding): Finding {
  return findingSchema.parse({
    ...finding,
    title: "Private-key marker observed; credential material is unproven",
    proofState: "UNKNOWN",
    analysisCompleteness: "PARTIAL",
    affectedComponent: "private-key marker; payload and deployment unresolved",
    evidence: finding.evidence.map((evidence) => ({
      ...evidence,
      message:
        "A private-key header was observed. The bounded detector does not validate the payload or establish whether this is a placeholder, test fixture, or deployed credential. Contents remain redacted; no provider was contacted.",
    })),
    remediation:
      "Inspect the marker and its payload locally. If it contains credential material used outside a test fixture, revoke or rotate that credential and review its history. A marker alone does not justify a key migration; automatic modification is withheld.",
  });
}

export const committedSecretRule: SecurityRule = {
  definition,
  analyze(context: AnalysisContext): readonly Finding[] {
    const exposures = detectSecretsInText(context.file.text, {
      path: context.file.relativePath,
      sourceCategory: "working-tree",
      historyState: "current",
    });
    return exposures.map((exposure): Finding => {
      const finding = makeFinding({
        rule: definition,
        file: context.file,
        startOffset: exposure.location.start.offset,
        endOffset: exposure.location.end.offset,
        message: `${exposure.provider} ${exposure.type} is present in source; contents are redacted and active validation was not attempted. Treat it as potentially compromised and rotate or revoke it at the provider.`,
        excerpt: exposure.redactedPreview,
        redacted: true,
        affectedComponent: "source-controlled credential",
        reachability: "unknown",
        fingerprintAnchor: `${exposure.provider}:${exposure.fingerprint}`,
      });
      return exposure.provider === "cryptographic-key" ? privateKeyMarkerFinding(finding) : finding;
    });
  },
};

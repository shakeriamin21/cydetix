import type { Finding } from "../core/schema.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding } from "../rule-engine/finding.js";
import type { RepositorySecurityRule } from "../rule-engine/types.js";

const definition = requireRule("AS-AUTHZ-001");

export const objectAuthorizationRule: RepositorySecurityRule = {
  definition,
  analyze(context): readonly Finding[] {
    const filesByPath = new Map(context.files.map((file) => [file.relativePath, file]));
    const findings: Finding[] = [];
    for (const proof of context.authorizationProofs) {
      if (proof.invariant !== "object-authorization" || proof.state !== "VIOLATED") continue;
      const resourceStep = [...proof.evidencePath]
        .reverse()
        .find((item) => item.kind === "resource");
      if (resourceStep === undefined) continue;
      const file = filesByPath.get(resourceStep.location.path);
      if (file === undefined) continue;
      findings.push(
        makeFinding({
          rule: definition,
          file,
          startOffset: resourceStep.location.start.offset,
          endOffset: resourceStep.location.end.offset,
          message: proof.explanation,
          affectedComponent: "cross-file object authorization path",
          reachability: proof.reachability,
          evidencePath: proof.evidencePath,
          fingerprintAnchor: proof.id,
        }),
      );
    }
    return findings;
  },
};

import type { Finding } from "../core/schema.js";
import { requireRule } from "../rule-engine/catalogue.js";
import { makeFinding } from "../rule-engine/finding.js";
import type { AnalysisContext, SecurityRule } from "../rule-engine/types.js";
import { detectSecretsInText } from "../supply-chain/secrets.js";

const definition = requireRule("AS-SECRET-001");

export const committedSecretRule: SecurityRule = {
  definition,
  analyze(context: AnalysisContext): readonly Finding[] {
    const exposures = detectSecretsInText(context.file.text, {
      path: context.file.relativePath,
      sourceCategory: "working-tree",
      historyState: "current",
    });
    return exposures.map((exposure): Finding =>
      makeFinding({
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
      }),
    );
  },
};

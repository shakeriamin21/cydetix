import { sha256, stableFingerprint } from "../core/hash.js";
import { pointAt } from "../rule-engine/finding.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import { secretAnalysisSchema, secretExposureSchema, type SecretExposure } from "./model.js";

interface SecretPattern {
  readonly provider: string;
  readonly type: string;
  readonly expression: RegExp;
  readonly valueGroup: number;
  readonly contextual: boolean;
}

const PATTERNS: readonly SecretPattern[] = [
  {
    provider: "synthetic-cydetix",
    type: "synthetic test credential",
    expression: /\b(CYDETIX_TEST_SECRET_[A-Za-z0-9]{24,})\b/gu,
    valueGroup: 1,
    contextual: false,
  },
  {
    provider: "GitHub",
    type: "personal access token",
    expression: /\b(gh[pousr]_[A-Za-z0-9]{36,255})\b/gu,
    valueGroup: 1,
    contextual: false,
  },
  {
    provider: "npm",
    type: "access token",
    expression: /\b(npm_[A-Za-z0-9]{36})\b/gu,
    valueGroup: 1,
    contextual: false,
  },
  {
    provider: "AWS",
    type: "access key identifier",
    expression: /\b((?:AKIA|ASIA)[A-Z0-9]{16})\b/gu,
    valueGroup: 1,
    contextual: false,
  },
  {
    provider: "generic",
    type: "credential literal",
    expression:
      /\b(?:AWS_SECRET_ACCESS_KEY|DATABASE_PASSWORD|CLIENT_SECRET|PRIVATE_API_KEY|API_TOKEN|ACCESS_TOKEN)\b\s*(?:=|:)\s*["']([^"'\r\n]{24,})["']/giu,
    valueGroup: 1,
    contextual: true,
  },
  {
    provider: "cryptographic-key",
    type: "private key",
    expression: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/gu,
    valueGroup: 1,
    contextual: false,
  },
];

const PLACEHOLDER_MARKERS = [
  "example",
  "placeholder",
  "changeme",
  "change-me",
  "your-secret",
  "your_secret",
  "not-a-real",
  "not_real",
  "dummy",
  "sample",
  "redacted",
  "<secret>",
  "${",
] as const;

function looksLikePlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  if (PLACEHOLDER_MARKERS.some((marker) => normalized.includes(marker))) return true;
  const compact = value.replaceAll(/[^A-Za-z0-9]/g, "");
  if (compact.length > 0 && new Set(compact.toLowerCase()).size <= 2) return true;
  if (/^[a-f0-9]{32,128}$/iu.test(value)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(value)) return true;
  return false;
}

function redacted(provider: string, value: string): string {
  return `[REDACTED ${provider} credential; length=${value.length}; sha256=${sha256(value).slice(0, 12)}]`;
}

export interface SecretTextOptions {
  readonly path: string;
  readonly sourceCategory: SecretExposure["sourceCategory"];
  readonly historyState: SecretExposure["historyState"];
  readonly engine?: string;
  readonly lineOffset?: number;
}

export function detectSecretsInText(text: string, options: SecretTextOptions): SecretExposure[] {
  if (/^(?:package-lock\.json|npm-shrinkwrap\.json)$/u.test(options.path.split("/").at(-1) ?? "")) {
    return [];
  }
  const results: SecretExposure[] = [];
  for (const pattern of PATTERNS) {
    for (const match of text.matchAll(pattern.expression)) {
      const value = match[pattern.valueGroup];
      if (value === undefined) continue;
      const explicitFixtureExposure = value.toLowerCase().startsWith("fixture-only-not-a-real-");
      if (
        pattern.provider !== "synthetic-cydetix" &&
        !explicitFixtureExposure &&
        looksLikePlaceholder(value)
      ) {
        continue;
      }
      const valueOffsetInMatch = match[0].indexOf(value);
      const startOffset = match.index + Math.max(0, valueOffsetInMatch);
      const start = pointAt(text, startOffset);
      const end = pointAt(text, startOffset + value.length);
      const lineOffset = options.lineOffset ?? 0;
      const fingerprint = sha256(value);
      results.push(
        secretExposureSchema.parse({
          id: `secret:${stableFingerprint([pattern.provider, pattern.type, options.path, fingerprint]).slice(0, 16)}`,
          provider: pattern.provider,
          type: pattern.type,
          location: {
            path: options.path,
            start: { ...start, line: start.line + lineOffset },
            end: { ...end, line: end.line + lineOffset },
          },
          redactedPreview: redacted(pattern.provider, value),
          fingerprint,
          confidence: "high",
          sourceCategory: options.sourceCategory,
          historyState: options.historyState,
          rotationGuidance: [
            "CURRENT_TREE_REMOVAL",
            "CREDENTIAL_ROTATION_REQUIRED",
            ...(options.sourceCategory === "git-history" ? ["HISTORY_REWRITE_CONSIDER"] : []),
            "PROVIDER_REVOCATION_REQUIRED",
          ],
          validationState: "PASSIVE_NOT_VALIDATED",
          engine: options.engine ?? "cydetix-secret-engine-v1",
        }),
      );
    }
  }
  return results;
}

export function analyzeWorkingTreeSecrets(files: readonly SourceFile[]) {
  const exposures = files.flatMap((file) =>
    detectSecretsInText(file.text, {
      path: file.relativePath,
      sourceCategory: "working-tree",
      historyState: "current",
    }),
  );
  const unique = [
    ...new Map(
      exposures.map((exposure) => [`${exposure.location.path}:${exposure.fingerprint}`, exposure]),
    ).values(),
  ];
  return secretAnalysisSchema.parse({
    workingTree: unique.length === 0 ? "CHECKED_NO_FINDINGS" : "CHECKED_FINDINGS",
    history: "NOT_CHECKED",
    exposures: unique,
    redactionGuaranteed: true,
    activeValidation: "NOT_PERFORMED",
    limitations: [
      "Detection is passive; credentials are never submitted to providers for validation.",
      "Entropy-only candidates without credential context are not emitted to preserve precision.",
    ],
  });
}

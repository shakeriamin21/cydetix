import type { Node } from "@babel/types";

import { sha256, stableFingerprint } from "../core/hash.js";
import type {
  Finding,
  EvidencePathStep,
  FixEdit,
  Reachability,
  RemediationClass,
  RuleDefinition,
} from "../core/schema.js";
import type { SourceFile } from "../repository-discovery/traverse.js";

interface FindingInput {
  readonly rule: RuleDefinition;
  readonly file: SourceFile;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly message: string;
  readonly excerpt?: string;
  readonly redacted?: boolean;
  readonly evidencePath?: readonly EvidencePathStep[];
  readonly affectedComponent?: string;
  readonly reachability?: Reachability;
  readonly autofix?: RemediationClass;
  readonly fix?: FixEdit;
  readonly fingerprintAnchor?: string;
}

export function pointAt(
  text: string,
  offset: number,
): { line: number; column: number; offset: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const prefix = text.slice(0, safeOffset);
  const lines = prefix.split("\n");
  return {
    line: lines.length,
    column: lines.at(-1)?.length ?? 0,
    offset: safeOffset,
  };
}

export function lineExcerpt(text: string, offset: number): string {
  const start = text.lastIndexOf("\n", Math.max(0, offset - 1)) + 1;
  const lineEnd = text.indexOf("\n", offset);
  return (
    text
      .slice(start, lineEnd === -1 ? text.length : lineEnd)
      .trim()
      .slice(0, 240) || "(empty line)"
  );
}

export function nodeRange(node: Node): { start: number; end: number } | undefined {
  if (typeof node.start !== "number" || typeof node.end !== "number") return undefined;
  return { start: node.start, end: node.end };
}

export function makeFix(
  file: SourceFile,
  startOffset: number,
  endOffset: number,
  replacement: string,
  description: string,
): FixEdit {
  return {
    path: file.relativePath,
    startOffset,
    endOffset,
    expectedTextSha256: sha256(file.text.slice(startOffset, endOffset)),
    replacement,
    description,
  };
}

export function makeFinding(input: FindingInput): Finding {
  const excerpt = input.excerpt ?? lineExcerpt(input.file.text, input.startOffset);
  const fingerprintAnchor = input.fingerprintAnchor ?? excerpt.replaceAll(/\s+/g, " ").trim();
  return {
    fingerprint: stableFingerprint([input.rule.id, input.file.relativePath, fingerprintAnchor]),
    ruleId: input.rule.id,
    ruleVersion: input.rule.version,
    severity: input.rule.severity,
    confidence: input.rule.confidence,
    reachability: input.reachability ?? "possible",
    title: input.rule.title,
    category: input.rule.category,
    affectedComponent: input.affectedComponent ?? input.file.relativePath,
    location: {
      path: input.file.relativePath,
      start: pointAt(input.file.text, input.startOffset),
      end: pointAt(input.file.text, input.endOffset),
    },
    evidence: [
      {
        message: input.message,
        excerpt,
        redacted: input.redacted ?? false,
      },
    ],
    ...(input.evidencePath === undefined ? {} : { evidencePath: [...input.evidencePath] }),
    securityInvariant: input.rule.securityInvariant,
    attackPrerequisite: input.rule.attackPrerequisite,
    impact: input.rule.impact,
    standards: input.rule.standards,
    remediation: input.rule.remediation,
    autofix: input.autofix ?? input.rule.autofix,
    ...(input.fix === undefined ? {} : { fix: input.fix }),
    verificationStatus: "not_attempted",
  };
}

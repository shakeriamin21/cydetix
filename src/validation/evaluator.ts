import type { Finding } from "../core/schema.js";
import {
  corpusLabelsSchema,
  corpusManifestSchema,
  corpusValidationResultSchema,
  type CorpusLabels,
  type CorpusManifest,
  type CorpusValidationResult,
  type ValidationCaseResult,
  type ValidationCounts,
  type ValidationMetrics,
} from "./model.js";

function emptyCounts(): ValidationCounts {
  return {
    total: 0,
    languageCompatible: 0,
    ruleCompatible: 0,
    executed: 0,
    truePositive: 0,
    falsePositive: 0,
    trueNegative: 0,
    falseNegative: 0,
    unknown: 0,
    unsupported: 0,
    notApplicable: 0,
    duplicate: 0,
    needsDomainContext: 0,
  };
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? undefined : { value: numerator / denominator, numerator, denominator };
}

function metrics(
  counts: ValidationCounts,
  completeness: CorpusLabels["completeness"],
): ValidationMetrics {
  const limitations: string[] = [];
  const precision = ratio(counts.truePositive, counts.truePositive + counts.falsePositive);
  if (precision === undefined)
    limitations.push("Precision is unavailable without adjudicated positives.");
  if (completeness !== "COMPLETE_APPLICABLE_LABELS")
    limitations.push(
      "Recall, false-positive rate, specificity, F1, and Youden are withheld for incomplete labels.",
    );
  if (completeness !== "COMPLETE_APPLICABLE_LABELS")
    return { ...(precision === undefined ? {} : { precision }), limitations };
  const recall = ratio(counts.truePositive, counts.truePositive + counts.falseNegative);
  const falsePositiveRate = ratio(counts.falsePositive, counts.falsePositive + counts.trueNegative);
  const specificity = ratio(counts.trueNegative, counts.trueNegative + counts.falsePositive);
  const f1Denominator = 2 * counts.truePositive + counts.falsePositive + counts.falseNegative;
  const f1 = ratio(2 * counts.truePositive, f1Denominator);
  const youden =
    recall === undefined || specificity === undefined
      ? undefined
      : {
          value: recall.value + specificity.value - 1,
          numerator:
            recall.numerator * specificity.denominator +
            specificity.numerator * recall.denominator -
            recall.denominator * specificity.denominator,
          denominator: recall.denominator * specificity.denominator,
        };
  return {
    ...(precision === undefined ? {} : { precision }),
    ...(recall === undefined ? {} : { recall }),
    ...(falsePositiveRate === undefined ? {} : { falsePositiveRate }),
    ...(specificity === undefined ? {} : { specificity }),
    ...(f1 === undefined ? {} : { f1 }),
    ...(youden === undefined ? {} : { youden }),
    limitations,
  };
}

function increment(counts: ValidationCounts, result: ValidationCaseResult): void {
  counts.total += 1;
  const mapping: Partial<Record<ValidationCaseResult["disposition"], keyof ValidationCounts>> = {
    TRUE_POSITIVE: "truePositive",
    FALSE_POSITIVE: "falsePositive",
    TRUE_NEGATIVE: "trueNegative",
    FALSE_NEGATIVE: "falseNegative",
    UNKNOWN: "unknown",
    UNSUPPORTED: "unsupported",
    NOT_APPLICABLE: "notApplicable",
    EXPECTED_BUT_DUPLICATE: "duplicate",
    NEEDS_DOMAIN_CONTEXT: "needsDomainContext",
  };
  const field = mapping[result.disposition];
  if (field !== undefined) counts[field] += 1;
  if (result.languageCompatible) counts.languageCompatible += 1;
  if (result.ruleCompatible) counts.ruleCompatible += 1;
  if (
    ["TRUE_POSITIVE", "FALSE_POSITIVE", "TRUE_NEGATIVE", "FALSE_NEGATIVE"].includes(
      result.disposition,
    )
  )
    counts.executed += 1;
}

function matches(
  finding: Finding,
  ruleId: string,
  expectedPath: string,
  expectedLine?: number,
): boolean {
  return (
    finding.ruleId === ruleId &&
    (finding.location.path === expectedPath ||
      finding.location.path.endsWith(`/${expectedPath}`)) &&
    (expectedLine === undefined || finding.location.start.line === expectedLine)
  );
}

/** Expected labels are consumed only here, after scanning has produced ordinary Finding data. */
export function evaluateCorpus(
  manifestInput: CorpusManifest,
  labelsInput: CorpusLabels,
  findings: readonly Finding[],
): CorpusValidationResult {
  const manifest = corpusManifestSchema.parse(manifestInput);
  const labels = corpusLabelsSchema.parse(labelsInput);
  if (manifest.corpusId !== labels.corpusId)
    throw new Error("Corpus manifest/label identity mismatch.");
  const cases: ValidationCaseResult[] = [];
  for (const item of labels.expectedCases) {
    const observed = findings.some((finding) =>
      matches(finding, item.ruleId, item.path, item.line),
    );
    const disposition = !item.languageCompatible
      ? "UNSUPPORTED"
      : !item.ruleCompatible
        ? "NOT_APPLICABLE"
        : item.expectedUnknown
          ? "UNKNOWN"
          : item.expected === "VULNERABLE"
            ? observed
              ? "TRUE_POSITIVE"
              : "FALSE_NEGATIVE"
            : observed
              ? "FALSE_POSITIVE"
              : "TRUE_NEGATIVE";
    cases.push({
      caseId: item.caseId,
      ruleId: item.ruleId,
      path: item.path,
      ...(item.line === undefined ? {} : { line: item.line }),
      languageCompatible: item.languageCompatible,
      ruleCompatible: item.languageCompatible && item.ruleCompatible,
      disposition,
      rationale: item.rationale,
    });
  }
  for (const item of labels.manualAdjudications) {
    const observed = findings.some((finding) =>
      matches(finding, item.ruleId, item.path, item.line),
    );
    cases.push({
      caseId: item.caseId,
      ruleId: item.ruleId,
      path: item.path,
      ...(item.line === undefined ? {} : { line: item.line }),
      languageCompatible: true,
      ruleCompatible: true,
      disposition: observed ? item.disposition : "UNKNOWN",
      rationale: observed
        ? item.rationale
        : "The independently adjudicated finding was not produced by this scan.",
    });
  }
  for (const finding of findings) {
    const represented = cases.some((item) => matches(finding, item.ruleId, item.path, item.line));
    if (!represented)
      cases.push({
        caseId: `unadjudicated:${finding.fingerprint}`,
        ruleId: finding.ruleId,
        path: finding.location.path,
        line: finding.location.start.line,
        languageCompatible: true,
        ruleCompatible: true,
        disposition: "UNKNOWN",
        rationale:
          "Observed scanner finding has no independent expected label or manual adjudication.",
      });
  }
  cases.sort((left, right) =>
    `${left.ruleId}:${left.path}:${left.caseId}`.localeCompare(
      `${right.ruleId}:${right.path}:${right.caseId}`,
    ),
  );
  const counts = emptyCounts();
  for (const item of cases) increment(counts, item);
  const ruleIds = [...new Set(cases.map((item) => item.ruleId))].sort();
  const perRule = ruleIds.map((ruleId) => {
    const ruleCounts = emptyCounts();
    for (const item of cases.filter((candidate) => candidate.ruleId === ruleId))
      increment(ruleCounts, item);
    return { ruleId, counts: ruleCounts, metrics: metrics(ruleCounts, labels.completeness) };
  });
  return corpusValidationResultSchema.parse({
    schemaVersion: "1.0.0",
    corpusId: manifest.corpusId,
    immutableRevision: manifest.immutableRevision,
    counts,
    metrics: metrics(counts, labels.completeness),
    perRule,
    cases,
  });
}

import path from "node:path";
import { performance } from "node:perf_hooks";

import { scanRepository } from "../dist/core/engine.js";

const corpora = ["xss", "redirect", "csrf"];
const repetitions = 10;
const p95ThresholdMilliseconds = 1_000;
const measurements = [];

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
}

function rounded(value) {
  return Number(value.toFixed(3));
}

for (const corpus of corpora) {
  const target = path.resolve("fixtures", "batch2", corpus, "positive");
  await scanRepository({ path: target, now: new Date("2026-09-12T00:00:00.000Z") });
  const durations = [];
  const heapDeltas = [];
  let stableSecurityResult;
  let sample;
  for (let iteration = 0; iteration < repetitions; iteration += 1) {
    const heapBefore = process.memoryUsage().heapUsed;
    const started = performance.now();
    const report = await scanRepository({
      path: target,
      now: new Date("2026-09-12T00:00:00.000Z"),
    });
    durations.push(performance.now() - started);
    heapDeltas.push(Math.max(0, process.memoryUsage().heapUsed - heapBefore));
    const current = JSON.stringify({
      findings: report.findings,
      applicationDataflow: report.securityAnalysis.applicationDataflow,
      catalogueFingerprint: report.reproducibility?.ruleCatalogueFingerprint,
      configurationFingerprint: report.reproducibility?.configurationFingerprint,
      suppressionFingerprint: report.reproducibility?.suppressionFingerprint,
    });
    if (stableSecurityResult !== undefined && stableSecurityResult !== current) {
      throw new Error(`Non-deterministic Batch 2 result for ${corpus}.`);
    }
    stableSecurityResult = current;
    sample = report;
  }
  const p95 = percentile(durations, 0.95);
  if (p95 > p95ThresholdMilliseconds) {
    throw new Error(
      `Batch 2 performance regression: ${corpus} p95 ${p95.toFixed(3)} ms exceeds ${p95ThresholdMilliseconds} ms.`,
    );
  }
  const metrics = sample?.securityAnalysis.applicationDataflow?.metrics;
  measurements.push({
    corpus,
    filesAnalyzed: metrics?.filesAnalyzed ?? 0,
    astNodes: metrics?.astNodesVisited ?? 0,
    graphFacts: metrics?.factsCreated ?? 0,
    dataflowPathsConsidered: metrics?.pathsConsidered ?? 0,
    truncationEvents: metrics?.truncationEvents ?? 0,
    medianMilliseconds: rounded(percentile(durations, 0.5)),
    p95Milliseconds: rounded(p95),
    maximumObservedPositiveHeapDeltaBytes: Math.max(...heapDeltas),
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      repetitions,
      p95ThresholdMilliseconds,
      alpha10Comparison:
        "NOT_COMPARABLE: alpha.10 did not contain the Batch 2 engine or corpus; all existing phase and Batch 1 benchmarks remain separate regression gates.",
      note: "Warm-cache local static-fixture benchmark. Heap delta is observational rather than a process-wide peak-RSS proof.",
      measurements,
    },
    null,
    2,
  )}\n`,
);

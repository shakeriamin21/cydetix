import { performance } from "node:perf_hooks";
import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";

const fixtures = [
  "dependencies-vulnerable",
  "dependencies-secure",
  "secret-exposed",
  "secret-placeholder",
  "actions-secure",
  "actions-tagged",
  "actions-write-all",
  "actions-pr-target-dangerous",
  "actions-pr-target-benign",
  "actions-expression-injection",
  "actions-expression-safe",
  "sbom",
];
const repetitions = 10;
const p95ThresholdMilliseconds = 150;
const measurements = [];

function percentile(values, fraction) {
  return values[Math.ceil(values.length * fraction) - 1] ?? 0;
}

for (const fixture of fixtures) {
  const target = path.resolve("fixtures", "phase4", fixture);
  await scanRepository({ path: target });
  const durations = [];
  const stages = {
    dependencyParsing: [],
    advisoryProcessing: [],
    secretScan: [],
    historyScan: [],
    workflowAnalysis: [],
    sbomGeneration: [],
  };
  let fingerprint = "";
  for (let iteration = 0; iteration < repetitions; iteration += 1) {
    const started = performance.now();
    const report = await scanRepository({ path: target });
    durations.push(performance.now() - started);
    const supplyChain = report.securityAnalysis.supplyChainAnalysis;
    if (supplyChain === undefined) throw new Error("Phase 4 stage timings are unavailable.");
    for (const stage of Object.keys(stages)) {
      stages[stage].push(supplyChain.performanceMilliseconds[stage]);
    }
    const current = JSON.stringify({
      findings: report.findings.map((finding) => finding.fingerprint),
      packages: supplyChain.inventory.packages.map((component) => component.purl),
      advisoryState: supplyChain.advisories.state,
      secretFingerprints: supplyChain.secrets.exposures.map((exposure) => exposure.fingerprint),
    });
    if (fingerprint !== "" && current !== fingerprint) {
      throw new Error(`Non-deterministic Phase 4 result for ${fixture}.`);
    }
    fingerprint = current;
  }
  durations.sort((left, right) => left - right);
  const p95 = percentile(durations, 0.95);
  if (p95 > p95ThresholdMilliseconds) {
    throw new Error(
      `Phase 4 static performance regression: ${fixture} p95 ${p95.toFixed(3)} ms exceeds ${p95ThresholdMilliseconds} ms.`,
    );
  }
  measurements.push({
    fixture,
    repetitions,
    medianMilliseconds: Number((durations[Math.floor(durations.length / 2)] ?? 0).toFixed(3)),
    p95Milliseconds: Number(p95.toFixed(3)),
    stageMedianMilliseconds: Object.fromEntries(
      Object.entries(stages).map(([stage, values]) => {
        values.sort((left, right) => left - right);
        return [stage, Number((values[Math.floor(values.length / 2)] ?? 0).toFixed(3))];
      }),
    ),
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      measuredAt: new Date().toISOString(),
      repetitions,
      p95ThresholdMilliseconds,
      networkLatencyIncluded: false,
      historyModeIncluded: false,
      note: "Warm-cache local fixture benchmark with a generous regression gate; not a cross-machine throughput claim.",
      measurements,
    },
    null,
    2,
  )}\n`,
);

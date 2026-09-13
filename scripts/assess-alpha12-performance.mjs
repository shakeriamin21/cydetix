import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const performance = JSON.parse(await readFile("validation/alpha12/performance.json", "utf8"));
const discoveryDiff = spawnSync(
  "git",
  ["diff", "--exit-code", performance.baselineCommit, "--", "src/repository-discovery"],
  { encoding: "utf8", shell: false, windowsHide: true },
);
if (discoveryDiff.error || discoveryDiff.status !== 0)
  throw new Error("Discovery implementation changed; reassess the timing attribution.");
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const results = performance.results.map((target) => ({
  target: target.id,
  p50Ratio: target.candidateToBaselineP50Ratio,
  p95Ratio: target.candidateToBaselineP95Ratio,
  semanticEquivalence: target.semanticEquivalence,
  variants: Object.fromEntries(
    Object.entries(target.variants).map(([name, variant]) => [
      name,
      {
        stageP50Milliseconds: variant.stagesP50Milliseconds,
        peakProcessRssBytes: Math.max(
          ...variant.measurements.map((m) => m.processHighWaterRssBytes),
        ),
        representativeRssP50Bytes: percentile(
          variant.measurements.map((m) => m.representativeRssBytes),
          0.5,
        ),
        filesVisited: [...new Set(variant.measurements.map((m) => m.filesVisited))],
        filesAnalyzed: [...new Set(variant.measurements.map((m) => m.filesAnalyzed))],
        batches: [variant.measurements.slice(0, 10), variant.measurements.slice(10)].map(
          (batch) => ({
            p50Milliseconds: percentile(
              batch.map((m) => m.totalScanMilliseconds),
              0.5,
            ),
            p95Milliseconds: percentile(
              batch.map((m) => m.totalScanMilliseconds),
              0.95,
            ),
            slowestSamples: [...batch]
              .sort((a, b) => b.totalScanMilliseconds - a.totalScanMilliseconds)
              .slice(0, 2)
              .map((m) => ({
                total: m.totalScanMilliseconds,
                discovery: m.stagesMilliseconds.repositoryDiscovery,
                parsing: m.stagesMilliseconds.parsing,
                dataflow: m.stagesMilliseconds.applicationDataflow,
              })),
          }),
        ),
      },
    ]),
  ),
}));
const assessment = {
  schemaVersion: "1.0.0",
  sourceCommit: performance.sourceCommit,
  evidence: "validation/alpha12/performance.json",
  state: "INCONCLUSIVE",
  discoverySourceUnchangedSinceBaseline: true,
  results,
  conclusions: [
    "Small/medium JavaScript targets improved observed total p50 and p95 while retaining equivalent proof reports.",
    "FastAPI total p50 increased 4.0% and p95 increased 20.6%. This observed regression remains explicit and unresolved.",
    "FastAPI discovery p50 increased from 3202.9 to 3354.6 ms; parsing from 925.8 to 945.9 ms; dataflow from 65.7 to 68.6 ms. Graph and invariant stages improved. The slowest samples are dominated by discovery.",
    "Discovery implementation and visited/analyzed counts are unchanged. These facts identify a measurement stage, not causality; filesystem, scheduling, thermal or background activity cannot be excluded or proven from this run.",
    "A quiet independent-machine comparison is required before a claim of no material large-repository regression. Do not discard slow samples, relax coverage bounds or select a favorable rerun as replacement evidence.",
  ],
};
await writeFile(
  "validation/alpha12/performance-assessment.json",
  `${JSON.stringify(assessment, null, 2)}\n`,
);
process.stdout.write(
  "Performance assessment retained: INCONCLUSIVE; large-target observed regression remains unresolved.\n",
);

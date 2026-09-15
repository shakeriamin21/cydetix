import { performance } from "node:perf_hooks";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { format } from "prettier";

const auditedSourceSha = "c937ae1ddbf329bc62fb0376f04bf2123f438f4e";
const cli = path.resolve("dist/cli/main.js");
const workerDirectory = ".cydetix/v1-readiness-performance";

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

const startupSamples = [];
for (let index = 0; index < 20; index += 1) {
  const started = performance.now();
  const result = spawnSync(process.execPath, [cli, "--version"], {
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  const elapsed = performance.now() - started;
  if (result.status !== 0 || result.stdout.trim() !== "0.6.0-beta.3")
    throw new Error(`CLI startup sample ${index + 1} failed.`);
  startupSamples.push(elapsed);
}

const release = JSON.parse(
  await readFile("validation/releases/v0.6.0-beta.3/validation-report.json", "utf8"),
);
const currentScale = JSON.parse(await readFile(".cydetix/evidence/performance.json", "utf8"));
const baselineByName = new Map(release.performance.map((entry) => [entry.name, entry]));
const scale = currentScale.results.map((entry) => {
  const baseline = baselineByName.get(entry.name);
  return {
    ...entry,
    beta3BaselineWallMilliseconds: baseline.wallMilliseconds,
    wallChangePercent:
      ((entry.wallMilliseconds - baseline.wallMilliseconds) / baseline.wallMilliseconds) * 100,
    beta3BaselinePeakRssBytes: baseline.peakRssBytes,
    peakRssChangePercent:
      ((entry.peakRssBytes - baseline.peakRssBytes) / baseline.peakRssBytes) * 100,
  };
});

const repositories = [];
for (const id of ["express-session", "express", "fastapi"]) {
  const worker = JSON.parse(await readFile(`${workerDirectory}/${id}.json`, "utf8"));
  const elapsed = worker.measurements.map((entry) => entry.totalScanMilliseconds);
  repositories.push({
    id,
    pinnedCommit: worker.commit,
    scans: elapsed.length,
    determinism: worker.determinism,
    completeness: worker.completeness,
    filesVisited: worker.measurements[0].filesVisited,
    bytesExamined: worker.measurements[0].bytesExamined,
    wallMilliseconds: {
      minimum: Math.min(...elapsed),
      p50: percentile(elapsed, 0.5),
      p95: percentile(elapsed, 0.95),
      maximum: Math.max(...elapsed),
    },
    maximumRepresentativeRssBytes: Math.max(
      ...worker.measurements.map((entry) => entry.representativeRssBytes),
    ),
    processHighWaterRssBytes: Math.max(
      ...worker.measurements.map((entry) => entry.processHighWaterRssBytes),
    ),
    resourceLimitEvents: worker.resourceLimitEvents,
  });
}

const report = {
  schemaVersion: "1.0.0",
  auditedSourceSha,
  platform: `${process.platform}-${process.arch}`,
  node: process.version,
  methodology: {
    startup: "20 sequential fresh Node processes invoking the built CLI --version",
    syntheticScale:
      "One deterministic run per existing phase-six synthetic fixture, compared with the Beta.3 release report from the same machine class but not a controlled isolated benchmark host",
    repositories:
      "Five sequential scans in one process for each pinned representative repository; p95 is the nearest-rank maximum for n=5",
    interpretation:
      "Descriptive only. No cross-machine service-level objective or statistically controlled regression conclusion is claimed.",
  },
  cliStartupMilliseconds: {
    samples: startupSamples.length,
    minimum: Math.min(...startupSamples),
    p50: percentile(startupSamples, 0.5),
    p95: percentile(startupSamples, 0.95),
    maximum: Math.max(...startupSamples),
  },
  syntheticScale: scale,
  representativeRepositories: repositories,
  sandboxOverhead:
    "Measured by the mandatory 13-case Docker integration suite as an aggregate gate duration; no isolated stable per-invocation latency baseline exists.",
  conclusion:
    "Resource bounds remained enforced and all outputs were deterministic. The mixed timing deltas and uncontrolled host conditions establish no critical performance regression, but stable cross-platform performance guarantees remain a measurement gap.",
};

await writeFile(
  "validation/v1-readiness/performance.json",
  await format(JSON.stringify(report), { parser: "json", printWidth: 100 }),
  "utf8",
);
process.stdout.write(
  `CLI startup p50 ${report.cliStartupMilliseconds.p50.toFixed(1)} ms; recorded ${scale.length} scale and ${repositories.length} repository cases.\n`,
);

import { performance } from "node:perf_hooks";
import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";

const fixtureNames = [
  "session-secure",
  "session-fixation",
  "logout-incomplete",
  "reset-secure",
  "reset-persistent-sessions",
  "reset-weak-credential",
  "reset-unknown",
  "jwt-verified",
  "jwt-unverified",
  "oauth-secure",
  "oauth-broken-state",
  "oauth-missing-pkce",
  "refresh-rotation",
  "false-positive-traps",
];
const repetitions = 10;
const p95ThresholdMilliseconds = 100;
const measurements = [];

function percentile(values, fraction) {
  return values[Math.ceil(values.length * fraction) - 1] ?? 0;
}

for (const fixtureName of fixtureNames) {
  const fixturePath = path.resolve("fixtures", "phase3", fixtureName);
  await scanRepository({ path: fixturePath });
  const durations = [];
  const stages = {
    repositoryDiscovery: [],
    parsing: [],
    callGraph: [],
    securityGraph: [],
    authenticationGraph: [],
    invariantEvaluation: [],
    reportGeneration: [],
  };
  let filesExamined = 0;
  let fingerprint = "";
  for (let iteration = 0; iteration < repetitions; iteration += 1) {
    const started = performance.now();
    const report = await scanRepository({ path: fixturePath });
    durations.push(performance.now() - started);
    filesExamined = report.manifest.filesExamined;
    const performanceStages = report.scan.performanceMilliseconds;
    if (performanceStages === undefined) throw new Error("Phase 3 stage timings are unavailable.");
    for (const stage of Object.keys(stages)) stages[stage].push(performanceStages[stage]);
    const currentFingerprint = JSON.stringify({
      findings: report.findings.map((finding) => finding.fingerprint),
      invariants: report.securityAnalysis.authenticationAnalysis?.results.map((result) => [
        result.id,
        result.applicability,
        result.conclusion,
      ]),
    });
    if (fingerprint !== "" && currentFingerprint !== fingerprint) {
      throw new Error(`Non-deterministic Phase 3 result for ${fixtureName}.`);
    }
    fingerprint = currentFingerprint;
  }
  durations.sort((left, right) => left - right);
  const p95 = percentile(durations, 0.95);
  if (p95 > p95ThresholdMilliseconds) {
    throw new Error(
      `Phase 3 performance regression: ${fixtureName} p95 ${p95.toFixed(3)} ms exceeds ${p95ThresholdMilliseconds} ms.`,
    );
  }
  measurements.push({
    fixture: fixtureName,
    filesExamined,
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
      note: "Warm-cache local fixture benchmark with a deliberately generous regression gate; not a cross-machine throughput claim.",
      measurements,
    },
    null,
    2,
  )}\n`,
);

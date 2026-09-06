import { performance } from "node:perf_hooks";
import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";

const fixtureNames = [
  "idor-vulnerable",
  "idor-secure",
  "tenant-vulnerable",
  "tenant-secure",
  "false-positive-traps",
];
const repetitions = 10;
const measurements = [];

for (const fixtureName of fixtureNames) {
  const fixturePath = path.resolve("fixtures", "phase2", "express-prisma", fixtureName);
  await scanRepository({ path: fixturePath });
  const durations = [];
  let filesExamined = 0;
  let fingerprint = "";
  for (let iteration = 0; iteration < repetitions; iteration += 1) {
    const started = performance.now();
    const report = await scanRepository({ path: fixturePath });
    durations.push(performance.now() - started);
    filesExamined = report.manifest.filesExamined;
    const currentFingerprint = JSON.stringify({
      findings: report.findings.map((finding) => finding.fingerprint),
      proofs: report.securityAnalysis.authorizationProofs.map((proof) => [proof.id, proof.state]),
    });
    if (fingerprint !== "" && currentFingerprint !== fingerprint) {
      throw new Error(`Non-deterministic Phase 2 result for ${fixtureName}.`);
    }
    fingerprint = currentFingerprint;
  }
  durations.sort((left, right) => left - right);
  const median = durations[Math.floor(durations.length / 2)] ?? 0;
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1] ?? 0;
  measurements.push({
    fixture: fixtureName,
    filesExamined,
    repetitions,
    medianMilliseconds: Number(median.toFixed(3)),
    p95Milliseconds: Number(p95.toFixed(3)),
    minimumMilliseconds: Number((durations[0] ?? 0).toFixed(3)),
    maximumMilliseconds: Number((durations.at(-1) ?? 0).toFixed(3)),
  });
}

process.stdout.write(
  `${JSON.stringify(
    {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      measuredAt: new Date().toISOString(),
      note: "Warm-cache local fixture benchmark; not a cross-machine performance guarantee.",
      measurements,
    },
    null,
    2,
  )}\n`,
);

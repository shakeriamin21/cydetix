import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { runRemediation } from "../dist/remediation/fix.js";

const repetitions = 20;
const p95ThresholdMilliseconds = 300;
const planning = [];
const endToEnd = [];
const stages = {
  planning: [],
  transformation: [],
  fileTransaction: [],
  targetedRescan: [],
  verification: [],
};

// One untimed transaction removes module/JIT initialization from the small transactional sample.
// Twenty measured runs make nearest-rank p95 the second-slowest observation instead of the maximum.
await runRemediation({ path: path.resolve("fixtures", "autofix", "vulnerable"), dryRun: true });
const warmupDirectory = await mkdtemp(path.join(os.tmpdir(), "vibeshield-phase5-warmup-"));
try {
  const warmupTarget = path.join(warmupDirectory, "repo");
  await cp(path.resolve("fixtures", "autofix", "vulnerable"), warmupTarget, { recursive: true });
  const warmup = await runRemediation({
    path: warmupTarget,
    applySafe: true,
    nonInteractive: true,
  });
  if (warmup.transactions[0]?.finalState !== "APPLIED_VERIFIED")
    throw new Error("Phase 5 benchmark warmup remediation did not verify.");
} finally {
  await rm(warmupDirectory, { recursive: true, force: true });
}

for (let index = 0; index < repetitions; index += 1) {
  const planningStart = performance.now();
  await runRemediation({ path: path.resolve("fixtures", "autofix", "vulnerable"), dryRun: true });
  planning.push(performance.now() - planningStart);

  const temporary = await mkdtemp(path.join(os.tmpdir(), "vibeshield-phase5-benchmark-"));
  const target = path.join(temporary, "repo");
  try {
    await cp(path.resolve("fixtures", "autofix", "vulnerable"), target, { recursive: true });
    const started = performance.now();
    const report = await runRemediation({ path: target, applySafe: true, nonInteractive: true });
    endToEnd.push(performance.now() - started);
    const transaction = report.transactions[0];
    if (transaction?.finalState !== "APPLIED_VERIFIED")
      throw new Error("Phase 5 benchmark remediation did not verify.");
    for (const stage of Object.keys(stages))
      stages[stage].push(transaction.performanceMilliseconds[stage]);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function percentile(values, percentileValue) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentileValue) - 1)] ?? 0;
}

function rounded(value) {
  return Number(value.toFixed(3));
}

const p95 = percentile(endToEnd, 0.95);
const report = {
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  repetitions,
  p95ThresholdMilliseconds,
  externalCommandsIncluded: false,
  planning: {
    medianMilliseconds: rounded(percentile(planning, 0.5)),
    p95Milliseconds: rounded(percentile(planning, 0.95)),
  },
  verifiedTransaction: {
    medianMilliseconds: rounded(percentile(endToEnd, 0.5)),
    p95Milliseconds: rounded(p95),
    stageMedianMilliseconds: Object.fromEntries(
      Object.entries(stages).map(([stage, values]) => [stage, rounded(percentile(values, 0.5))]),
    ),
  },
  note: "One untimed warmup plus 20 temporary-fixture transactions; nearest-rank p95 is intentionally separate from read-only scan p95.",
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (p95 > p95ThresholdMilliseconds)
  throw new Error(
    `Phase 5 remediation p95 ${p95.toFixed(3)} ms exceeded ${p95ThresholdMilliseconds} ms.`,
  );

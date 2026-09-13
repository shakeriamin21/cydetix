import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const outputRoot = path.resolve(".cydetix/alpha12/closure/fastapi");
await mkdir(outputRoot, { recursive: true });
await mkdir("validation/alpha12/closure", { recursive: true });
const original = JSON.parse(await readFile("validation/alpha12/performance.json", "utf8"));
const prior = original.results.find((r) => r.id === "fastapi");
if (!prior) throw new Error("Missing original comparison");
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  windowsHide: true,
}).stdout.trim();
const plan = {
  schemaVersion: "1.0.0",
  sourceCommit,
  baselineCommit: original.baselineCommit,
  target: { repository: prior.repository, commit: prior.commit },
  rounds: ["ABBA", "BAAB", "ABBA", "BAAB"],
  samplesPerBatch: 10,
  samplesPerVersion: 80,
  warmupsPerProcess: 1,
  method:
    "Four prespecified rounds, four separate processes per round, A=immutable alpha.11 runtime, B=current alpha.12. Same pinned clean checkout, fixed clock/offline options and 4096 MiB old-space bound. No target execution. No other controlled scans/tests/host launches during measurement. All samples retained. Existing original run is retained separately, not replaced.",
  statistics:
    "Nearest-rank empirical p50/p95. Pair adjacent A/B processes within each round; resample the eight paired process clusters together 10000 times with a fixed PRNG seed to estimate a descriptive 95% percentile interval for the pooled p95 ratio. This preserves within-process sample dependence but is limited to eight clusters on one machine. Report each round; non-rejection is not equivalence. Compare the original 1.206 ratio with the interval; no post-hoc sample deletion or analysis optimization.",
  environment: {
    platform: process.platform,
    arch: process.arch,
    node: process.version,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    memoryBytes: os.totalmem(),
  },
};
await writeFile(
  "validation/alpha12/closure/fastapi-plan.json",
  `${JSON.stringify(plan, null, 2)}\n`,
);
const percentile = (values, p) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const summarize = (measurements) => ({
  samples: measurements.length,
  p50Milliseconds: percentile(
    measurements.map((m) => m.totalScanMilliseconds),
    0.5,
  ),
  p95Milliseconds: percentile(
    measurements.map((m) => m.totalScanMilliseconds),
    0.95,
  ),
  stagesP50Milliseconds: Object.fromEntries(
    Object.keys(measurements[0].stagesMilliseconds).map((key) => [
      key,
      percentile(
        measurements.map((m) => m.stagesMilliseconds[key]),
        0.5,
      ),
    ]),
  ),
});
const rounds = [];
const pairs = [];
for (const [roundIndex, order] of plan.rounds.entries()) {
  const batches = [];
  for (const [batchIndex, letter] of [...order].entries()) {
    const variant = letter === "A" ? "baseline" : "candidate";
    const output = path.join(
      outputRoot,
      `round-${roundIndex + 1}-${batchIndex + 1}-${variant}.json`,
    );
    const child = spawnSync(
      process.execPath,
      [
        "--max-old-space-size=4096",
        "scripts/run-alpha12-corpus.mjs",
        "--worker",
        "fastapi",
        variant === "baseline" ? ".cydetix/alpha12/baseline/dist" : "dist",
        output,
        "10",
      ],
      { encoding: "utf8", shell: false, windowsHide: true, timeout: 900_000, maxBuffer: 2_000_000 },
    );
    if (child.error || child.status !== 0)
      throw new Error(
        `Worker failed: round ${roundIndex + 1}, batch ${batchIndex + 1}: ${child.error?.code ?? child.status}`,
      );
    const batch = JSON.parse(await readFile(output, "utf8"));
    if (
      batch.determinism !== "PASSED" ||
      batch.normalizedReportSha256.some(
        (digest) => digest !== prior.variants[variant].normalizedReportSha256,
      )
    )
      throw new Error(
        "Proof report differs from original version-specific evidence; comparison halted.",
      );
    batches.push({
      variant,
      normalizedReportSha256: batch.normalizedReportSha256[0],
      measurements: batch.measurements,
    });
    process.stdout.write(
      `Round ${roundIndex + 1}/${plan.rounds.length}, ${variant} batch ${batchIndex + 1}: ${summarize(batch.measurements).p95Milliseconds.toFixed(1)} ms p95\n`,
    );
  }
  for (const index of [0, 2]) {
    const pair = batches.slice(index, index + 2);
    pairs.push({
      baseline: pair.find((b) => b.variant === "baseline").measurements,
      candidate: pair.find((b) => b.variant === "candidate").measurements,
    });
  }
  const baseline = summarize(
    batches.filter((b) => b.variant === "baseline").flatMap((b) => b.measurements),
  );
  const candidate = summarize(
    batches.filter((b) => b.variant === "candidate").flatMap((b) => b.measurements),
  );
  rounds.push({
    round: roundIndex + 1,
    order,
    baseline,
    candidate,
    p95Ratio: candidate.p95Milliseconds / baseline.p95Milliseconds,
    batches,
  });
  await writeFile(path.join(outputRoot, "progress.json"), `${JSON.stringify(rounds, null, 2)}\n`);
}
const baseline = summarize(pairs.flatMap((p) => p.baseline));
const candidate = summarize(pairs.flatMap((p) => p.candidate));
let randomState = 120926;
const random = () => {
  randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0;
  return randomState / 4294967296;
};
const ratios = [];
for (let iteration = 0; iteration < 10000; iteration++) {
  const sample = Array.from(
    { length: pairs.length },
    () => pairs[Math.floor(random() * pairs.length)],
  );
  ratios.push(
    percentile(
      sample.flatMap((p) => p.candidate.map((m) => m.totalScanMilliseconds)),
      0.95,
    ) /
      percentile(
        sample.flatMap((p) => p.baseline.map((m) => m.totalScanMilliseconds)),
        0.95,
      ),
  );
}
const interval = [percentile(ratios, 0.025), percentile(ratios, 0.975)];
const slowerRounds = rounds.filter((r) => r.p95Ratio > 1).length;
const result = {
  ...plan,
  baseline,
  candidate,
  p50Ratio: candidate.p50Milliseconds / baseline.p50Milliseconds,
  p95Ratio: candidate.p95Milliseconds / baseline.p95Milliseconds,
  originalP95Ratio: prior.candidateToBaselineP95Ratio,
  pairedClusterP95RatioInterval95: interval,
  slowerRounds,
  rounds,
  semanticEquivalenceToOriginalPerVersion: "PASSED",
  conclusion:
    interval[0] > 1 && slowerRounds >= 3
      ? "REPEATED_SLOWDOWN_OBSERVED"
      : interval[1] < prior.candidateToBaselineP95Ratio
        ? "ORIGINAL_MAGNITUDE_NOT_REPRODUCED"
        : "INCONCLUSIVE",
  limitations: [
    "One Windows host with warm OS cache; uncontrolled user/OS background activity and thermal state remain possible influences.",
    "Eight paired process clusters are a limited basis for tail inference. No cross-machine equivalence or arbitrary zero-regression guarantee is established.",
    "The repository remains TRUNCATED in both versions; all original proof reports, bounds and counters must match before timing is accepted.",
  ],
};
await writeFile(
  "validation/alpha12/closure/fastapi-repeated.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
process.stdout.write(
  `${result.conclusion}: pooled p95 ratio ${result.p95Ratio.toFixed(3)}, paired-cluster interval ${interval.map((v) => v.toFixed(3)).join("–")}\n`,
);

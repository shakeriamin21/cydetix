import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";

const root = path.resolve(".cydetix/alpha12/performance");
await mkdir(root, { recursive: true });
const sourceCommit = spawnSync("git", ["rev-parse", "HEAD"], {
  encoding: "utf8",
  shell: false,
  windowsHide: true,
}).stdout.trim();
const targets = [
  { id: "express-session", size: "small" },
  { id: "express", size: "medium" },
  { id: "fastapi", size: "large" },
];
const percentile = (values, fraction) =>
  [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const sha = (data) => createHash("sha256").update(data).digest("hex");
function differences(a, b, p = "", result = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return result;
  if (a && b && typeof a === "object" && typeof b === "object") {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)]))
      differences(a[key], b[key], p ? `${p}.${key}` : key, result);
  } else result.push({ path: p, baseline: a ?? null, candidate: b ?? null });
  return result;
}
const results = [];
for (const target of targets) {
  const batches = { baseline: [], candidate: [] };
  // Four isolated processes in ABBA order; one untimed warmup and ten samples each.
  for (const [index, variant] of ["baseline", "candidate", "candidate", "baseline"].entries()) {
    const output = path.join(root, `${target.id}-${variant}-${index}.json`);
    const runtime = variant === "baseline" ? ".cydetix/alpha12/baseline/dist" : "dist";
    const child = spawnSync(
      process.execPath,
      [
        "--max-old-space-size=4096",
        "scripts/run-alpha12-corpus.mjs",
        "--worker",
        target.id,
        runtime,
        output,
        "10",
      ],
      { encoding: "utf8", shell: false, windowsHide: true, timeout: 900_000, maxBuffer: 2_000_000 },
    );
    if (child.error || child.status !== 0)
      throw new Error(
        `Performance worker failed: ${target.id}/${variant}; ${child.error?.code ?? child.status}`,
      );
    process.stdout.write(
      `${target.id}/${variant} batch ${index + 1}: completed 10 measured scans\n`,
    );
    batches[variant].push(JSON.parse(await readFile(output, "utf8")));
  }
  const baseline = JSON.parse(
    await readFile(
      `.cydetix/alpha12/reports/${target.id}-${target.id}-baseline-0.json-normalized.json`,
      "utf8",
    ),
  );
  const candidate = JSON.parse(
    await readFile(
      `.cydetix/alpha12/reports/${target.id}-${target.id}-candidate-1.json-normalized.json`,
      "utf8",
    ),
  );
  const deltas = differences(baseline, candidate);
  // These are deterministic intentional metadata changes, NOT nondeterminism normalization.
  const metadata = (delta) =>
    [
      "tool.version",
      "reproducibility.cydetixVersion",
      "reproducibility.ruleCatalogueFingerprint",
      "securityAnalysis.supplyChainAnalysis.sbom.metadata.tools.components.0.version",
    ].includes(delta.path) ||
    (/^reproducibility.enabledRules.\d+.version$/u.test(delta.path) &&
      ["AS-PASSWORD-001", "AS-SECRET-001"].includes(
        baseline.reproducibility.enabledRules[Number(delta.path.split(".")[2])]?.id,
      ));
  const variants = {};
  for (const variant of ["baseline", "candidate"]) {
    const measurements = batches[variant].flatMap((batch) => batch.measurements);
    const digests = batches[variant].flatMap((batch) => batch.normalizedReportSha256);
    variants[variant] = {
      samples: measurements.length,
      determinism: new Set(digests).size === 1 ? "PASSED" : "FAILED",
      normalizedReportSha256: digests[0],
      p50Milliseconds: percentile(
        measurements.map((m) => m.totalScanMilliseconds),
        0.5,
      ),
      p95Milliseconds: percentile(
        measurements.map((m) => m.totalScanMilliseconds),
        0.95,
      ),
      stagesP50Milliseconds: Object.fromEntries(
        Object.keys(measurements[0].stagesMilliseconds).map((stage) => [
          stage,
          percentile(
            measurements.map((m) => m.stagesMilliseconds[stage]),
            0.5,
          ),
        ]),
      ),
      measurements,
    };
  }
  results.push({
    ...target,
    repository: batches.candidate[0].repository,
    commit: batches.candidate[0].commit,
    variants,
    candidateToBaselineP50Ratio:
      variants.candidate.p50Milliseconds / variants.baseline.p50Milliseconds,
    candidateToBaselineP95Ratio:
      variants.candidate.p95Milliseconds / variants.baseline.p95Milliseconds,
    semanticEquivalence: deltas.every(metadata) ? "PASSED" : "FAILED",
    intentionalMetadataDifferences: deltas.filter(metadata),
    unexpectedDifferences: deltas.filter((d) => !metadata(d)),
  });
}
const evidence = {
  schemaVersion: "1.0.0",
  sourceCommit,
  baselineCommit: "4e13b96cc3539e1b623a4c5a12f10a0954776253",
  candidateVersion: "0.6.0-alpha.12",
  environment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    cpu: os.cpus()[0]?.model,
    logicalCpuCount: os.cpus().length,
    totalMemoryBytes: os.totalmem(),
  },
  methodology:
    "Same immutable targets and fixed clock/offline options. ABBA process order: baseline/candidate/candidate/baseline, ten timed scans and one untimed warmup per process, twenty samples per version. No other agent-controlled scans/tests run concurrently. Nearest-rank empirical p50/p95; descriptive local timings, not confidence intervals or production SLAs. Discovery/parsing/dataflow stages retained, numeric engine bounds unchanged.",
  limitations: [
    "Warm OS cache and JIT; first-ever install/cold-disk latency not estimated.",
    "Representative RSS is sampled after each scan; maxRSS is the OS process high-water mark, shared across warmup and ten samples, not individual scan allocation.",
    "Three repository size classes are relative to this bounded analyzer; the large target exhausts repository AST coverage and is explicitly TRUNCATED in both versions.",
    "Two timed batches reduce order bias but do not provide independent machines or statistical significance.",
    "Files visited counts examined files plus skipped entries; it does not count every OS directory operation.",
  ],
  results,
};
await writeFile("validation/alpha12/performance.json", `${JSON.stringify(evidence, null, 2)}\n`);
process.stdout.write(`Performance evidence SHA-256 ${sha(JSON.stringify(evidence))}\n`);
if (
  results.some(
    (r) =>
      r.semanticEquivalence !== "PASSED" ||
      Object.values(r.variants).some((v) => v.determinism !== "PASSED"),
  )
)
  process.exitCode = 1;

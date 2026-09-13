import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const evidenceRoot = path.resolve("validation/alpha12");
const privateRoot = path.resolve(".cydetix/alpha12");
const manifest = JSON.parse(
  await readFile(path.join(evidenceRoot, "corpus-manifest.json"), "utf8"),
);
const locations = JSON.parse(await readFile(path.join(privateRoot, "corpus-paths.json"), "utf8"));
const sha = (value) => createHash("sha256").update(value).digest("hex");
const fixedNow = new Date("2026-09-13T00:00:00.000Z");
const nullDevice = process.platform === "win32" ? "NUL" : "/dev/null";

function git(root, args) {
  const result = spawnSync(
    "git",
    [
      "-C",
      root,
      "-c",
      `safe.directory=${root.replaceAll("\\", "/")}`,
      "-c",
      `core.hooksPath=${nullDevice}`,
      "--no-pager",
      ...args,
    ],
    {
      shell: false,
      windowsHide: true,
      encoding: "utf8",
      timeout: 20_000,
      maxBuffer: 2_000_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: nullDevice,
        GIT_TERMINAL_PROMPT: "0",
      },
    },
  );
  if (result.error || result.status !== 0)
    throw new Error(`Cannot verify corpus Git identity: ${result.error?.message ?? result.stderr}`);
  return result.stdout.trim();
}

if (process.argv[2] === "--worker") {
  const [id, runtime, output, repetitionText = "2"] = process.argv.slice(3);
  const target = manifest.targets.find((item) => item.id === id);
  if (!target) throw new Error("Unknown corpus target");
  const root = locations[id];
  const repetitions = Number(repetitionText);
  if (!Number.isInteger(repetitions) || repetitions < 2 || repetitions > 20)
    throw new Error("Invalid repetitions");
  if (
    git(root, ["rev-parse", "HEAD"]) !== target.commit ||
    git(root, ["status", "--porcelain", "--untracked-files=all"]) !== ""
  )
    throw new Error(`Pinned corpus is changed: ${id}`);
  const { scanRepository } = await import(
    pathToFileURL(path.resolve(runtime, "core/engine.js")).href
  );
  const { normalizeScanForDeterminism } = await import(
    pathToFileURL(path.resolve(runtime, "validation/determinism.js")).href
  );
  if (repetitions > 2) await scanRepository({ path: root, now: fixedNow, advisories: "offline" });
  const measurements = [];
  let first;
  const digests = [];
  for (let iteration = 0; iteration < repetitions; iteration++) {
    const started = performance.now();
    const report = await scanRepository({ path: root, now: fixedNow, advisories: "offline" });
    const duration = performance.now() - started;
    const normalized = normalizeScanForDeterminism(report);
    const digest = sha(JSON.stringify(normalized));
    digests.push(digest);
    const metrics = report.securityAnalysis.applicationDataflow?.metrics;
    const unknown = {
      applicationDataflow: report.securityAnalysis.applicationDataflow?.unknowns.length ?? 0,
      authorization: report.securityAnalysis.authorizationProofs.filter(
        (item) => item.state === "UNKNOWN",
      ).length,
      authentication: (report.securityAnalysis.authenticationAnalysis?.results ?? []).filter(
        (item) =>
          item.applicability === "UNKNOWN" ||
          (item.applicability === "APPLICABLE" && item.conclusion === "UNKNOWN"),
      ).length,
      findingProof: report.findings.filter((item) => item.proofState === "UNKNOWN").length,
    };
    measurements.push({
      totalScanMilliseconds: duration,
      stagesMilliseconds: report.scan.performanceMilliseconds,
      representativeRssBytes: process.memoryUsage().rss,
      processHighWaterRssBytes:
        process.resourceUsage().maxRSS > 0 ? process.resourceUsage().maxRSS * 1024 : null,
      filesVisited: report.manifest.filesExamined + report.manifest.skipped.length,
      filesExamined: report.manifest.filesExamined,
      skippedEntries: report.manifest.skipped.length,
      bytesExamined: report.manifest.bytesExamined,
      ...metrics,
      findings: report.findings.length,
      unknown,
    });
    if (!first) {
      first = report;
      await mkdir(path.join(privateRoot, "reports"), { recursive: true });
      await writeFile(
        path.join(privateRoot, "reports", `${id}-${path.basename(output)}-normalized.json`),
        JSON.stringify(normalized),
      );
    }
  }
  if (git(root, ["status", "--porcelain", "--untracked-files=all"]) !== "")
    throw new Error(`Corpus changed during scan: ${id}`);
  const analysis = first.securityAnalysis;
  const result = {
    ...target,
    version: first.tool.version,
    enabledRuleIds: first.coverage.enabledRuleIds,
    applicability:
      "Enabled rules are not all applicable. Framework detection, finding/UNKNOWN rule IDs and declared limitations describe the checked envelope.",
    detectedLanguages: first.manifest.languages,
    detectedFrameworks: first.manifest.frameworks,
    findingRuleIds: [...new Set(first.findings.map((item) => item.ruleId))],
    completeness: first.reproducibility.analysisCompleteness,
    determinism: new Set(digests).size === 1 ? "PASSED" : "FAILED",
    normalizedReportSha256: digests,
    sourceManifestSha256: sha(JSON.stringify(first.manifest.files)),
    measurements,
    findings: first.findings,
    suppressedFindings: first.suppressedFindings,
    unknowns: {
      applicationDataflow: analysis.applicationDataflow?.unknowns ?? [],
      authorization: analysis.authorizationProofs.filter((item) => item.state === "UNKNOWN"),
      authentication: (analysis.authenticationAnalysis?.results ?? []).filter(
        (item) =>
          item.applicability === "UNKNOWN" ||
          (item.applicability === "APPLICABLE" && item.conclusion === "UNKNOWN"),
      ),
    },
    resourceLimitEvents: {
      applicationDataflow: analysis.applicationDataflow?.metrics.truncationEvents ?? 0,
      traversal: first.manifest.skipped.filter((item) =>
        ["too_large", "depth_limit", "file_limit"].includes(item.reason),
      ),
    },
    engineCompleteness: first.coverage.analysisCompleteness,
    limitations: [
      ...new Set([
        ...first.coverage.limitations,
        ...first.authGraph.limitations,
        ...analysis.securityIr.limitations,
        ...(analysis.applicationDataflow?.limitations ?? []),
        ...(analysis.authenticationAnalysis?.limitations ?? []),
      ]),
    ],
    adjudication: {
      state: "PENDING_MANUAL_REVIEW",
      groundTruth: "INCOMPLETE",
      recall: null,
      accuracy: null,
    },
  };
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(
    `${id}: ${result.findings.length} findings; ${result.completeness}; ${result.determinism}\n`,
  );
} else {
  const results = [];
  const runtime = process.argv[2] ?? "dist";
  for (const target of manifest.targets) {
    const output = path.join(evidenceRoot, "corpus", `${target.id}.json`);
    const child = spawnSync(
      process.execPath,
      ["--max-old-space-size=4096", import.meta.filename, "--worker", target.id, runtime, output],
      { encoding: "utf8", shell: false, windowsHide: true, timeout: 300_000, maxBuffer: 2_000_000 },
    );
    if (child.error || child.status !== 0) {
      const failure = {
        ...target,
        state: "FAILED",
        error: child.error?.message ?? child.stderr,
        limitation: "Harness failed; no clean/secure conclusion or recall is inferred.",
        determinism: "NOT_ESTABLISHED",
      };
      await mkdir(path.dirname(output), { recursive: true });
      await writeFile(output, `${JSON.stringify(failure, null, 2)}\n`);
      results.push(failure);
      process.stdout.write(`${target.id}: FAILED\n`);
    } else {
      process.stdout.write(child.stdout);
      const evidence = JSON.parse(await readFile(output, "utf8"));
      results.push({
        id: target.id,
        repository: target.repository,
        commit: target.commit,
        state: "COMPLETED",
        determinism: evidence.determinism,
        evidence: path.relative(process.cwd(), output).replaceAll("\\", "/"),
        sha256: sha(await readFile(output)),
      });
    }
  }
  const summary = {
    schemaVersion: "1.0.0",
    sourceCommit: git(process.cwd(), ["rev-parse", "HEAD"]),
    manifestSha256: sha(await readFile(path.join(evidenceRoot, "corpus-manifest.json"))),
    normalization:
      "Only UUID, timestamps, stage durations and canonical root are normalized by normalizeScanForDeterminism. Findings, all proof engines, limits, fingerprints and suppression evidence are compared in full.",
    measurements:
      "Two fresh identical offline scans per target. No p50/p95 from two samples. RSS is process-wide observation; filesVisited counts discovered files plus skipped file/directory entries, not every OS directory operation.",
    targetExecution: false,
    results,
  };
  await writeFile(
    path.join(evidenceRoot, "corpus-results.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
  );
  if (results.some((item) => item.state !== "COMPLETED" || item.determinism !== "PASSED"))
    process.exitCode = 1;
}

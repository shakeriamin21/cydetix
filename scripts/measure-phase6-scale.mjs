import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { scanRepository } from "../dist/core/engine.js";

const benchmarkRoot = path.resolve(".cydetix", "benchmarks");
await mkdir(benchmarkRoot, { recursive: true });

async function measure(name, create) {
  const temporary = await mkdtemp(path.join(benchmarkRoot, `${name}-`));
  try {
    await create(temporary);
    let peakRss = process.memoryUsage().rss;
    const sampler = globalThis.setInterval(() => {
      peakRss = Math.max(peakRss, process.memoryUsage().rss);
    }, 10);
    const started = performance.now();
    const report = await scanRepository({ path: temporary, now: new Date("2026-01-01T00:00:00Z") });
    const wallMilliseconds = performance.now() - started;
    globalThis.clearInterval(sampler);
    return {
      name,
      wallMilliseconds,
      peakRssBytes: peakRss,
      files: report.manifest.filesExamined,
      filesPerSecond: report.manifest.filesExamined / (wallMilliseconds / 1000),
      graphNodes:
        report.securityAnalysis.securityIr.modules.length +
        report.securityAnalysis.securityIr.calls.length +
        report.authGraph.nodes.length,
      graphEdges: report.authGraph.edges.length,
      findings: report.findings.length,
    };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function sourceCorpus(root, count) {
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "scale-fixture", version: "1.0.0", type: "module" })}\n`,
  );
  for (let index = 0; index < count; index += 1) {
    const next = index + 1 < count ? `import { v as next } from './m${index + 1}.js';\n` : "";
    await writeFile(path.join(root, `m${index}.ts`), `${next}export const v = ${index};\n`);
  }
}

async function dependencyCorpus(root, count) {
  const packages = { "": { name: "dependency-scale", version: "1.0.0", dependencies: {} } };
  for (let index = 0; index < count; index += 1) {
    const name = `package-${index}`;
    packages[""].dependencies[name] = "1.0.0";
    packages[`node_modules/${name}`] = {
      version: "1.0.0",
      resolved: `https://registry.npmjs.org/${name}/-/${name}-1.0.0.tgz`,
      integrity: `sha512-${"A".repeat(64)}`,
    };
  }
  await writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "dependency-scale", version: "1.0.0", dependencies: packages[""].dependencies })}\n`,
  );
  await writeFile(
    path.join(root, "package-lock.json"),
    `${JSON.stringify({ name: "dependency-scale", version: "1.0.0", lockfileVersion: 3, packages })}\n`,
  );
}

async function workflowCorpus(root, count) {
  const workflows = path.join(root, ".github", "workflows");
  await mkdir(workflows, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    await writeFile(
      path.join(workflows, `ci-${index}.yml`),
      `name: ci-${index}\non: [push]\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n`,
    );
  }
}

const results = [];
for (const count of [100, 1000, 5000])
  results.push(await measure(`source-${count}`, (root) => sourceCorpus(root, count)));
results.push(await measure("dependencies-2500", (root) => dependencyCorpus(root, 2500)));
results.push(await measure("workflows-250", (root) => workflowCorpus(root, 250)));
const output = { version: "1.0.0", results };
const evidenceDirectory = path.resolve(".cydetix", "evidence");
await mkdir(evidenceDirectory, { recursive: true });
await writeFile(
  path.join(evidenceDirectory, "performance.json"),
  `${JSON.stringify(output, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);

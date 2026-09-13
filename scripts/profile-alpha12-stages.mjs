import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";
const runtime = process.argv[3] === "candidate" ? "../dist" : "../.cydetix/alpha12/baseline/dist";
const fromRuntime = (suffix) => import(new URL(`${runtime}/${suffix}.js`, import.meta.url));
const { createBoundary } = await fromRuntime("repository-discovery/boundary");
const { loadConfig } = await fromRuntime("repository-discovery/config");
const { traverseRepository } = await fromRuntime("repository-discovery/traverse");
const { parseSource, isParseFailure } = await fromRuntime("ast-analysis/parser");
const { buildSecurityIr } = await fromRuntime("call-graph/builder");
const { enrichSecurityFacts } = await fromRuntime("dataflow-analysis/security-facts");
const { buildAuthorizationProofs } = await fromRuntime("authorization-analysis/proof");

// Diagnostic only: times existing stages without modifying the preserved baseline runtime.
const locations = JSON.parse(await readFile(".cydetix/alpha12/corpus-paths.json", "utf8"));
const root = locations[process.argv[2]];
if (!root) throw new Error("Unknown diagnostic target");
let start = performance.now();
function elapsed(name) {
  process.stdout.write(`${name}: ${(performance.now() - start).toFixed(1)} ms\n`);
  start = performance.now();
}
const boundary = await createBoundary(root);
const traversal = await traverseRepository(boundary, await loadConfig(boundary));
elapsed(`traversal ${traversal.files.length} files`);
const parsed = new Map();
for (const file of traversal.files) {
  const result = parseSource(file);
  if (result && !isParseFailure(result)) parsed.set(file.relativePath, result);
}
elapsed("parsing");
const ir = buildSecurityIr(traversal.files, parsed);
elapsed(`call graph ${ir.symbols.length} symbols ${ir.calls.length} calls`);
const enriched = enrichSecurityFacts(ir, traversal.files, parsed);
elapsed(
  `security facts ${enriched.identities.length} identities ${enriched.evidence.length} evidence`,
);
const proofs = buildAuthorizationProofs(enriched);
elapsed(`authorization ${proofs.length} proofs`);

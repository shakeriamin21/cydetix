import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { createBoundary } from "../.cydetix/alpha12/baseline/dist/repository-discovery/boundary.js";
import { loadConfig } from "../.cydetix/alpha12/baseline/dist/repository-discovery/config.js";
import { traverseRepository } from "../.cydetix/alpha12/baseline/dist/repository-discovery/traverse.js";
import {
  parseSource,
  isParseFailure,
} from "../.cydetix/alpha12/baseline/dist/ast-analysis/parser.js";
import { buildSecurityIr } from "../.cydetix/alpha12/baseline/dist/call-graph/builder.js";
import { enrichSecurityFacts } from "../.cydetix/alpha12/baseline/dist/dataflow-analysis/security-facts.js";
import { buildAuthorizationProofs } from "../.cydetix/alpha12/baseline/dist/authorization-analysis/proof.js";

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

import { readFile, writeFile } from "node:fs/promises";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const report = await json("validation/alpha12/beta-readiness.json");
const local = await json("validation/alpha12/local-verification.json");
const corpus = await json("validation/alpha12/corpus-adjudication.json");
const performance = await json("validation/alpha12/performance-assessment.json");
const self = await json("validation/alpha12/self-scan.json");
const gitleaks = await json("validation/alpha12/gitleaks-review.json");
const seconds = (ms) => (ms / 1000).toFixed(3);
const mib = (bytes) => (bytes / 1024 / 1024).toFixed(1);
const performanceRows = report.performance.measurements
  .map(
    (m) =>
      `| ${m.target} (${m.size}) | ${seconds(m.baselineP50Milliseconds)} / ${seconds(m.baselineP95Milliseconds)} | ${seconds(m.candidateP50Milliseconds)} / ${seconds(m.candidateP95Milliseconds)} | ${m.semanticEquivalence} |`,
  )
  .join("\n");
const memoryRows = performance.results
  .map(
    (r) =>
      `| ${r.target} | ${mib(r.variants.baseline.representativeRssP50Bytes)} / ${mib(r.variants.baseline.peakProcessRssBytes)} | ${mib(r.variants.candidate.representativeRssP50Bytes)} / ${mib(r.variants.candidate.peakProcessRssBytes)} | ${r.variants.candidate.filesVisited.join(", ")} / ${r.variants.candidate.filesAnalyzed.join(", ")} |`,
  )
  .join("\n");
const gateRows = report.supplyChainGates
  .map(
    (g) =>
      `| ${g.id} | ${g.state} | ${g.sourceCommit ? `\`${g.sourceCommit.slice(0, 12)}\`` : "No alpha.12 hosted transaction"} |`,
  )
  .join("\n");
const localRows = local.gates
  .map((g) => `| ${g.id} | ${g.state} | [log](../../${g.publicLog}) |`)
  .join("\n");
const unknownTotal = Object.values(corpus.totals.unknown).reduce((a, b) => a + b, 0);
const text = `# Alpha.12 beta readiness

**Verdict: ${report.verdict}**

Alpha.12 development hardens the existing product and retains evidence for review. Beta.1 is not
yet justified: exact-commit hosted gates and live-host validation remain unrun, corpus review is
not independently human-validated, and the large-target performance regression is unresolved.
These are explicit blockers; local passing checks do not replace them.

Development version: \`${report.version}\`. Evidence assembly source: \`${report.sourceCommit}\`.
Individual invocation commits are recorded in the machine evidence. Later documentation/evidence
commits can change HEAD without changing the tested implementation; the development handoff gives
the final HEAD. The immutable alpha.11 commit is
\`${report.baselineCommit}\` and its annotated tag object is
\`${report.baselineTagObject}\`. Development validation checks their identity and the byte identity
of 18 historical evidence files. No release tag, GitHub release, npm publication, push or final
release metadata is part of this work.

## Changes and preserved authority

- Findings now explain observation, location, impact, proof, completeness, unknowns, reachability,
  confidence, remediation ceiling, verification and next action. Human summaries retain distinct
  findings at the same location. UNKNOWN counts now agree with detailed proof-instance counts.
  Offline advisory coverage and truncated analysis remain visible even with no actionable findings.
- \`status\` is a read-only alias of \`setup --status\`; \`explain\` defaults to readable text with
  explicit JSON available. Usage errors print once and distinguish malformed commands from scan
  failures. Complete JSON and SARIF evidence remains available behind the bounded terminal view.
- MCP enforces its existing strict argument schemas and bounds retained incomplete input frames.
  Wrong versions, wrong roots, malformed input and stale findings receive actionable errors.
- Corpus discoveries led to file-local parser-scope failure containment, bounded recursive identity
  propagation, explicit evidence/iteration exhaustion and conservative dependent proof handling.
  Repeated symbol/location/evidence work was removed without expanding the analysis envelope.
- Password-adjacent fast hashes and private-key headers remain observations with UNKNOWN proof
  unless their missing purpose/payload evidence is established. Both affected rules are version
  1.0.1; their fingerprints and ARCHITECTURAL ceiling are preserved.
- Added reproducible thirty-repository replay, controlled alpha.11 comparisons, public-contract
  inventory, conservative readiness schema and an explicit development validation path. Release
  validation and publication controls retain their stricter requirements.

No architecture redesign, new vulnerability family, LLM proof authority or new SAFE adapter was
introduced. The engine remains deterministic and authoritative. Proof states remain
PROVEN_SECURE, PROVEN_INSECURE, UNKNOWN and NOT_APPLICABLE. Confidence, reachability, completeness
and verification are independent. Neither absence of an insecure proof nor a zero exit status
establishes security. Remediation ceilings remain monotonic:

| Initial class | Permitted final class |
| --- | --- |
| SAFE | SAFE, REVIEW_REQUIRED, ARCHITECTURAL |
| REVIEW_REQUIRED | REVIEW_REQUIRED, ARCHITECTURAL |
| ARCHITECTURAL | ARCHITECTURAL |

SAFE remains only the existing exact false-HttpOnly transform. Its plan states preconditions and
independent verification. REVIEW_REQUIRED withholds changes because no independently verifiable
SAFE transform exists for that finding. ARCHITECTURAL requires broader design or incident context;
a deterministic local replacement cannot establish the needed property. Routine scans/explanations
do not run target code, lifecycle scripts, hooks, Makefiles or repository instructions. Corpus Git
acquisition and the explicitly authorized dependency/OSV validation are separate from routine scans.

## Corpus and framework envelope

Thirty immutable public repository SHAs expand the eleven-target alpha.11 Batch 2 corpus. All thirty
completed two identical offline scans with full normalized-report determinism PASSED. Durable
records retain repository identity, language/framework, applicable rules, findings, UNKNOWNs,
limitations, source-hashed adjudications, timings, memory and resource counters. Only explicitly
listed UUID/time/root/timing metadata is normalized. Findings, proof, completeness, fingerprints and
limits participate in comparison. See [the corpus report](ALPHA12_CORPUS.md),
[manifest](../../validation/alpha12/corpus-manifest.json),
[per-repository results](../../validation/alpha12/corpus-results.json) and
[adjudication](../../validation/alpha12/corpus-adjudication.json).

The supported envelope remains statically named relative ESM imports, literal Express routes,
direct/namespace calls, documented authentication APIs, flat Prisma selectors, and the existing
local Python/Flask source/control/sink patterns. Scanning Django, FastAPI, Starlette, Next.js or
Strapi source does not imply complete adapters for those frameworks. CommonJS controller/factory
composition, dynamic router composition, dependency injection, path aliases/barrels, arbitrary
template engines, encoded redirect policies and general Python cross-file propagation remain
unsupported or UNKNOWN. npm package-lock v2/v3 remains the resolved dependency ecosystem.

All 134 emitted observations have implementation-agent static review records; none is left without
a recorded disposition. This is not independent human adjudication or complete ground truth.
Three prior false insecure conclusions were reproduced twice with preserved alpha.11 and corrected:
Flask-Security SHA-1 breach lookup (one) and placeholder private-key headers (two). No unresolved
confirmed FP remains within that review. The correction retains 13 UNKNOWN findings: four hash
observations and nine private-key marker observations. Test-cookie configurations and test keys are
not described as demonstrated production compromises.

Supported-pattern FNs discovered: ${corpus.totals.supportedPatternFalseNegativesDiscovered}, only
within the explicitly named selective source reviews. This is not a corpus-wide zero-FN assertion.
The external request.query -> alias -> res.redirect flow in vulnerable-typescript provides a
supported redirect example. Its SQL-looking console output has no SQL sink. Cross-file Python SQL
and unsupported CommonJS application wiring are recorded as limitations rather than supported FNs
or true negatives. Ground truth is INCOMPLETE; recall and generic accuracy are deliberately null.

UNKNOWN totals are ${unknownTotal} overlapping proof instances: application dataflow
${corpus.totals.unknown.applicationDataflow}, authorization ${corpus.totals.unknown.authorization},
authentication ${corpus.totals.unknown.authentication}, finding proof ${corpus.totals.unknown.findingProof}.
The largest cause is 202 unresolved Express state-changing handlers. Other causes include Python
HTML transformation, ambient authentication not established, incomplete SameSite evidence and
unknown SQL controls. These counts are not unique vulnerabilities. Thirteen repositories are
TRUNCATED, including cases with zero emitted UNKNOWN instances; zero is not complete coverage.
Strapi parser-scope and recursive identity failures and earlier Juice Shop/Strapi timeout runs
remain development discoveries. Final Strapi scans completed in 91.45s and 104.08s with explicit
bounds evidence, rather than omitted targets or a clean-analysis claim.

## Performance and resource evidence

Twenty measured scans per version per size, one warmup per ten-scan process, in baseline/candidate/
candidate/baseline order. Windows x64, Node 24.15.0, Intel i5-10210U, approximately 8 GiB RAM. No
other agent-controlled scan/test ran during the comparison. Empirical nearest-rank p50/p95 describe
this warm-cache local run; they are not confidence intervals, cold-start estimates or service SLAs.

| Target | Alpha.11 p50 / p95 seconds | Alpha.12 p50 / p95 seconds | Proof report equivalence |
| --- | --- | --- | --- |
${performanceRows}

| Target | Alpha.11 representative / peak RSS MiB | Alpha.12 representative / peak RSS MiB | Candidate visited / analyzed files |
| --- | --- | --- | --- |
${memoryRows}

Full reports agree after explicitly accounted version/catalogue/explanation changes; security
differences are not normalized away. The FastAPI large target is TRUNCATED in both versions.
Facts, propagation iterations, AST nodes and truncation counts are retained per sample in
[performance.json](../../validation/alpha12/performance.json). RSS is sampled after a scan; peak
RSS is the OS high-water mark for its whole process including warmup, not per-scan allocation.

FastAPI p50 increased 4.0% and p95 increased 20.6%. Discovery p50 rose 3.203s to 3.355s; parsing
0.926s to 0.946s; dataflow 0.066s to 0.069s. Graph/invariant stages improved. The slowest samples
are dominated by discovery, whose source and file counts are unchanged. This localizes an observed
cost but does not establish causality or dismiss the regression. Performance is INCONCLUSIVE
pending a quiet independent-machine comparison; all slow samples are retained. See
[assessment](../../validation/alpha12/performance-assessment.json).

Existing application bounds remain 50,000 AST nodes/file, 200,000 repository AST nodes, 10,000 facts,
eight propagation iterations and 16 evidence steps. Identity propagation now explicitly uses
10,000 identities/eight iterations rather than a symbol-count-scaled loop. Exhaustion clears
incomplete trust and forces dependent authorization/tenant proofs UNKNOWN with TRUNCATED evidence.
Parser failures are file-local limitations. Copy limits remain 10,000 files/100,000,000 bytes;
verification limits remain 120s, 2,000,000 output bytes, 128 PIDs, 512 MiB and one CPU. Docker
verification is network-denied with read-only rootfs/capability restrictions. No analysis bound was
raised and no exhausted result was promoted to secure. Existing workspace-disk and OS/filesystem
isolation limitations still apply.

## CLI, reporting and agent integration

The first-use audit exercised bare cydetix, help, version, setup, status, scan, fix, missing/valid
explain, explicit JSON/SARIF, policy exits and failure paths in an isolated project with spaces.
See [CLI evidence](../../validation/alpha12/cli-audit.json). Tests compare one underlying finding
across terminal text, JSON, SARIF and MCP explanation. Default text limits five findings and three
UNKNOWN examples with explicit omitted counts; complete structured evidence remains intact.

Codex, Claude, Cursor, Gemini, Cline, Roo, Continue, Copilot, Goose, Windsurf and generic MCP each
have configuration, adapter and direct subprocess tests. Each adapter verifies its own host format
and launches the shared exact version/root-bound definition. Regression coverage includes wrong
runtime versions, hostile project text/lifecycle scripts/Makefiles, malformed requests, path escapes,
symlinks, stale fingerprints, dirty files, interrupted transactions and unavailable sandbox providers.
No host silently receives network, installation, elevation or mutation authority. Actual client UIs
were not driven: liveHost is NOT_RUN for all eleven. The session's installed alpha.6 MCP bound to
another root is excluded. See [integration evidence](../../validation/alpha12/agent-integrations.json).

Public MCP tools remain exactly cydetix_scan, cydetix_fix and cydetix_explain.

## Public contract review

The [classification document](ALPHA12_PUBLIC_CONTRACTS.md) and
[machine inventory](../../validation/alpha12/public-contracts.json) enumerate CLI commands/flags,
exit codes, 27 rules and their versions, 21 schemas, all state enums, JSON/SARIF, MCP arguments and
results, configuration, suppressions, fingerprints and release evidence. Stable candidates include
core structured commands/reports, rule identities/ceilings, independent state enums and root/version
binding. Human wording, diagnostic IR, host setup formats and release/readiness evidence are
experimental. Parser/builders/caches/module imports are internal. Existing does not mean stable.

Intentional corrections: explain defaults to text (use --format json for previous consumers);
strict advertised MCP arguments are now enforced; UNKNOWN counting separates reachability; password
and key-marker rule versions advance to 1.0.1 with conservative proof; optional identity-bound
evidence is additive. Compatibility tests lock current inventories/schemas and existing semantic
tests remain. Exit codes remain 0 success, 1 finding-policy failure, 2 usage, 3 scan failure,
4 verification failure, 5 SAFE applied, 6 policy withheld, 7 unavailable provider. These distinctions,
fingerprint anchors and optional proof fields require explicit migration review before beta changes.

## Local verification and supply chain

Full tests: **${report.tests.passed}/${report.tests.total} passed**, ${report.tests.failed} failed,
${report.tests.skipped} skipped. Docker: **${report.tests.sandboxPassed}/13 passed**,
${report.tests.sandboxSkipped} skipped. Baseline was 374/374 with 13 Docker passes. No prior test was
removed. The first final-suite attempt had four stale alpha.11 version assertions; these were
updated to the intentional development version and rerun. Resource/security assertions were not
relaxed. Detailed suites, commands, actual invocation commits and sanitized logs are retained in
[local verification](../../validation/alpha12/local-verification.json).

| Local check | Result | Evidence |
| --- | --- | --- |
${localRows}

| Supply-chain/control gate | Result | Invocation commit or scope |
| --- | --- | --- |
${gateRows}

Locked installation uses npm ci --ignore-scripts. Online OSV checks lockfile package identities,
not source content. CycloneDX and SARIF are validated separately from vulnerability proof. Independent
Gitleaks scans complete --all history using its pinned image with no repository ignore bypass:
${gitleaks.findings} findings match exact reviewed non-secret fingerprints, ${gitleaks.unreviewedFindings}
unreviewed. Deterministic reachable-history and public privacy audits remain separate gates.

Self-scan: ${self.state}, ${self.findings.length} active and ${self.suppressedFindings.length}
existing suppressed findings; overall completeness ${self.completeness}. This meets the configured
active-finding gate, not a proof of repository security. Existing suppressions and engine limitations
are visible in [self-scan evidence](../../validation/alpha12/self-scan.json), with corresponding
[SARIF](../../validation/alpha12/self-scan.sarif.json) and
[CycloneDX](../../validation/alpha12/cydetix.cdx.json).

Full-SHA Action pins, exact-commit hosted gates, protected release environment, OIDC-only Trusted
Publishing, checksum/provenance/SBOM-attestation steps remain in the unchanged release workflow.
Static validation does not prove external npm settings or a live protected-environment approval.
Local npm/plugin archives are test inputs only. No final release artifact set or attestation was
prepared. Historical alpha.11 hosted/publication evidence is preserved and is not reused as an
alpha.12 pass. The strict release verifier is intentionally not bypassed by development validation.

## Remaining beta blockers and decision

${report.blockers.map((b) => `- ${b}`).join("\n")}

The next review must evaluate these blockers against the bounded framework envelope, obtain exact
development-commit hosted results through a separately authorized workflow, and resolve or explicitly
accept the observed performance limitation. This document does not authorize that workflow or a
release. Final decision remains **${report.verdict}**.
`;
await writeFile("docs/security/ALPHA12_BETA_READINESS.md", text);
process.stdout.write("Wrote evidence-bound alpha.12 beta-readiness document.\n");

import { readFile, writeFile } from "node:fs/promises";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const report = await json("validation/alpha12/beta-readiness.json");
const local = await json("validation/alpha12/local-verification.json");
const corpus = await json("validation/alpha12/corpus-adjudication.json");
const performance = await json("validation/alpha12/performance-assessment.json");
const self = await json("validation/alpha12/self-scan.json");
const gitleaks = await json("validation/alpha12/gitleaks-review.json");
const closure = await json("validation/alpha12/closure/blocker-closure.json");
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

Alpha.12 blocker closure completed the independent fresh-context corpus review and corrected the
all-refs privacy audit. Beta.1 is not yet justified: exact-commit hosted gates remain unrun,
representative live-host coverage is partial, and repeated FastAPI tail measurements are
inconclusive. No optimization or security-engine change was made during blocker closure.

Development version: \`${report.version}\`. Evidence assembly source: \`${report.sourceCommit}\`.
Individual invocation commits are recorded in the machine evidence. Later documentation/evidence
commits can change HEAD without changing the tested implementation; the development handoff gives
the final HEAD. The immutable alpha.11 commit is
\`${report.baselineCommit}\` and its annotated tag object is
\`${report.baselineTagObject}\`. Development validation checks their identity and the byte identity
of 19 historical evidence files. No release tag, GitHub release, npm publication, push or final
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
- Complete-history Gitleaks review now rejects missing historical evidence after a reproduced Git
  ownership failure returned an empty report without scanning commits. Two existing acceptance
  tests were deliberately corrected to reject empty/subset history; a missing-one regression was
  added. Exact historical reviews remain unchanged.

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

All 134 emitted observations now have an independent fresh-context model review, with 81 reviewed
source files compared to pinned Git objects (72 exact bytes, nine CRLF-only differences, no
substantive differences). This is not human adjudication, third-party certification or complete ground truth.
Three prior false insecure conclusions were reproduced twice with preserved alpha.11 and corrected:
Flask-Security SHA-1 breach lookup (one) and placeholder private-key headers (two). The independent
review confirms those corrections and establishes no current false-insecure proof. One confirmed
lexical false-positive observation remains: FastAPI lab report_service.py:179 contains a narrative
string, not an executed hash. Its UNKNOWN state remains conservative, but hash-operation wording
overstates the observation. The machine confirmedFP count includes this one noise observation.
The 13 finding UNKNOWNs comprise four hash-like text observations and nine key markers. Test-cookie
settings and test keys are not demonstrated production compromises. Four evidence disagreements
were reconciled, including two incorrect truncation causes and ambiguous Flask sink wording. See
[independent review](ALPHA12_INDEPENDENT_CORPUS_REVIEW.md) and
[closure evidence](../../validation/alpha12/closure/blocker-closure.json).

Supported-pattern FNs discovered: ${corpus.totals.supportedPatternFalseNegativesDiscovered}, only
within the explicitly named selective source reviews. This is not a corpus-wide zero-FN assertion.
The external request.query -> alias -> res.redirect flow in vulnerable-typescript provides a
supported redirect example. Its SQL-looking console output has no SQL sink. Cross-file Python SQL
and unsupported CommonJS application wiring are recorded as limitations rather than supported FNs
or true negatives. Ground truth is INCOMPLETE; recall and generic accuracy are deliberately null.
The two independently examined extra omissions are unsupported implicit Flask HTML string returns
and JavaScript anonymous callback/closure propagation. Python XSS supports the enumerated explicit
HTML call sinks; the coverage table now states that existing boundary precisely. No detection
coverage was removed to obtain this classification, and no deferred omission candidate remains.

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

Every TRUNCATED repository has an observed resource trigger: ${closure.truncated.resourceTriggered}/13.
Overlapping trigger counts are identity iteration cap ${closure.truncated.triggerRepositoryCounts.identityIteration},
application bounds ${closure.truncated.triggerRepositoryCounts.applicationBounds}, and file-size skips
${closure.truncated.triggerRepositoryCounts.fileSize}. Eight repositories have resource triggers without
parser failure; five also have 149 failed supported-language files. None is TRUNCATED solely by
parser or framework limitations. All six application-bound targets exceed 200000 aggregate AST
nodes, but per-event subtype/location was not serialized, so no finer AST/fact/path split is claimed.
The independent report lists all 13 identities, triggers, skipped paths and co-occurring limitations.

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

The blocker-closure repeat used four prespecified ABBA/BAAB/ABBA/BAAB rounds, eight paired process
clusters, one warmup plus ten measured scans per process: 80 additional samples per version.
Both version-specific normalized proof reports match their original digests in every sample.
Repeated alpha.11 p50/p95: ${seconds(closure.fastapi.baseline.p50Milliseconds)}s /
${seconds(closure.fastapi.baseline.p95Milliseconds)}s; alpha.12:
${seconds(closure.fastapi.candidate.p50Milliseconds)}s /
${seconds(closure.fastapi.candidate.p95Milliseconds)}s. Pooled p95 ratio:
${closure.fastapi.p95Ratio.toFixed(3)}; fixed-seed paired-cluster bootstrap descriptive 95% interval:
${closure.fastapi.pairedClusterP95RatioInterval95.map((v) => v.toFixed(3)).join(" to ")}.
Alpha.12 p95 is slower in ${closure.fastapi.slowerRounds}/4 rounds. The original +20.6% change is
not consistently reproduced, but remains inside the interval; neither repeatable regression nor
non-inferiority is established. OS background load and thermal state remain uncontrolled on this
single host. All samples, individual rounds, stage timings and methodology are retained in
[repeated evidence](../../validation/alpha12/closure/fastapi-repeated.json). No analysis, bounds,
coverage or sandbox constraints were weakened to improve timing.

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
No host silently receives network, installation, elevation or mutation authority. The actual Codex
CLI 0.154.0 drove scan, explain and a rejected path escape against exact alpha.12; its noninteractive
approval policy withheld fix planning before the request reached MCP. The isolated fixture remained
byte-identical and hostile lifecycle/Makefile canaries were not executed. Host transcripts show no
non-MCP execution. An initial model-network sandbox failure was retained separately before the
explicitly approved network retry. Claude Code 2.1.197 initialized/listed MCP but returned Not logged
in before any security-tool call, so its live validation remains NOT_RUN. Actual graphical UIs and
live remediation transactions were not tested. The session-installed alpha.6 MCP is excluded.
See [integration evidence](../../validation/alpha12/agent-integrations.json).

| Client | Configuration / adapter / subprocess | Live host | Remaining scope |
| --- | --- | --- | --- |
| Codex | PASSED / PASSED / PASSED | LIVE_HOST_VALIDATED: scan, explain, boundary rejection | Fix plan BLOCKED by host approval policy; mutation NOT_RUN |
| Claude | PASSED / PASSED / PASSED | NOT_RUN: login unavailable | Initialization/listing only |
| Cursor, Gemini, Cline, Roo, Continue, Copilot, Goose, Windsurf, generic MCP | PASSED / PASSED / PASSED for each | NOT_RUN | No host session exercised |

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
not source content. CycloneDX and SARIF are validated separately from vulnerability proof.
SARIF gate hardening retains the exact OASIS Errata 01 draft-04 schema, fetched once with a pinned
SHA-256, a 20-second download timeout and a 131072-byte bound. The existing 210-second Multitool
timeout and six positive fixtures remain. A negative control exposed Multitool 5.7.0 reporting
schema errors with exit code zero; the gate now rejects reported errors as well as process failures,
and requires explicit errors for deliberately invalid schema and semantic controls. This changes
development validation only. It does not establish that a historical report was invalid, and no
historical evidence was rewritten. See [validation hardening](../../validation/alpha12/closure/sarif-validation-hardening.json)
and [retained verification attempts](../../validation/alpha12/closure/verification-attempts.json).
Independent
Gitleaks scans complete --all history using its pinned image with no repository ignore bypass:
${gitleaks.findings} findings match exact reviewed non-secret fingerprints, ${gitleaks.unreviewedFindings}
unreviewed. Deterministic reachable-history and public privacy audits remain separate gates.
The original 14 historical review entries remain byte-identical. Nine exact supplemental reviews
cover deterministic authentication-operation/proof IDs in the new SARIF evidence; their generator
and schema establish that these are analysis identifiers, not credentials. Supplemental reviews are
hash-bound to the historical manifest and checked with the same field/fingerprint/match-digest rules.
The all-refs author audit now ${closure.allRefs.state} across ${closure.allRefs.commitsReviewed}
commits. Its former email-hash deduplication hid eight additional commits: nine pre-existing remote
refs share the public Dependabot bot identity (author name dependabot[bot], author-email SHA-256
bd5a8d6c673b738d52b0ac42a110045f3f964b3ebfc1d60ea805af743b1dc0e6), with GitHub as committer.
The exact committer-email digest is retained in each supplemental policy entry. The original reported ref was
refs/remotes/origin/dependabot/npm_and_yarn/types/node-26.4.1 at
d8b3d5a10f4c878c413a388d6f640fa390cb4b5b. Every offending commit/ref is now explicitly reported.
[The supplemental policy](../../validation/history-author-allowances.json) approves only nine exact
immutable commit/author/committer tuples for public-email privacy. Future bot commits and differing
identities still fail; forbidden-content scanning remains enforced. GitHub's public API also binds
the original commit to Dependabot with verified GitHub signature status; the privacy policy itself
does not assert bot authentication or approve dependency changes. Fourteen targeted audit tests
pass, including future-commit rejection, tuple mismatch, malformed/overbroad policy rejection,
content scanning and multiple offending commits. No ref, author metadata, ancestry, historical
release tag or frozen publication approval list was changed.

The refreshed selfScan gate and preserved detailed snapshot both report ${self.state},
${self.findings.length} active and ${self.suppressedFindings.length} existing suppressed findings.
The detailed snapshot's overall completeness was ${self.completeness} at ${self.sourceCommit};
the refreshed gate records the active-finding outcome, not a new complete proof report. Passing
this gate is not proof of repository security. Existing suppressions and engine limitations
are visible in [the preserved self-scan snapshot](../../validation/alpha12/self-scan.json), with corresponding
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

GitHub's exact-commit query at ${closure.hosted.checkedCommit} reports
${closure.hosted.conclusion}, with ${closure.hosted.workflowRuns} workflow runs and
${closure.hosted.statuses} status contexts. A pending aggregate with zero contexts is not a running
check. Local gates do not substitute for CI, CodeQL or OpenSSF. Closure is limited to local evidence;
no push, dispatch, release preparation or publication was performed. The known lexical observation
noise, unsupported framework composition and incomplete corpus ground truth remain explicit
limitations alongside the blockers above. Final decision remains **${report.verdict}**.
`;
await writeFile("docs/security/ALPHA12_BETA_READINESS.md", text);
process.stdout.write("Wrote evidence-bound alpha.12 beta-readiness document.\n");

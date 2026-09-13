# Alpha.12 development plan and gap inventory

Development target: `0.6.0-alpha.12`. This is final alpha hardening, not release preparation.

## A12.1: verified starting point

The clean starting checkout is `4e13b96cc3539e1b623a4c5a12f10a0954776253`. The immutable alpha.11
annotated tag object is `e692f1e23d58157a209f511adb6180d3f489a80c`. Neither historical tags nor
historical release evidence may change. No publication, push, release tag, or GitHub release is part
of this work.

Architecture inspection covered discovery/boundary, parsing, Security IR, proof engines, bounded
application dataflow, finding construction, remediation assessment/transactions, reporting, CLI,
MCP, integration adapters, and validation scripts. The existing deterministic engine and transaction
boundaries remain authoritative. No vulnerability family or SAFE adapter is planned.

## Evidence-backed gaps

- Alpha.11 recorded 374 passing tests, including 13 mandatory Docker tests. These are historical
  results, not alpha.12 results. The daemon initially was unavailable in this development session.
- Eleven pinned external repositories were checked twice for Batch 2, with eight audited findings.
  Durable evidence needs whole-report determinism, all-rule coverage, more repositories, per-target
  resource/performance measurements, and explicit adjudication coverage. No external supported
  redirect true positive was established. Recall cannot be inferred from incomplete ground truth.
- Default human output hides locations and all but five headlines, deduplicates distinct evidence,
  labels low-confidence/unknown-reachability findings UNKNOWN, and ignores unresolved proof results
  when deciding whether coverage needs review. A no-finding scan can therefore look too reassuring.
- MCP explanations omit proof/completeness/remediation dimensions. Its declared strict argument
  schemas are not enforced at runtime: unknown keys and malformed argument containers are accepted.
- Existing version validation requires current release notes/publication metadata; release-report
  validation requires rewriting the historical report to match development. Development checks must
  be explicit without relaxing the release path.
- Existing benchmarks use local fixture thresholds and do not compare alpha.12 with the identical
  alpha.11 source on small/medium/large pinned real-world targets.
- Public schemas exist, but beta stability classifications and intentional correction notes need an
  explicit inventory and compatibility tests.
- Agent adapters and many hostile-path/transaction tests exist. Configuration, subprocess tests, and
  actual live hosts need separate evidence. The session's installed MCP runtime is alpha.6 and bound
  to another project; its results are excluded from alpha.12 evidence.

## Implementation sequence

1. **A12.1:** preserve a locally built alpha.11 runtime; capture baseline identity and this plan.
2. **A12.2:** show locations, separate proof/confidence/reachability/completeness, expose UNKNOWN
   causes and actionable next steps, and use the same explanation in CLI/MCP. Test changed output.
3. **A12.3:** enforce the existing MCP argument contract, exercise version/root binding and hostile
   inputs, and close demonstrated integration regression gaps without increasing authority.
4. **A12.4:** create a reproducible pinned corpus harness and substantially expand the eleven-target
   corpus. Retain normalized full-report digests, all findings/UNKNOWNs, limitations and reviews.
5. **A12.5:** compare alpha.11 and alpha.12 on identical pinned small/medium/large targets; record
   timings, resource counters, memory provenance, determinism and bounds. Optimize only if supported
   by measurements and conservative proof equivalence.
6. **A12.6:** classify external contracts, document deliberate corrections, introduce development
   version/evidence validation, and consistently set runtime/package/plugin version to alpha.12.
7. **A12.7:** run the complete local suite with mandatory sandbox coverage and all requested supply
   chain/package/integration/corpus gates. Produce schema-validated readiness evidence, explicit
   unresolved/hosted gates, and a conservative beta verdict. Stop at the development handoff.

## Likely files and regression risks

- `src/reporting/*`, `src/cli/main.ts`, `src/mcp/server.ts`, corresponding tests: human-output
  compatibility, terminal-control escaping, evidence omission, protocol error handling.
- `scripts/*alpha12*`, `src/validation/*`, `validation/alpha12/*`, `schemas/*`, validation tests:
  selective normalization, ground-truth overclaims, measurement interference, stale evidence.
- `package.json`, `package-lock.json`, `src/core/brand.ts`, plugin manifest, README/CHANGELOG:
  version drift or accidental release-gate relaxation. Historical evidence remains byte-identical.
- `docs/security/ALPHA12_*`, contract documentation: claims must identify their evidence scope.

Every behavior change receives regression coverage; no existing test is removed. Proof states,
monotonic remediation ceilings, offline analysis, bounds, and the exact three-tool MCP surface stay
unchanged. Hosted CI, live hosts and publication attestations are never inferred from local tests.

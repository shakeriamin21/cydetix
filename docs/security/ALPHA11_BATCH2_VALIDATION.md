# Alpha.11 Batch 2 validation

Date: 2026-09-12

Verdict: `ALPHA11_BATCH2_VALIDATED`

This report validates the unpublished `0.6.0-alpha.11` development candidate. It starts from the
immutable successful `v0.6.0-alpha.10` baseline and adds only Batch 2 application-security coverage.
No alpha.11 tag, npm publication, GitHub release, attestation, or dist-tag change was created.

## Exact candidate identity

- Validated implementation commit: `8c1a1b8e572ef96fcd0c4a25ca877fa96c0ce5e3`
- Baseline commit: `32e0e0e583bb26103d011563cfcfcd2ce0bc3c82`
- Baseline tag object: `45ceb19feba03825f4d456100326f0f5a4d88387`
- Development version: `0.6.0-alpha.11`
- Rule catalogue fingerprint: `33af95ab490dce9be35d0c5926e66be2b9e49496a8fa1404af0f70fd495a4bec`
- Control-registry fingerprint: `62e58cb6963efa2aaff3a59da0126d7f31ee3d1a0eeb83ac776a9ebc034ca3b1`

The generated validation report identifies this exact implementation commit and remains
`NOT_READY_FOR_PUBLIC_USE` because alpha.11 is a development mission without hosted release gates or
publication authorization.

## Rules admitted

| Rule                            | Version | Maturity     | CWE     | OWASP    | ASVS                     | Maximum remediation |
| ------------------------------- | ------- | ------------ | ------- | -------- | ------------------------ | ------------------- |
| Context-aware XSS `AS-XSS-001`  | `1.0.0` | `PRODUCTION` | CWE-79  | A05:2025 | 5.0.0-1.2.1, 5.0.0-1.2.3 | `REVIEW_REQUIRED`   |
| Open Redirect `AS-REDIRECT-001` | `1.0.0` | `PRODUCTION` | CWE-601 | A01:2025 | 5.0.0-3.7.2              | `REVIEW_REQUIRED`   |
| CSRF `AS-CSRF-001`              | `1.0.0` | `PRODUCTION` | CWE-352 | A01:2025 | 5.0.0-3.5.1              | `REVIEW_REQUIRED`   |

Each catalogue entry contains the complete admission record: stable identity and semantic version,
standards, invariant, prerequisite, impact, supported languages/frameworks/sources/sinks, typed
control semantics, propagation and reachability bounds, confidence and proof requirements,
remediation guidance and ceiling, positive/negative/adversarial fixtures, false-positive analysis,
explicit limitations, independent verification strategy, and user documentation. Admission rests on
the complete local and external evidence below, not test passage alone.

No Batch 2 SAFE adapter exists. The only SAFE adapter remains the pre-existing exact HttpOnly
false-to-true transformation. Runtime assessment can only preserve or lower catalogue authority.

## Supported frameworks and proof envelope

XSS supports structurally proven JavaScript/TypeScript Express HTML responses, explicitly typed
Fastify HTML responses, Next server-route sources, React host-element `dangerouslySetInnerHTML`, and
resolved browser DOM `innerHTML`; Python support covers Flask raw responses,
`render_template_string`, MarkupSafe escape bypass, and FastAPI HTML responses. It distinguishes
HTML body, quoted attribute, script, URL, and raw-HTML contexts. Ordinary React JSX interpolation
and Jinja value binding are safe framework construction. HTML escaping cannot prove script or URL
safety, and opaque custom sanitizers remain `UNKNOWN`.

Open Redirect supports provenance-backed Express, Fastify, Next.js, Flask, FastAPI, and Starlette
redirect APIs with supported request query, route, body, selected-header, and Next URL sources.
Fixed destinations, exact fixed maps, and narrowly modeled canonical exact host/origin membership
are controls. A slash-prefix test is insufficient because protocol-relative and parser behavior is
not resolved.

CSRF supports literal Express routes with express-session evidence and repository-local ESM
middleware/handler relationships, plus Flask/Flask-Login/Flask-WTF routes. An actionable proof
requires a POST, PUT, PATCH, or DELETE route, ambient cookie/session authentication, a structurally
resolved mutation or supported process/filesystem action, browser reachability within the admitted
model, and no route-bound token or exact-origin control. Bearer-only APIs are non-ambient. Session
establishment, read-only routes, custom middleware/authentication, and SameSite-only evidence do not
become findings; unresolved relevant cases are `UNKNOWN`.

Every actionable result retains source, ordered propagation, typed control evaluation, sink,
route/function context, `PROVEN_INSECURE`, completeness, high confidence, likely reachability,
remediation assessment, rule version, catalogue/configuration/suppression fingerprints, and an
evidence path bounded to 16 steps. Unsupported or incomplete analysis cannot produce
`PROVEN_SECURE`.

## Deterministic resource bounds

The existing engine bounds remain:

- 50,000 AST nodes per file;
- 200,000 repository AST nodes;
- 10,000 facts;
- 8 propagation iterations;
- 16 retained evidence steps.

Limit hits produce `TRUNCATED`; parse/semantic uncertainty produces `PARTIAL` or `UNKNOWN`. A
resource-bound regression emitted no Batch 2 proof. Malformed supported input failed closed with no
finding. Ten repeated warm-cache scans on Node v24.15.0/win32-x64 produced zero truncation events:

| Corpus                 | Files | AST nodes | Facts | Paths |       p95 |     Gate |
| ---------------------- | ----: | --------: | ----: | ----: | --------: | -------: |
| XSS positive           |    10 |       456 |    10 |    57 | 41.489 ms | 1,000 ms |
| Open Redirect positive |     8 |       313 |     4 |    41 | 28.453 ms | 1,000 ms |
| CSRF positive          |     6 |       321 |     1 |    22 | 19.843 ms | 1,000 ms |

## Fixture evidence

| Rule          | Positive | Secure negative | Adversarial | UNKNOWN |                     Admission tests |
| ------------- | -------: | --------------: | ----------: | ------: | ----------------------------------: |
| XSS           |       10 |               7 |           4 |       2 | 21 shared/specialized Batch 2 tests |
| Open Redirect |        8 |               6 |           3 |       2 | 21 shared/specialized Batch 2 tests |
| CSRF          |        4 |               8 |           1 |       3 | 21 shared/specialized Batch 2 tests |

The Batch 2 test file contains 21 tests across rule admission, context/control semantics,
deterministic paired scans, proof shape, remediation ceilings, Security IR cross-file middleware,
aggregate SameSite isolation, resource exhaustion, and malformed-input behavior. The existing Batch
1 suite retained all 25 tests.

An aggregate CSRF replay exposed and corrected cross-module SameSite evidence leakage: SameSite is
now bound to a preceding middleware call on the same receiver in the same module. The regression
proves unrelated files cannot inherit that evidence. The complete external corpus was replayed
afterward.

## External corpus validation

The manifest is `ALPHA11_BATCH2_EXTERNAL_CORPUS_MANIFEST.json`; detailed proof audits are in
`ALPHA11_BATCH2_EXTERNAL_CORPUS_VALIDATION.md`. Eleven repositories were pinned to immutable
commits: seven deliberately vulnerable and four ordinary/secure, with seven primarily
JavaScript/TypeScript and four primarily Python. Static source was scanned twice with a fixed clock.
No target code, tests, builds, package managers, lifecycle scripts, dependencies, or environment
files were executed or loaded.

| Rule                    | Confirmed TP | Confirmed FP | Expected UNKNOWN | Supported-pattern FN |
| ----------------------- | -----------: | -----------: | ---------------: | -------------------: |
| `AS-XSS-001@1.0.0`      |            6 |            0 |                6 |                    0 |
| `AS-REDIRECT-001@1.0.0` |            0 |            0 |                0 |                    0 |
| `AS-CSRF-001@1.0.0`     |            2 |            0 |              165 |                    0 |

All eight actionable findings were manually proof-audited for source, bounded path, sink, missing
control, route/context, proof state, completeness, confidence, and remediation ceiling. Paired
output was deterministic for all eleven repositories. Fastify and Juice Shop reached explicit
repository bounds and were `TRUNCATED`; no secure conclusion was drawn. Open Redirect patterns found
through CommonJS controllers, custom policy wrappers, or unsupported handler composition remain
outside the declared envelope and were not mislabeled as supported false negatives. The table is not
an accuracy percentage.

## Regression and trust gates

- Complete tests with the pinned sandbox image mandatory: 46 files, 374/374 passed, 0 skipped.
- Hardened Docker sandbox: 13/13 passed, including network denial, non-root/capability/rootfs/cgroup
  controls, PID/memory/tmpfs/output/timeout bounds, cleanup, rollback, entrypoint integrity, no
  local fallback, and output redaction.
- Schema catalogue: 20 versioned JSON schemas and 27 rules checked.
- SARIF 2.1.0: all phases passed, including Batch 2 code flows and redaction.
- CycloneDX 1.7, remediation, Agent Skill/plugin, 36/36 trigger corpus, and exact three-tool MCP
  contract: passed.
- Version, package allowlist, packed install, workflow security, public-repository, and license
  audits: passed.
- Package: 208 entries, 277,712 packed bytes, 1,760,537 unpacked bytes; source/declaration maps
  remain in the repository but are excluded from the runtime package.
- npm advisory gate: 0 vulnerabilities at the high threshold.
- Online OSV: 214 resolved package identities, checked with no findings; source was not transmitted.
- Self-scan: 0 active findings and 82 audited suppressions. New intentional fixture suppressions are
  bound to exact rule, file, and finding fingerprint with rationale, owner, and expiry.
- Complete-history Gitleaks: pinned 8.30.1 image/digest, network denied, read-only repository,
  non-root process, 36 commits scanned; 14/14 exact reviewed non-secret findings and 0 unreviewed.
  Report SHA-256 is `48231c063c22999b5539641d39b83afb0aed6d40a41d3d47b31b06d7cc7d1941`.
- Historical alpha.2 through alpha.10 tag objects and peeled commits matched origin. Alpha.10
  remains object `45ceb19feba03825f4d456100326f0f5a4d88387` at commit
  `32e0e0e583bb26103d011563cfcfcd2ce0bc3c82`.

## Remaining risks and explicit limitations

- Coverage is bounded structural analysis, not whole-program proof. Dynamic dispatch, generated
  code, arbitrary wrappers, stored-data provenance, unsupported template engines, and Python
  cross-function propagation remain outside the envelope.
- XSS does not prove CSS/event-handler contexts, CSP sufficiency, runtime sanitizer configuration,
  or browser-specific parser behavior.
- Redirect analysis does not prove encoded destinations, alternate schemes, IDN/user-info/backslash
  behavior, framework normalization, or an organization's intended destination set.
- CSRF does not prove custom middleware, deployment topology, method override, GraphQL semantics,
  all browser request modes, or SameSite sufficiency. Dynamic or unresolved auth/route relationships
  remain `UNKNOWN`.
- The external corpus had no actionable Open Redirect inside the admitted provenance envelope; local
  positive/adversarial fixtures establish rule behavior, while wider real-world framework
  composition remains an explicit validation risk rather than an inflated coverage claim.
- Exact hosted Windows/Linux/macOS CI, CodeQL, and OpenSSF were not requested or run for this
  unpublished local development mission. They remain future release-candidate gates.
- Container isolation depends on Docker Desktop/WSL2, the Linux kernel, runc/seccomp, and the
  reviewed immutable images; container escape resistance is not proven.

The Trust Assurance proof states, deterministic fingerprints/manifests, suppression auditability,
monotonic remediation ceilings, existing Batch 1 behavior, SAFE adapter authority, and exact MCP
surface remain intact.

Final verdict: `ALPHA11_BATCH2_VALIDATED`

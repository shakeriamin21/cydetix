# Changelog

All notable changes will be documented here. Versions follow Semantic Versioning for the CLI
package; report and rule schemas are versioned independently.

## [Unreleased]

## [1.0.0] - Unreleased

- Prepare the audited V1 product source and final readiness evidence as an untagged `1.0.0` release
  candidate. This preparation does not create `v1.0.0`, publish npm, create a GitHub release, or
  move npm `latest`.
- Preserve the `V1_READY_WITH_LIMITATIONS` scope: bounded analysis and corpus evidence,
  `UNKNOWN`/`TRUNCATED` honesty, npm-only dependency inventory, passive secret analysis, one narrow
  SAFE adapter, Docker/host trust assumptions, best-effort host integration, and no cross-host
  performance SLO.
- Extend the trusted tag-driven workflow's existing deterministic release-channel handling so
  alpha/beta packages remain GitHub prereleases on `alpha`/`beta`, while a stable semantic version
  uses npm `latest` and is finalized as a normal GitHub release. All exact-tag, exact-commit,
  history, secret, dependency, sandbox, artifact, provenance, SBOM, and draft-first gates remain
  fail closed.

## [0.6.0-beta.4] - Unreleased

- Stabilize Docker timeout cleanup with a two-phase create/start lifecycle, exact-name idempotent
  removal, bounded retry, state inspection, explicit cleanup failure, lifecycle regression tests,
  and repeated parallel leak checks. Sandbox isolation, resource limits, timeout enforcement, and
  execution authority are unchanged.
- Define a CLI-only JavaScript package boundary. The five documented stable JSON schema subpaths and
  package metadata are exported; the package root, internal `dist` modules, MCP implementation,
  internal TypeScript modules, and experimental schemas are not importable package APIs.
- Publish the V1 stable/experimental/internal compatibility policy, correct current Beta.3 public
  installation and release evidence, and record three exact immutable GitHub Dependabot author
  tuples without wildcard or content-policy exemptions.
- Advance development metadata from the immutable released Beta.3 to this untagged Beta.4
  stabilization candidate. This does not authorize a Beta.4 or V1 tag or publication and changes no
  detection rule, proof state, remediation class, SAFE authority, dependency, or MCP tool surface.

## [0.6.0-beta.3] - 2026-09-15

- Recover from the immutable failed Beta.2 release attempt by preparing the required versioned
  Beta.3 validation report through the existing two-commit source/evidence contract. No release
  validator, gate, product feature, security rule, proof semantic, remediation authority, sandbox
  control, dependency, or MCP public surface is changed.
- Record `v0.6.0-beta.2` as an immutable failed release attempt. Annotated tag object
  `a76d297b9749aff247ce980310441d1b058f1644` targets `e4dbda8b15620e99827b056b92b51ce68a4c60e8`;
  trusted release run `34937375125` passed its exact-commit hosted, history, dependency, test,
  Docker, package, and install gates before failing closed because
  `validation/releases/v0.6.0-beta.2/validation-report.json` was absent. Publication was skipped,
  with no npm package or public GitHub release created.

## [0.6.0-beta.2] - 2026-09-15

- Keep development validation fail-closed in release contexts while making its development-only
  positive tests inherit and respect the parent tag-release environment. The positive cases run as
  development checks only in a genuine development context; in a tag context they assert the
  expected rejection instead of deleting `CYDETIX_EXPECTED_TAG` and `GITHUB_REF_TYPE` and
  manufacturing a false development checkout.
- Preserve negative coverage proving that each release-context selector is rejected, unexpected or
  unrecorded historical tags fail integrity validation, and an unrecorded current-version tag is a
  conflict outside an explicit release context. `assessReleaseTagIntegrity` is unchanged.
- Record `v0.6.0-beta.1` as an immutable failed release attempt. Annotated tag object
  `4aecf7055d2184d18e1dc5da63dd3a6e65e0259d` targets `9ecc68f54127e5951d7c2a829cdd719b35779809`;
  trusted release run `34930694658` failed during `npm run verify` before publication, and created
  neither an authorized npm publication nor a public GitHub release.

## [0.6.0-beta.1] - 2026-09-14

- Begin the Beta.1 release line with the already validated Alpha.12 beta-readiness work and its
  documented limitations intact; this is not a claim of unrestricted readiness, complete coverage,
  corpus-wide recall, universal live-host validation, or proven FastAPI performance improvement.
- Version release-validation reports under `validation/releases/v<version>/` so immutable historical
  evidence and current candidate evidence no longer compete for one mutable path. Validate
  historical snapshots against their annotated tag objects and targets, resolve current evidence
  from the package version, reject stale or contradictory reports, and replace the obsolete zero-tag
  lineage assumption with explicit historical/current release-tag integrity checks.
- Derive the npm publication channel from the exact package semantic version (`alpha`, `beta`, or
  `latest`) and reject malformed or unsupported prerelease identifiers rather than accepting an
  arbitrary publication tag.
- Require exact-commit CodeQL success beside the existing CI and OpenSSF gates in the trusted
  tag-driven release workflow. No security rule, proof semantic, dependency, or remediation
  authority changes are introduced.
- Retry Microsoft SARIF Multitool once only after `ETIMEDOUT`, retaining the 210-second bound per
  attempt and a hard failure after the final timeout; semantic and other process failures are not
  retried or reclassified.

Existing limitations remain evidence: broader live-host coverage is incomplete, FastAPI
tail-performance evidence is `INCONCLUSIVE`, corpus ground truth is selective and incomplete, no
corpus-wide recall claim is permitted, one adjudicated lexical false-positive observation remains
recorded, and `UNKNOWN`/`TRUNCATED` semantics are unchanged.

The `v0.6.0-alpha.12` tag is an immutable failed release attempt. Annotated tag object
`c03f2a1e72af312266f68d66ac4183e0c00511bd` targets `5bf295f53f4ca912a79715fd1ea455a31b72a585`.
Trusted release run `34821381636` failed during the complete `npm run verify` suite because a
positive development-validation test inherited the tag environment. Publication was skipped: no
alpha.12 npm package or public GitHub release was created. This was release-test isolation failure,
not a newly discovered security-engine defect, and the tag must not be moved or reused.

## [0.6.0-alpha.12] - 2026-09-14

- Reject empty or incomplete complete-history Gitleaks reports when immutable reviewed findings are
  missing; retain all reviewed-fingerprint checks. This closes a reproduced Git ownership-error path
  that returned an empty report after scanning zero commits.
- Show finding locations, independent proof dimensions, useful UNKNOWN causes and remediation
  verification in human output; preserve distinct findings at a shared location.
- Enforce declared MCP argument types and unknown-key rejection; bound request buffering before a
  newline arrives. Keep exactly three public tools and unchanged remediation authority.
- Add `cydetix status`; make `explain` readable by default with `--format json` for structured rule
  output. These intentional presentation changes are documented in the alpha.12 contract inventory.
- Separate explicit development verification from unchanged release gates and preserve historical
  release evidence. Expand pinned all-rule corpus and beta-readiness evidence.
- Retain password-adjacent hashes and private-key headers as UNKNOWN when storage purpose or key
  material is unproven (`AS-PASSWORD-001@1.0.1`, `AS-SECRET-001@1.0.1`). Reproduce three corrected
  false insecure conclusions against the preserved alpha.11 runtime.
- Contain Babel scope failures per file; fail closed on application propagation/evidence exhaustion
  and recursive identity propagation. Keep the existing AST/application limits and enforce the same
  eight-iteration/10,000-fact policy for security identity propagation, with explicit counters.
- Cache source coordinates and index repeated evidence/symbol lookups without changing their order
  or content. Record 30 pinned deterministic scan pairs, scoped adjudication, comparative
  performance, eleven adapter launch checks and machine-readable beta-readiness gates.
- Align `ALPHA12_BETA_READY_WITH_LIMITATIONS` validation with documented non-blocking limitations:
  retain inconclusive performance and adjudicated false-positive evidence while continuing to reject
  unresolved hard blockers and missing mandatory gates.

## [0.6.0-alpha.11] - 2026-09-12

### Added

- Added production-admitted, bounded, proof-carrying rules for context-aware cross-site scripting
  (`AS-XSS-001`), open redirect (`AS-REDIRECT-001`), and architecture-aware CSRF (`AS-CSRF-001`)
  within explicitly documented JavaScript/TypeScript and Python framework envelopes.
- Added typed, provenance-bound HTML, redirect-policy, CSRF, origin, and non-ambient-auth controls,
  plus positive, negative, adversarial, UNKNOWN, determinism, malformed-input, and resource-bound
  admission fixtures.

### Changed

- Prepared the validated Batch 2 application-security coverage for publication as `0.6.0-alpha.11`.
  Batch 2 remediation ceilings remain `REVIEW_REQUIRED`; no new SAFE adapter or remediation
  authority is introduced.

## [0.6.0-alpha.10] - 2026-09-12

### Added

- Added exact, rationale-bearing review records for the 14 non-secret findings emitted by the
  independent Gitleaks complete-history scan, bound to detector, file, commit, location,
  fingerprint, and a SHA-256 digest of the redacted match evidence.
- Added fail-closed regression coverage proving that new findings, altered evidence, path-only
  matches, duplicate fingerprints, credential material, unsafe paths, and malformed reports remain
  rejected while exact reviewed findings and an empty report pass.

### Changed

- Prepared the already validated Trust Assurance and Batch 1 functionality for publication as
  `0.6.0-alpha.10`, without adding or changing security-rule behavior.
- Hardened the release Gitleaks boundary with the immutable 8.30.1 image, explicit built-in rule
  extension, complete-history log options, repository-ignore rejection, disabled inline
  suppressions, and exact workflow-security validation. Complete-history scanning remains mandatory
  and fails on every new or unreviewed finding.

The `v0.6.0-alpha.9` tag is an immutable failed release attempt. Its release-context validation,
exact hosted CI, OpenSSF verification, and deterministic history audit passed, but the trusted
release workflow stopped when the independent complete-history Gitleaks scan produced 14 findings
that had not yet been individually reviewed. Publication was skipped: no alpha.9 npm package, public
GitHub prerelease, release asset, provenance attestation, or CycloneDX SBOM attestation was created.
This was a release-governance failure, not a security-engine defect.

## [0.6.0-alpha.9] - 2026-09-12

### Added

- Added proof-carrying findings, explicit analysis completeness, reproducible scan manifests,
  deterministic catalogue/configuration/suppression fingerprints, and auditable suppression output.
- Added `cydetix rules` and `cydetix trust` machine-readable runtime truth commands.
- Added a bounded source-propagation-control-sink engine and high-confidence production rules for
  supported SQL injection, OS command injection, path traversal, and SSRF patterns in
  JavaScript/TypeScript and Python server contexts.
- Added positive, negative, adversarial, incomplete, determinism, and resource-exhaustion admission
  corpora for all four Batch 1 rules.

### Changed

- Prepared the validated Trust Assurance and Batch 1 functionality for publication as
  `0.6.0-alpha.9`, with no new security behavior beyond the alpha.8 candidate.
- Replaced static remediation authority with a monotonic `maxRemediationClass` ceiling and
  reason-coded runtime assessment. Batch 1 remains `REVIEW_REQUIRED`; the existing exact
  session-cookie adapter remains the only SAFE transformation.

The `v0.6.0-alpha.8` tag is an immutable failed release attempt. Its validation and external-corpus
gates succeeded, but the trusted release workflow stopped during release-context validation because
the changelog lacked an exact alpha.8 release heading. No alpha.8 npm package or public GitHub
prerelease was created, and the tag remains unchanged.

## [0.6.0-alpha.7] - 2026-09-09

### Added

- Added an explicit capability and compatibility-tier registry for eleven local integration targets,
  including verified Gemini CLI, Cline, Roo Code, Continue, and Goose stdio MCP adapters.
- Added automatic and all-host setup selectors, schema-backed `doctor --agents` diagnostics, and a
  zero-write `mcp-config --format json` escape hatch for additional local MCP clients.
- Expanded packed-artifact validation across discovery, setup, verification, MCP startup, strict CLI
  fallback, exact version surfaces, and an older conflicting global Cydetix launcher on `PATH`.

### Changed

- Made the local integration architecture protocol-first: the deterministic security engine remains
  host-independent while adapters contain configuration-only logic and optional skills remain
  behavior enhancements.
- Made MCP tool descriptions self-sufficient about offline read-only scans, trusted roots, explicit
  mutation intent, plan-first behavior, and SAFE / REVIEW_REQUIRED / ARCHITECTURAL policy.

## [0.6.0-alpha.6] - 2026-09-09

### Fixed

- Replaced runtime npm/npx MCP launchers with exact canonical Node and verified persistent Cydetix
  entrypoint execution, including fail-closed exact-version startup.
- Made the canonical MCP project root explicit and independent of the host process working directory
  while preserving path, symlink, mutation-intent, and remediation verification guards.
- Added strict non-interactive JSON/SARIF subprocess behavior that works without the npm global bin
  on PATH and suppresses recursive AI integration setup.
- Added persistent-runtime identity checks, agent doctor diagnostics, wrong-cwd/path-space/non-TTY
  regressions, package-manager spawn traps, and packed-artifact agent integration validation.

## [0.6.0-alpha.5] - 2026-09-07

### Changed

- Prepared `0.6.0-alpha.5` after the immutable alpha.4 release attempt completed every verification,
  artifact, checksum, provenance, SBOM-attestation, and draft-prerelease gate but stopped before npm
  publication.
- Made npm publication require exactly one downloaded `.tgz` and pass it as a quoted explicit local
  package spec beginning with `./`; this prevents npm from parsing `release-bundle/...` as GitHub
  shorthand while preserving public access, the `alpha` dist-tag, ignored lifecycle scripts, and
  direct OIDC publication.
- Extended workflow-security validation and regression coverage to reject the former ambiguous
  package spec, a missing `./`, directory publication, missing `--ignore-scripts`, or a weakened
  single-tarball check.

The `v0.6.0-alpha.4` tag remains fixed at `a7faa9ae085e553334e196a4cdbe5153fbceb1f9`. Release run
`34098600275` failed before registry authentication because npm interpreted the relative tarball
path as a GitHub repository shorthand. No alpha.4 npm publication occurred, and its draft GitHub
prerelease remained non-public because the finalization step was skipped.

## [0.6.0-alpha.4] - 2026-09-07

### Changed

- Prepared `0.6.0-alpha.4` after the immutable alpha.3 release attempt passed its preceding release
  gates but stopped at Git-history privacy enforcement before npm publication.
- Replaced the release privacy audit's implicit all-ref traversal with a required, explicit history
  scope. Release mode resolves the validated tag to one commit and audits that commit plus every
  reachable ancestor; the distinct `--all` mode remains available for repository-wide maintainer
  audits.
- Kept approved author-email fingerprint checks and forbidden path/name checks fail-closed, added
  deterministic scope evidence, and added regression repositories proving that unrelated branches
  are excluded until their commits become reachable through a merge.
- Made workflow-security validation require the tag-scoped privacy command while leaving the
  independent Gitleaks full-history scan unchanged.

The `v0.6.0-alpha.3` tag remains fixed at `7aa5007332b4f961b2812d739abd638fba6645cf`. Release run
`34093517082` failed before npm publication because the old all-ref privacy scope included an
unrelated Dependabot branch commit. The alpha.2 and alpha.3 attempts were not published and are not
reused by this candidate.

## [0.6.0-alpha.3] - 2026-09-06

### Changed

- Prepared `0.6.0-alpha.3` as the replacement candidate after the tagged alpha.2 GitHub Actions
  attempt stopped at `validate:publication-config` before npm publication.
- Synchronized the package, lockfile, CLI version, Codex plugin, pinned skill/MCP launchers, tests,
  release notes, and publication metadata at `0.6.0-alpha.3` without changing security-engine,
  remediation, sandbox, or reporting behavior.
- Recorded the maintainer-provided state that npm Trusted Publishing and GitHub private
  vulnerability reporting are configured, while retaining the fail-closed name-review gate.
- Restored hosted Unix Microsoft SARIF Multitool execution after script-disabled installs by
  validating the package-owned native launcher before restoring only its missing user execute bit;
  Multitool validation remains mandatory, bounded, non-shell, and fail-closed.
- Made the hosted sandbox use the same repository-qualified immutable Node digest it pulls, accepted
  only Docker's semantically equivalent empty-entrypoint and no-new-privileges inspect forms, and
  added control-specific redacted probe diagnostics and regression coverage. Composite Docker test
  cases now have outer harness deadlines that encompass their unchanged bounded operations.

The npm registry still contains only `cydetix@0.6.0-alpha.1`; alpha.2 was not published. Package
registration and release preparation do not establish product-name exclusivity or trademark
clearance, and neither is claimed.

## [0.6.0-alpha.2] - 2026-09-06

The tagged GitHub Actions attempt for this version failed at `validate:publication-config` before
npm publication. This version was not published to npm and is superseded by `0.6.0-alpha.3`.

### Changed

- Finalized the product/package/primary binary as the unscoped Cydetix / `cydetix` identity and
  removed all pre-release candidate aliases and config names.
- Added scan-first zero-config current-project UX, concise decision output, post-scan agent
  discovery with one consent prompt, explicit setup status/verify/remove modes, six adapters, and a
  version-pinned durable MCP model.
- Replaced four public specialist skills with one implicitly invocable `cydetix` skill and added
  `cydetix_scan`, `cydetix_fix`, and `cydetix_explain` as the minimal MCP surface.
- Added trigger-selection, setup/reconfiguration/removal, transactional config validation/rollback,
  MCP protocol, intent-boundary, and packed `npm exec`/global launcher regression coverage.
- Aligned package, CLI, plugin, pinned integration, repository, and release-candidate metadata at
  `0.6.0-alpha.2` after `cydetix@0.6.0-alpha.1` became available on npm.
- Made release-report validation fail closed when evidence names a different package version, and
  removed a stale tracked alpha.1 tarball from the public source tree.

The existing npm package does not establish product-name exclusivity or trademark clearance. No such
clearance is claimed.

## [0.6.0-alpha.1] - 2026-09-05

### Security analysis and authentication

- Versioned external corpus manifests, scanner/label separation, manual adjudication records,
  per-rule TP/FP/TN/FN accounting, denominator-aware metrics, and release validation schema.
- Pinned NodeGoat and BenchmarkPython validation results without bundling third-party source.
- Hostile-repository, provider/tool failure, deterministic output, mutation, and terminal-safety
  regression coverage.

### Supply chain

- npm lockfile inventory, explicit OSV states, redacted current/history secret analysis, GitHub
  Actions trust-boundary analysis, and CycloneDX 1.7 output.
- Exact package allowlist, size/lifecycle gates, clean tarball installation, current-tree audit,
  bounded history privacy audit, and independent Gitleaks release gate.

### Remediation and sandbox

- `NO_EXECUTION`, `LOCAL_EXPLICIT`, and immutable-image `CONTAINER_SANDBOX` verification runners
  with explicit capability/control states and no silent fallback.
- Remediation command verification now runs through an explicit provider and rolls back when a
  required container is unavailable or misconfigured.
- Docker verification requires daemon-reported Linux memory/PID/seccomp support and a real hardened
  launch with a locally present SHA-256 image. It applies network, environment, privilege, rootfs,
  resource, timeout, output, and ephemeral-workspace controls without local fallback.
- Thirteen empirical container tests cover the prior five capability gates plus effective controls,
  exhaustion, cleanup, entrypoint clearing, sandboxed SAFE remediation, rollback, redaction, and
  terminal safety.

### Agent integration

- Four portable Agent Skills, a skills-only Codex plugin package, and a composite GitHub Action with
  documented deterministic-engine versus agent-reasoning boundaries.

### Distribution and release security

- Six-case hosted Node/OS CI matrix plus a hosted Linux Docker sandbox job.
- Fail-closed release workflow with exact-commit CI/Scorecard checks, approved identity/private
  reporting gate, annotated tag validation, npm Trusted Publishing through OIDC, `alpha` dist-tag,
  GitHub build/SBOM attestations, draft-first prerelease handling, and full-SHA-pinned Actions.
- SHA-256 checksums, current-source release validation, release manifest, plugin archive, npm
  tarball, CycloneDX SBOM, and reproducible-input metadata generation.
- Public claims, limitations, privacy, incident response, issue forms, naming collision analysis,
  repository-configuration guidance, and release notes.

### Changed

- Optional tool probes and OSV normalization fail closed under hangs, huge/malformed output, partial
  results, transport failures, and sanitized host environments.
- Container workload cleanup retries exact-name removal and absence inspection within a bounded
  window, while still returning `SANDBOX_MISCONFIGURED` if cleanup cannot be proven.
- SAFE remediation dry-runs preserve zero-write planning semantics without returning the
  applied-but-unverified automation exit state.
- Release validation states distinguish executed pass/fail, capability skip, not applicable, and not
  checked rather than counting an unavailable check as passing.

## [0.5.0] - 2026-09-02

### Added

- Remediation report/transaction v1 with explicit lifecycle states, stable finding identity,
  repository/file baselines, unified diffs, verification results, before/after invariant proof,
  rollback state, residual risk, and separate performance timings.
- Conservative remediation planning for every classification, zero-write dry runs, a bounded
  `AS-SESSION-001` SAFE transformation, atomic writes, stale/dirty/path/symlink protection,
  hash-guarded rollback, deterministic rescan, and idempotency.
- Plan-only semantics for vulnerable dependencies, mutable GitHub Actions, secret incident response,
  authorization/authentication policy, and architectural supply-chain work.
- Explicit trusted-command authorization with non-shell bounded execution, `remediation show`, seven
  automation exit states, exact SAFE SARIF fixes, Phase 5 benchmark/validator, and adversarial
  Windows-compatible corpus.

### Changed

- `cydetix fix` now plans by default and reserves `APPLIED_VERIFIED` for changes whose parser,
  authorized verification, deterministic rescan, intended hashes, and security-invariant
  postcondition all pass.
- The `security-remediation` Agent Skill consumes deterministic classification and proof, cannot
  promote architectural work, and treats successful rollback as failed remediation.
- Product/plugin metadata advances to `0.5.0`; scan report schema v2 remains backward compatible,
  while remediation uses an independent public v1 schema.

## [0.4.0] - 2026-09-02

### Added

- Supply-chain IR and analysis v1 with npm lockfile inventory, Package URLs, dependency paths,
  lifecycle/source/integrity evidence, and explicit OSV provider states.
- Redacted structured secret analysis, explicit bounded Git-history mode, and incident remediation
  semantics that distinguish removal, rotation/revocation, and possible history work.
- GitHub Actions rules for immutable pinning, `write-all`, context-to-shell injection, and
  privileged `pull_request_target` trust chains.
- CycloneDX 1.7 SBOM generation, observable provenance controls, external-tool capability contract,
  supply-chain CLI commands, Phase 4 corpus/performance scripts, and `supply-chain-audit` skill.

### Changed

- Report schema v2 and Security IR v1 accept backward-compatible optional supply-chain data; SARIF
  includes dependency/workflow code flows and redacted secret evidence.
- Product/plugin metadata advances from the verified Phase 3 baseline to `0.4.0`.

## [0.3.0] - 2026-09-02

### Added

- Authentication analysis v1 and authentication graph v2 with source-evidenced session, password
  reset, JWT, refresh-token, OAuth, OIDC, MFA, privilege-change, and reauthentication operation
  types.
- Applicability-aware authentication invariants with `PROVEN_SECURE`, `PROVEN_INSECURE`, and
  `UNKNOWN` conclusions, confidence, standards relationship, correlation, and cross-file evidence.
- Eight authentication rules for session fixation, incomplete logout, reset-session persistence,
  reusable or weak reset credentials, decoded-but-unverified JWT identity, broken OAuth state, and
  applicable missing PKCE.
- Deep, exact-API adapters for express-session, Prisma authentication records, jsonwebtoken, jose,
  oauth4webapi, and Node CSPRNG reset generation.
- `cydetix graph <root> --auth` text/JSON diagnostics, richer `auth` output, authentication stage
  timings, raw corpus metrics, and a Phase 3 performance regression check.
- Multi-file secure, vulnerable, unknown, refresh-rotation, and false-positive authentication
  fixtures with SARIF code-flow and secret-redaction checks.

### Changed

- Report schema v2 accepts additive optional authentication analysis and stage timings; no report
  schema v3 was required.
- The `authentication-audit` Agent Skill now consumes deterministic invariant and graph output and
  separates engine proof from agent hypothesis.

## [0.2.0] - 2026-09-01

### Added

- Versioned Security IR and a bounded repository-local relative-ESM call graph.
- Narrow Express authentication, identity-trust propagation, and Prisma resource-query adapters.
- Tri-state object-authorization and tenant-isolation proofs with ordered evidence paths.
- `AS-AUTHZ-001` and `AS-TENANT-001` with vulnerable, secure, and false-positive-trap fixtures.
- Scan report schema v2, public Security IR/proof schemas, SARIF `codeFlows`, golden outputs, and a
  repeatable Phase 2 benchmark.

### Changed

- Authentication graph and coverage reporting now project Phase 2 security reasoning facts.
- Product and plugin version advanced to 0.2.0. See the
  [report migration note](docs/migrations/report-v1-to-v2.md).

## [0.1.0] - 2026-08-30

### Added

- Deterministic offline repository discovery and phase-one security engine.
- Five evidence-backed rules with TypeScript/Python vulnerable and secure fixtures.
- Versioned JSON schemas, terminal/JSON/SARIF reporting, accepted-risk workflows, and one verified
  SAFE HttpOnly fix.
- Focused Agent Skills, a Codex skills-only plugin, first-party GitHub Action, pinned CI, and
  attested release workflow.

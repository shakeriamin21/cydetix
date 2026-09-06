# Architecture

## Design goals

The engine must remain useful offline without an LLM, execute no target code during normal analysis,
produce evidence that can be independently reviewed, and expose data contracts that a future SDK or
Rust core can implement without inheriting CLI concerns.

The initial language decision is recorded in [ADR 0001](docs/adr/0001-core-language.md): TypeScript
provides a verified implementation now and strong Tier-1 AST integration; Rust remains the preferred
native-core direction once toolchain and feature-parity gates are met. The trust boundary is
recorded in [ADR 0002](docs/adr/0002-untrusted-repository-boundary.md).

## Scan pipeline

```text
user-selected root
  -> canonical repository boundary and data-only config
  -> bounded, no-follow traversal
  -> repository manifest and framework evidence
  -> Babel / Lezer parser adapters
  -> versioned Security IR and repository-local call graph
  -> Express identity trust and Prisma resource facts
  -> object-authorization and tenant-isolation proofs
  -> guaranteed authentication-library operations
  -> authentication invariant applicability and proof evaluation
  -> deterministic rule engine
  -> authentication graph v2 projection
  -> npm dependency / advisory / secret / GitHub Actions supply-chain analysis
  -> accepted-risk evaluation
  -> validated report schema
  -> text / JSON / SARIF projection
```

No stage above invokes a package manager, hook, compiler, interpreter, shell, Docker, test runner,
or network service. Optional external analyzers will be adapters with explicit availability and
provenance in coverage.

## Component boundaries

- `core` owns product-neutral scan inputs/outputs, schemas, errors, and orchestration.
- `repository-discovery` owns all filesystem interaction during scanning. Rules receive immutable
  source records and cannot open arbitrary paths.
- `ast-analysis` owns parser selection and parser failures. Parse failures become coverage
  limitations.
- `rule-engine` owns schema-validated metadata and finding construction. `rules` contains analyzers.
- `security-ir` owns the versioned repository-wide representation: modules, symbols, routes, calls,
  identities, resource operations, enforcement facts, evidence, and typed edges.
- `call-graph` builds a static graph from parsed target files. It resolves only repository-local,
  relative ESM imports and supported direct/namespace named calls. Unresolved and dynamic calls are
  retained explicitly.
- `framework-adapters` translates narrowly supported Express, Prisma, express-session, jsonwebtoken,
  jose, oauth4webapi, and Node cryptography APIs into semantic facts. Each adapter records only an
  API guarantee; it never assumes unspecified defaults.
- `dataflow-analysis` assigns identity provenance and trust, then propagates it positionally across
  resolved calls. Conflicting or unsupported provenance becomes `unknown`.
- `authorization-analysis` constructs route-to-resource paths and evaluates object and tenant
  invariants as `PROVEN`, `VIOLATED`, or `UNKNOWN`; it does not equate missing evidence with a
  vulnerability.
- `authentication-analysis` owns operation schema v1, invariant definitions, applicability,
  tri-state conclusions, confidence, standards relationships, and cross-file evidence paths.
- `auth-graph` models identities, credentials, endpoints, sessions, tokens, roles, permissions,
  tenants, policies, resources, protocol operations, validations, revocations, and unknown edges.
  Graph v2 projects only facts established by the manifest, Security IR, adapters, and proof
  engines; every emitted node carries source evidence.
- `remediation` consumes validated findings and owns versioned plans, stable finding identity,
  bounded transformations, filesystem transactions, rollback, verification, and invariant state
  transitions. It is separate from scan orchestration so a scan cannot mutate by construction.
- `reporting` projects one validated report into multiple formats and does not re-run analysis.
- `cli` handles arguments, filtering, presentation, and exit policy. Engine correctness does not
  depend on Commander.
- `integrations` detects supported AI hosts, inspects their current registration state, and applies
  host-specific configuration. It contains no scanner or remediation logic: CLI, MCP, skills,
  plugins, and host adapters all call the same deterministic core.

## Interface and agent-integration architecture

Cydetix follows one security engine, multiple interfaces. The default CLI and the three public MCP
tools call `scanRepository` and `runRemediation` directly. Agent skills and host rules select those
interfaces but cannot add findings, widen project paths, authorize commands, or reclassify
remediation.

The unified discovery layer reports installation separately from integration state: `configured`,
`not_configured`, `partially_configured`, `unsupported_version`, or `configuration_inaccessible`.
Adapters preserve unrelated JSON/TOML entries, refuse unsafe files, write atomically with a
restrictive transient backup, validate after replacement, and roll back if validation fails. Managed
skills/rules carry an ownership marker, and removal touches only managed entries. MCP launch
commands pin the exact package version used during setup.

Automatic discovery runs only after the default human scan. It may inspect hosts without consent,
but a real interactive terminal gets one permission question before external host configuration is
changed. CI, MCP, pipes, agent subprocesses, and other non-interactive execution never prompt or
auto-configure. Minimal project-local state records only disposition, version, time, and per-host
state; it contains no token, credential, source, or conversation content.

## Stable data contracts

Public JSON Schemas are generated in `schemas/`; the rule catalogue is generated in
`rules/catalogue.json`. The scan report remains v2.0.0. The repository manifest, rule schema,
Security IR, authorization-proof schema, and authentication-analysis schema are independently
versioned at v1.0.0; the authentication graph is v2.0.0. Phase 3 adds the authentication analysis
and performance stages as optional report-v2 fields, preserving Phase 2 document validity. See the
[Phase 3 additive-fields note](docs/migrations/report-v2-phase3-additions.md).

Supply-chain analysis v1 remains an optional backward-compatible report-v2 section. Remediation is a
separate v1 report rather than an incompatible scan-report version: it contains portable repository
identity, candidates, file baselines, transactions, verification results, finding state transitions,
residual risk, and timings. See the
[remediation report note](docs/migrations/remediation-report-v1.md).

Finding fingerprints are stable hashes of the rule identity, normalized path, and detector-specific
evidence anchor. They support exact baselines and SARIF partial fingerprints but are not secret
values.

## Rule execution

Rules declare metadata before execution. File rules receive an `AnalysisContext` containing one
bounded source file and, where supported, a parsed tree. Repository rules receive immutable files,
the validated Security IR, and validated authorization proofs. A finding cannot be emitted without
source location and concrete evidence. Cross-file findings also include an ordered evidence path.
Severity, confidence, and reachability remain separate. Rule precision is tested against
deliberately vulnerable, secure, and false-positive-trap counterparts.

## Phase 2 authorization proof strategy

The call graph begins at a literal Express route and follows statically resolved calls until it
reaches a supported Prisma resource operation. Identity facts originate from request fields,
literals, or authenticated request state proven by middleware evidence. Argument-to-parameter
propagation records provenance through the path.

An object proof is `PROVEN` when the supported selector consumes trusted authenticated subject
identity. It is `VIOLATED` only when an attacker-selected object identifier reaches a supported
single-object read/update/delete, trusted subject identity reaches the terminal resource function,
and the selector omits the subject constraint. Tenant proofs use the equivalent invariant for
trusted authenticated tenant scope. All other cases are `UNKNOWN`.

Path exploration and proof production are each capped at 10,000 states/items. Unsupported import,
dispatch, middleware, data-flow, query, or policy shapes remain explicit limitations. The analyzer
never resolves imports by executing repository code.

## Phase 3 authentication proof strategy

Authentication adapters recognize exact library and persistence operations and attach them to
literal Express routes through the bounded relative-ESM call graph. Route-local derived operations
are created only when backed by those adapter facts. An invariant is evaluated in two stages:
applicability first, then secure/insecure proof. Missing behavior, unsupported providers, and
application-specific issuer/audience expectations produce `UNKNOWN`, not a finding.

The currently proven lifecycles are session rotation after credential verification, authoritative
logout revocation, reset-credential protection and consumption, reset handling of existing sessions,
JWT verification before identity acceptance, refresh-token record rotation, OAuth state binding, and
PKCE for proven public clients. JWT claims remain untrusted after decode-only APIs. Issuer and
audience are proven secure only when supplied explicitly to supported verification APIs; their
absence remains `UNKNOWN` unless the expected trust boundary can be established.

Every authentication finding is correlated by invariant and lifecycle anchor, redacts credential
material, and reuses the ordered proof path for SARIF `codeFlows`. Evaluation and path search retain
the 10,000-state bounds. OAuth security requirements use RFC 9700 / BCP 240 and RFC 7636; the OAuth
2.1 Internet-Draft is documented but not normative.

## Phase 4 supply-chain domain

Phase 4 extends Security IR v1 with an optional `supplyChain` domain and adds a sibling versioned
`SupplyChainAnalysis` projection to report schema v2. The addition preserves every Phase 1-3 field.
Its normalized path is:

```text
bounded repository files
  -> package.json/package-lock.json data parser
  -> npm components + purls + dependency paths
  -> optional explicit advisory provider
  -> redacted working-tree/history secret model
  -> GitHub Actions YAML adapter
  -> findings + control states + CycloneDX 1.7
```

`package-lock.json` is authoritative for resolved versions. Declared ranges without a supported
lockfile produce `PARTIAL`, not resolved-package findings. Dependency presence does not establish
function reachability, so SCA findings retain `reachability: unknown`.

The advisory interface separates transport from normalization. Ordinary scans select
`NOT_CHECKED_OFFLINE`; explicit online mode batches npm ecosystem/name/version tuples to OSV and
normalizes identifiers, aliases, fixed versions, severity strings, and references. Timeout, HTTP, or
validation failure becomes `PROVIDER_UNAVAILABLE`, never a checked-clean result.

Secret objects have no raw-value field. They store provider/type, evidence location, a redacted
preview, SHA-256 fingerprint, confidence, source/history state, passive-validation state, and
remediation semantics. History mode invokes Git with fixed argument arrays, disabled hooks and
prompts, bounded time/output, and no checkout. Only added patch lines are inspected.

The GitHub Actions adapter parses YAML as untrusted data. It records triggers, workflow/job
permissions, Actions and reusable workflows, pinning, checkout behavior, run steps, secret use, and
provenance evidence. Correlated findings require the complete supported trust-boundary pattern;
`pull_request_target` or a legitimate write permission alone is not a finding.

CycloneDX 1.7 is the canonical Phase 4 SBOM. Components and dependency relationships derive from
lockfile evidence and Package URLs; no install occurs. SPDX 3.0 is recognized as current but is not
implemented. Observable controls use `PROVEN`, `PARTIAL`, `UNKNOWN`, or `NOT_PRESENT`; no SLSA level
is inferred from repository evidence alone.

## Optional external-tool boundary

External tools share a contract with explicit capability status, bounded time/output, and non-shell
invocation. `doctor` may probe Gitleaks, OSV-Scanner, and Cosign versions. Ordinary scans do not
invoke them. Gitleaks result import and Cosign verification remain unsupported, and their absence
cannot break the core engine.

## Phase 5 remediation transaction

Planning and mutation are separate operations. `fix` scans and correlates candidates by stable
identity, records the repository/Git baseline and affected-file hashes, then produces preconditions,
transformations, unified diffs, remediation class, expected invariant, verification scope, rollback
strategy, and residual risk. `fix --dry-run` stops there and writes nothing. The `fix` command
itself is explicit source-remediation intent and may enter only the engine-classified SAFE
transaction.

The current SAFE adapter recognizes only parsed `AS-SESSION-001` BooleanLiterals that explicitly
disable HttpOnly. Review and architectural adapters produce `PLAN_ONLY` transformations for Action
pinning, dependency upgrades, secret incidents, authorization/authentication, and other semantic
work. They are never promoted by CLI flags or Agent Skills.

```text
validated finding
  -> versioned plan and stable finding identity
  -> repository / affected-file baseline
  -> exact whole-file and vulnerable-range preconditions
  -> canonical path, regular-file, symlink, size, dirty-file checks
  -> prepare all non-overlapping transformations in memory
  -> exclusive same-directory temporary file and flush
  -> final path identity/hash check and atomic replacement
  -> parser validation
  -> optional explicitly authorized non-shell commands
  -> deterministic rescan
  -> security invariant before/after proof
  -> APPLIED_VERIFIED or hash-guarded rollback
```

Before replacement, the engine rechecks canonical containment, `dev`/`ino` identity where exposed,
and the complete expected hash. It preserves unaffected bytes, line endings, final newline, and file
mode where the platform supports them. Rollback restores only Cydetix-written files whose current
hashes still equal the transaction's patched bytes; repository-wide Git reset/checkout/clean is
never used. Original bytes are held in memory only and are not placed in portable reports.

Finding correlation does not rely on line numbers alone. Stable identities include rule,
component/resource, invariant, path, and normalized evidence structure. Successful verification
requires the original weakness to be absent, affected-file hashes to match the intended output, and
the expected invariant to transition from `PROVEN_INSECURE` to `PROVEN_SECURE`. An absent
fingerprint alone is insufficient. Applying an already verified SAFE change produces no plan and no
source change.

Rules declare `FILE`, `MODULE`, `AUTH_FLOW`, `WORKFLOW`, `DEPENDENCY_GRAPH`, or `REPOSITORY`
verification scope. Phase 5 records that scope but conservatively performs a full repository rescan;
incremental invalidation is a Phase 6 optimization.

Cydetix never derives command authority from `package.json`, formatter config, Git hooks, filters,
workflow files, policy files, or repository prose. An operator may explicitly pass each trusted
command as a JSON argument array. Execution is non-shell, fixed-cwd, environment-stripped,
stdin-disabled, and timeout/output-bounded, and the report keeps a fingerprint instead of arguments
or output. This local provider is not a sandbox and does not prevent command network access. A
separate default-deny container provider is available through explicit Phase 6 selection; empirical
isolation proof remains capability-dependent.

## Phase 6 validation and verification boundaries

External validation is a sibling evaluator, not a scanner mode. A corpus manifest identifies an
immutable source revision and license. The harness verifies that revision, performs an ordinary
offline scan, and only then loads expected labels or manual adjudication. Results retain TP, FP, TN,
FN, UNKNOWN, UNSUPPORTED, NOT_APPLICABLE, duplicate, and needs-domain-context counts. Metrics carry
denominators and are withheld when labels are incomplete. No scanner component can read corpus
labels or special-case corpus identity.

Verification now depends on a versioned `VerificationRunner` contract:

```text
trusted user authorization
  -> structural executable + argument array + cwd + timeout + network policy
  -> NO_EXECUTION | LOCAL_EXPLICIT | CONTAINER_SANDBOX
  -> explicit capability and enabled controls
  -> bounded result without command output
  -> remediation postcondition rescan
  -> APPLIED_VERIFIED or hash-guarded rollback
```

`NO_EXECUTION` leaves commands inert. `LOCAL_EXPLICIT` preserves the Phase 5 non-shell, sanitized,
bounded behavior and reports `AVAILABLE_DEGRADED`; it does not claim filesystem, process, or network
isolation. `CONTAINER_SANDBOX` accepts only an immutable SHA-256 image already present in Docker. It
does not build a repository Dockerfile, pull an image, mount home/credentials/sockets, or fall back.
The runner copies bounded regular text files without following links into an ephemeral workspace,
then requests network-none, non-root, read-only rootfs, tmpfs, cap-drop-all, no-new-privileges,
runtime seccomp, memory-plus-swap/CPU/PID/time/output controls. Capability requires daemon-reported
Linux/memory/PID/seccomp support and a real hardened launch using the immutable image. The container
runtime remains separately trusted and its actual capability is reported.

Hostile repository tests keep parser failures structured, cap tool/provider output, sanitize
terminal controls, compare deterministic normalized output, exercise path/junction/symlink limits,
and prove repository scripts/prose remain data. Release tooling separately validates npm allowlist
and size, clean packed installation, portable skills/plugin archives, version identity, CycloneDX,
artifact hashes, and a schema-validated readiness artifact.

## Extension seams

- Add language parsers behind `ParsedSource` and `SourceLanguage`.
- Add framework semantics behind adapters that produce the same Security IR rather than embedding
  framework assumptions in report or CLI code.
- Add deterministic rules through `SecurityRule` and the versioned catalogue.
- Add Semgrep, Gitleaks result import, OSV-Scanner, CodeQL, Cosign verification, and SPDX output as
  optional adapters that normalize into the same finding/coverage model.
- Replace performance-sensitive discovery/analysis internals with a Rust library or process while
  preserving the versioned JSON contracts.
- Add an SDK as a thin wrapper around the core inputs and outputs, not around terminal text.

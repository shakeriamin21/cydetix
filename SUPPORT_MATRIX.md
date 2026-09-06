# Support matrix

Capability levels are cumulative only where the row says so: **Discovery** identifies a surface;
**Syntax** parses it; **Local rules** evaluate one file; **Cross-file** resolves supported evidence;
**Auth graph** evaluates lifecycle invariants; **Remediation** has a deterministic plan or adapter;
**External validation** has independent-source corpus evidence. Existing labels mean **Analyzed**
has executable detectors and internal positive/negative tests, **Detected** is evidence only,
**Limited** is the explicitly named subset, and **Roadmap** has no implemented analyzer. External
validation is never inferred from internal fixtures.

## Languages and frameworks

| Target                  | Discovery           | Syntax/AST                             | File rules                          | Cross-file semantics          |
| ----------------------- | ------------------- | -------------------------------------- | ----------------------------------- | ----------------------------- |
| JavaScript              | Analyzed            | Babel AST                              | Five Phase 1 rules where applicable | Limited Phase 2/3             |
| TypeScript/TSX          | Analyzed            | Babel AST                              | Five Phase 1 rules where applicable | Limited Phase 2/3             |
| Python                  | Analyzed            | Lezer syntax tree; exact rule patterns | Five Phase 1 rules where applicable | Roadmap                       |
| Express                 | Detected            | Babel AST                              | Applicable generic rules            | Analyzed, narrow scope        |
| Prisma                  | Detected as ORM     | Babel AST                              | Applicable generic rules            | Auth/resource records, narrow |
| Next.js, React          | Detected            | Babel AST                              | Applicable generic rules            | Roadmap                       |
| NestJS                  | Detected            | Babel AST                              | Applicable generic rules            | Roadmap                       |
| FastAPI                 | Detected            | Python syntax                          | Applicable generic rules            | Roadmap                       |
| Django                  | Detected            | Python syntax                          | Applicable generic rules            | Roadmap                       |
| Flask                   | Detected            | Python syntax                          | Applicable generic rules            | Roadmap                       |
| Go, Java, C#, Ruby, PHP | Extension seam only | None                                   | None                                | Roadmap                       |

Phase 3's analyzed Express scope is literal `app`/router method bindings using statically named
handlers and middleware. Authentication is trusted only when the bound middleware reads a request
credential, invokes a supported verification call (`jwt.verify`, `jwtVerify`, or `verifyToken`), and
assigns authenticated state to `req.auth` or `req.user`. A handler also bound to an unprotected
route does not inherit trust from a protected route.

The call graph resolves repository-local relative ESM imports, including TypeScript source behind
`.js` specifiers, and supported direct/namespace named calls. It does not resolve package imports,
CommonJS, TypeScript path aliases, re-export barrels, dependency injection, decorators, callbacks,
computed calls, or runtime router composition.

The Prisma adapter handles direct `prisma.<model>.<operation>` calls and flat literal `where`
selectors. It does not interpret nested logical expressions, relation filters, query-builder
variables, extensions/middleware, raw SQL, or authorization performed after fetching a resource.
Those cases remain `UNKNOWN`.

## Authentication adapters

| API or architecture               | Status           | Guaranteed evidence only                                                |
| --------------------------------- | ---------------- | ----------------------------------------------------------------------- |
| express-session                   | Analyzed, narrow | Identity binding, lookup, `regenerate`, and authoritative `destroy`     |
| Prisma session records            | Analyzed, narrow | Create, lookup, delete, account-bound delete-many, generation fields    |
| Prisma password-reset records     | Analyzed, narrow | Issue, expiry/unused predicates, consume, password mutation             |
| Prisma refresh-token records      | Analyzed, narrow | Issue, validate, rotate, and revoke persistence operations              |
| jsonwebtoken                      | Analyzed, narrow | `sign`, `verify`, decode-only, explicit issuer/audience/algorithms      |
| jose                              | Analyzed, narrow | `jwtVerify`, decode-only, remote JWK-set construction                   |
| oauth4webapi                      | Analyzed, narrow | Random state/verifier, S256 challenge, state check, code exchange       |
| Node `crypto.randomBytes`         | Analyzed, narrow | CSPRNG evidence inside a resolved persisted reset flow                  |
| External providers / other SDKs   | Detected/unknown | Coverage limitation; no vulnerability inferred from hidden behavior     |
| OIDC provider-internal validation | Infrastructure   | Graph operations exist; complete issuer/audience/nonce proof is limited |

## Analysis domains

| Domain                                       | Status                                                               |
| -------------------------------------------- | -------------------------------------------------------------------- |
| Working-tree bounded discovery               | Analyzed and tested                                                  |
| Security IR                                  | Versioned v1; modules through resource/enforcement facts             |
| Cross-file call graph                        | Limited relative-ESM JavaScript/TypeScript support                   |
| Identity trust propagation                   | Limited Express authentication and positional call propagation       |
| Authentication graph                         | Graph v2 operations, evidence, validation/revocation/unknown edges   |
| Authentication invariant model               | v1 applicability plus secure/insecure/unknown proofs                 |
| Object-level authorization / IDOR / BOLA     | `AS-AUTHZ-001`, analyzed for supported Express-to-Prisma paths       |
| Tenant isolation                             | `AS-TENANT-001`, analyzed for supported Express-to-Prisma paths      |
| Session-cookie explicit false flags          | Analyzed and tested                                                  |
| Fast password hashes                         | Analyzed and tested                                                  |
| Explicit JWT verification bypass             | Analyzed and tested                                                  |
| Credential-like literals/private-key headers | Analyzed, normalized and redacted; explicit bounded history mode     |
| Credentialed wildcard CORS                   | Analyzed and tested                                                  |
| Session rotation and logout revocation       | Cross-file proven secure/insecure for supported Express paths        |
| Password-reset credential lifecycle          | Cross-file CSPRNG/storage/expiry/single-use analysis                 |
| Password-reset active-session handling       | Secure/insecure/unknown distinction for supported architectures      |
| JWT trust and required claim evidence        | Verify versus decode; explicit issuer/audience proof                 |
| OAuth state and PKCE                         | Supported oauth4webapi code flows; client applicability first        |
| Refresh-token lifecycle                      | Secure proof for complete Prisma-backed rotation; otherwise unknown  |
| OIDC, MFA, reauthentication                  | Graph infrastructure or limited unknown coverage                     |
| npm dependency inventory                     | package.json + package-lock v2/v3; direct/transitive paths and purls |
| Advisory intelligence                        | OSV online opt-in; explicit offline/unavailable/checked states       |
| GitHub Actions                               | Pinning, write-all, shell injection, correlated pull_request_target  |
| SBOM                                         | CycloneDX 1.7 JSON from resolved lockfile evidence                   |
| PyPI, SPDX, IaC                              | Roadmap                                                              |
| Dynamic/runtime analysis                     | Ordinary scans never execute; explicit verification providers only   |
| External validation evaluator                | Versioned manifests/labels/counts; scanner-label separation          |
| Hostile repository validation                | Internal Windows corpus; Phase 6B Docker/WSL2 container probes       |

## Remediation and verification

| Capability                                  | Status                  | Evidence and limitations                                                   |
| ------------------------------------------- | ----------------------- | -------------------------------------------------------------------------- |
| Remediation report/transaction              | Analyzed v1             | Plans, baselines, changes, verification, transitions, state, residual risk |
| Default fix behavior                        | Plan only               | No repository write without explicit `--safe`                              |
| Zero-write dry run                          | Analyzed and tested     | Proposed unified diff plus verification plan; affected hashes unchanged    |
| `AS-SESSION-001` HttpOnly BooleanLiteral    | SAFE, JS/TS/Python      | Exact false-to-true range; parser and invariant rescan proof               |
| Mutable GitHub Action reference             | REVIEW_REQUIRED         | Plan only; no invented or implicit online SHA resolution                   |
| Vulnerable dependency                       | REVIEW_REQUIRED         | Fixed-version/lockfile plan; no package-manager or lockfile mutation       |
| Current-tree secret exposure                | PARTIAL/ARCHITECTURAL   | Rotation, revocation, history, and monitoring components remain explicit   |
| Authorization/tenant/auth protocol findings | ARCHITECTURAL/review    | No invented business policy or lifecycle semantics                         |
| Affected dirty file                         | Refused/review          | Unrelated dirty files are recorded and preserved                           |
| Stale finding                               | Refused                 | Whole-file and exact-range hashes require rescan                           |
| Atomic file write and rollback              | Analyzed and tested     | Same-directory replace; rollback only VibeShield-written current hashes    |
| No-execution provider                       | Default/fail closed     | Command remains inert                                                      |
| Local trusted verification command          | Explicit/degraded       | Non-shell, bounded, stripped environment; not a sandbox/network boundary   |
| Container verification provider             | Explicit/capability     | Immutable local image, ephemeral copy, network/privilege/resource controls |
| Container adversarial integration           | Validated Phase 6B host | 13 tests: former gates plus privilege/resource/remediation evidence        |
| Verification scope                          | Declared                | Current Phase 5 implementation performs correctness-first full rescan      |
| Remediation history                         | User-controlled report  | `remediation show`; no silent global persistence                           |
| SARIF fixes                                 | SAFE only               | Exact artifact replacements; no fixes for plan-only recommendations        |

Authorization proofs are `PROVEN`, `VIOLATED`, or `UNKNOWN`. `UNKNOWN` is a first-class result and
does not generate a vulnerability finding. `VIOLATED` requires the complete supported evidence chain
documented in [ARCHITECTURE.md](ARCHITECTURE.md).

## Outputs and platforms

Text, JSON report schema v2.0.0, and SARIF 2.1.0 are implemented. A separate remediation-report
schema v1.0.0 represents Phase 5 plans and transactions without breaking scan-report consumers. The
scan report embeds Security IR, authorization proofs, optional authentication analysis v1, and
optional supply-chain analysis v1; SARIF cross-file findings carry ordered `codeFlows`.
`vibeshield graph --auth` supports text and JSON. `fix` and `remediation show` support text/JSON;
SAFE edits can also project SARIF `fixes`. HTML is roadmap. Supported runtimes are Node.js 22.18+
within 22.x and 24.11+ within 24.x; CI configures both on GitHub-hosted Windows, macOS, and Linux.
The packed install was observed locally on Node 24/Windows. The six-case hosted matrix and a hosted
Linux sandbox job are configured but remain `NOT_RUN` until an approved GitHub repository executes
them; local equivalents are not counted as hosted passes. Native standalone binaries are roadmap.

## External validation maturity

| Surface / rule                              | Maturity                              | External evidence                                                         |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| `AS-CI-001` Action pinning                  | External-source implementation review | 6/6 adjudicated NodeGoat findings TP; recall unavailable                  |
| `AS-SECRET-001`                             | External-source context case          | One NodeGoat key requires domain context                                  |
| Python session/password rules               | Applicability reviewed                | BenchmarkPython adjacent cases excluded; no metric                        |
| Express/Prisma authorization/authentication | Validated internal                    | Secure/vulnerable/false-positive fixtures; no external label set          |
| SAFE `AS-SESSION-001` remediation           | Validated internal                    | Variations, stale, dirty, rollback, idempotency; no external app mutation |

## Supply-chain adapters

| Surface                | Status           | Evidence and limitations                                                     |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------- |
| npm package.json       | Analyzed         | Dependency groups and lifecycle-script names; commands are never executed    |
| npm package-lock v2/v3 | Analyzed         | Exact versions, integrity/source, direct/transitive edges and paths          |
| Package URL            | Analyzed         | Canonical npm purls connect inventory, advisories, findings, and SBOM        |
| OSV API                | Explicit online  | Batch package/version query plus advisory detail; network failures explicit  |
| Working-tree secrets   | Analyzed, narrow | Provider/context patterns; hashes, UUIDs, placeholders and lock SRI excluded |
| Git object history     | Explicit mode    | Added patch lines, bounded output/time, no checkout or hooks                 |
| Gitleaks               | Probe/foundation | Optional version capability only; result import is roadmap                   |
| GitHub Actions YAML    | Analyzed, narrow | External/local refs, permissions, trigger/checkout/run trust paths           |
| CycloneDX              | Analyzed         | Version 1.7 JSON with components and dependency relationships                |
| SPDX                   | Not implemented  | Current version tracked as 3.0; no output claim                              |
| SLSA/provenance        | Evidence only    | Observable controls; no SLSA level claim                                     |
| Sigstore/Cosign        | Probe/foundation | Optional capability probe; signing/verification not invoked                  |
| Python/PyPI            | Roadmap          | No dependency inventory or advisory query                                    |

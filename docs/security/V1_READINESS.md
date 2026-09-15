# Cydetix v1 readiness

## Decision

**V1_NOT_READY**

Cydetix Beta.3 has a strong fail-closed analysis model, a reproducible published package, credible
supply-chain controls, and a bounded interface that can become stable without adding product
features. It is not yet responsible to publish `1.0.0`. This audit established four narrow blockers:
one sandbox lifecycle defect and three compatibility/documentation defects.

The next phase should fix only those blockers and close the associated policy gaps. It should not
add rule families, broaden remediation authority, redesign the architecture, bump the package to
1.0.0, or create a stable tag.

## Audited identity

| Field                       | Exact value                                |
| --------------------------- | ------------------------------------------ |
| Source SHA audited          | `c937ae1ddbf329bc62fb0376f04bf2123f438f4e` |
| Version                     | `0.6.0-beta.3`                             |
| Annotated tag               | `v0.6.0-beta.3`                            |
| Annotated tag object        | `29203b647094604184bdd84386a1e7f23809ac28` |
| Tag target                  | `c937ae1ddbf329bc62fb0376f04bf2123f438f4e` |
| Trusted Release run         | `34947037844` — SUCCESS                    |
| Exact-SHA CI                | `34942830651` — SUCCESS                    |
| Exact-SHA CodeQL            | `34942830674` — SUCCESS                    |
| Exact-SHA OpenSSF Scorecard | `34942830646` — SUCCESS                    |

Remote readback also confirmed the immutable failed Beta.1 and Beta.2 tag objects/targets and the
successful Beta.3 object/target. No tag was created, deleted, moved, recreated, repointed, or
force-updated during this audit.

## Evidence map

| Evidence                                               | Purpose                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `validation/v1-readiness/contract-inventory.json`      | Machine-readable CLI, schema, state, rule, MCP, agent, package and configuration inventory |
| `validation/v1-readiness/limitations.json`             | Classified limitation inventory                                                            |
| `validation/v1-readiness/installation-matrix.json`     | Published-package and hosted OS/Node matrix                                                |
| `validation/v1-readiness/installation-edge-cases.json` | Executed packed-product hostile/path/permission cases                                      |
| `validation/v1-readiness/ux-audit.json`                | New-user workflow assessment                                                               |
| `validation/v1-readiness/corpus-review.json`           | Selective current corpus replay and historical adjudication binding                        |
| `validation/v1-readiness/performance.json`             | Current startup, scale, repository, memory and bounds measurements                         |
| `validation/v1-readiness/gitleaks.json`                | Fresh independent all-refs Gitleaks execution                                              |
| `validation/v1-readiness/governance.json`              | Security, supply-chain and release-governance results                                      |
| `validation/v1-readiness/readiness.json`               | Machine-readable decision, guarantees and minimal next phase                               |

The small scripts in the evidence directory reproduce inventories and measurements. They do not
modify the product, its package version, detection rules, proof semantics, remediation authority,
public MCP surface, workflows, or historical evidence.

## Public contract inventory

The generated inventory records 24 CLI entries, 21 JSON schemas, 27 rules, 11 agent adapters and
exactly three MCP tools. It includes `.requiredOption()` declarations; this corrects an
evidence-only defect in the old Alpha.12 inventory that omitted required `graph --auth` even though
implementation, help and tests exposed it.

### CLI and exit behavior

The public command set is:

`init`, `setup`, `status`, `scan`, `auth`, `graph`, `dependencies`, `secrets`, `supply-chain`,
`sbom`, `fix`, `mcp`, `mcp-config`, `verify`, `remediation`, `remediation show`, `explain`, `rules`,
`trust`, `standards`, `ci`, `doctor`, and `version`, plus the zero-command root behavior.

The root command scans the current directory with concise human output. Scans default to offline,
severity `info`, confidence `low`, and text format. A completed interactive scan exits 0 even when
it has findings; `ci` and `verify` exit 1 at their policy threshold. Other published exit categories
are usage 2, scan failure 3, verification failure 4, verified SAFE application 5, withheld mutation
6, and required-provider unavailability 7.

That distinction is suitable for v1 only if the stable command subset and the `scan` versus `ci`
behavior are explicitly guaranteed. Human wording should remain free to improve unless documented
otherwise.

### Structured reports, proof and remediation

The strongest stable candidates are the versioned scan, finding, rule and remediation schemas;
CycloneDX 1.7 output; and the SARIF 2.1.0 mapping. SARIF preserves Cydetix proof, confidence,
reachability, completeness and remediation properties, uses `cydetix/v1` partial fingerprints, emits
code flows when an evidence path exists, and emits fixes only for exact SAFE replacements.

Proof states remain exactly:

- `PROVEN_SECURE`
- `PROVEN_INSECURE`
- `UNKNOWN`
- `NOT_APPLICABLE`

`UNKNOWN` is not success or security. `COMPLETE` applies only to the declared engine/envelope; input
or resource constraints surface `PARTIAL`, `UNSUPPORTED`, or `TRUNCATED`.

Remediation authority remains exactly:

- `SAFE`
- `REVIEW_REQUIRED`
- `ARCHITECTURAL`

Only the narrow explicit HttpOnly false-to-true edit is SAFE today. Review-required work is not
autoapplied and architectural work is never autoapplied. This small authority is a strength, not a
v1 coverage blocker.

### Rules, MCP, agents, package and configuration

All 27 rule IDs and versions are enumerated in the machine inventory. IDs are durable finding
identities, but the post-v1 policy for meaning, severity, evidence-anchor, proof requirement and
remediation-ceiling changes is not yet published.

The exact MCP public surface is:

- `cydetix_scan`
- `cydetix_fix`
- `cydetix_explain`

MCP is newline-delimited JSON-RPC over stdio, binds a canonical configured root, accepts only
narrower paths inside it, bounds retained requests, and can require the exact installed version.
Agent setup persists exact Node, JavaScript entrypoint, project root, and Cydetix version; it does
not persist `npx`, a registry lookup, or an arbitrary shell command. Host-specific formats and live
UI behavior are best-effort.

The npm package exposes the `cydetix` bin, declares Node `^22.18.0 || ^24.11.0`, includes the
allowlisted `dist`, rules, schemas, agent skill, license/notice and primary documentation, and has
no lifecycle scripts. `.cydetix.json` is strict data-only JSON with schema version 1.0.0 and bounded
file size, file count, depth, ignore entries, baselines and suppressions.

The package has no `exports` map while it ships `dist` JavaScript and declarations. Deep imports are
therefore technically accessible with no stated support boundary. That ambiguity is a v1 blocker,
not evidence that those implementation modules should become a public SDK.

## Compatibility review

Cydetix can responsibly guarantee the following after blocker closure:

- A documented stable subset of CLI commands, flags, defaults and exit codes.
- Versioned scan/finding/rule/remediation JSON contracts and the documented SARIF behavior.
- The four proof states and three remediation authority classes without semantic weakening.
- Stable rule identities with an explicit rule-version evolution policy.
- Exactly the three named MCP tools and their root/intent/mutation constraints.
- Strict `.cydetix.json` parsing and the documented Node/package entry boundary.

The supported security-analysis promise must remain narrower than the stable interface promise:
catalogued invariants, declared parser/framework patterns, explicit evidence anchors, and reported
resource/completeness bounds. A clean scan is not whole-program or deployment proof. No recall,
accuracy, zero-false-negative, universal framework, or agent-host claim is supported.

Recommended experimental/best-effort classification includes setup/status/mcp-config host formats,
human presentation wording, exploratory auth/graph output, Security IR/authentication/authorization
diagnostic schemas, live agent-host UI behavior, online-provider availability, and readiness/release
evidence formats. This is a proposed boundary for review, not a silent contract change made by this
audit.

## Limitation inventory

The inventory contains 25 entries: four blockers, thirteen acceptable v1 limitations, five
documentation gaps, and three measurement gaps.

Incomplete coverage is not itself a blocker. The following are acceptable when documented and
retained fail-closed:

- Honest `UNKNOWN`, `PARTIAL`, `UNSUPPORTED`, and `TRUNCATED` results.
- Declared literal/direct ESM Express and narrow Python/FastAPI/Flask analysis, with CommonJS
  indirection, dependency injection, callbacks, dynamic construction and most cross-file Python
  propagation unsupported.
- File/traversal, AST, identity and dataflow bounds that preserve availability and disclose omitted
  work.
- Incomplete corpus ground truth and no corpus-wide recall/accuracy claim.
- Npm lockfile v2/v3 inventory without dependency reachability, PyPI or SPDX claims.
- Passive/redacted lexical secret evidence without credential-validity or deployment claims.
- One SAFE transformation; all other remediation remains review-required or architectural.
- Docker/runtime trust, text-only bounded ephemeral copies, and explicit unsandboxed local-runner
  assumptions.

Measurement gaps remain broader live agent-host versions, a complete hostile/permission matrix on
each hosted OS, and controlled cross-platform performance/SLO evidence. These limit claims but do
not make the bounded product unsafe.

## V1 blockers

| Blocker                                 | Technical or user-safety reason                                                                                                                                                                                                                                                                                 | Smallest remediation                                                                                                                                                                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker timeout cleanup race             | One mandatory run returned `TIMED_OUT`, then left its exact random `cydetix-verify-*` container in `Created`. The client can be killed before daemon-side creation settles, while an immediate absence check incorrectly confirms cleanup. No local fallback occurred, but deterministic cleanup was disproved. | Establish explicit create/inspect/start lifecycle ownership or otherwise wait for the Docker operation to settle; remove the exact name after creation can no longer race; stress-test repeated timeout cleanup. Preserve every sandbox control. |
| Undefined package import boundary       | With no `exports` map, consumers can deep-import `dist` implementation modules and declarations. v1 compatibility obligations would be unknowable.                                                                                                                                                              | Choose CLI-only or deliberately enumerate a small supported API; add an exports map and import-boundary tests.                                                                                                                                   |
| No stable/experimental policy           | Mature scan/report/MCP and experimental auth graph/diagnostics/host integrations are shipped together. v1 would accidentally promise compatibility for all observable behavior.                                                                                                                                 | Publish a reviewed surface table and evolution policy for CLI, JSON, SARIF extensions, rules, MCP, configuration and experimental interfaces.                                                                                                    |
| Stale public installation/evidence docs | README recommends Alpha.10/Alpha.11/Alpha.7 and calls Beta.3 unpublished; claims/limitations pages deny hosted publication/provenance that now exists. Users can install an obsolete artifact or misunderstand trust evidence.                                                                                  | Correct only the affected README, claims, limitations and agent/install text; document the unambiguous exact-version `npm exec --package=... -- cydetix` form.                                                                                   |

## Installation matrix

The exact published tarball has registry shasum `b5300defef9249805745ef9adef0b72c343fc687` and
integrity
`sha512-5MtOJFto75x7tUxDmMqyOhSthawFUPatTBRsDB80JcXpsw7pif6ZNTPn4tOs4OSONZu/YYIjGS9kNOVgo8MfEA==`.
It contains 221 allowlisted entries, is 296,333 packed bytes and 1,837,613 unpacked bytes.

| Environment                                               | Node    | Result  |
| --------------------------------------------------------- | ------- | ------- |
| Windows hosted                                            | 22.18.0 | SUCCESS |
| Windows hosted                                            | 24.11.0 | SUCCESS |
| Ubuntu hosted                                             | 22.18.0 | SUCCESS |
| Ubuntu hosted                                             | 24.11.0 | SUCCESS |
| macOS hosted                                              | 22.18.0 | SUCCESS |
| macOS hosted                                              | 24.11.0 | SUCCESS |
| Windows clean local/global/npm-exec, current Node 24 line | 24.15.0 | PASS    |

Each hosted case performed a lifecycle-disabled locked install, audit, complete verify,
version/package checks, packed install smoke, committed-dist check, self-scan and package-content
check. Hosted Linux also passed the container sandbox and the GitHub Action smoke passed.

The fresh packed edge harness passed 8/8 cases: paths with spaces, non-Git roots, monorepo
discovery, malformed input, hostile repositories, read-only sources, missing targets and
permission-denied targets. It verified that routine scans did not execute target lifecycle scripts,
tests, hooks, Makefiles, application code, or repository instructions.

`npx --yes cydetix@beta --version` and the unambiguous exact form
`npm exec --yes --package=cydetix@0.6.0-beta.3 -- cydetix --version` ran Beta.3. On Windows npm
11.19.1, shorthand `npx --yes cydetix@0.6.0-beta.3 --version` did not infer the bin and could fall
through to an older global binary. Documentation must not recommend that shorthand for exact pins.

## User-experience findings

The core first-run experience is restrained and security-honest: default output is concise;
detailed, JSON and SARIF modes are discoverable; findings expose proof, evidence, prerequisites,
impact and remediation class; `UNKNOWN` is explained as unresolved; and malformed input reports
partial coverage instead of false success. Planning is zero-write and SAFE mutation retains
confirmation, rescan and verification outcomes.

Missing/denied targets are actionable, control characters are terminal-safe, and secret material is
redacted. CI users have a distinct policy command. Setup stores a persistent exact runtime and MCP
has a small comprehensible public surface.

The material UX defects are informational, not cosmetic: stale version/release text, ambiguous exact
`npx` syntax, and the absent stable/experimental compatibility table. No cosmetic redesign is
recommended.

## Corpus and false-positive/false-negative review

The existing corpus pins 30 repositories. Historical selective adjudication records 134 findings,
220 application-dataflow UNKNOWN results, one authentication UNKNOWN, 13 finding-proof UNKNOWN
results, and 13 resource-bound repositories. Ground truth is incomplete; recall and accuracy remain
`null`.

Seven representative/adjudication-sensitive repositories were replayed twice against Beta.3:
NodeGoat, Flask-Security, vulnerable-typescript, flask-sqlinjection, express-session, Express and
FastAPI. Every normalized pair was deterministic. The password-purpose case remains
`AS-PASSWORD-001@1.0.1 UNKNOWN`; both placeholder-key cases remain `AS-SECRET-001@1.0.1 UNKNOWN`.
Thus the three corrected false-insecure results did not recur and unresolved confirmed
false-insecure results remain zero.

No newly established supported-pattern false negative was found in this selective replay/review.
Unsupported cross-file Python, CommonJS controller/factory, callback/closure, framework adapter and
resource-bound cases remain explicitly outside the supported envelope. This is not a zero-FN,
corpus-wide recall, accuracy, completeness, or deployment-security claim.

## Performance and resource results

On the current Windows/Node 24.15 host, 20 fresh-process `--version` invocations had p50 651 ms and
p95 774 ms; one 3.54-second outlier is retained. Five sequential deterministic scans gave:

| Repository      |           Size observed | Completeness |    p50 |     p95 | Process high-water RSS |
| --------------- | ----------------------: | ------------ | -----: | ------: | ---------------------: |
| express-session |     28 files / 0.20 MiB | COMPLETE     | 683 ms |  799 ms |                276 MiB |
| Express         |    214 files / 0.68 MiB | PARTIAL      | 2.62 s |  2.76 s |                614 MiB |
| FastAPI         | 3,140 files / 21.76 MiB | TRUNCATED    | 7.87 s | 10.11 s |                390 MiB |

The deterministic synthetic scale run measured 0.72 s/87 MB at 100 source files, 3.86 s/106 MB at
1,000, and 11.65 s/158 MB at 5,000. The 2,500-dependency and 250-workflow fixtures measured 0.95 s/
311 MB and 0.66 s/318 MB. Against the Beta.3 evidence, timing deltas were mixed from -33% to +47%,
while peak RSS changed between -2.3% and +2.9%. The environment was not an isolated benchmark host,
so no performance regression or improvement is claimed.

Parser, identity and dataflow bound tests passed. FastAPI surfaced 544 application-dataflow bound
events and one oversized traversal file; it remained deterministic and TRUNCATED. Sandbox overhead
was observed through the aggregate Docker suite (about 69 seconds on its passing run), not as a
stable per-invocation SLO. Stable performance remains a measurement gap, not a reason to weaken
analysis or bounds.

## Security and release governance

| Control                                    | Result                                                                     |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| npm audit                                  | PASS — 0 vulnerabilities                                                   |
| Online OSV                                 | PASS                                                                       |
| Beta.3-reachable history                   | PASS — 77 commits, no issues                                               |
| Independent all-refs Gitleaks              | PASS — 88 content-bearing commits, 23/23 exact reviewed non-secret matches |
| Workflow pinning/permissions/injection     | PASS — four workflows, 12 enforced controls                                |
| Package allowlist and exact packed install | PASS                                                                       |
| Plugin archive                             | PASS — isolated extraction, one skill                                      |
| CycloneDX 1.7 SBOM                         | PASS                                                                       |
| License audit                              | PASS — 162 dependencies, no issues                                         |
| Public working-tree privacy audit          | PASS — 1,091 files / 7,745,614 bytes, no issues                            |
| Self-scan                                  | PASS — 707 files, 27 rules, 0 active / 28 documented suppressed findings   |
| Release evidence/history identities        | PASS — Beta.3 context and 13 historical tags                               |
| Docker sandbox                             | BLOCKER — 12/13 first run due cleanup race; 13/13 second run               |

The broader all-refs metadata audit reviewed 89 commits and found three newer Dependabot commits on
isolated remote branches whose exact bot identity tuple is not yet in the author-allowance policy.
None is an ancestor of Beta.3/main. Release-reachable history and all-refs secret content passed,
but the three exact branch identities should be reviewed before making an all-public-refs policy
claim.

The current fresh `validate:sarif` attempt failed closed because the checksum-pinned OASIS endpoint
timed out both normally and outside the sandbox. Focused SARIF renderer, official-schema negative
control and Multitool tests passed, and the exact Beta.3 release workflow successfully completed the
full official-schema/Multitool gate. No SARIF gate was bypassed; current endpoint availability is
reported as a validation-environment gap.

The release workflow is tag-only and protected, checks the exact tagged commit and hosted gates,
uses complete reachable history and a pinned unsuppressed secret scan, permits OIDC only in the
publish job, and publishes one verified local tarball to the deterministic version-derived dist-tag.
Beta.3 successfully exercised npm trusted publishing, SLSA npm provenance, artifact attestation,
SBOM attestation and GitHub prerelease publication. These are executed controls, not configuration
claims.

## Test and validation executions

- Focused CLI/MCP/agent/hostile-input/discovery/parser/identity/dataflow/remediation/SARIF tests: 12
  files, 73/73 passed.
- Full suite in exact Beta.3 tag context: 60 files passed, one skipped; 508 passed and 13 skipped
  out of 521.
- Full suite without tag context: two development-positive tests rejected the genuine
  current-version tag conflict; 506 passed, two failed, 13 skipped. This is expected fail-closed
  development/release separation, not a bypass.
- Mandatory Docker sandbox: first run 12/13 with the cleanup race; second complete run 13/13.
- Packed published-product edge audit: 8/8 passed.
- Representative corpus replay: 7 repositories, two scans each, all deterministic.
- Phase-six scale benchmark and three five-scan repository measurements completed.
- Package, install, plugin, SBOM, version, workflow-security, release-report, publication-config,
  release preview, licenses, public privacy, self-scan, npm audit, OSV, reachable-history and pinned
  all-refs Gitleaks checks completed as recorded above.
- Exact Beta.3 tag-context `npm run verify` passed formatting, lint, typecheck and the 21-schema/
  27-rule drift check, then stopped fail-closed at the unreachable checksum-pinned OASIS SARIF
  endpoint. Its later component gates were executed separately or by the full suite; the command as
  a whole is not reported as passing locally.
- `validate:release-context` correctly refused the intentionally dirty evidence worktree. Its exact
  clean Beta.3 context already passed in Trusted Release run 34947037844.
- A fresh full `validate:sarif` could not reach the pinned OASIS endpoint and failed closed; no
  local substitute was presented as that network gate.

## Remaining risks and precise recommendation

The largest remaining technical risk is the Docker create/kill/remove race. The remaining stable
release risks are accidental API commitments and misleading public guidance, not missing detection
features. Coverage, corpus and performance uncertainty must remain explicit limitations.

Run one narrow v1 stabilization phase:

1. Fix and stress-test exact-name Docker cleanup after timeout without relaxing any sandbox control.
2. Decide the package import boundary and enforce it with `exports` plus tests.
3. Publish the stable/experimental compatibility and rule/schema/SARIF evolution policy.
4. Correct version, release, provenance, limitation and exact-install documentation.
5. Review the three isolated Dependabot author tuples, rerun all readiness evidence, and require new
   exact-SHA CI, CodeQL and OpenSSF success before any stable-release preparation decision.

Stop after that evidence is reviewed. Do not bump to `1.0.0`, create a v1 tag, publish npm, create a
GitHub release, or move `latest` during this readiness gate.

Final verdict: **V1_NOT_READY**

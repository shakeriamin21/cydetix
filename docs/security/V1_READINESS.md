# Cydetix V1 readiness

## Verdict

`V1_READY_WITH_LIMITATIONS`

All four hard blockers found by the Beta.3 readiness audit are closed on source commit
`edd6163bea572d830043659860322c0232453942`. This is a readiness conclusion, not release authority.
The package remains `0.6.0-beta.4`, no Beta.4 or V1 tag exists, and nothing was published.

## Audited identities

| Identity                    | Exact value                                |
| --------------------------- | ------------------------------------------ |
| Stabilization source        | `edd6163bea572d830043659860322c0232453942` |
| Development candidate       | `0.6.0-beta.4` (untagged)                  |
| Immutable released baseline | `0.6.0-beta.3`                             |
| Beta.3 tag object           | `29203b647094604184bdd84386a1e7f23809ac28` |
| Beta.3 target               | `c937ae1ddbf329bc62fb0376f04bf2123f438f4e` |
| Beta.3 trusted release      | `34947037844` (`SUCCESS`)                  |

The versioned Beta.3 evidence directory is byte-unchanged. Beta.1, Beta.2 and Beta.3 tags were not
deleted, moved, recreated or repointed.

## Blocker closure

| Blocker                 | Historical evidence retained                                                                                                | Closure evidence                                                                                                                                                                                                | State    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Docker timeout cleanup  | One pre-fix mandatory run passed 12/13 and left the timed-out exact-name container in `Created`; a second run passed 13/13. | Two-phase create/inspect/start ownership, exact-name idempotent removal with retry and confirmed absence, explicit cleanup failure; local 15/15 and stress 50/50 with zero leaks; hosted Docker passed.         | `CLOSED` |
| Package export boundary | Beta.3 had no `exports` map and deep `dist` imports were ambiguous.                                                         | Five stable JSON schemas and `package.json` are exported; package root, `dist`, MCP implementation, experimental schemas and TypeScript implementation imports are blocked in source and packed-artifact tests. | `CLOSED` |
| Compatibility policy    | Stable and evolving surfaces shipped without public classifications.                                                        | [V1 compatibility policy](../V1_COMPATIBILITY.md) and machine-readable policy classify required surfaces as `STABLE`, `EXPERIMENTAL` or `INTERNAL` with explicit evolution rules.                               | `CLOSED` |
| Public documentation    | Public pages named older Alpha versions and described released Beta.3 as unpublished/unvalidated.                           | Installation, claims, limitations, npm, agent/plugin and release/provenance pages now identify immutable Beta.3 exactly and preserve bounded claims.                                                            | `CLOSED` |

No active V1 blocker remains.

## Contract inventory and policy

The exact command, flag, default, exit-code, schema, rule/version, SARIF, MCP, Agent integration,
configuration, package-files and Node-support inventory is in
`validation/v1-readiness/contract-inventory.json`. The normative classification is in
`docs/V1_COMPATIBILITY.md` and `validation/v1-readiness/contract-policy.json`.

| Surface                                                                                | Classification       |
| -------------------------------------------------------------------------------------- | -------------------- |
| Core CLI scan/ci/fix behavior, stable flags/defaults, exit codes and bin               | `STABLE`             |
| Exported scan/finding/rule/remediation/CycloneDX schemas                               | `STABLE`             |
| Documented SARIF 2.1.0 mapping and named Cydetix extensions                            | `STABLE`             |
| Rule IDs/versions; proof states; remediation classes                                   | `STABLE`             |
| MCP server protocol and exactly `cydetix_scan`, `cydetix_fix`, `cydetix_explain`       | `STABLE`             |
| Strict data-only `.cydetix.json`; Node `^22.18.0                                       |                      | ^24.11.0` | `STABLE` |
| Setup/status/auth/graph/mcp-config/standards/doctor diagnostics and human wording      | `EXPERIMENTAL`       |
| Agent Skills, host adapters and generated host configuration                           | `EXPERIMENTAL`       |
| Analysis/evidence schemas not explicitly exported                                      | `EXPERIMENTAL`       |
| Programmatic JS/TS implementation imports, deep `dist`/MCP imports and public TS types | `INTERNAL` (blocked) |
| Release/governance implementation scripts                                              | `INTERNAL`           |

Stable contracts require compatibility or an explicit migration policy within major version 1.
Public rule IDs are not reused, semantic changes require explicit rule-version evolution,
proof-state meaning cannot silently change, and remediation authority cannot silently increase.

The package export map is intentionally data-only:

- `./schemas/scan-report.schema.json`
- `./schemas/finding.schema.json`
- `./schemas/rule.schema.json`
- `./schemas/remediation-report.schema.json`
- `./schemas/cyclonedx-1.7.schema.json`
- `./package.json`

There is no package-root or programmatic JavaScript/TypeScript API. The CLI remains available
through the `cydetix` bin. Introducing the boundary may break undocumented Beta-era deep imports;
that compatibility impact is deliberate and documented before V1.

## Installation and user experience

Beta.3 installation evidence remains the immutable public baseline. The Beta.4-equivalent packed
candidate then passed local/global/npm-exec installation and export-boundary tests. Hosted CI
`35008472979` passed Ubuntu, macOS and Windows on Node 22.18.0 and 24.11.0, including complete
verification, package allowlist, packed install, generated-runtime drift and self-scan. Hosted Linux
Docker and GitHub Action smoke also passed.

The existing eight-case Beta.3 edge matrix covers a path with spaces, non-Git repository, monorepo,
malformed repository, hostile repository, read-only source, missing path and denied path. Target
lifecycle scripts, application code, tests, hooks, Makefiles and instructions were not executed.
Cross-platform repetition of the entire hostile/permission matrix remains a measurement gap; hosted
package behavior covers the three supported operating systems.

The UX audit found the first command, finding/proof/UNKNOWN explanation, SAFE planning, failure
modes, CI/SARIF and MCP setup suitable for a bounded stable contract. Exact-version documentation
now uses the unambiguous form `npm exec --yes --package=cydetix@0.6.0-beta.3 -- cydetix`;
host-specific agent UI behavior remains best-effort.

## Docker lifecycle remediation

The race was between the killed `docker run` client and daemon-side creation. Cleanup could see an
empty `docker ps`, return success, and then have the delayed container materialize in `Created`. The
runner now:

1. creates the exact random-name container synchronously with bounded Docker control-plane calls;
2. inspects the complete hardened profile before executing the workload;
3. starts with bounded `docker start --attach`, killing the exact name on timeout/output bounds;
4. force-removes the exact name and confirms absence with bounded retries;
5. handles `Created`, `Running`, `Exited`, `Dead`, transitional, already-absent and transient
   inspection/removal cases idempotently; and
6. returns an explicit sandbox misconfiguration instead of success/timeout if cleanup cannot be
   confirmed.

Isolation remains network-denied, non-root, read-only-rootfs, capability-dropped, no-new-privileges,
runtime-default seccomp, 512 MiB, one CPU and 128 PIDs. No local fallback or additional execution
authority was added.

Exact-source results: mandatory suite 15/15; 50 stress runs at parallelism 5; pass 50; cleanup
failures 0; unexpected states 0; leaked containers 0. The environment was Docker Desktop
client/server 29.0.1, Linux x86-64 WSL2 kernel 6.18.33.2, cgroup v2, `runc`, builtin seccomp and the
exact locally present Node image digest recorded in `docker-cleanup-stress.json`.

## Corpus and performance evidence

No detection rule, parser envelope, proof semantic or remediation authority changed during
stabilization, so the pinned Beta.3 corpus and representative performance evidence carry forward.
The 30-repository ground truth remains selective and incomplete. Seven adjudication-sensitive
repositories replayed deterministically; no new supported-pattern false negative was established;
three historical false-insecure cases remain corrected/`UNKNOWN`. Recall and accuracy remain `null`,
and no corpus-wide zero-false-negative or completeness claim is made.

Representative scans remained deterministic and resource bounds remained visible: Express Session
was `COMPLETE`; Express was `PARTIAL`; FastAPI was `TRUNCATED`. The Beta.3 measurements record 20
CLI startup samples (p50 651 ms, p95 774 ms), synthetic 100/1,000/5,000-source runs, 2,500
dependencies and 250 workflows. Timings are descriptive on one Windows/Node 24 host; mixed deltas
and host variance do not support a cross-platform SLO.

## Security, supply chain and release governance

| Gate                                                             | Result                                                          |
| ---------------------------------------------------------------- | --------------------------------------------------------------- |
| Complete composed development gate                               | `PASS`                                                          |
| Normal tests                                                     | 524 passed; 15 Docker-gated skipped; 539 total                  |
| Mandatory Docker                                                 | 15/15 `PASS`                                                    |
| Docker cleanup stress                                            | 50/50; 0 cleanup failures; 0 leaks                              |
| npm audit                                                        | 0 vulnerabilities                                               |
| OSV                                                              | 214 package identities; no findings                             |
| Reachable/all-refs metadata                                      | 79/89 commits; `PASS`                                           |
| Independent complete-history Gitleaks                            | 88 commits; 23 exact reviewed non-secrets; no unreviewed secret |
| Workflow security                                                | `PASS`                                                          |
| Package/packed install/export boundary                           | 221 entries; `PASS`                                             |
| SBOM/SARIF/licenses/plugin/Agent Skill/MCP/remediation/self-scan | `PASS`                                                          |
| Public repository privacy                                        | 1,099 files; `PASS`                                             |
| Hosted CI                                                        | `35008472979` `SUCCESS`                                         |
| Hosted CodeQL                                                    | `35008473048` `SUCCESS`                                         |
| Hosted OpenSSF Scorecard                                         | `35008472955` `SUCCESS`                                         |

The checksum-pinned OASIS SARIF fetch failed closed once with managed-network `ENOTFOUND`, which was
classified as a transport failure rather than integrity failure. An unrestricted exact-source rerun
and the complete composed gate passed with the live pinned source. No cached fallback, checksum
bypass or weakened content validation was introduced.

The release workflow remains annotated-tag-only, exact-commit gated, protected-environment bound,
OIDC trusted-publishing-only and single-local-tarball based, with npm provenance and GitHub/SBOM
attestations proven by immutable Beta.3. Stabilization did not invoke release context.

## Dependabot tuple decisions

The three isolated, non-ancestral refs use the legitimate GitHub Dependabot author and GitHub
committer identities. Each is allowed only at its exact immutable commit; this is metadata/privacy
acceptance, not content approval or identity authentication.

| Ref                                                                    | Commit                                     | Decision            |
| ---------------------------------------------------------------------- | ------------------------------------------ | ------------------- |
| `refs/remotes/origin/dependabot/npm_and_yarn/typescript-eslint-8.70.0` | `1fae8d7ce33059666b99289cb91c86bf6b96c265` | `ALLOW_EXACT_TUPLE` |
| `refs/remotes/origin/dependabot/npm_and_yarn/zod-4.6.1`                | `32d6457f237fbd5ed4ed5f3c7ea1d991a6578bd1` | `ALLOW_EXACT_TUPLE` |
| `refs/remotes/origin/dependabot/npm_and_yarn/types/node-26.5.1`        | `509f7d174e5861e8e6d5cc265024f84437f927ef` | `ALLOW_EXACT_TUPLE` |

All three have author `dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>` and
committer `GitHub <noreply@github.com>`. No wildcard allowance exists; future unknown bot identities
fail closed.

## Remaining limitations and recommendation

Acceptable limitations remain: honest `UNKNOWN`/`TRUNCATED` semantics; bounded parser/framework,
traversal, identity and dataflow coverage; incomplete corpus ground truth and no corpus-wide recall
claim; no unresolved adjudicated false-insecure result; npm-only dependency inventory; passive
redacted secret analysis; exactly one narrow SAFE transformation; trusted local Docker/kernel and
temporary-workspace assumptions; best-effort agent-host UI integration; and no cross-host
performance guarantee.

Recommendation: review and accept `V1_READY_WITH_LIMITATIONS`. If accepted, the exact next phase is
a separately authorized 1.0.0 release-candidate preparation from the audited stabilization source.
Do not tag, publish, create a GitHub release or move npm `latest` as part of this readiness gate.

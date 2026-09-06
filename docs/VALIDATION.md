# Validation

Cydetix separates regression evidence from independent validation. Scanner input contains only the
target source tree. Expected labels and manual adjudications are loaded by the evaluator only after
an ordinary offline scan has completed. Rules may not inspect corpus names, repository names, test
IDs, or labels.

## Evidence classes

| Class                               | Purpose                                | Appropriate conclusion                   |
| ----------------------------------- | -------------------------------------- | ---------------------------------------- |
| Internal regression corpus          | Prevent known behavior from changing   | Build/regression evidence only           |
| External labeled benchmark          | Measure applicable TP/FP/TN/FN cases   | Accuracy metrics with denominators       |
| Deliberately vulnerable application | Exercise realistic architecture        | Finding-level manual adjudication        |
| Real-world benign application       | Discover noise and unsupported designs | Reviewed observations, not automatic TNs |
| Hostile repository corpus           | Test scanner/fixer containment         | Reliability and boundary evidence        |
| Performance corpus                  | Detect scaling regressions             | Timings for the measured machine/run     |

`UNKNOWN`, `UNSUPPORTED`, `NOT_APPLICABLE`, `NEEDS_DOMAIN_CONTEXT`, and duplicates are never
converted to true negatives. Precision and recall are withheld when the labels needed for their
denominators are incomplete.

## Phase 6 external corpus inventory

| Corpus                | Immutable revision                         | License    | Role                                            | Result                               |
| --------------------- | ------------------------------------------ | ---------- | ----------------------------------------------- | ------------------------------------ |
| OWASP NodeGoat        | `c5cb68a7084e4ae7dcc60e6a98768720a81841e8` | Apache-2.0 | Realistic vulnerable Node.js application        | 6 TP, 0 FP, 1 needs domain context   |
| OWASP BenchmarkPython | `f1291485808b66e20ddb6b01b10dc71b3df8c8ba` | GPL-3.0    | External labeled benchmark applicability review | 3 reviewed cases, all not applicable |

NodeGoat produced six `AS-CI-001` findings for external Actions pinned to mutable tags. Each emitted
location was manually inspected during implementation and classified true positive. A committed
development TLS private key produced `AS-SECRET-001`, but deployment identity and intended training
context were not independently established, so the result is `NEEDS_DOMAIN_CONTEXT`. Observed
finding precision is therefore 6/6 (100%) over six adjudicated positive findings. This is not a
recall result, not an independent human study, and not a production precision claim.

BenchmarkPython contains 1,230 cases, including 39 CWE-614 cookie cases and 151 hash cases. The
cookie cases manipulate arbitrary response cookies rather than proven authentication-session
configuration; the hash cases do not prove password credential storage. Three representative cases
were reviewed and marked `NOT_APPLICABLE`. They contribute neither TN nor FN counts. Cydetix does
not add Python/framework semantics merely to improve a benchmark score.

Normalized manifests, labels, and results are under `validation/`. Third-party source is not
vendored or included in the npm package.

## Metric definitions

- Precision: `TP / (TP + FP)` when adjudicated positive findings exist.
- Recall: `TP / (TP + FN)` only with complete applicable vulnerability labels.
- False-positive rate: `FP / (FP + TN)` only with complete applicable secure labels.
- Specificity: `TN / (TN + FP)` under the same condition.
- F1 and Youden discrimination are emitted only when their required component metrics exist.

Every metric object carries its numerator and denominator. Per-rule counts are published alongside
global counts so a weak detector cannot be hidden by an unrelated strong rule.

## Reproduction

Acquire each corpus outside the release package, check out the exact revision without executing its
code, build Cydetix, then run:

```powershell
node scripts/validate-external.mjs validation/corpora/owasp-nodegoat.json <NodeGoat-path>
node scripts/validate-external.mjs validation/corpora/owasp-benchmark-python.json <BenchmarkPython-path>
```

The harness verifies `git rev-parse HEAD`, disables prompts and ambient Git configuration, runs only
Cydetix's offline static scan, and loads labels afterward. Do not run package managers, builds,
tests, Dockerfiles, hooks, or application code from downloaded corpora.

## Internal, hostile, and sandbox results

The final local Cydetix regression run has 32 passing test files and 197 passing tests, with zero
failed and zero skipped tests. All 13 container tests executed. The pre-change baseline was 32 files
and 152 tests; the 45 added assertions cover agent discovery and state, consent and non-interactive
boundaries, safe configuration transactions, trigger selection, MCP identity, concise CLI output,
and packed execution.

The immutable local test image was
`sha256:1b2479dd35a99687d6638f5976fd235e26c5b37e8122f786fcd5fe231d63de5b`
(`node:22.18.0-alpine3.22`). It was explicitly pulled by the operator before testing; Cydetix did
not pull it. Docker Desktop 4.52.0 / Engine 29.0.1 served Linux/amd64 containers through WSL2 kernel
6.18.33.2 with cgroup v2 and built-in seccomp.

The in-container network program attempted DNS resolution of `example.com`, a TCP connection to the
RFC 5737 TEST-NET-3 address `203.0.113.1`, and HTTP/HTTPS requests to `example.com`. DNS returned an
error, TCP returned unreachable, and both application requests failed without connecting. Separate
synthetic AWS/GitHub/database environment canaries and host-home/host-temp file canaries were
absent. The workload observed UID/GID 65534, zero capability sets, `NoNewPrivs: 1`, seccomp mode 2,
a read-only root, no Docker/SSH socket, memory max 536870912, swap max 0, PIDs max 128, and a
one-CPU quota. Page-touched over-allocation exited 137, `/tmp` exhaustion returned `ENOSPC`, timeout
removed the complete container, and aggregate retained byte counters stayed at or below 2,000,000.

The full suite also covers malformed JSON/YAML/source, oversized and binary files, import cycles,
prompt injection, terminal controls, deterministic output, seeded path traversal, provider failures,
optional-tool hangs/output/crashes, security-preserving/breaking mutations, SAFE-fix variations, and
stale/dirty/rollback behavior. A skipped security test is never counted as passing.

Stored external results remain NodeGoat 6 TP / 0 FP / 1 `NEEDS_DOMAIN_CONTEXT`, and the three
reviewed BenchmarkPython cases remain `NOT_APPLICABLE` with zero TN. This phase did not expand the
label set, denominators, or independence of the original adjudication. OpenSSF Scorecard remains
`not_checked` because the project has no approved addressable public repository. A pinned hosted
workflow is configured but has not executed.

## Release interpretation

The machine-readable `validation/validation-report.json` is schema-validated and contains source
provenance, corpora, counts, sandbox capability, Docker/WSL metadata, performance cases, known
limitations, and readiness verdict. Check states are explicitly `executed_pass`, `executed_fail`,
`skipped_capability`, `not_applicable`, or `not_checked`. The current verdict is
`NOT_READY_FOR_PUBLIC_USE`: preview artifacts are explicitly uncommitted, Git author metadata has
not been approved for public history, and hosted/repository/npm/name-clearance gates remain open. No
artifact is published by this verdict.

The clean-export explicit online OSV self-query completed successfully for 214 normalized resolved
package identities with `CHECKED_NO_FINDINGS`; npm audit independently reported zero vulnerabilities
on 2026-09-06. These are provider observations at the recorded run time, not a claim that advisory
databases are exhaustive or that dependency functions are reachable.

## Current public distribution gate

The current-tree audit passes over 674 tracked and non-ignored files with no personal path, private
email, forbidden artifact, binary, or earlier-candidate-brand issue. Independent Gitleaks 8.30.1
scans pass for both the current public-tree export and the one-commit history after nine synthetic
fixture/schema findings in each applicable scope were reviewed and fully redacted. The deterministic
Git-history metadata audit still fails because the existing commit author email has not been placed
on the explicit public allowlist; Cydetix does not silently approve or rewrite it.

The alpha.2 package allowlist has 320 entries, 297,150 packed bytes, 1,874,312 unpacked bytes, no
lifecycle scripts, and exactly one `cydetix` binary. Isolated npm-exec and global-prefix
installation exercise version/help/default scan/setup/status/SAFE fix/machine output/MCP paths
successfully. The isolated plugin archive validates one skill. Self-scan has zero active and 28
dated fixture-suppressed findings; npm audit reports zero vulnerabilities; online OSV reports no
findings across 214 resolved identities; CycloneDX, SARIF, schemas, remediation, license, and
workflow-security gates pass.

The exact npm lookup returned the existing public `cydetix@0.6.0-alpha.1` package on 2026-09-06.
That establishes registration, not trademark clearance or authorization for alpha.2. Hosted
Windows/Linux/macOS CI, the external Action consumer, CodeQL, Scorecard, GitHub security settings,
attestations, and Trusted Publishing are not re-executed or proven by local preparation. Generated
checksums and manifests must be regenerated from a clean approved commit before any separately
authorized release.

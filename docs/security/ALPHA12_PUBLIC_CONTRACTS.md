# Alpha.12 public contract review

The exact inventory is
[`validation/alpha12/public-contracts.json`](../../validation/alpha12/public-contracts.json). It
includes every CLI command/flag, exit code, rule ID/version, MCP definition, exported report schema
and the remaining interface families. `PUBLIC_STABLE_CANDIDATE` is a compatibility proposal, not a
claim that beta has shipped or that the analysis covers arbitrary applications.

| Interface                                                                     | Classification          | Compatibility commitment proposed for beta                                                                         |
| ----------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Scan, CI, verification, remediation, rule lookup and structured CLI flags     | PUBLIC_STABLE_CANDIDATE | Keep argument meaning, explicit execution authorization and documented exit policy                                 |
| Setup/status, agent discovery, authentication/graph diagnostic views          | PUBLIC_EXPERIMENTAL     | Preserve trust boundaries; host formats and diagnostic projections may evolve                                      |
| Human wording, headings and ordering                                          | PUBLIC_EXPERIMENTAL     | Always distinguish proof, confidence, reachability, completeness, authority and verification; use JSON for parsing |
| Scan v2, finding, rule and remediation v1 schemas                             | PUBLIC_STABLE_CANDIDATE | Retain current required fields/enums; optional proof fields are not evidence of proof when absent                  |
| Security IR, auth graph, adapter/verification diagnostics                     | PUBLIC_EXPERIMENTAL     | Versioned data does not imply a stable SDK or complete framework semantics                                         |
| SARIF 2.1.0, locations, levels, codeFlows, partial fingerprints               | PUBLIC_STABLE_CANDIDATE | Keep the standard projection; additional Cydetix properties are experimental and additive                          |
| CycloneDX 1.7                                                                 | PUBLIC_STABLE_CANDIDATE | Lockfile evidence only; generation never installs dependencies                                                     |
| Rule IDs/versions and remediation ceilings                                    | PUBLIC_STABLE_CANDIDATE | Meaning changes require documented rule-version/compatibility review                                               |
| Proof/confidence/reachability/completeness/verification enums                 | PUBLIC_STABLE_CANDIDATE | Independent dimensions; UNKNOWN and missing evidence cannot establish security                                     |
| MCP tool names, declared arguments, result envelopes and root/version binding | PUBLIC_STABLE_CANDIDATE | Exactly scan/fix/explain; strict arguments; read-only offline scan/explain; explicit intent for SAFE mutation      |
| `.cydetix.json`, baselines, suppressions and fingerprints                     | PUBLIC_STABLE_CANDIDATE | Strict data-only configuration, audited scope/fingerprint/expiry, deterministic hashes                             |
| Release/beta-readiness formats and corpus methodology                         | PUBLIC_EXPERIMENTAL     | Evidence must name its source and limitations; release evidence is immutable                                       |
| Module imports, parser ASTs, caches, builders and test hooks                  | INTERNAL                | No SDK or ABI promise                                                                                              |

## Intentional corrections before beta

- Complete-history Gitleaks validation now rejects empty/subset reports that omit immutable reviewed
  findings. A reproduced Docker Git ownership error had produced an empty report with zero scanned
  commits. Historical reviews are unchanged; missing evidence no longer passes this gate.

- `explain <rule>` now defaults to readable text. Consumers of its previous default JSON must use
  `explain <rule> --format json`. `status` is a read-only alias of `setup --status`.
- Default output retains distinct findings at a shared source line. Its UNKNOWN count refers to
  unresolved proof instances, not findings with unknown runtime reachability. Counts may describe
  several invariants at one route; they are not a vulnerability prevalence metric.
- A small default view shows at most five complete finding explanations and three UNKNOWN causes,
  with an explicit omitted count and access to complete `--details`/JSON evidence. Source locations,
  uncertainty and offline advisory state are visible even when there are no actionable findings.
- MCP now enforces the strict argument surface it already advertised. Wrong types, unknown keys,
  non-object arguments and invalid JSON-RPC IDs are rejected. Retained streaming input is bounded
  before newline arrival. No new tool or remediation authority is introduced.
- SARIF retains finding proof and unresolved proof instances in additional properties. The JSON scan
  and remediation schema versions are unchanged by these reporting corrections.
- `AS-PASSWORD-001@1.0.1` retains its observed hash signal with high confidence, but reports UNKNOWN
  proof and runtime reachability because its adapter does not establish credential-storage use.
  Flask-Security's breach-lookup SHA-1 was a confirmed false insecure conclusion under alpha.11. The
  correction applies consistently to all observations rather than trusting a function name or
  exempting a particular repository. The ARCHITECTURAL ceiling and fingerprints are unchanged.
- Parser-accepted trees that Babel cannot scope now produce explicit file-local limitations.
  Exhausted propagation iterations and evidence paths produce TRUNCATED and withhold actionable
  application-dataflow proof. All existing numeric bounds remain unchanged.
- `AS-SECRET-001@1.0.1` retains private-key header observations as UNKNOWN in working-tree and
  history findings. Two placeholder headers in the expanded corpus demonstrated that the lexical
  detector cannot establish credential material from a header. Other credential patterns retain
  their existing proof semantics; private-key remediation guidance is conditional on reviewing the
  payload and deployment. No secret is sent to a provider for validation.
- Security identity propagation now enforces the same 10,000-fact/eight-iteration policy used by
  bounded application analysis. Previously its iteration count scaled with the number of symbols,
  allowing recursive derived identities to prevent a practical fixed point. Exhaustion discards
  incomplete propagated trust, forces dependent authorization/tenant proofs to UNKNOWN and adds
  optional `securityIr.propagationBounds` evidence plus a TRUNCATED engine status. This is an
  additive schema correction with an intentional conservative change in conclusions on exhausted
  graphs.
- Commander usage errors are printed once, with their usage guidance and unchanged exit code 2. A
  missing scan directory remains a scan failure (3), distinct from a malformed command (2).
- `verify:development` runs the existing local verification steps with an explicit development
  version/historical-evidence check. `verify`, publication checks and the release workflow retain
  their strict release requirements. Development validation rejects release-tag contexts.

## Choices that become costly after beta

Exit codes are deliberately retained: 0 means successful execution of a default/scan command, not
absence of vulnerabilities; 1 is a finding policy failure; 2 invalid usage; 3 scan failure; 4 failed
verification; 5 a verified SAFE fix was applied; 6 remediation withheld by policy; 7 unavailable
provider. Automation should treat 5 as remediation success and use `ci`/`verify` for policy gates.
UNKNOWN is never mapped to secure because the process exited 0.

Finding fingerprints bind rule identity, relative path and a detector-specific evidence anchor. They
are stable for the same finding context, not arbitrary source rearrangement. Accepted-risk baselines
and suppressions must remain visible and expiration-sensitive. Rule semantics, anchors, proof field
optionality and host-managed configuration paths need explicit migration review before future
breaking changes. Remediation `SAFE` remains only the existing exact HttpOnly transform; control
design, secret response, dependency choice and architectural work require review.

Compatibility tests lock the enumerations, rule IDs/versions/ceilings, tool schemas, current schema
hashes and CLI inventory. Existing fixture, suppression, determinism, SARIF and transaction tests
continue to exercise their semantics. None of these tests substitutes for live-host validation.

# Report v2 Phase 3 additive fields

Phase 3 deliberately retains scan report schema `2.0.0`. The new data is optional, so every valid
Phase 2 report remains valid and consumers that ignore unknown properties continue to work.

## Added fields

- `securityAnalysis.authenticationAnalysis`: authentication analysis schema `1.0.0`, containing
  source-evidenced operations, invariant definitions, applicability, tri-state conclusions, evidence
  paths, standards mappings, metrics, and limitations.
- `scan.performanceMilliseconds`: optional stage timings for discovery, parsing, call graph,
  security graph, authentication graph, invariant evaluation, and report generation.
- Authentication graph nodes may carry `sourceEvidence`; Phase 3-generated nodes always do.
- Rule metadata may use authentication categories, `authentication-invariant` detection strategy,
  and standards traceability relationships.

The authentication graph embedded in report v2 now declares graph version `2.0.0`. This is a
subcontract version, not a report-schema version change.

## Consumer guidance

Consumers should feature-detect `authenticationAnalysis` rather than infer it from product version.
Treat `PROVEN_INSECURE` as a failed invariant only when applicability is `APPLICABLE`. Treat
`UNKNOWN` and applicability `UNKNOWN` as coverage limitations, never as vulnerabilities.

Evidence paths and operation messages are safe diagnostic metadata; authentication credential
material is redacted before finding, JSON, SARIF, graph, or terminal projection. Consumers should
still protect reports as security-sensitive artifacts.

No report schema v3 migration is required for Phase 3.

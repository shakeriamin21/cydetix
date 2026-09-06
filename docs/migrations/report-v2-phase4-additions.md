# Report v2 Phase 4 additive fields

Phase 4 keeps report schema version `2.0.0`. Existing required fields and semantics are unchanged.
Consumers that reject unknown object properties should update to the generated Phase 4 schema.

## Additions

- `securityAnalysis.securityIr.supplyChain` is optional and contains Supply-chain IR v1 packages,
  workflows, Actions, redacted secrets, evidence, and dependency edges.
- `securityAnalysis.supplyChainAnalysis` is optional and contains dependency inventory, advisory
  provider state, secret analysis, GitHub Actions analysis, observable control states, and stage
  timings.
- Rule metadata may include `supplyChainStandards` with `REQUIRED`, `RECOMMENDED`, or
  `CONTEXT_DEPENDENT` relationships.
- Evidence-path step kinds now include dependency, advisory, workflow, and secret.
- Coverage tier may be `phase-four`.

## Provider semantics

`NOT_CHECKED_OFFLINE` and `PROVIDER_UNAVAILABLE` do not mean zero advisories. Only
`CHECKED_NO_FINDINGS` states that a provider completed the submitted exact-version query without an
affected record.

## Secret compatibility

Secret exposure objects never contain raw values. `redactedPreview` and a stable SHA-256 fingerprint
are the only value-derived report fields. Consumers must not attempt to reverse, enrich, or validate
these fingerprints against external providers.

## Separate SBOM artifact

`invariantsec sbom` emits CycloneDX 1.7 JSON as a separate artifact. It is not embedded wholesale in
the scan report. The generated `cyclonedx-1.7.schema.json` validates InvariantSec's supported output
profile; the canonical upstream CycloneDX schema remains authoritative.

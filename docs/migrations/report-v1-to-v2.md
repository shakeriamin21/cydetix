# Scan report v1 to v2 migration

Cydetix 0.2.0 emits scan report schema `2.0.0`. This is an intentional breaking contract change from
the Phase 1 `1.0.0` report. The repository manifest and rule schemas remain `1.0.0`; the new
Security IR and authorization-proof schemas begin independently at `1.0.0`.

## Why the major report version changed

Phase 2 adds required repository-wide analysis results. Adding them silently to the strict v1 schema
would make a v1 report invalid while retaining a misleading version. Report v2 therefore requires:

```json
{
  "schemaVersion": "2.0.0",
  "securityAnalysis": {
    "schemaVersion": "1.0.0",
    "securityIr": {},
    "authorizationProofs": []
  }
}
```

Findings may now include an `evidencePath` containing ordered route, call, identity, enforcement,
and resource steps. Coverage tier is `phase-two`. Existing finding fields, redaction behavior,
severity/confidence/reachability separation, fingerprints, suppressions, and baselines remain.

SARIF remains SARIF 2.1.0. A finding with a cross-file evidence path now includes a SARIF
`codeFlows` projection, and invocation properties include Security IR module and authorization-proof
counts.

## Consumer changes

1. Reject or dispatch on the top-level `schemaVersion`; do not parse v2 as v1.
2. Regenerate types from `schemas/scan-report.schema.json`.
3. Treat `securityAnalysis.securityIr` and `authorizationProofs` as required, even when their arrays
   are empty.
4. Handle `PROVEN`, `VIOLATED`, and `UNKNOWN` explicitly. `UNKNOWN` is neither secure nor
   vulnerable.
5. Preserve evidence-path order when rendering or importing findings.
6. Continue treating an empty findings list as inconclusive outside the report's stated coverage.

Cydetix does not emit both schema versions in one scan. Consumers needing v1 must remain on a
verified pre-v2 release until they migrate.

# Cydetix V1 compatibility policy

This policy defines the compatibility boundary Cydetix is prepared to carry into a stable V1
release. The repository now carries an untagged, unpublished `1.0.0` candidate; that version
identity does not claim an actual stable release and does not expand security-analysis coverage or
remediation authority.

## Classification and evolution

| Class          | Guarantee                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STABLE`       | Once released in V1, documented behavior will not make an incompatible change within major version 1 without an explicit compatibility or migration policy. Compatible additions remain possible. |
| `EXPERIMENTAL` | Behavior may change in a minor or patch release. Changes are documented and schema/rule/protocol versions are advanced where applicable. Experimental output must still fail closed.              |
| `INTERNAL`     | No compatibility guarantee. Consumers must not depend on the surface.                                                                                                                             |

Deprecating a stable surface requires documentation and a migration path before removal. Fixing a
security or correctness defect may make previously accepted unsafe input fail; the release notes
must identify the behavior and the fail-closed reason. No classification permits silently turning
incomplete analysis into proof, increasing remediation authority, or weakening a validation gate.

## Contract matrix

The exact command arguments, flags, defaults, exit codes, schema hashes, rule versions, MCP schemas,
and adapter capabilities audited for this candidate are frozen in
`validation/v1-readiness/contract-inventory.json`. The table below assigns their compatibility
classes and evolution rules.

| Surface                                           | Class          | V1 boundary                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI executable and default command                | `STABLE`       | The `cydetix` bin, current-directory default scan, offline default, and documented non-interactive behavior.                                                                                                                                                                                                                                                                                  |
| Core CLI commands                                 | `STABLE`       | `init`, `scan`, `dependencies`, `secrets`, `supply-chain`, `sbom`, `fix`, `mcp`, `verify`, `remediation show`, `explain`, `rules`, `trust`, `ci`, and `version`, including documented flags and defaults.                                                                                                                                                                                     |
| Integration and diagnostic CLI commands           | `EXPERIMENTAL` | `setup`, `status`, `auth`, `graph`, `mcp-config`, `standards`, and `doctor`; their safety and non-expansion rules remain mandatory even when presentation or host support changes.                                                                                                                                                                                                            |
| CLI exit codes                                    | `STABLE`       | `0` completed/no policy failure, `1` CI/verify policy finding, `2` usage, `3` scan failure, `4` verification failure, `5` verified SAFE change applied, `6` unsafe/withheld remediation, `7` required provider unavailable. Default/scan may report findings with `0`; `UNKNOWN` is never a clean proof.                                                                                      |
| Human-readable text and diagnostic wording        | `EXPERIMENTAL` | Meaning and severity must remain honest, but sentence layout, color, and presentation may evolve. Scripts must use structured output and exit codes.                                                                                                                                                                                                                                          |
| Stable machine-readable CLI output                | `STABLE`       | Output governed by the exported scan, finding, rule, remediation, and CycloneDX schemas at their declared schema versions. Incompatible schema changes require a new schema version and migration policy.                                                                                                                                                                                     |
| Other generated JSON and evidence schemas         | `EXPERIMENTAL` | Authentication/dataflow/authorization graphs, rules/trust/agent diagnostics, sandbox/verification internals, corpus, readiness, repository-manifest, and release-validation evidence.                                                                                                                                                                                                         |
| SARIF 2.1.0 mapping                               | `STABLE`       | SARIF version/schema URI, severity-to-level mapping, `cydetix/v1` partial fingerprints, source-root-relative locations, evidence-path code flows, and fixes only for exact concrete `SAFE` findings.                                                                                                                                                                                          |
| Cydetix SARIF extensions                          | `STABLE`       | Existing rule and result property names and meanings, including proof state, analysis completeness, confidence, reachability, remediation assessment/class, verification state, impact, and evidence-path length. Additive properties are compatible; removing, renaming, narrowing, or silently changing meaning is not. Diagnostic invocation properties not named here are `EXPERIMENTAL`. |
| Rule IDs                                          | `STABLE`       | A public rule ID remains the same security-invariant identity. Retirement requires formal deprecation; an ID is not reused for a different invariant.                                                                                                                                                                                                                                         |
| Rule versions and semantics                       | `STABLE`       | Evidence anchors, applicability, proof requirements, default severity, false-positive correction, and remediation ceiling are reviewed explicitly. A material semantic change advances the rule version and is documented.                                                                                                                                                                    |
| Proof states                                      | `STABLE`       | Exactly `PROVEN_SECURE`, `PROVEN_INSECURE`, `UNKNOWN`, and `NOT_APPLICABLE`. Unsupported, ambiguous, incomplete, bounded, truncated, or failed analysis cannot silently become `PROVEN_SECURE`.                                                                                                                                                                                               |
| Remediation classes                               | `STABLE`       | Exactly `SAFE`, `REVIEW_REQUIRED`, and `ARCHITECTURAL`. Authority cannot silently increase; a higher-authority transition requires explicit review, rule-version treatment, tests, and release documentation.                                                                                                                                                                                 |
| MCP transport and tools                           | `STABLE`       | Local stdio JSON-RPC, canonical project-root narrowing, exact runtime-version binding, bounded requests, and exactly `cydetix_scan`, `cydetix_fix`, and `cydetix_explain` with their documented strict input schemas and mutation requirements.                                                                                                                                               |
| Agent Skills and host adapters                    | `EXPERIMENTAL` | Skill wording, passive host detection, and host-specific configuration locations. They cannot add rules, proof, authority, network bootstrap, shell indirection, or target-code execution. Host invocation and UI behavior remain best effort.                                                                                                                                                |
| `.cydetix.json`                                   | `STABLE`       | Strict data-only schema version `1.0.0`, documented keys, bounds, and suppression fields. Unknown keys and executable configuration remain rejected.                                                                                                                                                                                                                                          |
| Setup-generated host configuration                | `EXPERIMENTAL` | Adapter file layouts may track host changes; exact Node/entrypoint/version/root binding and no npm/npx/shell/network bootstrap are invariant safety requirements.                                                                                                                                                                                                                             |
| Node support                                      | `STABLE`       | `^22.18.0                                                                                                                                                                                                                                                                                                                                                                                     |     | ^24.11.0` for V1 unless a documented compatibility change narrows or extends support. |
| npm CLI/bin                                       | `STABLE`       | The `cydetix` executable at the package bin boundary.                                                                                                                                                                                                                                                                                                                                         |
| Programmatic JavaScript/TypeScript API            | `INTERNAL`     | No root JS API is supported. `dist/**`, MCP implementation modules, implementation declarations, and source modules are not public imports. CommonJS/ESM code must not import them.                                                                                                                                                                                                           |
| Exported data subpaths                            | `STABLE`       | ESM and CommonJS consumers may load the five enumerated JSON schemas and `cydetix/package.json`; no other package subpath is public.                                                                                                                                                                                                                                                          |
| Public TypeScript types                           | `INTERNAL`     | No supported TypeScript import surface exists in V1. Types embedded in stable JSON schemas define structured data; emitted internal declarations do not create a contract.                                                                                                                                                                                                                    |
| Release/readiness scripts and evidence generators | `INTERNAL`     | Repository governance implementation is not an npm consumer API, although published evidence remains auditable.                                                                                                                                                                                                                                                                               |

## Explicit npm export boundary

The only supported package imports are:

- `cydetix/schemas/scan-report.schema.json`
- `cydetix/schemas/finding.schema.json`
- `cydetix/schemas/rule.schema.json`
- `cydetix/schemas/remediation-report.schema.json`
- `cydetix/schemas/cyclonedx-1.7.schema.json`
- `cydetix/package.json`

The package has no `.` programmatic export. The CLI remains available through the `cydetix` bin.
Both ESM JSON import attributes and CommonJS JSON loading are tested on supported Node lines. The
explicit `exports` map intentionally makes previously possible undocumented deep `dist` and schema
imports fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`. Because those imports were never documented as a
supported API and this boundary is being established before V1, they receive no V1 compatibility
guarantee.

## Security-analysis guarantee boundary

Stable interfaces do not imply complete vulnerability coverage. V1 may guarantee deterministic,
bounded, fail-closed behavior for documented supported patterns. It cannot claim whole-program or
deployed-runtime proof, universal parser/framework coverage, corpus-wide recall, zero false
positives/negatives, credential validity, or cross-host performance. `UNKNOWN`, `TRUNCATED`, the
narrow npm-only dependency inventory, passive secret analysis, the single SAFE adapter, Docker host
assumptions, and best-effort agent-host integrations remain documented limitations.

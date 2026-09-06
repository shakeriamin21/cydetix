# Contributing

Contributions must preserve the untrusted-repository boundary and make no unsupported security
claims.

## Setup

```powershell
npm ci --ignore-scripts
npm run build
npm run verify
```

Use Node.js 22.18+ within Node 22 or 24.11+ within Node 24. `npm run verify` includes formatting,
lint, typechecking, tests, generated schema/catalogue checks, SARIF/CycloneDX validation,
remediation, skills/plugin, version, package, release-report, and public-tree checks. Do not add
lifecycle scripts, floating dependency versions, telemetry, or network behavior without an ADR and
security review. New dependencies require a reason, license review, exact lock update, and
consideration of a smaller adapter or standard-library implementation.

## Changes

- Add or update an ADR for durable architecture/security decisions.
- Use `apply_patch`-sized reviewable changes; do not reformat unrelated files.
- Preserve public schema compatibility or explicitly version the contract.
- Treat fixture credentials as synthetic; use conspicuously fake values and assert redaction.
- Add tests for Windows path behavior when touching the filesystem boundary.
- Update coverage and support documentation when adding or removing an engine.

## Rule contributions

Follow [RULE_AUTHORING.md](RULE_AUTHORING.md). A detector needs versioned metadata, concrete
evidence, standards mappings, a vulnerable fixture, a secure negative fixture, unit/integration
tests, and a documented remediation class. Large alert volume is not a substitute for precision.

## Pull request gate

`npm run verify` must pass. Review the package tarball with `npm pack --dry-run`. Security-sensitive
changes require an explicit discussion of false positives, false negatives, path boundaries, data
exposure, and mutation behavior.

Pull-request contributors are untrusted. PR workflows must not receive publishing credentials,
release-environment access, privileged cloud tokens, or an npm identity. Do not add
`pull_request_target` execution, release triggers, or automatic publication as a workaround for CI.
The tag-triggered release workflow has a separate protected environment and must fail closed.

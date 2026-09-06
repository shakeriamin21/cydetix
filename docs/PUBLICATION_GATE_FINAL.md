# Cydetix publication gate

Checked: 2026-09-06

`cydetix@0.6.0-alpha.1` exists on npm. The tagged alpha.2 GitHub Actions attempt failed at
`validate:publication-config` before npm publication. This alpha.3 preparation does not publish,
push, create or modify tags, or create a GitHub release.

## Identity state

| Gate                              | State                       | Evidence                                        |
| --------------------------------- | --------------------------- | ----------------------------------------------- |
| Display/package/CLI alignment     | IMPLEMENTED                 | `Cydetix` / `cydetix` / `cydetix`               |
| Exact npm registry lookup         | EXISTS                      | `cydetix@0.6.0-alpha.1`, checked 2026-09-06     |
| npm package registration          | ESTABLISHED                 | Exact unscoped package returned by npm          |
| Obvious exact-name web collision  | NOT_FOUND_IN_LIMITED_SEARCH | Four exact-name queries returned no results     |
| Trademark/exclusivity clearance   | NOT_CLAIMED                 | No legal conclusion was performed               |
| Scoped fallback                   | FORBIDDEN                   | A different identity requires explicit approval |
| Alpha.3 publication authorization | NOT_GRANTED                 | This preparation explicitly forbids publication |

## Local preparation gates

Before GitHub bootstrap, the handoff must record passing format, lint, type, schema, unit,
integration, remediation, sandbox, package, skill, plugin, MCP, trigger, privacy, license, OSV,
CycloneDX, workflow, and packed-install checks. The packed artifact must prove the Cydetix launcher,
default scan, setup/status, machine output, remediation, and MCP surface.

## External release gates

- Verify branch/tag protections, private vulnerability reporting, the protected `release`
  environment, and required hosted Windows/Linux/macOS checks on `shakeriamin21/cydetix`.
- Recheck the exact unscoped npm package and stop if ownership/control or identity no longer
  matches.
- Complete the operator's legal/brand review; no source document provides trademark clearance.
- Independently confirm npm Trusted Publishing is bound to the exact repository, workflow, and
  release environment.
- Verify live `npx cydetix` and global-install behavior from clean consumers.
- Inspect and publish checksums, SBOM, attestations, plugin archive, and release manifest only after
  all approvals.

No automated workflow may substitute a scoped package or expose an owner in the normal command.

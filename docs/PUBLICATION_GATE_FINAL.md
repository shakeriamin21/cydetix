# Cydetix publication gate

Checked: 2026-09-06

Nothing has been published, pushed, tagged, or released by this phase.

## Identity state

| Gate                             | State                       | Evidence                                        |
| -------------------------------- | --------------------------- | ----------------------------------------------- |
| Display/package/CLI alignment    | IMPLEMENTED                 | `Cydetix` / `cydetix` / `cydetix`               |
| Exact npm registry lookup        | E404_POINT_IN_TIME          | `npm view cydetix --json`, 2026-09-06           |
| npm ownership/reservation        | NOT_ESTABLISHED             | E404 is not ownership                           |
| Obvious exact-name web collision | NOT_FOUND_IN_LIMITED_SEARCH | Four exact-name queries returned no results     |
| Trademark/exclusivity clearance  | NOT_CLAIMED                 | No legal conclusion was performed               |
| Scoped fallback                  | FORBIDDEN                   | A different identity requires explicit approval |
| Publication authorization        | NOT_GRANTED                 | This phase explicitly forbids publication       |

## Local preparation gates

Before GitHub bootstrap, the handoff must record passing format, lint, type, schema, unit,
integration, remediation, sandbox, package, skill, plugin, MCP, trigger, privacy, license, OSV,
CycloneDX, workflow, and packed-install checks. The packed artifact must prove the Cydetix launcher,
default scan, setup/status, machine output, remediation, and MCP surface.

## External release gates

- Create or approve the public repository whose repository name is `cydetix`.
- Configure branch/tag protections, private vulnerability reporting, the protected `release`
  environment, and required hosted Windows/Linux/macOS checks.
- Recheck the exact unscoped npm name and stop on any collision/protection response.
- Complete the operator's legal/brand review; no source document provides trademark clearance.
- Perform a separately authorized first-package bootstrap, then configure npm Trusted Publishing.
- Verify live `npx cydetix` and global-install behavior from clean consumers.
- Inspect and publish checksums, SBOM, attestations, plugin archive, and release manifest only after
  all approvals.

No automated workflow may substitute a scoped package or expose an owner in the normal command.

# VibeShield publication gate

Date: 2026-09-06

## Executive result

**Verdict: NOT_READY_FOR_PUBLICATION**

The source tree targets the unscoped `vibeshield` npm package and `vibeshield` binary. Nothing has
been published. Local packed-artifact checks may establish install and execution behavior, but they
do not establish live registry ownership, hosted operating-system behavior, trademark clearance, or
marketplace acceptance.

## Identity gates

| Gate                                | State                  | Evidence                                                   |
| ----------------------------------- | ---------------------- | ---------------------------------------------------------- |
| Display/package/CLI alignment       | IMPLEMENTED            | `VibeShield` / `vibeshield` / `vibeshield`                 |
| Exact npm registry lookup           | AVAILABLE_UNREGISTERED | `npm view vibeshield --json` returned `E404` on 2026-09-06 |
| npm ownership/reservation           | NOT_ESTABLISHED        | An `E404` result is not ownership                          |
| Active market-name collision review | REQUIRED               | Multiple active VibeShield security products were found    |
| Trademark/exclusivity clearance     | NOT_CLAIMED            | No legal conclusion was requested or performed             |
| Scoped fallback                     | FORBIDDEN              | A different identity requires explicit user approval       |
| Publication authorization           | NOT_GRANTED            | This phase explicitly forbids automatic publication        |

## Local gates

The current zero-friction phase must pass all of the following before source handoff:

- complete format, lint, type, schema, unit, integration, remediation, sandbox, package, plugin,
  skill, MCP, trigger-corpus, privacy, and license validation;
- zero-config `vibeshield` scan from the packed npm artifact;
- packed local npm execution equivalent, optional global install, real `vibeshield` launcher, setup,
  and MCP protocol smoke tests;
- version-pinned integration configuration with clean reconfiguration/uninstall behavior;
- no username or package scope in primary onboarding;
- one public skill with implicit invocation enabled and explicit mutation boundaries.

The final measured outcomes are recorded in
[`ZERO_FRICTION_UX_HANDOFF.md`](ZERO_FRICTION_UX_HANDOFF.md). A local pass does not turn the
publication verdict into READY.

## External gates that remain

- Recheck `vibeshield` immediately before first publish and stop on any collision/protection error.
- Resolve or explicitly accept the active VibeShield market-name conflict with appropriate legal
  review.
- Configure the approved public repository, protected release environment, npm Trusted Publisher,
  provenance, attestations, vulnerability reporting, branch/tag protections, and hosted CI.
- After an authorized real npm registration/publish, verify exactly:

  ```bash
  npx vibeshield --version
  npx vibeshield --help
  npx vibeshield
  npx vibeshield setup
  npm install -g vibeshield
  vibeshield --version
  vibeshield
  vibeshield setup
  ```

No tag, remote, push, GitHub repository, GitHub release, npm publish, marketplace submission, or
plugin publication was performed.

# Dependency maintenance backlog

Observed from live Dependabot pull requests on 2026-09-20. This is a review queue, not approval to
merge or publish. No dependency version is changed by the `1.0.2` maintenance candidate. Every
accepted update must run the complete development, package/install, workflow-security, history,
security, and mandatory Docker gates on its own exact commit.

| PR          | Update                                    | Classification                       | Recommendation              | Reason                                                                                                                           |
| ----------- | ----------------------------------------- | ------------------------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `#1`        | `ossf/scorecard-action` 2.4.3 → 2.4.4     | GitHub Action; patch                 | `MERGE_AFTER_FULL_GATE`     | Stale pre-V1 base and mixed/failing checks; rebase and preserve permissions, pinning, SARIF, and exact-SHA behavior.             |
| `#3`        | TypeScript 6.0.3 → 7.0.2                  | dev dependency; major                | `REQUIRES_MIGRATION_REVIEW` | Stale pre-V1 base and failing matrix; compiler major can alter diagnostics, emit, declarations, and package compatibility.       |
| `#5`        | CodeQL analyze 4.37.4 → 4.37.9            | GitHub Action; patch                 | `MERGE_AFTER_FULL_GATE`     | Stale pre-V1 base and mixed/failing checks; review jointly with the other CodeQL patch PRs after rebase.                         |
| `#6`        | `actions/download-artifact` 8.0.0 → 8.0.1 | GitHub Action; patch                 | `SAFE_PATCH_CANDIDATE`      | Narrow patch on a stale base with mixed/failing checks; rebase and rerun artifact count/path/checksum and workflow gates.        |
| `#7`        | CodeQL upload-sarif 4.37.4 → 4.37.9       | GitHub Action; patch                 | `MERGE_AFTER_FULL_GATE`     | Stale pre-V1 base and mixed/failing checks; review jointly with the other CodeQL patch PRs after rebase.                         |
| `#8`        | CodeQL init 4.37.4 → 4.37.9               | GitHub Action; patch                 | `MERGE_AFTER_FULL_GATE`     | Stale pre-V1 base and mixed/failing checks; review jointly with the other CodeQL patch PRs after rebase.                         |
| `#9`        | Vitest 4.1.11 → 5.0.0                     | dev dependency; major                | `REQUIRES_MIGRATION_REVIEW` | Hosted matrix passed, but the major test-runner change predates stable V1 and needs discovery/isolation/timing migration review. |
| `#10`       | Zod 4.5.4 → 4.6.1                         | runtime dependency; minor            | `REQUIRES_MIGRATION_REVIEW` | All six hosted matrix jobs failed on a stale base; inspect schema/parser and generated-schema effects before any new gate.       |
| `#11`       | typescript-eslint 8.68.0 → 8.70.0         | dev dependency; minor                | `MERGE_AFTER_FULL_GATE`     | Hosted matrix passed on a stale base; rebase and validate the entire tree and generated-source exclusions.                       |
| `#12`       | `@types/node` 26.4.0 → 26.5.1             | type-only dev dependency; minor      | `SAFE_PATCH_CANDIDATE`      | Hosted matrix passed on a stale base; rebase and rerun Node 22/24 compiler and full-package checks.                              |
| closed `#2` | typescript-eslint 8.68.0 → 8.69.0         | dev dependency; superseded           | `OBSOLETE/SUPERSEDED`       | Replaced by open PR `#11`.                                                                                                       |
| closed `#4` | `@types/node` 26.4.0 → 26.4.1             | type-only dev dependency; superseded | `OBSOLETE/SUPERSEDED`       | Replaced by open PR `#12`.                                                                                                       |

Major updates are not bundled. CodeQL component PRs should be reviewed as one compatibility set but
must retain their immutable individual commits/PR histories. Every open PR predates current `main`
(`e06ba195beeb5c3428e65e3f95049b39afa2891c`), so no recorded check result is current-candidate
evidence. “Safe patch candidate” means suitable for review, not pre-approved code or dependency
content.

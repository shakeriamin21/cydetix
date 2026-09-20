# GitHub repository configuration gate

Repository: `shakeriamin21/cydetix` (public; default branch `main`)

This record separates source-controlled controls from external GitHub/npm settings. External state
was queried through the GitHub and npm APIs on 2026-09-20. It can change independently of source and
must be rechecked before publication.

Status meanings:

- `VERIFIED_PASS`: the setting or operational outcome was observed directly.
- `VERIFIED_FAIL`: the required setting was directly observed absent or disabled.
- `NOT_VERIFIED_EXTERNAL`: the available API did not expose enough state to make a claim.
- `NOT_APPLICABLE`: a different documented mechanism intentionally supplies the control.

## Live external state

| Control                                      | Status                  | Evidence / action                                                                                             |
| -------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Public repository and `main` default         | `VERIFIED_PASS`         | Repository API reports public visibility and default branch `main`.                                           |
| `main` branch protection / ruleset           | `VERIFIED_FAIL`         | No repository rulesets; branch protection API returned not protected. Add a recoverable ruleset.              |
| Force-push and branch-deletion protection    | `VERIFIED_FAIL`         | Absent with the missing `main` ruleset.                                                                       |
| Required pull requests and current CI checks | `VERIFIED_FAIL`         | Absent with the missing `main` ruleset. Require the complete CI workflow and current branch.                  |
| Conversation resolution                      | `VERIFIED_FAIL`         | Absent with the missing `main` ruleset.                                                                       |
| `v*` tag protection                          | `VERIFIED_FAIL`         | No tag ruleset/protection was present. Protect immutable release tags from update and deletion.               |
| Secret scanning                              | `VERIFIED_PASS`         | GitHub security settings report enabled; no open secret-scanning alert was returned.                          |
| Push protection                              | `VERIFIED_PASS`         | GitHub security settings report enabled.                                                                      |
| Dependabot alerts                            | `VERIFIED_FAIL`         | Dependabot alerts API reports the feature disabled. Enable it without granting merge/publication authority.   |
| Dependabot security updates                  | `VERIFIED_FAIL`         | Repository security settings report disabled.                                                                 |
| Dependency graph                             | `NOT_VERIFIED_EXTERNAL` | The available API did not provide a conclusive enabled/disabled state. Verify in repository settings.         |
| CodeQL                                       | `VERIFIED_PASS`         | Advanced CodeQL workflow is source controlled and exact-SHA run `35084476327` succeeded for `v1.0.1`.         |
| CodeQL default setup                         | `NOT_APPLICABLE`        | Default setup is not configured because the repository uses the checked-in advanced workflow.                 |
| Private vulnerability reporting              | `VERIFIED_PASS`         | Repository API reports enabled.                                                                               |
| `release` environment exists                 | `VERIFIED_PASS`         | The environment API reports the environment and the workflow binds publication to it.                         |
| `release` environment protection             | `VERIFIED_FAIL`         | No protection rules, reviewers, or deployment-branch policy were configured; administrator bypass is enabled. |
| npm trusted publication works                | `VERIFIED_PASS`         | Stable run `35085779583` used GitHub OIDC; npm `1.0.1` exposes provenance.                                    |
| Exact npm trusted-publisher binding settings | `NOT_VERIFIED_EXTERNAL` | npm publisher UI/account binding details were not exposed by the available API.                               |

The release API reports stable `v1.0.1` as a public, non-prerelease release and Beta.3 as a
historical public prerelease. It also reports one non-public draft left by the failed Alpha.4
workflow. That draft was not edited or deleted during this audit and is not evidence of a published
release.

## Source-controlled controls

- `.github/workflows/ci.yml` runs the Windows/Linux/macOS Node 22.18/24.11 matrix, package and
  install checks, action smoke tests, and mandatory hosted Docker verification.
- `.github/workflows/codeql.yml` provides advanced CodeQL analysis.
- `.github/workflows/scorecard.yml` provides OpenSSF Scorecard analysis.
- `.github/workflows/release.yml` is annotated-tag-only, verifies the exact evidence commit and
  hosted gates, performs complete-history and independent pinned Gitleaks checks, uses the `release`
  environment, and grants npm publication only `id-token: write`.
- `npm run validate:workflow-security` enforces pinned actions, minimal permissions, trusted
  publishing, draft-first release handling, exact-tag/evidence verification, and supply-chain gates.
  GitHub currently allows all actions and does not enforce SHA pinning at repository level; the
  checked-in workflow and validator therefore remain the active pinning controls.

## Required operational hardening

1. Add a recoverable `main` ruleset requiring pull requests, current required CI, and conversation
   resolution while blocking force pushes and deletion.
2. Add a `v*` tag ruleset that prevents deletion or repointing of release tags.
3. Add required reviewer and deployment-branch protections to the `release` environment.
4. Enable Dependabot alerts/security updates and verify the dependency graph.
5. Re-read every external setting and the npm trusted-publisher binding before any future release;
   do not treat this dated audit as release authorization.

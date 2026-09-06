# GitHub repository configuration gate

Repository: **not created or connected**  
Observed hosted state: **NOT_CHECKED**

These settings are operator actions, not properties that source files can enable. Confirm the actual
state after the approved public repository exists.

## Required before the first public alpha

- Make the approved repository public and set `main` as the default branch.
- Enable dependency graph and Dependabot alerts. Keep `.github/dependabot.yml` limited to pull
  requests; dependency automation must never publish.
- Enable secret scanning and push protection where the account/repository makes them available.
- Enable private vulnerability reporting and verify that the repository Security tab offers a
  private report path.
- Enable CodeQL default setup where GitHub supports the repository languages, or record a precise
  reason it is not applicable.
- Create a protected `release` environment with required maintainer approval. Do not store an npm
  token in it.
- Configure npm Trusted Publishing for the approved package, repository, `release.yml` workflow, and
  `release` environment. This requires an existing package registration; treat any first-package
  bootstrap publish as a separate public-publication approval.

## `main` ruleset

Use a recoverable ruleset with the repository owner as an emergency bypass actor:

- require a pull request;
- require the complete `CI` workflow, including all six OS/Node jobs, Action smoke, and hosted
  sandbox job;
- require the branch to be current before merge;
- block force pushes and deletion;
- require conversation resolution;
- keep direct administrator recovery possible and documented.

Signed commits can be added after the sole maintainer has a tested recovery path. Do not enable a
rule that would require rewriting the existing unsigned history merely to improve a posture score.

## Release/tag controls

- Protect `v*` tags against deletion and modification except by the release maintainer.
- Never create a version tag before the release manifest and candidate handoff are complete.
- Require an annotated tag that exactly matches `package.json`; `release.yml` rechecks the tag type,
  commit, version, changelog, release notes, package contents, exact-commit hosted CI, and sandbox.
- Treat GitHub Release publication and Marketplace submission as separate approvals. The first alpha
  does not require Marketplace distribution.

## Evidence to record

After repository creation, record `PASS`, `FAIL`, `NOT_CHECKED`, or `NOT_APPLICABLE` for dependency
graph, Dependabot alerts, secret scanning, push protection, private vulnerability reporting, CodeQL,
branch/tag rules, release environment protection, and trusted publisher configuration. Screenshots
are optional; repository settings/API output with private identifiers removed is preferable.

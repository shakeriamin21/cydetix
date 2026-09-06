# GitHub Actions integration

`action.yml` is a composite first-party action. It installs only locked runtime dependencies with
lifecycle scripts disabled, runs the committed `dist` CLI in offline mode, writes SARIF to a
caller-selected runner path, and returns exit code 1 at the selected threshold. It does not upload
the SARIF.

Example after a release tag exists:

```yaml
name: cydetix
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false
      - uses: OWNER/REPOSITORY@FULL_40_CHARACTER_COMMIT_SHA
        with:
          path: .
          fail-on: high
          output: cydetix.sarif
```

Pin the cydetix action to a full reviewed commit SHA. To upload results to GitHub code scanning, add
a separate `github/codeql-action/upload-sarif` step pinned to a full SHA and grant
`security-events: write`. That is an explicit data-transfer decision and may require GitHub Advanced
Security for private repositories.

The repository's own CI uses minimal read permissions, full-SHA-pinned third-party actions,
`npm ci --ignore-scripts`, the complete verification gate, self-scan with dated fixture
suppressions, a package-content review, and an action smoke test. Release automation adds only the
permissions necessary for a tag-triggered GitHub release and provenance attestation.

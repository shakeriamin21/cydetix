# npm package and Trusted Publishing

Historical registration checked: 2026-09-06. Successful trusted publication: Beta.3, 2026-09-15.

The required coordinate is the exact unscoped package `cydetix`. Beta.3 was published by trusted
release run `34947037844`; no manual publication path is authorized. Registry state is external and
time-varying and must be rechecked before another release. Registration and a successful publication
do not grant authority for a new version, product-name exclusivity, or trademark clearance.

## Stop condition

Immediately before any separately authorized release, query `npm view cydetix --json` again. If the
package is no longer under the expected control, is protected, or conflicts with the approved
identity:

1. stop publication;
2. preserve the exact registry response as evidence;
3. do not use a scoped fallback;
4. do not put an owner or maintainer identity in the ordinary command;
5. present aligned alternative brand/package names and wait for explicit approval.

## Trusted Publishing setup

The package is bound for npm Trusted Publishing to `shakeriamin21/cydetix`,
`.github/workflows/release.yml`, and the protected `release` environment. Require a clean public
commit, hosted OS matrix, sandbox job, repository security settings, final package/plugin/skill/MCP
gates, SBOM, manifest, and checksums. Use only the release workflow's semver-derived dist-tag and do
not add a long-lived npm token to the workflow.

Beta.3 empirically proved the OIDC publication path and provenance configuration. That evidence is
bound to its immutable source/tag/run and does not authorize or validate any later candidate.

References: [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/),
[dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/), and
[provenance](https://docs.npmjs.com/generating-provenance-statements/).

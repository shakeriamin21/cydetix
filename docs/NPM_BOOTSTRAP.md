# npm package and Trusted Publishing

Checked: 2026-09-06

The required coordinate is the exact unscoped package `cydetix`. The exact registry command returned
the existing public package `cydetix@0.6.0-alpha.1` on the check date. This confirms registration,
not authority to publish a new version, product-name exclusivity, or trademark clearance.

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

The package now has a settings page, so an authorized maintainer can bind npm Trusted Publishing to
`shakeriamin21/cydetix`, `.github/workflows/release.yml`, and the protected `release` environment.
Require a clean public commit, hosted OS matrix, sandbox job, repository security settings, final
package/plugin/skill/MCP gates, SBOM, manifest, and checksums. Use the `alpha` dist-tag and do not
add a long-lived npm token to the workflow.

The alpha.3 publication metadata records the maintainer-provided state that Trusted Publishing is
configured. The alpha.2 workflow stopped before publication, and preparing or dry-running alpha.3
does not prove that an OIDC publication succeeded.

References: [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/),
[dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/), and
[provenance](https://docs.npmjs.com/generating-provenance-statements/).

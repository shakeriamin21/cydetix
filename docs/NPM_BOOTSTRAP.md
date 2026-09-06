# npm package bootstrap and Trusted Publishing

Checked: 2026-09-06

The required coordinate is the exact unscoped package `cydetix`. The exact registry command returned
npm `E404 Not Found` on the check date. This is point-in-time evidence only; it does not reserve the
name, establish ownership, authorize publication, or provide trademark clearance.

## Stop condition

Immediately before any separately authorized bootstrap, query `npm view cydetix --json` again. If
the package exists, is protected, cannot legitimately be registered, or conflicts with the approved
identity:

1. stop publication;
2. preserve the exact registry response as evidence;
3. do not use a scoped fallback;
4. do not put an owner or maintainer identity in the ordinary command;
5. present aligned alternative brand/package names and wait for explicit approval.

## Authorized first registration

A first registration must publish the reviewed alpha, not a dummy reservation. Require a clean
public commit, hosted OS matrix, sandbox job, repository security settings, final
package/plugin/skill/MCP gates, SBOM, manifest, and checksums. Compare the reviewed tarball hash
before upload, use the `alpha` dist-tag, and never commit or retain a bootstrap credential.

After the package settings page exists, bind npm Trusted Publishing to the approved repository,
`.github/workflows/release.yml`, and protected `release` environment. Revoke any bootstrap
credential. Only then may release metadata say registration and Trusted Publishing are configured.

References: [npm Trusted Publishers](https://docs.npmjs.com/trusted-publishers/),
[dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/), and
[provenance](https://docs.npmjs.com/generating-provenance-statements/).

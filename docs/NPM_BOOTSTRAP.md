# npm package bootstrap and Trusted Publishing

Checked: 2026-09-06

The requested coordinate is the exact unscoped package `vibeshield`. `npm view vibeshield --json`
returned npm `E404 Not Found` from `registry.npmjs.org` on the check date. That is only a
point-in-time observation: it does not reserve the name, prove ownership, or authorize publication.

The VibeShield name also has multiple active uses in the security market. No trademark clearance,
exclusivity, freedom to operate, or lack of consumer confusion is claimed. Both the registry name
and the broader product-name conflict are publication gates.

## Stop condition

Immediately before any authorized bootstrap, query the exact unscoped name again. If it exists, is
protected, cannot legitimately be registered, or conflicts with the approved identity decision:

1. stop publication;
2. preserve the registry response as evidence;
3. do not publish a scoped fallback;
4. do not place an owner or maintainer identity in the ordinary command;
5. present alternative aligned brand/package names and wait for explicit user approval.

## One-time registration

If the exact name remains legitimately usable, a first-package bootstrap still requires separate
authorization. Before it:

1. require a clean public commit, hosted OS matrix, sandbox job, package/plugin/skill/MCP gates,
   security settings, final manifest, and checksums;
2. compare the reviewed tarball SHA-256 with `SHA256SUMS` and inspect `npm pack --dry-run`;
3. confirm that only the `alpha` dist-tag will be assigned;
4. use npm web authentication and 2FA, with a shortest-lived granular credential only if required;
5. never commit, log, or retain a bootstrap credential.

The bootstrap is a real public alpha, not a dummy name reservation. Immediately verify registry
metadata, integrity/provenance, and the exact `npx vibeshield` and optional global flows from clean
consumers.

## Trusted Publishing

After the package settings page exists, bind npm Trusted Publishing to the exact approved
repository, `.github/workflows/release.yml`, and protected `release` environment. Revoke bootstrap
credentials. Set `npmPackageRegistration` to `EXISTS` and `npmTrustedPublisher` to `CONFIGURED` only
after the npm UI confirms both. Subsequent prereleases use the tag-controlled workflow and `alpha`
dist-tag.

Publishing and rollback are not atomic across npm and GitHub. Follow
`docs/RELEASE_INCIDENT_RESPONSE.md` for partial releases or incidents. No publication occurred in
this phase.

References:

- <https://docs.npmjs.com/trusted-publishers/>
- <https://docs.npmjs.com/adding-dist-tags-to-packages/>
- <https://docs.npmjs.com/generating-provenance-statements/>

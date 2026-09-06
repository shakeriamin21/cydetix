# Public-alpha release procedure

The release workflow is prepared, not authorized. Do not create a tag, push, publish npm, create a
public GitHub Release, or submit either Marketplace listing until the user separately approves
publication.

## Trusted-publishing trust model

The prepared release workflow uses a protected GitHub-hosted `release` environment and npm Trusted
Publishing through OIDC. No long-lived `NPM_TOKEN` is accepted by that workflow. npm currently
requires CLI 11.5.1+ and Node 22.14+ for trusted publishing; the workflow uses supported Node 24 and
checks the npm CLI before publishing. The approved public `package.json` repository URL must exactly
match the GitHub repository configured at npm.

Trusted Publishing does not solve first registration of an unused npm coordinate. npm's documented
setup starts from the package settings page, where the maintainer selects a trusted publisher. An
`E404` package has no such settings page. Therefore publication remains blocked until the approved
coordinate is checked again and one of these conditions is explicitly approved:

- the chosen package already exists under the maintainer's control and can be bound to
  `.github/workflows/release.yml`; or
- the maintainer separately authorizes and performs a one-time, 2FA-protected bootstrap publish,
  reviews its exact artifacts and dist-tag, then configures OIDC for later versions.

Do not add a temporary long-lived npm token to `release.yml`, and do not publish a dummy or
squatting version merely to make the OIDC gate green. A bootstrap publish is itself public
publication and is outside Codex's current authority.

The first version of a new npm package cannot use npm staged publishing because npm requires the
package to exist before staging. If `vibeshield` remains unregistered, the first approved alpha is
the separately authorized bootstrap publication under `--tag alpha`, not `latest`; it must not be
described as Trusted Publishing. See [the npm bootstrap plan](../NPM_BOOTSTRAP.md). Later versions
use OIDC after the package settings exist.

GitHub attestations and npm provenance establish artifact/source/build relationships. They do not
prove that the software is vulnerability-free, complete, or production-ready.

## Candidate preparation—no tag

From a clean reviewed source commit:

```powershell
npm ci --ignore-scripts
npm run audit
$env:VIBESHIELD_SANDBOX_IMAGE = "sha256:1b2479dd35a99687d6638f5976fd235e26c5b37e8122f786fcd5fe231d63de5b"
npm run verify
npm run release:self-scan
npm run validate:online-osv
npm run release:artifacts
npm run validate:install
npm run validate:packed-plugin
npm run audit:history -- --enforce
git diff --check
git status --short
```

The history enforcement and publication-configuration gate must remain blocking until the public
repository, private-reporting, package-registration, Trusted Publishing, and clean-history checks
are complete. Do not weaken these checks to obtain a green result.

## Required external setup

1. Review `docs/PUBLIC_IDENTITY_DECISION.md`. The selected identity is recorded in
   `release/publication-config.json`; the GitHub owner/repository remains unset.
2. Create the approved public repository only after separate authorization, then apply
   `docs/GITHUB_REPOSITORY_CONFIGURATION.md`.
3. Confirm the six-case hosted CI matrix, Action smoke, hosted Linux sandbox, and OpenSSF Scorecard
   pass on the exact candidate commit.
4. Enable GitHub private vulnerability reporting.
5. Create a protected `release` environment with a required reviewer.
6. Recheck `vibeshield` directly at npm. If it remains unregistered, obtain separate approval for a
   one-time 2FA-protected publication of the exact reviewed alpha tarball under the `alpha`
   dist-tag. Use the shortest-lived practical credential, do not commit it, and revoke/log out
   immediately afterward.
7. After the package exists, configure the npm trusted publisher with the exact GitHub owner,
   repository, workflow filename `release.yml`, and environment `release`. Require 2FA, remove any
   bootstrap credential, and restrict token publishing where operationally appropriate. Update the
   fail-closed publication state; do not represent the bootstrap publication as Trusted Publishing.
8. Verify the candidate handoff and release manifest say `READY_FOR_USER_PUBLICATION_APPROVAL` with
   zero blockers.

## Publication after explicit approval

Only after those gates and explicit user approval:

```powershell
git switch main
git pull --ff-only
git rev-parse HEAD
git status --short
git tag -a v0.6.0-alpha.1 -m "VibeShield v0.6.0-alpha.1"
git show --no-patch --decorate v0.6.0-alpha.1
git push origin v0.6.0-alpha.1
```

The tag triggers `.github/workflows/release.yml`. It re-verifies the approved identity, annotated
tag, exact commit, successful hosted workflows, sanitized history, independent secret scan, npm
audit, online OSV, all ordinary and container tests, package contents, clean installation, plugin,
SBOM, checksums, and manifest. The protected publication job then:

1. downloads and verifies the exact build output;
2. generates GitHub build and CycloneDX SBOM attestations;
3. creates a non-public draft prerelease;
4. publishes the npm tarball through OIDC under the `alpha` dist-tag;
5. publishes the GitHub draft as a prerelease only after npm succeeds.

This ordering reduces partial publication but cannot make two registries atomic. If npm succeeds and
the GitHub finalization fails, keep the draft and follow `docs/RELEASE_INCIDENT_RESPONSE.md`.

## Consumer verification

After actual publication, download the assets and compare `SHA256SUMS`. Verify GitHub build
attestations with:

```powershell
gh attestation verify <artifact> --repo <owner/repository>
```

Verify the SBOM attestation with the predicate type reported by the release workflow. Use only the
registry-verified package coordinate and `@alpha` dist-tag; never infer publication from this source
tree alone.

Current references:

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/)
- [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
- [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)

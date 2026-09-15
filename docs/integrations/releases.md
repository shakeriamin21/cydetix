# Prerelease and stable release procedure

Beta.3 is the current immutable published prerelease. The current Beta.4 development candidate and
any future stable release are not authorized by this document. Do not create a tag, publish npm,
create a GitHub Release, or submit a Marketplace listing until the user separately approves that
exact candidate.

## Trusted-publishing trust model

The release workflow uses a protected GitHub-hosted `release` environment and npm Trusted Publishing
through OIDC. No long-lived `NPM_TOKEN` is accepted by that workflow. npm currently requires CLI
11.5.1+ and Node 22.14+ for trusted publishing; the workflow uses supported Node 24 and checks the
npm CLI before publishing. The approved public `package.json` repository URL must exactly match the
GitHub repository configured at npm.

Beta.3 trusted release run `34947037844` succeeded through npm OIDC publication and GitHub release
finalization. That evidence is bound to the immutable Beta.3 tag/commit and does not authorize a
future release. Registry state and the external trusted-publisher binding must be rechecked for the
next exact candidate. Historical failed attempts remain recorded in immutable release history.

Do not add a temporary long-lived npm token to `release.yml`. See
[the npm package and Trusted Publishing plan](../NPM_BOOTSTRAP.md).

GitHub attestations and npm provenance establish artifact/source/build relationships. They do not
prove that the software is vulnerability-free, complete, or production-ready.

## Candidate preparation—no tag

From a clean reviewed source commit:

```powershell
npm ci --ignore-scripts
npm run audit
$env:CYDETIX_SANDBOX_IMAGE = "node@sha256:1b2479dd35a99687d6638f5976fd235e26c5b37e8122f786fcd5fe231d63de5b"
npm run verify:development
npm run release:self-scan
npm run validate:online-osv
npm run release:artifacts
npm run release:evidence
npm run validate:release-report
npm run audit:history -- --enforce --ref HEAD
git diff --check
git status --short
```

Release validation reports are versioned at
`validation/releases/v<package-version>/validation-report.json`. For a new version with no current
report, the first untagged `release:artifacts` run creates only an explicitly
`NOT_READY_FOR_PUBLICATION` bootstrap input set. `release:evidence` then generates the current
report from those executed inputs. Commit that report as the sole change immediately following its
recorded source commit. From that clean report commit, run `npm run verify`, rerun
`npm run release:artifacts`, add the current report with `npm run release:validation-artifact`, and
repeat the packed-install/plugin and history gates. A tag context never permits missing current
evidence.

`--ref HEAD` resolves one candidate commit and audits every ancestor reachable from it. The release
workflow instead passes its already validated `refs/tags/<version>` ref explicitly. Unrelated branch
tips cannot change a tagged commit's privacy result, but merged side-branch commits remain reachable
and are audited. Maintainers can separately run `npm run audit:history -- --enforce --all` when they
intend to audit every fetched ref. The independent Gitleaks release step continues to scan complete
history.

The history enforcement and publication-configuration gate must remain blocking until the public
repository, private-reporting, package-registration, Trusted Publishing, and clean-history checks
are complete. Do not weaken these checks to obtain a green result.

## Required external setup

1. Review `docs/PUBLIC_IDENTITY_DECISION.md`. The selected identity and `shakeriamin21/cydetix`
   repository are recorded in `release/publication-config.json`.
2. Apply and verify `docs/GITHUB_REPOSITORY_CONFIGURATION.md` on the existing repository.
3. Confirm the six-case hosted CI matrix, Action smoke, hosted Linux sandbox, and OpenSSF Scorecard
   pass on the exact candidate commit.
4. Enable GitHub private vulnerability reporting.
5. Create a protected `release` environment with a required reviewer.
6. Recheck `cydetix` directly at npm and verify expected control of the existing package.
7. Confirm the npm trusted publisher uses the exact GitHub owner, repository, workflow filename
   `release.yml`, and environment `release`. Require 2FA and restrict token publishing where
   operationally appropriate. Update the fail-closed publication state only from verified evidence.
8. Verify the candidate release manifest says `READY_FOR_USER_PUBLICATION_APPROVAL` with zero
   blockers.

## Publication after explicit approval

Only after those gates and explicit user approval:

```powershell
git switch main
git pull --ff-only
git rev-parse HEAD
git status --short
git tag -a "v<approved-version>" -m "Cydetix v<approved-version>"
git show --no-patch --decorate "v<approved-version>"
git push origin "v<approved-version>"
```

The tag triggers `.github/workflows/release.yml`. It re-verifies the approved identity, annotated
tag, exact commit, successful hosted workflows, sanitized history, independent secret scan, npm
audit, online OSV, all ordinary and container tests, package contents, clean installation, plugin,
SBOM, checksums, and manifest. The protected publication job then:

1. downloads and verifies the exact build output;
2. generates GitHub build and CycloneDX SBOM attestations;
3. creates a non-public draft prerelease;
4. publishes the npm tarball through OIDC under the semver-derived prerelease or stable dist-tag;
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
registry-verified package coordinate and intended dist-tag; never infer publication from a source
tree alone.

Current references:

- [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm dist-tags](https://docs.npmjs.com/adding-dist-tags-to-packages/)
- [npm staged publishing](https://docs.npmjs.com/staged-publishing/)
- [GitHub artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations)

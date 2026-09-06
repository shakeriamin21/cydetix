# Release incident response

This procedure is manual and fail-closed. Do not automate destructive rollback or rewrite public
history without an incident lead's explicit decision.

## Immediate containment

1. Stop the release workflow and disable the npm trusted publisher or GitHub release environment if
   the release identity may be compromised.
2. Preserve workflow logs, the release manifest, checksums, attestations, package tarball, SBOM, and
   affected commit IDs. Restrict evidence that contains sensitive data.
3. Determine whether npm, GitHub assets, source history, dependencies, or scanner results are
   affected. Do not label an uninvestigated artifact safe.
4. Publish a concise advisory through a trusted channel when users need immediate protective action.

## Incident-specific actions

### Accidentally published secret

Revoke and rotate it at the provider first, review access logs, disable affected workflows, and stop
publication. Removing the value from HEAD is insufficient. Decide separately whether coordinated
Git-history rewriting and cached-artifact removal are required.

### Malicious dependency or bad package contents

Deprecate the affected npm version with a specific warning, remove it from favorable dist-tags, and
publish a new version only after the normal gates pass. npm registry versions are immutable and an
unpublished `package@version` cannot be reused. Unpublish only when the current npm policy permits
it and the security/reliability impact justifies destructive removal.

### Broken security fix or widespread false Critical

Deprecate the affected version if users should not install it, publish corrected guidance, preserve
the finding evidence that caused the error, and issue a new prerelease version. Do not silently
change rule semantics under an existing artifact.

### Compromised workflow or incorrect provenance

Disable the workflow/trusted-publisher binding, invalidate compromised credentials if any, identify
every run from the affected workflow revision, and mark its releases untrusted. Delete or revoke
attestations only after preserving incident evidence and publishing replacement verification
instructions. A new provenance statement does not rehabilitate mismatched old bytes.

## npm and GitHub recovery policy

npm normally recommends deprecation when removal would break dependents. Its current policy allows
some unpublishing within 72 hours, but removal is irreversible, the version can never be reused, and
complete package removal delays republishing under the same name. Review the current
[npm unpublish policy](https://docs.npmjs.com/policies/unpublish/) during the incident.

For GitHub, convert a bad public release to a clearly marked advisory state or remove affected
assets only as part of a documented response. Never retarget the release tag. Publish corrected
artifacts under a new version and new annotated tag.

## Recovery

Run the entire release gate from a reviewed clean commit, verify the incident root cause and
containment, rotate any affected identity, generate new artifacts/SBOM/checksums/attestations, and
obtain a new explicit publication approval. Close with a public post-incident summary when doing so
does not expose users or ongoing investigations.

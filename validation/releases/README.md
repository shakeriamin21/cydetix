# Versioned release evidence

Current release-validation reports live at:

`validation/releases/v<package-version>/validation-report.json`

The current report is generated from executed checks. It is resolved from `package.json`, must name
the same product and version, and must identify the source commit against which it was generated. A
committed report is accepted only when it is the sole change in the commit immediately following
that source commit. Release-context validation separately requires a clean exact tagged checkout.

`release-history.json` records the annotated object and peeled target of each accepted historical
release tag. A historical tag is accepted only while both identities match. An unregistered release
tag is rejected unless it is the current version's annotated tag, the caller explicitly supplies
that exact tag-release context, and it targets HEAD.

Historical evidence snapshots are copied without normalization from their immutable tagged source.
Development validation compares each snapshot byte-for-byte and by SHA-256 with the path recorded in
the corresponding tag target. A current report is never substituted for a historical snapshot.

The initial current report for a new version is prepared in two fail-closed stages:

1. Run the complete development checks and evidence-producing commands.
2. Run `npm run release:artifacts` without a tag to create an explicitly non-publication-ready
   bootstrap artifact set when the current report does not yet exist.
3. Run `npm run release:evidence` to generate the versioned report from those executed inputs.
4. Validate and commit only that report after its source commit is fixed.
5. Rerun the complete verification and release-artifact gates from the clean report commit.

A tag release never permits the bootstrap state: current versioned evidence is mandatory before
release artifacts can be built.

`v0.6.0-alpha.12` is an immutable failed release attempt. Its annotated tag object is
`c03f2a1e72af312266f68d66ac4183e0c00511bd`, its target is
`5bf295f53f4ca912a79715fd1ea455a31b72a585`, and trusted release run `34821381636` stopped during
verification before publication. No alpha.12 npm package or public GitHub release was created.

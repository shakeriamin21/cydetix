# Public identity decision

Checked: 2026-09-06

The final requested public identity is:

- display name: **Cydetix**
- tagline: **Security for AI-built software.**
- npm package: `cydetix`
- CLI binary: `cydetix`
- GitHub repository: `shakeriamin21/cydetix`
- primary Agent Skill/plugin ID: `cydetix`
- MCP server: **Cydetix**
- public MCP tools: `cydetix_scan`, `cydetix_fix`, and `cydetix_explain`

All earlier unpublished candidate names and public aliases were removed. Stable `AS-*` security rule
IDs remain unchanged because they identify security semantics, not product branding.

## npm evidence

`npm view cydetix --json` queried the npm registry on 2026-09-06 and returned the existing public
package `cydetix@0.6.0-alpha.1`. Both `alpha` and `latest` pointed to that version at the time of
the check.

This confirms package registration, not product-name exclusivity, trademark clearance, or authority
to publish a later version. The exact query must be repeated before an authorized release. No scoped
fallback is approved.

## Market and legal evidence

Four exact-name web searches for Cydetix in security, cybersecurity, software, and trademark
contexts returned no results on 2026-09-06. This is only a limited ordinary-web-search observation.
No trademark search, legal clearance, exclusivity opinion, freedom-to-operate analysis, or consumer-
confusion analysis has been completed. No exclusivity is claimed.

## Publication decision

`cydetix@0.6.0-alpha.1` is public. The tagged alpha.2 GitHub Actions attempt stopped at
`validate:publication-config` and did not publish to npm. This alpha.3 preparation records the
maintainer-provided state that npm Trusted Publishing and private vulnerability reporting are
configured, but does not authorize or perform publication. Hosted validation and legal/brand review
remain fail-closed gates unless separately verified and approved.

# Cydetix Codex plugin

This package exposes one user-facing `cydetix` skill and the first-party local stdio MCP server. The
MCP command is pinned to the plugin version and inherits the deterministic engine's offline, path,
sandbox, and explicit-mutation boundaries.

Validate the source package from the repository root:

```powershell
npm run validate:skills
npm run validate:plugin
npm run release:artifacts
npm run validate:packed-plugin
```

The release artifact is `cydetix-codex-plugin-0.6.0-alpha.2.tar.gz` with its SHA-256 recorded in the
release manifest and `SHA256SUMS`. The repository catalog entry is in
`.agents/plugins/marketplace.json`; it is installable from a reviewed public repository ref only
after that repository exists. Marketplace publication is not claimed.

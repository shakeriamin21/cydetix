# Cydetix Codex plugin

This package exposes one user-facing `cydetix` skill. Executable MCP configuration is intentionally
created only by explicit `cydetix setup`, which can verify and pin the machine's canonical Node
executable, persistent Cydetix JS entrypoint, exact version, and project root. The portable plugin
does not ship an npm/npx, PATH-based, network-backed, or placeholder runtime command.

Validate the source package from the repository root:

```powershell
npm run validate:skills
npm run validate:plugin
npm run release:artifacts
npm run validate:packed-plugin
```

The release artifact is `cydetix-codex-plugin-0.6.0-alpha.6.tar.gz` with its SHA-256 recorded in the
release manifest and `SHA256SUMS`. The repository catalog entry is in
`.agents/plugins/marketplace.json`; it is installable from a reviewed public repository ref only
after that repository exists. Marketplace publication is not claimed.

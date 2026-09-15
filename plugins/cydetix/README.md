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

Versioned plugin archives use `cydetix-codex-plugin-<version>.tar.gz`; their SHA-256 is recorded in
the release manifest and `SHA256SUMS`. Beta.3 is the current immutable released archive; Beta.4 is
an untagged stabilization candidate. The repository catalog entry is in
`.agents/plugins/marketplace.json`; it is installable from a reviewed public repository ref only
after that repository exists. Marketplace publication is not claimed.

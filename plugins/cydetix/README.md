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
the release manifest and `SHA256SUMS`. `v1.0.1` is the current immutable published release archive;
the source tree prepares an untagged, unpublished `1.0.2` maintenance candidate. The repository
catalog entry is in `.agents/plugins/marketplace.json` and may be installed only from a reviewed
public repository ref. Marketplace submission or publication is not claimed.

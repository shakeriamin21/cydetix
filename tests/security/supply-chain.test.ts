import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT } from "../../src/core/brand.js";

interface PackageManifest {
  readonly version: string;
  readonly dependencies: Record<string, string>;
  readonly devDependencies: Record<string, string>;
  readonly scripts: Record<string, string>;
}

describe("development supply chain", () => {
  it("locks direct dependencies and defines no lifecycle scripts", async () => {
    const manifest = JSON.parse(
      await readFile(path.resolve("package.json"), "utf8"),
    ) as PackageManifest;
    for (const version of [
      ...Object.values(manifest.dependencies),
      ...Object.values(manifest.devDependencies),
    ]) {
      expect(version).toMatch(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
    }
    expect(manifest.scripts.preinstall).toBeUndefined();
    expect(manifest.scripts.install).toBeUndefined();
    expect(manifest.scripts.postinstall).toBeUndefined();
    expect(PRODUCT.version).toBe(manifest.version);
  });

  it("pins every external GitHub Action to a full commit SHA", async () => {
    const workflowPaths = [
      "action.yml",
      ".github/workflows/ci.yml",
      ".github/workflows/release.yml",
    ];
    for (const workflowPath of workflowPaths) {
      const content = await readFile(path.resolve(workflowPath), "utf8");
      for (const match of content.matchAll(/^\s*uses:\s*([^\s#]+).*$/gm)) {
        const reference = match.at(1);
        if (reference === undefined || reference.startsWith("./")) continue;
        expect(reference, workflowPath).toMatch(/^[^@\s]+@[0-9a-f]{40}$/);
      }
    }
  });
});

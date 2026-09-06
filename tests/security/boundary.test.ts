import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createBoundary, resolveInside } from "../../src/repository-discovery/boundary.js";
import { DEFAULT_CONFIG } from "../../src/repository-discovery/config.js";
import { traverseRepository } from "../../src/repository-discovery/traverse.js";
import { temporaryDirectory } from "../helpers/temporary.js";

describe("repository boundary", () => {
  it("rejects traversal outside the selected root", async () => {
    const root = await temporaryDirectory("cydetix-boundary-");
    const boundary = await createBoundary(root);
    expect(() => resolveInside(boundary, "../outside.txt")).toThrow(/escapes repository root/);
    expect(() => resolveInside(boundary, path.resolve(root, "absolute.txt"))).toThrow(/absolute/);
  });

  it("does not follow a symlink that points outside the root", async () => {
    const parent = await temporaryDirectory("cydetix-symlink-");
    const root = path.join(parent, "repo");
    const outside = path.join(parent, "outside");
    await mkdir(root);
    await mkdir(outside);
    await writeFile(
      path.join(outside, "secret.ts"),
      "const DATABASE_PASSWORD = 'outside-value-not-for-scan-000';\n",
    );
    try {
      await symlink(
        outside,
        path.join(root, "escape"),
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    const traversal = await traverseRepository(await createBoundary(root), DEFAULT_CONFIG);
    expect(traversal.files).toEqual([]);
    expect(traversal.baseManifest.skipped).toContainEqual({ path: "escape", reason: "symlink" });
  });

  it("skips archives, binary input, and files over the configured limit", async () => {
    const root = await temporaryDirectory("cydetix-limits-");
    await writeFile(path.join(root, "payload.zip"), "not expanded");
    await writeFile(path.join(root, "binary.dat"), Buffer.from([0, 1, 2, 3]));
    await writeFile(path.join(root, "large.ts"), "x".repeat(1025));
    const traversal = await traverseRepository(await createBoundary(root), {
      ...DEFAULT_CONFIG,
      maxFileBytes: 1024,
    });
    expect(traversal.files).toEqual([]);
    expect(traversal.baseManifest.skipped).toEqual(
      expect.arrayContaining([
        { path: "payload.zip", reason: "archive" },
        { path: "binary.dat", reason: "binary" },
        { path: "large.ts", reason: "too_large" },
      ]),
    );
  });
});

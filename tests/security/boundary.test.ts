import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createBoundary,
  dangerousRepositoryPath,
  resolveInside,
} from "../../src/repository-discovery/boundary.js";
import { DEFAULT_CONFIG } from "../../src/repository-discovery/config.js";
import { traverseRepository } from "../../src/repository-discovery/traverse.js";
import { temporaryDirectory } from "../helpers/temporary.js";

describe("repository boundary", () => {
  it("rejects absolute paths under every supported platform syntax", async () => {
    const root = await temporaryDirectory("cydetix-boundary-");
    const boundary = await createBoundary(root);
    const absolutePaths = [
      "/etc/passwd",
      path.resolve(root, "absolute.txt"),
      "C:\\escape\\absolute.txt",
      "C:/escape/absolute.txt",
      "\\\\server\\share\\escape.txt",
      "\\\\?\\C:\\escape\\device.txt",
      "\\\\.\\pipe\\cydetix-test",
    ];
    for (const candidate of absolutePaths) {
      expect(dangerousRepositoryPath(candidate)).toBe("absolute");
      expect(() => resolveInside(boundary, candidate)).toThrow(/absolute/);
    }
  });

  it("rejects NUL and traversal under POSIX and Windows separator semantics", async () => {
    const root = await temporaryDirectory("cydetix-boundary-");
    const boundary = await createBoundary(root);
    expect(dangerousRepositoryPath("nul\0path.ts")).toBe("nul");
    expect(() => resolveInside(boundary, "nul\0path.ts")).toThrow(/NUL/);
    for (const candidate of [
      "../outside.txt",
      "a/../../outside.txt",
      "..\\outside.txt",
      "a\\..\\..\\outside.txt",
    ]) {
      expect(dangerousRepositoryPath(candidate)).toBe("traversal");
      expect(() => resolveInside(boundary, candidate)).toThrow(/escapes repository root/);
    }
  });

  it("accepts normal relative repository paths", async () => {
    const root = await temporaryDirectory("cydetix-boundary-");
    const boundary = await createBoundary(root);
    for (const candidate of ["src/index.ts", "src/../package.json", "nested/deeper/file.ts"]) {
      expect(dangerousRepositoryPath(candidate)).toBeUndefined();
      expect(resolveInside(boundary, candidate)).toBe(path.resolve(boundary.root, candidate));
    }
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

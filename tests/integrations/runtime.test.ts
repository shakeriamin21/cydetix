import { mkdir, symlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  PERSISTENT_RUNTIME_REQUIRED,
  verifyPersistentRuntime,
} from "../../src/integrations/runtime.js";
import { temporaryDirectory } from "../helpers/temporary.js";

async function fakeRuntime(name = "cydetix", version = "0.6.0-alpha.7") {
  const root = await temporaryDirectory("cydetix-persistent-runtime-");
  const projectRoot = path.join(root, "Project With Spaces");
  const packageRoot = path.join(root, "persistent-prefix", "node_modules", "cydetix");
  const entrypoint = path.join(packageRoot, "dist", "cli", "main.js");
  await Promise.all([
    mkdir(projectRoot, { recursive: true }),
    mkdir(path.dirname(entrypoint), { recursive: true }),
  ]);
  await writeFile(
    path.join(packageRoot, "package.json"),
    `${JSON.stringify({ name, version, bin: { cydetix: "dist/cli/main.js" } })}\n`,
  );
  await writeFile(entrypoint, "#!/usr/bin/env node\n", { mode: 0o700 });
  return { projectRoot, packageRoot, entrypoint };
}

describe("persistent Cydetix runtime verification", () => {
  it("proves exact package identity, version, entrypoint, and Node executable", async () => {
    const fixture = await fakeRuntime();
    const runtime = await verifyPersistentRuntime({
      packageRoot: fixture.packageRoot,
      projectRoot: fixture.projectRoot,
      expectedVersion: "0.6.0-alpha.7",
    });
    expect(runtime.version).toBe("0.6.0-alpha.7");
    expect(runtime.entrypoint).toBe(fixture.entrypoint);
    expect(runtime.nodeExecutable).toBe(path.resolve(process.execPath));
    expect(runtime.source).toBe("current-installation");
  });

  it("rejects a package with the wrong identity", async () => {
    const fixture = await fakeRuntime("not-cydetix");
    await expect(
      verifyPersistentRuntime({
        packageRoot: fixture.packageRoot,
        projectRoot: fixture.projectRoot,
        expectedVersion: "0.6.0-alpha.7",
      }),
    ).rejects.toThrow("exactly cydetix");
  });

  it("rejects a runtime version mismatch", async () => {
    const fixture = await fakeRuntime("cydetix", "0.6.0-alpha.5");
    await expect(
      verifyPersistentRuntime({
        packageRoot: fixture.packageRoot,
        projectRoot: fixture.projectRoot,
        expectedVersion: "0.6.0-alpha.7",
      }),
    ).rejects.toThrow("required 0.6.0-alpha.7, found 0.6.0-alpha.5");
  });

  it("rejects ephemeral npx cache roots before reading package content", async () => {
    const root = await temporaryDirectory("cydetix-runtime-cache-");
    await expect(
      verifyPersistentRuntime({
        packageRoot: path.join(root, "_npx", "123", "node_modules", "cydetix"),
        projectRoot: root,
        expectedVersion: "0.6.0-alpha.7",
      }),
    ).rejects.toThrow(PERSISTENT_RUNTIME_REQUIRED);
  });

  it("rejects a symlinked entrypoint", async () => {
    const fixture = await fakeRuntime();
    const outside = path.join(path.dirname(fixture.packageRoot), "outside.js");
    await writeFile(outside, "throw new Error('outside');\n");
    try {
      await writeFile(fixture.entrypoint, "");
      await symlink(outside, `${fixture.entrypoint}.link`, "file");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }
    await writeFile(
      path.join(fixture.packageRoot, "package.json"),
      `${JSON.stringify({
        name: "cydetix",
        version: "0.6.0-alpha.7",
        bin: { cydetix: "dist/cli/main.js.link" },
      })}\n`,
    );
    await expect(
      verifyPersistentRuntime({
        packageRoot: fixture.packageRoot,
        projectRoot: fixture.projectRoot,
        expectedVersion: "0.6.0-alpha.7",
      }),
    ).rejects.toThrow(/symbolic links|non-symlink/u);
  });
});

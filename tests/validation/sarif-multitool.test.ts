import { constants as fileSystemConstants } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  prepareTrustedSarifMultitoolExecutable,
  type SarifMultitoolFileSystem,
  type SarifMultitoolInstallation,
} from "../../src/validation/sarif-multitool.js";

function fixture(platform: "darwin" | "linux" | "win32", mode = 0o644) {
  const wrapperPackageJsonPath = path.resolve("virtual", "wrapper", "package.json");
  const platformPackageJsonPath = path.resolve("virtual", platform, "package.json");
  const executableName = platform === "win32" ? "Sarif.Multitool.exe" : "Sarif.Multitool";
  const exportedExecutablePath = path.join(path.dirname(platformPackageJsonPath), executableName);
  const installation: SarifMultitoolInstallation = {
    platform,
    exportedExecutablePath,
    wrapperPackageJsonPath,
    platformPackageJsonPath,
  };
  const chmod = vi.fn<(file: string, mode: number) => Promise<void>>(() => Promise.resolve());
  const access = vi.fn<(file: string, mode: number) => Promise<void>>(() => Promise.resolve());
  const fileSystem: SarifMultitoolFileSystem = {
    realpath(file) {
      return Promise.resolve(path.resolve(file));
    },
    readText(file) {
      return Promise.resolve(
        JSON.stringify(
          file === wrapperPackageJsonPath
            ? { name: "@microsoft/sarif-multitool", version: "5.7.0" }
            : { name: `@microsoft/sarif-multitool-${platform}`, version: "5.7.0" },
        ),
      );
    },
    statFile() {
      return Promise.resolve({ isFile: true, mode });
    },
    chmod,
    access,
  };
  return { access, chmod, fileSystem, installation };
}

describe("Microsoft SARIF Multitool launcher", () => {
  it.each(["linux", "darwin"] as const)(
    "restores only the trusted %s package executable user bit",
    async (platform) => {
      const prepared = fixture(platform);
      await expect(
        prepareTrustedSarifMultitoolExecutable(prepared.installation, prepared.fileSystem),
      ).resolves.toBe(prepared.installation.exportedExecutablePath);
      expect(prepared.chmod).toHaveBeenCalledExactlyOnceWith(
        prepared.installation.exportedExecutablePath,
        0o744,
      );
      expect(prepared.access).toHaveBeenCalledExactlyOnceWith(
        prepared.installation.exportedExecutablePath,
        fileSystemConstants.X_OK,
      );
    },
  );

  it("uses the trusted Windows executable without applying POSIX modes", async () => {
    const prepared = fixture("win32");
    await expect(
      prepareTrustedSarifMultitoolExecutable(prepared.installation, prepared.fileSystem),
    ).resolves.toBe(prepared.installation.exportedExecutablePath);
    expect(prepared.chmod).not.toHaveBeenCalled();
    expect(prepared.access).toHaveBeenCalledExactlyOnceWith(
      prepared.installation.exportedExecutablePath,
      fileSystemConstants.F_OK,
    );
  });

  it("does not chmod an exported path outside the trusted platform package", async () => {
    const prepared = fixture("linux");
    prepared.installation = {
      ...prepared.installation,
      exportedExecutablePath: path.resolve("virtual", "untrusted", "Sarif.Multitool"),
    };
    await expect(
      prepareTrustedSarifMultitoolExecutable(prepared.installation, prepared.fileSystem),
    ).rejects.toThrow(/not launchable/u);
    expect(prepared.chmod).not.toHaveBeenCalled();
    expect(prepared.access).not.toHaveBeenCalled();
  });

  it("fails when the platform package version does not match the trusted wrapper", async () => {
    const prepared = fixture("linux");
    prepared.fileSystem.readText = (file) =>
      Promise.resolve(
        JSON.stringify(
          file === prepared.installation.wrapperPackageJsonPath
            ? { name: "@microsoft/sarif-multitool", version: "5.7.0" }
            : { name: "@microsoft/sarif-multitool-linux", version: "5.8.0" },
        ),
      );
    await expect(
      prepareTrustedSarifMultitoolExecutable(prepared.installation, prepared.fileSystem),
    ).rejects.toThrow(/identity or version/u);
    expect(prepared.chmod).not.toHaveBeenCalled();
  });

  it("fails when the verified executable remains unlaunchable", async () => {
    const prepared = fixture("darwin", 0o744);
    prepared.fileSystem.access = () => Promise.reject(new Error("synthetic EACCES"));
    await expect(
      prepareTrustedSarifMultitoolExecutable(prepared.installation, prepared.fileSystem),
    ).rejects.toThrow(/not launchable/u);
  });

  it("rejects unsupported platforms before changing a file", async () => {
    const prepared = fixture("linux");
    prepared.installation = { ...prepared.installation, platform: "freebsd" };
    await expect(
      prepareTrustedSarifMultitoolExecutable(prepared.installation, prepared.fileSystem),
    ).rejects.toThrow(/does not support/u);
    expect(prepared.chmod).not.toHaveBeenCalled();
  });
});

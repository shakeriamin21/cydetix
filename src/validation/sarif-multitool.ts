import { constants as fileSystemConstants } from "node:fs";
import {
  access as accessFile,
  chmod as changeMode,
  readFile,
  realpath as resolveRealPath,
  stat,
} from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import multitoolPath from "@microsoft/sarif-multitool";

type SupportedPlatform = "darwin" | "linux" | "win32";

export interface SarifMultitoolInstallation {
  readonly platform: NodeJS.Platform;
  readonly exportedExecutablePath: string;
  readonly wrapperPackageJsonPath: string;
  readonly platformPackageJsonPath: string;
}

export interface SarifMultitoolFileSystem {
  realpath(file: string): Promise<string>;
  readText(file: string): Promise<string>;
  statFile(file: string): Promise<{ readonly isFile: boolean; readonly mode: number }>;
  chmod(file: string, mode: number): Promise<void>;
  access(file: string, mode: number): Promise<void>;
}

const defaultFileSystem: SarifMultitoolFileSystem = {
  realpath: resolveRealPath,
  readText(file) {
    return readFile(file, "utf8");
  },
  async statFile(file) {
    const result = await stat(file);
    return { isFile: result.isFile(), mode: result.mode };
  },
  chmod: changeMode,
  access: accessFile,
};

function supportedPlatform(platform: NodeJS.Platform): SupportedPlatform {
  if (platform === "darwin" || platform === "linux" || platform === "win32") return platform;
  throw new Error("Microsoft SARIF Multitool does not support this operating system.");
}

function packageIdentity(source: string): { readonly name: string; readonly version: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Microsoft SARIF Multitool package metadata is invalid.");
  }
  if (typeof parsed !== "object" || parsed === null)
    throw new Error("Microsoft SARIF Multitool package metadata is invalid.");
  const metadata = parsed as Record<string, unknown>;
  const name = metadata.name;
  const version = metadata.version;
  if (typeof name !== "string" || typeof version !== "string")
    throw new Error("Microsoft SARIF Multitool package metadata is invalid.");
  return { name, version };
}

function expectedPlatformPackage(platform: SupportedPlatform): {
  readonly name: string;
  readonly executable: string;
} {
  return {
    name: `@microsoft/sarif-multitool-${platform}`,
    executable: platform === "win32" ? "Sarif.Multitool.exe" : "Sarif.Multitool",
  };
}

export async function prepareTrustedSarifMultitoolExecutable(
  installation: SarifMultitoolInstallation,
  fileSystem: SarifMultitoolFileSystem = defaultFileSystem,
): Promise<string> {
  const platform = supportedPlatform(installation.platform);
  const expected = expectedPlatformPackage(platform);
  if (!path.isAbsolute(installation.exportedExecutablePath))
    throw new Error("Microsoft SARIF Multitool exported a non-absolute executable path.");

  const [wrapperSource, platformSource] = await Promise.all([
    fileSystem.readText(installation.wrapperPackageJsonPath),
    fileSystem.readText(installation.platformPackageJsonPath),
  ]);
  const wrapper = packageIdentity(wrapperSource);
  const platformPackage = packageIdentity(platformSource);
  if (wrapper.name !== "@microsoft/sarif-multitool")
    throw new Error("Microsoft SARIF Multitool wrapper package identity is invalid.");
  if (platformPackage.name !== expected.name || platformPackage.version !== wrapper.version)
    throw new Error("Microsoft SARIF Multitool platform package identity or version is invalid.");

  let executable: string;
  try {
    const platformPackageJson = await fileSystem.realpath(installation.platformPackageJsonPath);
    const expectedExecutable = await fileSystem.realpath(
      path.join(path.dirname(platformPackageJson), expected.executable),
    );
    executable = await fileSystem.realpath(installation.exportedExecutablePath);
    if (executable !== expectedExecutable)
      throw new Error("The exported executable is outside the trusted platform package.");
    const executableStatus = await fileSystem.statFile(executable);
    if (!executableStatus.isFile)
      throw new Error("The trusted Microsoft SARIF Multitool target is not a file.");

    if (platform !== "win32" && (executableStatus.mode & 0o100) === 0) {
      // The upstream POSIX packages ship Sarif.Multitool as 0644 and restore u+x in postinstall.
      // Cydetix deliberately installs with --ignore-scripts, so restore only that bit after the
      // exported path, package name, package version, and canonical package-owned target agree.
      await fileSystem.chmod(executable, (executableStatus.mode & 0o777) | 0o100);
    }
    await fileSystem.access(
      executable,
      platform === "win32" ? fileSystemConstants.F_OK : fileSystemConstants.X_OK,
    );
  } catch {
    throw new Error("The trusted Microsoft SARIF Multitool executable is not launchable.");
  }
  return executable;
}

export async function resolveSarifMultitoolExecutable(): Promise<string> {
  const platform = supportedPlatform(process.platform);
  const packageRequire = createRequire(import.meta.url);
  return prepareTrustedSarifMultitoolExecutable({
    platform,
    exportedExecutablePath: multitoolPath,
    wrapperPackageJsonPath: packageRequire.resolve("@microsoft/sarif-multitool/package.json"),
    platformPackageJsonPath: packageRequire.resolve(
      `@microsoft/sarif-multitool-${platform}/package.json`,
    ),
  });
}

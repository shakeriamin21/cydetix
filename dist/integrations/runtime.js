import { access, lstat, readFile, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dangerousRepositoryPath, isWithinRoot } from "../repository-discovery/boundary.js";
export const PERSISTENT_RUNTIME_REQUIRED = 'AI integration requires a persistent local Cydetix installation. Run "npm install -g cydetix", then rerun "cydetix setup". The normal "npx cydetix" scanner remains available.';
function samePath(left, right) {
    return isWithinRoot(left, right) && isWithinRoot(right, left);
}
export function isEphemeralNpxPath(candidate) {
    const components = path
        .resolve(candidate)
        .replaceAll("\\", "/")
        .toLowerCase()
        .split("/")
        .filter(Boolean);
    return components.includes("_npx");
}
async function packageRootFromThisModule() {
    let current = path.dirname(fileURLToPath(import.meta.url));
    for (;;) {
        const manifest = path.join(current, "package.json");
        const metadata = await lstat(manifest).catch(() => undefined);
        if (metadata?.isFile() === true && !metadata.isSymbolicLink()) {
            const parsed = JSON.parse(await readFile(manifest, "utf8"));
            if (parsed.name === "cydetix")
                return current;
        }
        const parent = path.dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    throw new Error(PERSISTENT_RUNTIME_REQUIRED);
}
async function assertSafePackagePath(packageRoot, candidate) {
    if (!isWithinRoot(packageRoot, candidate))
        throw new Error("Cydetix runtime entrypoint escapes its verified package root.");
    const relative = path.relative(packageRoot, candidate);
    let current = packageRoot;
    for (const component of relative.split(path.sep)) {
        if (component === "")
            continue;
        current = path.join(current, component);
        const metadata = await lstat(current);
        if (metadata.isSymbolicLink())
            throw new Error("Cydetix runtime paths must not contain symbolic links.");
    }
    const canonical = await realpath(candidate);
    if (!isWithinRoot(packageRoot, canonical))
        throw new Error("Cydetix runtime entrypoint escapes its verified package root.");
    return canonical;
}
export async function verifyPersistentRuntime(options) {
    const requestedPackageRoot = path.resolve(options.packageRoot);
    if (isEphemeralNpxPath(requestedPackageRoot))
        throw new Error(PERSISTENT_RUNTIME_REQUIRED);
    const rootMetadata = await lstat(requestedPackageRoot).catch(() => undefined);
    if (rootMetadata === undefined || !rootMetadata.isDirectory() || rootMetadata.isSymbolicLink())
        throw new Error(PERSISTENT_RUNTIME_REQUIRED);
    const packageRoot = await realpath(requestedPackageRoot);
    if (isEphemeralNpxPath(packageRoot))
        throw new Error(PERSISTENT_RUNTIME_REQUIRED);
    const packageJsonPath = path.join(packageRoot, "package.json");
    const packageMetadata = await lstat(packageJsonPath).catch(() => undefined);
    if (packageMetadata === undefined ||
        !packageMetadata.isFile() ||
        packageMetadata.isSymbolicLink())
        throw new Error("Persistent Cydetix package metadata must be a regular file.");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    if (packageJson.name !== "cydetix")
        throw new Error("Persistent runtime package name must be exactly cydetix.");
    if (packageJson.version !== options.expectedVersion)
        throw new Error(`Persistent Cydetix runtime version mismatch: required ${options.expectedVersion}, found ${String(packageJson.version)}.`);
    if (typeof packageJson.bin !== "object" ||
        packageJson.bin === null ||
        Array.isArray(packageJson.bin))
        throw new Error("Persistent Cydetix runtime has no verified CLI entrypoint.");
    const entrypointRelative = packageJson.bin.cydetix;
    if (typeof entrypointRelative !== "string" ||
        entrypointRelative.trim() === "" ||
        dangerousRepositoryPath(entrypointRelative) !== undefined)
        throw new Error("Persistent Cydetix runtime has an unsafe CLI entrypoint.");
    const entrypoint = await assertSafePackagePath(packageRoot, path.resolve(packageRoot, entrypointRelative));
    const entrypointMetadata = await lstat(entrypoint);
    if (!entrypointMetadata.isFile() || entrypointMetadata.isSymbolicLink())
        throw new Error("Persistent Cydetix entrypoint must be a regular non-symlink file.");
    const requestedNode = path.resolve(options.nodeExecutable ?? process.execPath);
    const nodeExecutable = await realpath(requestedNode).catch(() => {
        throw new Error("The configured Node executable is unavailable.");
    });
    const nodeMetadata = await lstat(nodeExecutable);
    if (!nodeMetadata.isFile())
        throw new Error("The configured Node executable is not a file.");
    await access(nodeExecutable, constants.X_OK).catch(() => {
        throw new Error("The configured Node executable is not executable.");
    });
    const canonicalProject = await realpath(path.resolve(options.projectRoot));
    const expectedLocalRoot = path.join(canonicalProject, "node_modules", "cydetix");
    const source = samePath(packageRoot, expectedLocalRoot)
        ? "project-local"
        : "current-installation";
    return {
        packageRoot,
        packageJsonPath,
        entrypoint,
        nodeExecutable,
        version: packageJson.version,
        source,
    };
}
export async function resolvePersistentRuntime(options) {
    return verifyPersistentRuntime({
        packageRoot: await packageRootFromThisModule(),
        projectRoot: options.projectRoot,
        expectedVersion: options.expectedVersion,
    });
}
//# sourceMappingURL=runtime.js.map
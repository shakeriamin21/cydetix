import { lstat, realpath, readFile } from "node:fs/promises";
import path from "node:path";
import { CydetixError, EXIT } from "../core/errors.js";
function normalizedForComparison(value) {
    const normalized = path.resolve(value);
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}
export function isWithinRoot(root, candidate) {
    const normalizedRoot = normalizedForComparison(root);
    const normalizedCandidate = normalizedForComparison(candidate);
    const relative = path.relative(normalizedRoot, normalizedCandidate);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
export async function createBoundary(inputPath) {
    const requested = path.resolve(inputPath);
    const stat = await lstat(requested).catch((error) => {
        throw new CydetixError(`Cannot inspect target path: ${requested}`, EXIT.usage, {
            cause: error,
        });
    });
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new CydetixError("Scan target must be a real directory, not a symlink or file.", EXIT.usage);
    }
    return { root: await realpath(requested) };
}
export function resolveInside(boundary, relativePath) {
    if (relativePath.includes("\0") || path.isAbsolute(relativePath)) {
        throw new CydetixError("Refusing an absolute or NUL-containing repository path.", EXIT.scanFailure);
    }
    const resolved = path.resolve(boundary.root, relativePath);
    if (!isWithinRoot(boundary.root, resolved)) {
        throw new CydetixError(`Path escapes repository root: ${relativePath}`, EXIT.scanFailure);
    }
    return resolved;
}
export async function readRegularFileInside(boundary, relativePath, maxBytes) {
    const resolved = resolveInside(boundary, relativePath);
    const stat = await lstat(resolved);
    if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new CydetixError(`Refusing non-regular file: ${relativePath}`, EXIT.scanFailure);
    }
    if (stat.size > maxBytes) {
        throw new CydetixError(`File exceeds read limit: ${relativePath}`, EXIT.scanFailure);
    }
    const canonical = await realpath(resolved);
    if (!isWithinRoot(boundary.root, canonical)) {
        throw new CydetixError(`Canonical path escapes repository root: ${relativePath}`, EXIT.scanFailure);
    }
    return readFile(canonical);
}
export function toReportPath(root, absolutePath) {
    if (!isWithinRoot(root, absolutePath)) {
        throw new CydetixError("Cannot report a path outside the repository.", EXIT.scanFailure);
    }
    return path.relative(root, absolutePath).split(path.sep).join("/");
}
//# sourceMappingURL=boundary.js.map
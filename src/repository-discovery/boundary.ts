import { lstat, realpath, readFile } from "node:fs/promises";
import path from "node:path";

import { CydetixError, EXIT } from "../core/errors.js";

export interface RepositoryBoundary {
  readonly root: string;
}

export type DangerousRepositoryPath = "absolute" | "nul" | "traversal" | undefined;

function normalizedForComparison(value: string): string {
  const normalized = path.resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function isWithinRoot(root: string, candidate: string): boolean {
  const normalizedRoot = normalizedForComparison(root);
  const normalizedCandidate = normalizedForComparison(candidate);
  const relative = path.relative(normalizedRoot, normalizedCandidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function traversesAboveRoot(relativePath: string, implementation: typeof path.posix): boolean {
  const normalized = implementation.normalize(relativePath);
  return normalized === ".." || normalized.startsWith(`..${implementation.sep}`);
}

/**
 * Repository-controlled paths remain untrusted if they use another supported platform's syntax.
 * Classify them before applying host-native resolution so, for example, POSIX cannot reinterpret a
 * Windows UNC path or backslash traversal as an ordinary filename.
 */
export function dangerousRepositoryPath(relativePath: string): DangerousRepositoryPath {
  if (relativePath.includes("\0")) return "nul";
  if (
    path.isAbsolute(relativePath) ||
    path.posix.isAbsolute(relativePath) ||
    path.win32.isAbsolute(relativePath)
  )
    return "absolute";
  if (traversesAboveRoot(relativePath, path.posix) || traversesAboveRoot(relativePath, path.win32))
    return "traversal";
  return undefined;
}

export async function createBoundary(inputPath: string): Promise<RepositoryBoundary> {
  const requested = path.resolve(inputPath);
  const stat = await lstat(requested).catch((error: unknown) => {
    throw new CydetixError(`Cannot inspect target path: ${requested}`, EXIT.usage, {
      cause: error,
    });
  });
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new CydetixError(
      "Scan target must be a real directory, not a symlink or file.",
      EXIT.usage,
    );
  }
  return { root: await realpath(requested) };
}

export function resolveInside(boundary: RepositoryBoundary, relativePath: string): string {
  const dangerous = dangerousRepositoryPath(relativePath);
  if (dangerous === "nul" || dangerous === "absolute") {
    throw new CydetixError(
      "Refusing an absolute or NUL-containing repository path.",
      EXIT.scanFailure,
    );
  }
  if (dangerous === "traversal")
    throw new CydetixError(`Path escapes repository root: ${relativePath}`, EXIT.scanFailure);
  const resolved = path.resolve(boundary.root, relativePath);
  if (!isWithinRoot(boundary.root, resolved)) {
    throw new CydetixError(`Path escapes repository root: ${relativePath}`, EXIT.scanFailure);
  }
  return resolved;
}

export async function readRegularFileInside(
  boundary: RepositoryBoundary,
  relativePath: string,
  maxBytes: number,
): Promise<Buffer> {
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
    throw new CydetixError(
      `Canonical path escapes repository root: ${relativePath}`,
      EXIT.scanFailure,
    );
  }
  return readFile(canonical);
}

export function toReportPath(root: string, absolutePath: string): string {
  if (!isWithinRoot(root, absolutePath)) {
    throw new CydetixError("Cannot report a path outside the repository.", EXIT.scanFailure);
  }
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

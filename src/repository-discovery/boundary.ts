import { lstat, realpath, readFile } from "node:fs/promises";
import path from "node:path";

import { InvariantSecError, EXIT } from "../core/errors.js";

export interface RepositoryBoundary {
  readonly root: string;
}

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

export async function createBoundary(inputPath: string): Promise<RepositoryBoundary> {
  const requested = path.resolve(inputPath);
  const stat = await lstat(requested).catch((error: unknown) => {
    throw new InvariantSecError(`Cannot inspect target path: ${requested}`, EXIT.usage, {
      cause: error,
    });
  });
  if (stat.isSymbolicLink() || !stat.isDirectory()) {
    throw new InvariantSecError(
      "Scan target must be a real directory, not a symlink or file.",
      EXIT.usage,
    );
  }
  return { root: await realpath(requested) };
}

export function resolveInside(boundary: RepositoryBoundary, relativePath: string): string {
  if (relativePath.includes("\0") || path.isAbsolute(relativePath)) {
    throw new InvariantSecError(
      "Refusing an absolute or NUL-containing repository path.",
      EXIT.scanFailure,
    );
  }
  const resolved = path.resolve(boundary.root, relativePath);
  if (!isWithinRoot(boundary.root, resolved)) {
    throw new InvariantSecError(`Path escapes repository root: ${relativePath}`, EXIT.scanFailure);
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
    throw new InvariantSecError(`Refusing non-regular file: ${relativePath}`, EXIT.scanFailure);
  }
  if (stat.size > maxBytes) {
    throw new InvariantSecError(`File exceeds read limit: ${relativePath}`, EXIT.scanFailure);
  }
  const canonical = await realpath(resolved);
  if (!isWithinRoot(boundary.root, canonical)) {
    throw new InvariantSecError(
      `Canonical path escapes repository root: ${relativePath}`,
      EXIT.scanFailure,
    );
  }
  return readFile(canonical);
}

export function toReportPath(root: string, absolutePath: string): string {
  if (!isWithinRoot(root, absolutePath)) {
    throw new InvariantSecError("Cannot report a path outside the repository.", EXIT.scanFailure);
  }
  return path.relative(root, absolutePath).split(path.sep).join("/");
}

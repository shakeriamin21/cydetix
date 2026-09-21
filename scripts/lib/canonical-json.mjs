import path from "node:path";

import { format, resolveConfig } from "prettier";

/**
 * Serialize JSON with the same pinned Prettier contract enforced by CI.
 * Prettier preserves object insertion order while canonicalizing whitespace,
 * wrapping, and the trailing newline.
 */
export async function formatRepositoryJson(value, outputPath) {
  const absoluteOutputPath = path.resolve(outputPath);
  const configuration = (await resolveConfig(absoluteOutputPath)) ?? {};
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError("Canonical JSON input is not serializable.");
  return format(serialized, {
    ...configuration,
    filepath: absoluteOutputPath,
    parser: "json",
  });
}

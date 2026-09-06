import { mkdtempSync, rmSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterAll } from "vitest";

const tracked = new Set<string>();

export async function temporaryDirectory(prefix: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), prefix));
  tracked.add(directory);
  return directory;
}

export function temporaryDirectorySync(prefix: string): string {
  const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
  tracked.add(directory);
  return directory;
}

afterAll(async () => {
  const directories = [...tracked];
  tracked.clear();
  await Promise.all(
    directories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

process.once("exit", () => {
  for (const directory of tracked) {
    try {
      rmSync(directory, { recursive: true, force: true });
    } catch {
      // Best-effort crash cleanup; the normal afterAll path remains authoritative.
    }
  }
});

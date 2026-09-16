import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { temporaryDirectory } from "../helpers/temporary.js";

const validatorScript = path.resolve("scripts", "validate-publication-config.mjs");
const packageJson = JSON.parse(await readFile("package.json", "utf8")) as Record<string, unknown>;
const plugin = JSON.parse(
  await readFile("plugins/cydetix/.codex-plugin/plugin.json", "utf8"),
) as Record<string, unknown>;
const publication = JSON.parse(await readFile("release/publication-config.json", "utf8")) as Record<
  string,
  unknown
>;

async function validatePublication(candidate: Record<string, unknown>) {
  const repository = await temporaryDirectory("cydetix-publication-config-");
  await mkdir(path.join(repository, "plugins", "cydetix", ".codex-plugin"), { recursive: true });
  await mkdir(path.join(repository, "release"), { recursive: true });
  await writeFile(
    path.join(repository, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(repository, "plugins", "cydetix", ".codex-plugin", "plugin.json"),
    `${JSON.stringify(plugin, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    path.join(repository, "release", "publication-config.json"),
    `${JSON.stringify(candidate, null, 2)}\n`,
    "utf8",
  );
  const result = spawnSync(process.execPath, [validatorScript], {
    cwd: repository,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 20_000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      PATHEXT: process.env.PATHEXT,
    },
  });
  if (result.error !== undefined) throw result.error;
  return result;
}

describe("prepared stable publication configuration", () => {
  it("exactly matches package version, tag candidate, and deterministic channel", async () => {
    const result = await validatePublication(publication);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Cydetix 1.0.1");
  });

  it.each([
    ["version", "1.0.2", "publication version mismatches"],
    ["tagCandidate", "v1.0.2", "tag candidate mismatches"],
    ["npmDistTag", "beta", "npm dist-tag does not match"],
    ["publicationState", "PUBLISHED", "must remain prepared and not published"],
    ["publicationAuthorized", true, "must not claim publication authority"],
  ] as const)("rejects mismatched %s", async (field, value, message) => {
    const candidate = structuredClone(publication);
    candidate[field] = value;
    const result = await validatePublication(candidate);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });
});

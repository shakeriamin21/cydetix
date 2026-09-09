import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { describe, expect, it } from "vitest";

import { pinnedMcpServer } from "../../src/integrations/common.js";
import { integrationContext, INTEGRATION_ADAPTERS } from "../../src/integrations/setup.js";
import type { AgentId, IntegrationAdapter, SetupContext } from "../../src/integrations/types.js";
import { temporaryDirectory } from "../helpers/temporary.js";

const NEW_AGENTS = ["gemini", "cline", "roo", "continue", "goose"] as const;

async function environment(platform: NodeJS.Platform = process.platform) {
  const root = await temporaryDirectory("cydetix-portable-adapter-");
  const project = path.join(root, "Project With Spaces");
  const home = path.join(root, "Home With Spaces");
  await Promise.all([mkdir(project, { recursive: true }), mkdir(home, { recursive: true })]);
  return {
    root,
    project,
    home,
    context: await integrationContext({
      projectRoot: project,
      homeDirectory: home,
      platform,
      executablePath: "",
    }),
  };
}

function adapter(id: AgentId): IntegrationAdapter {
  const found = INTEGRATION_ADAPTERS.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`Missing adapter: ${id}`);
  return found;
}

function marker(id: (typeof NEW_AGENTS)[number], context: SetupContext): string {
  const locations: Record<(typeof NEW_AGENTS)[number], string> = {
    gemini: path.join(context.homeDirectory, ".gemini"),
    cline: path.join(context.homeDirectory, ".cline"),
    roo: path.join(context.homeDirectory, ".roo"),
    continue: path.join(context.homeDirectory, ".continue"),
    goose:
      context.platform === "win32"
        ? path.join(context.homeDirectory, "AppData", "Roaming", "Block", "goose")
        : path.join(context.homeDirectory, ".config", "goose"),
  };
  return locations[id];
}

function primaryConfig(id: (typeof NEW_AGENTS)[number], context: SetupContext): string {
  return adapter(id).configTargets(context)[0] ?? "";
}

async function writeConfig(
  id: (typeof NEW_AGENTS)[number],
  context: SetupContext,
  cydetix: unknown,
): Promise<void> {
  const target = primaryConfig(id, context);
  await mkdir(path.dirname(target), { recursive: true });
  if (id === "goose") {
    await writeFile(
      target,
      `extensions:\n  existing:\n    type: builtin\n    enabled: true\n  cydetix: ${JSON.stringify(cydetix)}\n`,
    );
  } else {
    await writeFile(
      target,
      `${JSON.stringify({ theme: "preserved", mcpServers: { existing: { command: "safe" }, cydetix } }, null, 2)}\n`,
    );
  }
}

async function configuredEntry(
  id: (typeof NEW_AGENTS)[number],
  context: SetupContext,
): Promise<Record<string, unknown> | undefined> {
  const content = await readFile(primaryConfig(id, context), "utf8");
  if (id === "goose")
    return (parseYaml(content) as { extensions?: Record<string, Record<string, unknown>> })
      .extensions?.cydetix;
  return (JSON.parse(content) as { mcpServers?: Record<string, Record<string, unknown>> })
    .mcpServers?.cydetix;
}

for (const id of NEW_AGENTS) {
  describe(`${id} adapter`, () => {
    it("distinguishes not installed, installed, and not configured without executing the host", async () => {
      const { context } = await environment();
      const host = adapter(id);
      const absent = await host.detect(context);
      expect(absent.detected).toBe(false);
      expect(absent.installation).toBe("not_installed");
      expect(absent.integration).toBe("not_configured");

      await mkdir(marker(id, context), { recursive: true });
      const installed = await host.detect(context);
      expect(installed.detected).toBe(true);
      expect(installed.installation).toBe("installed");
      expect(installed.integration).toBe("not_configured");
    });

    it("installs, verifies, reinstalls idempotently, removes, and preserves unrelated config", async () => {
      const { context } = await environment();
      const host = adapter(id);
      await writeConfig(id, context, { command: "old", args: ["mcp"] });

      const installed = await host.install(context, false);
      expect(installed.verified).toBe(true);
      expect(await host.verify(context)).toBe(true);
      const entry = await configuredEntry(id, context);
      const expected = pinnedMcpServer(context);
      expect(id === "goose" ? entry?.cmd : entry?.command).toBe(expected.command);
      expect(entry?.args).toEqual(expected.args);
      const generated = JSON.stringify(entry).toLowerCase();
      expect(generated).not.toMatch(/\b(?:npm|npx|pnpm|yarn|bunx|curl|wget)\b|invoke-webrequest/u);
      expect(generated).toContain("--require-version");
      expect(generated).toContain(context.packageVersion);

      const repeated = await host.install(context, false);
      expect(repeated.action).toBe("unchanged");
      expect(repeated.verified).toBe(true);

      const removed = await host.remove(context, false);
      expect(removed.verified).toBe(true);
      const remaining = await readFile(primaryConfig(id, context), "utf8");
      expect(remaining).toContain("existing");
      expect(remaining).not.toContain("--require-version");
      if (id !== "goose") expect(remaining).toContain("preserved");
    });

    it("reports partial and invalid configuration without overwriting it", async () => {
      const partialEnvironment = await environment();
      const host = adapter(id);
      await writeConfig(id, partialEnvironment.context, { command: "cydetix", args: ["mcp"] });
      expect((await host.detect(partialEnvironment.context)).integration).toBe(
        "partially_configured",
      );

      const invalidEnvironment = await environment();
      const invalidTarget = primaryConfig(id, invalidEnvironment.context);
      await mkdir(path.dirname(invalidTarget), { recursive: true });
      await writeFile(invalidTarget, id === "goose" ? "extensions: [\n" : "not-json\n");
      expect((await host.detect(invalidEnvironment.context)).integration).toBe(
        "configuration_inaccessible",
      );
      await expect(host.install(invalidEnvironment.context, false)).rejects.toThrow(
        /invalid (?:JSON|YAML)/u,
      );
      expect(await readFile(invalidTarget, "utf8")).toBe(
        id === "goose" ? "extensions: [\n" : "not-json\n",
      );
    });

    it("uses deterministic Windows, Linux, and macOS configuration targets", async () => {
      for (const platform of ["win32", "linux", "darwin"] as const) {
        const { context } = await environment(platform);
        const targets = adapter(id).configTargets(context);
        expect(targets.length).toBeGreaterThan(0);
        expect(targets.every((target) => path.isAbsolute(target))).toBe(true);
        expect(
          targets.every(
            (target) =>
              target.includes(context.projectRoot) || target.includes(context.homeDirectory),
          ),
        ).toBe(true);
        if (id === "goose")
          expect(targets[0]).toContain(
            platform === "win32"
              ? path.join("AppData", "Roaming", "Block")
              : path.join(".config", "goose"),
          );
      }
    });

    it("rejects a symlink ancestor instead of escaping the project or home boundary", async () => {
      const { root, context } = await environment();
      const target = primaryConfig(id, context);
      const boundaryRoot = target.startsWith(context.projectRoot)
        ? context.projectRoot
        : context.homeDirectory;
      const first = path.relative(boundaryRoot, target).split(path.sep)[0];
      if (first === undefined || first === "") throw new Error("Expected nested config target.");
      const linkedParent = path.join(boundaryRoot, first);
      const outside = path.join(root, `outside-${id}`);
      await mkdir(outside, { recursive: true });
      try {
        await symlink(outside, linkedParent, process.platform === "win32" ? "junction" : "dir");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EPERM") return;
        throw error;
      }
      await expect(adapter(id).install(context, false)).rejects.toThrow(/unsafe parent/u);
    });
  });
}

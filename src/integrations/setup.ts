import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { PRODUCT } from "../core/brand.js";
import { claudeAdapter } from "./claude/index.js";
import { codexAdapter } from "./codex/index.js";
import { copilotAdapter } from "./copilot/index.js";
import { cursorAdapter } from "./cursor/index.js";
import { genericMcpAdapter } from "./generic-mcp/index.js";
import type {
  AdapterResult,
  AgentDetection,
  AgentId,
  IntegrationAdapter,
  SetupContext,
} from "./types.js";
import { windsurfAdapter } from "./windsurf/index.js";

export const INTEGRATION_ADAPTERS: readonly IntegrationAdapter[] = [
  codexAdapter,
  cursorAdapter,
  claudeAdapter,
  copilotAdapter,
  windsurfAdapter,
  genericMcpAdapter,
] as const;

export interface SetupOptions {
  readonly projectRoot?: string;
  readonly homeDirectory?: string;
  readonly agents?: readonly AgentId[];
  readonly all?: boolean;
  readonly yes?: boolean;
  readonly dryRun?: boolean;
  readonly uninstall?: boolean;
  readonly platform?: NodeJS.Platform;
}

export interface SetupReport {
  readonly detections: readonly AgentDetection[];
  readonly selected: readonly AgentId[];
  readonly results: readonly AdapterResult[];
  readonly cancelled: boolean;
  readonly dryRun: boolean;
}

export function integrationContext(options: SetupOptions = {}): SetupContext {
  return {
    projectRoot: path.resolve(options.projectRoot ?? process.cwd()),
    homeDirectory: path.resolve(
      options.homeDirectory ?? process.env.VIBESHIELD_SETUP_HOME ?? os.homedir(),
    ),
    packageVersion: PRODUCT.version,
    platform: options.platform ?? process.platform,
  };
}

export function parseAgentId(value: string): AgentId {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, AgentId> = {
    codex: "codex",
    chatgpt: "codex",
    claude: "claude",
    "claude-code": "claude",
    cursor: "cursor",
    copilot: "copilot",
    "github-copilot": "copilot",
    windsurf: "windsurf",
    generic: "generic-mcp",
    "generic-mcp": "generic-mcp",
  };
  const id = aliases[normalized];
  if (id === undefined)
    throw new Error(
      "Unknown agent. Expected codex, cursor, claude, copilot, windsurf, or generic-mcp.",
    );
  return id;
}

async function confirmSetup(uninstall: boolean): Promise<boolean> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  const prompt = uninstall
    ? "Remove VibeShield from these AI agents? [Y/n] "
    : "Install VibeShield into these AI agents? [Y/n] ";
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await reader.question(prompt)).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    reader.close();
  }
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupReport> {
  const context = integrationContext(options);
  const dryRun = options.dryRun === true;
  const detections = await Promise.all(
    INTEGRATION_ADAPTERS.map((adapter) => Promise.resolve(adapter.detect(context))),
  );
  process.stdout.write("VibeShield Setup\n\nDetected agents:\n");
  const visibleDetections = detections.filter((detection) => detection.id !== "generic-mcp");
  const detected = visibleDetections.filter((detection) => detection.detected);
  if (detected.length === 0) process.stdout.write("  None\n");
  else for (const detection of detected) process.stdout.write(`  ${detection.displayName}\n`);
  const explicitlySelected = [...new Set(options.agents ?? [])];
  const selected = options.all
    ? INTEGRATION_ADAPTERS.map((adapter) => adapter.id)
    : explicitlySelected.length > 0
      ? explicitlySelected
      : detected.map((detection) => detection.id);
  if (selected.length === 0) {
    process.stdout.write(
      "\nNo supported agent was detected. Use --agent generic-mcp for a portable config snippet.\n",
    );
    return { detections, selected, results: [], cancelled: false, dryRun };
  }
  process.stdout.write(`\n${options.uninstall ? "Remove" : "Install"}:\n`);
  for (const id of selected) {
    const adapter = INTEGRATION_ADAPTERS.find((candidate) => candidate.id === id);
    if (adapter !== undefined) process.stdout.write(`  ${adapter.displayName}\n`);
  }
  const accepted =
    options.yes === true || dryRun || (await confirmSetup(options.uninstall === true));
  if (!accepted) {
    process.stdout.write(
      process.stdin.isTTY
        ? "\nSetup cancelled.\n"
        : "\nNo changes made. Rerun with --yes for non-interactive setup.\n",
    );
    return { detections, selected, results: [], cancelled: true, dryRun };
  }
  process.stdout.write(
    options.dryRun
      ? "\nPreviewing...\n"
      : options.uninstall
        ? "\nRemoving...\n"
        : "\nInstalling...\n",
  );
  const results: AdapterResult[] = [];
  for (const id of selected) {
    const adapter = INTEGRATION_ADAPTERS.find((candidate) => candidate.id === id);
    if (adapter === undefined) continue;
    const result = options.uninstall
      ? await adapter.uninstall(context, dryRun)
      : await adapter.install(context, dryRun);
    results.push(result);
    process.stdout.write(`  [${result.action}] ${result.displayName}\n`);
  }
  process.stdout.write(
    options.dryRun
      ? "\nPreview complete. No files were changed.\n"
      : options.uninstall
        ? "\nDone. Managed VibeShield integration entries were removed.\n"
        : '\nDone.\n\nNow ask your AI:\n\n  "Check this project for security issues."\n',
  );
  return {
    detections,
    selected,
    results,
    cancelled: false,
    dryRun,
  };
}

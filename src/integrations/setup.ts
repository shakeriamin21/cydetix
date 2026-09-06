import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";

import { PRODUCT } from "../core/brand.js";
import { claudeAdapter } from "./claude/index.js";
import { codexAdapter } from "./codex/index.js";
import { copilotAdapter } from "./copilot/index.js";
import { cursorAdapter } from "./cursor/index.js";
import { discoverAgents, needsConfiguration } from "./discovery/index.js";
import { genericMcpAdapter } from "./generic-mcp/index.js";
import {
  readIntegrationState,
  writeIntegrationState,
  type LocalIntegrationStatus,
} from "./state.js";
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
  readonly remove?: boolean;
  readonly status?: boolean;
  readonly verify?: boolean;
  readonly quiet?: boolean;
  readonly interactive?: boolean;
  readonly confirm?: (prompt: string) => boolean | Promise<boolean>;
  readonly platform?: NodeJS.Platform;
  readonly executablePath?: string;
}

export interface SetupReport {
  readonly detections: readonly AgentDetection[];
  readonly selected: readonly AgentId[];
  readonly results: readonly AdapterResult[];
  readonly cancelled: boolean;
  readonly dryRun: boolean;
  readonly verified: boolean;
}

export function integrationContext(options: SetupOptions = {}): SetupContext {
  return {
    projectRoot: path.resolve(options.projectRoot ?? process.cwd()),
    homeDirectory: path.resolve(
      options.homeDirectory ?? process.env.CYDETIX_SETUP_HOME ?? os.homedir(),
    ),
    packageVersion: PRODUCT.version,
    platform: options.platform ?? process.platform,
    executablePath: options.executablePath ?? process.env.PATH ?? "",
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

function interactive(options: SetupOptions): boolean {
  if (options.interactive !== undefined) return options.interactive;
  return (
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    process.env.CI === undefined &&
    process.env.CYDETIX_NO_AUTO_SETUP !== "1" &&
    process.env.CYDETIX_AGENT_SUBPROCESS !== "1" &&
    process.env.CYDETIX_MCP !== "1"
  );
}

async function confirm(prompt: string, options: SetupOptions): Promise<boolean> {
  if (!interactive(options)) return false;
  if (options.confirm !== undefined) return options.confirm(prompt);
  const reader = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await reader.question(prompt)).trim().toLowerCase();
    return answer === "" || answer === "y" || answer === "yes";
  } finally {
    reader.close();
  }
}

function emit(options: SetupOptions, value: string): void {
  if (options.quiet !== true) process.stdout.write(value);
}

function selectedAgents(options: SetupOptions, detections: readonly AgentDetection[]): AgentId[] {
  const explicit = [...new Set(options.agents ?? [])];
  if (options.all === true) return INTEGRATION_ADAPTERS.map((adapter) => adapter.id);
  if (explicit.length > 0) return explicit;
  return detections
    .filter((detection) => detection.id !== "generic-mcp" && detection.detected)
    .map((detection) => detection.id);
}

function displayStatus(detection: AgentDetection): string {
  if (!detection.detected && detection.id !== "generic-mcp") return "not installed";
  return detection.integration.replaceAll("_", " ");
}

async function persistState(
  context: SetupContext,
  detections: readonly AgentDetection[],
  status: LocalIntegrationStatus,
): Promise<void> {
  await writeIntegrationState(context.projectRoot, {
    schemaVersion: "1.0.0",
    status,
    packageVersion: context.packageVersion,
    updatedAt: new Date().toISOString(),
    hosts: Object.fromEntries(detections.map((detection) => [detection.id, detection.integration])),
  });
}

export async function runSetup(options: SetupOptions = {}): Promise<SetupReport> {
  const context = integrationContext(options);
  const dryRun = options.dryRun === true;
  let detections = await discoverAgents(INTEGRATION_ADAPTERS, context);
  const selected = selectedAgents(options, detections);

  emit(options, "Cydetix Setup\n\nDetected agents:\n");
  const visible = detections.filter((detection) => detection.id !== "generic-mcp");
  const installed = visible.filter((detection) => detection.detected);
  if (options.status === true || options.verify === true) {
    for (const detection of detections)
      emit(options, `  ${detection.displayName} — ${displayStatus(detection)}\n`);
  } else if (installed.length === 0) emit(options, "  None\n");
  else
    for (const detection of installed)
      emit(options, `  ${detection.displayName} — ${displayStatus(detection)}\n`);

  if (options.status === true || options.verify === true) {
    const relevant =
      selected.length > 0 ? detections.filter((item) => selected.includes(item.id)) : visible;
    const verified =
      relevant.length > 0 &&
      relevant.every((detection) => !detection.detected || detection.integration === "configured");
    emit(
      options,
      options.verify
        ? `\nVerification: ${verified ? "PASS" : "NEEDS ATTENTION"}\n`
        : "\nNo configuration changes were made.\n",
    );
    return { detections, selected, results: [], cancelled: false, dryRun, verified };
  }

  if (selected.length === 0) {
    emit(
      options,
      "\nNo supported agent was detected. Use --agent generic-mcp for a portable pinned config.\n",
    );
    return { detections, selected, results: [], cancelled: false, dryRun, verified: true };
  }

  emit(options, `\n${options.remove ? "Remove" : "Install or update"}:\n`);
  for (const id of selected) {
    const adapter = INTEGRATION_ADAPTERS.find((candidate) => candidate.id === id);
    if (adapter !== undefined) emit(options, `  ${adapter.displayName}\n`);
  }
  const accepted =
    options.yes === true ||
    dryRun ||
    (await confirm(
      options.remove
        ? "Remove Cydetix from these AI agents? [Y/n] "
        : "Enable automatic Cydetix security checks in these AI agents? [Y/n] ",
      options,
    ));
  if (!accepted) {
    emit(
      options,
      interactive(options)
        ? "\nSetup cancelled.\n"
        : "\nNo changes made. Rerun with --yes for non-interactive setup.\n",
    );
    return { detections, selected, results: [], cancelled: true, dryRun, verified: false };
  }

  emit(
    options,
    dryRun ? "\nPreviewing...\n" : options.remove ? "\nRemoving...\n" : "\nInstalling...\n",
  );
  const results: AdapterResult[] = [];
  for (const id of selected) {
    const adapter = INTEGRATION_ADAPTERS.find((candidate) => candidate.id === id);
    if (adapter === undefined) continue;
    const result = options.remove
      ? await adapter.uninstall(context, dryRun)
      : await adapter.install(context, dryRun);
    results.push(result);
    emit(
      options,
      `  [${result.action}${result.verified ? ", verified" : ", verification failed"}] ${result.displayName}\n`,
    );
  }
  detections = dryRun ? detections : await discoverAgents(INTEGRATION_ADAPTERS, context);
  const verified = results.every((result) => result.verified);
  if (!dryRun)
    await persistState(
      context,
      detections,
      options.remove ? "declined" : verified ? "configured" : "partial",
    );
  emit(
    options,
    dryRun
      ? "\nPreview complete. No files were changed.\n"
      : options.remove
        ? "\nDone. Cydetix-owned integration entries were removed.\n"
        : '\nDone.\n\nNow ask your AI:\n\n  "Check this project for security issues."\n',
  );
  return { detections, selected, results, cancelled: false, dryRun, verified };
}

export async function runAutomaticIntegration(options: SetupOptions = {}): Promise<SetupReport> {
  const context = integrationContext(options);
  const detections = await discoverAgents(INTEGRATION_ADAPTERS, context);
  const candidates = detections.filter(
    (detection) => detection.id !== "generic-mcp" && needsConfiguration(detection),
  );
  if (candidates.length === 0 || !interactive(options))
    return {
      detections,
      selected: [],
      results: [],
      cancelled: false,
      dryRun: false,
      verified: candidates.length === 0,
    };
  const previous = await readIntegrationState(context.projectRoot);
  if (previous?.status === "declined")
    return {
      detections,
      selected: [],
      results: [],
      cancelled: true,
      dryRun: false,
      verified: false,
    };

  process.stdout.write("\nDetected AI agents:\n");
  for (const detection of candidates) process.stdout.write(`  ${detection.displayName}\n`);
  const accepted = await confirm(
    "\nEnable automatic security checks in these AI agents? [Y/n] ",
    options,
  );
  if (!accepted) {
    await persistState(context, detections, "declined");
    process.stdout.write("\nNot enabled. Run cydetix setup whenever you are ready.\n");
    return {
      detections,
      selected: candidates.map((candidate) => candidate.id),
      results: [],
      cancelled: true,
      dryRun: false,
      verified: false,
    };
  }
  const report = await runSetup({
    ...options,
    agents: candidates.map((candidate) => candidate.id),
    yes: true,
    quiet: true,
  });
  process.stdout.write("\nAI integration:\n");
  for (const result of report.results)
    process.stdout.write(
      `  ${result.displayName} ${result.verified ? "connected" : "needs attention"}\n`,
    );
  process.stdout.write(
    '\nDone. You do not need to mention Cydetix. Just ask:\n\n  "Check this project for security issues."\n',
  );
  return report;
}

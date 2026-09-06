import { accessSync, constants, existsSync } from "node:fs";
import { lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
export const MANAGED_MARKER = "Managed by vibeshield setup";
const MAX_CONFIG_BYTES = 1_048_576;
function errorCode(error) {
    if (typeof error !== "object" || error === null || !("code" in error))
        return undefined;
    return typeof error.code === "string" ? error.code : undefined;
}
export function commandAvailable(command) {
    const pathValue = process.env.PATH ?? "";
    const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];
    for (const directory of pathValue.split(path.delimiter)) {
        if (directory === "")
            continue;
        for (const extension of extensions) {
            try {
                accessSync(path.join(directory, `${command}${extension}`), constants.X_OK);
                return true;
            }
            catch {
                // Detection never executes agent binaries.
            }
        }
    }
    return false;
}
export function existingPaths(paths) {
    return paths.filter((candidate) => existsSync(candidate));
}
export function pinnedMcpServer(context, includeType = false) {
    const packageSpec = `vibeshield@${context.packageVersion}`;
    if (context.platform === "win32") {
        return {
            ...(includeType ? { type: "stdio" } : {}),
            command: "cmd",
            args: ["/c", "npx", "--yes", packageSpec, "mcp"],
        };
    }
    return {
        ...(includeType ? { type: "stdio" } : {}),
        command: "npx",
        args: ["--yes", packageSpec, "mcp"],
    };
}
async function readRegularFile(filePath) {
    const metadata = await lstat(filePath).catch((error) => {
        if (errorCode(error) === "ENOENT")
            return undefined;
        throw error;
    });
    if (metadata === undefined)
        return undefined;
    if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > MAX_CONFIG_BYTES)
        throw new Error(`Refusing to modify unsafe integration file: ${filePath}`);
    return readFile(filePath, "utf8");
}
async function atomicWrite(filePath, content) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporary = `${filePath}.vibeshield-${process.pid}.tmp`;
    await writeFile(temporary, content, { encoding: "utf8", flag: "wx" });
    await rename(temporary, filePath).catch(async (error) => {
        await rm(temporary, { force: true });
        throw error;
    });
}
function objectRecord(value) {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return {};
    return value;
}
export async function updateJsonServer(filePath, rootKey, server, remove, dryRun) {
    const existing = await readRegularFile(filePath);
    let root = {};
    if (existing !== undefined) {
        try {
            root = objectRecord(JSON.parse(existing));
        }
        catch {
            throw new Error(`Cannot safely merge invalid JSON integration config: ${filePath}`);
        }
    }
    const servers = { ...objectRecord(root[rootKey]) };
    const before = JSON.stringify(root);
    if (remove)
        delete servers.vibeshield;
    else
        servers.vibeshield = server;
    root[rootKey] = servers;
    if (JSON.stringify(root) === before)
        return false;
    if (!dryRun)
        await atomicWrite(filePath, `${JSON.stringify(root, null, 2)}\n`);
    return true;
}
export async function updateCodexToml(filePath, server, remove, dryRun) {
    const start = `# >>> ${MANAGED_MARKER} >>>`;
    const end = `# <<< ${MANAGED_MARKER} <<<`;
    const existing = (await readRegularFile(filePath)) ?? "";
    const managedPattern = new RegExp(`${start.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${end.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\r?\\n?`, "u");
    const withoutManaged = existing.replace(managedPattern, "").trimEnd();
    if (!managedPattern.test(existing) && /^\s*\[mcp_servers\.vibeshield\]\s*$/mu.test(existing))
        throw new Error(`A non-managed VibeShield MCP entry already exists in ${filePath}.`);
    const args = server.args.map((argument) => JSON.stringify(argument)).join(", ");
    const block = [
        start,
        "[mcp_servers.vibeshield]",
        `command = ${JSON.stringify(server.command)}`,
        `args = [${args}]`,
        end,
    ].join("\n");
    const next = remove
        ? withoutManaged === ""
            ? ""
            : `${withoutManaged}\n`
        : `${withoutManaged === "" ? "" : `${withoutManaged}\n\n`}${block}\n`;
    if (next === existing)
        return false;
    if (!dryRun)
        await atomicWrite(filePath, next);
    return true;
}
export async function writeManagedFile(filePath, content, remove, dryRun) {
    const existing = await readRegularFile(filePath);
    if (remove) {
        if (existing === undefined || !existing.includes(MANAGED_MARKER))
            return false;
        if (!dryRun)
            await rm(filePath, { force: true });
        return true;
    }
    if (existing !== undefined && !existing.includes(MANAGED_MARKER))
        throw new Error(`Refusing to overwrite a non-managed integration file: ${filePath}`);
    if (existing === content)
        return false;
    if (!dryRun)
        await atomicWrite(filePath, content);
    return true;
}
function skillSource(relative) {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return path.resolve(here, "..", "..", "agent-skills", "vibeshield", relative);
}
export async function installSkill(destination, includeOpenAiMetadata, remove, dryRun) {
    const targets = [
        { source: skillSource("SKILL.md"), destination: path.join(destination, "SKILL.md") },
    ];
    if (includeOpenAiMetadata)
        targets.push({
            source: skillSource(path.join("agents", "openai.yaml")),
            destination: path.join(destination, "agents", "openai.yaml"),
        });
    const changed = [];
    for (const target of targets) {
        const content = remove ? "" : await readFile(target.source, "utf8");
        if (await writeManagedFile(target.destination, content, remove, dryRun))
            changed.push(target.destination);
    }
    return changed;
}
export const AGENT_INSTRUCTIONS = `<!-- ${MANAGED_MARKER}. -->
Use VibeShield for security-related requests: security reviews, vulnerabilities, authentication,
authorization, sessions, JWT, OAuth, secrets, dependencies, supply chain, CI/CD security, deployment
readiness, or hardening. Prefer vibeshield_scan for read-only assessment and vibeshield_explain for
evidence. Use vibeshield_fix only after explicit user fix/remediate intent. Source changes require
confirmed user intent and remain limited to SAFE remediation. Never convert REVIEW_REQUIRED or
ARCHITECTURAL work to SAFE, and never invent findings or upgrade UNKNOWN without evidence.
Do not invoke VibeShield for unrelated coding, styling, pagination, renaming, or general debugging.
`;
//# sourceMappingURL=common.js.map
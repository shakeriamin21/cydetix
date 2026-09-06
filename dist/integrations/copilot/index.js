import path from "node:path";
import { AGENT_INSTRUCTIONS, commandAvailable, existingPaths, installSkill, pinnedMcpServer, updateJsonServer, writeManagedFile, } from "../common.js";
const INSTRUCTIONS = `---
applyTo: "**"
---

${AGENT_INSTRUCTIONS}`;
async function change(context, remove, dryRun) {
    const config = path.join(context.projectRoot, ".vscode", "mcp.json");
    const instructions = path.join(context.projectRoot, ".github", "instructions", "vibeshield.instructions.md");
    const skill = path.join(context.projectRoot, ".github", "skills", "vibeshield");
    const changed = await installSkill(skill, false, remove, dryRun);
    if (await updateJsonServer(config, "servers", pinnedMcpServer(context, true), remove, dryRun))
        changed.push(config);
    if (await writeManagedFile(instructions, INSTRUCTIONS, remove, dryRun))
        changed.push(instructions);
    return {
        id: "copilot",
        displayName: "GitHub Copilot",
        files: changed,
        action: changed.length === 0 ? "unchanged" : remove ? "removed" : "installed",
    };
}
export const copilotAdapter = {
    id: "copilot",
    displayName: "GitHub Copilot",
    detect(context) {
        const evidence = existingPaths([
            path.join(context.homeDirectory, ".copilot"),
            path.join(context.projectRoot, ".github", "copilot-instructions.md"),
            path.join(context.projectRoot, ".github", "skills"),
        ]);
        if (commandAvailable("copilot"))
            evidence.push("copilot executable on PATH");
        return { id: this.id, displayName: this.displayName, detected: evidence.length > 0, evidence };
    },
    install: (context, dryRun) => change(context, false, dryRun),
    uninstall: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map
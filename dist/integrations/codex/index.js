import path from "node:path";
import { commandAvailable, existingPaths, installSkill, pinnedMcpServer, updateCodexToml, } from "../common.js";
function paths(context) {
    return {
        config: path.join(context.homeDirectory, ".codex", "config.toml"),
        skill: path.join(context.homeDirectory, ".codex", "skills", "vibeshield"),
    };
}
async function change(context, remove, dryRun) {
    const target = paths(context);
    const changed = await installSkill(target.skill, true, remove, dryRun);
    if (await updateCodexToml(target.config, pinnedMcpServer(context), remove, dryRun))
        changed.push(target.config);
    return {
        id: "codex",
        displayName: "Codex",
        files: changed,
        action: changed.length === 0 ? "unchanged" : remove ? "removed" : "installed",
    };
}
export const codexAdapter = {
    id: "codex",
    displayName: "Codex",
    detect(context) {
        const evidence = existingPaths([
            path.join(context.homeDirectory, ".codex"),
            path.join(context.homeDirectory, ".chatgpt"),
            path.join(context.projectRoot, ".codex"),
        ]);
        if (commandAvailable("codex"))
            evidence.push("codex executable on PATH");
        return { id: this.id, displayName: this.displayName, detected: evidence.length > 0, evidence };
    },
    install: (context, dryRun) => change(context, false, dryRun),
    uninstall: (context, dryRun) => change(context, true, dryRun),
};
//# sourceMappingURL=index.js.map
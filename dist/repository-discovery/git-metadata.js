import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
async function regularTextFile(filePath, maxBytes) {
    const stat = await lstat(filePath).catch(() => undefined);
    if (stat === undefined || !stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes) {
        return undefined;
    }
    return readFile(filePath, "utf8").catch(() => undefined);
}
export async function inspectPassiveGitMetadata(root) {
    const gitDirectory = path.join(root, ".git");
    const stat = await lstat(gitDirectory).catch(() => undefined);
    if (stat === undefined || !stat.isDirectory() || stat.isSymbolicLink()) {
        return {
            commit: null,
            workingTreeState: "NOT_A_GIT_REPOSITORY",
            limitation: "No regular repository-local .git directory was available for passive metadata inspection.",
        };
    }
    const head = (await regularTextFile(path.join(gitDirectory, "HEAD"), 4096))?.trim();
    if (head === undefined) {
        return {
            commit: null,
            workingTreeState: "UNKNOWN",
            limitation: "Git HEAD could not be read passively; no Git command or repository hook was executed.",
        };
    }
    let commit;
    if (/^[a-f0-9]{40}$/.test(head))
        commit = head;
    else if (/^ref: refs\/[A-Za-z0-9._/-]+$/.test(head)) {
        const reference = head.slice("ref: ".length);
        commit = (await regularTextFile(path.join(gitDirectory, ...reference.split("/")), 4096))?.trim();
        if (commit === undefined) {
            const packed = await regularTextFile(path.join(gitDirectory, "packed-refs"), 4_194_304);
            commit = packed
                ?.split(/\r?\n/)
                .map((line) => line.trim().split(/\s+/, 2))
                .find((parts) => parts[1] === reference)?.[0];
        }
    }
    return {
        commit: commit !== undefined && /^[a-f0-9]{40}$/.test(commit) ? commit : null,
        workingTreeState: "UNKNOWN",
        limitation: "Working-tree cleanliness is UNKNOWN because Cydetix does not execute Git or repository-configured fsmonitor hooks during static analysis.",
    };
}
//# sourceMappingURL=git-metadata.js.map
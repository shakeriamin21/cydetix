import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { detectSecretsInText } from "./secrets.js";
function gitEnvironment() {
    return {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
        GIT_OPTIONAL_LOCKS: "0",
    };
}
function runGit(root, args, maxBuffer) {
    return spawnSync("git", [
        "-C",
        root,
        "-c",
        `safe.directory=${resolve(root).replaceAll("\\", "/")}`,
        "-c",
        `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
        "--no-pager",
        ...args,
    ], {
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 30_000,
        maxBuffer,
        env: gitEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
    });
}
function safeGitPath(candidate) {
    const normalized = candidate.replaceAll("\\", "/");
    if (normalized === "" ||
        normalized.startsWith("/") ||
        /^[A-Za-z]:/u.test(normalized) ||
        normalized.split("/").includes("..")) {
        return undefined;
    }
    return normalized;
}
export function scanGitHistory(root, maximumBytes = 32 * 1024 * 1024) {
    const start = performance.now();
    const probe = runGit(root, ["rev-parse", "--is-inside-work-tree"], 1024 * 1024);
    if (probe.error !== undefined && "code" in probe.error && probe.error.code === "ENOENT") {
        return {
            state: "GIT_UNAVAILABLE",
            exposures: [],
            message: "Git executable is unavailable; history was not checked.",
            milliseconds: performance.now() - start,
        };
    }
    if (probe.status !== 0 || probe.stdout.trim() !== "true") {
        return {
            state: "NOT_A_GIT_REPOSITORY",
            exposures: [],
            message: "Target is not a Git work tree; history was not checked.",
            milliseconds: performance.now() - start,
        };
    }
    const history = runGit(root, [
        "log",
        "--all",
        "--format=commit:%H",
        "--no-ext-diff",
        "--no-textconv",
        "--unified=0",
        "--",
        ".",
    ], maximumBytes);
    const truncated = history.error !== undefined && "code" in history.error && history.error.code === "ENOBUFS";
    if (history.status !== 0 && !truncated) {
        return {
            state: "FAILED",
            exposures: [],
            message: "Git history inspection failed safely; history results are unknown.",
            milliseconds: performance.now() - start,
        };
    }
    let commit = "unknown";
    let filePath;
    let newLine = 1;
    const exposures = [];
    for (const line of history.stdout.split(/\r?\n/u)) {
        if (line.startsWith("commit:")) {
            commit = line.slice("commit:".length, "commit:".length + 40);
            continue;
        }
        if (line.startsWith("+++ b/")) {
            filePath = safeGitPath(line.slice("+++ b/".length));
            continue;
        }
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u.exec(line);
        if (hunk !== null) {
            newLine = Number(hunk[1] ?? "1");
            continue;
        }
        if (filePath === undefined)
            continue;
        if (line.startsWith("+") && !line.startsWith("+++")) {
            const added = line.slice(1);
            exposures.push(...detectSecretsInText(added, {
                path: filePath,
                sourceCategory: "git-history",
                historyState: "historical",
                engine: `cydetix-git-history-v1:${commit.slice(0, 12)}`,
                lineOffset: Math.max(0, newLine - 1),
            }));
            newLine += 1;
        }
        else if (!line.startsWith("-")) {
            newLine += 1;
        }
    }
    const unique = [
        ...new Map(exposures.map((exposure) => [
            `${exposure.location.path}:${exposure.fingerprint}:${exposure.engine}`,
            exposure,
        ])).values(),
    ];
    return {
        state: truncated ? "TRUNCATED" : "CHECKED",
        exposures: unique,
        message: truncated
            ? `History output exceeded the ${maximumBytes} byte safety bound; partial redacted results are reported.`
            : `Git object history was inspected without checking out commits (${unique.length} redacted exposure(s)).`,
        milliseconds: performance.now() - start,
    };
}
//# sourceMappingURL=history.js.map
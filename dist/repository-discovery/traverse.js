import { lstat, opendir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { isWithinRoot, toReportPath } from "./boundary.js";
const BUILTIN_IGNORES = new Set([
    ".git",
    ".invariantsec",
    ".vibeshield",
    ".hg",
    ".svn",
    "node_modules",
    "target",
    "dist",
    "build",
    "coverage",
    ".next",
    ".npm-cache",
    ".venv",
    "venv",
    "__pycache__",
    ".tox",
]);
const ARCHIVE_EXTENSIONS = new Set([
    ".zip",
    ".7z",
    ".rar",
    ".tar",
    ".gz",
    ".tgz",
    ".bz2",
    ".xz",
    ".jar",
    ".war",
]);
function classifyLanguage(filePath) {
    const name = path.basename(filePath).toLowerCase();
    const extension = path.extname(name);
    if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension))
        return "javascript";
    if ([".ts", ".tsx", ".mts", ".cts"].includes(extension))
        return "typescript";
    if (extension === ".py")
        return "python";
    if ([".json", ".yaml", ".yml", ".toml", ".ini", ".conf", ".env"].includes(extension) ||
        ["dockerfile", "containerfile"].includes(name)) {
        return "configuration";
    }
    return "other";
}
function isBinary(buffer) {
    const sampleLength = Math.min(buffer.length, 8192);
    for (let index = 0; index < sampleLength; index += 1) {
        if (buffer[index] === 0)
            return true;
    }
    return false;
}
function ignoredByUser(relativePath, patterns) {
    const normalized = relativePath.replaceAll("\\", "/");
    return patterns.some((pattern) => {
        const clean = pattern.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
        return clean !== "" && (normalized === clean || normalized.startsWith(`${clean}/`));
    });
}
export async function traverseRepository(boundary, config) {
    const files = [];
    const skipped = [];
    const pending = [
        { absolutePath: boundary.root, depth: 0 },
    ];
    let bytesExamined = 0;
    let hitFileLimit = false;
    while (pending.length > 0 && !hitFileLimit) {
        const current = pending.pop();
        if (current === undefined)
            break;
        const directory = await opendir(current.absolutePath).catch(() => undefined);
        if (directory === undefined) {
            skipped.push({
                path: toReportPath(boundary.root, current.absolutePath) || ".",
                reason: "unreadable",
            });
            continue;
        }
        for await (const entry of directory) {
            const absolutePath = path.join(current.absolutePath, entry.name);
            const relativePath = toReportPath(boundary.root, absolutePath);
            if (BUILTIN_IGNORES.has(entry.name) || ignoredByUser(relativePath, config.additionalIgnore)) {
                skipped.push({ path: relativePath, reason: "ignored" });
                continue;
            }
            const stat = await lstat(absolutePath).catch(() => undefined);
            if (stat === undefined) {
                skipped.push({ path: relativePath, reason: "unreadable" });
                continue;
            }
            if (stat.isSymbolicLink()) {
                skipped.push({ path: relativePath, reason: "symlink" });
                continue;
            }
            if (stat.isDirectory()) {
                if (current.depth >= config.maxDepth) {
                    skipped.push({ path: relativePath, reason: "depth_limit" });
                }
                else {
                    pending.push({ absolutePath, depth: current.depth + 1 });
                }
                continue;
            }
            if (!stat.isFile())
                continue;
            if (files.length >= config.maxFiles) {
                skipped.push({ path: relativePath, reason: "file_limit" });
                hitFileLimit = true;
                break;
            }
            if (ARCHIVE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                skipped.push({ path: relativePath, reason: "archive" });
                continue;
            }
            if (stat.size > config.maxFileBytes) {
                skipped.push({ path: relativePath, reason: "too_large" });
                continue;
            }
            const canonical = await realpath(absolutePath).catch(() => undefined);
            if (canonical === undefined || !isWithinRoot(boundary.root, canonical)) {
                skipped.push({ path: relativePath, reason: "symlink" });
                continue;
            }
            const buffer = await readFile(canonical).catch(() => undefined);
            if (buffer === undefined) {
                skipped.push({ path: relativePath, reason: "unreadable" });
                continue;
            }
            if (isBinary(buffer)) {
                skipped.push({ path: relativePath, reason: "binary" });
                continue;
            }
            bytesExamined += buffer.length;
            files.push({
                absolutePath: canonical,
                relativePath,
                language: classifyLanguage(relativePath),
                text: buffer.toString("utf8"),
                size: buffer.length,
            });
        }
    }
    files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
    skipped.sort((left, right) => left.path.localeCompare(right.path));
    return {
        files,
        baseManifest: {
            root: boundary.root,
            filesExamined: files.length,
            bytesExamined,
            files: files.map((file) => file.relativePath),
            skipped,
        },
    };
}
//# sourceMappingURL=traverse.js.map
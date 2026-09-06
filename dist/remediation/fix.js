import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { lstat, open, realpath, rename, rm } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { isParseFailure, parseSource } from "../ast-analysis/parser.js";
import { scanRepository } from "../core/engine.js";
import { InvariantSecError, EXIT } from "../core/errors.js";
import { sha256, stableFingerprint } from "../core/hash.js";
import { createBoundary, isWithinRoot, readRegularFileInside, resolveInside, } from "../repository-discovery/boundary.js";
import { detectSecretsInText } from "../supply-chain/secrets.js";
import { createLocalExplicitRunner } from "../verification/runner.js";
import { remediationCandidateSchema, remediationReportSchema, remediationTransactionSchema, } from "./model.js";
const MAX_FIX_FILE_BYTES = 10_485_760;
const MAX_COMMAND_TIMEOUT_MS = 120_000;
function gitEnvironment() {
    return {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_OPTIONAL_LOCKS: "0",
        GIT_TERMINAL_PROMPT: "0",
    };
}
function runGit(root, arguments_) {
    return spawnSync("git", [
        "-C",
        root,
        "-c",
        `safe.directory=${path.resolve(root).replaceAll("\\", "/")}`,
        "-c",
        "core.fsmonitor=false",
        "-c",
        `core.hooksPath=${process.platform === "win32" ? "NUL" : "/dev/null"}`,
        "--no-pager",
        ...arguments_,
    ], {
        env: gitEnvironment(),
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 2_000_000,
        stdio: ["ignore", "pipe", "pipe"],
    });
}
export function inspectGitState(root) {
    const status = runGit(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    if (status.error !== undefined && "code" in status.error && status.error.code === "ENOENT") {
        return {
            available: false,
            isWorktree: false,
            changedPaths: [],
            note: "Git executable is unavailable; file hashes remain authoritative for this transaction.",
        };
    }
    if (status.status !== 0) {
        return {
            available: true,
            isWorktree: false,
            changedPaths: [],
            note: "Target is not a Git worktree; file hashes remain authoritative for this transaction.",
        };
    }
    const changedPaths = status.stdout
        .split("\0")
        .filter((entry) => entry.length >= 4)
        .map((entry) => entry.slice(3).replaceAll("\\", "/"))
        .filter((entry) => entry !== "")
        .sort();
    const head = runGit(root, ["rev-parse", "HEAD"]);
    const gitHead = /^[a-f0-9]{40}$/u.test(head.stdout.trim()) ? head.stdout.trim() : undefined;
    return {
        available: true,
        isWorktree: true,
        changedPaths,
        ...(gitHead === undefined ? {} : { gitHead }),
        note: changedPaths.length === 0
            ? "Git worktree is clean."
            : "Existing changes are recorded and must not be overwritten.",
    };
}
function languageFor(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if ([".js", ".jsx", ".mjs", ".cjs"].includes(extension))
        return "javascript";
    if ([".ts", ".tsx", ".mts", ".cts"].includes(extension))
        return "typescript";
    if (extension === ".py")
        return "python";
    if ([".json", ".yaml", ".yml", ".toml"].includes(extension))
        return "configuration";
    return "other";
}
function stableFindingId(finding) {
    return stableFingerprint([
        finding.ruleId,
        finding.category,
        finding.affectedComponent,
        finding.securityInvariant,
        finding.location.path,
        ...(finding.evidencePath?.map((step) => `${step.kind}:${step.location.path}`) ?? []),
    ]);
}
function verificationScope(finding) {
    if (finding.category === "ci-cd")
        return "WORKFLOW";
    if (finding.category === "dependency-security")
        return "DEPENDENCY_GRAPH";
    if (["authentication", "password-reset", "oauth"].includes(finding.category))
        return "AUTH_FLOW";
    if (finding.evidencePath !== undefined)
        return "MODULE";
    return "FILE";
}
function lineArray(text) {
    const lines = text.replaceAll("\r\n", "\n").split("\n");
    if (lines.at(-1) === "")
        lines.pop();
    return lines;
}
function redactForDiff(filePath, text) {
    let redacted = text;
    const unique = new Map();
    for (const exposure of detectSecretsInText(text, {
        path: filePath,
        sourceCategory: "working-tree",
        historyState: "current",
        engine: "vibeshield-remediation-diff-v1",
    })) {
        const key = `${exposure.location.start.offset}:${exposure.location.end.offset}`;
        if (!unique.has(key))
            unique.set(key, exposure);
    }
    const exposures = [...unique.values()].sort((left, right) => right.location.start.offset - left.location.start.offset);
    let nextStart = Number.POSITIVE_INFINITY;
    for (const exposure of exposures) {
        if (exposure.location.end.offset > nextStart)
            continue;
        redacted = `${redacted.slice(0, exposure.location.start.offset)}${exposure.redactedPreview}${redacted.slice(exposure.location.end.offset)}`;
        nextStart = exposure.location.start.offset;
    }
    return redacted;
}
export function createUnifiedDiff(filePath, before, after) {
    if (before === after)
        return `--- a/${filePath}\n+++ b/${filePath}\n`;
    const oldLines = lineArray(redactForDiff(filePath, before));
    const newLines = lineArray(redactForDiff(filePath, after));
    let prefix = 0;
    while (prefix < oldLines.length &&
        prefix < newLines.length &&
        oldLines[prefix] === newLines[prefix])
        prefix += 1;
    let suffix = 0;
    while (suffix < oldLines.length - prefix &&
        suffix < newLines.length - prefix &&
        oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix])
        suffix += 1;
    const contextStart = Math.max(0, prefix - 3);
    const oldEnd = Math.min(oldLines.length, oldLines.length - suffix + 3);
    const newEnd = Math.min(newLines.length, newLines.length - suffix + 3);
    const body = [];
    for (let index = contextStart; index < prefix; index += 1)
        body.push(` ${oldLines[index] ?? ""}`);
    for (let index = prefix; index < oldLines.length - suffix; index += 1)
        body.push(`-${oldLines[index] ?? ""}`);
    for (let index = prefix; index < newLines.length - suffix; index += 1)
        body.push(`+${newLines[index] ?? ""}`);
    const trailingStart = Math.max(prefix, oldLines.length - suffix);
    for (let index = trailingStart; index < oldEnd; index += 1)
        body.push(` ${oldLines[index] ?? ""}`);
    return [
        `--- a/${filePath}`,
        `+++ b/${filePath}`,
        `@@ -${contextStart + 1},${oldEnd - contextStart} +${contextStart + 1},${newEnd - contextStart} @@`,
        ...body,
        "",
    ].join("\n");
}
function applyEdits(text, edits) {
    let updated = text;
    for (const edit of [...edits].sort((left, right) => right.startOffset - left.startOffset)) {
        if (edit.startOffset > edit.endOffset || edit.endOffset > updated.length)
            throw new InvariantSecError(`Invalid remediation offsets for ${edit.path}.`, EXIT.verificationFailure);
        const current = updated.slice(edit.startOffset, edit.endOffset);
        if (sha256(current) !== edit.expectedTextSha256)
            throw new InvariantSecError(`Remediation precondition changed for ${edit.path}; rescan required.`, EXIT.verificationFailure);
        updated = `${updated.slice(0, edit.startOffset)}${edit.replacement}${updated.slice(edit.endOffset)}`;
    }
    return updated;
}
function planOnlyAdapter(finding) {
    if (finding.ruleId === "AS-CI-001")
        return "github-action-pin-plan-v1";
    if (finding.ruleId === "AS-SCA-001")
        return "dependency-upgrade-plan-v1";
    if (finding.ruleId === "AS-SECRET-001")
        return "secret-incident-plan-v1";
    return finding.autofix === "ARCHITECTURAL" ? "architectural-plan-v1" : "review-plan-v1";
}
function remediationSteps(finding) {
    if (finding.ruleId === "AS-SECRET-001") {
        return finding.title.includes("history")
            ? [
                "ROTATION_REQUIRED",
                "REVOCATION_REQUIRED",
                "HISTORY_REVIEW_REQUIRED",
                "HISTORY_REWRITE_REQUIRED",
                "MONITORING_REVIEW",
            ]
            : [
                "SOURCE_REMOVAL",
                "ROTATION_REQUIRED",
                "REVOCATION_REQUIRED",
                "HISTORY_REVIEW_REQUIRED",
                "MONITORING_REVIEW",
            ];
    }
    if (finding.ruleId === "AS-SCA-001")
        return ["DEPENDENCY_UPGRADE_REVIEW", "LOCKFILE_RESOLUTION_REQUIRED"];
    if (finding.ruleId === "AS-CI-001")
        return ["ACTION_SHA_RESOLUTION_REQUIRED"];
    if (finding.autofix === "ARCHITECTURAL")
        return ["ARCHITECTURE_CHANGE_REQUIRED"];
    if (finding.autofix === "REVIEW_REQUIRED")
        return ["BUSINESS_POLICY_REVIEW"];
    return [];
}
function residualRisk(finding) {
    if (finding.ruleId === "AS-SECRET-001")
        return [
            "Removing source text does not revoke or rotate a credential and does not remove historical copies.",
        ];
    if (finding.ruleId === "AS-SCA-001")
        return [
            "A proposed version is not remediated until the lockfile proves a nonaffected resolution and authorized tests pass.",
        ];
    if (finding.ruleId === "AS-CI-001")
        return [
            "No immutable Action revision can be proposed without an authoritative full commit SHA.",
        ];
    if (finding.autofix !== "SAFE")
        return ["Security semantics require human review before mutation."];
    return [];
}
function expectedInvariant(finding) {
    return finding.ruleId === "AS-SESSION-001" && finding.fix !== undefined
        ? "SESSION_COOKIE_HTTPONLY"
        : finding.securityInvariant;
}
async function buildCandidate(root, finding, gitState, authoritativeActionPins, externalCommandsAuthorized) {
    const boundary = await createBoundary(root);
    const file = await readRegularFileInside(boundary, finding.location.path, MAX_FIX_FILE_BYTES);
    const fileText = file.toString("utf8");
    const fileIsDirty = gitState.isWorktree && gitState.changedPaths.includes(finding.location.path);
    const fileBaseline = {
        path: finding.location.path,
        sha256: sha256(file),
        gitState: fileIsDirty
            ? "DIRTY"
            : gitState.isWorktree
                ? "CLEAN"
                : "UNKNOWN",
    };
    const transformations = [];
    if (finding.autofix === "SAFE" && finding.fix !== undefined) {
        const updated = applyEdits(fileText, [finding.fix]);
        transformations.push({
            id: `transformation:${stableFingerprint([finding.fingerprint, finding.fix.path, String(finding.fix.startOffset)]).slice(0, 16)}`,
            adapter: "session-http-only-v1",
            kind: "TEXT_REPLACEMENT",
            path: finding.fix.path,
            startOffset: finding.fix.startOffset,
            endOffset: finding.fix.endOffset,
            expectedTextSha256: finding.fix.expectedTextSha256,
            replacement: finding.fix.replacement,
            description: finding.fix.description,
            unifiedDiff: createUnifiedDiff(finding.fix.path, fileText, updated),
        });
    }
    else if (finding.ruleId === "AS-CI-001") {
        const authoritativeSha = authoritativeActionPins[finding.fingerprint];
        const validSha = authoritativeSha !== undefined && /^[a-f0-9]{40}$/u.test(authoritativeSha);
        transformations.push({
            id: `transformation:${stableFingerprint([finding.fingerprint, "action-pin"]).slice(0, 16)}`,
            adapter: "github-action-pin-plan-v1",
            kind: "PLAN_ONLY",
            path: finding.location.path,
            description: validSha
                ? `Review replacement with authoritatively resolved Action commit ${authoritativeSha}.`
                : "Resolve the intended Action release to an authoritative full commit SHA; no SHA was invented.",
        });
    }
    else {
        const description = finding.ruleId === "AS-SCA-001"
            ? `${finding.evidence[0]?.message ?? "Affected resolved dependency."} ${finding.remediation}`
            : finding.remediation;
        transformations.push({
            id: `transformation:${stableFingerprint([finding.fingerprint, "plan-only"]).slice(0, 16)}`,
            adapter: planOnlyAdapter(finding),
            kind: "PLAN_ONLY",
            path: finding.location.path,
            description,
        });
    }
    const state = finding.autofix === "SAFE" && finding.fix !== undefined && !fileIsDirty
        ? "PLANNED"
        : finding.autofix === "SAFE" && finding.fix === undefined
            ? "UNSUPPORTED"
            : "REQUIRES_REVIEW";
    return remediationCandidateSchema.parse({
        planId: `plan:${stableFingerprint([finding.fingerprint, fileBaseline.sha256]).slice(0, 16)}`,
        findingFingerprint: finding.fingerprint,
        stableFindingId: stableFindingId(finding),
        ruleId: finding.ruleId,
        classification: finding.autofix,
        state,
        affectedFiles: [finding.location.path],
        fileBaselines: [fileBaseline],
        preconditions: [
            "The target remains a regular non-symlink file inside the canonical repository root.",
            "The complete affected-file SHA-256 matches the scan-time baseline.",
            ...(finding.fix === undefined
                ? []
                : ["The exact vulnerable source range matches its expected SHA-256."]),
            ...(fileIsDirty ? ["The affected file is dirty; automatic mutation is refused."] : []),
        ],
        transformations,
        expectedSecurityInvariant: expectedInvariant(finding),
        verificationStrategy: {
            scope: verificationScope(finding),
            stages: finding.autofix === "SAFE" && finding.fix !== undefined
                ? [
                    "PATCH_STRUCTURE",
                    "PARSER",
                    "TRUSTED_COMMANDS",
                    "TARGETED_RESCAN",
                    "SECURITY_INVARIANT",
                ]
                : ["TARGETED_RESCAN", "SECURITY_INVARIANT"],
            externalCommandsAuthorized,
        },
        rollbackStrategy: "Keep original bytes in transaction memory and restore only VibeShield-written files whose post-write hashes still match.",
        remediationSteps: remediationSteps(finding),
        residualRisk: residualRisk(finding),
    });
}
async function planContext(options) {
    const planningStart = performance.now();
    const boundary = await createBoundary(options.path);
    const report = await scanRepository({
        path: boundary.root,
        advisories: options.advisories ?? "offline",
        ...(options.advisoryProvider === undefined
            ? {}
            : { advisoryProvider: options.advisoryProvider }),
    });
    const selected = report.findings.filter((finding) => options.finding === undefined || finding.fingerprint === options.finding);
    const gitState = inspectGitState(boundary.root);
    const candidates = await Promise.all(selected.map((finding) => buildCandidate(boundary.root, finding, gitState, options.authoritativeActionPins ?? {}, (options.verificationCommands?.length ?? 0) > 0)));
    const plans = [
        ...new Map(candidates.map((plan) => [
            plan.classification === "SAFE"
                ? `${plan.stableFindingId}:${plan.findingFingerprint}`
                : plan.stableFindingId,
            plan,
        ])).values(),
    ];
    const repositoryIdentity = stableFingerprint([
        gitState.gitHead ?? "no-git-head",
        ...report.manifest.files,
        ...plans.flatMap((plan) => plan.fileBaselines.map((file) => `${file.path}:${file.sha256}`)),
    ]);
    return {
        boundaryRoot: boundary.root,
        report,
        gitState,
        repositoryIdentity,
        plans,
        planningMilliseconds: performance.now() - planningStart,
    };
}
function exactTransformations(transformations) {
    return transformations.filter((item) => item.kind === "TEXT_REPLACEMENT" &&
        item.startOffset !== undefined &&
        item.endOffset !== undefined &&
        item.expectedTextSha256 !== undefined &&
        item.replacement !== undefined);
}
function verifyNoOverlaps(transformations) {
    const byPath = new Map();
    for (const item of exactTransformations(transformations))
        byPath.set(item.path, [...(byPath.get(item.path) ?? []), item]);
    for (const [filePath, items] of byPath) {
        const ascending = [...items].sort((left, right) => left.startOffset - right.startOffset);
        for (let index = 1; index < ascending.length; index += 1) {
            const previous = ascending[index - 1];
            const current = ascending[index];
            if (previous !== undefined &&
                current !== undefined &&
                previous.endOffset > current.startOffset)
                throw new InvariantSecError(`Refusing overlapping remediation edits in ${filePath}.`, EXIT.verificationFailure);
        }
    }
}
async function prepareFiles(root, plans) {
    const boundary = await createBoundary(root);
    const transformations = plans.flatMap((plan) => plan.transformations);
    verifyNoOverlaps(transformations);
    const baselines = new Map(plans.flatMap((plan) => plan.fileBaselines.map((file) => [file.path, file])));
    const byPath = new Map();
    for (const item of exactTransformations(transformations)) {
        byPath.set(item.path, [
            ...(byPath.get(item.path) ?? []),
            {
                path: item.path,
                startOffset: item.startOffset,
                endOffset: item.endOffset,
                expectedTextSha256: item.expectedTextSha256,
                replacement: item.replacement,
                description: item.description,
            },
        ]);
    }
    const prepared = [];
    for (const [filePath, edits] of byPath) {
        const baseline = baselines.get(filePath);
        if (baseline === undefined)
            throw new InvariantSecError(`Missing file baseline for ${filePath}.`, EXIT.verificationFailure);
        const target = resolveInside(boundary, filePath);
        const stat = await lstat(target);
        if (!stat.isFile() || stat.isSymbolicLink())
            throw new InvariantSecError(`Remediation target is not a regular file: ${filePath}`, EXIT.verificationFailure);
        const canonical = await realpath(target);
        if (!isWithinRoot(boundary.root, canonical))
            throw new InvariantSecError(`Remediation target escapes repository root: ${filePath}`, EXIT.verificationFailure);
        const before = await readRegularFileInside(boundary, filePath, MAX_FIX_FILE_BYTES);
        if (sha256(before) !== baseline.sha256)
            throw new InvariantSecError(`STALE_FINDING: ${filePath} changed after planning; rescan required.`, EXIT.verificationFailure);
        const afterText = applyEdits(before.toString("utf8"), edits);
        prepared.push({
            path: filePath,
            before,
            after: Buffer.from(afterText, "utf8"),
            mode: stat.mode,
        });
    }
    return prepared;
}
async function atomicReplace(root, file, expectedCurrentHash, content) {
    const boundary = await createBoundary(root);
    const target = resolveInside(boundary, file.path);
    const currentStat = await lstat(target);
    if (!currentStat.isFile() || currentStat.isSymbolicLink())
        throw new InvariantSecError(`Remediation target changed type: ${file.path}`, EXIT.verificationFailure);
    const canonical = await realpath(target);
    if (!isWithinRoot(boundary.root, canonical))
        throw new InvariantSecError(`Remediation target escaped the repository: ${file.path}`, EXIT.verificationFailure);
    const current = await readRegularFileInside(boundary, file.path, MAX_FIX_FILE_BYTES);
    if (sha256(current) !== expectedCurrentHash)
        throw new InvariantSecError(`Concurrent modification detected for ${file.path}.`, EXIT.verificationFailure);
    const canonicalDirectory = await realpath(path.dirname(canonical));
    if (!isWithinRoot(boundary.root, canonicalDirectory))
        throw new InvariantSecError(`Remediation target directory escaped the repository: ${file.path}`, EXIT.verificationFailure);
    const temporary = path.join(canonicalDirectory, `.vibeshield-remediation-${randomUUID()}.tmp`);
    if (!isWithinRoot(boundary.root, temporary))
        throw new InvariantSecError("Temporary remediation path escaped the repository.", EXIT.verificationFailure);
    try {
        const handle = await open(temporary, "wx", file.mode);
        try {
            await handle.writeFile(content);
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        const fresh = await readRegularFileInside(boundary, file.path, MAX_FIX_FILE_BYTES);
        if (sha256(fresh) !== expectedCurrentHash)
            throw new InvariantSecError(`Concurrent modification detected for ${file.path}.`, EXIT.verificationFailure);
        const freshStat = await lstat(target);
        const freshCanonical = await realpath(target);
        if (freshCanonical !== canonical ||
            freshStat.dev !== currentStat.dev ||
            freshStat.ino !== currentStat.ino)
            throw new InvariantSecError(`File identity changed during remediation: ${file.path}.`, EXIT.verificationFailure);
        await rename(temporary, canonical);
        const directoryHandle = await open(canonicalDirectory, "r").catch(() => undefined);
        if (directoryHandle !== undefined) {
            await directoryHandle.sync().catch(() => undefined);
            await directoryHandle.close();
        }
    }
    catch (error) {
        await rm(temporary, { force: true }).catch(() => undefined);
        throw error;
    }
    const written = await readRegularFileInside(boundary, file.path, MAX_FIX_FILE_BYTES);
    if (!written.equals(content))
        throw new InvariantSecError(`Atomic remediation write could not be verified: ${file.path}`, EXIT.verificationFailure);
}
function result(stage, status, message, started, commandFingerprint, execution) {
    return {
        stage,
        status,
        message,
        durationMilliseconds: performance.now() - started,
        ...(commandFingerprint === undefined ? {} : { commandFingerprint }),
        ...(execution === undefined ? {} : { execution }),
    };
}
async function parserVerification(root, files) {
    const started = performance.now();
    const boundary = await createBoundary(root);
    for (const file of files) {
        const text = (await readRegularFileInside(boundary, file.path, MAX_FIX_FILE_BYTES)).toString("utf8");
        const source = {
            absolutePath: resolveInside(boundary, file.path),
            relativePath: file.path,
            language: languageFor(file.path),
            text,
            size: Buffer.byteLength(text),
        };
        const parsed = parseSource(source);
        if (parsed === undefined || isParseFailure(parsed))
            return result("PARSER", "FAILED", parsed === undefined ? `No parser supports ${file.path}.` : parsed.message, started);
    }
    return result("PARSER", "PASSED", "Every changed source file reparsed successfully.", started);
}
async function runTrustedCommand(root, command, runner) {
    const started = performance.now();
    if (command.executable.trim() === "" || command.executable.includes("\0"))
        return result("TRUSTED_COMMAND", "FAILED", "Authorized command executable is invalid.", started);
    const execution = await runner.run(root, {
        executable: command.executable,
        arguments: [...command.arguments],
        workingDirectory: command.workingDirectory ?? ".",
        timeoutMilliseconds: Math.min(MAX_COMMAND_TIMEOUT_MS, Math.max(1, command.timeoutMilliseconds ?? 30_000)),
        networkPolicy: command.networkPolicy ?? "DENIED",
    });
    const passed = execution.state === "SUCCEEDED";
    const unavailable = ["SANDBOX_UNAVAILABLE", "SANDBOX_MISCONFIGURED"].includes(execution.state);
    return result("TRUSTED_COMMAND", passed ? "PASSED" : unavailable ? "UNAVAILABLE" : "FAILED", execution.message, started, execution.commandFingerprint, execution);
}
async function rollbackFiles(root, written) {
    const started = performance.now();
    try {
        for (const file of [...written].reverse())
            await atomicReplace(root, file, sha256(file.after), file.before);
        return {
            succeeded: true,
            verification: result("ROLLBACK", "PASSED", "VibeShield restored only its own in-memory transaction bytes.", started),
        };
    }
    catch {
        return {
            succeeded: false,
            verification: result("ROLLBACK", "FAILED", "Rollback refused or failed because a target no longer matched VibeShield's written hash.", started),
        };
    }
}
function reportSummary(plans, transactions, residualFindings) {
    return {
        safe: plans.filter((plan) => plan.classification === "SAFE").length,
        reviewRequired: plans.filter((plan) => plan.classification === "REVIEW_REQUIRED").length,
        architectural: plans.filter((plan) => plan.classification === "ARCHITECTURAL").length,
        applied: transactions.filter((item) => item.actualChanges.length > 0).length,
        verified: transactions.filter((item) => item.finalState === "APPLIED_VERIFIED").length,
        verificationFailed: transactions.filter((item) => [
            "VERIFICATION_FAILED",
            "ROLLBACK_SUCCEEDED",
            "ROLLBACK_FAILED",
            "SANDBOX_UNAVAILABLE",
            "SANDBOX_MISCONFIGURED",
        ].includes(item.finalState)).length,
        rolledBack: transactions.filter((item) => item.finalState === "ROLLBACK_SUCCEEDED").length,
        residualFindings,
    };
}
function transitionFor(plan, secure, rolledBack) {
    return {
        findingFingerprint: plan.findingFingerprint,
        stableFindingId: plan.stableFindingId,
        ruleId: plan.ruleId,
        invariant: plan.expectedSecurityInvariant,
        before: "PROVEN_INSECURE",
        after: secure ? "PROVEN_SECURE" : rolledBack ? "PROVEN_INSECURE" : "UNKNOWN",
        result: secure ? "RESOLVED_VERIFIED" : rolledBack ? "UNRESOLVED" : "UNKNOWN",
        evidencePaths: plan.affectedFiles,
    };
}
function failedBeforeWrite(base, plans, verificationResults, stale, startedAt, planning, transformation) {
    return remediationTransactionSchema.parse({
        ...base,
        actualChanges: [],
        verificationResults,
        findingStateTransitions: plans.map((plan) => transitionFor(plan, false, false)),
        finalState: stale ? "STALE_FINDING" : "VERIFICATION_FAILED",
        residualRisk: ["No remediation was applied; the original finding remains active."],
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        performanceMilliseconds: {
            planning,
            transformation,
            fileTransaction: 0,
            targetedRescan: 0,
            verification: transformation,
        },
    });
}
export async function executeSafeTransaction(root, plansInput, context, commands = [], scanOptions = {}, runtime = {}) {
    const startedAt = new Date();
    const verificationResults = [];
    const plans = plansInput.map((plan) => remediationCandidateSchema.parse(plan));
    const base = {
        schemaVersion: "1.0.0",
        transactionId: `transaction:${randomUUID()}`,
        findingFingerprints: plans.map((plan) => plan.findingFingerprint),
        ruleIds: [...new Set(plans.map((plan) => plan.ruleId))],
        repositoryBaseline: {
            identity: context.repositoryIdentity,
            ...(context.gitState.gitHead === undefined ? {} : { gitHead: context.gitState.gitHead }),
            changedPaths: [...context.gitState.changedPaths],
            files: [
                ...new Map(plans.flatMap((plan) => plan.fileBaselines).map((file) => [file.path, file])).values(),
            ],
        },
        classification: "SAFE",
        expectedSecurityInvariants: [...new Set(plans.map((plan) => plan.expectedSecurityInvariant))],
        plannedTransformations: plans.flatMap((plan) => plan.transformations),
    };
    if (plans.some((plan) => plan.classification !== "SAFE" || plan.state !== "PLANNED"))
        throw new InvariantSecError("Unsafe or unapproved remediation cannot enter a SAFE transaction.", EXIT.unsafeRemediation);
    const transformationStart = performance.now();
    let prepared;
    try {
        prepared = await prepareFiles(root, plans);
        verificationResults.push(result("PRECONDITION", "PASSED", "Canonical paths, file types, whole-file hashes, and vulnerable ranges match the plan.", transformationStart));
    }
    catch (error) {
        const stale = error instanceof Error && error.message.startsWith("STALE_FINDING");
        verificationResults.push(result("PRECONDITION", "FAILED", stale
            ? "Finding or source is stale; no write occurred and a rescan is required."
            : "Remediation precondition failed before any write.", transformationStart));
        return failedBeforeWrite(base, plans, verificationResults, stale, startedAt, context.planningMilliseconds, performance.now() - transformationStart);
    }
    const transformationMilliseconds = performance.now() - transformationStart;
    const actualChanges = prepared.map((file) => ({
        path: file.path,
        beforeSha256: sha256(file.before),
        afterSha256: sha256(file.after),
        unifiedDiff: createUnifiedDiff(file.path, file.before.toString("utf8"), file.after.toString("utf8")),
    }));
    verificationResults.push(result("PATCH_STRUCTURE", "PASSED", "All transformations are bounded, non-overlapping, and matched their source ranges.", transformationStart));
    const fileTransactionStart = performance.now();
    const written = [];
    try {
        for (const file of prepared) {
            await atomicReplace(root, file, sha256(file.before), file.after);
            written.push(file);
            await runtime.afterFileWrite?.(file.path, written.length);
        }
    }
    catch {
        const rollback = await rollbackFiles(root, written);
        verificationResults.push(result("PATCH_STRUCTURE", "FAILED", "A file transaction failed; verification did not begin.", fileTransactionStart), rollback.verification);
        return remediationTransactionSchema.parse({
            ...base,
            actualChanges: actualChanges.filter((change) => written.some((file) => file.path === change.path)),
            verificationResults,
            findingStateTransitions: plans.map((plan) => transitionFor(plan, false, rollback.succeeded)),
            finalState: rollback.succeeded ? "ROLLBACK_SUCCEEDED" : "ROLLBACK_FAILED",
            residualRisk: [
                "The original finding remains because the remediation transaction did not complete.",
            ],
            startedAt: startedAt.toISOString(),
            completedAt: new Date().toISOString(),
            performanceMilliseconds: {
                planning: context.planningMilliseconds,
                transformation: transformationMilliseconds,
                fileTransaction: performance.now() - fileTransactionStart,
                targetedRescan: 0,
                verification: performance.now() - fileTransactionStart,
            },
        });
    }
    const fileTransactionMilliseconds = performance.now() - fileTransactionStart;
    const verificationStart = performance.now();
    const parser = await parserVerification(root, prepared);
    verificationResults.push(parser);
    if (parser.status === "PASSED" && commands.length === 0)
        verificationResults.push(result("TRUSTED_COMMAND", "NOT_AUTHORIZED", "No external command was authorized; repository scripts were not executed.", performance.now()));
    if (parser.status === "PASSED") {
        const runner = runtime.verificationRunner ?? createLocalExplicitRunner();
        for (const command of commands) {
            const commandResult = await runTrustedCommand(root, command, runner);
            verificationResults.push(commandResult);
            if (commandResult.status !== "PASSED")
                break;
        }
    }
    const preRescanFailed = verificationResults.some((item) => ["FAILED", "UNAVAILABLE"].includes(item.status));
    let targetedRescanMilliseconds = 0;
    let secure = false;
    if (!preRescanFailed) {
        const rescanStart = performance.now();
        try {
            const rescan = await (runtime.scan ?? scanRepository)({
                path: root,
                advisories: scanOptions.advisories ?? "offline",
                ...(scanOptions.advisoryProvider === undefined
                    ? {}
                    : { advisoryProvider: scanOptions.advisoryProvider }),
            });
            targetedRescanMilliseconds = performance.now() - rescanStart;
            const targets = new Set(plans.map((plan) => plan.findingFingerprint));
            const remaining = rescan.findings.filter((finding) => targets.has(finding.fingerprint));
            verificationResults.push(result("TARGETED_RESCAN", remaining.length === 0 ? "PASSED" : "FAILED", remaining.length === 0
                ? "Correctness-first repository rescan no longer proves the targeted finding."
                : "The targeted finding remains provable after the patch.", rescanStart));
            const boundary = await createBoundary(root);
            const hashesMatch = await Promise.all(prepared.map(async (file) => sha256(await readRegularFileInside(boundary, file.path, MAX_FIX_FILE_BYTES)) ===
                sha256(file.after)));
            secure = remaining.length === 0 && hashesMatch.every(Boolean);
            verificationResults.push(result("SECURITY_INVARIANT", secure ? "PASSED" : "FAILED", secure
                ? "The deterministic adapter postcondition and rescan prove the intended invariant."
                : "The intended invariant could not be proven after remediation.", performance.now()));
        }
        catch {
            targetedRescanMilliseconds = performance.now() - rescanStart;
            verificationResults.push(result("TARGETED_RESCAN", "FAILED", "Security rescan failed safely; absence of a finding was not inferred.", rescanStart));
        }
    }
    if (!secure) {
        const rollback = await rollbackFiles(root, written);
        verificationResults.push(rollback.verification);
        const executionState = verificationResults
            .map((item) => item.execution?.state)
            .find((state) => state === "SANDBOX_UNAVAILABLE" || state === "SANDBOX_MISCONFIGURED");
        const finalState = !rollback.succeeded
            ? "ROLLBACK_FAILED"
            : executionState === "SANDBOX_UNAVAILABLE"
                ? "SANDBOX_UNAVAILABLE"
                : executionState === "SANDBOX_MISCONFIGURED"
                    ? "SANDBOX_MISCONFIGURED"
                    : "ROLLBACK_SUCCEEDED";
        return remediationTransactionSchema.parse({
            ...base,
            actualChanges,
            verificationResults,
            findingStateTransitions: plans.map((plan) => transitionFor(plan, false, rollback.succeeded)),
            finalState,
            residualRisk: [
                "Verification did not prove remediation; the original source was restored when safe.",
            ],
            startedAt: startedAt.toISOString(),
            completedAt: new Date().toISOString(),
            performanceMilliseconds: {
                planning: context.planningMilliseconds,
                transformation: transformationMilliseconds,
                fileTransaction: fileTransactionMilliseconds,
                targetedRescan: targetedRescanMilliseconds,
                verification: performance.now() - verificationStart,
            },
        });
    }
    return remediationTransactionSchema.parse({
        ...base,
        actualChanges,
        verificationResults,
        findingStateTransitions: plans.map((plan) => transitionFor(plan, true, false)),
        finalState: "APPLIED_VERIFIED",
        residualRisk: [],
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        performanceMilliseconds: {
            planning: context.planningMilliseconds,
            transformation: transformationMilliseconds,
            fileTransaction: fileTransactionMilliseconds,
            targetedRescan: targetedRescanMilliseconds,
            verification: performance.now() - verificationStart,
        },
    });
}
function reportFromContext(context, dryRun, transactions, residualFindings, limitations) {
    return remediationReportSchema.parse({
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        dryRun,
        repository: {
            identity: context.repositoryIdentity,
            ...(context.gitState.gitHead === undefined ? {} : { gitHead: context.gitState.gitHead }),
            changedPaths: [...context.gitState.changedPaths],
        },
        findingsConsidered: context.plans.length,
        plans: context.plans,
        transactions,
        summary: reportSummary(context.plans, transactions, residualFindings),
        limitations,
    });
}
export async function planRemediations(options) {
    const context = await planContext(options);
    return reportFromContext(context, true, [], context.report.findings.length, [
        "Repository-provided scripts and formatter configuration are not execution authorization.",
        "External commands require explicit authorization; Phase 5 does not claim sandbox or network isolation.",
        ...(options.finding !== undefined && context.plans.length === 0
            ? ["The requested finding is not active; the operation is an idempotent no-op."]
            : []),
    ]);
}
export async function runRemediation(options, runtime = {}) {
    const context = await planContext(options);
    const dryRun = options.dryRun === true || options.applySafe !== true;
    if (dryRun)
        return reportFromContext(context, true, [], context.report.findings.length, [
            "Dry-run performed zero repository writes.",
            "Repository-provided commands are not trusted verification policy.",
            ...(options.finding !== undefined && context.plans.length === 0
                ? ["The requested finding is not active; the operation is an idempotent no-op."]
                : []),
        ]);
    const applicable = context.plans.filter((plan) => plan.classification === "SAFE" && plan.state === "PLANNED");
    const transactions = applicable.length === 0
        ? []
        : [
            await executeSafeTransaction(context.boundaryRoot, applicable, context, options.verificationCommands ?? [], {
                advisories: options.advisories ?? "offline",
                ...(options.advisoryProvider === undefined
                    ? {}
                    : { advisoryProvider: options.advisoryProvider }),
            }, {
                ...runtime,
                ...(options.verificationRunner === undefined
                    ? {}
                    : { verificationRunner: options.verificationRunner }),
            }),
        ];
    const residualFindings = transactions.some((item) => item.finalState === "APPLIED_VERIFIED")
        ? Math.max(0, context.report.findings.length - applicable.length)
        : context.report.findings.length;
    return reportFromContext(context, false, transactions, residualFindings, [
        "Only SAFE plans in PLANNED state can enter the mutation transaction.",
        "Repository commands are not executed unless supplied as explicit trusted verification commands.",
        options.verificationRunner?.kind === "CONTAINER_SANDBOX"
            ? "Authorized commands use the selected container sandbox; unavailable isolation never falls back locally."
            : "Authorized local commands are bounded and non-shell but are not sandboxed; network isolation is not claimed.",
        ...(options.nonInteractive === true
            ? ["Non-interactive policy applied; no prompts were issued."]
            : []),
    ]);
}
/** Compatibility wrapper retained for pre-Phase-5 SDK callers. */
export async function applySafeFixes(options) {
    return runRemediation({
        path: options.path,
        ...(options.finding === undefined ? {} : { finding: options.finding }),
        dryRun: options.dryRun,
        applySafe: !options.dryRun,
    });
}
//# sourceMappingURL=fix.js.map
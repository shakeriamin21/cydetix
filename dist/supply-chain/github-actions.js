import { stableFingerprint } from "../core/hash.js";
import { pointAt } from "../rule-engine/finding.js";
import { parseDocument } from "yaml";
import { supplyChainEvidenceSchema, workflowAnalysisSchema, } from "./model.js";
function object(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function workflowFiles(files) {
    return files.filter((file) => /^\.github\/workflows\/[^/]+\.ya?ml$/iu.test(file.relativePath));
}
function location(file, needle, from = 0) {
    const offset = Math.max(0, file.text.indexOf(needle, from));
    return {
        path: file.relativePath,
        start: pointAt(file.text, offset),
        end: pointAt(file.text, offset + Math.max(1, needle.length)),
    };
}
function evidence(file, kind, needle, message) {
    return supplyChainEvidenceSchema.parse({
        id: `supply-evidence:${stableFingerprint([file.relativePath, kind, needle, message]).slice(0, 16)}`,
        kind,
        location: location(file, needle),
        message,
        redacted: /secrets\./u.test(needle),
    });
}
function pinning(reference, kind) {
    if (kind === "local-action")
        return "local";
    if (kind === "docker")
        return reference.includes("sha256:") ? "digest" : "tag";
    if (/^[a-f0-9]{40}$/iu.test(reference))
        return "full-sha";
    if (/^[a-f0-9]{7,39}$/iu.test(reference))
        return "short-sha";
    if (/^v?\d+(?:\.\d+){0,2}(?:[-+].+)?$/u.test(reference))
        return "tag";
    if (/^(?:main|master|develop|development|HEAD)$/iu.test(reference))
        return "branch";
    return "unknown";
}
function actionReference(file, job, uses, from) {
    const usesLocation = location(file, uses, from);
    if (uses.startsWith("./")) {
        return {
            id: `action:${stableFingerprint([file.relativePath, job, uses]).slice(0, 16)}`,
            workflow: file.relativePath,
            job,
            repository: uses,
            reference: "local",
            kind: "local-action",
            pinning: "local",
            location: usesLocation,
        };
    }
    if (uses.startsWith("docker://")) {
        const image = uses.slice("docker://".length);
        return {
            id: `action:${stableFingerprint([file.relativePath, job, uses]).slice(0, 16)}`,
            workflow: file.relativePath,
            job,
            repository: image.split("@")[0]?.split(":")[0] ?? image,
            reference: image.includes("@")
                ? (image.split("@")[1] ?? "unknown")
                : (image.split(":")[1] ?? "latest"),
            kind: "docker",
            pinning: pinning(image, "docker"),
            location: usesLocation,
        };
    }
    const at = uses.lastIndexOf("@");
    const repository = at > 0 ? uses.slice(0, at) : uses;
    const reference = at > 0 ? uses.slice(at + 1) : "unknown";
    const kind = repository.includes("/.github/workflows/") ? "reusable-workflow" : "external-action";
    return {
        id: `action:${stableFingerprint([file.relativePath, job, uses]).slice(0, 16)}`,
        workflow: file.relativePath,
        job,
        repository,
        reference,
        kind,
        pinning: pinning(reference, kind),
        location: usesLocation,
    };
}
function hasTrigger(root, name) {
    const triggers = root.on;
    if (typeof triggers === "string")
        return triggers === name;
    if (Array.isArray(triggers))
        return triggers.includes(name);
    return object(triggers)?.[name] !== undefined;
}
function permissionEntries(file, value, job) {
    if (typeof value === "string" && ["write-all", "read-all"].includes(value)) {
        return [
            {
                workflow: file.relativePath,
                ...(job === undefined ? {} : { job }),
                name: value,
                access: value,
                location: location(file, `permissions: ${value}`),
            },
        ];
    }
    return Object.entries(object(value) ?? {}).flatMap(([name, access]) => ["read", "write", "none"].includes(String(access))
        ? [
            {
                workflow: file.relativePath,
                ...(job === undefined ? {} : { job }),
                name,
                access: access,
                location: location(file, `${name}: ${String(access)}`),
            },
        ]
        : []);
}
const UNTRUSTED_EXPRESSIONS = [
    "github.event.issue.title",
    "github.event.issue.body",
    "github.event.pull_request.title",
    "github.event.pull_request.body",
    "github.event.pull_request.head.ref",
    "github.head_ref",
    "github.event.head_commit.message",
    "github.event.commits",
];
export function analyzeGithubActions(files) {
    const workflows = workflowFiles(files);
    const references = [];
    const permissions = [];
    const signals = [];
    const limitations = [];
    const pullRequestTargetWorkflows = [];
    const provenanceWorkflows = [];
    const collectedEvidence = [];
    for (const file of workflows) {
        let root;
        try {
            const document = parseDocument(file.text, { uniqueKeys: false });
            if (document.errors.length > 0)
                throw new Error(document.errors[0]?.message);
            root = object(document.toJS({ maxAliasCount: 50 }));
        }
        catch {
            limitations.push(`${file.relativePath}: invalid or unsupported YAML; no CI security conclusion was drawn.`);
            continue;
        }
        if (root === undefined)
            continue;
        collectedEvidence.push(evidence(file, "workflow", "jobs:", "GitHub Actions workflow parsed as data"));
        const pullRequestTarget = hasTrigger(root, "pull_request_target");
        if (pullRequestTarget)
            pullRequestTargetWorkflows.push(file.relativePath);
        permissions.push(...permissionEntries(file, root.permissions, undefined));
        const jobs = object(root.jobs) ?? {};
        let usesCursor = 0;
        let checkedOutUntrustedRevision = false;
        let executesAfterCheckout = false;
        let usesSecret = false;
        const chainLocations = [];
        for (const [jobName, rawJob] of Object.entries(jobs)) {
            const job = object(rawJob);
            if (job === undefined)
                continue;
            permissions.push(...permissionEntries(file, job.permissions, jobName));
            if (typeof job.uses === "string") {
                const reference = actionReference(file, jobName, job.uses, usesCursor);
                references.push(reference);
                usesCursor = reference.location.end.offset;
            }
            const steps = Array.isArray(job.steps) ? job.steps : [];
            let checkoutSeen = false;
            for (const rawStep of steps) {
                const step = object(rawStep);
                if (step === undefined)
                    continue;
                const uses = typeof step.uses === "string" ? step.uses : undefined;
                if (uses !== undefined) {
                    const reference = actionReference(file, jobName, uses, usesCursor);
                    references.push(reference);
                    usesCursor = reference.location.end.offset;
                    collectedEvidence.push(evidence(file, "action-reference", uses, `${reference.repository} uses ${reference.pinning} pinning`));
                    if (reference.repository === "actions/checkout") {
                        checkoutSeen = true;
                        const ref = object(step.with)?.ref;
                        const repository = object(step.with)?.repository;
                        if ((typeof ref === "string" && ref.includes("github.event.pull_request.head")) ||
                            (typeof repository === "string" &&
                                repository.includes("github.event.pull_request.head"))) {
                            checkedOutUntrustedRevision = true;
                            chainLocations.push({
                                offset: reference.location.start.offset,
                                needle: uses,
                                message: "pull_request_target job checks out contributor-controlled revision",
                            });
                        }
                    }
                    if (/actions\/attest|slsa-framework\/slsa-github-generator/iu.test(uses)) {
                        provenanceWorkflows.push(file.relativePath);
                    }
                }
                const run = typeof step.run === "string" ? step.run : undefined;
                if (run !== undefined) {
                    const runOffset = Math.max(0, file.text.indexOf(run));
                    if (checkoutSeen) {
                        executesAfterCheckout = true;
                        chainLocations.push({
                            offset: runOffset,
                            needle: run.slice(0, 80),
                            message: "workflow executes commands after the untrusted checkout",
                        });
                    }
                    if (/\$\{\{\s*secrets\.[A-Za-z0-9_]+\s*\}\}/u.test(run))
                        usesSecret = true;
                    for (const expression of UNTRUSTED_EXPRESSIONS) {
                        const needle = `\${{ ${expression} }}`;
                        if (!run.includes(needle) &&
                            !new RegExp(`\\$\\{\\{\\s*${expression.replaceAll(".", "\\.")}\\s*\\}\\}`, "u").test(run))
                            continue;
                        signals.push({
                            kind: "untrusted-context-in-shell",
                            workflow: file,
                            message: `${expression} is interpolated directly into a run script.`,
                            locations: [
                                {
                                    offset: runOffset,
                                    needle: expression,
                                    message: "attacker-controlled GitHub context reaches shell source",
                                },
                            ],
                        });
                    }
                }
                if (JSON.stringify(step).includes("${{ secrets."))
                    usesSecret = true;
            }
        }
        const writePermission = permissions.some((permission) => permission.workflow === file.relativePath &&
            (permission.access === "write" || permission.access === "write-all"));
        if (pullRequestTarget &&
            checkedOutUntrustedRevision &&
            executesAfterCheckout &&
            (usesSecret || writePermission)) {
            const triggerOffset = Math.max(0, file.text.indexOf("pull_request_target"));
            signals.push({
                kind: "dangerous-pull-request-target",
                workflow: file,
                message: "pull_request_target combines contributor-controlled checkout and execution with secrets or write permissions.",
                locations: [
                    {
                        offset: triggerOffset,
                        needle: "pull_request_target",
                        message: "privileged base-context trigger",
                    },
                    ...chainLocations,
                ],
            });
        }
    }
    return {
        analysis: workflowAnalysisSchema.parse({
            workflows: workflows.map((file) => file.relativePath),
            actionReferences: references,
            permissions,
            pullRequestTargetWorkflows: [...new Set(pullRequestTargetWorkflows)],
            provenanceWorkflows: [...new Set(provenanceWorkflows)],
            limitations,
        }),
        signals,
        evidence: collectedEvidence,
    };
}
//# sourceMappingURL=github-actions.js.map
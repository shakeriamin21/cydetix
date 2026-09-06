import { stableFingerprint } from "../core/hash.js";
import { pointAt } from "../rule-engine/finding.js";
import { dependencyInventorySchema, supplyChainEvidenceSchema, } from "./model.js";
function object(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value)
        ? value
        : undefined;
}
function stringRecord(value) {
    const candidate = object(value);
    if (candidate === undefined)
        return {};
    return Object.fromEntries(Object.entries(candidate).filter((entry) => typeof entry[1] === "string"));
}
function parseJson(file) {
    try {
        return object(JSON.parse(file.text));
    }
    catch {
        return undefined;
    }
}
function npmNameFromLockPath(lockPath) {
    const marker = "node_modules/";
    const index = lockPath.lastIndexOf(marker);
    if (index < 0)
        return undefined;
    const remainder = lockPath.slice(index + marker.length);
    if (remainder.startsWith("@")) {
        const [scope, name] = remainder.split("/");
        return scope !== undefined && name !== undefined ? `${scope}/${name}` : undefined;
    }
    return remainder.split("/")[0];
}
export function npmPurl(name, version) {
    if (name.startsWith("@") && name.includes("/")) {
        const slash = name.indexOf("/");
        const namespace = encodeURIComponent(name.slice(0, slash));
        const packageName = encodeURIComponent(name.slice(slash + 1));
        return `pkg:npm/${namespace}/${packageName}@${encodeURIComponent(version)}`;
    }
    return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}
function sourceFor(resolved) {
    if (resolved === undefined)
        return "unknown";
    if (resolved.startsWith("git+") || resolved.startsWith("git://"))
        return "git";
    if (resolved.startsWith("workspace:") || resolved.startsWith("file:"))
        return "workspace";
    if (resolved.startsWith("http://"))
        return "http";
    if (resolved.startsWith("https://")) {
        return resolved.includes("registry.npmjs.org") ? "registry" : "http";
    }
    return "unknown";
}
function locate(file, needle) {
    const offset = Math.max(0, file.text.indexOf(needle));
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
        location: locate(file, needle),
        message,
        redacted: false,
    });
}
function directDeclarations(manifest) {
    const result = new Map();
    const groups = [
        ["dependencies", "direct"],
        ["devDependencies", "dev"],
        ["optionalDependencies", "optional"],
        ["peerDependencies", "peer"],
    ];
    for (const [field, kind] of groups) {
        for (const name of Object.keys(stringRecord(manifest?.[field]))) {
            if (!result.has(name) || kind === "optional")
                result.set(name, kind);
        }
    }
    return result;
}
function resolveDependencyPath(fromPath, dependencyName, available) {
    let prefix = fromPath;
    for (;;) {
        const candidate = prefix
            ? `${prefix}/node_modules/${dependencyName}`
            : `node_modules/${dependencyName}`;
        if (available.has(candidate))
            return candidate;
        if (prefix === "")
            return undefined;
        const nested = prefix.lastIndexOf("/node_modules/");
        prefix = nested < 0 ? "" : prefix.slice(0, nested);
    }
}
function shortestPaths(root, packages, edges) {
    const byId = new Map(packages.map((component) => [component.id, component]));
    const outgoing = new Map();
    for (const edge of edges)
        outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
    const queue = [{ id: root, path: [root] }];
    const seen = new Set([root]);
    const results = [];
    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined)
            break;
        for (const target of outgoing.get(current.id) ?? []) {
            if (seen.has(target))
                continue;
            seen.add(target);
            const component = byId.get(target);
            if (component === undefined)
                continue;
            const path = [...current.path, component.purl];
            results.push({ packageId: target, path });
            queue.push({ id: target, path });
        }
    }
    return results.sort((left, right) => left.packageId.localeCompare(right.packageId));
}
export function buildNpmDependencyInventory(files) {
    const packageFile = files.find((file) => file.relativePath === "package.json");
    const lockFile = files.find((file) => file.relativePath === "package-lock.json");
    if (packageFile === undefined && lockFile === undefined) {
        return {
            inventory: dependencyInventorySchema.parse({
                status: "NOT_PRESENT",
                ecosystems: [],
                manifests: [],
                lockfiles: [],
                lifecycleScripts: [],
                packages: [],
                edges: [],
                paths: [],
                directCount: 0,
                transitiveCount: 0,
                limitations: [],
            }),
            evidence: [],
        };
    }
    const manifest = packageFile === undefined ? undefined : parseJson(packageFile);
    const lock = lockFile === undefined ? undefined : parseJson(lockFile);
    const lockPackages = object(lock?.packages);
    const declarations = directDeclarations(manifest ?? object(lockPackages?.[""]));
    const scripts = stringRecord(manifest?.scripts);
    const lifecycleScripts = packageFile === undefined
        ? []
        : ["preinstall", "install", "postinstall", "prepare"].flatMap((name) => scripts[name] === undefined
            ? []
            : [
                {
                    manifest: packageFile.relativePath,
                    name,
                    location: locate(packageFile, `"${name}"`),
                },
            ]);
    const collectedEvidence = [];
    if (packageFile !== undefined) {
        collectedEvidence.push(evidence(packageFile, "manifest", "{", "npm manifest parsed as data"));
    }
    if (lockFile !== undefined) {
        collectedEvidence.push(evidence(lockFile, "lockfile", "{", "npm lockfile parsed as data"));
    }
    if (lockFile === undefined || lock === undefined || lockPackages === undefined) {
        return {
            inventory: dependencyInventorySchema.parse({
                status: "PARTIAL",
                ecosystems: ["npm"],
                manifests: packageFile === undefined ? [] : [packageFile.relativePath],
                lockfiles: lockFile === undefined ? [] : [lockFile.relativePath],
                rootComponent: typeof manifest?.name === "string" && typeof manifest.version === "string"
                    ? npmPurl(manifest.name, manifest.version)
                    : undefined,
                lifecycleScripts,
                packages: [],
                edges: [],
                paths: [],
                directCount: declarations.size,
                transitiveCount: 0,
                limitations: [
                    lockFile === undefined
                        ? "package-lock.json is absent; declared ranges were not treated as resolved versions."
                        : "package-lock.json could not be parsed as a supported lockfileVersion 2/3 packages map.",
                ],
            }),
            evidence: collectedEvidence,
        };
    }
    const rawPackages = [];
    for (const [lockPath, raw] of Object.entries(lockPackages)) {
        if (lockPath === "")
            continue;
        const record = object(raw);
        const name = typeof record?.name === "string" ? record.name : npmNameFromLockPath(lockPath);
        if (name === undefined || typeof record?.version !== "string")
            continue;
        rawPackages.push({
            lockPath,
            name,
            version: record.version,
            dependencies: stringRecord(record.dependencies),
            ...(typeof record.integrity === "string" ? { integrity: record.integrity } : {}),
            ...(typeof record.resolved === "string" ? { resolved: record.resolved } : {}),
            dev: record.dev === true,
            optional: record.optional === true,
        });
    }
    const componentByLockPath = new Map();
    for (const raw of rawPackages) {
        const directKind = raw.lockPath === `node_modules/${raw.name}` ? declarations.get(raw.name) : undefined;
        const kind = directKind ?? "transitive";
        const dependencyEvidence = evidence(lockFile, "dependency", `"${raw.lockPath}"`, `${raw.name}@${raw.version} is resolved by package-lock.json`);
        collectedEvidence.push(dependencyEvidence);
        const purl = npmPurl(raw.name, raw.version);
        componentByLockPath.set(raw.lockPath, {
            id: `package:${stableFingerprint(["npm", raw.lockPath, purl]).slice(0, 16)}`,
            ecosystem: "npm",
            name: raw.name,
            version: raw.version,
            purl,
            kind,
            resolved: true,
            ...(raw.integrity === undefined ? {} : { integrity: raw.integrity }),
            source: sourceFor(raw.resolved),
            dev: raw.dev || kind === "dev",
            optional: raw.optional || kind === "optional",
            evidenceIds: [dependencyEvidence.id],
        });
    }
    const rootName = typeof manifest?.name === "string"
        ? manifest.name
        : typeof object(lockPackages[""])?.name === "string"
            ? String(object(lockPackages[""])?.name)
            : "application";
    const rootVersion = typeof manifest?.version === "string"
        ? manifest.version
        : typeof object(lockPackages[""])?.version === "string"
            ? String(object(lockPackages[""])?.version)
            : "0.0.0";
    const rootPurl = npmPurl(rootName, rootVersion);
    const availablePaths = new Set(componentByLockPath.keys());
    const edges = [];
    const rootEvidenceId = collectedEvidence[0]?.id;
    for (const name of declarations.keys()) {
        const target = componentByLockPath.get(`node_modules/${name}`);
        if (target === undefined)
            continue;
        edges.push({
            from: rootPurl,
            to: target.id,
            relationship: "DEPENDS_ON",
            evidenceIds: target.evidenceIds,
        });
    }
    for (const raw of rawPackages) {
        const source = componentByLockPath.get(raw.lockPath);
        if (source === undefined)
            continue;
        for (const dependencyName of Object.keys(raw.dependencies)) {
            const resolvedPath = resolveDependencyPath(raw.lockPath, dependencyName, availablePaths);
            const target = resolvedPath === undefined ? undefined : componentByLockPath.get(resolvedPath);
            if (target === undefined)
                continue;
            edges.push({
                from: source.id,
                to: target.id,
                relationship: "DEPENDS_ON",
                evidenceIds: [...new Set([...source.evidenceIds, ...target.evidenceIds])],
            });
        }
    }
    if (edges.length === 0 && rootEvidenceId !== undefined) {
        // Retain the parsed root evidence even when an empty lockfile has no relationships.
    }
    const packages = [...componentByLockPath.values()].sort((left, right) => left.id.localeCompare(right.id));
    const paths = shortestPaths(rootPurl, packages, edges);
    const directCount = packages.filter((component) => component.kind !== "transitive").length;
    return {
        inventory: dependencyInventorySchema.parse({
            status: "COMPLETE",
            ecosystems: ["npm"],
            manifests: packageFile === undefined ? [] : [packageFile.relativePath],
            lockfiles: [lockFile.relativePath],
            rootComponent: rootPurl,
            lifecycleScripts,
            packages,
            edges,
            paths,
            directCount,
            transitiveCount: packages.length - directCount,
            limitations: [
                "Inventory is resolved from package-lock.json without installing packages or executing lifecycle scripts.",
                "Runtime function reachability is UNKNOWN; package presence is not an exploitability claim.",
            ],
        }),
        evidence: collectedEvidence,
    };
}
//# sourceMappingURL=npm-inventory.js.map
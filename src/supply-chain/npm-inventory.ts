import { stableFingerprint } from "../core/hash.js";
import { pointAt } from "../rule-engine/finding.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import {
  dependencyInventorySchema,
  supplyChainEvidenceSchema,
  type DependencyInventory,
  type PackageComponent,
  type SupplyChainEvidence,
} from "./model.js";

type JsonObject = Record<string, unknown>;

interface LockPackage {
  readonly lockPath: string;
  readonly name: string;
  readonly version: string;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly integrity?: string;
  readonly resolved?: string;
  readonly dev: boolean;
  readonly optional: boolean;
}

export interface InventoryBuildResult {
  readonly inventory: DependencyInventory;
  readonly evidence: readonly SupplyChainEvidence[];
}

function object(value: unknown): JsonObject | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function stringRecord(value: unknown): Record<string, string> {
  const candidate = object(value);
  if (candidate === undefined) return {};
  return Object.fromEntries(
    Object.entries(candidate).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function parseJson(file: SourceFile): JsonObject | undefined {
  try {
    return object(JSON.parse(file.text));
  } catch {
    return undefined;
  }
}

function npmNameFromLockPath(lockPath: string): string | undefined {
  const marker = "node_modules/";
  const index = lockPath.lastIndexOf(marker);
  if (index < 0) return undefined;
  const remainder = lockPath.slice(index + marker.length);
  if (remainder.startsWith("@")) {
    const [scope, name] = remainder.split("/");
    return scope !== undefined && name !== undefined ? `${scope}/${name}` : undefined;
  }
  return remainder.split("/")[0];
}

export function npmPurl(name: string, version: string): string {
  if (name.startsWith("@") && name.includes("/")) {
    const slash = name.indexOf("/");
    const namespace = encodeURIComponent(name.slice(0, slash));
    const packageName = encodeURIComponent(name.slice(slash + 1));
    return `pkg:npm/${namespace}/${packageName}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function sourceFor(resolved: string | undefined): PackageComponent["source"] {
  if (resolved === undefined) return "unknown";
  if (resolved.startsWith("git+") || resolved.startsWith("git://")) return "git";
  if (resolved.startsWith("workspace:") || resolved.startsWith("file:")) return "workspace";
  if (resolved.startsWith("http://")) return "http";
  if (resolved.startsWith("https://")) {
    return resolved.includes("registry.npmjs.org") ? "registry" : "http";
  }
  return "unknown";
}

function locate(file: SourceFile, needle: string) {
  const offset = Math.max(0, file.text.indexOf(needle));
  return {
    path: file.relativePath,
    start: pointAt(file.text, offset),
    end: pointAt(file.text, offset + Math.max(1, needle.length)),
  };
}

function evidence(
  file: SourceFile,
  kind: SupplyChainEvidence["kind"],
  needle: string,
  message: string,
): SupplyChainEvidence {
  return supplyChainEvidenceSchema.parse({
    id: `supply-evidence:${stableFingerprint([file.relativePath, kind, needle, message]).slice(0, 16)}`,
    kind,
    location: locate(file, needle),
    message,
    redacted: false,
  });
}

function directDeclarations(
  manifest: JsonObject | undefined,
): Map<string, PackageComponent["kind"]> {
  const result = new Map<string, PackageComponent["kind"]>();
  const groups: Array<[string, PackageComponent["kind"]]> = [
    ["dependencies", "direct"],
    ["devDependencies", "dev"],
    ["optionalDependencies", "optional"],
    ["peerDependencies", "peer"],
  ];
  for (const [field, kind] of groups) {
    for (const name of Object.keys(stringRecord(manifest?.[field]))) {
      if (!result.has(name) || kind === "optional") result.set(name, kind);
    }
  }
  return result;
}

function resolveDependencyPath(
  fromPath: string,
  dependencyName: string,
  available: ReadonlySet<string>,
): string | undefined {
  let prefix = fromPath;
  for (;;) {
    const candidate = prefix
      ? `${prefix}/node_modules/${dependencyName}`
      : `node_modules/${dependencyName}`;
    if (available.has(candidate)) return candidate;
    if (prefix === "") return undefined;
    const nested = prefix.lastIndexOf("/node_modules/");
    prefix = nested < 0 ? "" : prefix.slice(0, nested);
  }
}

function shortestPaths(
  root: string,
  packages: readonly PackageComponent[],
  edges: DependencyInventory["edges"],
): DependencyInventory["paths"] {
  const byId = new Map(packages.map((component) => [component.id, component]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge.to]);
  const queue: Array<{ id: string; path: string[] }> = [{ id: root, path: [root] }];
  const seen = new Set([root]);
  const results: DependencyInventory["paths"] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const target of outgoing.get(current.id) ?? []) {
      if (seen.has(target)) continue;
      seen.add(target);
      const component = byId.get(target);
      if (component === undefined) continue;
      const path = [...current.path, component.purl];
      results.push({ packageId: target, path });
      queue.push({ id: target, path });
    }
  }
  return results.sort((left, right) => left.packageId.localeCompare(right.packageId));
}

export function buildNpmDependencyInventory(files: readonly SourceFile[]): InventoryBuildResult {
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
  const lifecycleScripts =
    packageFile === undefined
      ? []
      : (["preinstall", "install", "postinstall", "prepare"] as const).flatMap((name) =>
          scripts[name] === undefined
            ? []
            : [
                {
                  manifest: packageFile.relativePath,
                  name,
                  location: locate(packageFile, `"${name}"`),
                },
              ],
        );
  const collectedEvidence: SupplyChainEvidence[] = [];
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
        rootComponent:
          typeof manifest?.name === "string" && typeof manifest.version === "string"
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

  const rawPackages: LockPackage[] = [];
  for (const [lockPath, raw] of Object.entries(lockPackages)) {
    if (lockPath === "") continue;
    const record = object(raw);
    const name = typeof record?.name === "string" ? record.name : npmNameFromLockPath(lockPath);
    if (name === undefined || typeof record?.version !== "string") continue;
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

  const componentByLockPath = new Map<string, PackageComponent>();
  for (const raw of rawPackages) {
    const directKind =
      raw.lockPath === `node_modules/${raw.name}` ? declarations.get(raw.name) : undefined;
    const kind = directKind ?? "transitive";
    const dependencyEvidence = evidence(
      lockFile,
      "dependency",
      `"${raw.lockPath}"`,
      `${raw.name}@${raw.version} is resolved by package-lock.json`,
    );
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

  const rootName =
    typeof manifest?.name === "string"
      ? manifest.name
      : typeof object(lockPackages[""])?.name === "string"
        ? String(object(lockPackages[""])?.name)
        : "application";
  const rootVersion =
    typeof manifest?.version === "string"
      ? manifest.version
      : typeof object(lockPackages[""])?.version === "string"
        ? String(object(lockPackages[""])?.version)
        : "0.0.0";
  const rootPurl = npmPurl(rootName, rootVersion);
  const availablePaths = new Set(componentByLockPath.keys());
  const edges: DependencyInventory["edges"] = [];
  const rootEvidenceId = collectedEvidence[0]?.id;
  for (const name of declarations.keys()) {
    const target = componentByLockPath.get(`node_modules/${name}`);
    if (target === undefined) continue;
    edges.push({
      from: rootPurl,
      to: target.id,
      relationship: "DEPENDS_ON",
      evidenceIds: target.evidenceIds,
    });
  }
  for (const raw of rawPackages) {
    const source = componentByLockPath.get(raw.lockPath);
    if (source === undefined) continue;
    for (const dependencyName of Object.keys(raw.dependencies)) {
      const resolvedPath = resolveDependencyPath(raw.lockPath, dependencyName, availablePaths);
      const target = resolvedPath === undefined ? undefined : componentByLockPath.get(resolvedPath);
      if (target === undefined) continue;
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
  const packages = [...componentByLockPath.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
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

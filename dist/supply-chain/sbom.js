import { createHash } from "node:crypto";
import { z } from "zod";
import { PRODUCT } from "../core/brand.js";
const bomComponentSchema = z
    .object({
    type: z.enum(["application", "library"]),
    "bom-ref": z.string().min(1),
    name: z.string().min(1),
    version: z.string().min(1),
    purl: z.string().regex(/^pkg:/),
    scope: z.enum(["required", "optional", "excluded"]).optional(),
    properties: z
        .array(z.object({ name: z.string().min(1), value: z.string() }).strict())
        .optional(),
})
    .strict();
export const cycloneDx17Schema = z
    .object({
    $schema: z.literal("https://cyclonedx.org/schema/bom-1.7.schema.json"),
    bomFormat: z.literal("CycloneDX"),
    specVersion: z.literal("1.7"),
    serialNumber: z.string().regex(/^urn:uuid:[0-9a-f-]{36}$/),
    version: z.number().int().positive(),
    metadata: z
        .object({
        timestamp: z.iso.datetime(),
        tools: z.object({ components: z.array(bomComponentSchema).min(1) }).strict(),
        component: bomComponentSchema.optional(),
    })
        .strict(),
    components: z.array(bomComponentSchema),
    dependencies: z.array(z.object({ ref: z.string().min(1), dependsOn: z.array(z.string().min(1)) }).strict()),
    compositions: z.array(z
        .object({
        aggregate: z.enum(["complete", "incomplete", "unknown"]),
        assemblies: z.array(z.string()),
    })
        .strict()),
})
    .strict();
function stableUuid(seed) {
    const bytes = createHash("sha256").update(seed).digest().subarray(0, 16);
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = bytes.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
function decodePurlRoot(purl) {
    const body = purl.replace(/^pkg:npm\//u, "");
    const at = body.lastIndexOf("@");
    const rawName = at > 0 ? body.slice(0, at) : body;
    return {
        name: decodeURIComponent(rawName).replace("%40", "@"),
        version: at > 0 ? decodeURIComponent(body.slice(at + 1)) : "0.0.0",
    };
}
export function generateCycloneDxSbom(inventory, now = new Date()) {
    const byPurl = new Map(inventory.packages.map((component) => [component.purl, component]));
    const purlById = new Map(inventory.packages.map((component) => [component.id, component.purl]));
    const components = [...byPurl.values()]
        .sort((left, right) => left.purl.localeCompare(right.purl))
        .map((component) => ({
        type: "library",
        "bom-ref": component.purl,
        name: component.name,
        version: component.version,
        purl: component.purl,
        scope: component.optional ? "optional" : "required",
        properties: [
            { name: "cydetix:dependency-kind", value: component.kind },
            { name: "cydetix:resolved", value: String(component.resolved) },
            { name: "cydetix:source", value: component.source },
        ],
    }));
    const rootPurl = inventory.rootComponent;
    const root = rootPurl === undefined ? undefined : decodePurlRoot(rootPurl);
    const dependenciesByRef = new Map();
    for (const edge of inventory.edges) {
        const from = edge.from.startsWith("pkg:") ? edge.from : purlById.get(edge.from);
        const to = purlById.get(edge.to);
        if (from === undefined || to === undefined)
            continue;
        dependenciesByRef.set(from, new Set([...(dependenciesByRef.get(from) ?? []), to]));
    }
    for (const component of components) {
        if (!dependenciesByRef.has(component.purl))
            dependenciesByRef.set(component.purl, new Set());
    }
    const assemblies = [
        ...(rootPurl === undefined ? [] : [rootPurl]),
        ...components.map((component) => component.purl),
    ];
    return cycloneDx17Schema.parse({
        $schema: "https://cyclonedx.org/schema/bom-1.7.schema.json",
        bomFormat: "CycloneDX",
        specVersion: "1.7",
        serialNumber: `urn:uuid:${stableUuid(`${rootPurl ?? "application"}:${components.map((component) => component.purl).join("|")}`)}`,
        version: 1,
        metadata: {
            timestamp: now.toISOString(),
            tools: {
                components: [
                    {
                        type: "application",
                        "bom-ref": `pkg:npm/cydetix@${PRODUCT.version}`,
                        name: PRODUCT.id,
                        version: PRODUCT.version,
                        purl: `pkg:npm/cydetix@${PRODUCT.version}`,
                    },
                ],
            },
            ...(rootPurl === undefined || root === undefined
                ? {}
                : {
                    component: {
                        type: "application",
                        "bom-ref": rootPurl,
                        name: root.name,
                        version: root.version,
                        purl: rootPurl,
                    },
                }),
        },
        components,
        dependencies: [...dependenciesByRef.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([ref, dependsOn]) => ({ ref, dependsOn: [...dependsOn].sort() })),
        compositions: [
            {
                aggregate: inventory.status === "COMPLETE"
                    ? "complete"
                    : inventory.status === "NOT_PRESENT"
                        ? "unknown"
                        : "incomplete",
                assemblies,
            },
        ],
    });
}
//# sourceMappingURL=sbom.js.map
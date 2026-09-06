import { z } from "zod";
import type { DependencyInventory } from "./model.js";
export declare const cycloneDx17Schema: z.ZodObject<{
    $schema: z.ZodLiteral<"https://cyclonedx.org/schema/bom-1.7.schema.json">;
    bomFormat: z.ZodLiteral<"CycloneDX">;
    specVersion: z.ZodLiteral<"1.7">;
    serialNumber: z.ZodString;
    version: z.ZodNumber;
    metadata: z.ZodObject<{
        timestamp: z.ZodISODateTime;
        tools: z.ZodObject<{
            components: z.ZodArray<z.ZodObject<{
                type: z.ZodEnum<{
                    application: "application";
                    library: "library";
                }>;
                "bom-ref": z.ZodString;
                name: z.ZodString;
                version: z.ZodString;
                purl: z.ZodString;
                scope: z.ZodOptional<z.ZodEnum<{
                    optional: "optional";
                    required: "required";
                    excluded: "excluded";
                }>>;
                properties: z.ZodOptional<z.ZodArray<z.ZodObject<{
                    name: z.ZodString;
                    value: z.ZodString;
                }, z.core.$strict>>>;
            }, z.core.$strict>>;
        }, z.core.$strict>;
        component: z.ZodOptional<z.ZodObject<{
            type: z.ZodEnum<{
                application: "application";
                library: "library";
            }>;
            "bom-ref": z.ZodString;
            name: z.ZodString;
            version: z.ZodString;
            purl: z.ZodString;
            scope: z.ZodOptional<z.ZodEnum<{
                optional: "optional";
                required: "required";
                excluded: "excluded";
            }>>;
            properties: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                value: z.ZodString;
            }, z.core.$strict>>>;
        }, z.core.$strict>>;
    }, z.core.$strict>;
    components: z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            application: "application";
            library: "library";
        }>;
        "bom-ref": z.ZodString;
        name: z.ZodString;
        version: z.ZodString;
        purl: z.ZodString;
        scope: z.ZodOptional<z.ZodEnum<{
            optional: "optional";
            required: "required";
            excluded: "excluded";
        }>>;
        properties: z.ZodOptional<z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            value: z.ZodString;
        }, z.core.$strict>>>;
    }, z.core.$strict>>;
    dependencies: z.ZodArray<z.ZodObject<{
        ref: z.ZodString;
        dependsOn: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
    compositions: z.ZodArray<z.ZodObject<{
        aggregate: z.ZodEnum<{
            unknown: "unknown";
            complete: "complete";
            incomplete: "incomplete";
        }>;
        assemblies: z.ZodArray<z.ZodString>;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type CycloneDx17Bom = z.infer<typeof cycloneDx17Schema>;
export declare function generateCycloneDxSbom(inventory: DependencyInventory, now?: Date): CycloneDx17Bom;
//# sourceMappingURL=sbom.d.ts.map
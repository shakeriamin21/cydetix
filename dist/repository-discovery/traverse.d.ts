import type { InvariantSecConfig, RepositoryManifest } from "../core/schema.js";
import { type RepositoryBoundary } from "./boundary.js";
export type SourceLanguage = "javascript" | "typescript" | "python" | "configuration" | "other";
export interface SourceFile {
    readonly absolutePath: string;
    readonly relativePath: string;
    readonly language: SourceLanguage;
    readonly text: string;
    readonly size: number;
}
export interface TraversalResult {
    readonly files: readonly SourceFile[];
    readonly baseManifest: Pick<RepositoryManifest, "root" | "filesExamined" | "bytesExamined" | "files" | "skipped">;
}
export declare function traverseRepository(boundary: RepositoryBoundary, config: InvariantSecConfig): Promise<TraversalResult>;
//# sourceMappingURL=traverse.d.ts.map
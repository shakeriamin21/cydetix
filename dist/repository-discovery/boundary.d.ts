export interface RepositoryBoundary {
    readonly root: string;
}
export type DangerousRepositoryPath = "absolute" | "nul" | "traversal" | undefined;
export declare function isWithinRoot(root: string, candidate: string): boolean;
/**
 * Repository-controlled paths remain untrusted if they use another supported platform's syntax.
 * Classify them before applying host-native resolution so, for example, POSIX cannot reinterpret a
 * Windows UNC path or backslash traversal as an ordinary filename.
 */
export declare function dangerousRepositoryPath(relativePath: string): DangerousRepositoryPath;
export declare function createBoundary(inputPath: string): Promise<RepositoryBoundary>;
export declare function resolveInside(boundary: RepositoryBoundary, relativePath: string): string;
export declare function readRegularFileInside(boundary: RepositoryBoundary, relativePath: string, maxBytes: number): Promise<Buffer>;
export declare function toReportPath(root: string, absolutePath: string): string;
//# sourceMappingURL=boundary.d.ts.map
export interface RepositoryBoundary {
    readonly root: string;
}
export declare function isWithinRoot(root: string, candidate: string): boolean;
export declare function createBoundary(inputPath: string): Promise<RepositoryBoundary>;
export declare function resolveInside(boundary: RepositoryBoundary, relativePath: string): string;
export declare function readRegularFileInside(boundary: RepositoryBoundary, relativePath: string, maxBytes: number): Promise<Buffer>;
export declare function toReportPath(root: string, absolutePath: string): string;
//# sourceMappingURL=boundary.d.ts.map
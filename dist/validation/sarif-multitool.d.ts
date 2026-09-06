export interface SarifMultitoolInstallation {
    readonly platform: NodeJS.Platform;
    readonly exportedExecutablePath: string;
    readonly wrapperPackageJsonPath: string;
    readonly platformPackageJsonPath: string;
}
export interface SarifMultitoolFileSystem {
    realpath(file: string): Promise<string>;
    readText(file: string): Promise<string>;
    statFile(file: string): Promise<{
        readonly isFile: boolean;
        readonly mode: number;
    }>;
    chmod(file: string, mode: number): Promise<void>;
    access(file: string, mode: number): Promise<void>;
}
export declare function prepareTrustedSarifMultitoolExecutable(installation: SarifMultitoolInstallation, fileSystem?: SarifMultitoolFileSystem): Promise<string>;
export declare function resolveSarifMultitoolExecutable(): Promise<string>;
//# sourceMappingURL=sarif-multitool.d.ts.map
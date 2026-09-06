import { type SandboxCapability, type VerificationCommand, type VerificationExecutionResult } from "./model.js";
export interface VerificationRunner {
    readonly kind: "NO_EXECUTION" | "LOCAL_EXPLICIT" | "CONTAINER_SANDBOX";
    capability(): Promise<SandboxCapability>;
    run(repositoryRoot: string, command: VerificationCommand): Promise<VerificationExecutionResult>;
}
export declare function createNoExecutionRunner(): VerificationRunner;
export declare function createLocalExplicitRunner(): VerificationRunner;
interface ContainerRunnerOptions {
    readonly image: string;
    readonly dockerExecutable?: string;
    readonly temporaryRoot?: string;
}
export declare function buildContainerArguments(image: string, containerName: string, workspace: string, command: VerificationCommand): string[];
export declare function createContainerSandboxRunner(options: ContainerRunnerOptions): VerificationRunner;
export {};
//# sourceMappingURL=runner.d.ts.map
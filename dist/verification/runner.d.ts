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
interface DockerCommandResult {
    readonly error?: Error;
    readonly status: number | null;
    readonly stdout: string;
    readonly stderr: string;
}
export type DockerCommand = (arguments_: readonly string[], timeoutMilliseconds: number) => DockerCommandResult;
export interface ContainerCleanupResult {
    readonly state: "REMOVED" | "ALREADY_ABSENT" | "FAILED";
    readonly attempts: number;
    readonly observedStates: readonly string[];
    readonly failure: string | null;
}
export declare function removeAndConfirmContainer(containerName: string, dockerCommand: DockerCommand, options?: {
    readonly maximumAttempts?: number;
    readonly retryMilliseconds?: number;
    readonly absenceConfirmations?: number;
}): ContainerCleanupResult;
export declare function buildContainerArguments(image: string, containerName: string, workspace: string, command: VerificationCommand): string[];
export declare function hardenedContainerProfileFailures(inspected: unknown, expectedWorkingDirectory?: string): string[];
export declare function createContainerSandboxRunner(options: ContainerRunnerOptions): VerificationRunner;
export {};
//# sourceMappingURL=runner.d.ts.map
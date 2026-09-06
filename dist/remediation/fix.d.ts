import { scanRepository, type ScanOptions } from "../core/engine.js";
import type { ScanReport } from "../core/schema.js";
import { type VerificationRunner } from "../verification/runner.js";
import { type RemediationCandidate, type RemediationReport, type RemediationTransaction } from "./model.js";
export interface GitState {
    readonly available: boolean;
    readonly isWorktree: boolean;
    readonly changedPaths: readonly string[];
    readonly gitHead?: string;
    readonly note: string;
}
export interface TrustedVerificationCommand {
    readonly executable: string;
    readonly arguments: readonly string[];
    readonly timeoutMilliseconds?: number;
    readonly workingDirectory?: string;
    readonly networkPolicy?: "DENIED" | "ALLOWED_EXPLICIT";
}
export interface RemediationOptions extends Pick<ScanOptions, "advisories" | "advisoryProvider"> {
    readonly path: string;
    readonly finding?: string;
    readonly dryRun?: boolean;
    readonly applySafe?: boolean;
    readonly nonInteractive?: boolean;
    readonly verificationCommands?: readonly TrustedVerificationCommand[];
    readonly authoritativeActionPins?: Readonly<Record<string, string>>;
    readonly verificationRunner?: VerificationRunner;
}
/** Fault/scanner injection proves rollback paths without relying on OS-specific I/O failure. */
export interface RemediationRuntime {
    readonly afterFileWrite?: (path: string, completedWrites: number) => void | Promise<void>;
    readonly scan?: typeof scanRepository;
    readonly verificationRunner?: VerificationRunner;
}
interface PlanningContext {
    readonly boundaryRoot: string;
    readonly report: ScanReport;
    readonly gitState: GitState;
    readonly repositoryIdentity: string;
    readonly plans: readonly RemediationCandidate[];
    readonly planningMilliseconds: number;
}
export declare function inspectGitState(root: string): GitState;
export declare function createUnifiedDiff(filePath: string, before: string, after: string): string;
export declare function executeSafeTransaction(root: string, plansInput: readonly RemediationCandidate[], context: Pick<PlanningContext, "gitState" | "repositoryIdentity" | "planningMilliseconds">, commands?: readonly TrustedVerificationCommand[], scanOptions?: Pick<ScanOptions, "advisories" | "advisoryProvider">, runtime?: RemediationRuntime): Promise<RemediationTransaction>;
export declare function planRemediations(options: RemediationOptions): Promise<RemediationReport>;
export declare function runRemediation(options: RemediationOptions, runtime?: RemediationRuntime): Promise<RemediationReport>;
/** Compatibility wrapper retained for pre-Phase-5 SDK callers. */
export declare function applySafeFixes(options: {
    readonly path: string;
    readonly finding?: string;
    readonly dryRun: boolean;
}): Promise<RemediationReport>;
export {};
//# sourceMappingURL=fix.d.ts.map
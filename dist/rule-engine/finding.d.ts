import type { Node } from "@babel/types";
import type { Finding, FindingProof, EvidencePathStep, FixEdit, AnalysisCompleteness, Reachability, RemediationClass, RemediationReasonCode, RuleDefinition } from "../core/schema.js";
import { type SafeConditionInput } from "../remediation/assessment.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
interface FindingInput {
    readonly rule: RuleDefinition;
    readonly file: SourceFile;
    readonly startOffset: number;
    readonly endOffset: number;
    readonly message: string;
    readonly excerpt?: string;
    readonly redacted?: boolean;
    readonly evidencePath?: readonly EvidencePathStep[];
    readonly affectedComponent?: string;
    readonly reachability?: Reachability;
    readonly autofix?: RemediationClass;
    readonly fix?: FixEdit;
    readonly proof?: FindingProof;
    readonly analysisCompleteness?: AnalysisCompleteness;
    readonly remediationReasons?: readonly RemediationReasonCode[];
    readonly safeConditions?: SafeConditionInput;
    readonly fingerprintAnchor?: string;
}
export declare function pointAt(text: string, offset: number): {
    line: number;
    column: number;
    offset: number;
};
export declare function lineExcerpt(text: string, offset: number): string;
export declare function nodeRange(node: Node): {
    start: number;
    end: number;
} | undefined;
export declare function makeFix(file: SourceFile, startOffset: number, endOffset: number, replacement: string, description: string): FixEdit;
export declare function makeFinding(input: FindingInput): Finding;
export {};
//# sourceMappingURL=finding.d.ts.map
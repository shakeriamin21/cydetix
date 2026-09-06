export declare class InvariantSecError extends Error {
    readonly exitCode: number;
    constructor(message: string, exitCode: number, options?: ErrorOptions);
}
export declare const EXIT: {
    readonly ok: 0;
    readonly policyFindings: 1;
    readonly usage: 2;
    readonly scanFailure: 3;
    readonly verificationFailure: 4;
    readonly verifiedFixApplied: 5;
    readonly unsafeRemediation: 6;
    readonly providerUnavailable: 7;
};
//# sourceMappingURL=errors.d.ts.map
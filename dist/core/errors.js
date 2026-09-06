export class CydetixError extends Error {
    exitCode;
    constructor(message, exitCode, options) {
        super(message, options);
        this.exitCode = exitCode;
        this.name = "CydetixError";
    }
}
export const EXIT = {
    ok: 0,
    policyFindings: 1,
    usage: 2,
    scanFailure: 3,
    verificationFailure: 4,
    verifiedFixApplied: 5,
    unsafeRemediation: 6,
    providerUnavailable: 7,
};
//# sourceMappingURL=errors.js.map
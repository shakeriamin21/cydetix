export class InvariantSecError extends Error {
  public constructor(
    message: string,
    public readonly exitCode: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "InvariantSecError";
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
} as const;

export function writeContentAddressedSubject(directory: string, content: string): Promise<string>;

export function verifyBoundFileSubject(record: {
  evidenceType: string;
  subject: {
    kind: string;
    identity: string;
    sha256?: string;
    bytes?: number;
  };
}): Promise<void>;

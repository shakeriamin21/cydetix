export interface EvidenceSourceContext {
  root: string;
  repository: string;
  sourceCommit: string;
}

export function establishEvidenceSource(
  expectedSourceCommit?: string,
  repositoryRoot?: string,
): Promise<EvidenceSourceContext>;

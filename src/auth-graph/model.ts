import { stableFingerprint } from "../core/hash.js";
import type { AuthorizationProof } from "../authorization-analysis/model.js";
import type {
  AuthenticationAnalysis,
  AuthenticationOperation,
} from "../authentication-analysis/model.js";
import type { AuthGraph, Confidence, RepositoryManifest } from "../core/schema.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { SecurityIr } from "../security-ir/model.js";

type AuthNodeKind = AuthGraph["nodes"][number]["kind"];
const SUPPORTED_SOURCE_LANGUAGES = new Set(["javascript", "typescript", "python"]);

function nodeId(
  kind: AuthNodeKind,
  label: string,
  sourcePath?: string,
  stableKey?: string,
): string {
  return `auth:${stableFingerprint([kind, label, sourcePath ?? "", stableKey ?? ""]).slice(0, 16)}`;
}

function point(text: string, offset: number): { line: number; column: number; offset: number } {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const lines = text.slice(0, safeOffset).split("\n");
  return { line: lines.length, column: lines.at(-1)?.length ?? 0, offset: safeOffset };
}

function fileEvidence(
  file: SourceFile,
  message: string,
): NonNullable<AuthGraph["nodes"][number]["sourceEvidence"]> {
  return [
    {
      location: {
        path: file.relativePath,
        start: point(file.text, 0),
        end: point(file.text, file.text.length),
      },
      message,
    },
  ];
}

function operationNodeKind(operation: AuthenticationOperation): AuthNodeKind {
  const mapping: Readonly<Record<AuthenticationOperation["kind"], AuthNodeKind>> = {
    CredentialInput: "credential-input",
    CredentialVerifier: "credential-verifier",
    AuthenticationSuccess: "authentication-success",
    SessionCreate: "session-creation",
    SessionLookup: "session-lookup",
    SessionRotate: "session-rotate",
    SessionRevoke: "session-revocation",
    SessionRevokeAll: "session-revoke-all",
    SessionExpiry: "session-expiry",
    JWTIssue: "jwt-issue",
    JWTValidate: "jwt-validate",
    JWTSign: "jwt-issue",
    JWTVerify: "jwt-validate",
    JWTDecodeWithoutVerify: "jwt-decode-without-verify",
    JWKSResolve: "jwks-resolve",
    ClaimValidate: "claim-validate",
    TokenAccept: "token-accept",
    AccessTokenIssue: "access-token-issue",
    RefreshTokenIssue: "refresh-token-issue",
    RefreshTokenValidate: "refresh-token-validate",
    RefreshTokenRotate: "refresh-token-rotate",
    RefreshTokenRevoke: "refresh-token-revoke",
    PasswordChange: "password-change",
    PasswordResetRequest: "password-reset-request",
    PasswordResetCredentialIssue: "password-reset-credential-issue",
    PasswordResetValidate: "password-reset-validate",
    PasswordResetConsume: "password-reset-consume",
    EmailVerificationIssue: "email-verification",
    EmailVerificationConsume: "email-verification",
    OAuthAuthorizationRequest: "oauth-authorization-request",
    OAuthCallback: "oauth-callback",
    AuthorizationCodeExchange: "authorization-code-exchange",
    PKCEVerifier: "pkce-verifier",
    OAuthStateValidation: "oauth-state-validation",
    OIDCNonceValidation: "oidc-nonce-validation",
    OIDCIssuerValidation: "oidc-issuer-validation",
    OIDCAudienceValidation: "oidc-audience-validation",
    MFAChallenge: "mfa-challenge",
    MFAValidation: "mfa-validation",
    PrivilegeChange: "privilege-change",
    ReauthenticationBoundary: "reauthentication-boundary",
  };
  return mapping[operation.kind];
}

function operationRelation(
  operation: AuthenticationOperation,
): AuthGraph["edges"][number]["relation"] {
  if (operation.kind.includes("Revoke") || operation.kind === "PasswordResetConsume") {
    return "revokes";
  }
  if (operation.kind.includes("Rotate")) return "rotates";
  if (operation.kind.includes("Validate") || operation.kind === "JWTVerify") return "validates";
  if (operation.kind.includes("Create") || operation.kind.includes("Issue")) return "creates";
  if (operation.kind === "CredentialVerifier") return "verifies";
  if (operation.kind === "SessionLookup" || operation.kind === "TokenAccept") return "consumes";
  return "links";
}

export function buildAuthenticationGraph(
  manifest: RepositoryManifest,
  files: readonly SourceFile[],
  securityIr?: SecurityIr,
  authorizationProofs: readonly AuthorizationProof[] = [],
  authenticationAnalysis?: AuthenticationAnalysis,
): AuthGraph {
  const nodes: AuthGraph["nodes"] = [];
  const edges: AuthGraph["edges"] = [];
  const seen = new Set<string>();

  const addNode = (
    kind: AuthNodeKind,
    label: string,
    confidence: Confidence,
    sourcePath?: string,
    sourceEvidence: NonNullable<AuthGraph["nodes"][number]["sourceEvidence"]> = [],
    stableKey?: string,
  ): string => {
    const id = nodeId(kind, label, sourcePath, stableKey);
    if (!seen.has(id)) {
      nodes.push({
        id,
        kind,
        label,
        confidence,
        sourceEvidence,
        ...(sourcePath === undefined ? {} : { path: sourcePath }),
      });
      seen.add(id);
    }
    return id;
  };

  const packageFile = files.find((file) => /(^|\/)package\.json$/i.test(file.relativePath));
  const anchorFile = packageFile ?? files[0];
  const identity =
    anchorFile === undefined
      ? undefined
      : addNode(
          "identity",
          "application user",
          "medium",
          anchorFile.relativePath,
          fileEvidence(anchorFile, "Application identity graph anchor from repository evidence."),
        );
  for (const technology of manifest.sessionAndTokenTechnology) {
    const lower = technology.toLowerCase();
    const kind: AuthNodeKind = lower.includes("jwt") || lower.includes("jose") ? "jwt" : "session";
    const token = addNode(
      kind,
      technology,
      "high",
      packageFile?.relativePath,
      packageFile === undefined
        ? []
        : fileEvidence(packageFile, `${technology} is declared by the dependency manifest.`),
    );
    if (identity !== undefined) {
      edges.push({
        from: identity,
        to: token,
        relation: "creates",
        evidence: "dependency manifest",
      });
    }
  }
  for (const provider of manifest.oauthOidcProviders) {
    const oauth = addNode(
      "oauth",
      provider,
      "medium",
      packageFile?.relativePath,
      packageFile === undefined
        ? []
        : fileEvidence(packageFile, `${provider} is declared by authentication dependencies.`),
    );
    if (identity !== undefined) {
      edges.push({
        from: oauth,
        to: identity,
        relation: "links",
        evidence: "authentication dependency",
      });
    }
  }

  const addRoute = (
    route: string,
    sourcePath: string,
    label = route,
    sourceEvidence: NonNullable<AuthGraph["nodes"][number]["sourceEvidence"]> = [],
    stableKey?: string,
  ): string => {
    const lower = route.toLowerCase();
    let kind: AuthNodeKind = "resource";
    if (/log-?out|sign-?out/.test(lower)) kind = "logout-endpoint";
    else if (/reset|forgot/.test(lower)) kind = "password-reset";
    else if (/register|sign-?up/.test(lower)) kind = "registration-endpoint";
    else if (/log-?in|sign-?in|auth/.test(lower)) kind = "login-endpoint";
    const routeNode = addNode(kind, label, "high", sourcePath, sourceEvidence, stableKey);
    if (kind === "login-endpoint" && identity !== undefined) {
      edges.push({
        from: routeNode,
        to: identity,
        relation: "verifies",
        evidence: "literal route declaration",
      });
    }
    return routeNode;
  };

  if (securityIr === undefined) {
    const routePattern =
      /(?:\b(?:app|router)\.(?:get|post|put|patch|delete)|@(?:app|router)\.(?:get|post|put|patch|delete))\s*\(\s*["']([^"']+)["']/g;
    for (const file of files) {
      if (!SUPPORTED_SOURCE_LANGUAGES.has(file.language)) continue;
      for (const match of file.text.matchAll(routePattern)) {
        const route = match[1];
        if (route !== undefined) {
          addRoute(
            route,
            file.relativePath,
            route,
            fileEvidence(file, "Literal route declaration."),
          );
        }
      }
    }
  } else {
    const routeNodes = new Map<string, string>();
    const resourceNodes = new Map<string, string>();
    const subjectNodes = new Map<string, string>();
    for (const route of securityIr.routes) {
      routeNodes.set(
        route.id,
        addRoute(
          route.path,
          route.location.path,
          `${route.method} ${route.path}`,
          [
            {
              location: route.location,
              message: `Express ${route.method} route binds ${route.path}.`,
            },
          ],
          route.id,
        ),
      );
    }
    for (const fact of securityIr.identities) {
      subjectNodes.set(
        fact.id,
        addNode(
          "subject",
          `${fact.name} [${fact.trust}]`,
          "high",
          fact.location.path,
          [{ location: fact.location, message: `Identity fact is classified as ${fact.trust}.` }],
          fact.id,
        ),
      );
    }
    for (const operation of securityIr.resourceOperations) {
      resourceNodes.set(
        operation.id,
        addNode(
          "resource",
          `${operation.technology} ${operation.resourceType}.${operation.operation}`,
          "high",
          operation.location.path,
          [
            {
              location: operation.location,
              message: `${operation.technology} resource operation.`,
            },
          ],
          operation.id,
        ),
      );
    }
    for (const proof of authorizationProofs) {
      const routeNode = routeNodes.get(proof.routeId);
      const resourceNode = resourceNodes.get(proof.resourceOperationId);
      if (routeNode === undefined || resourceNode === undefined) continue;
      const kind: AuthNodeKind =
        proof.invariant === "tenant-isolation" ? "tenant-scope" : "ownership-check";
      const lastEvidence = proof.evidencePath.at(-1);
      const enforcement = addNode(
        kind,
        `${proof.invariant}: ${proof.state}`,
        proof.confidence,
        lastEvidence?.location.path,
        lastEvidence === undefined
          ? []
          : [
              {
                location: lastEvidence.location,
                message: proof.explanation,
              },
            ],
        proof.id,
      );
      edges.push({
        from: routeNode,
        to: enforcement,
        relation: "enforces",
        evidence: proof.explanation,
      });
      edges.push({
        from: enforcement,
        to: resourceNode,
        relation: proof.invariant === "tenant-isolation" ? "checks-tenant" : "checks-ownership",
        evidence: proof.explanation,
      });
      for (const identityId of proof.subjectIdentityFactIds) {
        const subjectNode = subjectNodes.get(identityId);
        if (subjectNode !== undefined) {
          edges.push({
            from: subjectNode,
            to: enforcement,
            relation: "authorizes",
            evidence: proof.explanation,
          });
        }
      }
    }

    if (authenticationAnalysis !== undefined) {
      const operationNodes = new Map<string, string>();
      for (const operation of authenticationAnalysis.operations) {
        const operationNode = addNode(
          operationNodeKind(operation),
          operation.kind,
          operation.confidence,
          operation.location.path,
          [{ location: operation.location, message: operation.guarantee }],
          operation.id,
        );
        operationNodes.set(operation.id, operationNode);
        for (const routeId of operation.routeIds) {
          const routeNode = routeNodes.get(routeId);
          if (routeNode !== undefined) {
            edges.push({
              from: routeNode,
              to: operationNode,
              relation: operationRelation(operation),
              evidence: operation.guarantee,
            });
          }
        }
      }
      for (const result of authenticationAnalysis.results) {
        const last = result.evidencePath.at(-1);
        if (last === undefined || result.applicability === "NOT_APPLICABLE") continue;
        const proofNode = addNode(
          "enforcement-point",
          `${result.invariantId}: ${result.conclusion}`,
          result.confidence,
          last.location.path,
          [{ location: last.location, message: result.explanation }],
          result.id,
        );
        for (const operationId of result.operationIds) {
          const operationNode = operationNodes.get(operationId);
          if (operationNode !== undefined) {
            edges.push({
              from: operationNode,
              to: proofNode,
              relation: result.conclusion === "UNKNOWN" ? "unknown" : "enforces",
              evidence: result.explanation,
            });
          }
        }
      }
    }
  }

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`));
  return {
    nodes,
    edges,
    limitations: [
      ...(securityIr === undefined
        ? [
            "Without Security IR input, the graph records literal routes and declared authentication/session dependencies only.",
          ]
        : [
            "Phase two projects statically resolved Express routes, identity provenance, Prisma resources, and authorization/tenant proof states.",
            ...(authenticationAnalysis === undefined
              ? []
              : [
                  "Authentication Graph v2 projects adapter-guaranteed lifecycle operations, validation boundaries, trust transitions, revocation events, and invariant results.",
                ]),
            "Generated routes, dynamic middleware composition, unsupported ORM behavior, and runtime policy remain UNKNOWN.",
          ]),
      "The absence of a graph edge is not evidence that a security control is absent.",
    ],
  };
}

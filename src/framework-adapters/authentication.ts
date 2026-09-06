import traverse from "@babel/traverse";
import type {
  AssignmentExpression,
  CallExpression,
  Expression,
  ImportDeclaration,
  MemberExpression,
  Node,
} from "@babel/types";

import type { ParsedSource } from "../ast-analysis/parser.js";
import type {
  AuthenticationOperation,
  AuthenticationOperationKind,
  AuthenticationProtocol,
} from "../authentication-analysis/model.js";
import { stableFingerprint } from "../core/hash.js";
import type { RepositoryManifest } from "../core/schema.js";
import type { SourceFile } from "../repository-discovery/traverse.js";
import type { IrLocation, IrSymbol, SecurityIr } from "../security-ir/model.js";

interface ImportBinding {
  readonly packageName: string;
  readonly importedName: string;
}

interface OperationInput {
  readonly kind: AuthenticationOperationKind;
  readonly protocol: AuthenticationProtocol;
  readonly adapter: string;
  readonly guarantee: string;
  readonly functionSymbolId?: string;
  readonly location: IrLocation;
  readonly confidence?: AuthenticationOperation["confidence"];
  readonly attributes?: Readonly<Record<string, string>>;
}

function point(text: string, offset: number): IrLocation["start"] {
  const safeOffset = Math.max(0, Math.min(offset, text.length));
  const lines = text.slice(0, safeOffset).split("\n");
  return { line: lines.length, column: lines.at(-1)?.length ?? 0, offset: safeOffset };
}

function location(file: SourceFile, node: Node): IrLocation | undefined {
  if (typeof node.start !== "number" || typeof node.end !== "number") return undefined;
  return {
    path: file.relativePath,
    start: point(file.text, node.start),
    end: point(file.text, node.end),
  };
}

function sourceText(file: SourceFile, node: Node): string {
  if (typeof node.start !== "number" || typeof node.end !== "number") return node.type;
  return file.text.slice(node.start, node.end).replaceAll(/\s+/g, " ").trim().slice(0, 800);
}

function importsFrom(declarations: readonly ImportDeclaration[]): Map<string, ImportBinding> {
  const imports = new Map<string, ImportBinding>();
  for (const declaration of declarations) {
    for (const specifier of declaration.specifiers) {
      const importedName =
        specifier.type === "ImportDefaultSpecifier"
          ? "default"
          : specifier.type === "ImportNamespaceSpecifier"
            ? "*"
            : specifier.imported.type === "Identifier"
              ? specifier.imported.name
              : specifier.imported.value;
      imports.set(specifier.local.name, {
        packageName: declaration.source.value,
        importedName,
      });
    }
  }
  return imports;
}

function containingSymbol(ir: SecurityIr, filePath: string, node: Node): IrSymbol | undefined {
  if (typeof node.start !== "number" || typeof node.end !== "number") return undefined;
  return ir.symbols
    .filter(
      (symbol) =>
        symbol.location.path === filePath &&
        symbol.location.start.offset <= (node.start ?? -1) &&
        symbol.location.end.offset >= (node.end ?? Number.MAX_SAFE_INTEGER),
    )
    .sort(
      (left, right) =>
        left.location.end.offset -
        left.location.start.offset -
        (right.location.end.offset - right.location.start.offset),
    )[0];
}

function memberParts(member: MemberExpression): { receiver?: string; property?: string } {
  if (member.computed || member.property.type !== "Identifier") return {};
  const receiver = member.object.type === "Identifier" ? member.object.name : undefined;
  return {
    ...(receiver === undefined ? {} : { receiver }),
    property: member.property.name,
  };
}

function importedCall(
  call: CallExpression,
  imports: ReadonlyMap<string, ImportBinding>,
): { packageName: string; importedName: string; method?: string } | undefined {
  if (call.callee.type === "Identifier") {
    const binding = imports.get(call.callee.name);
    return binding === undefined
      ? undefined
      : { packageName: binding.packageName, importedName: binding.importedName };
  }
  if (call.callee.type !== "MemberExpression") return undefined;
  const parts = memberParts(call.callee);
  if (parts.receiver === undefined || parts.property === undefined) return undefined;
  const binding = imports.get(parts.receiver);
  return binding === undefined
    ? undefined
    : {
        packageName: binding.packageName,
        importedName: binding.importedName,
        method: parts.property,
      };
}

function nestedMemberText(file: SourceFile, expression: Expression | Node): string {
  return sourceText(file, expression).replaceAll(/\s+/g, "");
}

function literalArgument(call: CallExpression, position: number): string | undefined {
  const argument = call.arguments[position];
  return argument?.type === "StringLiteral" ? argument.value : undefined;
}

function operationId(input: OperationInput): string {
  return `authop:${stableFingerprint([
    "1.0.0",
    input.kind,
    input.protocol,
    input.adapter,
    input.location.path,
    String(input.location.start.offset),
  ]).slice(0, 16)}`;
}

function prismaTarget(call: CallExpression): { resource: string; method: string } | undefined {
  if (
    call.callee.type !== "MemberExpression" ||
    call.callee.computed ||
    call.callee.property.type !== "Identifier" ||
    call.callee.object.type !== "MemberExpression" ||
    call.callee.object.computed ||
    call.callee.object.object.type !== "Identifier" ||
    call.callee.object.object.name !== "prisma" ||
    call.callee.object.property.type !== "Identifier"
  ) {
    return undefined;
  }
  return {
    resource: call.callee.object.property.name,
    method: call.callee.property.name,
  };
}

function classifyPrismaCall(
  call: CallExpression,
  callText: string,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
): OperationInput[] {
  const target = prismaTarget(call);
  if (target === undefined) return [];
  const resource = target.resource.toLowerCase();
  const base = {
    adapter: "Prisma authentication persistence",
    ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
    location: sourceLocation,
    confidence: "high" as const,
  };
  if (resource === "session") {
    if (target.method === "create") {
      return [
        {
          ...base,
          kind: "SessionCreate",
          protocol: "session",
          guarantee: "Prisma creates an authoritative server-side session record.",
          attributes: { authoritative: "true" },
        },
      ];
    }
    if (["findUnique", "findFirst"].includes(target.method)) {
      return [
        {
          ...base,
          kind: "SessionLookup",
          protocol: "session",
          guarantee: "Prisma reads an authoritative server-side session record.",
          attributes: {
            authoritative: "true",
            checksSessionVersion: /sessionVersion/.test(callText) ? "true" : "false",
          },
        },
      ];
    }
    if (target.method === "delete") {
      return [
        {
          ...base,
          kind: "SessionRevoke",
          protocol: "session",
          guarantee: "Prisma deletes an authoritative server-side session record.",
          attributes: { authoritative: "true" },
        },
      ];
    }
    if (target.method === "deleteMany") {
      return [
        {
          ...base,
          kind: "SessionRevokeAll",
          protocol: "session",
          guarantee: "Prisma deletes the selected server-side session records.",
          attributes: {
            authoritative: "true",
            accountBound: /userId|accountId|subjectId/.test(callText) ? "true" : "unknown",
          },
        },
      ];
    }
  }
  if (["passwordresettoken", "resettoken"].includes(resource)) {
    if (target.method === "create") {
      return [
        {
          ...base,
          kind: "PasswordResetCredentialIssue",
          protocol: "password-reset",
          guarantee: "Prisma persists a password-reset credential record.",
          attributes: {
            storedProtection: /tokenHash|hashedToken|digest/.test(callText)
              ? "hashed"
              : /\b(?:token|credential|value)\s*:/.test(callText)
                ? "raw"
                : "unknown",
            expiryStored: /expiresAt|expiry|expires/.test(callText) ? "true" : "false",
          },
        },
      ];
    }
    if (["findUnique", "findFirst"].includes(target.method)) {
      return [
        {
          ...base,
          kind: "PasswordResetValidate",
          protocol: "password-reset",
          guarantee: "Prisma resolves a password-reset credential for validation.",
          attributes: {
            checksExpiry:
              /expiresAt|expiry|expires/.test(callText) &&
              /\b(?:gt|gte)\b|Date\.now|newDate/.test(callText.replaceAll(/\s+/g, ""))
                ? "true"
                : "false",
            checksUnused: /(?:usedAt|consumedAt)\s*:\s*null/.test(callText) ? "true" : "false",
          },
        },
      ];
    }
    if (target.method === "delete" || target.method === "deleteMany") {
      return [
        {
          ...base,
          kind: "PasswordResetConsume",
          protocol: "password-reset",
          guarantee: "Prisma deletes the reset credential after validation.",
          attributes: { oneTime: "true", atomic: "unknown" },
        },
      ];
    }
    if (target.method === "update" && /usedAt|consumedAt/.test(callText)) {
      return [
        {
          ...base,
          kind: "PasswordResetConsume",
          protocol: "password-reset",
          guarantee: "Prisma marks the reset credential as consumed.",
          attributes: { oneTime: "true", atomic: "unknown" },
        },
      ];
    }
  }
  if (
    resource === "user" &&
    target.method === "update" &&
    /\bpassword(?:Hash|Digest)?\b/.test(callText)
  ) {
    return [
      {
        ...base,
        kind: "PasswordChange",
        protocol: "password-reset",
        guarantee: "Prisma updates password credential material for a user record.",
        attributes: {
          changesSessionGeneration: /sessionVersion|tokensValidAfter/.test(callText)
            ? "true"
            : "false",
        },
      },
    ];
  }
  if (resource === "refreshtoken") {
    const mapped: Readonly<Record<string, AuthenticationOperationKind>> = {
      create: "RefreshTokenIssue",
      findUnique: "RefreshTokenValidate",
      findFirst: "RefreshTokenValidate",
      update: "RefreshTokenRotate",
      delete: "RefreshTokenRevoke",
      deleteMany: "RefreshTokenRevoke",
    };
    const kind = mapped[target.method];
    return kind === undefined
      ? []
      : [
          {
            ...base,
            kind,
            protocol: "refresh-token",
            guarantee: `Prisma ${target.method} provides refresh-token persistence evidence.`,
            attributes: { authoritative: "true" },
          },
        ];
  }
  return [];
}

function classifyImportedCall(
  call: CallExpression,
  imported: ReturnType<typeof importedCall>,
  callText: string,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
): OperationInput[] {
  if (imported === undefined) return [];
  const method = imported.method ?? imported.importedName;
  const base = {
    ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
    location: sourceLocation,
    confidence: "high" as const,
  };
  if (imported.packageName === "jsonwebtoken") {
    if (method === "verify") {
      return [
        {
          ...base,
          kind: "JWTValidate",
          protocol: "jwt",
          adapter: "jsonwebtoken",
          guarantee: "jsonwebtoken.verify performs JWS signature or MAC verification.",
          attributes: {
            normalizedOperation: "JWT_VERIFY",
            issuer: /\bissuer\s*:/.test(callText) ? "validated" : "unresolved",
            audience: /\baudience\s*:/.test(callText) ? "validated" : "unresolved",
            algorithms: /\balgorithms\s*:/.test(callText) ? "allowlisted" : "library-default",
          },
        },
      ];
    }
    if (method === "decode") {
      return [
        {
          ...base,
          kind: "JWTDecodeWithoutVerify",
          protocol: "jwt",
          adapter: "jsonwebtoken",
          guarantee: "jsonwebtoken.decode parses claims without verifying the token signature.",
          attributes: { normalizedOperation: "JWT_DECODE_WITHOUT_VERIFY", trust: "untrusted" },
        },
      ];
    }
    if (method === "sign") {
      return [
        {
          ...base,
          kind: "JWTIssue",
          protocol: "jwt",
          adapter: "jsonwebtoken",
          guarantee: "jsonwebtoken.sign creates a signed JWT.",
          attributes: { normalizedOperation: "JWT_SIGN" },
        },
      ];
    }
  }
  if (imported.packageName === "jose") {
    if (method === "jwtVerify") {
      return [
        {
          ...base,
          kind: "JWTValidate",
          protocol: "jwt",
          adapter: "jose",
          guarantee: "jose.jwtVerify verifies JWS integrity before returning JWT claims.",
          attributes: {
            normalizedOperation: "JWT_VERIFY",
            issuer: /\bissuer\s*:/.test(callText) ? "validated" : "unresolved",
            audience: /\baudience\s*:/.test(callText) ? "validated" : "unresolved",
            algorithms: /\balgorithms\s*:/.test(callText) ? "allowlisted" : "library-key-bound",
          },
        },
      ];
    }
    if (["decodeJwt", "decodeProtectedHeader"].includes(method)) {
      return [
        {
          ...base,
          kind: "JWTDecodeWithoutVerify",
          protocol: "jwt",
          adapter: "jose",
          guarantee: `jose.${method} decodes token data without establishing signature trust.`,
          attributes: { normalizedOperation: "JWT_DECODE_WITHOUT_VERIFY", trust: "untrusted" },
        },
      ];
    }
    if (method === "createRemoteJWKSet") {
      return [
        {
          ...base,
          kind: "JWKSResolve",
          protocol: "jwt",
          adapter: "jose",
          guarantee: "jose.createRemoteJWKSet configures remote JWK resolution.",
          attributes: { normalizedOperation: "JWKS_RESOLVE", source: "configured-url" },
        },
      ];
    }
  }
  if (imported.packageName === "node:crypto" && method === "randomBytes") {
    return [
      {
        ...base,
        kind: "PasswordResetCredentialIssue",
        protocol: "password-reset",
        adapter: "node:crypto",
        guarantee: "node:crypto.randomBytes provides cryptographically secure random bytes.",
        attributes: { credentialGeneration: "cryptographic" },
      },
    ];
  }
  if (imported.packageName === "oauth4webapi") {
    const oauthBase = { ...base, adapter: "oauth4webapi" };
    if (method === "generateRandomState") {
      return [
        {
          ...oauthBase,
          kind: "OAuthAuthorizationRequest",
          protocol: "oauth",
          guarantee: "oauth4webapi generates a cryptographically random state value.",
          attributes: { stateGenerated: "true" },
        },
      ];
    }
    if (method === "generateRandomCodeVerifier") {
      return [
        {
          ...oauthBase,
          kind: "PKCEVerifier",
          protocol: "oauth",
          guarantee: "oauth4webapi generates a random PKCE code verifier.",
          attributes: { stage: "generated" },
        },
      ];
    }
    if (method === "calculatePKCECodeChallenge") {
      return [
        {
          ...oauthBase,
          kind: "PKCEVerifier",
          protocol: "oauth",
          guarantee: "oauth4webapi derives a PKCE code challenge from a verifier.",
          attributes: { stage: "challenge", method: "S256" },
        },
      ];
    }
    if (method === "validateAuthResponse") {
      const skipped = /skipStateCheck/.test(callText);
      return [
        {
          ...oauthBase,
          kind: "OAuthStateValidation",
          protocol: "oauth",
          guarantee: skipped
            ? "oauth4webapi is explicitly configured to skip state validation."
            : "oauth4webapi validates the authorization response against expected state.",
          attributes: {
            validated: skipped ? "false" : "true",
            boundToSession: /\.session\.(?:oauthState|state)/.test(callText) ? "true" : "unknown",
          },
        },
      ];
    }
    if (method === "authorizationCodeGrantRequest") {
      return [
        {
          ...oauthBase,
          kind: "AuthorizationCodeExchange",
          protocol: "oauth",
          guarantee: "oauth4webapi constructs the authorization-code token request.",
          attributes: { pkceBound: call.arguments.length >= 6 ? "true" : "unknown" },
        },
      ];
    }
    if (method === "processAuthorizationCodeResponse") {
      return [
        {
          ...oauthBase,
          kind: "TokenAccept",
          protocol: /openid|id_token/.test(callText) ? "oidc" : "oauth",
          guarantee: "oauth4webapi validates the authorization-code token response.",
          attributes: { normalizedOperation: "TOKEN_ACCEPT" },
        },
      ];
    }
  }
  if (["bcrypt", "bcryptjs"].includes(imported.packageName) && method === "compare") {
    return [
      {
        ...base,
        kind: "CredentialVerifier",
        protocol: "session",
        adapter: imported.packageName,
        guarantee: `${imported.packageName}.compare verifies a submitted password against a stored adaptive hash.`,
        attributes: { credential: "password" },
      },
    ];
  }
  if (imported.packageName === "argon2" && method === "verify") {
    return [
      {
        ...base,
        kind: "CredentialVerifier",
        protocol: "session",
        adapter: "argon2",
        guarantee: "argon2.verify verifies a submitted password against a stored Argon2 hash.",
        attributes: { credential: "password" },
      },
    ];
  }
  return [];
}

function classifySessionCall(
  call: CallExpression,
  file: SourceFile,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
  hasExpressSession: boolean,
): OperationInput[] {
  if (call.callee.type !== "MemberExpression" || call.callee.computed) return [];
  const text = nestedMemberText(file, call.callee);
  const method = call.callee.property.type === "Identifier" ? call.callee.property.name : "";
  const base = {
    ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
    location: sourceLocation,
    confidence: "high" as const,
  };
  if (hasExpressSession && method === "regenerate" && /\.session\.regenerate$/.test(text)) {
    return [
      {
        ...base,
        kind: "SessionRotate",
        protocol: "session",
        adapter: "express-session",
        guarantee: "req.session.regenerate creates a new session identifier and session object.",
        attributes: { authoritative: "true" },
      },
    ];
  }
  if (hasExpressSession && method === "destroy" && /\.session\.destroy$/.test(text)) {
    return [
      {
        ...base,
        kind: "SessionRevoke",
        protocol: "session",
        adapter: "express-session",
        guarantee: "req.session.destroy destroys the authoritative server-side session.",
        attributes: { authoritative: "true", transportOnly: "false" },
      },
    ];
  }
  if (method === "clearCookie") {
    return [
      {
        ...base,
        kind: "SessionRevoke",
        protocol: "session",
        adapter: "Express response",
        guarantee:
          "res.clearCookie removes the browser cookie but does not invalidate server-side session state.",
        attributes: { authoritative: "false", transportOnly: "true" },
      },
    ];
  }
  return [];
}

function classifyWeakRandomCall(
  call: CallExpression,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
): OperationInput[] {
  if (
    call.callee.type !== "MemberExpression" ||
    call.callee.computed ||
    call.callee.object.type !== "Identifier" ||
    call.callee.object.name !== "Math" ||
    call.callee.property.type !== "Identifier" ||
    call.callee.property.name !== "random"
  ) {
    return [];
  }
  return [
    {
      kind: "PasswordResetCredentialIssue",
      protocol: "password-reset",
      adapter: "ECMAScript Math.random",
      guarantee: "Math.random is not a cryptographically secure reset-credential generator.",
      ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
      location: sourceLocation,
      confidence: "high",
      attributes: { credentialGeneration: "weak" },
    },
  ];
}

function classifyProtocolParameter(
  call: CallExpression,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
): OperationInput[] {
  if (call.callee.type !== "MemberExpression" || call.callee.computed) return [];
  if (call.callee.property.type !== "Identifier" || call.callee.property.name !== "set") return [];
  const parameter = literalArgument(call, 0);
  if (
    !["state", "code_challenge", "code_challenge_method", "nonce", "scope"].includes(
      parameter ?? "",
    )
  ) {
    return [];
  }
  const value = literalArgument(call, 1);
  const attributes: Record<string, string> = { parameter: parameter ?? "unknown" };
  if (parameter === "state") attributes.stateSent = "true";
  if (parameter === "code_challenge") attributes.challengeSent = "true";
  if (parameter === "code_challenge_method") attributes.method = value ?? "dynamic";
  if (parameter === "nonce") attributes.nonceSent = "true";
  if (parameter === "scope" && value?.split(/\s+/).includes("openid")) attributes.oidc = "true";
  return [
    {
      kind: "OAuthAuthorizationRequest",
      protocol: attributes.oidc === "true" ? "oidc" : "oauth",
      adapter: "URLSearchParams OAuth protocol parameters",
      guarantee: `The authorization request explicitly sets the ${parameter} protocol parameter.`,
      ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
      location: sourceLocation,
      confidence: "high",
      attributes,
    },
  ];
}

function assignmentOperation(
  assignment: AssignmentExpression,
  file: SourceFile,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
  hasExpressSession: boolean,
): OperationInput[] {
  if (!hasExpressSession || assignment.left.type !== "MemberExpression") return [];
  const left = nestedMemberText(file, assignment.left);
  const base = {
    adapter: "express-session",
    ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
    location: sourceLocation,
    confidence: "high" as const,
    attributes: { authenticatedBinding: "true" },
  };
  if (/\.session\.(?:oauthState|state)$/.test(left)) {
    return [
      {
        ...base,
        kind: "OAuthAuthorizationRequest",
        protocol: "oauth",
        adapter: "express-session OAuth transaction binding",
        guarantee: "OAuth state is persisted in the user-agent session for callback validation.",
        attributes: { stateStored: "true", userAgentBound: "true" },
      },
    ];
  }
  if (/\.session\.(?:codeVerifier|pkceVerifier)$/.test(left)) {
    return [
      {
        ...base,
        kind: "PKCEVerifier",
        protocol: "oauth",
        adapter: "express-session OAuth transaction binding",
        guarantee: "The PKCE verifier is persisted in the user-agent session for token exchange.",
        attributes: { stage: "stored", userAgentBound: "true" },
      },
    ];
  }
  if (!/\.session\.(?:userId|accountId|subjectId|principal|user)$/.test(left)) return [];
  return [
    {
      ...base,
      kind: "AuthenticationSuccess",
      protocol: "session",
      guarantee: "Authenticated identity is attached to the current express-session object.",
    },
    {
      ...base,
      kind: "SessionCreate",
      protocol: "session",
      guarantee: "The current express-session becomes an authenticated application session.",
    },
  ];
}

function tokenAcceptanceAssignment(
  assignment: AssignmentExpression,
  file: SourceFile,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
  hasJwt: boolean,
): OperationInput[] {
  if (!hasJwt || assignment.left.type !== "MemberExpression") return [];
  const left = nestedMemberText(file, assignment.left);
  if (!/\.(?:auth|user)$/.test(left)) return [];
  return [
    {
      kind: "TokenAccept",
      protocol: "jwt",
      adapter: "Express authenticated-context assignment",
      guarantee:
        "JWT-derived data is accepted as application authenticated context at this assignment.",
      ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
      location: sourceLocation,
      confidence: "high",
      attributes: { normalizedOperation: "TOKEN_ACCEPT" },
    },
  ];
}

function sessionLookupMember(
  member: MemberExpression,
  file: SourceFile,
  symbol: IrSymbol | undefined,
  sourceLocation: IrLocation,
  hasExpressSession: boolean,
): OperationInput[] {
  if (!hasExpressSession) return [];
  const text = nestedMemberText(file, member);
  if (!/\.session\.(?:userId|accountId|subjectId|principal|user)$/.test(text)) return [];
  return [
    {
      kind: "SessionLookup",
      protocol: "session",
      adapter: "express-session",
      guarantee: "Authenticated identity is read from the authoritative express-session object.",
      ...(symbol === undefined ? {} : { functionSymbolId: symbol.id }),
      location: sourceLocation,
      confidence: "high",
      attributes: { authoritative: "true", checksSessionVersion: "false" },
    },
  ];
}

export function analyzeAuthenticationOperations(
  ir: SecurityIr,
  manifest: RepositoryManifest,
  files: readonly SourceFile[],
  parsedByPath: ReadonlyMap<string, ParsedSource>,
): AuthenticationOperation[] {
  const operations: AuthenticationOperation[] = [];
  const hasExpressSession = manifest.sessionAndTokenTechnology.includes("express-session");
  const hasJwt = manifest.sessionAndTokenTechnology.some((technology) =>
    /JWT|JOSE/i.test(technology),
  );
  const publicOAuthClientFiles = new Set(
    files
      .filter((file) => /token_endpoint_auth_method["']?\s*:\s*["']none["']/.test(file.text))
      .map((file) => file.relativePath),
  );
  const add = (input: OperationInput): void => {
    operations.push({
      id: operationId(input),
      kind: input.kind,
      protocol: input.protocol,
      adapter: input.adapter,
      guarantee: input.guarantee,
      ...(input.functionSymbolId === undefined ? {} : { functionSymbolId: input.functionSymbolId }),
      routeIds: [],
      location: input.location,
      confidence: input.confidence ?? "high",
      attributes: {
        ...(input.attributes ?? {}),
        ...(input.protocol === "oauth" || input.protocol === "oidc"
          ? {
              clientType: publicOAuthClientFiles.has(input.location.path) ? "public" : "unresolved",
            }
          : {}),
      },
    });
  };

  for (const file of files) {
    const parsed = parsedByPath.get(file.relativePath);
    if (parsed?.language !== "javascript" && parsed?.language !== "typescript") continue;
    const imports = importsFrom(
      parsed.ast.program.body.filter(
        (statement): statement is ImportDeclaration => statement.type === "ImportDeclaration",
      ),
    );
    traverse(parsed.ast, {
      CallExpression(callPath) {
        const sourceLocation = location(file, callPath.node);
        if (sourceLocation === undefined) return;
        const symbol = containingSymbol(ir, file.relativePath, callPath.node);
        const text = sourceText(file, callPath.node);
        for (const input of classifyPrismaCall(callPath.node, text, symbol, sourceLocation))
          add(input);
        for (const input of classifyImportedCall(
          callPath.node,
          importedCall(callPath.node, imports),
          text,
          symbol,
          sourceLocation,
        ))
          add(input);
        for (const input of classifySessionCall(
          callPath.node,
          file,
          symbol,
          sourceLocation,
          hasExpressSession,
        ))
          add(input);
        for (const input of classifyWeakRandomCall(callPath.node, symbol, sourceLocation))
          add(input);
        for (const input of classifyProtocolParameter(callPath.node, symbol, sourceLocation))
          add(input);
      },
      AssignmentExpression(assignmentPath) {
        const sourceLocation = location(file, assignmentPath.node);
        if (sourceLocation === undefined) return;
        const symbol = containingSymbol(ir, file.relativePath, assignmentPath.node);
        for (const input of assignmentOperation(
          assignmentPath.node,
          file,
          symbol,
          sourceLocation,
          hasExpressSession,
        ))
          add(input);
        for (const input of tokenAcceptanceAssignment(
          assignmentPath.node,
          file,
          symbol,
          sourceLocation,
          hasJwt,
        ))
          add(input);
      },
      MemberExpression(memberPath) {
        if (
          memberPath.parentPath.isAssignmentExpression() &&
          memberPath.parentPath.node.left === memberPath.node
        ) {
          return;
        }
        const sourceLocation = location(file, memberPath.node);
        if (sourceLocation === undefined) return;
        const symbol = containingSymbol(ir, file.relativePath, memberPath.node);
        for (const input of sessionLookupMember(
          memberPath.node,
          file,
          symbol,
          sourceLocation,
          hasExpressSession,
        ))
          add(input);
      },
    });
  }

  const unique = new Map(operations.map((operation) => [operation.id, operation]));
  return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
}

import { analyzeAuthenticationOperations } from "../framework-adapters/authentication.js";
import { stableFingerprint } from "../core/hash.js";
import { authenticationAnalysisSchema, authenticationInvariantResultSchema, authenticationInvariantSchema, } from "./model.js";
const ASVS_SESSION = "https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x16-V7-Session-Management.md";
const ASVS_TOKEN = "https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x18-V9-Self-contained-Tokens.md";
const ASVS_OAUTH = "https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x19-V10-OAuth-and-OIDC.md";
const OWASP_SESSION = "https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html";
const OWASP_RESET = "https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html";
const RFC_9700 = "https://www.rfc-editor.org/rfc/rfc9700.html";
const RFC_7636 = "https://www.rfc-editor.org/rfc/rfc7636.html";
const RFC_8725 = "https://www.rfc-editor.org/rfc/rfc8725.html";
const OIDC_CORE = "https://openid.net/specs/openid-connect-core-1_0-errata2.html";
const invariantDefinitions = [
    {
        schemaVersion: "1.0.0",
        id: "SESSION_ROTATES_AFTER_AUTHENTICATION",
        name: "Session identifier rotates after authentication",
        protocol: "session",
        prerequisites: [
            "A stateful pre-authentication session is upgraded with authenticated identity.",
        ],
        requiredGraphPattern: ["CredentialVerifier", "AuthenticationSuccess", "SessionRotate"],
        secureEvidence: [
            "The resolved authentication path regenerates the session before binding identity.",
        ],
        insecureEvidence: [
            "The resolved express-session path binds identity to the existing session without regeneration.",
        ],
        unresolvedConditions: [
            "External session middleware or unsupported control flow can make rotation unprovable.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "high",
        standards: [
            { source: "OWASP ASVS 5.0.0", control: "7.2.4", relationship: "REQUIRED", url: ASVS_SESSION },
            {
                source: "OWASP Session Management Cheat Sheet",
                control: "Renew the Session ID After Any Privilege Level Change",
                relationship: "REQUIRED",
                url: OWASP_SESSION,
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "SESSION_INVALIDATED_ON_LOGOUT",
        name: "Logout invalidates authoritative session state",
        protocol: "session",
        prerequisites: ["A stateful session and application logout boundary are proven."],
        requiredGraphPattern: ["SessionLookup", "SessionRevoke"],
        secureEvidence: ["The resolved logout path invalidates the authoritative server-side session."],
        insecureEvidence: [
            "The resolved logout path only deletes the client cookie while server state remains valid.",
        ],
        unresolvedConditions: [
            "Unsupported library guarantees or externally managed sessions remain unknown.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "high",
        standards: [
            { source: "OWASP ASVS 5.0.0", control: "7.4.1", relationship: "REQUIRED", url: ASVS_SESSION },
            {
                source: "NIST SP 800-63B-4",
                control: "Section 5 session termination",
                relationship: "REQUIRED",
                url: "https://pages.nist.gov/800-63-4/sp800-63b.html",
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "PASSWORD_RESET_CREDENTIAL_PROTECTED",
        name: "Password reset credential is unpredictable, protected at rest, and expiring",
        protocol: "password-reset",
        prerequisites: ["The application generates and persists its own password-reset credential."],
        requiredGraphPattern: [
            "PasswordResetRequest",
            "PasswordResetCredentialIssue",
            "PasswordResetValidate",
        ],
        secureEvidence: [
            "A supported CSPRNG issues the credential, only a digest is persisted, and expiry is stored and enforced.",
        ],
        insecureEvidence: [
            "A supported non-cryptographic generator, raw-token persistence, or omitted expiry enforcement is proven.",
        ],
        unresolvedConditions: [
            "Provider-issued credentials and unsupported generation, hashing, or validation wrappers remain unknown.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "high",
        standards: [
            {
                source: "OWASP Forgot Password Cheat Sheet",
                control: "Randomly generated, securely stored, single-use, expiring reset tokens",
                relationship: "REQUIRED",
                url: OWASP_RESET,
            },
            {
                source: "OWASP ASVS 5.0.0",
                control: "6.4.3",
                relationship: "CONTEXT_DEPENDENT",
                url: "https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md",
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "PASSWORD_RESET_TOKEN_SINGLE_USE",
        name: "Password reset credential is single use",
        protocol: "password-reset",
        prerequisites: [
            "A persisted password-reset credential is validated and a password is replaced.",
        ],
        requiredGraphPattern: ["PasswordResetValidate", "PasswordChange", "PasswordResetConsume"],
        secureEvidence: [
            "The resolved reset path checks unused state and consumes or deletes the credential.",
        ],
        insecureEvidence: [
            "The persistent credential remains usable after the resolved password mutation path.",
        ],
        unresolvedConditions: [
            "Transactional or provider-side consumption hidden behind unsupported APIs remains unknown.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "high",
        standards: [
            {
                source: "OWASP Forgot Password Cheat Sheet",
                control: "Reset tokens are single use and expire",
                relationship: "REQUIRED",
                url: OWASP_RESET,
            },
            {
                source: "OWASP ASVS 5.0.0",
                control: "6.4.3",
                relationship: "CONTEXT_DEPENDENT",
                url: "https://github.com/OWASP/ASVS/blob/v5.0.0/5.0/en/0x15-V6-Authentication.md",
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS",
        name: "Password reset handles existing authenticated sessions",
        protocol: "password-reset",
        prerequisites: [
            "Password replacement and independently persisted authenticated sessions are proven.",
        ],
        requiredGraphPattern: ["PasswordChange", "SessionLookup", "SessionRevokeAll"],
        secureEvidence: [
            "The reset path revokes account sessions or changes a generation validated by every session lookup.",
        ],
        insecureEvidence: [
            "Independent session records remain valid after the resolved reset path and no generation boundary is consumed.",
        ],
        unresolvedConditions: [
            "External identity providers, stateless token deny lists, and unsupported session stores remain unknown.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "high",
        standards: [
            {
                source: "OWASP ASVS 5.0.0",
                control: "7.4.3",
                relationship: "CONTEXT_DEPENDENT",
                url: ASVS_SESSION,
            },
            {
                source: "OWASP Forgot Password Cheat Sheet",
                control: "Invalidate existing sessions",
                relationship: "RECOMMENDED",
                url: OWASP_RESET,
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "JWT_SIGNATURE_VERIFIED",
        name: "JWT signature is verified before token acceptance",
        protocol: "jwt",
        prerequisites: ["JWT claims are accepted as authenticated application context."],
        requiredGraphPattern: ["JWTValidate", "TokenAccept"],
        secureEvidence: ["A supported verification API precedes authenticated-context acceptance."],
        insecureEvidence: [
            "A supported decode-only API feeds authenticated-context acceptance without verification.",
        ],
        unresolvedConditions: [
            "Wrapper return-value flow and unsupported token libraries remain unknown.",
        ],
        severityIfViolated: "critical",
        defaultConfidence: "high",
        standards: [
            { source: "OWASP ASVS 5.0.0", control: "9.1.1", relationship: "REQUIRED", url: ASVS_TOKEN },
            {
                source: "IETF RFC 8725 / BCP 225",
                control: "Section 3.1",
                relationship: "REQUIRED",
                url: RFC_8725,
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "JWT_EXPECTED_ISSUER_VALIDATED",
        name: "Expected JWT issuer is validated",
        protocol: "jwt",
        prerequisites: ["The application accepts JWTs from an identifiable external issuer."],
        requiredGraphPattern: ["JWTValidate", "ClaimValidate", "TokenAccept"],
        secureEvidence: ["The supported verifier receives an explicit expected issuer."],
        insecureEvidence: ["An explicit expected issuer is bypassed or contradicted."],
        unresolvedConditions: [
            "Issuer expectation is application-specific and often cannot be inferred statically.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "medium",
        standards: [
            {
                source: "OpenID Connect Core 1.0 Errata 2",
                control: "Section 3.1.3.7 issuer validation",
                relationship: "CONTEXT_DEPENDENT",
                url: OIDC_CORE,
            },
            {
                source: "OWASP ASVS 5.0.0",
                control: "10.5.3",
                relationship: "CONTEXT_DEPENDENT",
                url: ASVS_OAUTH,
            },
        ],
        remediationClass: "REVIEW_REQUIRED",
    },
    {
        schemaVersion: "1.0.0",
        id: "JWT_EXPECTED_AUDIENCE_VALIDATED",
        name: "Expected JWT audience is validated",
        protocol: "jwt",
        prerequisites: ["The receiving service or OIDC client has a known token audience."],
        requiredGraphPattern: ["JWTValidate", "ClaimValidate", "TokenAccept"],
        secureEvidence: ["The supported verifier receives an explicit expected audience."],
        insecureEvidence: ["An explicit expected audience is bypassed or contradicted."],
        unresolvedConditions: [
            "Audience expectation is application-specific and often cannot be inferred statically.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "medium",
        standards: [
            {
                source: "OWASP ASVS 5.0.0",
                control: "9.2.3",
                relationship: "CONTEXT_DEPENDENT",
                url: ASVS_TOKEN,
            },
            {
                source: "OpenID Connect Core 1.0 Errata 2",
                control: "Section 3.1.3.7 audience validation",
                relationship: "REQUIRED",
                url: OIDC_CORE,
            },
        ],
        remediationClass: "REVIEW_REQUIRED",
    },
    {
        schemaVersion: "1.0.0",
        id: "REFRESH_TOKEN_REPLAY_MITIGATED",
        name: "Refresh-token replay is mitigated",
        protocol: "refresh-token",
        prerequisites: ["Refresh tokens are issued and accepted by the application."],
        requiredGraphPattern: [
            "RefreshTokenIssue",
            "RefreshTokenValidate",
            "RefreshTokenRotate",
            "RefreshTokenRevoke",
        ],
        secureEvidence: ["The resolved lifecycle rotates and invalidates used refresh-token records."],
        insecureEvidence: [
            "A supported lifecycle explicitly preserves a used refresh token without sender constraint.",
        ],
        unresolvedConditions: [
            "Sender-constrained tokens and reuse detection outside supported persistence remain unknown.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "medium",
        standards: [
            {
                source: "IETF RFC 9700 / BCP 240",
                control: "Section 2.2.2",
                relationship: "REQUIRED",
                url: RFC_9700,
            },
            {
                source: "OWASP ASVS 5.0.0",
                control: "10.4.5",
                relationship: "CONTEXT_DEPENDENT",
                url: ASVS_OAUTH,
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "OAUTH_STATE_VALIDATED",
        name: "OAuth authorization response is bound to the initiating user-agent transaction",
        protocol: "oauth",
        prerequisites: ["The authorization-code client uses state as its CSRF transaction binding."],
        requiredGraphPattern: ["OAuthAuthorizationRequest", "OAuthCallback", "OAuthStateValidation"],
        secureEvidence: ["Random state is sent, session-bound, and validated at the callback."],
        insecureEvidence: [
            "The supported callback explicitly skips state validation without another proven CSRF binding.",
        ],
        unresolvedConditions: [
            "PKCE or OIDC nonce can provide the binding when state is not applicable.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "high",
        standards: [
            {
                source: "IETF RFC 9700 / BCP 240",
                control: "Sections 2.1 and 4.7",
                relationship: "CONTEXT_DEPENDENT",
                url: RFC_9700,
            },
            {
                source: "OWASP ASVS 5.0.0",
                control: "10.2.1",
                relationship: "CONTEXT_DEPENDENT",
                url: ASVS_OAUTH,
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "PKCE_REQUIRED_WHERE_APPLICABLE",
        name: "PKCE protects applicable authorization-code flows",
        protocol: "oauth",
        prerequisites: ["A public OAuth client uses the authorization-code grant."],
        requiredGraphPattern: [
            "PKCEVerifier",
            "OAuthAuthorizationRequest",
            "AuthorizationCodeExchange",
        ],
        secureEvidence: [
            "A transaction-specific verifier produces an S256 challenge and is used at token exchange.",
        ],
        insecureEvidence: [
            "A proven public authorization-code client omits PKCE from request and exchange.",
        ],
        unresolvedConditions: [
            "Client confidentiality or authorization-server guarantees cannot always be inferred.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "high",
        standards: [
            {
                source: "IETF RFC 9700 / BCP 240",
                control: "Section 2.1.1",
                relationship: "REQUIRED",
                url: RFC_9700,
            },
            {
                source: "IETF RFC 7636",
                control: "PKCE protocol",
                relationship: "REQUIRED",
                url: RFC_7636,
            },
            {
                source: "OWASP ASVS 5.0.0",
                control: "10.4.6",
                relationship: "CONTEXT_DEPENDENT",
                url: ASVS_OAUTH,
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
    {
        schemaVersion: "1.0.0",
        id: "OIDC_NONCE_VALIDATED_WHERE_APPLICABLE",
        name: "OIDC nonce is validated where applicable",
        protocol: "oidc",
        prerequisites: ["An OIDC authentication flow sends a nonce and accepts an ID Token."],
        requiredGraphPattern: ["OAuthAuthorizationRequest", "OIDCNonceValidation", "TokenAccept"],
        secureEvidence: ["The ID Token nonce is matched to the initiating transaction."],
        insecureEvidence: ["An ID Token is accepted after an explicit nonce-validation bypass."],
        unresolvedConditions: [
            "Library-internal ID Token validation remains unknown without a supported guarantee.",
        ],
        severityIfViolated: "high",
        defaultConfidence: "medium",
        standards: [
            {
                source: "OpenID Connect Core 1.0 Errata 2",
                control: "Sections 3.1.2.1 and 3.1.3.7",
                relationship: "CONTEXT_DEPENDENT",
                url: OIDC_CORE,
            },
            {
                source: "OWASP ASVS 5.0.0",
                control: "10.5.1",
                relationship: "CONTEXT_DEPENDENT",
                url: ASVS_OAUTH,
            },
        ],
        remediationClass: "ARCHITECTURAL",
    },
];
export const AUTHENTICATION_INVARIANTS = invariantDefinitions.map((definition) => authenticationInvariantSchema.parse(definition));
const MAX_PATH_STATES = 10_000;
function packageRoots(files) {
    return files
        .filter((file) => /(?:^|\/)package\.json$/.test(file.relativePath))
        .map((file) => file.relativePath.replace(/(?:^|\/)package\.json$/, ""))
        .sort((left, right) => right.length - left.length || left.localeCompare(right));
}
function packageScope(relativePath, roots) {
    return (roots.find((root) => root === "" || relativePath === root || relativePath.startsWith(`${root}/`)) ?? "");
}
function operationsByPackage(operations, roots, include) {
    const groups = new Map();
    for (const operation of operations) {
        if (!include(operation))
            continue;
        const scope = packageScope(operation.location.path, roots);
        const scoped = groups.get(scope) ?? [];
        scoped.push(operation);
        groups.set(scope, scoped);
    }
    return [...groups.entries()]
        .map(([scope, scoped]) => ({ scope, operations: scoped }))
        .sort((left, right) => left.scope.localeCompare(right.scope));
}
function callAdjacency(ir) {
    const result = new Map();
    for (const call of ir.calls) {
        if (call.resolution !== "resolved" || call.calleeSymbolId === undefined)
            continue;
        const calls = result.get(call.callerSymbolId) ?? [];
        calls.push(call);
        result.set(call.callerSymbolId, calls);
    }
    return result;
}
function findCallPath(adjacency, start, target, maxDepth = 12) {
    if (start === target)
        return [];
    const pending = [
        { symbolId: start, calls: [], visited: new Set([start]) },
    ];
    let explored = 0;
    while (pending.length > 0 && explored < MAX_PATH_STATES) {
        const current = pending.shift();
        explored += 1;
        if (current === undefined || current.calls.length >= maxDepth)
            continue;
        for (const call of adjacency.get(current.symbolId) ?? []) {
            const callee = call.calleeSymbolId;
            if (callee === undefined || current.visited.has(callee))
                continue;
            const calls = [...current.calls, call];
            if (callee === target)
                return calls;
            pending.push({ symbolId: callee, calls, visited: new Set([...current.visited, callee]) });
        }
    }
    return undefined;
}
function resultId(invariantId, correlationKey) {
    return `authproof:${stableFingerprint(["1.0.0", invariantId, correlationKey]).slice(0, 16)}`;
}
function evidenceFor(ir, id) {
    return ir.evidence.find((item) => item.id === id);
}
function operationEvidenceKind(operation) {
    if (operation.protocol === "session")
        return operation.kind.includes("Revoke") ? "revocation" : "session";
    if (operation.protocol === "password-reset")
        return "password-reset";
    if (operation.protocol === "jwt" || operation.protocol === "refresh-token")
        return "token";
    if (operation.protocol === "oauth" || operation.protocol === "oidc")
        return "oauth";
    return "authentication";
}
function evidencePath(ir, routes, operations, conclusion, invariantId) {
    const adjacency = callAdjacency(ir);
    const raw = [];
    const seen = new Set();
    const push = (step) => {
        const key = `${step.irId}:${step.location.path}:${step.location.start.offset}`;
        if (!seen.has(key)) {
            raw.push(step);
            seen.add(key);
        }
    };
    for (const route of routes) {
        const routeEvidence = route.evidenceIds.map((id) => evidenceFor(ir, id)).find(Boolean);
        if (routeEvidence !== undefined) {
            push({
                kind: "route",
                irId: route.id,
                location: routeEvidence.location,
                message: routeEvidence.message,
            });
        }
        for (const operation of operations.filter((item) => item.routeIds.includes(route.id))) {
            if (route.handlerSymbolId !== undefined && operation.functionSymbolId !== undefined) {
                for (const call of findCallPath(adjacency, route.handlerSymbolId, operation.functionSymbolId) ?? []) {
                    const callEvidence = call.evidenceIds.map((id) => evidenceFor(ir, id)).find(Boolean);
                    if (callEvidence !== undefined) {
                        push({
                            kind: "call",
                            irId: call.id,
                            location: callEvidence.location,
                            message: callEvidence.message,
                        });
                    }
                }
            }
            push({
                kind: operationEvidenceKind(operation),
                irId: operation.id,
                location: operation.location,
                message: operation.guarantee,
            });
        }
    }
    for (const operation of operations.filter((item) => item.routeIds.length === 0)) {
        push({
            kind: operationEvidenceKind(operation),
            irId: operation.id,
            location: operation.location,
            message: operation.guarantee,
        });
    }
    const anchor = raw.at(-1);
    if (anchor !== undefined && conclusion !== "UNKNOWN") {
        push({
            kind: "enforcement",
            irId: resultId(invariantId, `${routes.map((route) => route.id).join(":")}:${operations.map((operation) => operation.id).join(":")}`),
            location: anchor.location,
            message: conclusion === "PROVEN_SECURE"
                ? `${invariantId} is proven secure on the resolved evidence path.`
                : `${invariantId} is proven insecure on the resolved evidence path.`,
        });
    }
    return raw.map((step, order) => ({ order, ...step }));
}
function makeResult(input) {
    return authenticationInvariantResultSchema.parse({
        schemaVersion: "1.0.0",
        id: resultId(input.invariantId, input.correlationKey),
        invariantId: input.invariantId,
        applicability: input.applicability,
        conclusion: input.conclusion,
        confidence: input.confidence ?? (input.conclusion === "UNKNOWN" ? "medium" : "high"),
        reachability: input.routes.length > 0 ? "likely" : "unknown",
        operationIds: input.operations.map((operation) => operation.id).sort(),
        routeIds: input.routes.map((route) => route.id).sort(),
        evidencePath: evidencePath(input.ir, input.routes, input.operations, input.conclusion, input.invariantId),
        unresolvedConditions: [...(input.unresolvedConditions ?? [])],
        explanation: input.explanation,
        correlationKey: input.correlationKey,
    });
}
function notApplicable(invariantId, explanation, ir) {
    return makeResult({
        invariantId,
        applicability: "NOT_APPLICABLE",
        conclusion: "UNKNOWN",
        operations: [],
        routes: [],
        explanation,
        correlationKey: `not-applicable:${invariantId}`,
        ir,
        confidence: "high",
    });
}
function attachRoutes(ir, operations) {
    const adjacency = callAdjacency(ir);
    return operations.map((operation) => {
        if (operation.functionSymbolId === undefined)
            return operation;
        const routeIds = ir.routes
            .filter((route) => {
            const roots = [route.handlerSymbolId, ...route.middlewareSymbolIds].filter((symbolId) => symbolId !== undefined);
            return roots.some((root) => findCallPath(adjacency, root, operation.functionSymbolId ?? "") !== undefined);
        })
            .map((route) => route.id)
            .sort();
        return { ...operation, routeIds };
    });
}
function derivedRouteOperations(ir, operations) {
    const result = [...operations];
    for (const route of ir.routes) {
        const routeOperations = operations.filter((operation) => operation.routeIds.includes(route.id));
        const add = (kind, protocol, guarantee) => {
            const id = `authop:${stableFingerprint(["1.0.0", kind, route.id]).slice(0, 16)}`;
            result.push({
                id,
                kind,
                protocol,
                adapter: "Express resolved route lifecycle",
                guarantee,
                ...(route.handlerSymbolId === undefined ? {} : { functionSymbolId: route.handlerSymbolId }),
                routeIds: [route.id],
                location: route.location,
                confidence: "high",
                attributes: {},
            });
        };
        if (routeOperations.some((operation) => operation.kind === "OAuthStateValidation")) {
            add("OAuthCallback", "oauth", "The resolved Express route contains OAuth authorization-response validation.");
        }
        if (routeOperations.some((operation) => operation.kind === "PasswordResetCredentialIssue") &&
            !routeOperations.some((operation) => operation.kind === "PasswordChange")) {
            add("PasswordResetRequest", "password-reset", "The resolved Express route issues a persisted password-reset credential.");
        }
        if (routeOperations.some((operation) => operation.kind === "CredentialVerifier")) {
            add("CredentialInput", "session", "The resolved Express authentication route receives credentials for verification.");
        }
    }
    const unique = new Map(result.map((operation) => [operation.id, operation]));
    return [...unique.values()].sort((left, right) => left.id.localeCompare(right.id));
}
function evaluateSessionRotation(ir, operations) {
    const results = [];
    for (const route of ir.routes) {
        const onRoute = operations.filter((operation) => operation.routeIds.includes(route.id));
        const verifier = onRoute.find((operation) => operation.kind === "CredentialVerifier");
        const success = onRoute.find((operation) => operation.kind === "AuthenticationSuccess");
        if (verifier === undefined || success === undefined)
            continue;
        const rotation = onRoute.find((operation) => operation.kind === "SessionRotate");
        results.push(makeResult({
            invariantId: "SESSION_ROTATES_AFTER_AUTHENTICATION",
            applicability: "APPLICABLE",
            conclusion: rotation === undefined ? "PROVEN_INSECURE" : "PROVEN_SECURE",
            operations: [verifier, success, ...(rotation === undefined ? [] : [rotation])],
            routes: [route],
            explanation: rotation === undefined
                ? "The resolved express-session login path verifies credentials and binds authenticated identity to the existing session without regeneration."
                : "The resolved login path regenerates express-session before establishing authenticated session identity.",
            correlationKey: `session-rotation:${success.id}`,
            ir,
        }));
    }
    return results.length === 0
        ? [
            notApplicable("SESSION_ROTATES_AFTER_AUTHENTICATION", "No supported stateful login upgrade was detected.", ir),
        ]
        : results;
}
function evaluateLogout(ir, operations) {
    const results = [];
    for (const route of ir.routes) {
        const revocations = operations.filter((operation) => operation.routeIds.includes(route.id) && operation.kind === "SessionRevoke");
        if (revocations.length === 0)
            continue;
        const authoritative = revocations.find((operation) => operation.attributes.authoritative === "true");
        const transportOnly = revocations.find((operation) => operation.attributes.transportOnly === "true");
        const conclusion = authoritative !== undefined
            ? "PROVEN_SECURE"
            : transportOnly !== undefined
                ? "PROVEN_INSECURE"
                : "UNKNOWN";
        results.push(makeResult({
            invariantId: "SESSION_INVALIDATED_ON_LOGOUT",
            applicability: "APPLICABLE",
            conclusion,
            operations: revocations,
            routes: [route],
            explanation: conclusion === "PROVEN_SECURE"
                ? "The resolved logout path destroys authoritative server-side session state."
                : conclusion === "PROVEN_INSECURE"
                    ? "The resolved logout path clears only the browser cookie; no authoritative revocation occurs on that path."
                    : "A logout boundary is present, but authoritative revocation behavior is unresolved.",
            unresolvedConditions: conclusion === "UNKNOWN"
                ? ["The session-store revocation guarantee is unsupported."]
                : [],
            correlationKey: `logout:${route.id}`,
            ir,
        }));
    }
    return results.length === 0
        ? [
            notApplicable("SESSION_INVALIDATED_ON_LOGOUT", "No supported logout revocation boundary was detected.", ir),
        ]
        : results;
}
function passwordResetRoutes(ir, operations) {
    return ir.routes
        .map((route) => ({
        route,
        operations: operations.filter((operation) => operation.routeIds.includes(route.id)),
    }))
        .filter(({ operations: onRoute }) => onRoute.some((operation) => operation.kind === "PasswordResetValidate") &&
        onRoute.some((operation) => operation.kind === "PasswordChange"));
}
function evaluateResetCredentialProtection(ir, operations, roots) {
    const requestFlows = ir.routes
        .map((route) => ({
        route,
        operations: operations.filter((operation) => operation.routeIds.includes(route.id)),
    }))
        .filter(({ operations: onRoute }) => onRoute.some((operation) => operation.kind === "PasswordResetRequest"));
    if (requestFlows.length === 0) {
        return [
            notApplicable("PASSWORD_RESET_CREDENTIAL_PROTECTED", "No supported application-owned password-reset credential issuance was detected.", ir),
        ];
    }
    return requestFlows.map(({ route, operations: onRoute }) => {
        const scope = packageScope(route.location.path, roots);
        const validations = operations.filter((operation) => operation.kind === "PasswordResetValidate" &&
            packageScope(operation.location.path, roots) === scope);
        const persistence = onRoute.find((operation) => operation.kind === "PasswordResetCredentialIssue" &&
            operation.attributes.expiryStored !== undefined);
        const generator = onRoute.find((operation) => operation.attributes.credentialGeneration !== undefined);
        const validation = validations[0];
        const secure = generator?.attributes.credentialGeneration === "cryptographic" &&
            persistence?.attributes.storedProtection === "hashed" &&
            persistence.attributes.expiryStored === "true" &&
            validation?.attributes.checksExpiry === "true";
        const explicitlyWeak = generator?.attributes.credentialGeneration === "weak" ||
            persistence?.attributes.storedProtection === "raw" ||
            persistence?.attributes.expiryStored === "false" ||
            validation?.attributes.checksExpiry === "false";
        const conclusion = secure ? "PROVEN_SECURE" : explicitlyWeak ? "PROVEN_INSECURE" : "UNKNOWN";
        const selected = [...onRoute, ...(validation === undefined ? [] : [validation])];
        const relatedRoutes = ir.routes.filter((candidate) => candidate.id === route.id ||
            selected.some((operation) => operation.routeIds.includes(candidate.id)));
        return makeResult({
            invariantId: "PASSWORD_RESET_CREDENTIAL_PROTECTED",
            applicability: persistence === undefined ? "UNKNOWN" : "APPLICABLE",
            conclusion,
            operations: selected,
            routes: relatedRoutes,
            explanation: secure
                ? "The resolved reset lifecycle uses a supported CSPRNG, persists only a digest with an expiry, and enforces expiry during validation."
                : explicitlyWeak
                    ? "The resolved application-owned reset lifecycle proves weak generation, raw persistence, missing expiry storage, or missing expiry enforcement."
                    : "A reset credential is persisted, but its generation, at-rest protection, or expiry enforcement cannot be completely proven.",
            unresolvedConditions: conclusion === "UNKNOWN"
                ? [
                    "Generation, at-rest protection, and expiry must all be evidenced before trust is established.",
                ]
                : [],
            correlationKey: `reset-credential:${persistence?.id ?? route.id}`,
            ir,
        });
    });
}
function evaluateResetSingleUse(ir, operations) {
    const flows = passwordResetRoutes(ir, operations);
    if (flows.length === 0) {
        return [
            notApplicable("PASSWORD_RESET_TOKEN_SINGLE_USE", "No supported password-reset consumption flow was detected.", ir),
        ];
    }
    return flows.map(({ route, operations: onRoute }) => {
        const validation = onRoute.find((operation) => operation.kind === "PasswordResetValidate");
        const passwordChange = onRoute.find((operation) => operation.kind === "PasswordChange");
        const consume = onRoute.find((operation) => operation.kind === "PasswordResetConsume");
        const checksUnused = validation?.attributes.checksUnused === "true";
        const conclusion = consume !== undefined && checksUnused ? "PROVEN_SECURE" : "PROVEN_INSECURE";
        const selected = [validation, passwordChange, consume].filter((operation) => operation !== undefined);
        return makeResult({
            invariantId: "PASSWORD_RESET_TOKEN_SINGLE_USE",
            applicability: "APPLICABLE",
            conclusion,
            operations: selected,
            routes: [route],
            explanation: conclusion === "PROVEN_SECURE"
                ? "The reset path requires an unused persisted credential and consumes it after password replacement."
                : "The resolved reset path replaces the password while the persisted reset credential is neither proven unused nor consumed.",
            correlationKey: `reset-single-use:${validation?.id ?? route.id}`,
            ir,
        });
    });
}
function evaluateResetSessions(ir, operations, roots) {
    const flows = passwordResetRoutes(ir, operations);
    if (flows.length === 0) {
        return [
            notApplicable("PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS", "No supported password-reset password mutation was detected.", ir),
        ];
    }
    return flows.map(({ route, operations: onRoute }) => {
        const scope = packageScope(route.location.path, roots);
        const sessionLookups = operations.filter((operation) => operation.kind === "SessionLookup" &&
            packageScope(operation.location.path, roots) === scope);
        const sessionCreates = operations.filter((operation) => operation.kind === "SessionCreate" &&
            packageScope(operation.location.path, roots) === scope);
        const passwordChange = onRoute.find((operation) => operation.kind === "PasswordChange");
        const revokeAll = onRoute.find((operation) => operation.kind === "SessionRevokeAll");
        const versionChange = passwordChange?.attributes.changesSessionGeneration === "true";
        const versionChecked = sessionLookups.length > 0 &&
            sessionLookups.every((operation) => operation.attributes.checksSessionVersion === "true");
        const independentSessions = sessionCreates.length > 0 && sessionLookups.length > 0;
        const conclusion = revokeAll !== undefined || (versionChange && versionChecked)
            ? "PROVEN_SECURE"
            : independentSessions && !versionChange && !versionChecked
                ? "PROVEN_INSECURE"
                : "UNKNOWN";
        const selected = [
            ...onRoute.filter((operation) => ["PasswordResetValidate", "PasswordChange", "SessionRevokeAll"].includes(operation.kind)),
            ...sessionCreates,
            ...sessionLookups,
        ];
        const relatedRoutes = ir.routes.filter((candidate) => candidate.id === route.id ||
            selected.some((operation) => operation.routeIds.includes(candidate.id)));
        return makeResult({
            invariantId: "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS",
            applicability: independentSessions ? "APPLICABLE" : "UNKNOWN",
            conclusion,
            operations: selected,
            routes: relatedRoutes,
            explanation: conclusion === "PROVEN_SECURE"
                ? revokeAll !== undefined
                    ? "The resolved password-reset path revokes all authoritative sessions for the affected account."
                    : "Password reset advances a session generation that every supported session lookup validates."
                : conclusion === "PROVEN_INSECURE"
                    ? "Password reset changes the credential, while independently persisted sessions continue to be accepted without revocation or a validated generation change."
                    : "Password mutation is proven, but existing-session invalidation cannot be established for the detected architecture.",
            unresolvedConditions: conclusion === "UNKNOWN"
                ? [
                    "No supported authoritative session lifecycle proves whether old sessions remain usable.",
                ]
                : [],
            correlationKey: `reset-sessions:${passwordChange?.id ?? route.id}`,
            ir,
        });
    });
}
function jwtAcceptanceRoutes(ir, operations) {
    return ir.routes
        .map((route) => ({
        route,
        operations: operations.filter((operation) => operation.routeIds.includes(route.id)),
    }))
        .filter(({ operations: onRoute }) => onRoute.some((operation) => operation.kind === "TokenAccept" && operation.protocol === "jwt"));
}
function evaluateJwt(ir, operations) {
    const flows = jwtAcceptanceRoutes(ir, operations);
    if (flows.length === 0) {
        return [
            notApplicable("JWT_SIGNATURE_VERIFIED", "No supported JWT authenticated-context acceptance boundary was detected.", ir),
        ];
    }
    return flows.map(({ route, operations: onRoute }) => {
        const accept = onRoute.find((operation) => operation.kind === "TokenAccept" && operation.protocol === "jwt");
        const verify = onRoute.find((operation) => operation.kind === "JWTValidate");
        const decode = onRoute.find((operation) => operation.kind === "JWTDecodeWithoutVerify");
        const conclusion = verify !== undefined ? "PROVEN_SECURE" : decode !== undefined ? "PROVEN_INSECURE" : "UNKNOWN";
        return makeResult({
            invariantId: "JWT_SIGNATURE_VERIFIED",
            applicability: "APPLICABLE",
            conclusion,
            operations: [verify, decode, accept].filter((operation) => operation !== undefined),
            routes: [route],
            explanation: conclusion === "PROVEN_SECURE"
                ? "A supported JWT verification API establishes cryptographic trust before claims become authenticated context."
                : conclusion === "PROVEN_INSECURE"
                    ? "JWT claims are decoded without signature verification and then accepted as authenticated application context."
                    : "JWT claims are accepted, but the validation boundary is unsupported or unresolved.",
            unresolvedConditions: conclusion === "UNKNOWN"
                ? ["No supported verification or decode-only boundary was resolved."]
                : [],
            correlationKey: `jwt-accept:${accept?.functionSymbolId ?? route.id}`,
            ir,
        });
    });
}
function evaluateJwtClaim(ir, operations, invariantId, attribute) {
    const flows = jwtAcceptanceRoutes(ir, operations);
    if (flows.length === 0) {
        return [
            notApplicable(invariantId, "No supported JWT authenticated-context acceptance boundary was detected.", ir),
        ];
    }
    return flows.map(({ route, operations: onRoute }) => {
        const verify = onRoute.find((operation) => operation.kind === "JWTValidate");
        const accepted = onRoute.find((operation) => operation.kind === "TokenAccept");
        const proven = verify?.attributes[attribute] === "validated";
        return makeResult({
            invariantId,
            applicability: verify === undefined ? "UNKNOWN" : "APPLICABLE",
            conclusion: proven ? "PROVEN_SECURE" : "UNKNOWN",
            operations: [verify, accepted].filter((operation) => operation !== undefined),
            routes: [route],
            explanation: proven
                ? `The supported verifier receives an explicit expected ${attribute}.`
                : `The expected ${attribute} trust boundary cannot be inferred; no vulnerability is emitted.`,
            unresolvedConditions: proven
                ? []
                : [`Application-specific expected ${attribute} is not established by supported evidence.`],
            correlationKey: `${invariantId}:${accepted?.functionSymbolId ?? route.id}`,
            ir,
        });
    });
}
function evaluateRefresh(ir, operations, roots) {
    const groups = operationsByPackage(operations, roots, (operation) => operation.protocol === "refresh-token");
    if (groups.length === 0) {
        return [
            notApplicable("REFRESH_TOKEN_REPLAY_MITIGATED", "No supported refresh-token lifecycle was detected.", ir),
        ];
    }
    return groups.map(({ scope, operations: refresh }) => {
        const routes = ir.routes.filter((route) => refresh.some((operation) => operation.routeIds.includes(route.id)));
        const completeRoute = routes.find((route) => {
            const onRoute = refresh.filter((operation) => operation.routeIds.includes(route.id));
            return [
                "RefreshTokenIssue",
                "RefreshTokenValidate",
                "RefreshTokenRotate",
                "RefreshTokenRevoke",
            ].every((kind) => onRoute.some((operation) => operation.kind === kind));
        });
        const selected = completeRoute === undefined
            ? refresh
            : refresh.filter((operation) => operation.routeIds.includes(completeRoute.id));
        return makeResult({
            invariantId: "REFRESH_TOKEN_REPLAY_MITIGATED",
            applicability: "APPLICABLE",
            conclusion: completeRoute === undefined ? "UNKNOWN" : "PROVEN_SECURE",
            operations: selected,
            routes: completeRoute === undefined ? routes : [completeRoute],
            explanation: completeRoute !== undefined
                ? "One resolved refresh path validates, rotates, revokes, and reissues authoritative refresh-token records."
                : "Refresh tokens are present, but rotation, reuse detection, or sender constraint is not completely proven.",
            unresolvedConditions: completeRoute !== undefined
                ? []
                : ["Replay mitigation may be delegated to an unsupported authorization server."],
            correlationKey: `refresh-token-lifecycle:${scope || "root"}`,
            ir,
        });
    });
}
function evaluateOAuthState(ir, operations, roots) {
    const groups = operationsByPackage(operations, roots, (operation) => operation.protocol === "oauth" || operation.protocol === "oidc");
    if (groups.length === 0) {
        return [
            notApplicable("OAUTH_STATE_VALIDATED", "No supported OAuth authorization flow was detected.", ir),
        ];
    }
    return groups.map(({ scope, operations: oauth }) => {
        const stateSent = oauth.find((operation) => operation.attributes.stateSent === "true");
        const stateGenerated = oauth.find((operation) => operation.attributes.stateGenerated === "true");
        const stateStored = oauth.find((operation) => operation.attributes.stateStored === "true");
        const validation = oauth.find((operation) => operation.kind === "OAuthStateValidation");
        const pkceComplete = oauth.some((operation) => operation.kind === "PKCEVerifier" && operation.attributes.stage === "challenge") &&
            oauth.some((operation) => operation.kind === "AuthorizationCodeExchange" &&
                operation.attributes.pkceBound === "true");
        if (stateSent === undefined && validation === undefined && pkceComplete) {
            return notApplicable("OAUTH_STATE_VALIDATED", `The supported ${scope || "root"} flow uses complete PKCE transaction binding instead of state.`, ir);
        }
        const secure = stateSent !== undefined &&
            stateGenerated !== undefined &&
            stateStored !== undefined &&
            validation?.attributes.validated === "true" &&
            validation.attributes.boundToSession === "true";
        const insecure = validation?.attributes.validated === "false" && !pkceComplete;
        const routes = ir.routes.filter((route) => oauth.some((operation) => operation.routeIds.includes(route.id)));
        return makeResult({
            invariantId: "OAUTH_STATE_VALIDATED",
            applicability: stateSent !== undefined || validation !== undefined ? "APPLICABLE" : "UNKNOWN",
            conclusion: secure ? "PROVEN_SECURE" : insecure ? "PROVEN_INSECURE" : "UNKNOWN",
            operations: [stateGenerated, stateStored, stateSent, validation].filter((operation) => operation !== undefined),
            routes,
            explanation: secure
                ? "Random OAuth state is sent, bound to express-session, and validated against that session at callback."
                : insecure
                    ? "The resolved OAuth callback explicitly skips state validation and no complete PKCE binding is proven."
                    : "OAuth is detected, but complete state generation, binding, and callback validation cannot be proven.",
            unresolvedConditions: secure || insecure
                ? []
                : ["A supported alternative CSRF transaction binding is not established."],
            correlationKey: `oauth-state-flow:${scope || "root"}`,
            ir,
        });
    });
}
function evaluatePkce(ir, operations, roots) {
    const groups = operationsByPackage(operations, roots, (operation) => operation.protocol === "oauth" || operation.protocol === "oidc");
    if (groups.length === 0 ||
        !groups.some(({ operations: oauth }) => oauth.some((operation) => operation.kind === "AuthorizationCodeExchange"))) {
        return [
            notApplicable("PKCE_REQUIRED_WHERE_APPLICABLE", "No supported OAuth authorization-code exchange was detected.", ir),
        ];
    }
    return groups.flatMap(({ scope, operations: oauth }) => {
        const exchange = oauth.find((operation) => operation.kind === "AuthorizationCodeExchange");
        if (exchange === undefined)
            return [];
        const publicClient = oauth.some((operation) => operation.attributes.clientType === "public");
        const generated = oauth.find((operation) => operation.kind === "PKCEVerifier" && operation.attributes.stage === "generated");
        const stored = oauth.find((operation) => operation.kind === "PKCEVerifier" && operation.attributes.stage === "stored");
        const challenge = oauth.find((operation) => operation.kind === "PKCEVerifier" && operation.attributes.stage === "challenge");
        const challengeSent = oauth.find((operation) => operation.attributes.challengeSent === "true");
        const method = oauth.find((operation) => operation.attributes.parameter === "code_challenge_method");
        const secure = publicClient &&
            generated !== undefined &&
            stored !== undefined &&
            challenge !== undefined &&
            challengeSent !== undefined &&
            method?.attributes.method === "S256" &&
            exchange.attributes.pkceBound === "true";
        const routes = ir.routes.filter((route) => oauth.some((operation) => operation.routeIds.includes(route.id)));
        return [
            makeResult({
                invariantId: "PKCE_REQUIRED_WHERE_APPLICABLE",
                applicability: publicClient ? "APPLICABLE" : "UNKNOWN",
                conclusion: secure ? "PROVEN_SECURE" : publicClient ? "PROVEN_INSECURE" : "UNKNOWN",
                operations: [generated, stored, challenge, challengeSent, method, exchange].filter((operation) => operation !== undefined),
                routes,
                explanation: secure
                    ? "The proven public client binds an S256 PKCE verifier across authorization request and token exchange."
                    : publicClient
                        ? "A proven public authorization-code client omits one or more required PKCE lifecycle boundaries."
                        : "The authorization-code flow is detected, but client context is unresolved; missing PKCE is not reported as a vulnerability.",
                unresolvedConditions: publicClient
                    ? []
                    : ["Public versus confidential client context is unresolved."],
                correlationKey: `oauth-pkce-flow:${scope || "root"}`,
                ir,
            }),
        ];
    });
}
function evaluateOidcNonce(ir, operations) {
    const oidc = operations.filter((operation) => operation.protocol === "oidc");
    if (oidc.length === 0) {
        return [
            notApplicable("OIDC_NONCE_VALIDATED_WHERE_APPLICABLE", "No supported OIDC authentication flow was detected.", ir),
        ];
    }
    const sent = oidc.find((operation) => operation.attributes.nonceSent === "true");
    const validated = oidc.find((operation) => operation.kind === "OIDCNonceValidation");
    const accepted = oidc.find((operation) => operation.kind === "TokenAccept");
    const routes = ir.routes.filter((route) => oidc.some((operation) => operation.routeIds.includes(route.id)));
    return [
        makeResult({
            invariantId: "OIDC_NONCE_VALIDATED_WHERE_APPLICABLE",
            applicability: sent !== undefined && accepted !== undefined ? "APPLICABLE" : "UNKNOWN",
            conclusion: validated !== undefined ? "PROVEN_SECURE" : "UNKNOWN",
            operations: [sent, validated, accepted].filter((operation) => operation !== undefined),
            routes,
            explanation: validated !== undefined
                ? "OIDC nonce validation is proven before ID Token acceptance."
                : "OIDC is detected, but nonce validation remains inside unsupported behavior; no vulnerability is emitted.",
            unresolvedConditions: validated === undefined
                ? ["Supported evidence does not expose the ID Token nonce comparison."]
                : [],
            correlationKey: "oidc-nonce-flow",
            ir,
        }),
    ];
}
export function buildAuthenticationAnalysis(ir, manifest, files, parsedByPath) {
    const roots = packageRoots(files);
    let operations = analyzeAuthenticationOperations(ir, manifest, files, parsedByPath);
    operations = attachRoutes(ir, operations);
    const resetPersistenceRoutes = new Set(operations
        .filter((operation) => operation.kind === "PasswordResetCredentialIssue" &&
        operation.attributes.expiryStored !== undefined)
        .flatMap((operation) => operation.routeIds));
    operations = operations.filter((operation) => operation.attributes.credentialGeneration === undefined ||
        operation.routeIds.some((routeId) => resetPersistenceRoutes.has(routeId)));
    operations = derivedRouteOperations(ir, operations);
    const results = [
        ...evaluateSessionRotation(ir, operations),
        ...evaluateLogout(ir, operations),
        ...evaluateResetCredentialProtection(ir, operations, roots),
        ...evaluateResetSingleUse(ir, operations),
        ...evaluateResetSessions(ir, operations, roots),
        ...evaluateJwt(ir, operations),
        ...evaluateJwtClaim(ir, operations, "JWT_EXPECTED_ISSUER_VALIDATED", "issuer"),
        ...evaluateJwtClaim(ir, operations, "JWT_EXPECTED_AUDIENCE_VALIDATED", "audience"),
        ...evaluateRefresh(ir, operations, roots),
        ...evaluateOAuthState(ir, operations, roots),
        ...evaluatePkce(ir, operations, roots),
        ...evaluateOidcNonce(ir, operations),
    ].sort((left, right) => left.id.localeCompare(right.id));
    return authenticationAnalysisSchema.parse({
        schemaVersion: "1.0.0",
        graphVersion: "2.0.0",
        operations,
        invariants: AUTHENTICATION_INVARIANTS,
        results,
        metrics: {
            applicable: results.filter((result) => result.applicability === "APPLICABLE").length,
            provenSecure: results.filter((result) => result.conclusion === "PROVEN_SECURE").length,
            provenInsecure: results.filter((result) => result.conclusion === "PROVEN_INSECURE").length,
            unknown: results.filter((result) => result.applicability === "APPLICABLE" && result.conclusion === "UNKNOWN").length,
            notApplicable: results.filter((result) => result.applicability === "NOT_APPLICABLE").length,
            evidenceSteps: results.reduce((sum, result) => sum + result.evidencePath.length, 0),
        },
        limitations: [
            "Phase 3 authentication proofs cover explicit TypeScript/JavaScript Express, express-session, Prisma authentication records, jsonwebtoken, jose, and oauth4webapi evidence only.",
            "Library behavior is trusted only for the exact supported API surface; version-hidden or unsupported behavior remains UNKNOWN.",
            "Application names alone never establish an authentication operation; adapters require protocol APIs, persistence operations, or resolved lifecycle evidence.",
            "OAuth 2.1 remains an Internet-Draft and is not used as normative detector guidance.",
        ],
    });
}
//# sourceMappingURL=invariants.js.map
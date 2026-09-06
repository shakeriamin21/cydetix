import { z } from "zod";

import { evidencePathStepSchema } from "../authorization-analysis/model.js";
import { irLocationSchema } from "../security-ir/model.js";

const confidenceSchema = z.enum(["low", "medium", "high"]);
const reachabilitySchema = z.enum(["unknown", "unlikely", "possible", "likely", "confirmed"]);
const remediationClassSchema = z.enum(["SAFE", "REVIEW_REQUIRED", "ARCHITECTURAL"]);
const severitySchema = z.enum(["info", "low", "medium", "high", "critical"]);

export const authenticationAnalysisVersion = "1.0.0" as const;
export const authenticationGraphVersion = "2.0.0" as const;

export const authenticationOperationKindSchema = z.enum([
  "CredentialInput",
  "CredentialVerifier",
  "AuthenticationSuccess",
  "SessionCreate",
  "SessionLookup",
  "SessionRotate",
  "SessionRevoke",
  "SessionRevokeAll",
  "SessionExpiry",
  "JWTIssue",
  "JWTValidate",
  "JWTSign",
  "JWTVerify",
  "JWTDecodeWithoutVerify",
  "JWKSResolve",
  "ClaimValidate",
  "TokenAccept",
  "AccessTokenIssue",
  "RefreshTokenIssue",
  "RefreshTokenValidate",
  "RefreshTokenRotate",
  "RefreshTokenRevoke",
  "PasswordChange",
  "PasswordResetRequest",
  "PasswordResetCredentialIssue",
  "PasswordResetValidate",
  "PasswordResetConsume",
  "EmailVerificationIssue",
  "EmailVerificationConsume",
  "OAuthAuthorizationRequest",
  "OAuthCallback",
  "AuthorizationCodeExchange",
  "PKCEVerifier",
  "OAuthStateValidation",
  "OIDCNonceValidation",
  "OIDCIssuerValidation",
  "OIDCAudienceValidation",
  "MFAChallenge",
  "MFAValidation",
  "PrivilegeChange",
  "ReauthenticationBoundary",
]);

export const authenticationProtocolSchema = z.enum([
  "session",
  "password-reset",
  "jwt",
  "refresh-token",
  "oauth",
  "oidc",
  "mfa",
]);

export const authenticationOperationSchema = z
  .object({
    id: z.string().regex(/^authop:[a-f0-9]{16}$/),
    kind: authenticationOperationKindSchema,
    protocol: authenticationProtocolSchema,
    adapter: z.string().min(1),
    guarantee: z.string().min(1),
    functionSymbolId: z
      .string()
      .regex(/^symbol:[a-f0-9]{16}$/)
      .optional(),
    routeIds: z.array(z.string().regex(/^route:[a-f0-9]{16}$/)),
    location: irLocationSchema,
    confidence: confidenceSchema,
    attributes: z.record(z.string(), z.string()),
  })
  .strict();

export const standardsRelationshipSchema = z.enum(["REQUIRED", "RECOMMENDED", "CONTEXT_DEPENDENT"]);

export const authenticationStandardMappingSchema = z
  .object({
    source: z.string().min(1),
    control: z.string().min(1),
    relationship: standardsRelationshipSchema,
    url: z.url(),
  })
  .strict();

export const authenticationInvariantIdSchema = z.enum([
  "SESSION_ROTATES_AFTER_AUTHENTICATION",
  "SESSION_INVALIDATED_ON_LOGOUT",
  "PASSWORD_RESET_CREDENTIAL_PROTECTED",
  "PASSWORD_RESET_TOKEN_SINGLE_USE",
  "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS",
  "JWT_SIGNATURE_VERIFIED",
  "JWT_EXPECTED_ISSUER_VALIDATED",
  "JWT_EXPECTED_AUDIENCE_VALIDATED",
  "REFRESH_TOKEN_REPLAY_MITIGATED",
  "OAUTH_STATE_VALIDATED",
  "PKCE_REQUIRED_WHERE_APPLICABLE",
  "OIDC_NONCE_VALIDATED_WHERE_APPLICABLE",
]);

export const authenticationInvariantSchema = z
  .object({
    schemaVersion: z.literal(authenticationAnalysisVersion),
    id: authenticationInvariantIdSchema,
    name: z.string().min(1),
    protocol: authenticationProtocolSchema,
    prerequisites: z.array(z.string().min(1)).min(1),
    requiredGraphPattern: z.array(authenticationOperationKindSchema).min(1),
    secureEvidence: z.array(z.string().min(1)).min(1),
    insecureEvidence: z.array(z.string().min(1)).min(1),
    unresolvedConditions: z.array(z.string().min(1)),
    severityIfViolated: severitySchema,
    defaultConfidence: confidenceSchema,
    standards: z.array(authenticationStandardMappingSchema).min(1),
    remediationClass: remediationClassSchema,
  })
  .strict();

export const invariantApplicabilitySchema = z.enum(["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"]);
export const invariantConclusionSchema = z.enum(["PROVEN_SECURE", "PROVEN_INSECURE", "UNKNOWN"]);

export const authenticationInvariantResultSchema = z
  .object({
    schemaVersion: z.literal(authenticationAnalysisVersion),
    id: z.string().regex(/^authproof:[a-f0-9]{16}$/),
    invariantId: authenticationInvariantIdSchema,
    applicability: invariantApplicabilitySchema,
    conclusion: invariantConclusionSchema,
    confidence: confidenceSchema,
    reachability: reachabilitySchema,
    operationIds: z.array(z.string().regex(/^authop:[a-f0-9]{16}$/)),
    routeIds: z.array(z.string().regex(/^route:[a-f0-9]{16}$/)),
    evidencePath: z.array(evidencePathStepSchema),
    unresolvedConditions: z.array(z.string().min(1)),
    explanation: z.string().min(1),
    correlationKey: z.string().min(1),
  })
  .strict();

export const authenticationAnalysisSchema = z
  .object({
    schemaVersion: z.literal(authenticationAnalysisVersion),
    graphVersion: z.literal(authenticationGraphVersion),
    operations: z.array(authenticationOperationSchema),
    invariants: z.array(authenticationInvariantSchema),
    results: z.array(authenticationInvariantResultSchema),
    metrics: z
      .object({
        applicable: z.number().int().nonnegative(),
        provenSecure: z.number().int().nonnegative(),
        provenInsecure: z.number().int().nonnegative(),
        unknown: z.number().int().nonnegative(),
        notApplicable: z.number().int().nonnegative(),
        evidenceSteps: z.number().int().nonnegative(),
      })
      .strict(),
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export type AuthenticationOperationKind = z.infer<typeof authenticationOperationKindSchema>;
export type AuthenticationProtocol = z.infer<typeof authenticationProtocolSchema>;
export type AuthenticationOperation = z.infer<typeof authenticationOperationSchema>;
export type AuthenticationInvariantId = z.infer<typeof authenticationInvariantIdSchema>;
export type AuthenticationInvariant = z.infer<typeof authenticationInvariantSchema>;
export type AuthenticationInvariantResult = z.infer<typeof authenticationInvariantResultSchema>;
export type AuthenticationAnalysis = z.infer<typeof authenticationAnalysisSchema>;

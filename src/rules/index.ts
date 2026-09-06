import type { RepositorySecurityRule, SecurityRule } from "../rule-engine/types.js";
import {
  jwtTrustInvariantRule,
  logoutRevocationInvariantRule,
  oauthPkceInvariantRule,
  oauthStateInvariantRule,
  passwordResetSessionsInvariantRule,
  passwordResetSingleUseInvariantRule,
  passwordResetCredentialProtectionInvariantRule,
  sessionRotationInvariantRule,
} from "./authentication-invariants.js";
import { committedSecretRule } from "./committed-secret.js";
import { corsCredentialsRule } from "./cors-credentials.js";
import { jwtVerificationRule } from "./jwt-verification.js";
import { passwordHashRule } from "./password-hash.js";
import { sessionCookieRule } from "./session-cookie.js";
import { objectAuthorizationRule } from "./object-authorization.js";
import { tenantIsolationRule } from "./tenant-isolation.js";

export const SECURITY_RULES: readonly SecurityRule[] = [
  sessionCookieRule,
  passwordHashRule,
  jwtVerificationRule,
  committedSecretRule,
  corsCredentialsRule,
];

export const REPOSITORY_SECURITY_RULES: readonly RepositorySecurityRule[] = [
  objectAuthorizationRule,
  tenantIsolationRule,
  sessionRotationInvariantRule,
  logoutRevocationInvariantRule,
  passwordResetSessionsInvariantRule,
  passwordResetSingleUseInvariantRule,
  passwordResetCredentialProtectionInvariantRule,
  jwtTrustInvariantRule,
  oauthStateInvariantRule,
  oauthPkceInvariantRule,
];

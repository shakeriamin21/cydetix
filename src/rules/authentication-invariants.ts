import type {
  AuthenticationInvariantId,
  AuthenticationOperationKind,
} from "../authentication-analysis/model.js";
import { makeFinding } from "../rule-engine/finding.js";
import { requireRule } from "../rule-engine/catalogue.js";
import type { RepositorySecurityRule } from "../rule-engine/types.js";

interface InvariantRuleConfig {
  readonly ruleId: string;
  readonly invariantId: AuthenticationInvariantId;
  readonly anchorKinds: readonly AuthenticationOperationKind[];
}

function invariantRule(config: InvariantRuleConfig): RepositorySecurityRule {
  const definition = requireRule(config.ruleId);
  return {
    definition,
    analyze(context) {
      if (context.authenticationAnalysis === undefined) return [];
      const filesByPath = new Map(context.files.map((file) => [file.relativePath, file]));
      const operationsById = new Map(
        context.authenticationAnalysis.operations.map((operation) => [operation.id, operation]),
      );
      return context.authenticationAnalysis.results.flatMap((result) => {
        if (
          result.invariantId !== config.invariantId ||
          result.applicability !== "APPLICABLE" ||
          result.conclusion !== "PROVEN_INSECURE"
        ) {
          return [];
        }
        const operations = result.operationIds
          .map((id) => operationsById.get(id))
          .filter((operation) => operation !== undefined);
        const anchor =
          config.anchorKinds
            .map((kind) => operations.find((operation) => operation.kind === kind))
            .find((operation) => operation !== undefined) ?? operations[0];
        if (anchor === undefined) return [];
        const file = filesByPath.get(anchor.location.path);
        if (file === undefined) return [];
        return [
          makeFinding({
            rule: definition,
            file,
            startOffset: anchor.location.start.offset,
            endOffset: anchor.location.end.offset,
            message: result.explanation,
            excerpt: "[AUTHENTICATION EVIDENCE REDACTED]",
            redacted: true,
            evidencePath: result.evidencePath,
            affectedComponent: result.routeIds.join(", ") || config.invariantId,
            reachability: result.reachability,
            autofix: definition.autofix,
            fingerprintAnchor: result.correlationKey,
          }),
        ];
      });
    },
  };
}

export const sessionRotationInvariantRule = invariantRule({
  ruleId: "AS-AUTH-SESSION-001",
  invariantId: "SESSION_ROTATES_AFTER_AUTHENTICATION",
  anchorKinds: ["AuthenticationSuccess"],
});

export const logoutRevocationInvariantRule = invariantRule({
  ruleId: "AS-AUTH-SESSION-002",
  invariantId: "SESSION_INVALIDATED_ON_LOGOUT",
  anchorKinds: ["SessionRevoke"],
});

export const passwordResetSessionsInvariantRule = invariantRule({
  ruleId: "AS-AUTH-RESET-001",
  invariantId: "PASSWORD_RESET_INVALIDATES_RELEVANT_SESSIONS",
  anchorKinds: ["PasswordChange"],
});

export const passwordResetSingleUseInvariantRule = invariantRule({
  ruleId: "AS-AUTH-RESET-002",
  invariantId: "PASSWORD_RESET_TOKEN_SINGLE_USE",
  anchorKinds: ["PasswordChange", "PasswordResetValidate"],
});

export const passwordResetCredentialProtectionInvariantRule = invariantRule({
  ruleId: "AS-AUTH-RESET-003",
  invariantId: "PASSWORD_RESET_CREDENTIAL_PROTECTED",
  anchorKinds: ["PasswordResetCredentialIssue", "PasswordResetValidate"],
});

export const jwtTrustInvariantRule = invariantRule({
  ruleId: "AS-AUTH-JWT-001",
  invariantId: "JWT_SIGNATURE_VERIFIED",
  anchorKinds: ["TokenAccept", "JWTDecodeWithoutVerify"],
});

export const oauthStateInvariantRule = invariantRule({
  ruleId: "AS-AUTH-OAUTH-001",
  invariantId: "OAUTH_STATE_VALIDATED",
  anchorKinds: ["OAuthStateValidation", "OAuthCallback"],
});

export const oauthPkceInvariantRule = invariantRule({
  ruleId: "AS-AUTH-OAUTH-002",
  invariantId: "PKCE_REQUIRED_WHERE_APPLICABLE",
  anchorKinds: ["AuthorizationCodeExchange"],
});

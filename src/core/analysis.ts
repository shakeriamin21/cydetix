import { z } from "zod";

export const analysisCompletenessSchema = z.enum([
  "COMPLETE",
  "PARTIAL",
  "UNSUPPORTED",
  "TRUNCATED",
]);

export type AnalysisCompleteness = z.infer<typeof analysisCompletenessSchema>;

export const remediationReasonCodeSchema = z.enum([
  "EXACT_LOCAL_TRANSFORM",
  "DYNAMIC_EXPRESSION",
  "AMBIGUOUS_SEMANTICS",
  "BUSINESS_POLICY_REQUIRED",
  "AUTHORIZATION_POLICY_REQUIRED",
  "SCHEMA_CHANGE_REQUIRED",
  "CROSS_MODULE_UNCERTAINTY",
  "UNSUPPORTED_FRAMEWORK_PATTERN",
  "INSUFFICIENT_DATAFLOW_PROOF",
  "SANITIZER_UNKNOWN",
  "VERIFICATION_INSUFFICIENT",
  "MULTI_FILE_SEMANTIC_CHANGE",
  "ARCHITECTURE_CHANGE_REQUIRED",
]);

export type RemediationReasonCode = z.infer<typeof remediationReasonCodeSchema>;

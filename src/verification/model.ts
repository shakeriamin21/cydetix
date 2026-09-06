import { z } from "zod";

export const verificationRunnerSchemaVersion = "1.0.0" as const;

export const verificationRunnerKindSchema = z.enum([
  "NO_EXECUTION",
  "LOCAL_EXPLICIT",
  "CONTAINER_SANDBOX",
]);

export const sandboxCapabilityStateSchema = z.enum([
  "AVAILABLE_HARDENED",
  "AVAILABLE_DEGRADED",
  "UNAVAILABLE",
  "MISCONFIGURED",
]);

export const verificationExecutionStateSchema = z.enum([
  "NOT_RUN",
  "SUCCEEDED",
  "COMMAND_FAILED",
  "TIMED_OUT",
  "OUTPUT_LIMIT_EXCEEDED",
  "SANDBOX_UNAVAILABLE",
  "SANDBOX_MISCONFIGURED",
  "WORKSPACE_FAILED",
]);

export const networkPolicySchema = z.enum(["DENIED", "ALLOWED_EXPLICIT"]);

export const verificationCommandSchema = z
  .object({
    executable: z.string().min(1).max(1024),
    arguments: z.array(z.string().max(32_768)).max(256),
    workingDirectory: z.string().min(1).max(4096).default("."),
    timeoutMilliseconds: z.number().int().positive().max(120_000).default(30_000),
    networkPolicy: networkPolicySchema.default("DENIED"),
  })
  .strict();

export const sandboxControlsSchema = z
  .object({
    network: z.enum(["DENIED", "ALLOWED_EXPLICIT", "NOT_ISOLATED"]),
    environment: z.enum(["SANITIZED", "HOST_INHERITED"]),
    workspace: z.enum(["EPHEMERAL_COPY", "PRIMARY_REPOSITORY"]),
    containerRoot: z.enum(["READ_ONLY", "WRITABLE", "NOT_APPLICABLE"]),
    dockerSocketMounted: z.boolean(),
    sshAgentMounted: z.boolean(),
    privileged: z.boolean(),
    nonRoot: z.boolean(),
    noNewPrivileges: z.boolean(),
    capabilitiesDropped: z.boolean(),
    seccomp: z.enum(["RUNTIME_DEFAULT", "CUSTOM", "UNAVAILABLE", "NOT_APPLICABLE"]),
    memoryMegabytes: z.number().int().positive().optional(),
    cpuCount: z.number().positive().optional(),
    pidLimit: z.number().int().positive().optional(),
    outputBytes: z.number().int().positive(),
    timeoutMilliseconds: z.number().int().positive(),
  })
  .strict();

export const sandboxCapabilitySchema = z
  .object({
    schemaVersion: z.literal(verificationRunnerSchemaVersion),
    runner: verificationRunnerKindSchema,
    state: sandboxCapabilityStateSchema,
    runtime: z.string().min(1),
    runtimeVersion: z.string().max(256).optional(),
    imageIdentity: z.string().max(512).optional(),
    controls: sandboxControlsSchema,
    limitations: z.array(z.string().min(1)),
  })
  .strict();

export const verificationExecutionResultSchema = z
  .object({
    schemaVersion: z.literal(verificationRunnerSchemaVersion),
    runner: verificationRunnerKindSchema,
    state: verificationExecutionStateSchema,
    commandFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    exitCode: z.number().int().nullable(),
    durationMilliseconds: z.number().nonnegative(),
    stdoutBytes: z.number().int().nonnegative(),
    stderrBytes: z.number().int().nonnegative(),
    outputTruncated: z.boolean(),
    capability: sandboxCapabilitySchema,
    message: z.string().min(1),
  })
  .strict();

export type VerificationCommand = z.infer<typeof verificationCommandSchema>;
export type SandboxControls = z.infer<typeof sandboxControlsSchema>;
export type SandboxCapability = z.infer<typeof sandboxCapabilitySchema>;
export type VerificationExecutionResult = z.infer<typeof verificationExecutionResultSchema>;

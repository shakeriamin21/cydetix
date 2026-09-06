import { spawnSync } from "node:child_process";
import { z } from "zod";
export const externalToolStatusSchema = z.enum([
    "NOT_REQUESTED",
    "AVAILABLE",
    "UNAVAILABLE",
    "TIMED_OUT",
    "FAILED",
    "INVALID_OUTPUT",
]);
export const externalToolCapabilitySchema = z
    .object({
    adapter: z.string().min(1),
    executable: z.string().min(1),
    status: externalToolStatusSchema,
    version: z.string().min(1).optional(),
    message: z.string().min(1),
})
    .strict();
export function probeExternalTool(adapter, executable, versionArguments = ["--version"]) {
    const result = spawnSync(executable, [...versionArguments], {
        shell: false,
        windowsHide: true,
        encoding: "utf8",
        timeout: 3_000,
        maxBuffer: 64 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
            PATH: process.env.PATH,
            SystemRoot: process.env.SystemRoot,
            PATHEXT: process.env.PATHEXT,
            TEMP: process.env.TEMP,
            TMP: process.env.TMP,
            NO_COLOR: "1",
        },
    });
    if (result.error !== undefined && "code" in result.error && result.error.code === "ENOENT") {
        return externalToolCapabilitySchema.parse({
            adapter,
            executable,
            status: "UNAVAILABLE",
            message: "Optional external tool is not installed; the core scan remains available.",
        });
    }
    if (result.error !== undefined && "code" in result.error && result.error.code === "ETIMEDOUT") {
        return externalToolCapabilitySchema.parse({
            adapter,
            executable,
            status: "TIMED_OUT",
            message: "Optional external tool version probe exceeded the three-second bound.",
        });
    }
    if (result.status !== 0) {
        return externalToolCapabilitySchema.parse({
            adapter,
            executable,
            status: "FAILED",
            message: "Optional external tool version probe failed safely.",
        });
    }
    const version = `${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/u)[0]?.slice(0, 200);
    return externalToolCapabilitySchema.parse({
        adapter,
        executable,
        status: "AVAILABLE",
        ...(version === undefined || version === "" ? {} : { version }),
        message: "Optional external tool is available; it is not invoked by ordinary scans.",
    });
}
//# sourceMappingURL=model.js.map
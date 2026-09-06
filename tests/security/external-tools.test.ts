import { describe, expect, it } from "vitest";

import { probeExternalTool } from "../../src/external-tools/model.js";

describe("optional external-tool failure isolation", () => {
  it("contains crashes without exposing stderr", () => {
    const result = probeExternalTool("synthetic", process.execPath, [
      "-e",
      "process.stderr.write('repository-controlled garbage');process.exit(17)",
    ]);
    expect(result.status).toBe("FAILED");
    expect(result.message).not.toContain("repository-controlled garbage");
  });

  it("bounds excessive output", () => {
    const result = probeExternalTool("synthetic", process.execPath, [
      "-e",
      "process.stdout.write('x'.repeat(1000000))",
    ]);
    expect(result.status).toBe("FAILED");
    expect(result.version).toBeUndefined();
  });

  it("bounds a hanging process", () => {
    const started = performance.now();
    const result = probeExternalTool("synthetic", process.execPath, [
      "-e",
      "setInterval(()=>{},1000)",
    ]);
    expect(result.status).toBe("TIMED_OUT");
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it("does not inherit arbitrary host secrets", () => {
    process.env.CYDETIX_SYNTHETIC_HOST_SECRET = "synthetic-canary";
    try {
      const result = probeExternalTool("synthetic", process.execPath, [
        "-e",
        "process.exit(process.env.CYDETIX_SYNTHETIC_HOST_SECRET===undefined?0:18)",
      ]);
      expect(result.status).toBe("AVAILABLE");
    } finally {
      delete process.env.CYDETIX_SYNTHETIC_HOST_SECRET;
    }
  });
});

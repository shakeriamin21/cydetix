import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const helper = (await import(
  pathToFileURL(path.resolve("scripts/official-sarif-schema.mjs")).href
)) as {
  verifyOfficialSarifSchema(bytes: Buffer): Buffer;
  downloadOfficialSarifSchema(
    fetchSchema: (url: string, options: RequestInit) => Promise<Response>,
  ): Promise<Buffer>;
  assertSarifValidationResult(
    result: { status: number | null; stdout?: string; stderr?: string; error?: Error },
    expectedErrorPrefix?: string,
  ): void;
  runSarifMultitoolWithTimeoutRetry<T>(
    spawnMultitool: (command: string, args: string[], options: object) => T,
    command: string,
    args: string[],
    options: object,
  ): { result: T; attempts: number };
};

describe("pinned official SARIF validation schema", () => {
  it("rejects zero-exit validation errors and distinguishes deliberate negative controls", () => {
    const result = {
      status: 0,
      stdout:
        "fixture.sarif(1,131): error JSON1019: invalid enum value.\nAnalysis completed successfully.",
    };
    expect(() => helper.assertSarifValidationResult(result)).toThrow("validation errors");
    expect(() => helper.assertSarifValidationResult(result, "JSON")).not.toThrow();
    expect(() => helper.assertSarifValidationResult(result, "SARIF")).toThrow(
      "expected validation error",
    );
    expect(() =>
      helper.assertSarifValidationResult({ status: 0, stdout: "Analysis completed successfully." }),
    ).not.toThrow();
  });
  it("does not treat a failed process or missing error as a successful negative control", () => {
    expect(() =>
      helper.assertSarifValidationResult({ status: null, error: new Error("timeout") }, "JSON"),
    ).toThrow("did not complete");
    expect(() =>
      helper.assertSarifValidationResult({ status: 1, stdout: "error JSON1019: failure" }, "JSON"),
    ).toThrow("did not complete");
    expect(() => helper.assertSarifValidationResult({ status: 0, stdout: "" }, "JSON")).toThrow(
      "expected validation error",
    );
  });
  it("retries one timeout and accepts only a completed retry", () => {
    const results = [
      { status: null, error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }) },
      { status: 0, stdout: "Analysis completed successfully.", stderr: "" },
    ];
    const calls: Array<{ command: string; args: string[]; options: object }> = [];
    const execution = helper.runSarifMultitoolWithTimeoutRetry(
      (command, args, options) => {
        calls.push({ command, args, options });
        const result = results.shift();
        if (result === undefined) throw new Error("Unexpected retry.");
        return result;
      },
      "multitool",
      ["validate", "fixture.sarif"],
      { timeout: 210_000 },
    );
    expect(execution.attempts).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual(calls[1]);
    expect(() => helper.assertSarifValidationResult(execution.result)).not.toThrow();
  });
  it("returns the final timeout as a hard failure after the bounded retry", () => {
    const timeout = () => ({
      status: null,
      error: Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }),
    });
    const execution = helper.runSarifMultitoolWithTimeoutRetry(
      timeout,
      "multitool",
      ["validate", "fixture.sarif"],
      { timeout: 210_000 },
    );
    expect(execution.attempts).toBe(2);
    expect(() => helper.assertSarifValidationResult(execution.result)).toThrow("did not complete");
  });
  it("does not retry non-timeout process failures", () => {
    let calls = 0;
    const execution = helper.runSarifMultitoolWithTimeoutRetry(
      () => {
        calls += 1;
        return { status: 1, error: Object.assign(new Error("spawn failed"), { code: "EACCES" }) };
      },
      "multitool",
      ["validate", "fixture.sarif"],
      { timeout: 210_000 },
    );
    expect(calls).toBe(1);
    expect(execution.attempts).toBe(1);
    expect(() => helper.assertSarifValidationResult(execution.result)).toThrow("did not complete");
  });
  it("rejects a permissive schema instead of trusting identity text", () => {
    expect(() =>
      helper.verifyOfficialSarifSchema(
        Buffer.from(
          JSON.stringify({
            id: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
            $schema: "http://json-schema.org/draft-04/schema#",
            additionalProperties: true,
          }),
        ),
      ),
    ).toThrow("checksum mismatch");
  });
  it("fails closed for unavailable schema downloads", async () => {
    await expect(
      helper.downloadOfficialSarifSchema((_url, options) => {
        expect(options.redirect).toBe("error");
        expect(options.signal).toBeDefined();
        return Promise.resolve(new Response("unavailable", { status: 503 }));
      }),
    ).rejects.toThrow("cannot be skipped");
  });
  it("bounds schema response bytes before accepting a payload", async () => {
    await expect(
      helper.downloadOfficialSarifSchema(() =>
        Promise.resolve(new Response(new Uint8Array(131_073))),
      ),
    ).rejects.toThrow("download bound");
  });
  it("rejects an HTTP-success body with substituted schema content", async () => {
    await expect(
      helper.downloadOfficialSarifSchema(() => Promise.resolve(new Response("{}"))),
    ).rejects.toThrow("checksum mismatch");
  });
});

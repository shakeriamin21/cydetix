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

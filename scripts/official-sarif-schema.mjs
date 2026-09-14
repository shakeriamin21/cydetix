import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

export const OFFICIAL_SARIF_SCHEMA_URL =
  "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json";
export const OFFICIAL_SARIF_SCHEMA_SHA256 =
  "c3b4bb2d6093897483348925aaa73af03b3e3f4bd4ca38cef26dcb4212a2682e";
const MAX_SCHEMA_BYTES = 131_072;
export const SARIF_MULTITOOL_MAX_ATTEMPTS = 2;

export function verifyOfficialSarifSchema(bytes) {
  if (
    bytes.length > MAX_SCHEMA_BYTES ||
    createHash("sha256").update(bytes).digest("hex") !== OFFICIAL_SARIF_SCHEMA_SHA256
  )
    throw new Error(
      "Official SARIF schema checksum mismatch; review upstream changes before updating the pin.",
    );
  const schema = JSON.parse(bytes.toString("utf8"));
  if (
    schema.id !== OFFICIAL_SARIF_SCHEMA_URL ||
    schema.$schema !== "http://json-schema.org/draft-04/schema#"
  )
    throw new Error("Official SARIF schema identity mismatch.");
  return bytes;
}

export async function downloadOfficialSarifSchema(fetchSchema = fetch) {
  const response = await fetchSchema(OFFICIAL_SARIF_SCHEMA_URL, {
    signal: AbortSignal.timeout(20_000),
    redirect: "error",
  });
  if (!response.ok || !response.body)
    throw new Error("Official SARIF schema download failed; validation cannot be skipped.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_SCHEMA_BYTES)
      throw new Error("Official SARIF schema exceeds its download bound.");
    chunks.push(chunk);
  }
  return verifyOfficialSarifSchema(Buffer.concat(chunks));
}

export function runSarifMultitoolWithTimeoutRetry(spawnMultitool, command, args, options) {
  for (let attempt = 1; attempt <= SARIF_MULTITOOL_MAX_ATTEMPTS; attempt += 1) {
    const result = spawnMultitool(command, args, options);
    if (result.error?.code !== "ETIMEDOUT" || attempt === SARIF_MULTITOOL_MAX_ATTEMPTS)
      return { result, attempts: attempt };
  }
  throw new Error("Unreachable SARIF Multitool retry state.");
}

export function assertSarifValidationResult(result, expectedErrorPrefix) {
  if (result.error || result.status !== 0)
    throw new Error(
      "Microsoft SARIF Multitool did not complete; a timeout or execution failure is not validation evidence.",
    );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const errors = [...output.matchAll(/\berror ([A-Z][A-Z0-9]*\d+):/giu)].map((match) => match[1]);
  if (expectedErrorPrefix === undefined) {
    if (errors.length > 0 || /\berror\b/iu.test(output))
      throw new Error(
        "Microsoft SARIF Multitool reported validation errors despite a successful process exit.",
      );
  } else if (
    !errors.some((code) => code.startsWith(expectedErrorPrefix)) ||
    errors.some((code) => !/^(?:JSON|SARIF)\d+$/u.test(code))
  ) {
    throw new Error(
      "Microsoft SARIF Multitool did not explicitly report the expected validation error.",
    );
  }
}

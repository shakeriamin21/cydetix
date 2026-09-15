import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const stableSchemas = [
  "scan-report.schema.json",
  "finding.schema.json",
  "rule.schema.json",
  "remediation-report.schema.json",
  "cyclonedx-1.7.schema.json",
];

function runNode(arguments_: string[]) {
  return spawnSync(process.execPath, arguments_, {
    cwd: path.resolve("."),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1_000_000,
  });
}

describe("package export boundary", () => {
  it("exports only the reviewed stable schemas and package metadata", async () => {
    const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
      exports: Record<string, string>;
    };
    expect(packageJson.exports).toEqual({
      ...Object.fromEntries(
        stableSchemas.map((name) => [`./schemas/${name}`, `./schemas/${name}`]),
      ),
      "./package.json": "./package.json",
    });
  });

  it("resolves stable JSON contracts from ESM and CommonJS", () => {
    const esm = runNode([
      "--input-type=module",
      "--eval",
      [
        'import scan from "cydetix/schemas/scan-report.schema.json" with { type: "json" };',
        'import metadata from "cydetix/package.json" with { type: "json" };',
        'if(scan.$id!=="https://cydetix.dev/schemas/v2/scan-report.schema.json")process.exit(21);',
        'if(metadata.name!=="cydetix")process.exit(22);',
      ].join(""),
    ]);
    expect(esm.status, esm.stderr).toBe(0);

    const commonJs = runNode([
      "--input-type=commonjs",
      "--eval",
      [
        'const scan=require("cydetix/schemas/scan-report.schema.json");',
        'const metadata=require("cydetix/package.json");',
        'if(scan.$id!=="https://cydetix.dev/schemas/v2/scan-report.schema.json")process.exit(21);',
        'if(metadata.name!=="cydetix")process.exit(22);',
      ].join(""),
    ]);
    expect(commonJs.status, commonJs.stderr).toBe(0);
  });

  it.each([
    "cydetix",
    "cydetix/dist/core/engine.js",
    "cydetix/dist/mcp/server.js",
    "cydetix/schemas/security-ir.schema.json",
  ])("rejects unsupported package import %s in ESM and CommonJS", (specifier) => {
    const esm = runNode([
      "--input-type=module",
      "--eval",
      `import(${JSON.stringify(specifier)}).then(()=>process.exit(20),error=>process.exit(error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED'?0:21));`,
    ]);
    expect(esm.status, esm.stderr).toBe(0);

    const commonJs = runNode([
      "--input-type=commonjs",
      "--eval",
      `try{require(${JSON.stringify(specifier)});process.exit(20)}catch(error){process.exit(error.code==='ERR_PACKAGE_PATH_NOT_EXPORTED'?0:21)}`,
    ]);
    expect(commonJs.status, commonJs.stderr).toBe(0);
  });
});

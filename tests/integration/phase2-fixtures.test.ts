import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { renderJson } from "../../src/reporting/json.js";
import { toSarif } from "../../src/reporting/sarif.js";

const fixture = (name: string): string =>
  path.resolve("fixtures", "phase2", "express-prisma", name);

describe("Phase 2 cross-file fixture corpus", () => {
  it("distinguishes vulnerable and secure object-level authorization across four files", async () => {
    const vulnerable = await scanRepository({ path: fixture("idor-vulnerable") });
    const secure = await scanRepository({ path: fixture("idor-secure") });
    expect(vulnerable.findings.map((finding) => finding.ruleId)).toEqual(["AS-AUTHZ-001"]);
    expect(secure.findings).toEqual([]);
    expect(
      secure.securityAnalysis.authorizationProofs.find(
        (proof) => proof.invariant === "object-authorization",
      )?.state,
    ).toBe("PROVEN");

    const evidencePaths = new Set(
      vulnerable.findings[0]?.evidencePath?.map((step) => step.location.path),
    );
    expect(evidencePaths).toEqual(
      new Set(["src/routes.ts", "src/controller.ts", "src/service.ts", "src/repository.ts"]),
    );
  });

  it("distinguishes request-controlled and authenticated tenant scope", async () => {
    const vulnerable = await scanRepository({ path: fixture("tenant-vulnerable") });
    const secure = await scanRepository({ path: fixture("tenant-secure") });
    expect(vulnerable.findings.map((finding) => finding.ruleId)).toEqual(["AS-TENANT-001"]);
    expect(secure.findings).toEqual([]);
    const vulnerableSelector =
      vulnerable.securityAnalysis.securityIr.resourceOperations[0]?.selectors.find(
        (selector) => selector.field === "tenantId",
      );
    const secureSelector = secure.securityAnalysis.securityIr.resourceOperations[0]?.selectors.find(
      (selector) => selector.field === "tenantId",
    );
    expect(vulnerableSelector?.trust).toBe("attacker-controlled");
    expect(secureSelector?.trust).toBe("trusted-authenticated");
  });

  it("does not flag mixed route reachability, dynamic dispatch, or a constant list filter", async () => {
    const report = await scanRepository({ path: fixture("false-positive-traps") });
    expect(report.findings).toEqual([]);
    expect(
      report.securityAnalysis.authorizationProofs.every((proof) => proof.state === "UNKNOWN"),
    ).toBe(true);
    expect(
      report.securityAnalysis.securityIr.routes.some(
        (route) => route.handlerSymbolId === undefined,
      ),
    ).toBe(true);
    expect(report.securityAnalysis.securityIr.limitations.join(" ")).toContain("runtime dispatch");
  });

  it("matches the Phase 2 normalized JSON and SARIF golden representations", async () => {
    const report = await scanRepository({ path: fixture("idor-vulnerable") });
    const jsonRoundTrip = JSON.parse(renderJson(report)) as typeof report;
    const finding = jsonRoundTrip.findings[0];
    const jsonProjection = {
      schemaVersion: jsonRoundTrip.schemaVersion,
      ruleIds: jsonRoundTrip.findings.map((item) => item.ruleId),
      modules: jsonRoundTrip.securityAnalysis.securityIr.modules.length,
      calls: jsonRoundTrip.securityAnalysis.securityIr.calls.length,
      identities: jsonRoundTrip.securityAnalysis.securityIr.identities.length,
      resourceOperations: jsonRoundTrip.securityAnalysis.securityIr.resourceOperations.length,
      proofStates: jsonRoundTrip.securityAnalysis.authorizationProofs
        .map((proof) => `${proof.invariant}:${proof.state}`)
        .sort(),
      evidenceKinds: finding?.evidencePath?.map((step) => step.kind),
      evidencePaths: finding?.evidencePath?.map((step) => step.location.path),
    };
    const expectedJson: unknown = JSON.parse(
      await readFile(path.resolve("fixtures", "golden", "phase2-idor-summary.json"), "utf8"),
    );
    expect(jsonProjection).toEqual(expectedJson);

    const sarif = toSarif(report) as unknown as {
      version: string;
      runs: Array<{
        results: Array<{
          ruleId: string;
          locations: Array<{ physicalLocation: { artifactLocation: { uri: string } } }>;
          codeFlows: Array<{
            threadFlows: Array<{
              locations: Array<{
                location: { physicalLocation: { artifactLocation: { uri: string } } };
              }>;
            }>;
          }>;
          properties: { evidencePathLength: number };
        }>;
      }>;
    };
    const result = sarif.runs[0]?.results[0];
    const sarifProjection = {
      version: sarif.version,
      ruleId: result?.ruleId,
      resultPath: result?.locations[0]?.physicalLocation.artifactLocation.uri,
      codeFlowPaths: result?.codeFlows[0]?.threadFlows[0]?.locations.map(
        (item) => item.location.physicalLocation.artifactLocation.uri,
      ),
      evidencePathLength: result?.properties.evidencePathLength,
    };
    const expectedSarif: unknown = JSON.parse(
      await readFile(path.resolve("fixtures", "golden", "phase2-idor-sarif.json"), "utf8"),
    );
    expect(sarifProjection).toEqual(expectedSarif);
  });
});

import path from "node:path";

import { describe, expect, it } from "vitest";

import { scanRepository } from "../../src/core/engine.js";
import { analyzeAdvisories, OsvAdvisoryProvider } from "../../src/supply-chain/advisories.js";

describe("online advisory provider failure isolation", () => {
  it("never converts HTTP, DNS, TLS, malformed, rate-limit, or partial failures into a clean result", async () => {
    const scan = await scanRepository({ path: path.resolve("fixtures", "phase4", "sbom") });
    const packages = scan.securityAnalysis.supplyChainAnalysis?.inventory.packages.slice(0, 1);
    if (packages === undefined || packages.length === 0)
      throw new Error("Expected package fixture.");
    const fetches: Array<[string, typeof fetch]> = [
      ["http-500", () => Promise.resolve(new Response("failure", { status: 500 }))],
      ["rate-limit", () => Promise.resolve(new Response("limited", { status: 429 }))],
      ["malformed-json", () => Promise.resolve(new Response("not-json", { status: 200 }))],
      [
        "malformed-shape",
        () => Promise.resolve(new Response(JSON.stringify({ resultz: [] }), { status: 200 })),
      ],
      [
        "partial-batch",
        () => Promise.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 })),
      ],
      [
        "dns",
        () =>
          Promise.reject(Object.assign(new Error("synthetic DNS failure"), { code: "ENOTFOUND" })),
      ],
      [
        "tls",
        () =>
          Promise.reject(
            Object.assign(new Error("synthetic TLS failure"), { code: "CERT_HAS_EXPIRED" }),
          ),
      ],
    ];
    for (const [name, fetchImplementation] of fetches) {
      const result = await analyzeAdvisories(packages, {
        mode: "online",
        provider: new OsvAdvisoryProvider(fetchImplementation, 50),
      });
      expect(result.state, name).toBe("PROVIDER_UNAVAILABLE");
      expect(result.advisories, name).toEqual([]);
    }
  });

  it("bounds a provider timeout and reports unavailable", async () => {
    const scan = await scanRepository({ path: path.resolve("fixtures", "phase4", "sbom") });
    const packages = scan.securityAnalysis.supplyChainAnalysis?.inventory.packages.slice(0, 1);
    if (packages === undefined || packages.length === 0)
      throw new Error("Expected package fixture.");
    const hangingFetch: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const started = performance.now();
    const result = await analyzeAdvisories(packages, {
      mode: "online",
      provider: new OsvAdvisoryProvider(hangingFetch, 25),
    });
    expect(result.state).toBe("PROVIDER_UNAVAILABLE");
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";
import { cycloneDx17Schema, generateCycloneDxSbom } from "../dist/supply-chain/sbom.js";

for (const target of [path.resolve("fixtures", "phase4", "sbom"), path.resolve(".")]) {
  const report = await scanRepository({ path: target });
  const inventory = report.securityAnalysis.supplyChainAnalysis?.inventory;
  if (inventory === undefined) throw new Error(`Dependency inventory unavailable for ${target}.`);
  const bom = cycloneDx17Schema.parse(generateCycloneDxSbom(inventory));
  if (bom.bomFormat !== "CycloneDX" || bom.specVersion !== "1.7") {
    throw new Error(`Unexpected SBOM format for ${target}.`);
  }
  const serialized = JSON.stringify(bom);
  if (/INVARIANTSEC_TEST_SECRET_|-----BEGIN .*PRIVATE KEY-----/u.test(serialized)) {
    throw new Error(`Secret material appeared in SBOM output for ${target}.`);
  }
}

process.stdout.write(
  "Validated CycloneDX 1.7 SBOM output for the fixture and VibeShield inventory.\n",
);

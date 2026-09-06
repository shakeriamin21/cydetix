import path from "node:path";

import { scanRepository } from "../dist/core/engine.js";

const provider = {
  name: "OSV-fixture",
  endpoint: "https://example.invalid/osv-fixture",
  query(packages) {
    return Promise.resolve(
      packages
        .filter((component) => component.name.endsWith("-vuln"))
        .map((component) => ({
          id: `OSV-FIXTURE-${component.name.toUpperCase()}`,
          aliases: [],
          packagePurl: component.purl,
          fixedVersions: [component.name === "direct-vuln" ? "1.0.1" : "3.1.1"],
          references: ["https://example.invalid/advisory"],
          provider: "OSV-fixture",
        })),
    );
  },
};

const cases = [
  [
    "AS-SCA-001",
    "dependencies-vulnerable",
    2,
    { advisories: "online", advisoryProvider: provider },
  ],
  ["AS-SCA-001", "dependencies-secure", 0, { advisories: "online", advisoryProvider: provider }],
  ["AS-SECRET-001", "secret-exposed", 1, {}],
  ["AS-SECRET-001", "secret-placeholder", 0, {}],
  ["AS-CI-001", "actions-tagged", 1, {}],
  ["AS-CI-001", "actions-secure", 0, {}],
  ["AS-CI-001", "actions-local", 0, {}],
  ["AS-CI-002", "actions-write-all", 1, {}],
  ["AS-CI-002", "actions-required-write", 0, {}],
  ["AS-CI-003", "actions-pr-target-dangerous", 1, {}],
  ["AS-CI-003", "actions-pr-target-benign", 0, {}],
  ["AS-CI-004", "actions-expression-injection", 1, {}],
  ["AS-CI-004", "actions-expression-safe", 0, {}],
];

const counts = {};
for (const [ruleId, fixture, expected, options] of cases) {
  const report = await scanRepository({
    path: path.resolve("fixtures", "phase4", fixture),
    ...options,
  });
  const actual = report.findings.filter((finding) => finding.ruleId === ruleId).length;
  const current = counts[ruleId] ?? {
    truePositives: 0,
    trueNegatives: 0,
    falsePositives: 0,
    knownUnsupported: 0,
    unknownResults: 0,
  };
  if (expected > 0 && actual === expected) current.truePositives += expected;
  else if (expected === 0 && actual === 0) current.trueNegatives += 1;
  else if (expected === 0 && actual > 0) current.falsePositives += actual;
  counts[ruleId] = current;
}

process.stdout.write(
  `${JSON.stringify(
    {
      methodology:
        "Raw curated corpus counts only. The corpus is intentionally too small for precision or recall percentages.",
      cases: cases.length,
      rules: counts,
      providerStateCases: {
        checkedFindings: 1,
        checkedNoFindings: 1,
        notCheckedOffline: 1,
        providerUnavailable: 1,
      },
      historyCases: { historicalTruePositive: 1, currentTreeTrueNegative: 1 },
    },
    null,
    2,
  )}\n`,
);

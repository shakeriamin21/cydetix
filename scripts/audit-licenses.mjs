import { readFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(".");
const lock = JSON.parse(await readFile(path.join(root, "package-lock.json"), "utf8"));
const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const licenseText = await readFile(path.join(root, "LICENSE"), "utf8");
const notice = await readFile(path.join(root, "NOTICE"), "utf8");
const issues = [];
const counts = new Map();
let platformOptionalDependenciesNotInstalled = 0;

for (const location of Object.keys(lock.packages ?? {}).sort()) {
  if (!location.startsWith("node_modules/")) continue;
  const manifestPath = path.join(root, location, "package.json");
  const manifest = await readFile(manifestPath, "utf8")
    .then(JSON.parse)
    .catch(() => undefined);
  if (manifest === undefined) {
    if (lock.packages[location]?.optional === true) {
      platformOptionalDependenciesNotInstalled += 1;
      continue;
    }
    issues.push({ code: "DEPENDENCY_MANIFEST_MISSING", package: location });
    continue;
  }
  const license = typeof manifest.license === "string" ? manifest.license : "UNSET";
  counts.set(license, (counts.get(license) ?? 0) + 1);
  if (/\b(?:AGPL|BUSL|GPL|LGPL|SSPL|UNLICENSED)\b|SEE LICEN[CS]E/iu.test(license))
    issues.push({
      code: "LICENSE_REQUIRES_REVIEW",
      package: `${manifest.name}@${manifest.version}`,
      license,
    });
  if (license === "UNSET")
    issues.push({ code: "LICENSE_UNSET", package: `${manifest.name}@${manifest.version}` });
}

if (packageJson.license !== "Apache-2.0") issues.push({ code: "PACKAGE_LICENSE_MISMATCH" });
if (!licenseText.includes("Apache License") || !licenseText.includes("Version 2.0"))
  issues.push({ code: "LICENSE_FILE_MISMATCH" });
if (!notice.includes("Copyright 2026") || !notice.includes("third-party software"))
  issues.push({ code: "NOTICE_FILE_INCOMPLETE" });

const result = {
  schemaVersion: "1.0.0",
  state: issues.length === 0 ? "PASS" : "FAIL",
  dependenciesReviewed: [...counts.values()].reduce((sum, count) => sum + count, 0),
  platformOptionalDependenciesNotInstalled,
  licenseCounts: Object.fromEntries(
    [...counts].sort(([left], [right]) => left.localeCompare(right)),
  ),
  packageLicense: packageJson.license,
  bundledDependencies: false,
  issues,
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (issues.length > 0) process.exitCode = 1;

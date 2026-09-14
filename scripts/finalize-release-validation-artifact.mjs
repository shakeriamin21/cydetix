import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { versionedReleaseReportPath } from "../dist/validation/release-evidence.js";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const source = path.resolve(versionedReleaseReportPath(packageJson.version));
const releaseDirectory = path.resolve(
  process.env.CYDETIX_RELEASE_DIR ?? path.join(".cydetix", "release"),
);
const destination = path.join(releaseDirectory, "cydetix-validation-report.json");
const manifestPath = path.join(releaseDirectory, "release-inputs.json");
const content = await readFile(source);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
await writeFile(destination, content);
const artifact = {
  artifact: path.basename(destination),
  sha256: createHash("sha256").update(content).digest("hex"),
  bytes: content.length,
};
manifest.artifacts = [
  ...manifest.artifacts.filter((item) => item.artifact !== artifact.artifact),
  artifact,
];
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify(artifact, null, 2)}\n`);

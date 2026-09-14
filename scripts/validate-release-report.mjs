import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  assessReleaseTagIntegrity,
  readVersionedReleaseReport,
  releaseHistorySchema,
  validateCurrentReleaseReport,
  versionedReleaseReportPath,
} from "../dist/validation/release-evidence.js";

const root = path.resolve(".");

function git(arguments_, { allowFailure = false } = {}) {
  const result = spawnSync(
    "git",
    ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, ...arguments_],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 1_000_000,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        PATHEXT: process.env.PATHEXT,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
      },
    },
  );
  if (result.error !== undefined || (!allowFailure && result.status !== 0))
    throw new Error(`Release report source check failed while running git ${arguments_[0] ?? ""}.`);
  return result.status === 0 ? result.stdout.trim() : null;
}

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const reportPath = versionedReleaseReportPath(packageJson.version);
const reportInput = await readVersionedReleaseReport(root, packageJson.version);

const head = git(["rev-parse", "HEAD"]);
const parent = git(["rev-parse", "HEAD^"], { allowFailure: true });
const changedFromParent =
  parent === null
    ? []
    : git(["diff", "--name-only", `${parent}..${head}`])
        .split("\n")
        .filter(Boolean);
const reportTrackedClean = git(["status", "--porcelain", "--", reportPath]) === "";
const report = validateCurrentReleaseReport(
  reportInput,
  { name: packageJson.name, version: packageJson.version },
  { head, parent, changedFromParent, reportTrackedClean },
);
const history = releaseHistorySchema.parse(
  JSON.parse(await readFile("validation/releases/release-history.json", "utf8")),
);
const observedTags = git(["tag", "--list", "v*"])
  .split("\n")
  .filter(Boolean)
  .map((tag) => ({
    tag,
    type: git(["cat-file", "-t", `refs/tags/${tag}`]),
    object: git(["rev-parse", `refs/tags/${tag}`]),
    target: git(["rev-parse", `refs/tags/${tag}^{}`]),
  }));
const expectedCurrentTag =
  process.env.CYDETIX_EXPECTED_TAG ??
  (process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : undefined);
const tagIntegrity = assessReleaseTagIntegrity(history, observedTags, {
  currentVersion: packageJson.version,
  currentHead: head,
  ...(expectedCurrentTag === undefined ? {} : { expectedCurrentTag }),
});
if (tagIntegrity.state !== "PASS")
  throw new Error(`Release tag integrity failed: ${tagIntegrity.issues.join(" ")}`);
process.stdout.write(
  `Validated release evidence for ${report.product.version}: ${report.verdict}; source ${report.product.publicSourceCommit}; ${tagIntegrity.historicalTagsVerified} historical tags verified.\n`,
);

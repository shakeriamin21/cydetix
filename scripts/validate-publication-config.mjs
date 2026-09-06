import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const plugin = JSON.parse(await readFile("plugins/cydetix/.codex-plugin/plugin.json", "utf8"));
const publication = JSON.parse(await readFile("release/publication-config.json", "utf8"));

const errors = [];
if (publication.decision !== "APPROVED") errors.push("public identity has not been approved");
if (publication.productName === null) errors.push("public product name is unset");
if (publication.npmPackageName !== packageJson.name) errors.push("npm package identity mismatches");
if (publication.npmPackageName !== "cydetix" || publication.npmPackageName.includes("/"))
  errors.push("the exact unscoped cydetix package identity is not approved");
if (publication.cliCommand !== "cydetix") errors.push("primary CLI identity mismatches");
if (publication.nameMarketConflict !== "REVIEWED_AND_EXPLICITLY_APPROVED")
  errors.push("formal Cydetix name and legal review has not been explicitly approved");
if (publication.version !== packageJson.version) errors.push("publication version mismatches");
if (publication.tagCandidate !== `v${packageJson.version}`) errors.push("tag candidate mismatches");
if (publication.npmDistTag !== "alpha") errors.push("first alpha must use the alpha dist-tag");
if (publication.npmPackageRegistration !== "EXISTS")
  errors.push("approved npm package registration is not confirmed to exist");
if (publication.npmTrustedPublisher !== "CONFIGURED")
  errors.push("npm trusted publisher is not confirmed configured");
if (publication.githubEnvironment !== "release") errors.push("release environment mismatches");
if (publication.privateVulnerabilityReporting !== "ENABLED")
  errors.push("private vulnerability reporting is not confirmed enabled");
if (!/^[^/]+\/[^/]+$/u.test(publication.githubRepository ?? ""))
  errors.push("GitHub owner/repository is unset");
const repositoryUrl = `git+https://github.com/${publication.githubRepository}.git`;
if (packageJson.repository?.url !== repositoryUrl)
  errors.push("package repository URL does not exactly match the approved GitHub repository");
if (plugin.version !== packageJson.version) errors.push("plugin version mismatches");

if (errors.length > 0)
  throw new Error(`Publication configuration is not approved: ${errors.join("; ")}.`);
process.stdout.write(
  `Validated approved publication identity ${publication.productName} ${publication.version}.\n`,
);

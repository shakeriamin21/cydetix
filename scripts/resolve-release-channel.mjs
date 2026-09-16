import { readFile } from "node:fs/promises";

import {
  githubReleaseIsPrereleaseForVersion,
  npmReleaseChannelForVersion,
} from "../dist/validation/release-channel.js";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const output = process.argv[2] ?? "--npm-dist-tag";
if (process.argv.length > 3) throw new Error("Expected at most one release-semantics selector.");
if (output === "--npm-dist-tag")
  process.stdout.write(`${npmReleaseChannelForVersion(packageJson.version)}\n`);
else if (output === "--github-prerelease")
  process.stdout.write(`${String(githubReleaseIsPrereleaseForVersion(packageJson.version))}\n`);
else throw new Error(`Unsupported release-semantics selector: ${output}.`);

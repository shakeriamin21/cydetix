import { readFile } from "node:fs/promises";

import { npmReleaseChannelForVersion } from "../dist/validation/release-channel.js";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
process.stdout.write(`${npmReleaseChannelForVersion(packageJson.version)}\n`);

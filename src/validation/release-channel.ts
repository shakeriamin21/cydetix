export type NpmReleaseChannel = "alpha" | "beta" | "latest";

const coreVersion = "(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)";
const stableVersionPattern = new RegExp(`^${coreVersion}$`, "u");
const prereleaseVersionPattern = new RegExp(
  `^${coreVersion}-(alpha|beta)\\.(?:0|[1-9][0-9]*)$`,
  "u",
);

export function npmReleaseChannelForVersion(version: string): NpmReleaseChannel {
  if (stableVersionPattern.test(version)) return "latest";
  const prerelease = prereleaseVersionPattern.exec(version);
  if (prerelease?.[1] === "alpha" || prerelease?.[1] === "beta") return prerelease[1];
  throw new Error(`Unsupported or malformed release version: ${version}.`);
}

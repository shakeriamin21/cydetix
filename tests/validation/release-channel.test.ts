import { describe, expect, it } from "vitest";

import {
  githubReleaseIsPrereleaseForVersion,
  npmReleaseChannelForVersion,
} from "../../src/validation/release-channel.js";

describe("trusted npm release channel", () => {
  it.each([
    ["1.2.3-alpha.4", "alpha"],
    ["1.2.3-beta.4", "beta"],
    ["1.0.0", "latest"],
    ["1.2.3", "latest"],
  ] as const)("maps %s to %s", (version, channel) => {
    expect(npmReleaseChannelForVersion(version)).toBe(channel);
  });

  it.each(["1.2.3-rc.1", "1.2.3-preview.1", "1.2.3-alpha"])(
    "rejects unsupported prerelease %s",
    (version) => {
      expect(() => npmReleaseChannelForVersion(version)).toThrow(
        "Unsupported or malformed release version",
      );
    },
  );

  it.each(["not-a-version", "1.2", "01.2.3", "1.2.3-beta.01", "1.2.3+build"])(
    "rejects malformed version %s",
    (version) => {
      expect(() => npmReleaseChannelForVersion(version)).toThrow(
        "Unsupported or malformed release version",
      );
    },
  );
});

describe("trusted GitHub release state", () => {
  it.each([
    ["1.0.0", false],
    ["1.2.3-alpha.4", true],
    ["1.2.3-beta.4", true],
  ] as const)("maps %s prerelease state to %s", (version, prerelease) => {
    expect(githubReleaseIsPrereleaseForVersion(version)).toBe(prerelease);
  });

  it.each(["1.0.0-rc.1", "1.0", "01.0.0", "1.0.0+build"])(
    "rejects unsupported or malformed version %s",
    (version) => {
      expect(() => githubReleaseIsPrereleaseForVersion(version)).toThrow(
        "Unsupported or malformed release version",
      );
    },
  );
});

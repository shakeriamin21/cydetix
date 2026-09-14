import { describe, expect, it } from "vitest";

import { npmReleaseChannelForVersion } from "../../src/validation/release-channel.js";

describe("trusted npm release channel", () => {
  it.each([
    ["1.2.3-alpha.4", "alpha"],
    ["1.2.3-beta.4", "beta"],
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

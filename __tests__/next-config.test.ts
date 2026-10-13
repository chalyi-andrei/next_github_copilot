// @vitest-environment node
import { matchRemotePattern } from "next/dist/shared/lib/match-remote-pattern";
import { describe, expect, it } from "vitest";
import { AVATAR_HOST } from "../app/statistics/github";
import nextConfig from "../next.config";

const patterns = nextConfig.images?.remotePatterns ?? [];

// Same matcher that next/image and the image optimizer use
function isAllowed(url: string): boolean {
  return patterns.some((pattern) => matchRemotePattern(pattern, new URL(url)));
}

describe("next.config images", () => {
  it("allows GitHub avatars together with their query string", () => {
    expect(isAllowed(`https://${AVATAR_HOST}/u/1234?v=4`)).toBe(true);
    expect(isAllowed(`https://${AVATAR_HOST}/u/1234`)).toBe(true);
  });

  it("rejects other protocols and hosts", () => {
    expect(isAllowed("http://avatars.githubusercontent.com/u/1?v=4")).toBe(
      false
    );
    expect(isAllowed("https://example.com/u/1?v=4")).toBe(false);
    expect(
      isAllowed("https://avatars.githubusercontent.com.evil.example/u/1?v=4")
    ).toBe(false);
  });

  it("declares the avatar host as a plain https pattern without a search key", () => {
    expect(patterns).toHaveLength(1);

    const [pattern] = patterns;
    expect(pattern).not.toBeInstanceOf(URL);
    expect(pattern).toMatchObject({ protocol: "https", hostname: AVATAR_HOST });
    expect(pattern).not.toHaveProperty("search");
  });
});

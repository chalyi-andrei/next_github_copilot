// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Resolve repo files relative to this test, independent of the cwd
const repoFile = (relativePath: string) =>
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url));

const hookPath = repoFile(".githooks/pre-commit");
const gitattributesPath = repoFile(".gitattributes");

describe(".githooks/pre-commit", () => {
  it("exists", () => {
    expect(existsSync(hookPath)).toBe(true);
  });

  it("uses LF line endings only", () => {
    const raw = readFileSync(hookPath, "utf8");

    expect(raw).not.toContain("\r");
  });

  it("starts with a POSIX sh shebang", () => {
    const [firstLine] = readFileSync(hookPath, "utf8").split("\n");

    expect(firstLine).toBe("#!/bin/sh");
  });

  it("runs the unit tests and aborts the commit on failure", () => {
    const content = readFileSync(hookPath, "utf8");

    expect(content).toContain("npm test");
    expect(content).toContain("exit 1");
  });

  it("documents the --no-verify bypass", () => {
    expect(readFileSync(hookPath, "utf8")).toContain("--no-verify");
  });
});

describe("package.json prepare script", () => {
  it("points git at .githooks and tolerates a missing git repo", () => {
    const pkg = JSON.parse(readFileSync(repoFile("package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    const prepare = pkg.scripts?.prepare ?? "";

    expect(prepare).toContain("core.hooksPath .githooks");
    expect(prepare).toContain("|| exit 0");
  });
});

describe(".gitattributes", () => {
  it("forces LF line endings for git hooks", () => {
    expect(existsSync(gitattributesPath)).toBe(true);
    expect(readFileSync(gitattributesPath, "utf8")).toMatch(
      /^\.githooks\/\*\s+.*eol=lf/m
    );
  });
});

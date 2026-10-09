// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

// Replace process-spawning APIs so an accidental side effect is detectable
// (and harmless) instead of starting real processes
vi.mock("node:child_process", () => ({
  spawn: vi.fn(() => {
    throw new Error("spawn must not be called");
  }),
  execFileSync: vi.fn(() => {
    throw new Error("execFileSync must not be called");
  }),
}));

describe("scripts/office.mjs entry point", () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.exitCode = originalExitCode;
  });

  it("has no side effects on import", async () => {
    const childProcess = await import("node:child_process");
    const fetchSpy = vi.mocked(globalThis.fetch);

    const office = await import("../scripts/office.mjs");

    expect(typeof office.main).toBe("function");
    expect(childProcess.spawn).not.toHaveBeenCalled();
    expect(childProcess.execFileSync).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(originalExitCode);
  });

  it("main prints usage and returns 0 for help", async () => {
    const { main } = await import("../scripts/office.mjs");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await expect(main(["help"])).resolves.toBe(0);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
    expect(process.exitCode).toBe(0);
  });

  it("main rejects an unknown argument with exit code 1", async () => {
    const { main } = await import("../scripts/office.mjs");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(main(["restart"])).resolves.toBe(1);

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Unknown argument: restart")
    );
    expect(process.exitCode).toBe(1);
  });
});

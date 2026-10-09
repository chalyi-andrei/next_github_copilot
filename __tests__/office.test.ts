// @vitest-environment node
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  buildServerCommand,
  buildUiCommand,
  getFindPidsCommand,
  getKillCommand,
  getOpenBrowserCommand,
  isServerHealthy,
  isUiUp,
  parseArgs,
  parseLsofPids,
  parseNetstatPids,
  resolveLogDir,
  resolveOfficeDir,
  spawnDetached,
  startOffice,
  stopOffice,
  validateOfficeDir,
  waitFor,
} from "../scripts/office.mjs";

const HOME = path.resolve("/home/tester");
const OFFICE_DIR = path.join(HOME, "Claude-Office");
const LOG_DIR = path.join(HOME, ".agent-office");
const SERVER_ENTRY = path.join(OFFICE_DIR, "server", "index.js");
const VITE_BIN = path.join(OFFICE_DIR, "node_modules", "vite", "bin", "vite.js");

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function response(status: number, body: unknown = {}): FakeResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function createFetch(state: { serverUp: boolean; uiUp: boolean }) {
  return vi.fn((url: string) => {
    if (url.includes(":3334/") && state.serverUp) {
      return Promise.resolve(response(200, { status: "ok" }));
    }
    if (url.includes(":3333/") && state.uiUp) {
      return Promise.resolve(response(200));
    }
    return Promise.reject(new Error("ECONNREFUSED"));
  });
}

type SpawnFn = (
  command: string,
  args: string[],
  options: Record<string, unknown>
) => ReturnType<typeof createChild>;

function createChild() {
  return { pid: 4242, unref: vi.fn(), on: vi.fn() };
}

function createFs() {
  return {
    mkdirSync: vi.fn(),
    openSync: vi.fn(() => 7),
    closeSync: vi.fn(),
  };
}

const existsAll = () => true;
const noSleep = async () => {};

describe("resolveOfficeDir", () => {
  it("uses CLAUDE_OFFICE_DIR and resolves relative paths", () => {
    expect(resolveOfficeDir({ CLAUDE_OFFICE_DIR: "  some/office  " }, HOME)).toBe(
      path.resolve("some/office")
    );
    expect(
      resolveOfficeDir({ CLAUDE_OFFICE_DIR: path.resolve("/opt/office") }, HOME)
    ).toBe(path.resolve("/opt/office"));
  });

  it("falls back to <home>/Claude-Office when the variable is unset or blank", () => {
    expect(resolveOfficeDir({}, HOME)).toBe(OFFICE_DIR);
    expect(resolveOfficeDir({ CLAUDE_OFFICE_DIR: "" }, HOME)).toBe(OFFICE_DIR);
    expect(resolveOfficeDir({ CLAUDE_OFFICE_DIR: "   " }, HOME)).toBe(OFFICE_DIR);
  });

  it("puts logs into <home>/.agent-office", () => {
    expect(resolveLogDir(HOME)).toBe(LOG_DIR);
  });
});

describe("validateOfficeDir", () => {
  it("returns null when the checkout is complete", () => {
    expect(validateOfficeDir(OFFICE_DIR, existsAll)).toBeNull();
  });

  it("reports a missing directory with setup instructions", () => {
    const message = validateOfficeDir(OFFICE_DIR, () => false);

    expect(message).toContain(OFFICE_DIR);
    expect(message).toContain("git clone https://github.com/W17ant/Claude-Office");
    expect(message).toContain("npm install");
    expect(message).toContain("CLAUDE_OFFICE_DIR");
  });

  it("reports a missing server entry", () => {
    const message = validateOfficeDir(
      OFFICE_DIR,
      (p: string) => p !== SERVER_ENTRY
    );

    expect(message).toContain(SERVER_ENTRY);
    expect(message).toContain("CLAUDE_OFFICE_DIR");
  });

  it("reports missing dependencies and suggests npm install", () => {
    const message = validateOfficeDir(OFFICE_DIR, (p: string) => p !== VITE_BIN);

    expect(message).toContain(VITE_BIN);
    expect(message).toContain("npm install");
    expect(message).toContain("CLAUDE_OFFICE_DIR");
  });
});

describe("process commands", () => {
  it("runs the server with node directly", () => {
    const spec = buildServerCommand(OFFICE_DIR);

    expect(spec).toEqual({
      command: process.execPath,
      args: [SERVER_ENTRY],
      cwd: OFFICE_DIR,
      logName: "server.log",
    });
  });

  it("runs Vite with node on a strict 127.0.0.1:3333", () => {
    const spec = buildUiCommand(OFFICE_DIR);

    expect(spec).toEqual({
      command: process.execPath,
      args: [VITE_BIN, "--port", "3333", "--host", "127.0.0.1", "--strictPort"],
      cwd: OFFICE_DIR,
      logName: "vite.log",
    });
  });

  it("never goes through npx or cmd", () => {
    for (const spec of [buildServerCommand(OFFICE_DIR), buildUiCommand(OFFICE_DIR)]) {
      const commandLine = [spec.command, ...spec.args].join(" ");
      expect(commandLine).not.toMatch(/\bnpx\b/);
      expect(commandLine).not.toMatch(/\bcmd(\.exe)?\b/);
    }
  });

  it("opens the browser with the platform opener", () => {
    const url = "http://localhost:3333";

    expect(getOpenBrowserCommand("win32", url)).toEqual({
      command: "rundll32",
      args: ["url.dll,FileProtocolHandler", url],
    });
    expect(getOpenBrowserCommand("darwin", url)).toEqual({
      command: "open",
      args: [url],
    });
    expect(getOpenBrowserCommand("linux", url)).toEqual({
      command: "xdg-open",
      args: [url],
    });
  });

  it("finds listeners with netstat on Windows and lsof elsewhere", () => {
    expect(getFindPidsCommand("win32", 3333).command).toBe("netstat");
    expect(getFindPidsCommand("darwin", 3333)).toEqual({
      command: "lsof",
      args: ["-nP", "-t", "-iTCP:3333", "-sTCP:LISTEN"],
    });
  });

  it("kills with taskkill on Windows and defers to process.kill elsewhere", () => {
    expect(getKillCommand("win32", 123)).toEqual({
      command: "taskkill",
      args: ["/PID", "123", "/T", "/F"],
    });
    expect(getKillCommand("linux", 123)).toBeNull();
    expect(getKillCommand("darwin", 123)).toBeNull();
  });
});

describe("parseNetstatPids", () => {
  const sample = [
    "",
    "Active Connections",
    "",
    "  Proto  Local Address          Foreign Address        State           PID",
    "  TCP    0.0.0.0:3333           0.0.0.0:0              LISTENING       1111",
    "  TCP    127.0.0.1:3333         127.0.0.1:51501        ESTABLISHED     2222",
    "  TCP    127.0.0.1:3333         127.0.0.1:49844        TIME_WAIT       0",
    "  TCP    127.0.0.1:33330        0.0.0.0:0              LISTENING       3333",
    "  TCP    127.0.0.1:13333        0.0.0.0:0              LISTENING       4444",
    "  TCP    127.0.0.1:3334         0.0.0.0:0              ПРОСЛУШИВАНИЕ   5555",
    "  TCP    127.0.0.1:51501        127.0.0.1:3333         ESTABLISHED     6666",
    "  TCP    [::]:3333              [::]:0                 LISTENING       1111",
    "  TCP    [::1]:3334             [::]:0                 LISTENING       7777",
    "  TCP    0.0.0.0:3334           0.0.0.0:0              LISTENING       0",
    "  UDP    0.0.0.0:3333           *:*                                    8888",
    "",
  ].join("\r\n");

  it("returns unique listening PIDs for the exact port", () => {
    expect(parseNetstatPids(sample, 3333)).toEqual([1111]);
  });

  it("accepts a localized state via the wildcard foreign address and skips PID 0", () => {
    expect(parseNetstatPids(sample, 3334)).toEqual([5555, 7777]);
  });

  it("returns an empty list for empty output", () => {
    expect(parseNetstatPids("", 3333)).toEqual([]);
  });
});

describe("parseLsofPids", () => {
  it("returns unique positive PIDs and ignores blank lines", () => {
    expect(parseLsofPids("123\n\n456\n123\n  \n0\nabc\n")).toEqual([123, 456]);
  });

  it("returns an empty list for empty output", () => {
    expect(parseLsofPids("")).toEqual([]);
  });
});

describe("parseArgs", () => {
  it("defaults to start with the browser", () => {
    expect(parseArgs([])).toEqual({ command: "start", open: true, unknown: null });
  });

  it("parses stop and --no-open", () => {
    expect(parseArgs(["stop"])).toMatchObject({ command: "stop" });
    expect(parseArgs(["start", "--no-open"])).toEqual({
      command: "start",
      open: false,
      unknown: null,
    });
    expect(parseArgs(["--no-open"])).toMatchObject({ command: "start", open: false });
  });

  it("maps help and unknown commands to help", () => {
    expect(parseArgs(["help"])).toEqual({ command: "help", open: true, unknown: null });
    expect(parseArgs(["restart"])).toEqual({
      command: "help",
      open: true,
      unknown: "restart",
    });
  });
});

describe("health checks", () => {
  it("treats the server as healthy only for ok + status ok", async () => {
    const healthy = vi.fn(() => Promise.resolve(response(200, { status: "ok" })));
    await expect(isServerHealthy(healthy)).resolves.toBe(true);
    expect(healthy).toHaveBeenCalledWith(
      "http://127.0.0.1:3334/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );

    await expect(
      isServerHealthy(() => Promise.resolve(response(500, { status: "ok" })))
    ).resolves.toBe(false);
    await expect(
      isServerHealthy(() => Promise.resolve(response(200, { status: "down" })))
    ).resolves.toBe(false);
    await expect(
      isServerHealthy(() => Promise.reject(new Error("ECONNREFUSED")))
    ).resolves.toBe(false);
  });

  it("uses the global fetch by default (blocked in tests)", async () => {
    await expect(isServerHealthy()).resolves.toBe(false);
  });

  it("treats the UI as up for any response below 500", async () => {
    const up = vi.fn(() => Promise.resolve(response(404)));
    await expect(isUiUp(up)).resolves.toBe(true);
    expect(up).toHaveBeenCalledWith("http://127.0.0.1:3333/", expect.anything());

    await expect(isUiUp(() => Promise.resolve(response(502)))).resolves.toBe(false);
    await expect(
      isUiUp(() => Promise.reject(new Error("ECONNREFUSED")))
    ).resolves.toBe(false);
  });
});

describe("waitFor", () => {
  it("resolves true once the check succeeds", async () => {
    let calls = 0;
    const check = vi.fn(async () => ++calls >= 3);
    const sleep = vi.fn(noSleep);

    await expect(
      waitFor(check, { timeoutMs: 10000, sleep, now: () => 0 })
    ).resolves.toBe(true);
    expect(check).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("resolves false after the timeout", async () => {
    let time = 0;
    const check = vi.fn(async () => false);

    await expect(
      waitFor(check, {
        timeoutMs: 2000,
        intervalMs: 500,
        sleep: noSleep,
        now: () => (time += 500),
      })
    ).resolves.toBe(false);
    expect(check.mock.calls.length).toBeGreaterThan(1);
  });
});

describe("spawnDetached", () => {
  it("spawns a detached hidden process with output appended to the log", () => {
    const child = createChild();
    const spawnFn = vi.fn<SpawnFn>(() => child);
    const fsImpl = createFs();
    const spec = buildServerCommand(OFFICE_DIR);

    const pid = spawnDetached(spec, LOG_DIR, { spawnFn, fsImpl });

    expect(pid).toBe(4242);
    expect(fsImpl.mkdirSync).toHaveBeenCalledWith(LOG_DIR, { recursive: true });
    expect(fsImpl.openSync).toHaveBeenCalledWith(path.join(LOG_DIR, "server.log"), "a");
    expect(spawnFn).toHaveBeenCalledWith(spec.command, spec.args, {
      cwd: OFFICE_DIR,
      detached: true,
      stdio: ["ignore", 7, 7],
      windowsHide: true,
    });
    expect(child.unref).toHaveBeenCalled();
    expect(fsImpl.closeSync).toHaveBeenCalledWith(7);
  });
});

describe("startOffice", () => {
  function setup(state: { serverUp: boolean; uiUp: boolean }) {
    const spawnFn = vi.fn<SpawnFn>((_command, args) => {
      if (args[0] === SERVER_ENTRY) state.serverUp = true;
      if (args[0] === VITE_BIN) state.uiUp = true;
      return createChild();
    });
    return {
      spawnFn,
      options: {
        dir: OFFICE_DIR,
        logDir: LOG_DIR,
        platform: "win32",
        fetchImpl: createFetch(state),
        spawnFn,
        existsFn: existsAll,
        fsImpl: createFs(),
        sleep: noSleep,
        now: () => 0,
        log: vi.fn(),
        logError: vi.fn(),
      },
    };
  }

  it("does not start anything when both services are already running", async () => {
    const { spawnFn, options } = setup({ serverUp: true, uiUp: true });

    await expect(startOffice({ ...options, open: false })).resolves.toBe(0);

    expect(spawnFn).not.toHaveBeenCalled();
    const output = options.log.mock.calls.map((call) => String(call[0])).join("\n");
    expect(output).toContain("server already running on 3334");
    expect(output).toContain("UI already running on 3333");
    expect(output).toContain("http://localhost:3333");
    expect(output).toContain("http://localhost:3334");
  });

  it("only opens the browser when requested", async () => {
    const { spawnFn, options } = setup({ serverUp: true, uiUp: true });

    await expect(startOffice({ ...options, open: true })).resolves.toBe(0);

    expect(spawnFn).toHaveBeenCalledTimes(1);
    expect(spawnFn).toHaveBeenCalledWith(
      "rundll32",
      ["url.dll,FileProtocolHandler", "http://localhost:3333"],
      expect.objectContaining({ detached: true, stdio: "ignore" })
    );
  });

  it("does not fail when the browser cannot be opened", async () => {
    const { options } = setup({ serverUp: true, uiUp: true });
    const spawnFn = vi.fn(() => {
      throw new Error("ENOENT");
    });

    await expect(startOffice({ ...options, spawnFn, open: true })).resolves.toBe(0);
    expect(options.logError).toHaveBeenCalledWith(
      expect.stringContaining("could not open the browser")
    );
  });

  it("starts the server and the UI as detached node processes", async () => {
    const { spawnFn, options } = setup({ serverUp: false, uiUp: false });

    await expect(startOffice({ ...options, open: false })).resolves.toBe(0);

    expect(spawnFn).toHaveBeenCalledTimes(2);
    const [serverCall, uiCall] = spawnFn.mock.calls;
    expect(serverCall[0]).toBe(process.execPath);
    expect(serverCall[1]).toEqual([SERVER_ENTRY]);
    expect(serverCall[2]).toMatchObject({
      cwd: OFFICE_DIR,
      detached: true,
      windowsHide: true,
    });
    expect(uiCall[0]).toBe(process.execPath);
    expect(uiCall[1]).toEqual([
      VITE_BIN,
      "--port",
      "3333",
      "--host",
      "127.0.0.1",
      "--strictPort",
    ]);
    expect(uiCall[2]).toMatchObject({ cwd: OFFICE_DIR, detached: true });
  });

  it("starts only the missing service", async () => {
    const { spawnFn, options } = setup({ serverUp: true, uiUp: false });

    await expect(startOffice({ ...options, open: false })).resolves.toBe(0);

    expect(spawnFn).toHaveBeenCalledTimes(1);
    expect(spawnFn.mock.calls[0][1][0]).toBe(VITE_BIN);
  });

  it("fails without spawning anything when the office dir is invalid", async () => {
    const { spawnFn, options } = setup({ serverUp: true, uiUp: true });

    await expect(
      startOffice({ ...options, existsFn: () => false, open: true })
    ).resolves.toBe(1);

    expect(spawnFn).not.toHaveBeenCalled();
    expect(options.fetchImpl).not.toHaveBeenCalled();
    expect(options.logError).toHaveBeenCalledWith(
      expect.stringContaining("CLAUDE_OFFICE_DIR")
    );
  });

  it("fails when a service does not become healthy in time", async () => {
    const { options } = setup({ serverUp: false, uiUp: false });
    const spawnFn = vi.fn(() => createChild());
    let time = 0;

    await expect(
      startOffice({
        ...options,
        spawnFn,
        open: false,
        now: () => (time += 1000),
      })
    ).resolves.toBe(1);

    expect(spawnFn).toHaveBeenCalledTimes(1);
    expect(options.logError).toHaveBeenCalledWith(
      expect.stringContaining(path.join(LOG_DIR, "server.log"))
    );
  });
});

describe("stopOffice", () => {
  const netstat = [
    "  TCP    127.0.0.1:3333         0.0.0.0:0              LISTENING       1111",
    "  TCP    127.0.0.1:3334         0.0.0.0:0              LISTENING       2222",
    "  TCP    127.0.0.1:3334         127.0.0.1:51347        ESTABLISHED     2222",
  ].join("\r\n");

  it("kills the listeners of both ports with taskkill on Windows", async () => {
    const execFn = vi.fn((command: string) =>
      command === "netstat" ? netstat : ""
    );
    const killFn = vi.fn();
    const log = vi.fn();

    await expect(
      stopOffice({ platform: "win32", execFn, killFn, log, logError: vi.fn() })
    ).resolves.toBe(0);

    expect(execFn).toHaveBeenCalledWith("taskkill", ["/PID", "1111", "/T", "/F"]);
    expect(execFn).toHaveBeenCalledWith("taskkill", ["/PID", "2222", "/T", "/F"]);
    expect(killFn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("stopped PID 1111 on port 3333"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("stopped PID 2222 on port 3334"));
  });

  it("uses process.kill semantics on POSIX", async () => {
    const execFn = vi.fn((_command: string, args: string[]) =>
      args.includes("-iTCP:3333") ? "1111\n" : "2222\n"
    );
    const killFn = vi.fn();

    await expect(
      stopOffice({ platform: "linux", execFn, killFn, log: vi.fn(), logError: vi.fn() })
    ).resolves.toBe(0);

    expect(killFn).toHaveBeenCalledWith(1111);
    expect(killFn).toHaveBeenCalledWith(2222);
  });

  it("reports nothing listening when the lookup finds nothing", async () => {
    const execFn = vi.fn(() => {
      throw new Error("lsof exited with code 1");
    });
    const killFn = vi.fn();
    const log = vi.fn();

    await expect(
      stopOffice({ platform: "darwin", execFn, killFn, log, logError: vi.fn() })
    ).resolves.toBe(0);

    expect(killFn).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("nothing listening on port 3333"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("nothing listening on port 3334"));
  });

  it("keeps going when a kill fails", async () => {
    const execFn = vi.fn((_command: string, args: string[]) =>
      args.includes("-iTCP:3333") ? "1111\n" : "2222\n"
    );
    const killFn = vi.fn((pid: number) => {
      if (pid === 1111) throw new Error("EPERM");
    });
    const logError = vi.fn();

    await expect(
      stopOffice({ platform: "linux", execFn, killFn, log: vi.fn(), logError })
    ).resolves.toBe(0);

    expect(killFn).toHaveBeenCalledWith(2222);
    expect(logError).toHaveBeenCalledWith(expect.stringContaining("PID 1111"));
  });
});

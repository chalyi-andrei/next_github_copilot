// Starts/stops the local Claude-Office agent visualizer
// (Express server on 127.0.0.1:3334 + Vite UI on 127.0.0.1:3333).
//
// Usage: node scripts/office.mjs [start|stop|help] [--no-open]
// Office checkout: $CLAUDE_OFFICE_DIR or ~/Claude-Office. Logs: ~/.agent-office/

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_PORT = 3334;
export const UI_PORT = 3333;
export const HOST = "127.0.0.1";
export const UI_URL = `http://localhost:${UI_PORT}`;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;

// Health checks use 127.0.0.1: Node may resolve "localhost" to ::1,
// while both services bind IPv4 only
const SERVER_HEALTH_URL = `http://${HOST}:${SERVER_PORT}/health`;
const UI_CHECK_URL = `http://${HOST}:${UI_PORT}/`;

const SERVER_START_TIMEOUT_MS = 15000;
const UI_START_TIMEOUT_MS = 30000;

/**
 * @typedef {{ command: string; args: string[]; cwd: string; logName: string }} ProcessSpec
 * @typedef {{ command: string; args: string[] }} CommandSpec
 * @typedef {(url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>} FetchLike
 * @typedef {{ pid?: number; unref: () => void; on: (event: "error", listener: (err: Error) => void) => unknown }} ChildLike
 * @typedef {(command: string, args: string[], options: Record<string, unknown>) => ChildLike} SpawnLike
 * @typedef {{ mkdirSync: (dir: string, options: { recursive: boolean }) => unknown; openSync: (file: string, flags: string) => number; closeSync: (fd: number) => void }} FsLike
 * @typedef {(message: string) => void} LogFn
 */

/**
 * Office checkout location: $CLAUDE_OFFICE_DIR or ~/Claude-Office.
 * @param {Record<string, string | undefined>} [env]
 * @param {string} [homedir]
 * @returns {string}
 */
export function resolveOfficeDir(env = process.env, homedir = os.homedir()) {
  const fromEnv = env.CLAUDE_OFFICE_DIR?.trim();
  if (fromEnv) {
    return path.resolve(fromEnv);
  }
  return path.join(homedir, "Claude-Office");
}

/**
 * @param {string} [homedir]
 * @returns {string}
 */
export function resolveLogDir(homedir = os.homedir()) {
  return path.join(homedir, ".agent-office");
}

/**
 * Returns null when the checkout looks usable, otherwise an error message.
 * @param {string} dir
 * @param {(p: string) => boolean} [exists]
 * @returns {string | null}
 */
export function validateOfficeDir(dir, exists = fs.existsSync) {
  const setup = [
    "To set it up once:",
    `  git clone https://github.com/W17ant/Claude-Office "${dir}"`,
    `  cd "${dir}" && npm install`,
    "or set CLAUDE_OFFICE_DIR to the existing checkout.",
  ].join("\n");

  if (!exists(dir)) {
    return `Claude-Office not found: ${dir}\n${setup}`;
  }

  const serverEntry = path.join(dir, "server", "index.js");
  if (!exists(serverEntry)) {
    return `Claude-Office server entry not found: ${serverEntry}\n${setup}`;
  }

  const viteBin = path.join(dir, "node_modules", "vite", "bin", "vite.js");
  if (!exists(viteBin)) {
    return `Claude-Office dependencies are not installed (missing ${viteBin}).\nRun: cd "${dir}" && npm install\n${setup}`;
  }

  return null;
}

/**
 * @param {string} dir
 * @returns {ProcessSpec}
 */
export function buildServerCommand(dir) {
  return {
    command: process.execPath,
    args: [path.join(dir, "server", "index.js")],
    cwd: dir,
    logName: "server.log",
  };
}

/**
 * Runs Vite through node directly (no npx / cmd). --strictPort keeps Vite
 * from silently moving to 3334, which belongs to the server.
 * @param {string} dir
 * @returns {ProcessSpec}
 */
export function buildUiCommand(dir) {
  return {
    command: process.execPath,
    args: [
      path.join(dir, "node_modules", "vite", "bin", "vite.js"),
      "--port",
      String(UI_PORT),
      "--host",
      HOST,
      "--strictPort",
    ],
    cwd: dir,
    logName: "vite.log",
  };
}

/**
 * @param {string} platform
 * @param {string} url
 * @returns {CommandSpec}
 */
export function getOpenBrowserCommand(platform, url) {
  if (platform === "win32") {
    return { command: "rundll32", args: ["url.dll,FileProtocolHandler", url] };
  }
  if (platform === "darwin") {
    return { command: "open", args: [url] };
  }
  return { command: "xdg-open", args: [url] };
}

/**
 * @param {string} platform
 * @param {number} port
 * @returns {CommandSpec}
 */
export function getFindPidsCommand(platform, port) {
  if (platform === "win32") {
    // No "-p TCP": that filter hides IPv6 (TCPv6) listeners
    return { command: "netstat", args: ["-ano"] };
  }
  return {
    command: "lsof",
    args: ["-nP", "-t", `-iTCP:${port}`, "-sTCP:LISTEN"],
  };
}

/**
 * Extracts PIDs of TCP sockets listening on the given port from `netstat -ano`.
 * @param {string} output
 * @param {number} port
 * @returns {number[]}
 */
export function parseNetstatPids(output, port) {
  const pids = new Set();

  for (const line of output.split(/\r?\n/)) {
    const cols = line.trim().split(/\s+/);
    if (cols.length < 4 || cols[0].toUpperCase() !== "TCP") {
      continue;
    }

    const [, localAddress, foreignAddress] = cols;
    const pid = Number(cols[cols.length - 1]);
    const state = cols.length >= 5 ? cols[3] : "";

    // Compare the port after the last ":" exactly (3333 must not match 33330)
    const localPort = localAddress.slice(localAddress.lastIndexOf(":") + 1);
    if (localPort !== String(port)) {
      continue;
    }

    // The state column may be localized; a wildcard foreign address also means LISTEN
    const isListening =
      state.toUpperCase() === "LISTENING" ||
      foreignAddress === "0.0.0.0:0" ||
      foreignAddress === "[::]:0";
    if (!isListening) {
      continue;
    }

    if (Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids];
}

/**
 * @param {string} output
 * @returns {number[]}
 */
export function parseLsofPids(output) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const value = line.trim();
    if (!/^\d+$/.test(value)) {
      continue;
    }
    const pid = Number(value);
    if (pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

/**
 * Windows needs taskkill; on other platforms the caller uses process.kill.
 * @param {string} platform
 * @param {number} pid
 * @returns {CommandSpec | null}
 */
export function getKillCommand(platform, pid) {
  if (platform === "win32") {
    return { command: "taskkill", args: ["/PID", String(pid), "/T", "/F"] };
  }
  return null;
}

/**
 * @param {string[]} argv
 * @returns {{ command: "start" | "stop" | "help"; open: boolean; unknown: string | null }}
 */
export function parseArgs(argv) {
  /** @type {"start" | "stop" | "help"} */
  let command = "start";
  let open = true;
  /** @type {string | null} */
  let unknown = null;
  let commandSeen = false;

  for (const arg of argv) {
    if (arg === "--no-open") {
      open = false;
    } else if (arg === "help" || arg === "--help" || arg === "-h") {
      command = "help";
      commandSeen = true;
    } else if ((arg === "start" || arg === "stop") && !commandSeen) {
      command = arg;
      commandSeen = true;
    } else {
      command = "help";
      unknown = arg;
      commandSeen = true;
    }
  }

  return { command, open, unknown };
}

/**
 * @param {FetchLike} [fetchImpl]
 * @returns {Promise<boolean>}
 */
export async function isServerHealthy(fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(SERVER_HEALTH_URL, {
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) {
      return false;
    }
    const body = /** @type {{ status?: unknown } | null} */ (await res.json());
    return body?.status === "ok";
  } catch {
    return false;
  }
}

/**
 * @param {FetchLike} [fetchImpl]
 * @returns {Promise<boolean>}
 */
export async function isUiUp(fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(UI_CHECK_URL, {
      signal: AbortSignal.timeout(1500),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

/** @param {number} ms */
function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls `check` until it resolves true (-> true) or the timeout passes (-> false).
 * @param {() => Promise<boolean>} check
 * @param {{ timeoutMs: number; intervalMs?: number; sleep?: (ms: number) => Promise<unknown>; now?: () => number }} options
 * @returns {Promise<boolean>}
 */
export async function waitFor(
  check,
  { timeoutMs, intervalMs = 500, sleep = defaultSleep, now = Date.now }
) {
  const startedAt = now();
  for (;;) {
    let ok = false;
    try {
      ok = await check();
    } catch {
      ok = false;
    }
    if (ok) {
      return true;
    }
    if (now() - startedAt >= timeoutMs) {
      return false;
    }
    await sleep(intervalMs);
  }
}

/**
 * Starts a background process that outlives this script; stdout/stderr
 * are appended to <logDir>/<spec.logName>.
 * @param {ProcessSpec} spec
 * @param {string} logDir
 * @param {{ spawnFn?: SpawnLike; fsImpl?: FsLike; log?: LogFn }} [deps]
 * @returns {number | undefined}
 */
export function spawnDetached(
  spec,
  logDir,
  { spawnFn = spawn, fsImpl = fs, log = console.error } = {}
) {
  fsImpl.mkdirSync(logDir, { recursive: true });
  const fd = fsImpl.openSync(path.join(logDir, spec.logName), "a");
  try {
    const child = spawnFn(spec.command, spec.args, {
      cwd: spec.cwd,
      detached: true,
      stdio: ["ignore", fd, fd],
      windowsHide: true,
    });
    child.on("error", (err) => log(`[error] ${spec.command}: ${err.message}`));
    child.unref();
    return child.pid;
  } finally {
    fsImpl.closeSync(fd);
  }
}

/**
 * @param {{
 *   dir?: string;
 *   logDir?: string;
 *   open?: boolean;
 *   platform?: string;
 *   fetchImpl?: FetchLike;
 *   spawnFn?: SpawnLike;
 *   existsFn?: (p: string) => boolean;
 *   fsImpl?: FsLike;
 *   sleep?: (ms: number) => Promise<unknown>;
 *   now?: () => number;
 *   log?: LogFn;
 *   logError?: LogFn;
 * }} [options]
 * @returns {Promise<number>} exit code
 */
export async function startOffice({
  dir = resolveOfficeDir(),
  logDir = resolveLogDir(),
  open = true,
  platform = process.platform,
  fetchImpl = globalThis.fetch,
  spawnFn = spawn,
  existsFn = fs.existsSync,
  fsImpl = fs,
  sleep = defaultSleep,
  now = Date.now,
  log = console.log,
  logError = console.error,
} = {}) {
  const invalid = validateOfficeDir(dir, existsFn);
  if (invalid) {
    logError(`[error] ${invalid}`);
    return 1;
  }

  const services = [
    {
      name: "server",
      port: SERVER_PORT,
      spec: buildServerCommand(dir),
      check: () => isServerHealthy(fetchImpl),
      timeoutMs: SERVER_START_TIMEOUT_MS,
    },
    {
      name: "UI",
      port: UI_PORT,
      spec: buildUiCommand(dir),
      check: () => isUiUp(fetchImpl),
      timeoutMs: UI_START_TIMEOUT_MS,
    },
  ];

  for (const service of services) {
    if (await service.check()) {
      log(`[ok] ${service.name} already running on ${service.port}`);
      continue;
    }

    const logFile = path.join(logDir, service.spec.logName);
    log(`[..] starting ${service.name} on ${service.port} (log: ${logFile})`);
    try {
      spawnDetached(service.spec, logDir, {
        spawnFn,
        fsImpl,
        log: logError,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`[error] failed to start ${service.name}: ${message}`);
      return 1;
    }

    const started = await waitFor(service.check, {
      timeoutMs: service.timeoutMs,
      sleep,
      now,
    });
    if (!started) {
      logError(
        `[error] ${service.name} did not come up on ${service.port} within ${service.timeoutMs / 1000}s. See ${logFile}`
      );
      return 1;
    }
    log(`[ok] ${service.name} started on ${service.port}`);
  }

  if (open) {
    const browser = getOpenBrowserCommand(platform, UI_URL);
    try {
      const child = spawnFn(browser.command, browser.args, {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      child.on("error", (err) =>
        logError(`[warn] could not open the browser: ${err.message}`)
      );
      child.unref();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`[warn] could not open the browser: ${message}`);
    }
  }

  log("");
  log(`Office: ${UI_URL}`);
  log(`Server: ${SERVER_URL}`);
  log(`Logs:   ${logDir}`);
  log("Stop:   npm run office:stop");
  return 0;
}

/**
 * Stops whatever listens on the UI and server ports.
 * @param {{
 *   platform?: string;
 *   execFn?: (command: string, args: string[]) => string;
 *   killFn?: (pid: number) => void;
 *   log?: LogFn;
 *   logError?: LogFn;
 * }} [options]
 * @returns {Promise<number>} exit code
 */
export async function stopOffice({
  platform = process.platform,
  execFn = defaultExec,
  killFn = (pid) => process.kill(pid, "SIGTERM"),
  log = console.log,
  logError = console.error,
} = {}) {
  for (const port of [UI_PORT, SERVER_PORT]) {
    const find = getFindPidsCommand(platform, port);
    let output = "";
    try {
      output = execFn(find.command, find.args);
    } catch {
      // lsof exits 1 when nothing matches
      output = "";
    }

    const pids =
      platform === "win32"
        ? parseNetstatPids(output, port)
        : parseLsofPids(output);

    if (pids.length === 0) {
      log(`[ok] nothing listening on port ${port}`);
      continue;
    }

    for (const pid of pids) {
      try {
        const kill = getKillCommand(platform, pid);
        if (kill) {
          execFn(kill.command, kill.args);
        } else {
          killFn(pid);
        }
        log(`[ok] stopped PID ${pid} on port ${port}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logError(`[warn] could not stop PID ${pid} on port ${port}: ${message}`);
      }
    }
  }
  return 0;
}

/**
 * @param {string} command
 * @param {string[]} args
 * @returns {string}
 */
function defaultExec(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

const USAGE = [
  "Usage: node scripts/office.mjs [start|stop] [--no-open]",
  "  start      start the Claude-Office server (3334) and UI (3333), open the browser (default)",
  "  stop       stop whatever listens on ports 3333 and 3334",
  "  --no-open  do not open the browser after start",
].join("\n");

/**
 * @param {string[]} [argv]
 * @returns {Promise<number>}
 */
export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  let code = 0;

  if (args.command === "start") {
    code = await startOffice({ open: args.open });
  } else if (args.command === "stop") {
    code = await stopOffice();
  } else if (args.unknown) {
    console.error(`Unknown argument: ${args.unknown}\n${USAGE}`);
    code = 1;
  } else {
    console.log(USAGE);
  }

  process.exitCode = code;
  return code;
}

// Run only when executed directly, so importing this module (tests) has no side effects
function isEntryPoint() {
  if (!process.argv[1]) {
    return false;
  }
  try {
    const self = fs.realpathSync(fileURLToPath(import.meta.url));
    const entry = fs.realpathSync(path.resolve(process.argv[1]));
    return process.platform === "win32"
      ? self.toLowerCase() === entry.toLowerCase()
      : self === entry;
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}

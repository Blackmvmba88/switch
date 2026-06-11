#!/usr/bin/env node
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = process.env.BLACKMAMBA_APP_ROOT || path.resolve(__dirname, "..");
const debugPort = Number(process.env.DEBUG_PORT || 9224);
const targetUrl = process.env.URL || "https://www.xbox.com/play";
const profileDir = process.env.PROFILE_DIR || "/tmp/blackmamba-xcloud-cdp-profile";
const intervalMs = Number(process.env.INTERVAL_MS || 5000);
const autoOpenXcloud = process.env.AUTO_OPEN_XCLOUD === "1";
const browserApp = process.env.BROWSER_APP || "";
const browserPrefPath = process.env.BROWSER_PREF_PATH || path.join(appRoot, "reports", "browser-status.json");
const injectScript = path.join(appRoot, "runtime", "inject-bridge-cdp.js");
const statusPath = process.env.STATUS_PATH || path.join(appRoot, "reports", "xcloud-bridge-status.json");
const sessionPath = process.env.SESSION_PATH || path.join(appRoot, "reports", "play-sessions.json");
const closeScript = process.env.CLOSE_SCRIPT || path.join(appRoot, "close-runtime.sh");
const minPlayMs = Number(process.env.AUTO_SHUTDOWN_MIN_PLAY_MS || 30 * 60 * 1000);
const awayGraceMs = Number(process.env.AUTO_SHUTDOWN_AWAY_GRACE_MS || 90 * 1000);

let lastLaunchAt = 0;
let lastInjectAt = 0;
let injecting = false;
let closing = false;
let session = null;

function writeStatus(status) {
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, JSON.stringify({
    protocol: "blackmamba.xcloud.bridge.agent.v0",
    updatedAt: new Date().toISOString(),
    debugPort,
    targetUrl,
    profileDir,
    autoOpenXcloud,
    browserApp: browserApp || null,
    ...status
  }, null, 2) + "\n");
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, {
      env: { ...process.env, ...(options.env || {}) },
      timeout: options.timeout || 15000
    }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        stdout: String(stdout || ""),
        stderr: String(stderr || error?.message || "")
      });
    });
  });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function readBrowserPreference() {
  try {
    const data = JSON.parse(fs.readFileSync(browserPrefPath, "utf8"));
    return data.preference || "";
  } catch (_) {
    return "";
  }
}

function durationText(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

async function frontmostApp() {
  const script = 'tell application "System Events" to get name of first application process whose frontmost is true';
  const result = await run("/usr/bin/osascript", ["-e", script], { timeout: 3000 });
  return result.ok ? result.stdout.trim() : "";
}

function loadSessionMemory() {
  const memory = readJson(sessionPath, { sessions: [] });
  if (!Array.isArray(memory.sessions)) memory.sessions = [];
  return memory;
}

function appendSession(record) {
  const memory = loadSessionMemory();
  memory.sessions.push(record);
  memory.sessions = memory.sessions.slice(-50);
  const durations = memory.sessions
    .map((item) => Number(item.durationMs || 0))
    .filter((value) => value > 0);
  const averageMs = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : 0;
  memory.updatedAt = new Date().toISOString();
  memory.summary = {
    count: durations.length,
    averageMs,
    average: averageMs ? durationText(averageMs) : "0m",
    lastDurationMs: record.durationMs,
    lastDuration: durationText(record.durationMs)
  };
  writeJson(sessionPath, memory);
}

function startOrTouchSession(reason) {
  const now = Date.now();
  if (!session) {
    session = {
      startedAtMs: now,
      startedAt: new Date(now).toISOString(),
      lastSeenAtMs: now,
      lastSeenAt: new Date(now).toISOString(),
      reason
    };
  } else {
    session.lastSeenAtMs = now;
    session.lastSeenAt = new Date(now).toISOString();
  }
}

function sessionSnapshot(extra = {}) {
  if (!session) return { activeSession: false, ...extra };
  const now = Date.now();
  return {
    activeSession: true,
    sessionStartedAt: session.startedAt,
    sessionLastSeenAt: session.lastSeenAt,
    sessionDurationMs: now - session.startedAtMs,
    sessionDuration: durationText(now - session.startedAtMs),
    sessionMissingMs: now - session.lastSeenAtMs,
    minPlayMs,
    awayGraceMs,
    ...extra
  };
}

async function maybeAutoShutdown(reason) {
  if (!session || closing) return false;
  const now = Date.now();
  const durationMs = now - session.startedAtMs;
  const missingMs = now - session.lastSeenAtMs;
  if (durationMs < minPlayMs || missingMs < awayGraceMs) return false;

  const app = await frontmostApp();
  const awayFromChrome = app && !/chrome/i.test(app);
  if (!awayFromChrome) return false;

  closing = true;
  const record = {
    startedAt: session.startedAt,
    endedAt: new Date(now).toISOString(),
    durationMs,
    duration: durationText(durationMs),
    missingMs,
    closeReason: reason,
    frontmostApp: app
  };
  appendSession(record);
  writeStatus({
    state: "auto_shutdown",
    reason,
    frontmostApp: app,
    session: record,
    memory: loadSessionMemory().summary
  });
  if (fs.existsSync(closeScript)) {
    await run("/bin/bash", [closeScript], { timeout: 20000 });
  }
  session = null;
  closing = false;
  return true;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function isPlayTarget(target) {
  return target.type === "page"
    && /xbox\.com/.test(target.url || "")
    && /\/play(\/|$|\?)/.test(target.url || "")
    && !/\/auth\//.test(target.url || "");
}

async function getTargets() {
  return fetchJson(`http://127.0.0.1:${debugPort}/json`);
}

async function launchChrome() {
  const now = Date.now();
  if (now - lastLaunchAt < 15000) return;
  lastLaunchAt = now;
  fs.mkdirSync(profileDir, { recursive: true });
  const preference = browserApp || readBrowserPreference();
  const browserName = preference === "atlas"
    ? "ChatGPT Atlas"
    : browserApp || (fs.existsSync("/Applications/Google Chrome.app") ? "Google Chrome" : "ChatGPT Atlas");
  await run("open", [
    "-na", browserName, "--args",
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "about:blank"
  ], { timeout: 10000 });
  writeStatus({ state: "launching_browser", cdp: "unavailable", browserName, ...sessionSnapshot() });
}

async function inject({ reuse }) {
  if (injecting) return { ok: true, skipped: true };
  injecting = true;
  try {
    const env = {
      DEBUG_PORT: String(debugPort),
      URL: targetUrl,
      ...(reuse ? { REUSE_XCLOUD: "1" } : {})
    };
    return await run(process.execPath, [injectScript, String(debugPort)], { env, timeout: 20000 });
  } finally {
    injecting = false;
  }
}

async function tick() {
  try {
    await fetchJson(`http://127.0.0.1:${debugPort}/json/version`);
  } catch (error) {
    if (await maybeAutoShutdown("cdp_unavailable_after_play")) return;
    if (autoOpenXcloud) {
      await launchChrome();
      writeStatus({ state: "starting_chrome", cdp: "unavailable", error: error.message, ...sessionSnapshot() });
    } else {
      writeStatus({ state: "idle_no_cdp", cdp: "unavailable", error: error.message, ...sessionSnapshot() });
    }
    return;
  }

  const targets = await getTargets();
  const playTarget = targets.find(isPlayTarget);
  if (playTarget) startOrTouchSession("xcloud_play_target_seen");
  if (!playTarget && !autoOpenXcloud) {
    if (await maybeAutoShutdown("xcloud_tab_closed_after_play")) return;
    writeStatus({ state: "idle_no_xcloud_tab", cdp: "available", playTarget: false, targets: targets.length, ...sessionSnapshot() });
    return;
  }
  if (!playTarget && await maybeAutoShutdown("xcloud_tab_closed_after_play")) return;
  const now = Date.now();
  if (now - lastInjectAt < intervalMs) {
    writeStatus({ state: "waiting", cdp: "available", playTarget: Boolean(playTarget), targets: targets.length, ...sessionSnapshot() });
    return;
  }

  const result = await inject({ reuse: Boolean(playTarget) });
  lastInjectAt = now;
  writeStatus({
    state: result.ok ? "injected" : "inject_failed",
    cdp: "available",
    playTarget: Boolean(playTarget),
    targets: targets.length,
    stdout: result.stdout.trim().slice(-1200),
    stderr: result.stderr.trim().slice(-1200),
    ...sessionSnapshot()
  });
}

async function main() {
  writeStatus({ state: "booting" });
  while (true) {
    await tick().catch((error) => {
      writeStatus({ state: "error", error: error.stack || error.message });
    });
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main();

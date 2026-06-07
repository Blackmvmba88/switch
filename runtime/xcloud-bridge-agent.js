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
    protocol: "blackmamba.xcloud.bridge.agent.v1",
    updatedAt: new Date().toISOString(),
    debugPort,
    targetUrl,
    profileDir,
    autoOpenXcloud,
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
    averageMs
  };
  fs.mkdirSync(path.dirname(sessionPath), { recursive: true });
  fs.writeFileSync(sessionPath, JSON.stringify(memory, null, 2) + "\n");
}

function startOrTouchSession(reason) {
  if (!session) {
    session = { startedAt: Date.now(), lastSeenAt: Date.now(), reason };
  } else {
    session.lastSeenAt = Date.now();
  }
}

function sessionSnapshot() {
  if (!session) return { session: null };
  const durationMs = Date.now() - session.startedAt;
  return {
    session: {
      durationMs,
      active: true
    }
  };
}

async function maybeAutoShutdown(reason) {
  if (!session) return false;
  const now = Date.now();
  const playDurationMs = now - session.startedAt;
  const idleMs = now - session.lastSeenAt;

  if (playDurationMs < minPlayMs) return false;
  if (idleMs < awayGraceMs) return false;

  const app = await frontmostApp();
  if (app === "Google Chrome") return false;

  if (closing) return true;
  closing = true;
  writeStatus({ state: "auto_shutdown", reason, durationMs: playDurationMs, idleMs, app });
  appendSession({
    at: new Date().toISOString(),
    durationMs: playDurationMs,
    reason
  });
  await run("/usr/bin/bash", [closeScript]);
  session = null;
  closing = false;
  return true;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function getTargets() {
  return fetchJson(`http://127.0.0.1:${debugPort}/json`);
}

function isPlayTarget(item) {
  return /xbox\.com/.test(item.url || "") && /play/.test(item.url || "");
}

async function launchChrome() {
  const now = Date.now();
  if (now - lastLaunchAt < 20000) return;
  lastLaunchAt = now;
  fs.mkdirSync(profileDir, { recursive: true });
  await run("open", [
    "-na", "Google Chrome", "--args",
    `--user-data-dir=${profileDir}`,
    `--remote-debugging-port=${debugPort}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-sync",
    "about:blank"
  ], { timeout: 10000 });
}

async function verifyBridge() {
  const env = { DEBUG_PORT: String(debugPort), VERIFY_ONLY: "1" };
  const result = await run(process.execPath, [injectScript], { env, timeout: 10000 });
  if (!result.ok) return { installed: false, error: result.stderr };
  try {
    return JSON.parse(result.stdout);
  } catch (_) {
    return { installed: false, error: "invalid verify output" };
  }
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
    return await run(process.execPath, [injectScript], { env, timeout: 20000 });
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

  const health = await verifyBridge();
  const now = Date.now();
  const needsReinject = !health.installed || (health.debug && health.debug.framesReceived === 0 && now - lastInjectAt > 15000);

  if (!needsReinject && now - lastInjectAt < 30000) {
    writeStatus({ state: "healthy", cdp: "available", playTarget: Boolean(playTarget), bridge: health, ...sessionSnapshot() });
    return;
  }

  const result = await inject({ reuse: Boolean(playTarget) });
  lastInjectAt = now;
  writeStatus({
    state: result.ok ? "injected" : "inject_failed",
    cdp: "available",
    playTarget: Boolean(playTarget),
    bridge: health,
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

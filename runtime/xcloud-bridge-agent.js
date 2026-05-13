#!/usr/bin/env node
const { execFile } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const appRoot = process.env.BLACKMAMBA_APP_ROOT || path.resolve(__dirname, "..");
const debugPort = Number(process.env.DEBUG_PORT || 9224);
const targetUrl = process.env.URL || "https://www.xbox.com/play";
const profileDir = process.env.PROFILE_DIR || "/tmp/blackmamba-xcloud-cdp-profile";
const intervalMs = Number(process.env.INTERVAL_MS || 5000);
const injectScript = path.join(appRoot, "runtime", "inject-bridge-cdp.js");
const statusPath = process.env.STATUS_PATH || path.join(appRoot, "reports", "xcloud-bridge-status.json");

let lastLaunchAt = 0;
let lastInjectAt = 0;
let injecting = false;

function writeStatus(status) {
  fs.mkdirSync(path.dirname(statusPath), { recursive: true });
  fs.writeFileSync(statusPath, JSON.stringify({
    protocol: "blackmamba.xcloud.bridge.agent.v0",
    updatedAt: new Date().toISOString(),
    debugPort,
    targetUrl,
    profileDir,
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
    await launchChrome();
    writeStatus({ state: "starting_chrome", cdp: "unavailable", error: error.message });
    return;
  }

  const targets = await getTargets();
  const playTarget = targets.find(isPlayTarget);
  const now = Date.now();
  if (now - lastInjectAt < intervalMs) {
    writeStatus({ state: "waiting", cdp: "available", playTarget: Boolean(playTarget), targets: targets.length });
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
    stderr: result.stderr.trim().slice(-1200)
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

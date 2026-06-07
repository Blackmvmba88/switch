#!/usr/bin/env node
const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const intervalMs = 15000;
const appRoot = path.join(process.env.HOME || "", "Library/Application Support/BlackMambaInput");
const statusPath = path.join(appRoot, "reports/watchdog-status.json");

function log(msg) {
  const line = `[${new Date().toISOString()}] [Watchdog] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.join(appRoot, "logs"), { recursive: true });
    fs.appendFileSync(path.join(appRoot, "logs/watchdog.log"), line + "\n");
  } catch (_) {}
}

function writeStatus(data) {
  try {
    fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({
      updatedAt: new Date().toISOString(),
      ...data
    }, null, 2));
  } catch (_) {}
}

function isRunning(pattern) {
  try {
    execSync(`pgrep -f "${pattern}"`);
    return true;
  } catch (_) {
    return false;
  }
}

function kickAgent(label) {
  log(`Kicking agent: ${label}`);
  try {
    execSync(`launchctl kickstart -k "gui/$(id -u)/${label}"`);
  } catch (e) {
    log(`Failed to kick ${label}: ${e.message}`);
  }
}

async function check() {
  const components = [
    { label: "com.blackmamba.live-monitor", pattern: "live-monitor.js", autoFix: true },
    { label: "com.blackmamba.hid-live-source", pattern: "hid-live-source", autoFix: true },
    { label: "com.blackmamba.xcloud-bridge", pattern: "xcloud-bridge-agent.js", autoFix: true },
    { label: "com.blackmamba.control-room", pattern: "app/server.js", autoFix: false }
  ];

  const results = {};
  for (const c of components) {
    const active = isRunning(c.pattern);
    results[c.label] = { active };
    if (!active && c.autoFix) {
      log(`Component ${c.label} (${c.pattern}) is NOT running.`);
      kickAgent(c.label);
    }
  }

  writeStatus({ components: results });
}

async function main() {
  log("Starting BlackMamba Health Watchdog");
  while (true) {
    try {
      await check();
    } catch (e) {
      log(`Error in watchdog tick: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

main();

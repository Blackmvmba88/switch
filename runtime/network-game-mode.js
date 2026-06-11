#!/usr/bin/env node
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const appRoot = process.env.BLACKMAMBA_APP_ROOT || path.join(os.homedir(), "Library/Application Support/BlackMambaInput");
const logDir = path.join(appRoot, "logs");
const reportDir = path.join(appRoot, "reports");
const pidFile = path.join(logDir, "network-game-mode.pid");
const caffeinatePidFile = path.join(logDir, "network-caffeinate.pid");
const statusPath = path.join(reportDir, "network-game-status.json");
const logPath = path.join(logDir, "network-game-events.jsonl");
const sampleIntervalMs = Number(process.env.NET_SAMPLE_INTERVAL_MS || 10000);
const wifiDevice = process.env.NET_WIFI_DEVICE || "en1";
const targets = [
  { name: "internet", host: process.env.NET_INTERNET_HOST || "1.1.1.1" },
  { name: "xcloud", host: process.env.NET_XCLOUD_HOST || "www.xbox.com" }
];

function ensureDirs() {
  fs.mkdirSync(logDir, { recursive: true });
  fs.mkdirSync(reportDir, { recursive: true });
}

function writeJson(file, value) {
  ensureDirs();
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function appendLog(value) {
  ensureDirs();
  fs.appendFileSync(logPath, JSON.stringify(value) + "\n");
}

function readPid(file) {
  try {
    const pid = Number(fs.readFileSync(file, "utf8").trim());
    return Number.isInteger(pid) && pid > 0 ? pid : 0;
  } catch (_) {
    return 0;
  }
}

function alive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (_) {
    return false;
  }
}

function run(command, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(command, args, { timeout }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        stdout: String(stdout || ""),
        stderr: String(stderr || error?.message || "")
      });
    });
  });
}

function parseRoute(text) {
  const gateway = text.match(/gateway:\s+([^\n]+)/)?.[1]?.trim() || "";
  const iface = text.match(/interface:\s+([^\n]+)/)?.[1]?.trim() || "";
  return { gateway, interface: iface };
}

async function routeInfo() {
  const result = await run("/sbin/route", ["-n", "get", "default"], 4000);
  return parseRoute(result.stdout || result.stderr);
}

async function interfaceStatus(device) {
  const result = await run("/sbin/ifconfig", [device], 3000);
  const text = result.stdout || result.stderr;
  const status = text.match(/status:\s+([^\n]+)/)?.[1]?.trim() || "unknown";
  const inet = text.match(/\n\s*inet\s+([^\s]+)/)?.[1]?.trim() || "";
  return { device, status, inet, active: status === "active" && Boolean(inet) };
}

async function hardwarePortForDevice(device) {
  const result = await run("/usr/sbin/networksetup", ["-listallhardwareports"], 3000);
  const blocks = String(result.stdout || "").split(/\n\n+/);
  for (const block of blocks) {
    if (new RegExp(`Device:\\s+${device}\\b`).test(block)) {
      return block.match(/Hardware Port:\s+([^\n]+)/)?.[1]?.trim() || "";
    }
  }
  return "";
}

function parsePing(text) {
  const lossMatch = text.match(/(\d+(?:\.\d+)?)% packet loss/);
  const statsMatch = text.match(/round-trip min\/avg\/max\/stddev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/);
  return {
    ok: Boolean(statsMatch),
    lossPct: lossMatch ? Number(lossMatch[1]) : 100,
    minMs: statsMatch ? Number(statsMatch[1]) : null,
    avgMs: statsMatch ? Number(statsMatch[2]) : null,
    maxMs: statsMatch ? Number(statsMatch[3]) : null,
    jitterMs: statsMatch ? Number(statsMatch[4]) : null
  };
}

async function pingTarget(target) {
  const result = await run("/sbin/ping", ["-c", "3", "-i", "0.2", "-W", "1000", target.host], 6000);
  const parsed = parsePing(result.stdout || result.stderr);
  return { ...target, ...parsed };
}

function classify(samples) {
  const bad = samples.find((sample) => sample.lossPct > 5 || sample.avgMs === null);
  if (bad) return { state: "bad", reason: `${bad.name} loss=${bad.lossPct}% avg=${bad.avgMs ?? "n/a"}ms` };
  const warn = samples.find((sample) => sample.lossPct > 0 || sample.avgMs > 90 || sample.jitterMs > 25);
  if (warn) return { state: "warn", reason: `${warn.name} loss=${warn.lossPct}% avg=${warn.avgMs}ms jitter=${warn.jitterMs}ms` };
  return { state: "ok", reason: "latency stable" };
}

async function sample() {
  const route = await routeInfo();
  const routeHardwarePort = route.interface ? await hardwarePortForDevice(route.interface) : "";
  const wifi = await interfaceStatus(wifiDevice).catch(() => ({ device: wifiDevice, status: "unknown", inet: "", active: false }));
  const allTargets = route.gateway
    ? [{ name: "gateway", host: route.gateway }, ...targets]
    : targets;
  const samples = [];
  for (const target of allTargets) {
    samples.push(await pingTarget(target));
  }
  const quality = classify(samples);
  return {
    protocol: "blackmamba.network.game.v0",
    updatedAt: new Date().toISOString(),
    mode: "game-network",
    route: { ...route, hardwarePort: routeHardwarePort },
    interfaces: {
      wifi
    },
    quality,
    samples,
    optimizations: {
      caffeinate: alive(readPid(caffeinatePidFile)),
      dnsCacheFlush: "attempted-on-start",
      wiredPreferred: routeHardwarePort.toLowerCase().includes("ethernet"),
      wifiDisabled: !wifi.active,
      destructiveChanges: false
    }
  };
}

async function monitor() {
  ensureDirs();
  fs.writeFileSync(pidFile, String(process.pid));
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
  while (true) {
    const status = await sample().catch((error) => ({
      protocol: "blackmamba.network.game.v0",
      updatedAt: new Date().toISOString(),
      mode: "game-network",
      quality: { state: "error", reason: error.message },
      error: error.stack || error.message
    }));
    writeJson(statusPath, status);
    appendLog(status);
    await new Promise((resolve) => setTimeout(resolve, sampleIntervalMs));
  }
}

async function start() {
  ensureDirs();
  const existing = readPid(pidFile);
  if (alive(existing)) {
    console.log(`network-game-mode ya esta corriendo: ${existing}`);
    return;
  }

  await run("/usr/bin/dscacheutil", ["-flushcache"], 3000);

  const caffeinate = spawn("/usr/bin/caffeinate", ["-dimsu"], {
    detached: true,
    stdio: "ignore"
  });
  caffeinate.unref();
  fs.writeFileSync(caffeinatePidFile, String(caffeinate.pid));

  const child = spawn(process.execPath, [__filename, "monitor"], {
    detached: true,
    stdio: "ignore",
    env: process.env
  });
  child.unref();
  fs.writeFileSync(pidFile, String(child.pid));

  console.log(`Network game mode iniciado: ${child.pid}`);
  console.log(`Caffeinate activo: ${caffeinate.pid}`);
  console.log(`Status: ${statusPath}`);
}

async function wired() {
  ensureDirs();
  await run("/usr/sbin/networksetup", ["-setairportpower", wifiDevice, "off"], 5000);
  await run("/usr/bin/dscacheutil", ["-flushcache"], 3000);
  stop();
  await start();
}

function stop() {
  const pids = [readPid(pidFile), readPid(caffeinatePidFile)].filter(Boolean);
  for (const pid of pids) {
    try { process.kill(pid, "SIGTERM"); } catch (_) {}
  }
  for (const file of [pidFile, caffeinatePidFile]) {
    try { fs.rmSync(file); } catch (_) {}
  }
  writeJson(statusPath, {
    protocol: "blackmamba.network.game.v0",
    updatedAt: new Date().toISOString(),
    mode: "off",
    quality: { state: "off", reason: "stopped" }
  });
  console.log(pids.length ? `Network game mode detenido: ${pids.join(" ")}` : "Network game mode no estaba activo.");
}

async function status() {
  if (fs.existsSync(statusPath)) {
    process.stdout.write(fs.readFileSync(statusPath, "utf8"));
    return;
  }
  const current = await sample();
  writeJson(statusPath, current);
  process.stdout.write(JSON.stringify(current, null, 2) + "\n");
}

async function main() {
  const command = process.argv[2] || "status";
  if (command === "start") return start();
  if (command === "wired") return wired();
  if (command === "monitor") return monitor();
  if (command === "stop") return stop();
  if (command === "status") return status();
  console.error("Uso: node runtime/network-game-mode.js [start|wired|stop|status|monitor]");
  process.exit(2);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

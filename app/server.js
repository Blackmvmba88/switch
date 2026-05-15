#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(__dirname, "public");
const PORT = Number(process.env.BM_APP_PORT || process.argv[2] || 8147);
const HOST = process.env.BM_APP_HOST || "127.0.0.1";
const APP_ROOT = path.join(process.env.HOME || "", "Library/Application Support/BlackMambaInput");
const LIVE_STATUS = path.join(APP_ROOT, "reports/live-status.json");
const XCLOUD_STATUS = path.join(APP_ROOT, "reports/xcloud-bridge-status.json");
const LIVE_EVENTS = path.join(APP_ROOT, "logs/live-events.jsonl");
const XCLOUD_ERR = path.join(APP_ROOT, "logs/xcloud-bridge-agent.err.log");
const REPO_PROFILE = path.join(ROOT, "profiles/rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json");
const APP_PROFILE = path.join(APP_ROOT, "profiles/rock-candy.normalized.json");
const ALLOWED_SEMANTICS = new Set([
  "A", "B", "X", "Y",
  "LB", "RB", "LT", "RT",
  "Back", "Start", "L3", "R3", "Guide",
  "DPad_Up", "DPad_Down", "DPad_Left", "DPad_Right",
  "LX", "LY", "RX", "RY"
]);

function lifecycle(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.mkdirSync(path.join(APP_ROOT, "logs"), { recursive: true });
    fs.appendFileSync(path.join(APP_ROOT, "logs/control-room.lifecycle.log"), line);
  } catch (_) {
    // Logging must never be the reason the app exits.
  }
  process.stderr.write(line);
}

const COMMANDS = {
  "wake": { args: ["wake"], timeout: 30000 },
  "verify": { args: ["verify"], timeout: 30000 },
  "buttons": { args: ["buttons"], timeout: 20000, env: { DURATION_MS: "12000" } },
  "reinject": { args: ["reinject"], timeout: 25000 },
  "recycle": { args: ["recycle"], timeout: 45000 },
  "doctor": { args: ["doctor-advanced"], timeout: 30000 },
  "status": { args: ["status"], timeout: 15000 },
  "ram": { args: ["ram"], timeout: 15000 },
  "fortnite-map": { args: ["fortnite-map"], timeout: 15000 },
  "switch-map": { args: ["switch-map"], timeout: 15000 },
  "game-on": { args: ["game-on"], timeout: 45000 },
  "game-off": { args: ["game-off"], timeout: 30000 },
  "clean": { args: ["clean"], timeout: 15000 },
  "test": { args: ["test"], timeout: 90000 }
};

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  res.end(`${body}\n`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return null;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function tail(file, lines = 80) {
  try {
    const text = fs.readFileSync(file, "utf8");
    return text.split(/\n/).slice(-lines).join("\n").trim();
  } catch (_) {
    return "";
  }
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

function runBmctl(name) {
  const spec = COMMANDS[name];
  if (!spec) {
    return Promise.resolve({ ok: false, code: 404, stdout: "", stderr: `Unknown command: ${name}` });
  }

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(path.join(ROOT, "bmctl"), spec.args, {
      cwd: ROOT,
      env: { ...process.env, ...(spec.env || {}) },
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += `\nTimeout after ${spec.timeout}ms`;
    }, spec.timeout).unref();

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > 20000) stdout = stdout.slice(-20000);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 12000) stderr = stderr.slice(-12000);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0,
        code,
        command: `./bmctl ${spec.args.join(" ")}`,
        durationMs: Date.now() - startedAt,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

function runCommand(command, args, timeout = 6000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      stderr += `\nTimeout after ${timeout}ms`;
    }, timeout).unref();
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

async function restartLiveMonitor() {
  return runCommand("launchctl", ["kickstart", "-k", `gui/${process.getuid()}/com.blackmamba.live-monitor`], 6000);
}

async function fetchCdpTabs() {
  try {
    const response = await fetch("http://127.0.0.1:9224/json");
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const tabs = await response.json();
    return {
      available: true,
      tabs: tabs.filter((tab) => tab.type === "page").map((tab) => ({
        title: tab.title,
        url: tab.url
      }))
    };
  } catch (error) {
    return { available: false, error: error.message, tabs: [] };
  }
}

async function apiStatus() {
  const live = readJson(LIVE_STATUS);
  const xcloud = readJson(XCLOUD_STATUS);
  const cdp = await fetchCdpTabs();
  const now = Date.now();
  const liveAgeMs = live?.updatedAt ? now - Date.parse(live.updatedAt) : null;
  const xcloudAgeMs = xcloud?.updatedAt ? now - Date.parse(xcloud.updatedAt) : null;
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    liveAgeMs,
    xcloudAgeMs,
    live,
    xcloud,
    cdp,
    health: {
      livePolling: live?.browserPolling === "PASS" && (live.staleMs ?? Infinity) < 1500,
      xcloudInjected: xcloud?.state === "injected",
      cdpAvailable: cdp.available,
      virtualPadLikely: xcloud?.state === "injected" && cdp.available
    }
  };
}

function readProfile() {
  return readJson(APP_PROFILE) || readJson(REPO_PROFILE);
}

function normalizeBinding(input) {
  if (!input || typeof input !== "object") return null;
  const source = String(input.source || "");
  const index = Number(input.index);
  const kind = input.kind === "axis" ? "axis" : input.kind === "button" ? "button" : "";
  if (!kind || !Number.isInteger(index) || index < 0 || index > 32) return null;
  if (kind === "button" && source !== `B${index}`) return null;
  if (kind === "axis" && source !== `A${index}`) return null;
  const binding = { source, kind, index };
  if (kind === "axis") {
    const from = Number(input.from);
    const to = Number(input.to);
    if (!Number.isFinite(to)) return null;
    if (Number.isFinite(from)) binding.from = Number(from.toFixed(3));
    binding.to = Number(to.toFixed(3));
  }
  return binding;
}

async function saveBinding(payload) {
  const semantic = String(payload?.semantic || "");
  const binding = normalizeBinding(payload?.binding);
  if (!ALLOWED_SEMANTICS.has(semantic)) {
    return { ok: false, error: `semantic not allowed: ${semantic}` };
  }
  if (!binding) {
    return { ok: false, error: "invalid binding" };
  }

  const profile = readProfile();
  if (!profile) return { ok: false, error: "profile missing" };
  profile.semantic = profile.semantic || {};
  profile.semantic[semantic] = {
    ...profile.semantic[semantic],
    ...binding,
    confidence: 0.99,
    updatedAt: new Date().toISOString(),
    learnedBy: "control-room"
  };
  if (semantic.startsWith("DPad_")) profile.dpadMode = binding.kind === "axis" ? "hat-axis" : "buttons";
  if (semantic === "LT" || semantic === "RT") profile.triggerMode = binding.kind === "axis" ? "axes" : "buttons";

  writeJson(REPO_PROFILE, profile);
  writeJson(APP_PROFILE, profile);
  const restart = await restartLiveMonitor();
  return { ok: true, semantic, binding: profile.semantic[semantic], restart };
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 100000) {
        reject(new Error("body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": contentType(file),
      "cache-control": "no-store"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/status") {
      sendJson(res, 200, await apiStatus());
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/logs") {
      sendJson(res, 200, {
        liveEvents: tail(LIVE_EVENTS, 80),
        xcloudErrors: tail(XCLOUD_ERR, 80)
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/profile") {
      sendJson(res, 200, { ok: true, profile: readProfile() });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/profile/binding") {
      sendJson(res, 200, await saveBinding(await readBody(req)));
      return;
    }
    if (req.method === "POST" && url.pathname.startsWith("/api/run/")) {
      const name = decodeURIComponent(url.pathname.replace("/api/run/", ""));
      sendJson(res, 200, await runBmctl(name));
      return;
    }
    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }
    sendJson(res, 405, { ok: false, error: "method not allowed" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.stack || error.message });
  }
});

server.listen(PORT, HOST, () => {
  lifecycle(`started pid=${process.pid} ppid=${process.ppid} url=http://${HOST}:${PORT}`);
  console.log(`BlackMamba Control Room: http://${HOST}:${PORT}`);
});

for (const signal of ["SIGTERM", "SIGHUP", "SIGINT"]) {
  process.on(signal, () => {
    lifecycle(`received ${signal}; shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  });
}

process.on("uncaughtException", (error) => {
  lifecycle(`uncaughtException ${error.stack || error.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (error) => {
  lifecycle(`unhandledRejection ${error?.stack || error}`);
  process.exit(1);
});

process.on("exit", (code) => {
  lifecycle(`exit code=${code}`);
});

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

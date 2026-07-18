#!/usr/bin/env node
const fs = require("node:fs");
const http = require("node:http");
const { execFile } = require("node:child_process");
const path = require("node:path");

const ROOT = path.resolve(__dirname);
const PORT = Number(process.argv[2] || process.env.PORT || 8147);
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const configuredMaxBodyBytes = Number(process.env.API_MAX_BODY_BYTES || DEFAULT_MAX_BODY_BYTES);
const MAX_BODY_BYTES = Number.isFinite(configuredMaxBodyBytes) && configuredMaxBodyBytes > 0
  ? configuredMaxBodyBytes
  : DEFAULT_MAX_BODY_BYTES;
const PROFILE_PATH = path.join(process.env.HOME || "", "Library/Application Support/BlackMambaInput/profiles/rock-candy.normalized.json");
const BMCTL = path.join(ROOT, "bmctl");
const STATUS_PATH = path.join(ROOT, "reports", "api-status.json");
const STATE_PATH = path.join(ROOT, "reports", "runtime-state.json");
const GAME_MODE_GRACE_MS = Number(process.env.GAME_MODE_GRACE_MS || 10000);
const HID_PATTERN = process.env.HID_PATTERN || "Rock Candy|Nintendo|Switch|0xe6f|0x187";
const HID_POLL_INTERVAL_MS = Number(process.env.HID_POLL_INTERVAL_MS || 3000);
const STATUS_WRITE_THROTTLE_MS = Number(process.env.STATUS_WRITE_THROTTLE_MS || 1000);
let hidDetected = false;
let graceTimer = null;
let hidCheckInFlight = false;
let hidPollTimer = null;
let pendingStatusBody = null;
let statusWriteTimer = null;

const runtimeState = loadState() || {
  version: "1.0",
  bootedAt: new Date().toISOString(),
  mode: "standby",
  gameMode: {
    state: "idle",
    connected: false,
    graceEndsAt: null,
    lastTransitionAt: new Date().toISOString(),
    lastEvent: null
  },
  jobs: {},
  warnings: [],
  metrics: {
    restarts: 0,
    events: 0
  }
};

function loadState() {
  try {
    if (!fs.existsSync(STATE_PATH)) {
      return null;
    }
    const parsed = JSON.parse(fs.readFileSync(STATE_PATH, "utf8"));
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return {
      version: parsed.version || "1.0",
      bootedAt: parsed.bootedAt || new Date().toISOString(),
      mode: parsed.mode || "standby",
      gameMode: {
        state: parsed.gameMode?.state || "idle",
        connected: Boolean(parsed.gameMode?.connected),
        graceEndsAt: parsed.gameMode?.graceEndsAt || null,
        lastTransitionAt: parsed.gameMode?.lastTransitionAt || new Date().toISOString(),
        lastEvent: parsed.gameMode?.lastEvent || null
      },
      jobs: parsed.jobs && typeof parsed.jobs === "object" ? parsed.jobs : {},
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      metrics: {
        restarts: Number(parsed.metrics?.restarts || 0),
        events: Number(parsed.metrics?.events || 0)
      }
    };
  } catch {
    return null;
  }
}

function persistState() {
  const payload = {
    version: runtimeState.version,
    bootedAt: runtimeState.bootedAt,
    mode: runtimeState.mode,
    gameMode: runtimeState.gameMode,
    jobs: runtimeState.jobs,
    warnings: runtimeState.warnings,
    metrics: runtimeState.metrics
  };
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  const tmpPath = `${STATE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(tmpPath, STATE_PATH);
}

function nowIso() {
  return new Date().toISOString();
}

function addJob(kind, payload = {}) {
  const id = `job_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  runtimeState.jobs[id] = {
    id,
    kind,
    state: "accepted",
    createdAt: nowIso(),
    updatedAt: nowIso(),
    payload
  };
  persistState();
  return runtimeState.jobs[id];
}

function setGameMode(event, detail = {}) {
  runtimeState.metrics.events += 1;
  runtimeState.gameMode.lastEvent = {
    type: event,
    detail,
    at: nowIso()
  };
  runtimeState.gameMode.lastTransitionAt = nowIso();

  if (event === "connected") {
    runtimeState.gameMode.connected = true;
    runtimeState.gameMode.state = "running";
    runtimeState.gameMode.graceEndsAt = null;
    runtimeState.mode = "game";
    persistState();
    return runtimeState.gameMode;
  }

  if (event === "disconnected") {
    const graceMs = normalizeGraceMs(detail.graceMs);
    runtimeState.gameMode.connected = false;
    runtimeState.gameMode.state = "recovering";
    runtimeState.gameMode.graceEndsAt = new Date(Date.now() + graceMs).toISOString();
    runtimeState.mode = "game";
    persistState();
    return runtimeState.gameMode;
  }

  if (event === "grace_expired") {
    runtimeState.gameMode.connected = false;
    runtimeState.gameMode.state = "stopped";
    runtimeState.gameMode.graceEndsAt = null;
    runtimeState.mode = "standby";
    persistState();
    return runtimeState.gameMode;
  }

  if (event === "reconnected") {
    runtimeState.gameMode.connected = true;
    runtimeState.gameMode.state = "running";
    runtimeState.gameMode.graceEndsAt = null;
    runtimeState.mode = "game";
    persistState();
    return runtimeState.gameMode;
  }

  return runtimeState.gameMode;
}

function parseFiniteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeGraceMs(value) {
  const parsed = parseFiniteNumber(value, GAME_MODE_GRACE_MS);
  return Math.min(300000, Math.max(0, parsed));
}

function controlDetectedAsync() {
  return new Promise((resolve) => {
    execFile("hidutil", ["list"], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 5000
    }, (error, stdout) => {
      if (error) {
        resolve(hidDetected);
        return;
      }
      try {
        const matcher = new RegExp(HID_PATTERN, "i");
        resolve(matcher.test(String(stdout || "")));
      } catch {
        resolve(hidDetected);
      }
    });
  });
}

async function refreshControlState() {
  const detected = await controlDetectedAsync();
  if (detected && !hidDetected) {
    hidDetected = true;
    setGameMode("connected", { source: "hid", label: "control" });
  } else if (!detected && hidDetected) {
    hidDetected = false;
    setGameMode("disconnected", { source: "hid", label: "control", graceMs: GAME_MODE_GRACE_MS });
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = setTimeout(() => {
      if (!hidDetected && runtimeState.gameMode.state === "recovering") {
        setGameMode("grace_expired", { source: "hid" });
      }
    }, GAME_MODE_GRACE_MS);
    graceTimer.unref?.();
  }
  return detected;
}

function scheduleStatusWrite(body) {
  pendingStatusBody = body;
  if (statusWriteTimer) {
    return;
  }
  statusWriteTimer = setTimeout(() => {
    statusWriteTimer = null;
    if (pendingStatusBody === null) {
      return;
    }
    fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
    fs.writeFileSync(STATUS_PATH, `${pendingStatusBody}\n`);
    pendingStatusBody = null;
  }, Math.max(100, STATUS_WRITE_THROTTLE_MS));
  statusWriteTimer.unref?.();
}

function snapshot() {
  const active = runtimeState.gameMode.connected || runtimeState.gameMode.state === "running" || runtimeState.gameMode.state === "recovering";
  return {
    ok: true,
    version: runtimeState.version,
    runtime: {
      state: runtimeState.mode,
      active,
      bootedAt: runtimeState.bootedAt,
      uptimeMs: Date.now() - Date.parse(runtimeState.bootedAt)
    },
    gameMode: runtimeState.gameMode,
    jobs: Object.values(runtimeState.jobs),
    warnings: runtimeState.warnings,
    metrics: runtimeState.metrics
  };
}

function scheduleNextHidPoll(delayMs) {
  if (hidPollTimer) {
    clearTimeout(hidPollTimer);
  }
  hidPollTimer = setTimeout(async () => {
    if (!hidCheckInFlight) {
      hidCheckInFlight = true;
      try {
        await refreshControlState();
      } finally {
        hidCheckInFlight = false;
      }
    }
    scheduleNextHidPoll(HID_POLL_INTERVAL_MS);
  }, Math.max(500, delayMs));
  hidPollTimer.unref?.();
}

scheduleNextHidPoll(0);

const BMCTL_CACHE_TTL_MS = Number(process.env.BMCTL_CACHE_TTL_MS || 2000);
const bmctlCache = new Map(); // command -> { result, expiresAt, inflight: Promise|null }

function runBmctl(args) {
  return new Promise((resolve) => {
    execFile(BMCTL, args, { cwd: ROOT, timeout: 15000 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        stdout: String(stdout || ""),
        stderr: String(stderr || "")
      });
    });
  });
}

function runBmctlCached(command) {
  const now = Date.now();
  const entry = bmctlCache.get(command);
  // Return cached result if still fresh
  if (entry && entry.expiresAt > now) {
    return Promise.resolve(entry.result);
  }
  // Single-flight: reuse in-flight promise if one is already running
  if (entry && entry.inflight) {
    return entry.inflight;
  }
  const inflight = runBmctl([command]).then((result) => {
    bmctlCache.set(command, { result, expiresAt: Date.now() + BMCTL_CACHE_TTL_MS, inflight: null });
    return result;
  });
  bmctlCache.set(command, { result: entry?.result || null, expiresAt: entry?.expiresAt || 0, inflight });
  return inflight;
}

function json(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(`${body}\n`);
  scheduleStatusWrite(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let size = 0;
    let done = false;
    const fail = (error) => {
      if (done) return;
      done = true;
      reject(error);
    };
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const err = new Error("payload_too_large");
        err.status = 413;
        err.code = "payload_too_large";
        fail(err);
        return;
      }
      raw += chunk;
    });
    req.on("error", (error) => {
      fail(error);
    });
    req.on("end", () => {
      if (done) return;
      if (!raw) {
        done = true;
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          const err = new Error("invalid_json_body");
          err.status = 400;
          err.code = "invalid_json_body";
          fail(err);
          return;
        }
        done = true;
        resolve(parsed);
      } catch {
        const err = new Error("invalid_json");
        err.status = 400;
        err.code = "invalid_json";
        fail(err);
      }
    });
  });
}

function handleBodyError(res, err) {
  if (err && (err.code === "invalid_json" || err.code === "invalid_json_body")) {
    return json(res, 400, { ok: false, error: "invalid_json" });
  }
  if (err && err.code === "payload_too_large") {
    return json(res, 413, { ok: false, error: "payload_too_large", maxBodyBytes: MAX_BODY_BYTES });
  }
  if (err && err.message === "aborted") {
    return json(res, 400, { ok: false, error: "request_aborted" });
  }
  return json(res, 500, { ok: false, error: err?.message || "internal_error" });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");

  // Serve static files from public directory
  if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/styles.css" || url.pathname === "/app.js") {
    const filename = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const filePath = path.join(ROOT, "public", filename);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "application/javascript"
      };
      res.writeHead(200, { "content-type": mimeTypes[ext] || "text/plain" });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // GET /api/v1/profile
  if (url.pathname === "/api/v1/profile" && req.method === "GET") {
    try {
      if (fs.existsSync(PROFILE_PATH)) {
        const profile = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
        return json(res, 200, { ok: true, profile });
      } else {
        return json(res, 404, { ok: false, error: "profile_not_found" });
      }
    } catch (err) {
      return json(res, 500, { ok: false, error: err.message });
    }
  }

  // POST /api/v1/profile/sensitivity
  if (url.pathname === "/api/v1/profile/sensitivity" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      if (fs.existsSync(PROFILE_PATH)) {
        const profile = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
        profile.sensitivity = {
          LX: parseFiniteNumber(body.LX, parseFiniteNumber(profile.sensitivity?.LX, 1.0)),
          LY: parseFiniteNumber(body.LY, parseFiniteNumber(profile.sensitivity?.LY, 1.0)),
          RX: parseFiniteNumber(body.RX, parseFiniteNumber(profile.sensitivity?.RX, 1.0)),
          RY: parseFiniteNumber(body.RY, parseFiniteNumber(profile.sensitivity?.RY, 1.0))
        };
        profile.updatedAt = new Date().toISOString();
        fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2) + "\n");
        return json(res, 200, { ok: true, profile });
      } else {
        return json(res, 404, { ok: false, error: "profile_not_found" });
      }
    } catch (err) {
      return handleBodyError(res, err);
    }
  }

  // POST /api/v1/calibration/snapshot
  if (url.pathname === "/api/v1/calibration/snapshot" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      if (body.action === "reset") {
        if (fs.existsSync(PROFILE_PATH)) {
          const profile = JSON.parse(fs.readFileSync(PROFILE_PATH, "utf8"));
          profile.calibration = { offsets: { LX: 0, LY: 0, RX: 0, RY: 0 } };
          profile.updatedAt = new Date().toISOString();
          fs.writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2) + "\n");
          return json(res, 200, { ok: true, message: "Calibration reset successfully", profile });
        }
      }
      return json(res, 200, { ok: true, message: "Calibration triggered (auto-calibration will capture offsets when sticks are idle)" });
    } catch (err) {
      return handleBodyError(res, err);
    }
  }

  if (url.pathname === "/health") {
    return json(res, 200, { ok: true, version: runtimeState.version, service: "blackmamba-api", port: PORT });
  }

  if (url.pathname === "/ready") {
    const ready = runtimeState.gameMode.state === "running" || runtimeState.gameMode.state === "recovering";
    return json(res, ready ? 200 : 503, {
      ok: ready,
      version: runtimeState.version,
      ready,
      mode: runtimeState.mode
    });
  }

  if (url.pathname === "/api/v1/runtime") {
    return json(res, 200, snapshot());
  }

  if (url.pathname === "/api/status") {
    const result = await runBmctlCached("status");
    return json(res, result.ok ? 200 : 500, { ok: result.ok, command: "bmctl status", output: result.stdout, error: result.stderr || null });
  }

  if (url.pathname === "/api/doctor") {
    const result = await runBmctlCached("doctor");
    return json(res, result.ok ? 200 : 500, { ok: result.ok, command: "bmctl doctor", output: result.stdout, error: result.stderr || null });
  }

  if (url.pathname === "/api/verify") {
    const result = await runBmctlCached("verify");
    return json(res, result.ok ? 200 : 500, { ok: result.ok, command: "bmctl verify", output: result.stdout, error: result.stderr || null });
  }

  if (url.pathname === "/api/work") {
    const result = await runBmctlCached("work");
    return json(res, result.ok ? 200 : 500, { ok: result.ok, command: "bmctl work", output: result.stdout, error: result.stderr || null });
  }

  if (url.pathname === "/api/play") {
    const job = addJob("play");
    const result = await runBmctl(["play"]);
    job.state = result.ok ? "completed" : "failed";
    job.updatedAt = nowIso();
    job.result = { output: result.stdout, error: result.stderr || null, code: result.code };
    return json(res, result.ok ? 200 : 500, { ok: result.ok, version: runtimeState.version, job, command: "bmctl play", output: result.stdout, error: result.stderr || null });
  }

  if (url.pathname === "/api/v1/game/connect" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const gameMode = setGameMode("connected", { source: body.source || "api", label: body.label || "control", graceMs: body.graceMs });
      const job = addJob("game.connect", { body });
      job.state = "completed";
      job.updatedAt = nowIso();
      return json(res, 200, { ok: true, version: runtimeState.version, job, gameMode });
    } catch (err) {
      return handleBodyError(res, err);
    }
  }

  if (url.pathname === "/api/v1/game/disconnect" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const graceMs = normalizeGraceMs(body.graceMs);
      const gameMode = setGameMode("disconnected", { source: body.source || "api", label: body.label || "control", graceMs });
      const job = addJob("game.disconnect", { body });
      job.state = "accepted";
      job.updatedAt = nowIso();
      job.expiresAt = gameMode.graceEndsAt;
      setTimeout(() => {
        if (runtimeState.gameMode.state === "recovering" && runtimeState.gameMode.graceEndsAt && Date.now() >= Date.parse(runtimeState.gameMode.graceEndsAt)) {
          setGameMode("grace_expired", { source: "timer" });
        }
      }, Math.max(0, graceMs)).unref();
      return json(res, 202, { ok: true, version: runtimeState.version, job, gameMode, graceMs });
    } catch (err) {
      return handleBodyError(res, err);
    }
  }

  if (url.pathname === "/api/v1/game/reconnect" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const gameMode = setGameMode("reconnected", { source: body.source || "api", label: body.label || "control" });
      const job = addJob("game.reconnect", { body });
      job.state = "completed";
      job.updatedAt = nowIso();
      return json(res, 200, { ok: true, version: runtimeState.version, job, gameMode });
    } catch (err) {
      return handleBodyError(res, err);
    }
  }

  if (url.pathname === "/api/v1/game/close" && req.method === "POST") {
    runtimeState.gameMode.connected = false;
    runtimeState.gameMode.state = "stopped";
    runtimeState.gameMode.graceEndsAt = null;
    runtimeState.mode = "standby";
    hidDetected = false;
    if (graceTimer) clearTimeout(graceTimer);
    const job = addJob("game.close");
    job.state = "completed";
    job.updatedAt = nowIso();
    persistState();
    return json(res, 200, { ok: true, version: runtimeState.version, job, gameMode: runtimeState.gameMode });
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "not_found" }, null, 2));
});

server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.on("error", (err) => {
  console.error(`api-server listen error: ${err.message}`);
  process.exit(1);
});
server.on("clientError", (err, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
  if (err && err.code !== "ECONNRESET") {
    runtimeState.warnings.push({ type: "client_error", message: err.message, at: nowIso() });
    runtimeState.warnings = runtimeState.warnings.slice(-100);
    persistState();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`BlackMamba API listening on http://127.0.0.1:${PORT}`);
});

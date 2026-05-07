#!/usr/bin/env node
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { frameFromSample } = require("./translate-sample.js");

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_PROFILE = path.join(ROOT, "profiles", "rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function encodeWsFrame(value) {
  const payload = Buffer.from(JSON.stringify(value));
  const header = [];
  header.push(0x81);
  if (payload.length < 126) {
    header.push(payload.length);
  } else if (payload.length < 65536) {
    header.push(126, (payload.length >> 8) & 255, payload.length & 255);
  } else {
    header.push(127, 0, 0, 0, 0, (payload.length >> 24) & 255, (payload.length >> 16) & 255, (payload.length >> 8) & 255, payload.length & 255);
  }
  return Buffer.concat([Buffer.from(header), payload]);
}

function decodeWsFrames(buffer) {
  const messages = [];
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;

    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      const high = buffer.readUInt32BE(offset + 2);
      const low = buffer.readUInt32BE(offset + 6);
      if (high !== 0) throw new Error("WebSocket frame too large");
      length = low;
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameEnd = offset + headerLength + maskLength + length;
    if (frameEnd > buffer.length) break;

    let payload = buffer.subarray(offset + headerLength + maskLength, frameEnd);
    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
      payload = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
    }

    if (opcode === 0x8) {
      messages.push({ close: true });
    } else if (opcode === 0x1) {
      messages.push({ text: payload.toString("utf8") });
    }

    offset = frameEnd;
  }

  return { messages, rest: buffer.subarray(offset) };
}

function summarizeFrame(frame) {
  const events = [];
  for (const [name, transition] of Object.entries(frame.transitions || {})) {
    if (transition.justPressed) events.push({ type: "semantic", event: "pressed", name, source: frame.buttons?.[name]?.source, value: frame.buttons?.[name]?.value });
    if (transition.justReleased) events.push({ type: "semantic", event: "released", name, source: frame.buttons?.[name]?.source, value: frame.buttons?.[name]?.value });
  }
  return events;
}

function main() {
  const host = argValue("--host", "127.0.0.1");
  const port = Number(argValue("--port", "8137"));
  const profilePath = argValue("--profile", DEFAULT_PROFILE);
  const logPath = argValue("--log", path.join(ROOT, "logs", "live-events.jsonl"));
  const statusPath = argValue("--status", path.join(ROOT, "reports", "live-status.json"));
  const verbose = hasFlag("--verbose");
  const profile = readJson(profilePath);
  let previousFrame = null;
  let lastBrowserFrameAt = 0;
  let frameCount = 0;
  let clientCount = 0;
  const bootedAt = new Date().toISOString();

  ensureDir(logPath);
  ensureDir(statusPath);

  function writeEvent(event) {
    const row = { at: new Date().toISOString(), ...event };
    fs.appendFileSync(logPath, `${JSON.stringify(row)}\n`);
    if (verbose && (event.kind !== "browser-frame" || event.events?.length)) {
      console.log(JSON.stringify(row));
    }
  }

  function writeStatus(extra = {}) {
    const now = Date.now();
    const staleMs = lastBrowserFrameAt ? now - lastBrowserFrameAt : null;
    const status = {
      protocol: "blackmamba.live.status.v0",
      bootedAt,
      updatedAt: new Date().toISOString(),
      profilePath,
      device: profile.device,
      clients: clientCount,
      frameCount,
      lastBrowserFrameAt: lastBrowserFrameAt ? new Date(lastBrowserFrameAt).toISOString() : null,
      browserPolling: staleMs !== null && staleMs < 1500 ? "PASS" : "STALE_OR_EMPTY",
      staleMs,
      ...extra
    };
    fs.writeFileSync(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  }

  const server = http.createServer((req, res) => {
    if (req.url === "/status") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(fs.existsSync(statusPath) ? fs.readFileSync(statusPath) : "{}");
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("BlackMamba live monitor: connect WebSocket at /live\n");
  });

  const clients = new Set();

  function broadcast(message) {
    const frame = encodeWsFrame(message);
    for (const client of clients) {
      try {
        client.write(frame);
      } catch (err) {
        clients.delete(client);
      }
    }
  }

  server.on("upgrade", (req, socket) => {
    if (req.url !== "/live") {
      socket.destroy();
      return;
    }

    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.destroy();
      return;
    }

    const accept = crypto.createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");

    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      ""
    ].join("\r\n"));

    clients.add(socket);
    clientCount = clients.size;
    writeEvent({ kind: "browser-connected", clients: clientCount });
    writeStatus();
    socket.write(encodeWsFrame({ type: "hello", protocol: "blackmamba.live.v0", profile: profile.device }));

    let pending = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      pending = Buffer.concat([pending, chunk]);
      const decoded = decodeWsFrames(pending);
      pending = decoded.rest;

      for (const item of decoded.messages) {
        if (item.close) {
          socket.end();
          return;
        }

        const message = JSON.parse(item.text);
        if (message.type === "browser-frame" && message.sample) {
          lastBrowserFrameAt = Date.now();
          frameCount += 1;
          const frame = frameFromSample(message.sample, profile, previousFrame);
          previousFrame = frame;
          const { _heldMs, ...publicFrame } = frame;
          const events = summarizeFrame(publicFrame);
          
          writeEvent({
            kind: "browser-frame",
            device: message.device,
            sampleT: message.sample.t,
            frame: publicFrame,
            events
          });
          writeStatus({ lastDevice: message.device });
          
          // Broadcast the full semantic state and events to all clients
          broadcast({ 
            type: "semantic-frame", 
            frame: publicFrame, 
            events,
            device: message.device 
          });
        } else if (message.type === "heartbeat") {
          writeStatus({ heartbeat: message.at || new Date().toISOString() });
        }
      }
    });

    socket.on("close", () => {
      clients.delete(socket);
      clientCount = clients.size;
      writeEvent({ kind: "browser-disconnected", clients: clientCount });
      writeStatus();
    });

    socket.on("error", (error) => {
      clients.delete(socket);
      clientCount = clients.size;
      writeEvent({ kind: "browser-error", message: error.message });
    });
  });

  setInterval(() => writeStatus(), 1000).unref();
  server.listen(port, host, () => {
    writeEvent({ kind: "live-monitor-started", host, port, profilePath, logPath, statusPath });
    writeStatus();
    console.log(`Live monitor: ws://${host}:${port}/live`);
    console.log(`Status: ${statusPath}`);
    console.log(`Events: ${logPath}`);
  });
}

main();


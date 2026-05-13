#!/usr/bin/env node
const crypto = require("node:crypto");
const net = require("node:net");

function encodeWsFrame(value) {
  const payload = Buffer.from(JSON.stringify(value));
  const mask = crypto.randomBytes(4);
  const header = [];
  header.push(0x81);
  if (payload.length < 126) {
    header.push(0x80 | payload.length);
  } else {
    header.push(0x80 | 126, (payload.length >> 8) & 255, payload.length & 255);
  }
  const masked = Buffer.from(payload.map((byte, index) => byte ^ mask[index % 4]));
  return Buffer.concat([Buffer.from(header), mask, masked]);
}

function decodeServerFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const opcode = buffer[offset] & 0x0f;
    let length = buffer[offset + 1] & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      const high = buffer.readUInt32BE(offset + 2);
      const low = buffer.readUInt32BE(offset + 6);
      if (high !== 0) throw new Error("frame too large");
      length = low;
      headerLength = 10;
    }
    const end = offset + headerLength + length;
    if (end > buffer.length) break;
    if (opcode === 1) messages.push(buffer.subarray(offset + headerLength, end).toString("utf8"));
    offset = end;
  }
  return { messages, rest: buffer.subarray(offset) };
}

function sample(t, b1) {
  return {
    type: "browser-frame",
    device: {
      id: "smoke browser gamepad",
      index: 0,
      mapping: "",
      buttons: 2,
      axes: 10
    },
    sample: {
      t,
      buttons: [
        { pressed: false, touched: false, value: 0 },
        { pressed: b1 > 0.5, touched: b1 > 0.5, value: b1 }
      ],
      axes: [0.004, 0, 0, 0, 0, 0, 0, 0, 0, 1.286]
    }
  };
}

async function main() {
  const port = Number(process.argv[2] || 8137);
  const key = crypto.randomBytes(16).toString("base64");
  const socket = net.createConnection({ host: "127.0.0.1", port });
  let handshaken = false;
  let handshakeBuffer = Buffer.alloc(0);
  let pending = Buffer.alloc(0);
  let sawA = false;

  socket.setTimeout(5000);

  socket.on("connect", () => {
    socket.write([
      "GET /live HTTP/1.1",
      `Host: 127.0.0.1:${port}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      "",
      ""
    ].join("\r\n"));
  });

  socket.on("data", (chunk) => {
    if (!handshaken) {
      handshakeBuffer = Buffer.concat([handshakeBuffer, chunk]);
      const marker = Buffer.from("\r\n\r\n");
      const splitAt = handshakeBuffer.indexOf(marker);
      if (splitAt < 0) return;
      handshaken = true;
      socket.write(encodeWsFrame(sample(0, 0)));
      socket.write(encodeWsFrame(sample(50, 1)));
      socket.write(encodeWsFrame(sample(100, 0)));
      const rest = handshakeBuffer.subarray(splitAt + marker.length);
      if (rest.length) pending = Buffer.concat([pending, rest]);
      handshakeBuffer = Buffer.alloc(0);
    } else {
      pending = Buffer.concat([pending, chunk]);
    }

    const decoded = decodeServerFrames(pending);
    pending = decoded.rest;
    for (const messageText of decoded.messages) {
      if (process.env.DEBUG_SMOKE) console.log(messageText);
      const message = JSON.parse(messageText);
      if ((message.type === "semantic-events" || message.type === "semantic-frame") && message.events?.some((event) => event.name === "A" && event.event === "pressed")) {
        sawA = true;
        console.log("PASS: live monitor translated browser B1 into semantic A pressed");
        socket.destroy();
        process.exit(0);
      }
    }
  });

  socket.on("timeout", () => socket.destroy(new Error("timeout")));

  await new Promise((resolve, reject) => {
    socket.on("end", resolve);
    socket.on("close", resolve);
    socket.on("error", reject);
  });

  if (!sawA) {
    console.error("Smoke failed: semantic A pressed not observed");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

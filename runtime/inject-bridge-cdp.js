#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const debugPort = Number(process.env.DEBUG_PORT || process.argv[2] || 9224);
const targetUrl = process.env.URL || "https://www.xbox.com/play";
const bridgeSource = fs.readFileSync(path.join(root, "xbox-gamepad-bridge", "bridge.js"), "utf8");
const reuseExisting = process.env.REUSE_XCLOUD === "1" || process.argv.includes("--reuse");
const verifyOnly = process.env.VERIFY_ONLY === "1" || process.argv.includes("--verify");

async function cdp(wsUrl, fn) {
  const ws = new WebSocket(wsUrl);
  let seq = 0;
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
  };
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  try {
    return await fn(send);
  } finally {
    ws.close();
  }
}

async function main() {
  const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
  const browserWs = version.webSocketDebuggerUrl;

  const targetsBefore = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  let created = "";
  let existing = targetsBefore.find((item) => item.type === "page" && /xbox\\.com/.test(item.url || ""));

  if (reuseExisting || verifyOnly) {
    created = existing?.id || "";
  }

  if (!created && !verifyOnly) {
    created = await cdp(browserWs, async (send) => {
      const result = await send("Target.createTarget", { url: "about:blank" });
      return result.targetId;
    });
  }

  let target;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    target = created
      ? targets.find((item) => item.id === created)
      : targets.find((item) => item.type === "page" && /xbox\\.com/.test(item.url || ""));
    if (target?.webSocketDebuggerUrl) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!target?.webSocketDebuggerUrl) {
    throw new Error("No CDP target available");
  }

  await cdp(target.webSocketDebuggerUrl, async (send) => {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Page.bringToFront");
    if (verifyOnly) {
      const result = await send("Runtime.evaluate", {
        expression: `({
          installed: window.__xboxCloudGamepadBridgeInstalled === true,
          url: location.href,
          pads: Array.from(navigator.getGamepads()).filter(Boolean).map((g) => ({
            id: g.id,
            mapping: g.mapping,
            buttons: g.buttons.length,
            axes: g.axes.length,
            b0: g.buttons[0]?.value || 0,
            b1: g.buttons[1]?.value || 0,
            start: g.buttons[9]?.value || 0,
            dpadUp: g.buttons[12]?.value || 0
          }))
        })`,
        returnByValue: true
      });
      console.log(JSON.stringify(result.result.value, null, 2));
      return;
    }
    await send("Page.addScriptToEvaluateOnNewDocument", { source: bridgeSource });
    await send("Runtime.evaluate", { expression: bridgeSource, awaitPromise: false });
    if (!reuseExisting) {
      await send("Page.navigate", { url: targetUrl });
    }
  });

  console.log(`Injected bridge ${reuseExisting ? "into current Xbox tab" : `and opened: ${targetUrl}`}`);
  console.log(`Debug port: ${debugPort}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

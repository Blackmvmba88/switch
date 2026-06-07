#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const debugPort = Number(process.env.DEBUG_PORT || process.argv[2] || 9224);
const targetUrl = process.env.URL || "https://www.xbox.com/play";
const bridgeSource = fs.readFileSync(path.join(root, "xbox-gamepad-bridge", "bridge.js"), "utf8");
const reuseExisting = process.env.REUSE_XCLOUD === "1" || process.argv.includes("--reuse");
const verifyOnly = process.env.VERIFY_ONLY === "1" || process.argv.includes("--verify");
const bringToFront = process.env.BRING_TO_FRONT === "1" || process.argv.includes("--front");

function isXboxPlayTarget(item) {
  if (item.type !== "page") return false;
  const url = item.url || "";
  return /xbox\.com/.test(url) && /\/play(\/|$|\?)/.test(url) && !/\/auth\//.test(url);
}

function isXboxTarget(item) {
  if (item.type !== "page") return false;
  const url = item.url || "";
  return /xbox\.com/.test(url) && !/\/auth\//.test(url);
}

function chooseTarget(targets) {
  return targets.find(isXboxPlayTarget) || targets.find(isXboxTarget);
}

function collectFrameIds(frameTree, out = []) {
  if (!frameTree) return out;
  if (frameTree.frame?.id) out.push(frameTree.frame.id);
  for (const child of frameTree.childFrames || []) {
    collectFrameIds(child, out);
  }
  return out;
}

async function createWorld(send, frameId) {
  try {
    const result = await send("Page.createIsolatedWorld", {
      frameId,
      worldName: "blackmamba-xcloud-bridge",
      grantUniveralAccess: true
    });
    return result.executionContextId;
  } catch (_) {
    const result = await send("Page.createIsolatedWorld", {
      frameId,
      worldName: "blackmamba-xcloud-bridge"
    });
    return result.executionContextId;
  }
}

async function injectBridgeEverywhere(send) {
  await send("Page.addScriptToEvaluateOnNewDocument", { source: bridgeSource });
  await send("Runtime.evaluate", { expression: bridgeSource, awaitPromise: false });

  const tree = await send("Page.getFrameTree");
  const frameIds = collectFrameIds(tree.frameTree);
  let injectedFrames = 0;
  for (const frameId of frameIds) {
    try {
      const contextId = await createWorld(send, frameId);
      await send("Runtime.evaluate", {
        expression: bridgeSource,
        contextId,
        awaitPromise: false
      });
      injectedFrames += 1;
    } catch (_) {
      // Cross-origin frames can reject isolated-world injection. The main frame
      // injection above remains the critical path for xCloud.
    }
  }
  return injectedFrames;
}

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
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const target = chooseTarget(targets);
  if (!target) {
    if (verifyOnly) {
      console.log(JSON.stringify({ installed: false, error: "No xCloud page found" }, null, 2));
      return;
    }
    throw new Error("No xCloud page found in Chrome. Is it open?");
  }

  await cdp(target.webSocketDebuggerUrl, async (send) => {
    if (bringToFront) {
      await send("Page.bringToFront");
    }
    if (verifyOnly) {
      const result = await send("Runtime.evaluate", {
        expression: `(async () => {
          const snapshot = () => ({
            installed: typeof window.BlackMambaBridge !== "undefined",
            debug: {
              connected: window.BlackMambaBridge?.connected || false,
              hasFrame: !!window.BlackMambaBridge?.lastFrame,
              staleMs: window.BlackMambaBridge?.lastFrame ? Date.now() - window.BlackMambaBridge.lastFrame.t : -1,
              framesReceived: window.BlackMambaBridge?.framesReceived || 0
            },
            pads: (navigator.getGamepads ? Array.from(navigator.getGamepads()) : []).filter(Boolean).map(g => ({
              id: g.id,
              mapping: g.mapping,
              axes: g.axes.length,
              buttons: g.buttons.length
            }))
          });
          // Wait up to 5s for at least one frame if bridge is installed
          for (let i = 0; i < 20; i++) {
            const v = snapshot();
            if (v.installed && v.debug.hasFrame) return v;
            await new Promise(r => setTimeout(r, 250));
          }
          return snapshot();
        })()`,
        awaitPromise: true,
        returnByValue: true
      });
      console.log(JSON.stringify(result.result.value, null, 2));
      return;
    }
    const injectedFrames = await injectBridgeEverywhere(send);
    if (!reuseExisting) {
      await send("Page.navigate", { url: targetUrl });
    }
    console.log(`Injected frames: ${injectedFrames}`);
  });
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

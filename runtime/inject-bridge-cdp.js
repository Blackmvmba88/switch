#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const debugPort = Number(process.env.DEBUG_PORT || process.argv[2] || 9224);
const targetUrl = process.env.URL || "https://www.xbox.com/en-us/play/games/microsoft-flight-simulator-2024/9p38d19t7lrv";
const bridgeSource = fs.readFileSync(path.join(root, "xbox-gamepad-bridge", "bridge.js"), "utf8");
const reuseExisting = process.env.REUSE_XCLOUD === "1" || process.argv.includes("--reuse");
const verifyOnly = process.env.VERIFY_ONLY === "1" || process.argv.includes("--verify");
const bringToFront = process.env.BRING_TO_FRONT === "1" || process.argv.includes("--front");

function isXboxPlayTarget(item) {
  if (item.type !== "page") return false;
  const url = item.url || "";
  return /xbox\.com/.test(url) && (/(\/play(\/|$|\?))/.test(url) || /\/stream(\/|$|\?)/.test(url)) && !/\/auth\//.test(url);
}

function isXboxTarget(item) {
  if (item.type !== "page") return false;
  const url = item.url || "";
  return /xbox\.com/.test(url) && !/\/auth\//.test(url);
}

function chooseTarget(targets) {
  return targets.find(isXboxPlayTarget) || targets.find(isXboxTarget);
}

function xboxTargets(targets) {
  return targets.filter(isXboxTarget);
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
  const version = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
  const browserWs = version.webSocketDebuggerUrl;

  const targetsBefore = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const existing = chooseTarget(targetsBefore);
  const xboxOpenTargets = xboxTargets(targetsBefore);
  let targetId = "";
  let reusedExisting = false;
  let shouldNavigate = !verifyOnly;

  if ((reuseExisting || verifyOnly) && existing) {
    targetId = existing.id || "";
    reusedExisting = Boolean(targetId);
    shouldNavigate = false;
  }

  if (!targetId && verifyOnly) {
    throw new Error("No existing Xbox target available for verification");
  }

  if (!targetId && !verifyOnly) {
    targetId = await cdp(browserWs, async (send) => {
      const result = await send("Target.createTarget", { url: "about:blank" });
      return result.targetId;
    });
  }

  let target;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
    target = targetId
      ? targets.find((item) => item.id === targetId)
      : chooseTarget(targets);
    if (target?.webSocketDebuggerUrl) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  if (!target?.webSocketDebuggerUrl) {
    throw new Error("No CDP target available");
  }

  if (xboxOpenTargets.length > 1 && !verifyOnly) {
    const targetIdsToClose = xboxOpenTargets
      .filter((item) => item.id && item.id !== target.id)
      .map((item) => item.id);
    if (targetIdsToClose.length) {
      await cdp(browserWs, async (send) => {
        for (const targetIdToClose of targetIdsToClose) {
          try {
            await send("Target.closeTarget", { targetId: targetIdToClose });
          } catch (_) {
            // Ignore close failures; we still keep the chosen target.
          }
        }
      });
    }
  }

  await cdp(target.webSocketDebuggerUrl, async (send) => {
    await send("Page.enable");
    await send("Runtime.enable");
    if (bringToFront) {
      await send("Page.bringToFront");
    }
    if (verifyOnly) {
      const result = await send("Runtime.evaluate", {
        expression: `(async () => {
          const snapshot = () => ({
            installed: window.__xboxCloudGamepadBridgeInstalled === true,
            version: window.__xboxCloudGamepadBridgeVersion || null,
            url: location.href,
            debug: typeof window.__xboxCloudGamepadBridgeDebug === "function" ? window.__xboxCloudGamepadBridgeDebug() : null,
            pads: Array.from(navigator.getGamepads()).filter(Boolean).map((g) => ({
              id: g.id,
              mapping: g.mapping,
              buttons: g.buttons.length,
              axes: g.axes.length,
              lx: Number(g.axes[0] || 0).toFixed(3),
              ly: Number(g.axes[1] || 0).toFixed(3),
              rx: Number(g.axes[2] || 0).toFixed(3),
              ry: Number(g.axes[3] || 0).toFixed(3),
              b0: g.buttons[0]?.value || 0,
              b1: g.buttons[1]?.value || 0,
              lb: g.buttons[4]?.value || 0,
              rb: g.buttons[5]?.value || 0,
              lt: g.buttons[6]?.value || 0,
              rt: g.buttons[7]?.value || 0,
              back: g.buttons[8]?.value || 0,
              start: g.buttons[9]?.value || 0,
              l3: g.buttons[10]?.value || 0,
              r3: g.buttons[11]?.value || 0,
              guide: g.buttons[16]?.value || 0,
              dpadUp: g.buttons[12]?.value || 0,
              dpadDown: g.buttons[13]?.value || 0,
              dpadLeft: g.buttons[14]?.value || 0,
              dpadRight: g.buttons[15]?.value || 0
            }))
          });
          for (let i = 0; i < 20; i += 1) {
            const value = snapshot();
            if (value.pads.length) return value;
            await new Promise((resolve) => setTimeout(resolve, 250));
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
    if (shouldNavigate) {
      await send("Page.navigate", { url: targetUrl });
    }
    console.log(`Injected frames: ${injectedFrames}`);
  });

  const action = reusedExisting ? "into current Xbox tab" : `and opened: ${targetUrl}`;
  console.log(`Injected bridge ${action}`);
  console.log(`Debug port: ${debugPort}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

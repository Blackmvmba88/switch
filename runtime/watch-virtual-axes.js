#!/usr/bin/env node
const debugPort = Number(process.env.DEBUG_PORT || process.argv[2] || 9224);
const durationMs = Number(process.env.DURATION_MS || process.argv[3] || 15000);
const intervalMs = Number(process.env.INTERVAL_MS || 250);

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

function changed(a, b) {
  if (!a || !b) return true;
  return ["lx", "ly", "rx", "ry", "lt", "rt"].some((key) => Math.abs(Number(a[key]) - Number(b[key])) > 0.02);
}

async function main() {
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json();
  const target = targets.find((item) => item.type === "page" && /xbox\.com/.test(item.url || ""));
  if (!target?.webSocketDebuggerUrl) throw new Error("No Xbox CDP target available");

  console.log(`Watching virtual axes/triggers for ${Math.round(durationMs / 1000)}s. Move sticks or pull LT/RT now.`);
  await cdp(target.webSocketDebuggerUrl, async (send) => {
    await send("Runtime.enable");
    let previous = null;
    const started = Date.now();
    while (Date.now() - started < durationMs) {
      const result = await send("Runtime.evaluate", {
        expression: `(() => {
          const g = Array.from(navigator.getGamepads()).filter(Boolean)[0];
          if (!g) return null;
          return {
            t: new Date().toISOString(),
            id: g.id,
            mapping: g.mapping,
            lx: Number(g.axes[0] || 0).toFixed(3),
            ly: Number(g.axes[1] || 0).toFixed(3),
            rx: Number(g.axes[2] || 0).toFixed(3),
            ry: Number(g.axes[3] || 0).toFixed(3),
            lt: Number(g.buttons[6]?.value || 0).toFixed(3),
            rt: Number(g.buttons[7]?.value || 0).toFixed(3)
          };
        })()`,
        returnByValue: true
      });
      const value = result.result.value;
      if (changed(previous, value)) {
        console.log(JSON.stringify(value));
        previous = value;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  });
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

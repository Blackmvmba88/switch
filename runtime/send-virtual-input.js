#!/usr/bin/env node
const port = Number(process.env.BM_LIVE_PORT || 8137);
const control = String(process.argv[2] || "").trim();
const durationMs = Number(process.argv[3] || 500);
const rateMs = Number(process.env.BM_VIRTUAL_INPUT_RATE_MS || 33);

const buttonSources = {
  A: 1,
  B: 0,
  X: 3,
  Y: 2,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Back: 8,
  Select: 8,
  Start: 9,
  Menu: 9,
  L3: 10,
  R3: 11,
  Guide: 12
};

const axisControls = {
  LX_Left: { index: 0, value: -0.98 },
  LX_Right: { index: 0, value: 0.97 },
  LY_Up: { index: 1, value: -0.98 },
  LY_Down: { index: 1, value: 0.97 },
  RX_Left: { index: 2, value: -0.98 },
  RX_Right: { index: 2, value: 0.97 },
  RY_Up: { index: 3, value: -0.98 },
  RY_Down: { index: 3, value: 0.97 },
  DPad_Up: { index: 9, value: -1 },
  DPad_Right: { index: 9, value: -0.429 },
  DPad_Down: { index: 9, value: 0.143 },
  DPad_Left: { index: 9, value: 0.714 }
};

function usage() {
  console.log(`Usage:
  node runtime/send-virtual-input.js B 500
  node runtime/send-virtual-input.js RT 800
  node runtime/send-virtual-input.js Start 300

Controls:
  ${Object.keys(buttonSources).join(", ")}
  ${Object.keys(axisControls).join(", ")}`);
}

function button(value) {
  return { pressed: value > 0.5, touched: value > 0.05, value };
}

function sample(t, name, active) {
  const buttons = Array.from({ length: 17 }, () => button(0));
  const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.286];

  if (buttonSources[name] !== undefined) {
    buttons[buttonSources[name]] = button(active ? 1 : 0);
  } else if (axisControls[name]) {
    const axis = axisControls[name];
    axes[axis.index] = active ? axis.value : (axis.index === 9 ? 1.286 : 0);
  }

  return {
    type: "browser-frame",
    device: {
      id: "BlackMamba synthetic Xbox input",
      index: 0,
      mapping: "standard",
      buttons: buttons.length,
      axes: axes.length
    },
    sample: { t, buttons, axes }
  };
}

async function main() {
  if (!control || (!Object.hasOwn(buttonSources, control) && !Object.hasOwn(axisControls, control))) {
    usage();
    process.exit(control ? 1 : 0);
  }

  const ws = new WebSocket(`ws://127.0.0.1:${port}/live`);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  const started = Date.now();
  ws.send(JSON.stringify(sample(0, control, false)));
  while (Date.now() - started < durationMs) {
    ws.send(JSON.stringify(sample(Date.now() - started, control, true)));
    await new Promise((resolve) => setTimeout(resolve, rateMs));
  }
  ws.send(JSON.stringify(sample(durationMs + rateMs, control, false)));
  await new Promise((resolve) => setTimeout(resolve, rateMs * 2));
  ws.close();
  console.log(`sent ${control} for ${durationMs}ms through ws://127.0.0.1:${port}/live`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

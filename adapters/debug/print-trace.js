#!/usr/bin/env node
const fs = require("node:fs");

function usage() {
  console.log(`Usage:
  node adapters/debug/print-trace.js outputs/runtime-frames.json

Shows semantic button transitions as readable timeline rows.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function main() {
  const tracePath = process.argv[2];
  if (!tracePath || process.argv.includes("--help")) {
    usage();
    process.exit(tracePath ? 0 : 1);
  }

  const trace = readJson(tracePath);
  const frames = trace.frames || [];

  console.log(`time_ms  event       semantic       source  value`);
  console.log(`-------  ----------  -------------  ------  -----`);
  for (const frame of frames) {
    for (const [name, transition] of Object.entries(frame.transitions || {})) {
      if (!transition.justPressed && !transition.justReleased) {
        continue;
      }
      const state = frame.buttons?.[name] || {};
      const event = transition.justPressed ? "pressed" : "released";
      console.log(`${String(frame.timestampMs).padStart(7)}  ${event.padEnd(10)}  ${name.padEnd(13)}  ${String(state.source || "").padEnd(6)}  ${state.value ?? ""}`);
    }
  }
}

main();


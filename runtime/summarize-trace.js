#!/usr/bin/env node
const fs = require("node:fs");

function usage() {
  console.log(`Usage:
  node runtime/summarize-trace.js outputs/runtime-frames.json

Prints a compact summary of a Runtime Trace Protocol v0 file.`);
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
  const buttonStats = new Map();
  const axisStats = new Map();

  for (const frame of frames) {
    for (const [name, state] of Object.entries(frame.buttons || {})) {
      const stats = buttonStats.get(name) || {
        source: state.source,
        pressedFrames: 0,
        justPressed: 0,
        justReleased: 0,
        maxHeldMs: 0
      };
      if (state.pressed) stats.pressedFrames += 1;
      if (frame.transitions?.[name]?.justPressed) stats.justPressed += 1;
      if (frame.transitions?.[name]?.justReleased) stats.justReleased += 1;
      stats.maxHeldMs = Math.max(stats.maxHeldMs, frame.transitions?.[name]?.heldMs || 0);
      buttonStats.set(name, stats);
    }

    for (const [name, state] of Object.entries(frame.axes || {})) {
      const stats = axisStats.get(name) || {
        source: state.source,
        min: Infinity,
        max: -Infinity
      };
      stats.min = Math.min(stats.min, state.value);
      stats.max = Math.max(stats.max, state.value);
      axisStats.set(name, stats);
    }
  }

  console.log(`Trace: ${tracePath}`);
  console.log(`Protocol: ${trace.protocol || "unknown"}`);
  console.log(`Device: ${trace.profile?.device?.id || trace.profile?.device || "unknown"}`);
  console.log(`Frames: ${frames.length}`);
  console.log("");
  console.log("Buttons:");
  if (buttonStats.size === 0) {
    console.log("  none");
  } else {
    for (const [name, stats] of [...buttonStats.entries()].sort()) {
      console.log(`  ${name.padEnd(12)} ${String(stats.source).padEnd(4)} pressedFrames=${stats.pressedFrames} down=${stats.justPressed} up=${stats.justReleased} maxHeldMs=${stats.maxHeldMs}`);
    }
  }

  console.log("");
  console.log("Axes:");
  if (axisStats.size === 0) {
    console.log("  none");
  } else {
    for (const [name, stats] of [...axisStats.entries()].sort()) {
      console.log(`  ${name.padEnd(12)} ${String(stats.source).padEnd(4)} min=${stats.min} max=${stats.max}`);
    }
  }
}

main();


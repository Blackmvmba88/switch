#!/usr/bin/env node
const fs = require("node:fs");

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function eventsForFrame(frame) {
  const events = [];
  for (const [name, transition] of Object.entries(frame.transitions || {})) {
    if (transition.justPressed) events.push({ time: frame.timestampMs, event: "pressed", name, source: frame.buttons?.[name]?.source, value: frame.buttons?.[name]?.value });
    if (transition.justReleased) events.push({ time: frame.timestampMs, event: "released", name, source: frame.buttons?.[name]?.source, value: frame.buttons?.[name]?.value });
  }
  return events;
}

async function main() {
  const tracePath = argValue("--trace", process.argv[2] || "");
  const speed = Number(argValue("--speed", "0"));
  const expect = argValue("--expect", "");

  if (!tracePath || process.argv.includes("--help")) {
    console.log(`Usage:
  node runtime/replay-trace.js --trace outputs/runtime-frames.json [--speed 1] [--expect A]

speed=0 prints immediately. speed=1 replays approximate original timing.`);
    process.exit(tracePath ? 0 : 1);
  }

  const trace = JSON.parse(fs.readFileSync(tracePath, "utf8"));
  const frames = trace.frames || [];
  let previousT = frames[0]?.timestampMs || 0;
  let expectedSeen = !expect;

  console.log(`Replay: ${tracePath}`);
  console.log(`Frames: ${frames.length}`);

  for (const frame of frames) {
    if (speed > 0) {
      const delta = Math.max(0, frame.timestampMs - previousT);
      await sleep(delta / speed);
      previousT = frame.timestampMs;
    }

    for (const event of eventsForFrame(frame)) {
      if (event.name === expect && event.event === "pressed") expectedSeen = true;
      console.log(`${String(event.time).padStart(7)}ms ${event.event.padEnd(8)} ${event.name.padEnd(12)} ${String(event.source || "").padEnd(4)} value=${event.value}`);
    }
  }

  if (!expectedSeen) {
    console.error(`Expected semantic press not found: ${expect}`);
    process.exit(1);
  }
}

main();


#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");

function usage() {
  console.log(`Usage:
  node runtime/translate-sample.js --profile profiles/device.normalized.json --sample samples/session.json [--out outputs/frames.json]

Output:
  Runtime Frame Protocol v0: raw samples translated into semantic buttons/axes with transitions.`);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function round(value, digits = 3) {
  return Number(Number(value || 0).toFixed(digits));
}

function sourceValue(sample, binding) {
  if (!binding || !binding.source) {
    return 0;
  }

  if (binding.source.startsWith("B")) {
    const index = Number(binding.source.slice(1));
    return sample.buttons?.[index]?.value ?? 0;
  }

  if (binding.source.startsWith("A")) {
    const index = Number(binding.source.slice(1));
    return sample.axes?.[index] ?? 0;
  }

  return 0;
}

function normalizeAxis(raw, range, deadzone = 0.05) {
  if (!range || range.length !== 2) {
    return Math.abs(raw) < deadzone ? 0 : round(raw);
  }

  const [min, max] = range;
  const span = max - min;
  if (!Number.isFinite(span) || Math.abs(span) < 0.0001) {
    return 0;
  }

  const centered = ((raw - min) / span) * 2 - 1;
  const clamped = Math.max(-1, Math.min(1, centered));
  return Math.abs(clamped) < deadzone ? 0 : round(clamped);
}

function readAxisOffset(profile, source) {
  const value = profile?.calibration?.offsets?.[source];
  return Number.isFinite(value) ? value : 0;
}

function buttonActive(raw, binding) {
  if (!binding) {
    return false;
  }

  if (binding.kind === "axis") {
    const target = Number(binding.to);
    if (Number.isFinite(target)) {
      return Math.abs(raw - target) < 0.08;
    }
    return Math.abs(raw) > 0.5;
  }

  return raw > 0.5;
}

function frameFromSample(sample, profile, previousFrame) {
  const semantic = profile.semantic || {};
  const buttons = {};
  const axes = {};
  const transitions = {};
  const previousButtons = previousFrame?.buttons || {};
  const previousHeld = previousFrame?._heldMs || {};
  const previousTime = previousFrame?.timestampMs ?? sample.t ?? 0;
  const timestampMs = sample.t ?? 0;
  const deltaMs = Math.max(0, timestampMs - previousTime);
  const heldMs = {};

  for (const [name, binding] of Object.entries(semantic)) {
    const raw = sourceValue(sample, binding);

    if (binding.kind === "button" || name.startsWith("DPad_") || binding.kind === "axis" && name.match(/^(A|B|X|Y|LB|RB|LT|RT|Back|Start|L3|R3|Guide|DPad_)/)) {
      const pressed = buttonActive(raw, binding);
      const wasPressed = Boolean(previousButtons[name]?.pressed);
      buttons[name] = {
        pressed,
        value: round(raw),
        source: binding.source
      };
      heldMs[name] = pressed ? (previousHeld[name] || 0) + deltaMs : 0;
      transitions[name] = {
        justPressed: pressed && !wasPressed,
        justReleased: !pressed && wasPressed,
        heldMs: round(heldMs[name], 1)
      };
    }
  }

  for (const [name, binding] of Object.entries(semantic)) {
    if (!name.match(/^(LX|LY|RX|RY)$/)) {
      continue;
    }
    const raw = sourceValue(sample, binding);
    const range = profile.ranges?.[binding.source];
    const deadzone = profile.deadzones?.[binding.source] ?? 0.05;
    const offset = readAxisOffset(profile, binding.source);
    axes[name] = {
      value: normalizeAxis(raw - offset, range, deadzone),
      raw: round(raw),
      offset: round(offset),
      source: binding.source
    };
  }

  return {
    protocol: "blackmamba.runtime.frame.v0",
    timestampMs,
    buttons,
    axes,
    transitions,
    _heldMs: heldMs
  };
}

function normalizeSamplePayload(samplePayload) {
  const session = samplePayload.session || samplePayload;
  return session.rawSamples || [];
}

function main() {
  const profilePath = argValue("--profile");
  const samplePath = argValue("--sample");
  const outPath = argValue("--out");

  if (!profilePath || !samplePath || process.argv.includes("--help")) {
    usage();
    process.exit(profilePath || samplePath ? 0 : 1);
  }

  const profile = readJson(profilePath);
  const samples = normalizeSamplePayload(readJson(samplePath));
  let previousFrame = null;
  const frames = samples.map((sample) => {
    const frame = frameFromSample(sample, profile, previousFrame);
    previousFrame = frame;
    const { _heldMs, ...publicFrame } = frame;
    return publicFrame;
  });

  const output = {
    protocol: "blackmamba.runtime.trace.v0",
    generatedAt: new Date().toISOString(),
    profile: {
      path: profilePath,
      device: profile.device,
      layout: profile.layout,
      controllerFamily: profile.controllerFamily,
      dpadMode: profile.dpadMode,
      triggerMode: profile.triggerMode
    },
    source: {
      sample: samplePath,
      sampleCount: samples.length
    },
    frames
  };

  const finalOutPath = outPath || path.join("outputs", `runtime-frames-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(finalOutPath), { recursive: true });
  fs.writeFileSync(finalOutPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(finalOutPath);
}

module.exports = {
  buttonActive,
  frameFromSample,
  normalizeAxis,
  normalizeSamplePayload,
  sourceValue
};

if (require.main === module) {
  main();
}

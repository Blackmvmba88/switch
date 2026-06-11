#!/usr/bin/env node
const fs = require("node:fs");

function usage() {
  console.log(`Usage:
  node runtime/validate-profile.js profiles/device.normalized.json

Checks a normalized controller profile before the runtime trusts it.`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fail(errors, message) {
  errors.push(message);
}

function warn(warnings, message) {
  warnings.push(message);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateSource(source) {
  return typeof source === "string" && /^[AB]\d+$/.test(source);
}

function sourceKind(source) {
  return source?.startsWith("A") ? "axis" : "button";
}

function validateProfile(profile) {
  const errors = [];
  const warnings = [];

  if (!isObject(profile)) {
    fail(errors, "Profile root must be an object");
    return { errors, warnings };
  }

  if (profile.profileVersion !== 1) {
    fail(errors, "profileVersion must be 1");
  }

  if (!isObject(profile.device) || !profile.device.id) {
    fail(errors, "device.id is required");
  }

  if (!profile.layout) {
    warn(warnings, "layout is empty");
  }

  if (!["directinput-like", "xinput-like", "switch-native", "dualshock-like", "unknown"].includes(profile.controllerFamily)) {
    warn(warnings, `controllerFamily is unusual: ${profile.controllerFamily}`);
  }

  if (!["hat-axis", "buttons", "unknown"].includes(profile.dpadMode)) {
    warn(warnings, `dpadMode is unusual: ${profile.dpadMode}`);
  }

  if (!["buttons", "axes", "shared-axis", "unknown"].includes(profile.triggerMode)) {
    warn(warnings, `triggerMode is unusual: ${profile.triggerMode}`);
  }

  if (!isObject(profile.semantic) || Object.keys(profile.semantic).length === 0) {
    fail(errors, "semantic mappings are required");
  }

  const seenSources = new Map();
  for (const [name, binding] of Object.entries(profile.semantic || {})) {
    if (!isObject(binding)) {
      fail(errors, `semantic.${name} must be an object`);
      continue;
    }

    if (!validateSource(binding.source)) {
      fail(errors, `semantic.${name}.source must look like B0 or A9`);
    }

    if (!["button", "axis"].includes(binding.kind)) {
      fail(errors, `semantic.${name}.kind must be button or axis`);
    }

    if (Number.isFinite(binding.index) && validateSource(binding.source)) {
      const parsedIndex = Number(binding.source.slice(1));
      if (parsedIndex !== binding.index) {
        warn(warnings, `semantic.${name}.index (${binding.index}) does not match ${binding.source}`);
      }
    }

    if (Number.isFinite(binding.confidence) && (binding.confidence < 0 || binding.confidence > 1)) {
      fail(errors, `semantic.${name}.confidence must be between 0 and 1`);
    }

    if (validateSource(binding.source) && binding.kind && sourceKind(binding.source) !== binding.kind) {
      warn(warnings, `semantic.${name} uses ${binding.source} but kind is ${binding.kind}`);
    }

    if (validateSource(binding.source)) {
      const names = seenSources.get(binding.source) || [];
      names.push(name);
      seenSources.set(binding.source, names);
    }
  }

  for (const [source, names] of seenSources.entries()) {
    if (source.startsWith("B") && names.length > 1) {
      warn(warnings, `${source} is mapped to multiple semantic buttons: ${names.join(", ")}`);
    }
  }

  if (profile.dpadMode === "hat-axis") {
    if (!isObject(profile.dpad)) {
      fail(errors, "dpad object is required when dpadMode is hat-axis");
    } else if (!Number.isFinite(profile.dpad.axis)) {
      fail(errors, "dpad.axis must be a number for hat-axis profiles");
    }
  }

  for (const [source, range] of Object.entries(profile.ranges || {})) {
    if (!validateSource(source) || !source.startsWith("A")) {
      warn(warnings, `range key should be an axis source like A0: ${source}`);
      continue;
    }
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite)) {
      fail(errors, `ranges.${source} must be [min, max]`);
    } else if (range[0] >= range[1]) {
      fail(errors, `ranges.${source} min must be lower than max`);
    }
  }

  for (const [source, deadzone] of Object.entries(profile.deadzones || {})) {
    if (!validateSource(source) || !source.startsWith("A")) {
      warn(warnings, `deadzone key should be an axis source like A0: ${source}`);
      continue;
    }
    if (!Number.isFinite(deadzone) || deadzone < 0 || deadzone > 1) {
      fail(errors, `deadzones.${source} must be between 0 and 1`);
    }
  }

  return { errors, warnings };
}

function main() {
  const profilePath = process.argv[2];
  if (!profilePath || process.argv.includes("--help")) {
    usage();
    process.exit(profilePath ? 0 : 1);
  }

  const profile = readJson(profilePath);
  const result = validateProfile(profile);

  console.log(`Profile: ${profilePath}`);
  console.log(`Device: ${profile.device?.id || "unknown"}`);
  console.log(`Semantic bindings: ${Object.keys(profile.semantic || {}).length}`);

  for (const message of result.warnings) {
    console.log(`WARN: ${message}`);
  }

  for (const message of result.errors) {
    console.error(`ERROR: ${message}`);
  }

  if (result.errors.length > 0) {
    process.exit(1);
  }

  console.log("VALID");
}

if (require.main === module) {
  main();
}


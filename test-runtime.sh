#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="${ROOT}/.tmp-runtime-test"
SAMPLE_FIXTURE="${ROOT}/fixtures/rock-candy-sample-min.json"
PROFILE_FIXTURE="${ROOT}/fixtures/rock-candy-profile-test.normalized.json"
TRACE_OUT="${TMP_DIR}/runtime-frames.json"

mkdir -p "${TMP_DIR}"

echo "== Syntax checks =="
node --check "${ROOT}/runtime/translate-sample.js"
node --check "${ROOT}/runtime/validate-profile.js"
node --check "${ROOT}/runtime/summarize-trace.js"
node --check "${ROOT}/runtime/live-monitor.js"
node --check "${ROOT}/runtime/live-monitor-smoke.js"
node --check "${ROOT}/runtime/replay-trace.js"
node --check "${ROOT}/runtime/semantic-diff.js"
node --check "${ROOT}/runtime/network-game-mode.js"
node --check "${ROOT}/runtime/inject-bridge-cdp.js"
node --check "${ROOT}/runtime/apply-face-layout.js"
node --check "${ROOT}/runtime/send-virtual-input.js"
node --check "${ROOT}/adapters/debug/print-trace.js"
node --check "${ROOT}/app/server.js"
node --check "${ROOT}/app/public/app.js"
bash -n "${ROOT}/start-live-monitor.sh" "${ROOT}/stop-live-monitor.sh" "${ROOT}/controller-watchdog.sh" "${ROOT}/install-controller-watch-agent.sh" "${ROOT}/uninstall-controller-watch-agent.sh" "${ROOT}/install-live-monitor-agent.sh" "${ROOT}/uninstall-live-monitor-agent.sh" "${ROOT}/hid-raw-monitor.sh" "${ROOT}/press-a-live-test.sh" "${ROOT}/close-runtime.sh" "${ROOT}/repo-hygiene.sh"
CLANG_MODULE_CACHE_PATH="${TMP_DIR}/clang-module-cache" swiftc "${ROOT}/runtime/hid-raw-monitor.swift" -o "${TMP_DIR}/hid-raw-monitor"

echo "== JSON checks =="
node -e 'const fs=require("fs"); for (const f of process.argv.slice(1)) JSON.parse(fs.readFileSync(f,"utf8"));' \
  "${ROOT}"/device-signatures/*.json \
  "${SAMPLE_FIXTURE}" \
  "${PROFILE_FIXTURE}"

echo "== Profile validation =="
node "${ROOT}/runtime/validate-profile.js" "${PROFILE_FIXTURE}"

echo "== Translation =="
node "${ROOT}/runtime/translate-sample.js" \
  --profile "${PROFILE_FIXTURE}" \
  --sample "${SAMPLE_FIXTURE}" \
  --out "${TRACE_OUT}"

echo "== Trace assertions =="
node - "${TRACE_OUT}" <<'NODE'
const fs = require("fs");
const trace = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
function hasJustPressed(name) {
  return trace.frames.some((frame) => frame.transitions?.[name]?.justPressed === true);
}
for (const name of ["A", "B", "DPad_Up", "DPad_Right"]) {
  if (!hasJustPressed(name)) {
    console.error(`Missing justPressed for ${name}`);
    process.exit(1);
  }
}
console.log("Trace contains A, B, DPad_Up, DPad_Right transitions");
NODE

echo "== Control button assertions =="
node - "${PROFILE_FIXTURE}" <<'NODE'
const fs = require("fs");
const { frameFromSample } = require("./runtime/translate-sample.js");
const profile = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const controls = {
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  Back: 8,
  Start: 9,
  L3: 10,
  R3: 11,
  Guide: 12
};
for (const name of Object.keys(controls)) {
  if (!profile.semantic?.[name]) {
    console.error(`Missing semantic binding for ${name}`);
    process.exit(1);
  }
}
const makeButtons = (active = {}) => Array.from({ length: 17 }, (_, index) => ({
  pressed: Boolean(active[index]),
  touched: Boolean(active[index]),
  value: active[index] ? 1 : 0
}));
const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1.286];
let previous = frameFromSample({ t: 0, buttons: makeButtons(), axes }, profile, null);
let t = 50;
for (const [name, index] of Object.entries(controls)) {
  const frame = frameFromSample({ t, buttons: makeButtons({ [index]: true }), axes }, profile, previous);
  if (frame.transitions?.[name]?.justPressed !== true || frame.buttons?.[name]?.value !== 1) {
    console.error(`${name} did not translate from B${index} into a digital press`);
    process.exit(1);
  }
  previous = frameFromSample({ t: t + 50, buttons: makeButtons(), axes }, profile, frame);
  t += 100;
}
console.log("LB/RB/LT/RT/Back/Start/L3/R3/Guide translate from expected buttons");
NODE

echo "== Fortnite face layout assertions =="
node - <<'NODE'
const { applyLayout } = require("./runtime/apply-face-layout.js");
const profile = applyLayout({ layout: "switch-rock-candy:xbox-physical:xbox-physical", semantic: {
  A: { source: "B1" },
  B: { source: "B2", learnedBy: "control-room" },
  X: { source: "B3" },
  Y: { source: "B2" }
}}, "xbox-physical");
const expected = {
  A: { source: "B1", position: "bottom", printedLabel: "B" },
  B: { source: "B0", position: "right", printedLabel: "A" },
  X: { source: "B3", position: "left", printedLabel: "Y" },
  Y: { source: "B2", position: "top", printedLabel: "X" }
};
for (const [name, binding] of Object.entries(expected)) {
  for (const [key, value] of Object.entries(binding)) {
    if (profile.semantic[name]?.[key] !== value) {
      console.error(`${name}.${key} expected ${value}, got ${profile.semantic[name]?.[key]}`);
      process.exit(1);
    }
  }
}
if (profile.layout !== "switch-rock-candy:xbox-physical") {
  console.error(`Layout tag was not normalized: ${profile.layout}`);
  process.exit(1);
}
console.log("Fortnite/Xbox face buttons are position-correct and idempotent");
NODE

echo "== D-pad hat-axis assertions =="
node - "${PROFILE_FIXTURE}" <<'NODE'
const fs = require("fs");
const { frameFromSample } = require("./runtime/translate-sample.js");
const profile = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const expected = {
  DPad_Up: -1,
  DPad_Right: -0.429,
  DPad_Down: 0.143,
  DPad_Left: 0.714
};
const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
for (const [name, value] of Object.entries(expected)) {
  const axes = [0, 0, 0, 0, 0, 0, 0, 0, 0, value];
  const frame = frameFromSample({ t: 100, buttons, axes }, profile, null);
  if (frame.buttons?.[name]?.pressed !== true) {
    console.error(`${name} did not press from A9=${value}`);
    process.exit(1);
  }
  const others = Object.keys(expected).filter((item) => item !== name);
  for (const other of others) {
    if (frame.buttons?.[other]?.pressed) {
      console.error(`${name} leaked into ${other} at A9=${value}`);
      process.exit(1);
    }
  }
}
console.log("DPad_Up/Right/Down/Left decode cleanly from hat axis A9");
NODE

echo "== Trace summary =="
node "${ROOT}/runtime/summarize-trace.js" "${TRACE_OUT}"

echo "== Debug timeline =="
node "${ROOT}/adapters/debug/print-trace.js" "${TRACE_OUT}"

echo "== Replay assertion =="
node "${ROOT}/runtime/replay-trace.js" --trace "${TRACE_OUT}" --expect A

echo "== Semantic diff self-check =="
node "${ROOT}/runtime/semantic-diff.js" "${PROFILE_FIXTURE}" "${PROFILE_FIXTURE}" || {
  code="$?"
  if [[ "${code}" != "2" ]]; then
    exit "${code}"
  fi
}

echo "== Live monitor smoke =="
node "${ROOT}/runtime/live-monitor.js" \
  --port 8139 \
  --profile "${PROFILE_FIXTURE}" \
  --log "${TMP_DIR}/live-events.jsonl" \
  --status "${TMP_DIR}/live-status.json" > "${TMP_DIR}/live-monitor.log" 2>&1 &
LIVE_PID="$!"
trap 'kill "${LIVE_PID}" >/dev/null 2>&1 || true' EXIT
sleep 1
node "${ROOT}/runtime/live-monitor-smoke.js" 8139
kill "${LIVE_PID}" >/dev/null 2>&1 || true
trap - EXIT

echo "OK runtime robust"

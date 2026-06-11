#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAMPLE_DIR="${ROOT}/samples"
PROFILE_DIR="${ROOT}/profiles"
SOURCE="${1:-}"

if [[ -z "${SOURCE}" || ! -f "${SOURCE}" ]]; then
  echo "Usage: ./import-controller-sample.sh /path/to/controller-sample.json"
  exit 1
fi

mkdir -p "${SAMPLE_DIR}" "${PROFILE_DIR}"

STAMP="$(date '+%Y%m%d-%H%M%S')"
DEST="${SAMPLE_DIR}/controller-sample-${STAMP}.json"
cp "${SOURCE}" "${DEST}"

/usr/bin/python3 - "${DEST}" "${PROFILE_DIR}" <<'PY'
import json
import math
import re
import sys
from datetime import datetime
from pathlib import Path

path = sys.argv[1]
profile_dir = Path(sys.argv[2])
data = json.load(open(path))
session = data.get("session", data)
calibration = data.get("calibration", {})
profile = session.get("profile", {})
dpad = profile.get("dpad")
device = session.get("device") or data.get("device") or calibration.get("device") or {}
device_id = device.get("id", "unknown")
semantic = calibration.get("semantic", {})
raw_samples = session.get("rawSamples", [])

def slug(value):
    value = value.lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "unknown-controller"

def values_for_axis(index):
    values = []
    for sample in raw_samples:
        axes = sample.get("axes", [])
        if index < len(axes) and isinstance(axes[index], (int, float)):
            values.append(float(axes[index]))
    return values

def percentile(values, q):
    if not values:
        return 0.0
    ordered = sorted(values)
    pos = (len(ordered) - 1) * q
    lower = math.floor(pos)
    upper = math.ceil(pos)
    if lower == upper:
        return ordered[int(pos)]
    return ordered[lower] * (upper - pos) + ordered[upper] * (pos - lower)

def round3(value):
    return round(float(value), 3)

def infer_axis_ranges():
    ranges = {}
    deadzones = {}
    axes = profile.get("axes", {})
    for name, summary in axes.items():
        if not name.startswith("A"):
            continue
        try:
            index = int(name[1:])
        except ValueError:
            continue
        values = values_for_axis(index)
        if not values:
            continue
        min_value = min(values)
        max_value = max(values)
        if max_value - min_value < 0.05:
            continue
        ranges[name] = [round3(min_value), round3(max_value)]
        idle_window = values[: max(5, min(30, len(values) // 5 or 1))]
        idle_abs = [abs(value) for value in idle_window]
        idle_p95 = percentile(idle_abs, 0.95)
        deadzones[name] = round3(min(0.35, max(0.05, idle_p95 + 0.05)))
    return ranges, deadzones

def infer_layout():
    lower = device_id.lower()
    if "nintendo" in lower or "switch" in lower:
        return "switch-generic"
    if "xbox" in lower:
        return "xbox"
    return "unknown"

ranges, deadzones = infer_axis_ranges()
normalized = {
    "profileVersion": 1,
    "generatedAt": datetime.now().isoformat(timespec="seconds"),
    "device": {
        "id": device_id,
        "mapping": device.get("mapping", ""),
        "buttons": device.get("buttons"),
        "axes": device.get("axes"),
    },
    "layout": infer_layout(),
    "controllerFamily": calibration.get("controllerFamily", "directinput-like"),
    "dpadMode": calibration.get("dpadMode") or ("hat-axis" if dpad else "unknown"),
    "triggerMode": calibration.get("triggerMode", "unknown"),
    "semantic": semantic,
    "ranges": ranges,
    "deadzones": deadzones,
    "dpad": dpad,
    "evidence": {
        "sampleFile": path,
        "sampleCount": session.get("sampleCount", len(raw_samples)),
        "durationMs": session.get("durationMs"),
    },
}

out = profile_dir / f"{slug(device_id)}.normalized.json"
with out.open("w") as handle:
    json.dump(normalized, handle, indent=2)
    handle.write("\n")

print(f"Imported: {path}")
print(f"Device: {device_id}")
print(f"Samples: {session.get('sampleCount', len(raw_samples))}")
if dpad:
    print(f"D-Pad: {dpad.get('type')} on A{dpad.get('axis')}")
    print("Observed states:", ", ".join(map(str, dpad.get("observedStates", []))))
else:
    print("D-Pad: not inferred")
print(f"Semantic bindings: {len(semantic)}")
print(f"Ranges inferred: {len(ranges)}")
print(f"Profile: {out}")
PY

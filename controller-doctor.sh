#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPORT_DIR="${ROOT}/reports"
SIGNATURE_DIR="${ROOT}/device-signatures"
CONTROL_PATTERN="${CONTROL_PATTERN:-Rock Candy|Nintendo|Switch|0xe6f|0x187|Xbox|0x045e|DualSense|0x054c|8BitDo|Mayflash|MAGIC-NS|MAGIC-X}"
TARGET="${TARGET:-xcloud}"
WATCH_INTERVAL="${WATCH_INTERVAL:-3}"

mkdir -p "${REPORT_DIR}"

usage() {
  cat <<'HELP'
controller-doctor

Usage:
  ./controller-doctor.sh doctor
  ./controller-doctor.sh detect
  ./controller-doctor.sh baseline rock-candy-switch-wired
  ./controller-doctor.sh matrix
  ./controller-doctor.sh watch
  ./controller-doctor.sh export-json [baseline-id]
  ./controller-doctor.sh export-md [baseline-id]
  ./controller-doctor.sh list-signatures

Environment:
  CONTROL_PATTERN="Rock Candy|Xbox|..." ./controller-doctor.sh doctor
  TARGET=xcloud ./controller-doctor.sh export-md
HELP
}

has_app() {
  [[ -d "/Applications/$1.app" ]]
}

grep_i() {
  local pattern="$1"
  if command -v rg >/dev/null 2>&1; then
    rg -i "${pattern}" || true
  else
    grep -Ei "${pattern}" || true
  fi
}

hid_rows() {
  hidutil list 2>/dev/null | grep_i "${CONTROL_PATTERN}" || true
}

hid_visible() {
  [[ -n "$(hid_rows)" ]]
}

matched_signature() {
  local rows
  local rows_lc
  rows="$(hid_rows)"
  rows_lc="$(printf '%s\n' "${rows}" | tr '[:upper:]' '[:lower:]')"

  while IFS= read -r sig; do
    local vendor
    local product
    local name
    local aliases

    vendor="$(signature_value "${sig}" vendorId | tr '[:upper:]' '[:lower:]')"
    product="$(signature_value "${sig}" productId | tr '[:upper:]' '[:lower:]')"
    name="$(signature_value "${sig}" name | tr '[:upper:]' '[:lower:]')"
    aliases="$(signature_value "${sig}" aliases | tr '[:upper:]' '[:lower:]')"

    if [[ "${vendor}" != "unknown" && "${product}" != "unknown" && "${rows_lc}" == *"${vendor}"* && "${rows_lc}" == *"${product}"* ]]; then
      echo "${sig}"
      return
    fi

    if [[ -n "${name}" && "${rows_lc}" == *"${name}"* ]]; then
      echo "${sig}"
      return
    fi

    if [[ -n "${aliases}" ]]; then
      IFS=';' read -ra parts <<< "${aliases}"
      for part in "${parts[@]}"; do
        part="$(printf '%s' "${part}" | sed 's/^ *//; s/ *$//')"
        if [[ -n "${part}" && "${rows_lc}" == *"${part}"* ]]; then
          echo "${sig}"
          return
        fi
      done
    fi
  done < <(list_signatures)

  echo ""
}

signature_value() {
  local file="$1"
  local key="$2"

  if [[ ! -f "${file}" ]]; then
    echo ""
    return
  fi

  /usr/bin/python3 - "$file" "$key" <<'PY'
import json
import sys

path, dotted = sys.argv[1], sys.argv[2]
data = json.load(open(path))
value = data
for part in dotted.split("."):
    if isinstance(value, dict):
        value = value.get(part, "")
    else:
        value = ""
        break
if isinstance(value, bool):
    print("true" if value else "false")
elif isinstance(value, list):
    print("; ".join(str(item) for item in value))
else:
    print(value)
PY
}

status_from_value() {
  case "${1:-}" in
    true)
      echo "PASS"
      ;;
    false)
      echo "FAIL"
      ;;
    expected)
      echo "EXPECTED"
      ;;
    blocked_by_login)
      echo "BLOCKED_BY_LOGIN"
      ;;
    unknown|"")
      echo "UNKNOWN"
      ;;
    *)
      echo "$1"
      ;;
  esac
}

ready_from_value() {
  case "${1:-}" in
    true)
      echo "YES"
      ;;
    false)
      echo "NO"
      ;;
    expected)
      echo "EXPECTED"
      ;;
    *)
      echo "UNKNOWN"
      ;;
  esac
}

score_report() {
  local sig="$1"
  local mode="${2:-live}"
  local hid="FAIL"
  local browser="UNKNOWN"
  local xinput="UNKNOWN"
  local xcloud="UNKNOWN"
  local ready="UNKNOWN"
  local confidence="0.00"
  local recommendation="Run browser validation and add a known device signature."

  if [[ "${mode}" == "baseline" && -n "${sig}" && "$(signature_value "${sig}" knownGood.macosHid)" == "true" ]]; then
    hid="PASS"
  elif hid_visible; then
    hid="PASS"
  fi

  if [[ -n "${sig}" ]]; then
    browser="$(status_from_value "$(signature_value "${sig}" knownGood.browserGamepadApi)")"

    if [[ "$(signature_value "${sig}" classification.xinputIdentity)" == "true" ]]; then
      xinput="PASS"
      confidence="0.90"
    elif [[ "$(signature_value "${sig}" classification.xinputIdentity)" == "expected" ]]; then
      xinput="EXPECTED"
      confidence="0.74"
    else
      xinput="FAIL"
      confidence="0.22"
    fi

    xcloud="$(status_from_value "$(signature_value "${sig}" knownGood.xcloudDirect)")"
    ready="$(ready_from_value "$(signature_value "${sig}" classification.cloudGamingReady)")"

    recommendation="$(signature_value "${sig}" classification.recommendedPath)"
  elif [[ "${hid}" == "PASS" ]]; then
    browser="NEEDS_TEST"
    xinput="NEEDS_TEST"
    xcloud="NEEDS_TEST"
    ready="UNKNOWN"
    confidence="0.40"
  fi

  cat <<EOF
HID visible: ${hid}
Browser Gamepad API: ${browser}
XInput identity: ${xinput}
${TARGET} direct support: ${xcloud}
Xbox identity confidence: ${confidence}
cloud gaming ready: ${ready}
Recommendation: ${recommendation}
EOF
}

doctor() {
  local sig
  sig="$(matched_signature)"

  echo "== controller-doctor =="
  echo "Target: ${TARGET}"
  echo

  if hid_visible; then
    echo "Detected HID rows:"
    hid_rows
  else
    echo "No matching controller detected."
  fi

  echo
  if [[ -n "${sig}" ]]; then
    echo "Matched signature: $(basename "${sig}")"
    echo "Device: $(signature_value "${sig}" name)"
  else
    echo "Matched signature: none"
  fi

  echo
  score_report "${sig}"

  echo
  echo "Apps:"
  if has_app "Google Chrome"; then echo "Chrome: PASS"; else echo "Chrome: FAIL"; fi
  if has_app "Safari"; then echo "Safari: PASS"; else echo "Safari: FAIL"; fi
  if has_app "Steam"; then echo "Steam: PASS"; else echo "Steam: FAIL"; fi
}

detect() {
  echo "== controller-doctor detect =="
  echo "Pattern: ${CONTROL_PATTERN}"
  echo
  if hid_visible; then
    hid_rows
  else
    echo "No matching HID rows."
  fi
}

link_latest() {
  local out="$1"
  local kind="$2"
  ln -sfn "$(basename "${out}")" "${REPORT_DIR}/latest.${kind}"
}

export_json() {
  local baseline_id="${1:-}"
  local sig
  local out
  local rows
  if [[ -n "${baseline_id}" ]]; then
    sig="${SIGNATURE_DIR}/${baseline_id}.json"
    if [[ ! -f "${sig}" ]]; then
      echo "Firma no encontrada: ${baseline_id}" >&2
      exit 1
    fi
  else
    sig="$(matched_signature)"
  fi
  out="${REPORT_DIR}/controller-report-$(date '+%Y%m%d-%H%M%S').json"
  rows="$(hid_rows)"

  /usr/bin/python3 - "$out" "$sig" "$TARGET" "$rows" "$baseline_id" <<'PY'
import json
import sys
from datetime import datetime

out, sig, target, rows, baseline_id = sys.argv[1:6]
signature = None
if sig:
    with open(sig) as handle:
        signature = json.load(handle)

known = signature.get("knownGood", {}) if signature else {}
classification = signature.get("classification", {}) if signature else {}
mode = "baseline" if baseline_id else "live"
hid_visible = bool(rows.strip())
if mode == "baseline" and known.get("macosHid") is True:
    hid_visible = True

report = {
    "generatedAt": datetime.now().isoformat(timespec="seconds"),
    "target": target,
    "mode": mode,
    "hidRows": [line for line in rows.splitlines() if line.strip()],
    "signature": signature,
    "checks": {
        "hidVisible": hid_visible,
        "browserGamepadApi": known.get("browserGamepadApi", "unknown"),
        "xinputIdentity": classification.get("xinputIdentity", "unknown"),
        "targetDirectSupport": known.get("xcloudDirect", "unknown"),
        "cloudGamingReady": classification.get("cloudGamingReady", "unknown"),
    },
    "recommendation": classification.get("recommendedPath", "Run browser validation and add a known device signature."),
}

with open(out, "w") as handle:
    json.dump(report, handle, indent=2)
    handle.write("\n")

print(out)
PY
  link_latest "${out}" "json"
}

export_md() {
  local baseline_id="${1:-}"
  local sig
  local out
  local mode="live"
  if [[ -n "${baseline_id}" ]]; then
    sig="${SIGNATURE_DIR}/${baseline_id}.json"
    mode="baseline"
    if [[ ! -f "${sig}" ]]; then
      echo "Firma no encontrada: ${baseline_id}" >&2
      exit 1
    fi
  else
    sig="$(matched_signature)"
  fi
  out="${REPORT_DIR}/controller-report-$(date '+%Y%m%d-%H%M%S').md"

  {
    echo "# Controller Doctor Report"
    echo
    echo "- Generated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "- Target: ${TARGET}"
    echo "- Mode: ${mode}"
    echo
    echo "## HID"
    echo
    if [[ "${mode}" == "baseline" ]]; then
      echo "Baseline mode: using stored evidence from the matched signature."
    elif hid_visible; then
      echo '```text'
      hid_rows
      echo '```'
    else
      echo "No matching controller detected."
    fi
    echo
    echo "## Signature"
    echo
    if [[ -n "${sig}" ]]; then
      echo "- File: ${sig}"
      echo "- Device: $(signature_value "${sig}" name)"
    else
      echo "- File: none"
    fi
    echo
    echo "## Compatibility"
    echo
    echo '```text'
    score_report "${sig}" "${mode}"
    echo '```'
  } > "${out}"

  link_latest "${out}" "md"
  echo "${out}"
}

list_signatures() {
  find "${SIGNATURE_DIR}" -maxdepth 1 -type f -name '*.json' -print | sort
}

baseline() {
  local id="${1:-}"
  local sig="${SIGNATURE_DIR}/${id}.json"

  if [[ -z "${id}" || ! -f "${sig}" ]]; then
    echo "Firma no encontrada. Disponibles:"
    list_signatures
    exit 1
  fi

  echo "== controller-doctor baseline =="
  echo "Device: $(signature_value "${sig}" name)"
  echo "Signature: ${sig}"
  echo
  score_report "${sig}" baseline
  echo
  echo "Notes: $(signature_value "${sig}" notes)"
}

matrix() {
  echo "== controller-doctor compatibility matrix =="
  printf '%-30s %-10s %-12s %-10s %-12s\n' "device" "hid" "browser-api" "xinput" "xcloud"
  printf '%-30s %-10s %-12s %-10s %-12s\n' "------" "---" "-----------" "------" "------"

  while IFS= read -r sig; do
    local name
    local hid
    local browser
    local xinput
    local xcloud
    name="$(signature_value "${sig}" id)"
    hid="$(status_from_value "$(signature_value "${sig}" knownGood.macosHid)")"
    browser="$(status_from_value "$(signature_value "${sig}" knownGood.browserGamepadApi)")"
    xinput="$(status_from_value "$(signature_value "${sig}" classification.xinputIdentity)")"
    xcloud="$(status_from_value "$(signature_value "${sig}" knownGood.xcloudDirect)")"
    printf '%-30s %-10s %-12s %-10s %-12s\n' "${name}" "${hid}" "${browser}" "${xinput}" "${xcloud}"
  done < <(list_signatures)
}

watch() {
  local previous="unknown"
  local current

  echo "== controller-doctor watch =="
  echo "Interval: ${WATCH_INTERVAL}s"
  echo "Reports: ${REPORT_DIR}/latest.json and ${REPORT_DIR}/latest.md"
  echo "Waiting for controller changes..."
  echo

  while true; do
    if hid_visible; then
      current="connected"
    else
      current="disconnected"
    fi

    if [[ "${current}" != "${previous}" ]]; then
      printf '%s state=%s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "${current}"
      doctor
      echo
      if [[ "${current}" == "connected" ]]; then
        export_json >/dev/null
        export_md >/dev/null
        echo "Report updated:"
        echo "  ${REPORT_DIR}/latest.json"
        echo "  ${REPORT_DIR}/latest.md"
      fi
      echo
      previous="${current}"
    fi

    sleep "${WATCH_INTERVAL}"
  done
}

case "${1:-doctor}" in
  doctor)
    doctor
    ;;
  detect)
    detect
    ;;
  export-json)
    export_json "${2:-}"
    ;;
  export-md)
    export_md "${2:-}"
    ;;
  list-signatures)
    list_signatures
    ;;
  baseline)
    baseline "${2:-}"
    ;;
  matrix)
    matrix
    ;;
  watch)
    watch
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

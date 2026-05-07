#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
AGENT_DIR="${HOME}/Library/LaunchAgents"
LABEL="com.blackmamba.controller-watchdog"
PLIST="${AGENT_DIR}/${LABEL}.plist"
AGENT_SCRIPT="${APP_ROOT}/controller-watchdog-agent.sh"

mkdir -p "${APP_ROOT}/logs" "${APP_ROOT}/reports" "${AGENT_DIR}"

cat > "${AGENT_SCRIPT}" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
LOG_DIR="${APP_ROOT}/logs"
REPORT_DIR="${APP_ROOT}/reports"
CONTROL_PATTERN="${CONTROL_PATTERN:-Rock Candy|Nintendo|Switch|0xe6f|0x187|Xbox|0x045e|DualSense|0x054c|8BitDo|Mayflash|MAGIC-NS|MAGIC-X}"
WATCHDOG_INTERVAL="${WATCHDOG_INTERVAL:-3}"

mkdir -p "${LOG_DIR}" "${REPORT_DIR}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "${LOG_DIR}/controller-watchdog.log"
}

hid_rows() {
  hidutil list 2>/dev/null | grep -Ei "${CONTROL_PATTERN}" || true
}

write_report() {
  local state="$1"
  local rows="$2"
  local json="${REPORT_DIR}/latest.json"
  local md="${REPORT_DIR}/latest.md"
  /usr/bin/python3 - "$json" "$state" "$rows" <<'PY'
import json
import sys
from datetime import datetime
out, state, rows = sys.argv[1:4]
report = {
  "protocol": "blackmamba.launchagent.hid-watch.v0",
  "generatedAt": datetime.now().isoformat(timespec="seconds"),
  "state": state,
  "hidVisible": state == "connected",
  "hidRows": [line for line in rows.splitlines() if line.strip()],
}
with open(out, "w") as handle:
  json.dump(report, handle, indent=2)
  handle.write("\n")
PY
  {
    echo "# BlackMamba HID Watch"
    echo
    echo "- Generated: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "- State: ${state}"
    echo
    if [[ -n "${rows}" ]]; then
      echo '```text'
      printf '%s\n' "${rows}"
      echo '```'
    else
      echo "No matching HID rows."
    fi
  } > "${md}"
}

main() {
  local previous="unknown"
  log "launchagent watchdog started interval=${WATCHDOG_INTERVAL}s"
  while true; do
    rows="$(hid_rows)"
    if [[ -n "${rows}" ]]; then
      current="connected"
    else
      current="disconnected"
    fi

    if [[ "${current}" != "${previous}" ]]; then
      log "state=${current}"
      write_report "${current}" "${rows}"
      previous="${current}"
    fi

    sleep "${WATCHDOG_INTERVAL}"
  done
}

main
SCRIPT

chmod +x "${AGENT_SCRIPT}"

cat > "${PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${AGENT_SCRIPT}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${APP_ROOT}/logs/launchd.out.log</string>
  <key>StandardErrorPath</key>
  <string>${APP_ROOT}/logs/launchd.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed LaunchAgent: ${PLIST}"
echo "Agent script: ${AGENT_SCRIPT}"
echo "Project root: ${PROJECT_ROOT}"
echo "Logs:"
echo "  ${APP_ROOT}/logs/controller-watchdog.log"
echo "Reports:"
echo "  ${APP_ROOT}/reports/latest.json"
echo "  ${APP_ROOT}/reports/latest.md"

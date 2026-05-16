#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
DEBUG_PORT="${DEBUG_PORT:-9224}"
PROFILE_DIR="${PROFILE_DIR:-/tmp/blackmamba-xcloud-cdp-profile}"
INCLUDE_APP="${1:-}"

stop_agent() {
  local label="$1"
  local plist="${HOME}/Library/LaunchAgents/${label}.plist"
  launchctl bootout "gui/$(id -u)" "${plist}" >/dev/null 2>&1 || true
}

kill_pid_file() {
  local file="$1"
  if [[ -f "${file}" ]]; then
    local pid
    pid="$(cat "${file}" 2>/dev/null || true)"
    if [[ -n "${pid}" ]]; then
      pkill -P "${pid}" >/dev/null 2>&1 || true
      kill "${pid}" >/dev/null 2>&1 || true
    fi
    rm -f "${file}"
  fi
}

kill_matching() {
  local pattern="$1"
  while IFS= read -r pid; do
    [[ -z "${pid}" ]] && continue
    pkill -P "${pid}" >/dev/null 2>&1 || true
    kill "${pid}" >/dev/null 2>&1 || true
  done < <(pgrep -f "${pattern}" || true)
}

echo "== cerrando BlackMamba game runtime =="

stop_agent "com.blackmamba.xcloud-bridge"
stop_agent "com.blackmamba.hid-live-source"
stop_agent "com.blackmamba.live-monitor"

kill_pid_file "${PROFILE_DIR}/chrome.pid"
kill_pid_file "${ROOT}/logs/hid-live-source.pid"
kill_pid_file "${APP_ROOT}/logs/hid-live-source.pid"

kill_matching "xcloud-bridge-agent.js"
kill_matching "live-monitor.js --port 8137|runtime/live-monitor.js"
kill_matching "hid-live-source-agent.sh|[.]tmp-runtime-test/hid-live-source|BlackMambaInput/[.]tmp-runtime-test/hid-live-source"
kill_matching "remote-debugging-port=${DEBUG_PORT}.*blackmamba-xcloud-cdp-profile|blackmamba-xcloud-cdp-profile.*remote-debugging-port=${DEBUG_PORT}"

if [[ "${INCLUDE_APP}" == "--include-app" ]]; then
  stop_agent "com.blackmamba.control-room"
  kill_matching "app/server.js.*8147|app/server.js"
fi

echo "Runtime cerrado. Para volver a jugar: ./bmctl game-on"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
WATCHDOG_LOG="${LOG_DIR}/controller-watchdog.log"
CONTROL_PATTERN="${CONTROL_PATTERN:-Rock Candy|Nintendo|Switch|0xe6f|0x187|Xbox|0x045e|DualSense|0x054c|8BitDo|Mayflash|MAGIC-NS|MAGIC-X}"
WATCHDOG_INTERVAL="${WATCHDOG_INTERVAL:-5}"
STALE_SECONDS="${STALE_SECONDS:-12}"

mkdir -p "${LOG_DIR}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${WATCHDOG_LOG}"
}

hid_visible() {
  if command -v rg >/dev/null 2>&1; then
    [[ -n "$(hidutil list 2>/dev/null | rg -i "${CONTROL_PATTERN}" || true)" ]]
  else
    [[ -n "$(hidutil list 2>/dev/null | grep -Ei "${CONTROL_PATTERN}" || true)" ]]
  fi
}

watcher_alive() {
  local pid_file="${LOG_DIR}/controller-doctor-watch.pid"
  [[ -f "${pid_file}" ]] && kill -0 "$(cat "${pid_file}")" >/dev/null 2>&1
}

restart_watcher() {
  log "watcher missing; restarting controller-doctor watch"
  rm -f "${LOG_DIR}/controller-doctor-watch.pid"
  "${ROOT}/start-controller-watch.sh" >> "${WATCHDOG_LOG}" 2>&1 || true
}

main() {
  local previous="unknown"
  local missing_since=""

  log "watchdog started interval=${WATCHDOG_INTERVAL}s stale=${STALE_SECONDS}s"
  while true; do
    if ! watcher_alive; then
      restart_watcher
    fi

    if hid_visible; then
      if [[ "${previous}" != "connected" ]]; then
        log "hid connected"
      fi
      previous="connected"
      missing_since=""
    else
      if [[ "${previous}" != "disconnected" ]]; then
        log "hid disconnected"
        missing_since="$(date +%s)"
      fi
      previous="disconnected"

      if [[ -n "${missing_since}" ]]; then
        now="$(date +%s)"
        if (( now - missing_since >= STALE_SECONDS )); then
          log "hid still missing after ${STALE_SECONDS}s; watcher remains armed"
          missing_since="${now}"
        fi
      fi
    fi

    sleep "${WATCHDOG_INTERVAL}"
  done
}

main

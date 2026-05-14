#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBUG_PORT="${DEBUG_PORT:-9224}"
PROFILE_DIR="${PROFILE_DIR:-/tmp/blackmamba-xcloud-cdp-profile}"
URL="${URL:-https://www.xbox.com/play}"
PID_FILE="${PROFILE_DIR}/chrome.pid"
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

"${ROOT}/start-hid-live-source.sh"

mkdir -p "${PROFILE_DIR}"

chrome_alive() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if kill -0 "${pid}" >/dev/null 2>&1; then
      return 0
    fi
  fi
  pgrep -f "remote-debugging-port=${DEBUG_PORT}.*blackmamba-xcloud-cdp-profile|blackmamba-xcloud-cdp-profile.*remote-debugging-port=${DEBUG_PORT}" >/dev/null 2>&1
}

if ! chrome_alive; then
  if [[ ! -x "${CHROME_BIN}" ]]; then
    echo "No encuentro Google Chrome en: ${CHROME_BIN}" >&2
    exit 1
  fi
  nohup "${CHROME_BIN}" \
    "--user-data-dir=${PROFILE_DIR}" \
    "--remote-debugging-port=${DEBUG_PORT}" \
    "--no-first-run" \
    "--no-default-browser-check" \
    "--disable-sync" \
    "about:blank" \
    >> "${PROFILE_DIR}/chrome.out.log" 2>> "${PROFILE_DIR}/chrome.err.log" < /dev/null &
  echo "$!" > "${PID_FILE}"
fi

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

URL="${URL}" node "${ROOT}/runtime/inject-bridge-cdp.js" "${DEBUG_PORT}"

echo
echo "xCloud abierto con bridge CDP inyectado."
echo "Entra al juego y prueba el control."

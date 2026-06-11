#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
PID_FILE="${LOG_DIR}/live-monitor.pid"
LOG_FILE="${LOG_DIR}/live-monitor.log"
PORT="${LIVE_PORT:-8137}"
PROFILE="${PROFILE:-${ROOT}/profiles/rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json}"

mkdir -p "${LOG_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}")"
  if kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    echo "live-monitor ya esta corriendo: PID ${OLD_PID}"
    echo "ws://127.0.0.1:${PORT}/live"
    exit 0
  fi
fi

(
  cd "${ROOT}"
  node runtime/live-monitor.js --port "${PORT}" --profile "${PROFILE}" --verbose
) >> "${LOG_FILE}" 2>&1 &

PID="$!"
echo "${PID}" > "${PID_FILE}"

echo "PID: ${PID}"
echo "WebSocket: ws://127.0.0.1:${PORT}/live"
echo "Log: ${LOG_FILE}"
echo "Status: ${ROOT}/reports/live-status.json"


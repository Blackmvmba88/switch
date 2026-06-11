#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
PID_FILE="${LOG_DIR}/controller-doctor-watch.pid"
LOG_FILE="${LOG_DIR}/controller-doctor-watch.log"

mkdir -p "${LOG_DIR}"

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}")"
  if kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    echo "controller-doctor watch ya esta corriendo: PID ${OLD_PID}"
    echo "Log: ${LOG_FILE}"
    exit 0
  fi
fi

echo "Iniciando controller-doctor watch..."
nohup bash -lc "cd \"${ROOT}\" && WATCH_INTERVAL=\"${WATCH_INTERVAL:-3}\" ./controller-doctor.sh watch" >> "${LOG_FILE}" 2>&1 &

PID="$!"
echo "${PID}" > "${PID_FILE}"

echo "PID: ${PID}"
echo "Log: ${LOG_FILE}"
echo "Reports:"
echo "  ${ROOT}/reports/latest.json"
echo "  ${ROOT}/reports/latest.md"

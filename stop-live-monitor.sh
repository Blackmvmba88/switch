#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${ROOT}/logs/live-monitor.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "No hay live-monitor pid."
  exit 0
fi

PID="$(cat "${PID_FILE}")"
if kill -0 "${PID}" >/dev/null 2>&1; then
  kill "${PID}"
  echo "live-monitor detenido: ${PID}"
else
  echo "PID ${PID} no estaba activo."
fi
rm -f "${PID_FILE}"


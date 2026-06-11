#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
PID_FILE="${LOG_DIR}/controller-doctor-watch.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "No hay PID file. Watch probablemente no esta corriendo."
  exit 0
fi

PID="$(cat "${PID_FILE}")"
if kill -0 "${PID}" >/dev/null 2>&1; then
  kill "${PID}"
  echo "Watch detenido: PID ${PID}"
else
  echo "PID ${PID} no estaba activo."
fi

rm -f "${PID_FILE}"

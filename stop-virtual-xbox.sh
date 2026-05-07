#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${ROOT}/logs/virtual-xbox-bridge.pid"

if [[ -f "${PID_FILE}" ]]; then
  PID="$(cat "${PID_FILE}")"
  echo "Deteniendo puente Virtual Xbox (PID ${PID})..."
  kill "${PID}" || true
  rm "${PID_FILE}"
  echo "✅ Detenido."
else
  echo "El puente no parece estar corriendo."
fi

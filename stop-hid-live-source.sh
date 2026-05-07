#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${ROOT}/logs/hid-live-source.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "No hay hid-live-source activo."
  exit 0
fi

PID="$(cat "${PID_FILE}")"
kill "${PID}" >/dev/null 2>&1 || true
rm -f "${PID_FILE}"
echo "hid-live-source detenido: ${PID}"


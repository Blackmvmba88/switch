#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${ROOT}/logs/api-server.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "api-server no estaba corriendo"
  exit 0
fi

PID="$(cat "${PID_FILE}")"
if [[ ! "${PID}" =~ ^[0-9]+$ ]]; then
  echo "pid invalido en ${PID_FILE}: ${PID}" >&2
  rm -f "${PID_FILE}"
  exit 1
fi

if kill -0 "${PID}" >/dev/null 2>&1; then
  kill "${PID}" >/dev/null 2>&1 || true
  for _ in {1..30}; do
    if ! kill -0 "${PID}" >/dev/null 2>&1; then
      break
    fi
    sleep 0.1
  done
fi

rm -f "${PID_FILE}"
echo "api-server detenido: ${PID}"

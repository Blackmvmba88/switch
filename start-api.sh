#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
PID_FILE="${LOG_DIR}/api-server.pid"
LOG_FILE="${LOG_DIR}/api-server.log"

mkdir -p "${LOG_DIR}"

HEALTH_URL="http://127.0.0.1:8147/health"

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}")"
  if kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    echo "api-server ya esta corriendo: PID ${OLD_PID}"
    echo "URL: http://127.0.0.1:8147"
    exit 0
  fi
fi

if HEALTH_JSON="$(curl -fsS "${HEALTH_URL}" 2>/dev/null)"; then
  if [[ "${HEALTH_JSON}" == *'"service": "blackmamba-api"'* ]]; then
    echo "api-server ya esta corriendo (puerto 8147 ocupado por blackmamba-api)"
    echo "URL: http://127.0.0.1:8147"
    exit 0
  fi
  echo "error: el puerto 8147 ya esta ocupado por otro servicio" >&2
  exit 1
fi

nohup node "${ROOT}/api-server.js" >> "${LOG_FILE}" 2>&1 < /dev/null &
PID="$!"
echo "${PID}" > "${PID_FILE}"

READY=0
for _ in {1..30}; do
  if ! kill -0 "${PID}" >/dev/null 2>&1; then
    break
  fi
  if curl -fsS "${HEALTH_URL}" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.2
done

if [[ "${READY}" -ne 1 ]]; then
  rm -f "${PID_FILE}"
  if kill -0 "${PID}" >/dev/null 2>&1; then
    kill "${PID}" >/dev/null 2>&1 || true
  fi
  echo "error: api-server no pudo iniciar correctamente" >&2
  echo "revisa logs: ${LOG_FILE}" >&2
  exit 1
fi

echo "api-server iniciado: ${PID}"
echo "URL: http://127.0.0.1:8147"

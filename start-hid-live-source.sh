#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${ROOT}/.tmp-runtime-test/hid-live-source"
PID_FILE="${ROOT}/logs/hid-live-source.pid"
LOG_FILE="${ROOT}/logs/hid-live-source.log"

mkdir -p "${ROOT}/.tmp-runtime-test" "${ROOT}/logs"

running_pid() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if kill -0 "${pid}" >/dev/null 2>&1; then
      echo "${pid}"
      return 0
    fi
  fi
  pgrep -f "[.]tmp-runtime-test/hid-live-source" | head -n 1 || true
}

RUNNING_PID="$(running_pid)"
if [[ -n "${RUNNING_PID}" ]]; then
  echo "${RUNNING_PID}" > "${PID_FILE}"
  echo "hid-live-source ya esta corriendo: ${RUNNING_PID}"
  exit 0
fi

if [[ -f "${PID_FILE}" ]]; then
  rm -f "${PID_FILE}"
fi

if [[ ! -x "${BIN}" || "${ROOT}/runtime/hid-live-source.swift" -nt "${BIN}" ]]; then
  swiftc "${ROOT}/runtime/hid-live-source.swift" -o "${BIN}"
fi
nohup bash -c '
  set +e
  while true; do
    "'"${BIN}"'"
    code="$?"
    printf "%s hid-live-source exited code=%s; restarting in 1s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${code}"
    sleep 1
  done
' >> "${LOG_FILE}" 2>&1 < /dev/null &
PID="$!"
disown "${PID}" >/dev/null 2>&1 || true
echo "${PID}" > "${PID_FILE}"
echo "hid-live-source iniciado: ${PID}"
echo "Log: ${LOG_FILE}"

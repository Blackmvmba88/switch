#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${ROOT}/.tmp-runtime-test/hid-live-source"
PID_FILE="${ROOT}/logs/hid-live-source.pid"
LOG_FILE="${ROOT}/logs/hid-live-source.log"

mkdir -p "${ROOT}/.tmp-runtime-test" "${ROOT}/logs"

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}")"
  if kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    echo "hid-live-source ya esta corriendo: ${OLD_PID}"
    exit 0
  fi
  rm -f "${PID_FILE}"
fi

if [[ ! -x "${BIN}" || "${ROOT}/runtime/hid-live-source.swift" -nt "${BIN}" ]]; then
  swiftc "${ROOT}/runtime/hid-live-source.swift" -o "${BIN}"
fi
"${BIN}" >> "${LOG_FILE}" 2>&1 &
PID="$!"
echo "${PID}" > "${PID_FILE}"
echo "hid-live-source iniciado: ${PID}"
echo "Log: ${LOG_FILE}"

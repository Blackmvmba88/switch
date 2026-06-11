#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${ROOT}/.tmp-runtime-test/hid-live-source"
SOURCE="${ROOT}/runtime/hid-live-source.swift"
LOG_FILE="${ROOT}/logs/hid-live-source.log"
PID_FILE="${ROOT}/logs/hid-live-source.pid"

mkdir -p "${ROOT}/.tmp-runtime-test" "${ROOT}/logs"

log() {
  printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >> "${LOG_FILE}"
}

while true; do
  if [[ ! -x "${BIN}" || "${SOURCE}" -nt "${BIN}" ]]; then
    swiftc "${SOURCE}" -o "${BIN}" >> "${LOG_FILE}" 2>&1
  fi

  echo "$$" > "${PID_FILE}"
  log "hid-live-source agent starting native source"
  "${BIN}" >> "${LOG_FILE}" 2>&1
  code="$?"
  log "hid-live-source exited code=${code}; restarting in 1s"
  sleep 1
done

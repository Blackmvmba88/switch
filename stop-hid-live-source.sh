#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${ROOT}/.tmp-runtime-test/hid-live-source"
PID_FILE="${ROOT}/logs/hid-live-source.pid"

PIDS=()
if [[ -f "${PID_FILE}" ]]; then
  PIDS+=("$(cat "${PID_FILE}")")
fi

while IFS= read -r pid; do
  [[ -n "${pid}" ]] && PIDS+=("${pid}")
done < <(pgrep -f "[.]tmp-runtime-test/hid-live-source" || true)

if [[ "${#PIDS[@]}" -eq 0 ]]; then
  echo "No hay hid-live-source activo."
  exit 0
fi

for PID in "${PIDS[@]}"; do
  pkill -P "${PID}" >/dev/null 2>&1 || true
  kill "${PID}" >/dev/null 2>&1 || true
done
rm -f "${PID_FILE}"
echo "hid-live-source detenido: ${PIDS[*]}"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EVENT_LOG="${ROOT}/logs/live-events.jsonl"

"${ROOT}/start-live-monitor.sh"

cat <<HELP

Prueba minima live:
1. Abre gamepad-test/index.html en el navegador.
2. Presiona "Connect live monitor".
3. Presiona A fisicamente.
4. Este script buscara semantic A:pressed en ${EVENT_LOG}.

Tip: si quieres verlo fuera del navegador, en otra terminal corre:
  ./hid-raw-monitor.sh

HELP

start_line=0
if [[ -f "${EVENT_LOG}" ]]; then
  start_line="$(wc -l < "${EVENT_LOG}")"
fi

deadline=$((SECONDS + ${WAIT_SECONDS:-30}))
while (( SECONDS < deadline )); do
  if [[ -f "${EVENT_LOG}" ]]; then
    if tail -n +"$((start_line + 1))" "${EVENT_LOG}" | rg '"name":"A".*"event":"pressed"|"event":"pressed".*"name":"A"' >/dev/null 2>&1; then
      echo "PASS: A fisico llego como semantic A pressed estable."
      exit 0
    fi
  fi
  sleep 1
done

echo "FAIL: no vi semantic A pressed en ${WAIT_SECONDS:-30}s."
echo "Revisa reports/live-status.json y logs/live-monitor.log."
exit 1


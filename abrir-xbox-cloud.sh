#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8123}"
URL="${URL:-https://www.xbox.com/play}"

echo "Cerrando prueba local en puerto ${PORT}..."
PIDS="$(lsof -ti tcp:"${PORT}" || true)"

if [[ -n "${PIDS}" ]]; then
  kill ${PIDS} 2>/dev/null || true
  sleep 1
  LEFT="$(lsof -ti tcp:"${PORT}" || true)"
  if [[ -n "${LEFT}" ]]; then
    kill -9 ${LEFT} 2>/dev/null || true
  fi
  echo "Puerto ${PORT} liberado."
else
  echo "No habia servidor activo en ${PORT}."
fi

echo "Abriendo Xbox Cloud Gaming..."
if [[ -d "/Applications/Microsoft Edge.app" ]]; then
  open -a "Microsoft Edge" "${URL}"
elif [[ -d "/Applications/Google Chrome.app" ]]; then
  open -a "Google Chrome" "${URL}"
else
  open "${URL}"
fi

echo
echo "Listo. Conecta el control antes de entrar al juego y presiona un boton dentro del stream."

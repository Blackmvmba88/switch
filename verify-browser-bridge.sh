#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-8134}"
DEBUG_PORT="${DEBUG_PORT:-9223}"
PROFILE_DIR="${PROFILE_DIR:-/tmp/blackmamba-xcloud-bridge-verify-profile}"
EXTENSION_DIR="${ROOT}/xbox-gamepad-bridge"

if ! lsof -ti tcp:"${PORT}" >/dev/null 2>&1; then
  (cd "${ROOT}/gamepad-test" && python3 -m http.server "${PORT}" >/tmp/blackmamba-bridge-verify-http.log 2>&1 &)
fi

open -na "Google Chrome" --args \
  "--user-data-dir=${PROFILE_DIR}" \
  "--remote-debugging-port=${DEBUG_PORT}" \
  "--load-extension=${EXTENSION_DIR}" \
  "--disable-extensions-except=${EXTENSION_DIR}" \
  "--no-first-run" \
  "--no-default-browser-check" \
  "--disable-sync" \
  "--new-window" \
  "http://127.0.0.1:${PORT}/"

echo "Chrome bridge verify abierto."
echo "URL: http://127.0.0.1:${PORT}/"
echo "Debug: http://127.0.0.1:${DEBUG_PORT}/json"
echo "Presiona un boton del control en esa ventana y mira si dice mapping standard."

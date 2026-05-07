#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="${ROOT}/xbox-gamepad-bridge"
PROFILE_DIR="${ROOT}/chrome-xbox-control-profile"
PORT="${PORT:-8123}"
URL="http://localhost:${PORT}"

cd "${ROOT}/gamepad-test"

if ! lsof -ti tcp:"${PORT}" >/dev/null 2>&1; then
  python3 -m http.server "${PORT}" >/tmp/xbox-gamepad-test.log 2>&1 &
fi

mkdir -p "${PROFILE_DIR}"

echo "Abriendo prueba local con el puente activo..."
echo "URL: ${URL}"
echo "Extension: ${EXTENSION_DIR}"

open -na "Google Chrome" --args \
  "--user-data-dir=${PROFILE_DIR}" \
  "--load-extension=${EXTENSION_DIR}" \
  "--disable-extensions-except=${EXTENSION_DIR}" \
  "${URL}"

echo
echo "En la pagina debe decir:"
echo "id: Xbox 360 Controller (Xbox Cloud Gamepad Bridge)"
echo "mapping: standard"

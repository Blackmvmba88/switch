#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBUG_PORT="${DEBUG_PORT:-9224}"
PROFILE_DIR="${PROFILE_DIR:-/tmp/blackmamba-xcloud-cdp-profile}"
URL="${URL:-https://www.xbox.com/play}"

"${ROOT}/start-hid-live-source.sh"

mkdir -p "${PROFILE_DIR}"

open -na "Google Chrome" --args \
  "--user-data-dir=${PROFILE_DIR}" \
  "--remote-debugging-port=${DEBUG_PORT}" \
  "--no-first-run" \
  "--no-default-browser-check" \
  "--disable-sync" \
  "about:blank"

for _ in {1..20}; do
  if curl -fsS "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done

URL="${URL}" node "${ROOT}/runtime/inject-bridge-cdp.js" "${DEBUG_PORT}"

echo
echo "xCloud abierto con bridge CDP inyectado."
echo "Entra al juego y prueba el control."

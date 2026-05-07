#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="${URL:-https://www.xbox.com/play}"
PROFILE_DIR="${PROFILE_DIR:-/tmp/blackmamba-xcloud-bridge-profile}"
EXTENSION_DIR="${ROOT}/xbox-gamepad-bridge"
CONTROL_PATTERN="${CONTROL_PATTERN:-Rock Candy|Nintendo|Switch|0xe6f|0x187}"

echo "== BlackMamba xCloud Browser Bridge =="
echo

if ! hidutil list 2>/dev/null | grep -Ei "${CONTROL_PATTERN}" >/dev/null; then
  echo "NO veo el control por HID. Reconecta USB y vuelve a correr."
  exit 1
fi

echo "OK control visible por macOS:"
hidutil list 2>/dev/null | grep -Ei "${CONTROL_PATTERN}" || true
echo

if [[ ! -d "/Applications/Google Chrome.app" ]]; then
  echo "Google Chrome no esta instalado."
  exit 1
fi

mkdir -p "${PROFILE_DIR}"

echo "Abriendo Chrome limpio con extension puente:"
echo "  ${EXTENSION_DIR}"
echo

open -na "Google Chrome" --args \
  "--user-data-dir=${PROFILE_DIR}" \
  "--load-extension=${EXTENSION_DIR}" \
  "--disable-extensions-except=${EXTENSION_DIR}" \
  "--no-first-run" \
  "--no-default-browser-check" \
  "--disable-sync" \
  "--new-window" \
  "${URL}"

echo
echo "Cuando abra xCloud:"
echo "1. Entra a un juego."
echo "2. Presiona un boton del control dentro del stream."
echo "3. Si aparece aviso de extension, permite/cierra el aviso y recarga xCloud."

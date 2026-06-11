#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="${ROOT}/xbox-gamepad-bridge"

echo "Extension lista en:"
echo "${EXTENSION_DIR}"
echo
echo "Pasos:"
echo "1. Activa Developer mode."
echo "2. Presiona Load unpacked / Cargar descomprimida."
echo "3. Elige esta carpeta:"
echo "   ${EXTENSION_DIR}"
echo "4. Abre https://www.xbox.com/play y prueba el control dentro del juego."
echo

if [[ -d "/Applications/Microsoft Edge.app" ]]; then
  open -a "Microsoft Edge" "edge://extensions"
elif [[ -d "/Applications/Google Chrome.app" ]]; then
  open -a "Google Chrome" "chrome://extensions"
else
  open "chrome://extensions"
fi

open "${EXTENSION_DIR}"

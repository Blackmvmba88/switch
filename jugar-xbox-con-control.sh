#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSION_DIR="${ROOT}/xbox-gamepad-bridge"
PROFILE_DIR="${ROOT}/chrome-xbox-control-profile"
URL="${URL:-https://www.xbox.com/play}"

if [[ ! -f "${EXTENSION_DIR}/manifest.json" ]]; then
  echo "No encuentro la extension en ${EXTENSION_DIR}"
  exit 1
fi

mkdir -p "${PROFILE_DIR}"

echo "Abriendo Xbox Cloud con puente de control activo..."
echo "Extension: ${EXTENSION_DIR}"
echo "Perfil Chrome aislado: ${PROFILE_DIR}"
echo

if [[ -d "/Applications/Google Chrome.app" ]]; then
  open -na "Google Chrome" --args \
    "--user-data-dir=${PROFILE_DIR}" \
    "--load-extension=${EXTENSION_DIR}" \
    "--disable-extensions-except=${EXTENSION_DIR}" \
    "${URL}"
elif [[ -d "/Applications/Microsoft Edge.app" ]]; then
  open -na "Microsoft Edge" --args \
    "--user-data-dir=${PROFILE_DIR}" \
    "--load-extension=${EXTENSION_DIR}" \
    "--disable-extensions-except=${EXTENSION_DIR}" \
    "${URL}"
else
  echo "No encontre Chrome ni Edge en /Applications."
  echo "Instala Chrome/Edge o carga manualmente la extension:"
  echo "${EXTENSION_DIR}"
  exit 1
fi

echo "Listo. Usa esta ventana nueva para Xbox Cloud."
echo "Si te pide login, entra ahi mismo; el perfil es separado para no tocar tu navegador normal."

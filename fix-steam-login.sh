#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEAM_DIR="${HOME}/Library/Application Support/Steam"
BACKUP_DIR="${ROOT}/steam-login-backups/$(date '+%Y%m%d-%H%M%S')"

echo "== Steam login soft reset =="
echo "Backup: ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}"

echo "Cerrando Steam si esta abierto..."
osascript -e 'tell application "Steam" to quit' >/dev/null 2>&1 || true
sleep 3

backup_move() {
  local src="$1"
  local name
  name="$(basename "${src}")"

  if [[ -e "${src}" ]]; then
    echo "Respaldando ${src}"
    mv "${src}" "${BACKUP_DIR}/${name}"
  fi
}

backup_copy() {
  local src="$1"
  local name
  name="$(basename "${src}")"

  if [[ -e "${src}" ]]; then
    echo "Copiando ${src}"
    cp -R "${src}" "${BACKUP_DIR}/${name}"
  fi
}

backup_move "${STEAM_DIR}/config/htmlcache"
backup_move "${STEAM_DIR}/appcache/httpcache"
backup_copy "${STEAM_DIR}/config/config.vdf"
backup_copy "${STEAM_DIR}/config/DialogConfig.vdf"
backup_copy "${STEAM_DIR}/logs/steamui_login.txt"
backup_copy "${STEAM_DIR}/logs/webhelper_js.txt"
backup_copy "${STEAM_DIR}/logs/connection_log.txt"

echo
echo "Reabriendo Steam con cache limpia..."
open -a "Steam"
echo
echo "Prueba recomendado:"
echo "1. Usa QR login con la app Steam Mobile si la tienes."
echo "2. Si usas password, escribe el nombre de cuenta Steam, no email, si Steam te lo pide."
echo "3. Si vuelve a fallar, abre https://store.steampowered.com/login/ en Chrome y confirma que la cuenta entra ahi."

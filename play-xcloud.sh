#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE_DIR="${ROOT}/chrome-xcloud-steam-profile"
URL="${URL:-https://www.xbox.com/play}"
CONTROL_PATTERN="${CONTROL_PATTERN:-Rock Candy|Nintendo|Switch|Controller|0xe6f|0x187}"
RUNTIME="${ROOT}/blackmamba-gaming-runtime.sh"

usage() {
  cat <<'HELP'
Usage:
  ./play-xcloud.sh              Diagnose, open Steam if installed, then open Chrome for Xbox Cloud.
  ./play-xcloud.sh --doctor     Only print controller/Steam/Chrome status.
  ./play-xcloud.sh --install    Install Steam with Homebrew cask.
  ./play-xcloud.sh --watch      Watch for controller and launch the gaming stack.

Goal:
  Rock Candy/Switch HID -> Steam Input -> Chrome -> Xbox Cloud.
HELP
}

has_app() {
  [[ -d "/Applications/$1.app" ]]
}

print_status() {
  echo "== Xbox Cloud control doctor =="
  echo

  if hidutil list | rg -i "${CONTROL_PATTERN}" >/dev/null; then
    echo "OK  Control USB detectado por macOS:"
    hidutil list | rg -i "${CONTROL_PATTERN}" || true
  else
    echo "NO  No veo el control por HID. Reconecta USB y prueba otro puerto/cable."
  fi

  echo
  if has_app "Steam"; then
    echo "OK  Steam instalado: /Applications/Steam.app"
  else
    echo "NO  Steam no esta instalado."
  fi

  if has_app "Google Chrome"; then
    echo "OK  Chrome instalado: /Applications/Google Chrome.app"
  else
    echo "NO  Chrome no esta instalado."
  fi

  echo
  echo "Ruta objetivo:"
  echo "  Control -> Steam Input -> Chrome lanzado desde entorno gaming -> Xbox Cloud"
}

install_steam() {
  if has_app "Steam"; then
    echo "Steam ya esta instalado."
    return
  fi

  if ! command -v brew >/dev/null 2>&1; then
    echo "No encontre Homebrew. Instala Steam manual desde https://store.steampowered.com/about/"
    exit 1
  fi

  brew install --cask steam
}

open_steam() {
  if ! has_app "Steam"; then
    echo "Steam no esta instalado. Ejecuta:"
    echo "  ./play-xcloud.sh --install"
    exit 1
  fi

  echo "Abriendo Steam..."
  open -a "Steam"
}

open_chrome() {
  if ! has_app "Google Chrome"; then
    echo "No encontre Google Chrome."
    exit 1
  fi

  mkdir -p "${PROFILE_DIR}"
  echo "Abriendo Chrome para Xbox Cloud..."
  open -na "Google Chrome" --args \
    "--user-data-dir=${PROFILE_DIR}" \
    "--new-window" \
    "${URL}"
}

case "${1:-}" in
  -h|--help)
    usage
    ;;
  --doctor)
    print_status
    ;;
  --install)
    install_steam
    ;;
  "")
    if [[ -x "${RUNTIME}" ]]; then
      "${RUNTIME}" start
      exit $?
    fi

    print_status
    echo
    open_steam
    echo
    echo "Cuando Steam abra:"
    echo "  1. Settings -> Controller"
    echo "  2. Activa Steam Input para Generic y Switch/Nintendo"
    echo "  3. Add Non-Steam Game -> Google Chrome"
    echo "  4. Lanza Chrome desde Steam Big Picture si aparece en Library"
    echo
    echo "Tambien abro Chrome directo para login/listo de Xbox Cloud."
    open_chrome
    ;;
  --watch)
    if [[ ! -x "${RUNTIME}" ]]; then
      echo "No encuentro runtime ejecutable: ${RUNTIME}"
      exit 1
    fi
    "${RUNTIME}" watch
    ;;
  *)
    usage
    exit 1
    ;;
esac

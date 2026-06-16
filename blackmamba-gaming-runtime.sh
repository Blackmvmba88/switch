#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
PROFILE_DIR="${ROOT}/chrome-xcloud-steam-profile"
URL="${URL:-https://www.xbox.com/en-us/play/games/microsoft-flight-simulator-2024/9p38d19t7lrv}"
CONTROL_PATTERN="${CONTROL_PATTERN:-Rock Candy|Nintendo|Switch|0xe6f|0x187}"
WATCH_INTERVAL="${WATCH_INTERVAL:-5}"
STEAM_WAIT_SECONDS="${STEAM_WAIT_SECONDS:-8}"

mkdir -p "${LOG_DIR}"
LOG_FILE="${LOG_FILE:-${LOG_DIR}/gaming-runtime.log}"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" | tee -a "${LOG_FILE}"
}

has_app() {
  [[ -d "/Applications/$1.app" ]]
}

control_detected() {
  hidutil list | rg -i "${CONTROL_PATTERN}" >/dev/null
}

print_control() {
  hidutil list | rg -i "${CONTROL_PATTERN}" || true
}

doctor() {
  echo "== BlackMamba Gaming Runtime doctor =="
  echo

  if control_detected; then
    echo "OK  Control detectado:"
    print_control
  else
    echo "NO  Control no detectado. Revisa USB/cable/puerto."
  fi

  echo
  if has_app "Steam"; then
    echo "OK  Steam instalado."
  else
    echo "NO  Steam no instalado. Ejecuta: ./play-xcloud.sh --install"
  fi

  if has_app "Google Chrome"; then
    echo "OK  Google Chrome instalado."
  else
    echo "NO  Google Chrome no instalado."
  fi

  echo
  echo "Contrato objetivo:"
  echo "  HID Rock Candy -> Steam Input Gamepad Template -> Chrome desde Steam -> Xbox Cloud"
}

open_steam() {
  if ! has_app "Steam"; then
    log "Steam no esta instalado."
    return 1
  fi

  log "Abriendo Steam."
  open -a "Steam"
}

open_big_picture() {
  log "Abriendo Steam Big Picture."
  open "steam://open/bigpicture"
}

open_chrome_xcloud() {
  if ! has_app "Google Chrome"; then
    log "Google Chrome no esta instalado."
    return 1
  fi

  mkdir -p "${PROFILE_DIR}"
  log "Abriendo Chrome gaming profile: ${URL}"
  open -a "Google Chrome" --args \
    "--user-data-dir=${PROFILE_DIR}" \
    "${URL}"
}

open_local_gamepad_test() {
  local port="${PORT:-8123}"
  local test_url="http://localhost:${port}"

  if ! lsof -ti tcp:"${port}" >/dev/null 2>&1; then
    log "Abriendo servidor de prueba Gamepad API en puerto ${port}."
    (cd "${ROOT}/gamepad-test" && python3 -m http.server "${port}" >/tmp/blackmamba-gamepad-test.log 2>&1 &)
  fi

  if ! has_app "Google Chrome"; then
    log "Google Chrome no esta instalado."
    return 1
  fi

  mkdir -p "${PROFILE_DIR}"
  log "Abriendo test local de control: ${test_url}"
  open -a "Google Chrome" --args \
    "--user-data-dir=${PROFILE_DIR}" \
    "${test_url}"
}

validate_runtime() {
  doctor | tee -a "${LOG_FILE}"
  echo
  echo "== Validacion final =="
  echo "1. En Steam: Settings -> Controller -> Test Device Inputs."
  echo "2. Presiona botones: si Steam los marca, Steam Input ya agarro el control."
  echo "3. En Xbox Cloud: dentro del juego, si NO escribe letras y mueve UI/juego, ya esta en modo gamepad."
  echo
  echo "Tambien abro una prueba local de Gamepad API para ver botones/ejes en Chrome."
  open_local_gamepad_test
}

network_hint() {
  echo "== Network quick hints =="
  echo "Prefer Ethernet or 5 GHz Wi-Fi, close heavy downloads, and keep VPN off unless needed."
  echo "Xbox Cloud endpoint: ${URL}"
}

start_runtime() {
  log "Runtime start."
  doctor | tee -a "${LOG_FILE}"

  if ! control_detected; then
    log "Control ausente. No abro stack gaming todavia."
    return 2
  fi

  open_steam
  log "Esperando ${STEAM_WAIT_SECONDS}s para que Steam cargue."
  sleep "${STEAM_WAIT_SECONDS}"
  open_big_picture
  open_chrome_xcloud

  log "Stack abierto. En Steam usa Controller Layout -> Templates -> Gamepad para Chrome."
}

watch_runtime() {
  log "Watch mode iniciado. Intervalo: ${WATCH_INTERVAL}s"
  local launched="no"

  while true; do
    if control_detected; then
      if [[ "${launched}" != "yes" ]]; then
        log "Control detectado; lanzando stack."
        start_runtime || true
        launched="yes"
      fi
    else
      if [[ "${launched}" == "yes" ]]; then
        log "Control desconectado; watch queda armado para reconexion."
      fi
      launched="no"
    fi

    sleep "${WATCH_INTERVAL}"
  done
}

usage() {
  cat <<'HELP'
BlackMamba Gaming Runtime

Usage:
  ./blackmamba-gaming-runtime.sh doctor
  ./blackmamba-gaming-runtime.sh start
  ./blackmamba-gaming-runtime.sh watch
  ./blackmamba-gaming-runtime.sh validate
  ./blackmamba-gaming-runtime.sh bigpicture
  ./blackmamba-gaming-runtime.sh chrome
  ./blackmamba-gaming-runtime.sh network
  ./blackmamba-gaming-runtime.sh log

Main path:
  HID Rock Candy -> Steam Input -> Chrome -> Xbox Cloud.
HELP
}

case "${1:-doctor}" in
  doctor)
    doctor
    ;;
  start)
    start_runtime
    ;;
  watch)
    watch_runtime
    ;;
  validate)
    validate_runtime
    ;;
  bigpicture)
    open_big_picture
    ;;
  chrome)
    open_chrome_xcloud
    ;;
  network)
    network_hint
    ;;
  log)
    tail -n 80 "${LOG_FILE}" 2>/dev/null || true
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    usage
    exit 1
    ;;
esac

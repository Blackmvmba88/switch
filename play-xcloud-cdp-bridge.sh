#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEBUG_PORT="${DEBUG_PORT:-9224}"
PROFILE_DIR="${PROFILE_DIR:-/tmp/blackmamba-xcloud-cdp-profile}"
URL="${URL:-https://www.xbox.com/en-us/play/games/microsoft-flight-simulator-2024/9p38d19t7lrv}"
PID_FILE="${PROFILE_DIR}/chrome.pid"
BROWSER_STATUS="${PROFILE_DIR}/browser-status.json"
BROWSER_REPORT_STATUS="${HOME}/Library/Application Support/BlackMambaInput/reports/browser-status.json"
BROWSER_PREF_FILE="${BROWSER_REPORT_STATUS}"
BROWSER_APP="${BROWSER_APP:-}"
CHROME_BIN="${CHROME_BIN:-}"
NODE_BIN="${NODE_BIN:-$(command -v node 2>/dev/null || true)}"
if [[ -z "${NODE_BIN}" ]]; then
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /opt/homebrew/bin/nodejs /usr/local/bin/nodejs; do
    if [[ -x "${candidate}" ]]; then
      NODE_BIN="${candidate}"
      break
    fi
  done
fi
if [[ -z "${NODE_BIN}" ]]; then
  NODE_BIN="node"
fi

browser_preference() {
  "${NODE_BIN}" -e "const fs=require('fs'); const p=process.argv[1]; try { const d=JSON.parse(fs.readFileSync(p,'utf8')); console.log(d.preference || ''); } catch (_) {}" "${BROWSER_PREF_FILE}" 2>/dev/null || true
}

resolve_browser_bin() {
  local preference
  preference="$(browser_preference)"
  if [[ -n "${CHROME_BIN}" && -x "${CHROME_BIN}" ]]; then
    printf '%s\n' "${CHROME_BIN}"
    return 0
  fi

  if [[ -n "${BROWSER_APP}" ]]; then
    case "${BROWSER_APP}" in
      "Google Chrome")
        if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
          printf '%s\n' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
          return 0
        fi
        ;;
      "ChatGPT Atlas"|"Atlas")
        if [[ -x "/Applications/ChatGPT Atlas.app/Contents/MacOS/ChatGPT Atlas" ]]; then
          printf '%s\n' "/Applications/ChatGPT Atlas.app/Contents/MacOS/ChatGPT Atlas"
          return 0
        fi
        ;;
      *)
        if [[ -x "${BROWSER_APP}" ]]; then
          printf '%s\n' "${BROWSER_APP}"
          return 0
        fi
        ;;
      esac
  fi

  if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
    printf '%s\n' "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return 0
  fi

  if [[ -x "/Applications/ChatGPT Atlas.app/Contents/MacOS/ChatGPT Atlas" ]]; then
    printf '%s\n' "/Applications/ChatGPT Atlas.app/Contents/MacOS/ChatGPT Atlas"
    return 0
  fi

  return 1
}

"${ROOT}/start-hid-live-source.sh"
"${ROOT}/install-live-monitor-agent.sh" >/dev/null

mkdir -p "${PROFILE_DIR}"
LOCK_DIR="${PROFILE_DIR}/launch.lock"

if mkdir "${LOCK_DIR}" 2>/dev/null; then
  trap 'rmdir "${LOCK_DIR}" 2>/dev/null || true' EXIT
else
  echo "Otra apertura de xCloud ya esta en curso; esperando al navegador existente..."
  for _ in {1..60}; do
    if curl -fsS "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
      REUSE_XCLOUD=1 URL="${URL}" "${NODE_BIN}" "${ROOT}/runtime/inject-bridge-cdp.js" "${DEBUG_PORT}" || true
      echo "xCloud ya estaba en proceso; reutilice la sesion disponible."
      exit 0
    fi
    sleep 0.25
  done
  echo "Otra apertura sigue bloqueada y CDP no aparecio; no abrire otra ventana." >&2
  exit 0
fi

write_browser_status() {
  local preference="${4:-}"
  mkdir -p "${PROFILE_DIR}"
  cat > "${BROWSER_STATUS}" <<EOF
{"updatedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","browser":"${1:-unknown}","state":"${2:-unknown}","preference":"${preference}","message":"${3:-}"}
EOF
  mkdir -p "$(dirname "${BROWSER_REPORT_STATUS}")"
  cat > "${BROWSER_REPORT_STATUS}" <<EOF
{"updatedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","browser":"${1:-unknown}","state":"${2:-unknown}","preference":"${preference}","message":"${3:-}"}
EOF
}

chrome_alive() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if kill -0 "${pid}" >/dev/null 2>&1; then
      return 0
    fi
  fi
  ps -axo command |
    grep -F -- "remote-debugging-port=${DEBUG_PORT}" |
    grep -F -- "user-data-dir=${PROFILE_DIR}" |
    grep -v grep >/dev/null 2>&1
}

focus_existing_browser() {
  local browser_app="${1:-Google Chrome}"
  osascript -e "tell application \"${browser_app}\" to activate" >/dev/null 2>&1 || true
}

if ! chrome_alive; then
  BROWSER_BIN="$(resolve_browser_bin || true)"
  if [[ -z "${BROWSER_BIN}" ]]; then
    write_browser_status "none" "missing" "No encuentro Google Chrome ni ChatGPT Atlas en /Applications."
    echo "No encuentro Google Chrome ni ChatGPT Atlas en /Applications." >&2
    exit 1
  fi
  case "${BROWSER_BIN}" in
    */Google\ Chrome) BROWSER_NAME="Google Chrome" ;;
    */ChatGPT\ Atlas) BROWSER_NAME="ChatGPT Atlas" ;;
    *) BROWSER_NAME="$(basename "${BROWSER_BIN}")" ;;
  esac
  if [[ -f "${PID_FILE}" ]]; then
    focus_existing_browser "${BROWSER_NAME}"
  else
    write_browser_status "${BROWSER_NAME}" "launching" "Abriendo navegador con perfil aislado." "${BROWSER_APP:-}"
    nohup "${BROWSER_BIN}" \
      "--user-data-dir=${PROFILE_DIR}" \
      "--remote-debugging-port=${DEBUG_PORT}" \
      "--no-first-run" \
      "--no-default-browser-check" \
      "--disable-sync" \
      "about:blank" \
      >> "${PROFILE_DIR}/chrome.out.log" 2>> "${PROFILE_DIR}/chrome.err.log" < /dev/null &
    echo "$!" > "${PID_FILE}"
  fi
fi

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
    write_browser_status "${BROWSER_NAME:-unknown}" "ready" "Puerto CDP disponible."
    break
  fi
  sleep 0.25
done

if ! curl -fsS "http://127.0.0.1:${DEBUG_PORT}/json/version" >/dev/null 2>&1; then
  write_browser_status "${BROWSER_NAME:-unknown}" "cdp_unavailable" "El navegador abrio pero no expuso CDP." "${BROWSER_APP:-}"
  echo "El navegador abrio pero no expuso CDP en el puerto ${DEBUG_PORT}." >&2
  exit 1
fi

REUSE_XCLOUD=1 URL="${URL}" "${NODE_BIN}" "${ROOT}/runtime/inject-bridge-cdp.js" "${DEBUG_PORT}"

echo
echo "xCloud abierto con bridge CDP inyectado."
echo "Entra al juego y prueba el control."

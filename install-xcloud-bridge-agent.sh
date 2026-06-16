#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.blackmamba.xcloud-bridge"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
AGENT_DIR="${HOME}/Library/LaunchAgents"
PLIST="${AGENT_DIR}/${LABEL}.plist"
NODE_BIN="$(command -v node)"
DEBUG_PORT="${DEBUG_PORT:-9224}"
URL="${URL:-https://www.xbox.com/en-us/play/games/microsoft-flight-simulator-2024/9p38d19t7lrv}"
PROFILE_DIR="${PROFILE_DIR:-/tmp/blackmamba-xcloud-cdp-profile}"
INTERVAL_MS="${INTERVAL_MS:-5000}"
AUTO_OPEN_XCLOUD="${AUTO_OPEN_XCLOUD:-0}"

kick_agent() {
  launchctl kickstart -k "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 &
  local pid="$!"
  local waited=0
  while kill -0 "${pid}" >/dev/null 2>&1; do
    if [[ "${waited}" -ge 4 ]]; then
      kill "${pid}" >/dev/null 2>&1 || true
      echo "Aviso: kickstart timeout para ${LABEL}; launchd lo mantendra con KeepAlive."
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  wait "${pid}" >/dev/null 2>&1 || true
}

mkdir -p "${APP_ROOT}/runtime" "${APP_ROOT}/xbox-gamepad-bridge" "${APP_ROOT}/logs" "${APP_ROOT}/reports" "${AGENT_DIR}"
cp "${ROOT}/runtime/xcloud-bridge-agent.js" "${APP_ROOT}/runtime/xcloud-bridge-agent.js"
cp "${ROOT}/runtime/inject-bridge-cdp.js" "${APP_ROOT}/runtime/inject-bridge-cdp.js"
cp "${ROOT}/close-runtime.sh" "${APP_ROOT}/close-runtime.sh"
cp "${ROOT}/xbox-gamepad-bridge/bridge.js" "${APP_ROOT}/xbox-gamepad-bridge/bridge.js"
chmod +x "${APP_ROOT}/runtime/xcloud-bridge-agent.js" "${APP_ROOT}/runtime/inject-bridge-cdp.js" "${APP_ROOT}/close-runtime.sh"

cat > "${PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${NODE_BIN}</string>
    <string>${APP_ROOT}/runtime/xcloud-bridge-agent.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BLACKMAMBA_APP_ROOT</key>
    <string>${APP_ROOT}</string>
    <key>DEBUG_PORT</key>
    <string>${DEBUG_PORT}</string>
    <key>URL</key>
    <string>${URL}</string>
    <key>PROFILE_DIR</key>
    <string>${PROFILE_DIR}</string>
    <key>INTERVAL_MS</key>
    <string>${INTERVAL_MS}</string>
    <key>AUTO_OPEN_XCLOUD</key>
    <string>${AUTO_OPEN_XCLOUD}</string>
    <key>STATUS_PATH</key>
    <string>${APP_ROOT}/reports/xcloud-bridge-status.json</string>
    <key>SESSION_PATH</key>
    <string>${APP_ROOT}/reports/play-sessions.json</string>
    <key>CLOSE_SCRIPT</key>
    <string>${APP_ROOT}/close-runtime.sh</string>
    <key>AUTO_SHUTDOWN_MIN_PLAY_MS</key>
    <string>1800000</string>
    <key>AUTO_SHUTDOWN_AWAY_GRACE_MS</key>
    <string>90000</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${APP_ROOT}/logs/xcloud-bridge-agent.out.log</string>
  <key>StandardErrorPath</key>
  <string>${APP_ROOT}/logs/xcloud-bridge-agent.err.log</string>
  <key>WorkingDirectory</key>
  <string>${APP_ROOT}</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
BOOTSTRAP_OK=1
if ! launchctl bootstrap "gui/$(id -u)" "${PLIST}"; then
  BOOTSTRAP_OK=0
  echo "Aviso: LaunchAgent ${LABEL} no pudo cargarse; archivos instalados, modo directo disponible." >&2
fi
if [[ "${BOOTSTRAP_OK}" == "1" ]]; then
  kick_agent
fi

echo "Installed xCloud Bridge LaunchAgent: ${PLIST}"
echo "Status: ${APP_ROOT}/reports/xcloud-bridge-status.json"
echo "Logs:"
echo "  ${APP_ROOT}/logs/xcloud-bridge-agent.out.log"
echo "  ${APP_ROOT}/logs/xcloud-bridge-agent.err.log"
if [[ "${BOOTSTRAP_OK}" == "0" ]]; then
  echo "Fallback: usa ./bmctl play o ./bmctl game-on para arranque directo."
fi

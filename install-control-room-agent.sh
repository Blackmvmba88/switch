#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.blackmamba.control-room"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
AGENT_DIR="${HOME}/Library/LaunchAgents"
PLIST="${AGENT_DIR}/${LABEL}.plist"
NODE_BIN="$(command -v node)"
PORT="${BM_APP_PORT:-8147}"

mkdir -p "${APP_ROOT}/logs" "${AGENT_DIR}"

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
    <string>${ROOT}/app/server.js</string>
    <string>${PORT}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${ROOT}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${APP_ROOT}/logs/control-room.out.log</string>
  <key>StandardErrorPath</key>
  <string>${APP_ROOT}/logs/control-room.err.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BM_APP_PORT</key>
    <string>${PORT}</string>
  </dict>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}" >/dev/null 2>&1 || true

echo "Installed Control Room LaunchAgent: ${PLIST}"
echo "URL: http://127.0.0.1:${PORT}"
echo "Logs: ${APP_ROOT}/logs/control-room.lifecycle.log"

#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
AGENT_DIR="${HOME}/Library/LaunchAgents"
LABEL="com.blackmamba.api-server"
PLIST="${AGENT_DIR}/${LABEL}.plist"
NODE_BIN="$(command -v node)"

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
    <string>${PROJECT_ROOT}/api-server.js</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${APP_ROOT}/logs/api-server.out.log</string>
  <key>StandardErrorPath</key>
  <string>${APP_ROOT}/logs/api-server.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed API LaunchAgent: ${PLIST}"
echo "URL: http://127.0.0.1:8787"

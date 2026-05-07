#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABEL="com.blackmamba.hid-live-source"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
LOG_DIR="${APP_ROOT}/logs"

mkdir -p "${HOME}/Library/LaunchAgents" "${LOG_DIR}" "${APP_ROOT}/runtime"
cp "${ROOT}/hid-live-source-agent.sh" "${APP_ROOT}/hid-live-source-agent.sh"
cp "${ROOT}/runtime/hid-live-source.swift" "${APP_ROOT}/runtime/hid-live-source.swift"
chmod +x "${APP_ROOT}/hid-live-source-agent.sh"

cat > "${PLIST}" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${APP_ROOT}/hid-live-source-agent.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/launchd-hid-live-source.out.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/launchd-hid-live-source.err.log</string>
  <key>WorkingDirectory</key>
  <string>${APP_ROOT}</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed HID Live Source LaunchAgent: ${PLIST}"
echo "Logs: ${LOG_DIR}/hid-live-source.log"

#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"
AGENT_DIR="${HOME}/Library/LaunchAgents"
LABEL="com.blackmamba.live-monitor"
PLIST="${AGENT_DIR}/${LABEL}.plist"
NODE_BIN="$(command -v node)"
PORT="${LIVE_PORT:-8137}"

mkdir -p "${APP_ROOT}/runtime" "${APP_ROOT}/profiles" "${APP_ROOT}/logs" "${APP_ROOT}/reports" "${AGENT_DIR}"

cp "${PROJECT_ROOT}/runtime/live-monitor.js" "${APP_ROOT}/runtime/live-monitor.js"
cp "${PROJECT_ROOT}/runtime/translate-sample.js" "${APP_ROOT}/runtime/translate-sample.js"
cp "${PROJECT_ROOT}/profiles/rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json" "${APP_ROOT}/profiles/rock-candy.normalized.json"

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
    <string>${APP_ROOT}/runtime/live-monitor.js</string>
    <string>--port</string>
    <string>${PORT}</string>
    <string>--profile</string>
    <string>${APP_ROOT}/profiles/rock-candy.normalized.json</string>
    <string>--log</string>
    <string>${APP_ROOT}/logs/live-events.jsonl</string>
    <string>--status</string>
    <string>${APP_ROOT}/reports/live-status.json</string>
    <string>--verbose</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${APP_ROOT}/logs/live-monitor.out.log</string>
  <key>StandardErrorPath</key>
  <string>${APP_ROOT}/logs/live-monitor.err.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "${PLIST}"
launchctl kickstart -k "gui/$(id -u)/${LABEL}"

echo "Installed Live Monitor LaunchAgent: ${PLIST}"
echo "WebSocket: ws://127.0.0.1:${PORT}/live"
echo "Logs:"
echo "  ${APP_ROOT}/logs/live-events.jsonl"
echo "  ${APP_ROOT}/logs/live-monitor.out.log"
echo "Status:"
echo "  ${APP_ROOT}/reports/live-status.json"

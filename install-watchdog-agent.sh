#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLIST_DIR="${HOME}/Library/LaunchAgents"
LABEL="com.blackmamba.watchdog"
PLIST_PATH="${PLIST_DIR}/${LABEL}.plist"

mkdir -p "${PLIST_DIR}"

cat <<PLIST > "${PLIST_PATH}"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>$(which node)</string>
        <string>${ROOT}/runtime/health-watchdog.js</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${HOME}/Library/Application Support/BlackMambaInput/logs/watchdog.lifecycle.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/Library/Application Support/BlackMambaInput/logs/watchdog.err.log</string>
</dict>
</plist>

launchctl unload "${PLIST_PATH}" 2>/dev/null || true
launchctl load "${PLIST_PATH}"
echo "Watchdog agent instalado y cargado: ${LABEL}"

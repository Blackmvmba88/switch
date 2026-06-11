#!/usr/bin/env bash
set -euo pipefail

LABEL="com.blackmamba.control-room"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
rm -f "${PLIST}"
pkill -f "app/server.js.*8147|app/server.js" >/dev/null 2>&1 || true
echo "Control Room detenido."

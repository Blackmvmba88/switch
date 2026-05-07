#!/usr/bin/env bash
set -euo pipefail

LABEL="com.blackmamba.hid-live-source"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
rm -f "${PLIST}"
echo "Removed HID Live Source LaunchAgent: ${LABEL}"

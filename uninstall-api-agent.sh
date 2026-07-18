#!/usr/bin/env bash
set -euo pipefail

LABEL="com.blackmamba.api-server"
PLIST="${HOME}/Library/LaunchAgents/${LABEL}.plist"

launchctl bootout "gui/$(id -u)" "${PLIST}" >/dev/null 2>&1 || true
rm -f "${PLIST}"
echo "Removed API LaunchAgent: ${LABEL}"

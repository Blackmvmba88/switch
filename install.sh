#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(cat "${ROOT}/VERSION" 2>/dev/null || echo "dev")"

echo "BlackMamba Input Runtime ${VERSION} installer"
echo

"${ROOT}/doctor-preflight.sh"

echo
echo "== installing runtime agents =="
"${ROOT}/install-live-monitor-agent.sh"
"${ROOT}/install-hid-live-source-agent.sh"
AUTO_OPEN_XCLOUD=0 "${ROOT}/install-xcloud-bridge-agent.sh" || true
"${ROOT}/install-control-room-agent.sh"
"${ROOT}/install-watchdog-agent.sh"

echo
echo "== validating =="
"${ROOT}/bmctl" test

echo
echo "Installed BlackMamba Input Runtime ${VERSION}"
echo "Open Control Room:"
echo "  ./bmctl app"
echo
echo "Start game mode:"
echo "  ./bmctl game-on"
echo
echo "Uninstall:"
echo "  ./uninstall.sh"

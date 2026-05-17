#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"

echo "BlackMamba Input Runtime uninstall"

"${ROOT}/close-runtime.sh" --include-app || true
"${ROOT}/uninstall-xcloud-bridge-agent.sh" || true
"${ROOT}/uninstall-hid-live-source-agent.sh" || true
"${ROOT}/uninstall-live-monitor-agent.sh" || true
"${ROOT}/uninstall-control-room-agent.sh" || true

cat <<MSG

Runtime detenido y LaunchAgents removidos.

Datos locales conservados:
  ${APP_ROOT}

Para borrar logs/perfiles locales manualmente:
  rm -rf "${APP_ROOT}"

MSG

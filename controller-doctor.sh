#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="${ROOT}/reports/runtime-state.json"

if [[ ! -f "${STATE_FILE}" ]]; then
  echo "controller-doctor: missing runtime-state"
  exit 1
fi

if ! grep -q '"connected": true' "${STATE_FILE}"; then
  echo "controller-doctor: control not connected"
  exit 2
fi

if ! grep -q '"state": "running"' "${STATE_FILE}"; then
  echo "controller-doctor: game mode not running"
  exit 3
fi

echo "controller-doctor: ok"

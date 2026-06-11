#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE_BIN="${ROOT}/.tmp-virtual-hid-bridge"
INSPECTOR_BIN="${ROOT}/.tmp-hid-inspector"

echo "🧪 Gemini Virtual HID - Minimal PoC"
echo "-----------------------------------"

# 1. Asegurar monitor live
"${ROOT}/start-live-monitor.sh"

# 2. Compilar bridge
"${ROOT}/compile-and-sign.sh" "runtime/virtual-hid-bridge.swift" "${BRIDGE_BIN}"

# 3. Compilar inspector
"${ROOT}/compile-and-sign.sh" "instrumentation/hid-inspector.swift" "${INSPECTOR_BIN}"

echo
echo "⚠️  RECUERDA: Para que IOHIDUserDevice funcione sin Xcode real,"
echo "debes tener SIP desactivado y boot-args=\"amfi_get_out_of_my_way=1\"."
echo

echo "🚀 Iniciando Bridge (background)..."
"${BRIDGE_BIN}" --profile "${ROOT}/identity/profiles/minimal-lab-gamepad.identity.json" > "${ROOT}/logs/virtual-hid-bridge.log" 2>&1 &
BRIDGE_PID="$!"
echo "${BRIDGE_PID}" > "${ROOT}/logs/virtual-hid-bridge.pid"

echo "🧐 Iniciando Inspector..."
echo "Si ves 'Device connected', el puente está inyectando HID exitosamente."
echo
"${INSPECTOR_BIN}" --vid 0xFEED --pid 0xBEEF

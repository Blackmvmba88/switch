#!/usr/bin/env bash
set -euo pipefail

FILE="${1:-runtime/virtual-hid-bridge.swift}"
OUT="${2:-.tmp-virtual-hid-bridge}"
ENTITLEMENTS="entitlements.plist"

if [[ ! -f "${ENTITLEMENTS}" ]]; then
  echo "❌ No encuentro ${ENTITLEMENTS}"
  exit 1
fi

echo "🔨 Compilando ${FILE}..."
if [[ "${FILE}" == *"virtual-hid-bridge.swift" ]]; then
  # Compilación conjunta con el bridge de C
  xcrun -sdk macosx swiftc -framework IOKit -framework Foundation \
    "injection/IOHIDUserDeviceBridge.c" \
    "${FILE}" \
    -o "${OUT}"
else
  xcrun -sdk macosx swiftc -framework IOKit -framework Foundation "${FILE}" -o "${OUT}"
fi

echo "✒️  Firmando ad-hoc con entitlements..."
codesign --sign - --entitlements "${ENTITLEMENTS}" --force "${OUT}"

echo "✅ Listo: ${OUT}"

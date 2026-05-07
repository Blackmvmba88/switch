#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${ROOT}/.tmp-runtime-test/hid-raw-monitor"
LOG="${ROOT}/logs/hid-raw-monitor.jsonl"
VENDOR="${VENDOR:-0x0e6f}"
PRODUCT="${PRODUCT:-0x0187}"

mkdir -p "$(dirname "${BIN}")" "${ROOT}/logs"

if [[ ! -x "${BIN}" || "${ROOT}/runtime/hid-raw-monitor.swift" -nt "${BIN}" ]]; then
  swiftc "${ROOT}/runtime/hid-raw-monitor.swift" -o "${BIN}"
fi

echo "HID raw monitor"
echo "Vendor/Product: ${VENDOR}/${PRODUCT}"
echo "Log: ${LOG}"
echo "Presiona botones; Ctrl+C para terminar."
"${BIN}" --vendor "${VENDOR}" --product "${PRODUCT}" --verbose | tee -a "${LOG}"


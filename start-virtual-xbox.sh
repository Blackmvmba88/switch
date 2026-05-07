#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="${ROOT}/logs"
PID_FILE="${LOG_DIR}/virtual-xbox-bridge.pid"
LOG_FILE="${LOG_DIR}/virtual-xbox-bridge.log"

# 1. Asegurar que el monitor live esté corriendo
"${ROOT}/start-live-monitor.sh"

# 2. Iniciar el puente virtual en Swift
echo "Iniciando puente Virtual Xbox (GCVirtualController)..."

if [[ -f "${PID_FILE}" ]]; then
  OLD_PID="$(cat "${PID_FILE}")"
  if kill -0 "${OLD_PID}" >/dev/null 2>&1; then
    echo "El puente ya está corriendo: PID ${OLD_PID}"
    exit 0
  fi
fi

# Corremos el script de Swift. 
# Usamos 'swift' directamente para no requerir un paso de compilación manual, 
# aunque en producción se preferiría un binario.
(
  cd "${ROOT}"
  swift runtime/virtual-xbox-bridge.swift
) >> "${LOG_FILE}" 2>&1 &

PID="$!"
echo "${PID}" > "${PID_FILE}"

echo "✅ Puente iniciado. PID: ${PID}"
echo "Log: ${LOG_FILE}"
echo
echo "Este puente crea un control virtual en el sistema."
echo "Chrome y Safari lo verán como un 'Xbox Wireless Controller' o similar."
echo "Prueba ahora en https://www.xbox.com/play"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"

pass() { printf 'PASS %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; FAILED=1; }

FAILED=0

echo "BlackMamba Input Runtime preflight"
echo "Root: ${ROOT}"
echo

if command -v node >/dev/null 2>&1; then
  pass "node $(node --version)"
else
  fail "node no encontrado; instala Node.js o Homebrew node"
fi

if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
  pass "Google Chrome encontrado"
else
  fail "Google Chrome no encontrado en /Applications"
fi

if command -v swiftc >/dev/null 2>&1; then
  pass "swiftc disponible"
else
  warn "swiftc no disponible; HID native source puede compilar mal"
fi

if [[ -f "${ROOT}/profiles/rock-candy-wired-controller-for-nintendo-switch-vendor-0e6f-product-0187.normalized.json" ]]; then
  pass "perfil Rock Candy presente"
else
  fail "perfil Rock Candy falta"
fi

if system_profiler SPUSBDataType 2>/dev/null | grep -Eiq 'Rock Candy|Nintendo|Controller|0x0187|0x0e6f'; then
  pass "macOS ve algun control USB compatible/candidato"
else
  warn "no vi el Rock Candy conectado ahora; puedes instalar igual y conectar despues"
fi

mkdir -p "${APP_ROOT}/logs" "${APP_ROOT}/reports" "${APP_ROOT}/runtime" "${APP_ROOT}/profiles"
if [[ -w "${APP_ROOT}" ]]; then
  pass "Application Support escribible: ${APP_ROOT}"
else
  fail "Application Support no escribible: ${APP_ROOT}"
fi

if [[ -d "${HOME}/Library/LaunchAgents" && -w "${HOME}/Library/LaunchAgents" ]]; then
  pass "LaunchAgents escribible"
else
  fail "LaunchAgents no escribible"
fi

if [[ -x "${ROOT}/bmctl" ]]; then
  pass "bmctl ejecutable"
else
  fail "bmctl no ejecutable"
fi

echo
if [[ "${FAILED}" == "1" ]]; then
  echo "Preflight encontro bloqueadores."
  exit 1
fi

echo "Preflight OK."

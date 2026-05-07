#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
URL="${URL:-https://www.xbox.com/play}"
CONTROL_PATTERN="${CONTROL_PATTERN:-Rock Candy|Nintendo|Switch|0xe6f|0x187}"

echo "== xCloud sin Steam =="
echo

if hidutil list | rg -i "${CONTROL_PATTERN}" >/dev/null; then
  echo "OK  Control detectado por macOS:"
  hidutil list | rg -i "${CONTROL_PATTERN}" || true
else
  echo "NO  No veo el control. Reconecta USB antes de abrir xCloud."
  exit 1
fi

echo
echo "Cerrando Steam para evitar interferencias..."
osascript -e 'tell application "Steam" to quit' >/dev/null 2>&1 || true

echo "Abriendo Xbox Cloud en Safari..."
open -a "Safari" "${URL}"

echo
echo "Prueba:"
echo "1. En Safari entra al juego."
echo "2. Ya dentro del stream, presiona A / Start / sticks."
echo "3. Si Safari tampoco lo agarra, la ruta real sin login es hardware XInput: Mayflash MAGIC-NS 2."

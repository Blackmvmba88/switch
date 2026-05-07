#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== BlackMamba Input Runtime Health =="
echo

"${ROOT}/test-runtime.sh"

echo
echo "== Compatibility matrix =="
"${ROOT}/controller-doctor.sh" matrix

echo
echo "== Live HID snapshot =="
"${ROOT}/controller-doctor.sh" detect

echo
echo "Health check complete."


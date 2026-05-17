#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION="$(cat "${ROOT}/VERSION")"
OUT_DIR="${ROOT}/dist"
NAME="blackmamba-input-runtime-${VERSION}"
ARCHIVE="${OUT_DIR}/${NAME}.tar.gz"

cd "${ROOT}"

mkdir -p "${OUT_DIR}"

echo "== beta package preflight =="
"${ROOT}/doctor-preflight.sh"

echo
echo "== beta package tests =="
"${ROOT}/bmctl" test

echo
echo "== creating archive =="
git archive --format=tar --prefix="${NAME}/" HEAD | gzip -9 > "${ARCHIVE}"

echo "Package: ${ARCHIVE}"
du -sh "${ARCHIVE}"

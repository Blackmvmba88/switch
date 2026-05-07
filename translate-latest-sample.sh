#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROFILE="${1:-}"
SAMPLE="${2:-}"

if [[ -z "${PROFILE}" ]]; then
  PROFILE="$(find "${ROOT}/profiles" -maxdepth 1 -type f -name '*.normalized.json' | sort | tail -n 1)"
fi

if [[ -z "${SAMPLE}" ]]; then
  SAMPLE="$(find "${ROOT}/samples" -maxdepth 1 -type f -name '*.json' | sort | tail -n 1)"
fi

if [[ -z "${PROFILE}" || ! -f "${PROFILE}" ]]; then
  echo "No profile found. Import a sample first with ./import-controller-sample.sh"
  exit 1
fi

if [[ -z "${SAMPLE}" || ! -f "${SAMPLE}" ]]; then
  echo "No sample found. Import a sample first with ./import-controller-sample.sh"
  exit 1
fi

OUT="${ROOT}/outputs/runtime-frames-$(date '+%Y%m%d-%H%M%S').json"
node "${ROOT}/runtime/translate-sample.js" --profile "${PROFILE}" --sample "${SAMPLE}" --out "${OUT}"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-report}"

cd "${ROOT}"

safe_size() {
  local path="$1"
  if [[ -e "${path}" ]]; then
    du -sh "${path}" 2>/dev/null | awk '{print $1}'
  else
    echo "0B"
  fi
}

print_section() {
  printf '\n== %s ==\n' "$1"
}

report() {
  print_section "repo"
  git rev-parse --show-toplevel
  git status --short

  print_section "tracked source groups"
  printf 'runtime/              core translators, live monitor, CDP injector\n'
  printf 'xbox-gamepad-bridge/  browser Gamepad API bridge for xCloud\n'
  printf 'profiles/             durable controller semantic profiles\n'
  printf 'app/                  local Control Room UI\n'
  printf 'fixtures/             test samples\n'
  printf 'device-signatures/    observed device fingerprints\n'

  print_section "local runtime state"
  printf 'logs/                         %s\n' "$(safe_size logs)"
  printf '.tmp-runtime-test/            %s\n' "$(safe_size .tmp-runtime-test)"
  printf 'chrome-xbox-control-profile/  %s\n' "$(safe_size chrome-xbox-control-profile)"
  printf '/tmp/blackmamba-xcloud-cdp-profile %s\n' "$(safe_size /tmp/blackmamba-xcloud-cdp-profile)"

  print_section "ignored cleanup preview"
  git clean -Xdn logs .tmp-runtime-test chrome-xbox-control-profile 2>/dev/null || true

  print_section "active macOS runtime"
  printf 'AppSupport: %s\n' "${HOME}/Library/Application Support/BlackMambaInput"
  launchctl print "gui/$(id -u)/com.blackmamba.live-monitor" >/dev/null 2>&1 \
    && echo "live-monitor LaunchAgent: loaded" \
    || echo "live-monitor LaunchAgent: not loaded"
  launchctl print "gui/$(id -u)/com.blackmamba.hid-live-source" >/dev/null 2>&1 \
    && echo "hid-live-source LaunchAgent: loaded" \
    || echo "hid-live-source LaunchAgent: not loaded"
  launchctl print "gui/$(id -u)/com.blackmamba.xcloud-bridge" >/dev/null 2>&1 \
    && echo "xcloud-bridge LaunchAgent: loaded" \
    || echo "xcloud-bridge LaunchAgent: not loaded"
}

apply_cleanup() {
  print_section "closing runtime first"
  "${ROOT}/close-runtime.sh" || true

  print_section "cleaning safe local artifacts"
  rm -rf "${ROOT}/logs" "${ROOT}/.tmp-runtime-test" "${ROOT}/chrome-xbox-control-profile"
  mkdir -p "${ROOT}/logs"
  printf 'removed repo-local logs, tmp runtime build cache, and Chrome scratch profile\n'

  print_section "post-clean status"
  git status --short
}

case "${MODE}" in
  report|doctor|status)
    report
    ;;
  --apply|apply|clean)
    apply_cleanup
    ;;
  *)
    echo "Uso: ./repo-hygiene.sh [report|--apply]" >&2
    exit 2
    ;;
esac

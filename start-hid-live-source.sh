#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN="${ROOT}/.tmp-runtime-test/hid-live-source"
PID_FILE="${ROOT}/logs/hid-live-source.pid"
LOG_FILE="${ROOT}/logs/hid-live-source.log"
APP_ROOT="${HOME}/Library/Application Support/BlackMambaInput"

mkdir -p "${ROOT}/.tmp-runtime-test" "${ROOT}/logs"

app_daemon_pid() {
  pgrep -f "Application Support/BlackMambaInput/[.]tmp-runtime-test/hid-live-source|Application Support/BlackMambaInput/hid-live-source-agent.sh" | head -n 1 || true
}

app_daemon_loaded() {
  launchctl print "gui/$(id -u)/com.blackmamba.hid-live-source" >/dev/null 2>&1
}

wait_for_app_daemon() {
  local pid=""
  for _ in {1..12}; do
    pid="$(app_daemon_pid)"
    if [[ -n "${pid}" ]]; then
      echo "${pid}"
      return 0
    fi
    sleep 0.5
  done
  return 1
}

running_pid() {
  if [[ -f "${PID_FILE}" ]]; then
    local pid
    pid="$(cat "${PID_FILE}")"
    if kill -0 "${pid}" >/dev/null 2>&1; then
      echo "${pid}"
      return 0
    fi
  fi
  pgrep -f "${ROOT}/[.]tmp-runtime-test/hid-live-source|bash -c .*${ROOT}/[.]tmp-runtime-test/hid-live-source" | head -n 1 || true
}

APP_DAEMON_PID="$(app_daemon_pid)"
if [[ -n "${APP_DAEMON_PID}" ]]; then
  echo "hid-live-source daemon ya esta corriendo: ${APP_DAEMON_PID}"
  echo "Usando daemon persistente en: ${APP_ROOT}"
  exit 0
fi

if app_daemon_loaded; then
  echo "hid-live-source daemon cargado; esperando proceso persistente..."
  if APP_DAEMON_PID="$(wait_for_app_daemon)"; then
    echo "hid-live-source daemon ya esta corriendo: ${APP_DAEMON_PID}"
    echo "Usando daemon persistente en: ${APP_ROOT}"
    exit 0
  fi
  echo "Aviso: daemon cargado pero sin proceso visible; usando fallback repo."
fi

RUNNING_PID="$(running_pid)"
if [[ -n "${RUNNING_PID}" ]]; then
  echo "${RUNNING_PID}" > "${PID_FILE}"
  echo "hid-live-source ya esta corriendo: ${RUNNING_PID}"
  exit 0
fi

if [[ -f "${PID_FILE}" ]]; then
  rm -f "${PID_FILE}"
fi

if [[ ! -x "${BIN}" || "${ROOT}/runtime/hid-live-source.swift" -nt "${BIN}" ]]; then
  swiftc "${ROOT}/runtime/hid-live-source.swift" -o "${BIN}"
fi
nohup bash -c '
  set +e
  while true; do
    "'"${BIN}"'"
    code="$?"
    printf "%s hid-live-source exited code=%s; restarting in 1s\n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${code}"
    sleep 1
  done
' >> "${LOG_FILE}" 2>&1 < /dev/null &
PID="$!"
disown "${PID}" >/dev/null 2>&1 || true
echo "${PID}" > "${PID_FILE}"
echo "hid-live-source iniciado: ${PID}"
echo "Log: ${LOG_FILE}"

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="${ROOT}/.tmp-bmctl-cycle"
LOG_FILE="${TMP_DIR}/commands.log"
API_PORT="${BMCTL_TEST_API_PORT:-18147}"
API_URL="http://127.0.0.1:${API_PORT}"

mkdir -p "${TMP_DIR}"
: > "${LOG_FILE}"
export LOG_FILE

cat > "${TMP_DIR}/mock-api.js" <<'NODE'
const http = require("node:http");

const port = Number(process.argv[2]);
let runtime = {
  ok: true,
  version: "1.0",
  runtime: { state: "standby", active: false, bootedAt: new Date().toISOString(), uptimeMs: 0 },
  gameMode: { state: "idle", connected: false, graceEndsAt: null, lastTransitionAt: new Date().toISOString(), lastEvent: null },
  jobs: [],
  warnings: [],
  metrics: { restarts: 0, events: 0 }
};

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(`${JSON.stringify(payload, null, 2)}\n`);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    return json(res, 200, { ok: true, service: "blackmamba-api", port });
  }
  if (url.pathname === "/api/v1/runtime") {
    return json(res, 200, runtime);
  }
  if (url.pathname === "/api/v1/game/connect" && req.method === "POST") {
    runtime.runtime = { state: "game", active: true, bootedAt: runtime.runtime.bootedAt, uptimeMs: 1234 };
    runtime.gameMode = { state: "running", connected: true, graceEndsAt: null, lastTransitionAt: new Date().toISOString(), lastEvent: { type: "connected" } };
    return json(res, 200, { ok: true, runtime });
  }
  if (url.pathname === "/api/v1/game/reconnect" && req.method === "POST") {
    runtime.runtime = { state: "game", active: true, bootedAt: runtime.runtime.bootedAt, uptimeMs: 2345 };
    runtime.gameMode = { state: "running", connected: true, graceEndsAt: null, lastTransitionAt: new Date().toISOString(), lastEvent: { type: "reconnected" } };
    return json(res, 200, { ok: true, runtime });
  }
  if (url.pathname === "/api/v1/game/close" && req.method === "POST") {
    runtime.runtime = { state: "standby", active: false, bootedAt: runtime.runtime.bootedAt, uptimeMs: 3456 };
    runtime.gameMode = { state: "stopped", connected: false, graceEndsAt: null, lastTransitionAt: new Date().toISOString(), lastEvent: { type: "close" } };
    return json(res, 200, { ok: true, runtime });
  }
  return json(res, 404, { ok: false, error: "not_found" });
});

server.listen(port, "127.0.0.1");
NODE

cat > "${TMP_DIR}/start-api.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
echo "start-api" >> "${LOG_FILE}"
EOF

cat > "${TMP_DIR}/play-stack.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
echo "play-stack" >> "${LOG_FILE}"
EOF

cat > "${TMP_DIR}/close-runtime.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
echo "close-runtime" >> "${LOG_FILE}"
EOF

cat > "${TMP_DIR}/stop-api.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
echo "stop-api" >> "${LOG_FILE}"
EOF

chmod +x "${TMP_DIR}/start-api.sh" "${TMP_DIR}/play-stack.sh" "${TMP_DIR}/close-runtime.sh" "${TMP_DIR}/stop-api.sh"

node "${TMP_DIR}/mock-api.js" "${API_PORT}" >/dev/null 2>&1 &
MOCK_PID="$!"
trap 'kill "${MOCK_PID}" >/dev/null 2>&1 || true' EXIT
for _ in {1..50}; do
  if curl -fsS "${API_URL}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done
curl -fsS "${API_URL}/health" >/dev/null 2>&1

BMCTL_API_URL="${API_URL}" \
BMCTL_START_API_SCRIPT="${TMP_DIR}/start-api.sh" \
BMCTL_PLAY_STACK_SCRIPT="${TMP_DIR}/play-stack.sh" \
BMCTL_CLOSE_RUNTIME_SCRIPT="${TMP_DIR}/close-runtime.sh" \
BMCTL_STOP_API_SCRIPT="${TMP_DIR}/stop-api.sh" \
BMCTL_HTTP_TIMEOUT_MS=2000 \
./bmctl open >/dev/null

BMCTL_API_URL="${API_URL}" \
BMCTL_START_API_SCRIPT="${TMP_DIR}/start-api.sh" \
BMCTL_PLAY_STACK_SCRIPT="${TMP_DIR}/play-stack.sh" \
BMCTL_CLOSE_RUNTIME_SCRIPT="${TMP_DIR}/close-runtime.sh" \
BMCTL_STOP_API_SCRIPT="${TMP_DIR}/stop-api.sh" \
BMCTL_HTTP_TIMEOUT_MS=2000 \
./bmctl play >/dev/null

BMCTL_API_URL="${API_URL}" \
BMCTL_START_API_SCRIPT="${TMP_DIR}/start-api.sh" \
BMCTL_PLAY_STACK_SCRIPT="${TMP_DIR}/play-stack.sh" \
BMCTL_CLOSE_RUNTIME_SCRIPT="${TMP_DIR}/close-runtime.sh" \
BMCTL_STOP_API_SCRIPT="${TMP_DIR}/stop-api.sh" \
BMCTL_HTTP_TIMEOUT_MS=2000 \
./bmctl close >/dev/null

grep -qx "play-stack" "${LOG_FILE}"
grep -qx "close-runtime" "${LOG_FILE}"
grep -qx "stop-api" "${LOG_FILE}"

echo "OK bmctl cycle"

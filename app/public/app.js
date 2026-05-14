const output = document.querySelector("#output");
const overall = document.querySelector("#overall");
const lastRefresh = document.querySelector("#last-refresh");

function setText(id, value) {
  const node = document.querySelector(`#${id}`);
  if (node) node.textContent = value;
}

function setMetric(id, label, ok) {
  const node = document.querySelector(`#${id}`);
  if (!node) return;
  node.textContent = label;
  node.className = ok === true ? "ok" : ok === false ? "bad" : "warn";
}

async function getJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function refreshStatus() {
  try {
    const data = await getJson("/api/status");
    const liveOk = data.health.livePolling;
    const bridgeOk = data.health.xcloudInjected;
    const cdpOk = data.health.cdpAvailable;
    const padOk = data.health.virtualPadLikely;

    setMetric("livePolling", liveOk ? "PASS" : "FAIL", liveOk);
    setMetric("bridgeState", data.xcloud?.state || "off", bridgeOk);
    setMetric("cdpState", cdpOk ? "PASS" : "OFF", cdpOk);
    setMetric("padState", padOk ? "READY" : "WAIT", padOk || null);

    setText("frames", data.live?.frameCount ?? "--");
    setText("clients", data.live?.clients ?? "--");
    setText("stale", data.live?.staleMs == null ? "--" : `${data.live.staleMs}ms`);
    const xboxTab = data.cdp?.tabs?.find((tab) => /xbox\.com/.test(tab.url || ""));
    setText("tab", xboxTab?.title || "sin xCloud");

    overall.textContent = liveOk && padOk ? "READY" : liveOk ? "LIVE" : "CHECK";
    overall.className = `status-pill ${liveOk && padOk ? "ok" : liveOk ? "warn" : "bad"}`;
    lastRefresh.textContent = new Date().toLocaleTimeString();
  } catch (error) {
    overall.textContent = "ERROR";
    overall.className = "status-pill bad";
    output.textContent = error.stack || error.message;
  }
}

async function runCommand(command) {
  const buttons = Array.from(document.querySelectorAll("button"));
  buttons.forEach((button) => { button.disabled = true; });
  output.textContent = `Ejecutando ./bmctl ${command} ...`;
  try {
    const result = await getJson(`/api/run/${encodeURIComponent(command)}`, { method: "POST" });
    output.textContent = [
      result.command || command,
      `ok=${result.ok} code=${result.code} duration=${result.durationMs}ms`,
      "",
      result.stdout || "",
      result.stderr ? `\n[stderr]\n${result.stderr}` : ""
    ].join("\n").trim();
  } catch (error) {
    output.textContent = error.stack || error.message;
  } finally {
    buttons.forEach((button) => { button.disabled = false; });
    refreshStatus();
  }
}

async function loadLogs() {
  try {
    const logs = await getJson("/api/logs");
    output.textContent = [
      "== live-events ==",
      logs.liveEvents || "sin logs",
      "",
      "== xcloud-errors ==",
      logs.xcloudErrors || "sin errores"
    ].join("\n");
  } catch (error) {
    output.textContent = error.stack || error.message;
  }
}

document.addEventListener("click", (event) => {
  const command = event.target?.dataset?.command;
  if (command) runCommand(command);
});

document.querySelector("#refresh").addEventListener("click", refreshStatus);
document.querySelector("#logs").addEventListener("click", loadLogs);

refreshStatus();
setInterval(refreshStatus, 2500);

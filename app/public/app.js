const output = document.querySelector("#output");
const overall = document.querySelector("#overall");
const lastRefresh = document.querySelector("#last-refresh");
const mappingTargets = [
  "DPad_Up", "DPad_Right", "DPad_Down", "DPad_Left",
  "A", "B", "X", "Y",
  "LB", "RB", "LT", "RT",
  "Back", "Start", "L3", "R3", "Guide",
  "LX", "LY", "RX", "RY"
];
let profile = null;
let selectedTarget = "DPad_Up";
let listening = false;
let baselineSample = null;
let detectedBinding = null;
let mapperSocket = null;

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

function bindingText(binding) {
  if (!binding) return "--";
  if (binding.kind === "axis") {
    const to = Number.isFinite(Number(binding.to)) ? ` -> ${Number(binding.to).toFixed(3)}` : "";
    return `${binding.source}${to}`;
  }
  return binding.source;
}

function renderTargets() {
  const list = document.querySelector("#target-list");
  list.innerHTML = "";
  for (const target of mappingTargets) {
    const button = document.createElement("button");
    button.className = `target-chip ${target === selectedTarget ? "active" : ""}`;
    button.textContent = target;
    button.addEventListener("click", () => {
      selectedTarget = target;
      detectedBinding = null;
      baselineSample = null;
      renderTargets();
      renderMapper();
    });
    list.appendChild(button);
  }
}

function renderMapper() {
  setText("selected-target", selectedTarget);
  setText("current-binding", bindingText(profile?.semantic?.[selectedTarget]));
  setText("detected-binding", bindingText(detectedBinding));
  setText("mapper-state", listening ? "escuchando" : "idle");
  document.querySelector("#save-binding").disabled = !detectedBinding;
}

async function loadProfile() {
  const data = await getJson("/api/profile");
  profile = data.profile;
  renderMapper();
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

function normalizeSample(sample) {
  return {
    buttons: Array.from(sample?.buttons || []).map((button) => Number(button?.value || 0)),
    axes: Array.from(sample?.axes || []).map((axis) => Number(axis || 0))
  };
}

function detectChangedInput(base, sample) {
  const current = normalizeSample(sample);
  let best = null;
  for (let index = 0; index < Math.max(base.buttons.length, current.buttons.length); index += 1) {
    const from = base.buttons[index] || 0;
    const to = current.buttons[index] || 0;
    const delta = Math.abs(to - from);
    if (delta > 0.5 && to > 0.5 && (!best || delta > best.delta)) {
      best = { source: `B${index}`, kind: "button", index, delta, from, to };
    }
  }
  for (let index = 0; index < Math.max(base.axes.length, current.axes.length); index += 1) {
    const from = base.axes[index] || 0;
    const to = current.axes[index] || 0;
    const delta = Math.abs(to - from);
    if (delta > 0.25 && (!best || delta > best.delta)) {
      best = { source: `A${index}`, kind: "axis", index, delta, from, to };
    }
  }
  if (!best) return null;
  return best.kind === "axis"
    ? { source: best.source, kind: "axis", index: best.index, from: best.from, to: best.to }
    : { source: best.source, kind: "button", index: best.index };
}

function connectMapperSocket() {
  if (mapperSocket && mapperSocket.readyState <= 1) return;
  mapperSocket = new WebSocket("ws://127.0.0.1:8137/live");
  mapperSocket.addEventListener("message", (event) => {
    if (!listening) return;
    const message = JSON.parse(event.data);
    if (message.type !== "semantic-frame" || !message.rawSample) return;
    if (!baselineSample) {
      baselineSample = normalizeSample(message.rawSample);
      return;
    }
    const binding = detectChangedInput(baselineSample, message.rawSample);
    if (binding) {
      detectedBinding = binding;
      listening = false;
      renderMapper();
      output.textContent = `Detectado ${selectedTarget}: ${bindingText(binding)}\nAhora puedes guardar.`;
    }
  });
  mapperSocket.addEventListener("close", () => {
    if (listening) setTimeout(connectMapperSocket, 500);
  });
}

function startListening() {
  detectedBinding = null;
  baselineSample = null;
  listening = true;
  connectMapperSocket();
  renderMapper();
  output.textContent = `Escuchando ${selectedTarget}.\nAprieta el boton o direccion fisica ahora.`;
}

async function saveBinding() {
  if (!detectedBinding) return;
  const result = await getJson("/api/profile/binding", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ semantic: selectedTarget, binding: detectedBinding })
  });
  output.textContent = JSON.stringify(result, null, 2);
  await loadProfile();
  await refreshStatus();
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
document.querySelector("#listen-binding").addEventListener("click", startListening);
document.querySelector("#save-binding").addEventListener("click", saveBinding);

renderTargets();
loadProfile().catch((error) => { output.textContent = error.stack || error.message; });
refreshStatus();
setInterval(refreshStatus, 2500);

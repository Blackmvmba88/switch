const output = document.querySelector("#output");
const overall = document.querySelector("#overall");
const lastRefresh = document.querySelector("#last-refresh");
const atlasHeaderBadge = document.querySelector("#atlas-header-badge");
const atlasMenu = document.querySelector("#atlas-menu");
let atlasState = null;
const mappingTargets = [
  "DPad_Up", "DPad_Right", "DPad_Down", "DPad_Left",
  "A", "B", "X", "Y",
  "LB", "RB", "LT", "RT",
  "Back", "Start", "L3", "R3", "Guide",
  "LX", "LY", "RX", "RY"
];
const modePresets = {
  game: {
    label: "Game On",
    copy: "Game mode activo: acceso directo al runtime puro.",
    commands: [
      { command: "wake", label: "Wake xCloud", primary: true },
      { command: "verify", label: "Verify" },
      { command: "buttons", label: "Botones Live" },
      { command: "reinject", label: "Reinject" }
    ],
    row: [
      { command: "fortnite-map", label: "Fortnite Map" },
      { command: "switch-map", label: "Switch Map" },
      { command: "game-on", label: "Game On", warn: true },
      { command: "game-off", label: "Game Off" },
      { command: "close", label: "Cerrar juego", danger: true }
    ]
  },
  manual: {
    label: "Manual",
    copy: "Modo humano: control limpio, poco ruido y acciones a mano.",
    commands: [
      { command: "wake", label: "Abrir xCloud", primary: true },
      { command: "verify", label: "Checar" },
      { command: "buttons", label: "Ver botones" },
      { command: "reinject", label: "Reinyectar" }
    ],
    row: [
      { command: "fortnite-map", label: "Perfil FN" },
      { command: "switch-map", label: "Perfil Switch" },
      { command: "game-on", label: "Entrar juego", warn: true },
      { command: "game-off", label: "Salir juego" },
      { command: "close", label: "Cerrar sesión", danger: true }
    ]
  },
  fun: {
    label: "Fun",
    copy: "Modo divertido: los mismos comandos, pero con nombres más juguetones.",
    commands: [
      { command: "wake", label: "Despertar dragón", primary: true },
      { command: "verify", label: "Confirmar" },
      { command: "buttons", label: "Leer manos" },
      { command: "reinject", label: "Rearmar" }
    ],
    row: [
      { command: "fortnite-map", label: "Fortnite vibe" },
      { command: "switch-map", label: "Switch vibe" },
      { command: "game-on", label: "A jugar", warn: true },
      { command: "game-off", label: "Descansar" },
      { command: "close", label: "Apagar todo", danger: true }
    ]
  }
};
let profile = null;
let selectedTarget = "DPad_Up";
let activeMode = "game";
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

function setAtlasBadge(state) {
  if (!atlasHeaderBadge) return;
  const label = state === "preferred"
    ? "Atlas preferred"
    : state === "opened"
    ? "Atlas opened"
    : state === "missing"
      ? "Atlas missing"
        : "Atlas";
  atlasHeaderBadge.textContent = label;
  atlasHeaderBadge.title = state === "preferred"
    ? "Click to open Atlas"
    : state === "opened"
      ? "Click to prefer Atlas"
      : state === "missing"
        ? "Atlas not found"
        : "Atlas";
  atlasHeaderBadge.className = `status-pill atlas-badge atlas-${state || "unknown"}`;
}

function openAtlasOrPrefer() {
  if (!atlasMenu) return;
  atlasMenu.hidden = !atlasMenu.hidden;
}

function runAtlasAction(command) {
  if (!command) return;
  fetch(`/api/run/${encodeURIComponent(command)}`, { method: "POST" })
    .then(() => loadAtlasStatus())
    .then(() => refreshStatus())
    .catch(() => {});
  output.textContent = `Ejecutando ${command}...`;
  if (atlasMenu) atlasMenu.hidden = true;
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

function renderModes() {
  const container = document.querySelector("#mode-switch");
  if (!container) return;
  container.innerHTML = "";
  for (const [mode, preset] of Object.entries(modePresets)) {
    const button = document.createElement("button");
    button.className = `mode-chip ${mode === activeMode ? "active" : ""}`;
    button.textContent = preset.label;
    button.addEventListener("click", () => {
      activeMode = mode;
      fetch("/api/mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode })
      }).catch(() => {});
      renderModes();
      renderActions();
    });
    container.appendChild(button);
  }
}

function renderActions() {
  const preset = modePresets[activeMode] || modePresets.game;
  const modeCopy = document.querySelector("#mode-copy");
  if (modeCopy) modeCopy.textContent = preset.copy;

  const primaryGrid = document.querySelector(".primary-actions .action-grid");
  const modeRow = document.querySelector(".primary-actions .mode-row");
  if (!primaryGrid || !modeRow) return;

  primaryGrid.innerHTML = "";
  modeRow.innerHTML = "";

  for (const item of preset.commands) {
    const button = document.createElement("button");
    button.dataset.command = item.command;
    button.className = `action${item.primary ? " primary" : ""}`;
    button.textContent = item.label;
    primaryGrid.appendChild(button);
  }

  for (const item of preset.row) {
    const button = document.createElement("button");
    button.dataset.command = item.command;
    button.className = `action compact${item.warn ? " warn" : ""}${item.danger ? " danger" : ""}`;
    button.textContent = item.label;
    modeRow.appendChild(button);
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

async function loadMode() {
  const data = await getJson("/api/mode");
  const mode = data.mode?.mode || "game";
  if (modePresets[mode]) {
    activeMode = mode;
    renderModes();
    renderActions();
  }
}

async function loadAtlasStatus() {
  const data = await getJson("/api/atlas-status");
  atlasState = data;
  const atlasMode = data.browser?.preference === "atlas"
    ? "preferred"
    : data.browser?.state || (data.atlasInstalled ? "installed" : "missing");
  setText("atlas-state", atlasMode);
  setAtlasBadge(data.browser?.preference === "atlas" ? "preferred" : data.browser?.state);
  setText("atlas-action", data.action || "Atlas listo para jugar.");
  setMetric("atlasInstalled", data.atlasInstalled ? "YES" : "NO", data.atlasInstalled);
  setText("atlasTarget", data.targetUrl || "--");
  setText("atlasBrowser", data.browser?.browser || data.browser?.state || "--");
  setMetric("atlasBridge", data.bridge?.state || "--", data.bridge?.state === "injected" ? true : null);
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
    await loadAtlasStatus();
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
document.querySelector("#atlas-refresh").addEventListener("click", loadAtlasStatus);
document.querySelector("#logs").addEventListener("click", loadLogs);
document.querySelector("#listen-binding").addEventListener("click", startListening);
document.querySelector("#save-binding").addEventListener("click", saveBinding);
if (atlasHeaderBadge) atlasHeaderBadge.addEventListener("click", openAtlasOrPrefer);
if (atlasMenu) {
  atlasMenu.addEventListener("click", (event) => {
    const command = event.target?.dataset?.atlasAction;
    if (command) runAtlasAction(command);
  });
}
document.addEventListener("click", (event) => {
  if (!atlasMenu || !atlasHeaderBadge) return;
  const withinHeader = atlasMenu.contains(event.target) || atlasHeaderBadge.contains(event.target);
  if (!withinHeader) atlasMenu.hidden = true;
});

renderModes();
renderActions();
renderTargets();
loadProfile().catch((error) => { output.textContent = error.stack || error.message; });
loadMode().catch((error) => { output.textContent = error.stack || error.message; });
loadAtlasStatus().catch((error) => { output.textContent = error.stack || error.message; });
refreshStatus();
setInterval(refreshStatus, 2500);

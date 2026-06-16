const output = document.querySelector("#output");
const overall = document.querySelector("#overall");
const lastRefresh = document.querySelector("#last-refresh");
const liveConnection = document.querySelector("#live-connection");
const liveFrameCount = document.querySelector("#live-frame-count");
const liveDevice = document.querySelector("#live-device");
const liveUpdated = document.querySelector("#live-updated");
const liveEventsCount = document.querySelector("#live-events-count");
const liveButtons = document.querySelector("#live-buttons");
const liveAxes = document.querySelector("#live-axes");
const liveEvents = document.querySelector("#live-events");
const editToggle = document.querySelector("#edit-toggle");
const editToolbar = document.querySelector("#edit-toolbar");
const editScale = document.querySelector("#edit-scale");
const editTop = document.querySelector("#edit-top");
const editLeft = document.querySelector("#edit-left");
const editButtonsX = document.querySelector("#edit-buttons-x");
const editButtonsY = document.querySelector("#edit-buttons-y");
const editArtOpacity = document.querySelector("#edit-art-opacity");
const editCenterOpacity = document.querySelector("#edit-center-opacity");
const editShellOpacity = document.querySelector("#edit-shell-opacity");
const editNodeX = document.querySelector("#edit-node-x");
const editNodeY = document.querySelector("#edit-node-y");
const editHideSelected = document.querySelector("#edit-hide-selected");
const editShowAll = document.querySelector("#edit-show-all");
const recDpadButton = document.querySelector("#rec-dpad");
const controllerStage = document.querySelector(".controller-stage");
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
let liveSocket = null;
let editMode = false;
let selectedEditNode = "stick-left";
let lockedEditNode = null;
let recDpad = false;
let dpadCapture = [];
let dpadSnapshot = { DPad_Up: 0, DPad_Down: 0, DPad_Left: 0, DPad_Right: 0 };
let editState = {
  scale: 1,
  top: 0,
  left: 0,
  buttonsX: 0,
  buttonsY: 0,
  artOpacity: 1,
  centerOpacity: 0.08,
  shellOpacity: 0.22,
  hidden: {},
  nodes: {}
};
let dragState = null;
let liveState = {
  frameCount: 0,
  device: "--",
  updatedAt: "--",
  events: [],
  buttons: {},
  axes: {},
  connected: false,
  lastError: ""
};

function loadEditState() {
  try {
    const saved = JSON.parse(localStorage.getItem("bm_control_edit") || "{}");
    editState.scale = Number(saved.scale || 1);
    editState.top = Number(saved.top || 0);
    editState.left = Number(saved.left || 0);
    editState.buttonsX = Number(saved.buttonsX || 0);
    editState.buttonsY = Number(saved.buttonsY || 0);
    editState.artOpacity = 1;
    editState.centerOpacity = Number(saved.centerOpacity ?? 0.08);
    editState.shellOpacity = Number(saved.shellOpacity ?? 0.22);
    editState.hidden = saved.hidden || {};
    editState.nodes = saved.nodes || {};
    lockedEditNode = saved.lockedEditNode || null;
    recDpad = Boolean(saved.recDpad || false);
  } catch (_) {}
}

function saveEditState() {
  localStorage.setItem("bm_control_edit", JSON.stringify({
    ...editState,
    lockedEditNode,
    recDpad
  }));
}

function setNodeOffset(node, x = 0, y = 0) {
  node.style.setProperty("--edit-x", `${x}px`);
  node.style.setProperty("--edit-y", `${y}px`);
}

function applyEditState() {
  if (!controllerStage) return;
  controllerStage.style.setProperty("--stage-scale", String(editState.scale));
  controllerStage.style.setProperty("--stage-top", `${editState.top}px`);
  controllerStage.style.setProperty("--stage-left", `${editState.left}px`);
  controllerStage.style.setProperty("--art-opacity", String(editState.artOpacity));
  controllerStage.style.setProperty("--center-opacity", String(editState.centerOpacity));
  controllerStage.style.setProperty("--shell-opacity", String(editState.shellOpacity));
  if (controllerStage.parentElement) {
    controllerStage.querySelector(".controller-shell")?.style.setProperty("--buttons-x", `${editState.buttonsX}px`);
    controllerStage.querySelector(".controller-shell")?.style.setProperty("--buttons-y", `${editState.buttonsY}px`);
  }
  if (editScale) editScale.value = String(editState.scale);
  if (editTop) editTop.value = String(editState.top);
  if (editLeft) editLeft.value = String(editState.left);
  if (editButtonsX) editButtonsX.value = String(editState.buttonsX);
  if (editButtonsY) editButtonsY.value = String(editState.buttonsY);
  if (editArtOpacity) editArtOpacity.value = String(editState.artOpacity);
  if (editCenterOpacity) editCenterOpacity.value = String(editState.centerOpacity);
  if (editShellOpacity) editShellOpacity.value = String(editState.shellOpacity);
  for (const [name, state] of Object.entries(editState.nodes)) {
    const node = document.querySelector(`[data-live-button="${name}"], [data-edit-node="${name}"]`);
    if (node) {
      node.classList.toggle("selected", name === selectedEditNode);
      setNodeOffset(node, Number(state.x || 0), Number(state.y || 0));
      node.classList.toggle("hidden-edit", Boolean(editState.hidden[name]));
    }
  }
  for (const node of document.querySelectorAll("[data-live-button], [data-edit-node]")) {
    const name = node.dataset.liveButton || node.dataset.editNode;
    if (name && !(name in editState.nodes)) {
      node.classList.toggle("selected", name === selectedEditNode);
      setNodeOffset(node, 0, 0);
    }
    if (name) node.classList.toggle("hidden-edit", Boolean(editState.hidden[name]));
  }
  const selected = editState.nodes[selectedEditNode] || { x: 0, y: 0 };
  if (editNodeX) editNodeX.value = String(Number(selected.x || 0));
  if (editNodeY) editNodeY.value = String(Number(selected.y || 0));
}

function setEditMode(enabled) {
  editMode = enabled;
  document.body.classList.toggle("edit-mode", enabled);
  if (editToolbar) editToolbar.hidden = !enabled;
  if (editToggle) editToggle.textContent = enabled ? "Done" : "Edit";
  applyEditState();
}

function selectEditNode(name) {
  selectedEditNode = name;
  lockedEditNode = null;
  const current = editState.nodes[name] || { x: 0, y: 0 };
  if (editNodeX) editNodeX.value = String(Number(current.x || 0));
  if (editNodeY) editNodeY.value = String(Number(current.y || 0));
  applyEditState();
}

function lockEditNode(name) {
  lockedEditNode = name;
  selectedEditNode = name;
  const current = editState.nodes[name] || { x: 0, y: 0 };
  if (editNodeX) editNodeX.value = String(Number(current.x || 0));
  if (editNodeY) editNodeY.value = String(Number(current.y || 0));
  applyEditState();
}

function setRecDpad(enabled) {
  recDpad = enabled;
  dpadSnapshot = { DPad_Up: 0, DPad_Down: 0, DPad_Left: 0, DPad_Right: 0 };
  if (!enabled) {
    dpadCapture = [];
  }
  if (recDpadButton) {
    recDpadButton.textContent = enabled ? "REC DPad ON" : "REC DPad";
    recDpadButton.classList.toggle("warn", enabled);
  }
  saveEditState();
}

function logDpadSample(frame) {
  if (!recDpad) return;
  const names = ["DPad_Up", "DPad_Down", "DPad_Left", "DPad_Right"];
  const now = new Date().toLocaleTimeString();
  for (const name of names) {
    const state = frame?.buttons?.[name];
    const pressed = Boolean(state?.pressed || buttonValue(state) > 0.5);
    if (pressed !== Boolean(dpadSnapshot[name])) {
      dpadSnapshot[name] = pressed ? 1 : 0;
      const line = `${now} ${pressed ? "DOWN" : "UP"} ${name}`;
      dpadCapture.push(line);
      dpadCapture = dpadCapture.slice(-120);
      pushLiveEvent(`[REC] ${line}`);
    }
  }
}

function toggleSelectedVisibility(forceVisible = null) {
  if (!selectedEditNode) return;
  const hidden = Boolean(editState.hidden[selectedEditNode]);
  editState.hidden[selectedEditNode] = forceVisible === true ? false : forceVisible === false ? true : !hidden;
  saveEditState();
  applyEditState();
}

function updateLiveConnection(state, label) {
  if (!liveConnection) return;
  liveConnection.textContent = label;
  liveConnection.className = state;
}

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

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function buttonValue(state) {
  if (!state) return 0;
  return Number(state.value || (state.pressed ? 1 : 0) || 0);
}

function formatButtonState(state) {
  if (!state) return "0";
  return state.kind === "axis"
    ? `${Number(state.value || 0).toFixed(3)}`
    : `${buttonValue(state).toFixed(0)}`;
}

function renderLiveButtons() {
  if (!liveButtons) return;
  const names = [
    "A", "B", "X", "Y", "LB", "RB", "LT", "RT",
    "Back", "Start", "L3", "R3", "DPad_Up", "DPad_Down", "DPad_Left", "DPad_Right", "Guide"
  ];
  liveButtons.innerHTML = "";
  for (const name of names) {
    const state = liveState.buttons?.[name];
    const el = document.createElement("div");
    const active = Boolean(state?.pressed || buttonValue(state) > 0.5);
    el.className = `live-button ${active ? "on" : ""}`;
    el.textContent = `${name} ${formatButtonState(state)}`;
    liveButtons.appendChild(el);
  }
}

function updateControllerNode(name, state) {
  const node = document.querySelector(`[data-live-button="${name}"]`);
  if (!node) return;
  const active = Boolean(state?.pressed || buttonValue(state) > 0.5);
  node.classList.toggle("active", active);
}

function renderLiveAxes() {
  if (!liveAxes) return;
  const names = ["LX", "LY", "RX", "RY"];
  liveAxes.innerHTML = "";
  for (const name of names) {
    const axis = liveState.axes?.[name] || {};
    const value = Number(axis.value || 0);
    const raw = Number(axis.raw || 0);
    const row = document.createElement("div");
    row.className = "live-axis-row";
    const label = document.createElement("strong");
    label.textContent = name;
    const bar = document.createElement("div");
    bar.className = "live-axis-bar";
    const fill = document.createElement("div");
    fill.className = `live-axis-fill ${value < 0 ? "negative" : ""}`;
    const width = `${clamp01(Math.abs(value)) * 50}%`;
    fill.style.width = width;
    if (value < 0) {
      fill.style.right = "50%";
      fill.style.left = "auto";
    } else {
      fill.style.left = "50%";
    }
    bar.appendChild(fill);
    const metric = document.createElement("span");
    metric.textContent = `${value.toFixed(3)} / ${raw.toFixed(3)}`;
    row.appendChild(label);
    row.appendChild(bar);
    row.appendChild(metric);
    liveAxes.appendChild(row);
  }
}

function renderControllerShell() {
  for (const name of ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "L3", "R3", "DPad_Up", "DPad_Down", "DPad_Left", "DPad_Right", "Guide"]) {
    updateControllerNode(name, liveState.buttons?.[name]);
  }
  const lx = Number(liveState.axes?.LX?.value || 0);
  const ly = Number(liveState.axes?.LY?.value || 0);
  const rx = Number(liveState.axes?.RX?.value || 0);
  const ry = Number(liveState.axes?.RY?.value || 0);
  const lxcap = document.querySelector("#live-lxcap");
  const rxcap = document.querySelector("#live-rxcap");
  if (lxcap) {
    lxcap.style.setProperty("--stick-x", `${lx * 18}px`);
    lxcap.style.setProperty("--stick-y", `${ly * 18}px`);
  }
  if (rxcap) {
    rxcap.style.setProperty("--stick-x", `${rx * 18}px`);
    rxcap.style.setProperty("--stick-y", `${ry * 18}px`);
  }
}

function renderLiveEvents() {
  if (!liveEvents) return;
  liveEvents.textContent = liveState.events.length
    ? liveState.events.join("\n")
    : recDpad && dpadCapture.length
      ? dpadCapture.join("\n")
      : "Esperando datos...";
}

function pushLiveEvent(text) {
  liveState.events.push(text);
  liveState.events = liveState.events.slice(-40);
  if (liveEventsCount) liveEventsCount.textContent = String(liveState.events.length);
}

function renderLiveState() {
  if (liveFrameCount) liveFrameCount.textContent = String(liveState.frameCount);
  if (liveDevice) liveDevice.textContent = liveState.device?.id || liveState.device || "--";
  if (liveUpdated) liveUpdated.textContent = liveState.updatedAt || "--";
  if (liveEventsCount) liveEventsCount.textContent = String(liveState.events.length);
  renderLiveButtons();
  renderLiveAxes();
  renderControllerShell();
  renderLiveEvents();
}

function attachEditControls() {
  if (!controllerStage) return;
  const editNodes = Array.from(controllerStage.querySelectorAll("[data-live-button], [data-edit-node]"));
  for (const node of editNodes) {
    if (!node.dataset.editBound) {
      node.dataset.editBound = "1";
      node.addEventListener("pointerdown", (event) => {
        if (!editMode) return;
        event.stopPropagation();
        const name = node.dataset.liveButton || node.dataset.editNode;
        if (lockedEditNode && lockedEditNode !== name) return;
        selectEditNode(name);
        const current = editState.nodes[name] || { x: 0, y: 0 };
        dragState = {
          type: "node",
          name,
          startX: event.clientX,
          startY: event.clientY,
          x: Number(current.x || 0),
          y: Number(current.y || 0),
          node
        };
        if (node.setPointerCapture) {
          node.setPointerCapture(event.pointerId);
        }
      });
    }
  }
  controllerStage.addEventListener("pointerdown", (event) => {
    if (!editMode) return;
    if (lockedEditNode) return;
    if (event.target?.closest?.("[data-live-button], [data-edit-node], .controller-stick")) return;
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      top: editState.top,
      left: editState.left
    };
    controllerStage.setPointerCapture(event.pointerId);
  });

  controllerStage.addEventListener("pointermove", (event) => {
    if (!editMode || !dragState) return;
    if (dragState.type === "node") {
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      editState.nodes[dragState.name] = {
        x: dragState.x + dx,
        y: dragState.y + dy
      };
      setNodeOffset(dragState.node, editState.nodes[dragState.name].x, editState.nodes[dragState.name].y);
    } else {
      editState.left = dragState.left + (event.clientX - dragState.startX);
      editState.top = dragState.top + (event.clientY - dragState.startY);
    }
    applyEditState();
  });

  controllerStage.addEventListener("pointerup", (event) => {
    if (!editMode || !dragState) return;
    dragState = null;
    saveEditState();
  });

  controllerStage.addEventListener("wheel", (event) => {
    if (!editMode) return;
    event.preventDefault();
    editState.scale = Math.max(0.6, Math.min(1.4, editState.scale + (event.deltaY > 0 ? -0.02 : 0.02)));
    applyEditState();
    saveEditState();
  }, { passive: false });
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
  const atlasMode = data.browser?.preference === "atlas"
    ? "preferred"
    : data.browser?.state || (data.atlasInstalled ? "installed" : "missing");
  setText("atlas-state", atlasMode);
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

function connectLiveMonitor() {
  if (liveSocket && liveSocket.readyState <= 1) return;
  updateLiveConnection("warn", "conectando...");
  liveSocket = new WebSocket("ws://127.0.0.1:8137/live");
  liveSocket.addEventListener("open", () => {
    liveState.connected = true;
    liveState.lastError = "";
    updateLiveConnection("ok", "en vivo");
  });
  liveSocket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(event.data);
      if (message.type === "hello") return;
      if (message.type !== "semantic-frame") return;
      liveState.frameCount += 1;
      liveState.device = message.device || liveState.device;
      liveState.updatedAt = new Date().toLocaleTimeString();
      liveState.buttons = message.frame?.buttons || {};
      liveState.axes = message.frame?.axes || {};
      logDpadSample(message.frame);

      const eventLines = [];
      for (const item of message.events || []) {
        const value = item.value == null ? "" : ` ${item.value}`;
        eventLines.push(`${item.event.toUpperCase()} ${item.name} (${item.source || "--"})${value}`);
      }
      if (eventLines.length) {
        for (const line of eventLines) pushLiveEvent(line);
      }
      renderLiveState();
    } catch (error) {
      liveState.lastError = error.message;
      updateLiveConnection("bad", "error");
    }
  });
  liveSocket.addEventListener("close", () => {
    liveState.connected = false;
    updateLiveConnection("bad", "desconectado");
    setTimeout(connectLiveMonitor, 1000);
  });
  liveSocket.addEventListener("error", () => {
    liveState.lastError = "websocket error";
    updateLiveConnection("bad", "error");
  });
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
editToggle?.addEventListener("click", () => setEditMode(!editMode));
document.querySelectorAll("[data-select-node]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!editMode) setEditMode(true);
    selectEditNode(button.dataset.selectNode);
  });
});
document.querySelectorAll("[data-lock-node]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!editMode) setEditMode(true);
    lockEditNode(button.dataset.lockNode);
  });
});
editScale?.addEventListener("input", () => {
  editState.scale = Number(editScale.value);
  saveEditState();
  applyEditState();
});
editTop?.addEventListener("input", () => {
  editState.top = Number(editTop.value);
  saveEditState();
  applyEditState();
});
editLeft?.addEventListener("input", () => {
  editState.left = Number(editLeft.value);
  saveEditState();
  applyEditState();
});
editButtonsX?.addEventListener("input", () => {
  editState.buttonsX = Number(editButtonsX.value);
  saveEditState();
  applyEditState();
});
editButtonsY?.addEventListener("input", () => {
  editState.buttonsY = Number(editButtonsY.value);
  saveEditState();
  applyEditState();
});
editArtOpacity?.addEventListener("input", () => {
  editState.artOpacity = Number(editArtOpacity.value);
  saveEditState();
  applyEditState();
});
editCenterOpacity?.addEventListener("input", () => {
  editState.centerOpacity = Number(editCenterOpacity.value);
  saveEditState();
  applyEditState();
});
editShellOpacity?.addEventListener("input", () => {
  editState.shellOpacity = Number(editShellOpacity.value);
  saveEditState();
  applyEditState();
});
editNodeX?.addEventListener("input", () => {
  if (!selectedEditNode) return;
  const current = editState.nodes[selectedEditNode] || { x: 0, y: 0 };
  editState.nodes[selectedEditNode] = { x: Number(editNodeX.value), y: Number(current.y || 0) };
  saveEditState();
  applyEditState();
});
editNodeY?.addEventListener("input", () => {
  if (!selectedEditNode) return;
  const current = editState.nodes[selectedEditNode] || { x: 0, y: 0 };
  editState.nodes[selectedEditNode] = { x: Number(current.x || 0), y: Number(editNodeY.value) };
  saveEditState();
  applyEditState();
});
editHideSelected?.addEventListener("click", () => toggleSelectedVisibility(false));
editShowAll?.addEventListener("click", () => {
  editState.hidden = {};
  saveEditState();
  applyEditState();
});
recDpadButton?.addEventListener("click", () => {
  setRecDpad(!recDpad);
  renderLiveState();
});
if (recDpadButton) {
  recDpadButton.textContent = recDpad ? "REC DPad ON" : "REC DPad";
  recDpadButton.classList.toggle("warn", recDpad);
}
window.addEventListener("keydown", (event) => {
  if (!editMode) return;
  if (event.key === "Escape") {
    lockedEditNode = null;
    saveEditState();
    applyEditState();
  }
});
loadEditState();
applyEditState();
attachEditControls();
renderModes();
renderActions();
renderTargets();
connectLiveMonitor();
loadProfile().catch((error) => { output.textContent = error.stack || error.message; });
loadMode().catch((error) => { output.textContent = error.stack || error.message; });
loadAtlasStatus().catch((error) => { output.textContent = error.stack || error.message; });
refreshStatus();
setInterval(refreshStatus, 2500);

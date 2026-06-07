(() => {
  const BRIDGE_VERSION = "2026-05-17. BCR-v1";
  if (window.top !== window) return;
  if (window.__bcrInstalled && window.__bcrVersion === BRIDGE_VERSION) return;

  if (typeof window.__bcrCleanup === "function") {
    try { window.__bcrCleanup(); } catch (_) {}
  }

  window.__bcrInstalled = true;
  window.__bcrVersion = BRIDGE_VERSION;

  const bridge = {
    ws: null,
    lastFrame: null,
    connected: false,
    framesReceived: 0,
    lastError: null,
    reconnectTimer: null
  };

  window.BlackMambaBridge = bridge; // For agent verification

  function log(msg) {
    console.log(`%c[BCR Bridge] ${msg}`, "color: #00ff00; font-weight: bold;");
  }

  function connect() {
    if (bridge.ws) return;

    log("Connecting to BCR Semantic Bus...");
    const ws = new WebSocket("ws://127.0.0.1:8137/live");
    bridge.ws = ws;

    ws.onopen = () => {
      bridge.connected = true;
      bridge.lastError = null;
      log("Connected to BCR.");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "semantic-frame") {
          bridge.lastFrame = msg.frame;
          bridge.framesReceived++;
        }
      } catch (e) {
        bridge.lastError = "json_parse_error";
      }
    };

    ws.onclose = () => {
      bridge.connected = false;
      bridge.ws = null;
      if (!bridge.reconnectTimer) {
        bridge.reconnectTimer = setTimeout(() => {
          bridge.reconnectTimer = null;
          connect();
        }, 2000);
      }
    };

    ws.onerror = (e) => {
      bridge.lastError = "ws_error";
    };
  }

  // Intercept navigator.getGamepads
  const originalGetGamepads = navigator.getGamepads.bind(navigator);
  navigator.getGamepads = function() {
    const pads = Array.from(originalGetGamepads());

    if (bridge.lastFrame) {
      const f = bridge.lastFrame;
      const b = (name) => ({
        pressed: f.buttons?.[name]?.pressed || false,
        touched: f.buttons?.[name]?.touched || false,
        value: f.buttons?.[name]?.value || 0
      });

      const virtualPad = {
        id: "Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)",
        index: 0,
        mapping: "standard",
        connected: true,
        timestamp: f.t,
        axes: [
          f.axes?.LX || 0,
          f.axes?.LY || 0,
          f.axes?.RX || 0,
          f.axes?.RY || 0
        ],
        buttons: [
          b("A"), b("B"), b("X"), b("Y"),
          b("LB"), b("RB"), b("LT"), b("RT"),
          b("Back"), b("Start"), b("L3"), b("R3"),
          b("DPad_Up"), b("DPad_Down"), b("DPad_Left"), b("DPad_Right"),
          b("Guide")
        ]
      };

      // Inject as the first pad for xCloud
      if (pads.length > 0) pads[0] = virtualPad;
      else pads.push(virtualPad);
    }

    return pads;
  };

  window.__bcrCleanup = () => {
    if (bridge.ws) bridge.ws.close();
    navigator.getGamepads = originalGetGamepads;
    log("Bridge uninstalled.");
  };

  connect();
})();

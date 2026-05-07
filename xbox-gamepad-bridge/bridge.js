(() => {
  if (window.__xboxCloudGamepadBridgeInstalled) {
    return;
  }
  window.__xboxCloudGamepadBridgeInstalled = true;

  const originalGetGamepads = navigator.getGamepads
    ? navigator.getGamepads.bind(navigator)
    : null;
  const bridgeState = {
    frame: null,
    connected: false,
    announced: false,
    lastSeen: 0,
    ws: null,
    reconnectTimer: null
  };

  const targetPattern = /(rock candy|nintendo|switch|pro controller|0e6f|0x0e6f|0187|0x0187)/i;
  const hatDirections = [
    { value: -1.000, buttons: ["up"] },
    { value: -0.714, buttons: ["up", "right"] },
    { value: -0.429, buttons: ["right"] },
    { value: -0.143, buttons: ["down", "right"] },
    { value: 0.143, buttons: ["down"] },
    { value: 0.429, buttons: ["down", "left"] },
    { value: 0.714, buttons: ["left"] },
    { value: 1.000, buttons: ["up", "left"] },
    { value: 1.286, buttons: [] },
    { value: 3.286, buttons: [] }
  ];

  function button(source, fallbackValue = 0) {
    if (!source) {
      return { pressed: false, touched: false, value: fallbackValue };
    }
    const value = Number(source.value || 0);
    return {
      pressed: Boolean(source.pressed || value > 0.5),
      touched: Boolean(source.touched || source.pressed || value > 0.05),
      value
    };
  }

  function virtualButton(active) {
    return {
      pressed: active,
      touched: active,
      value: active ? 1 : 0
    };
  }

  function decodeHat(value) {
    if (!Number.isFinite(value)) {
      return new Set();
    }

    let best = hatDirections[0];
    let bestDistance = Math.abs(value - best.value);
    for (const option of hatDirections) {
      const distance = Math.abs(value - option.value);
      if (distance < bestDistance) {
        best = option;
        bestDistance = distance;
      }
    }

    return new Set(best.buttons);
  }

  function normalizeButtons(pad) {
    const b = Array.from(pad.buttons || []);
    const hat = decodeHat(Array.from(pad.axes || [])[9]);

    // Standard Xbox order:
    // 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 LT, 7 RT,
    // 8 Back, 9 Start, 10 LS, 11 RS, 12 Up, 13 Down, 14 Left, 15 Right, 16 Guide.
    const standard = new Array(17).fill(null).map(() => button(null));

    // Switch-style labels are physically reversed against Xbox's letter names.
    // Most browsers still expose the physical south/east/west/north cluster at 0..3.
    standard[0] = button(b[0]); // south
    standard[1] = button(b[1]); // east
    standard[2] = button(b[2]); // west
    standard[3] = button(b[3]); // north
    standard[4] = button(b[4]);
    standard[5] = button(b[5]);
    standard[6] = button(b[6]);
    standard[7] = button(b[7]);
    standard[8] = button(b[8]);
    standard[9] = button(b[9]);
    standard[10] = button(b[10]);
    standard[11] = button(b[11]);
    standard[12] = b[12] ? button(b[12]) : virtualButton(hat.has("up"));
    standard[13] = b[13] ? button(b[13]) : virtualButton(hat.has("down"));
    standard[14] = b[14] ? button(b[14]) : virtualButton(hat.has("left"));
    standard[15] = b[15] ? button(b[15]) : virtualButton(hat.has("right"));
    standard[16] = button(b[16]);

    return standard;
  }

  function normalizePad(pad) {
    if (!pad) {
      return pad;
    }

    const id = String(pad.id || "");
    const shouldNormalize = targetPattern.test(id) || pad.mapping !== "standard";

    if (!shouldNormalize) {
      return pad;
    }

    const axes = Array.from(pad.axes || [0, 0, 0, 0]).slice(0, 4);
    while (axes.length < 4) {
      axes.push(0);
    }

    const normalized = {
      axes,
      buttons: normalizeButtons(pad),
      connected: pad.connected !== false,
      id: "Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)",
      index: pad.index,
      mapping: "standard",
      timestamp: pad.timestamp || performance.now(),
      vibrationActuator: pad.vibrationActuator || null,
      hapticActuators: pad.hapticActuators || []
    };

    return normalized;
  }

  function semanticButton(name) {
    const state = bridgeState.frame?.buttons?.[name];
    const value = Number(state?.value || 0);
    const pressed = Boolean(state?.pressed || value > 0.5);
    return { pressed, touched: pressed || value > 0.05, value: pressed ? Math.max(1, value || 1) : value };
  }

  function semanticAxis(name) {
    return Number(bridgeState.frame?.axes?.[name]?.value || 0);
  }

  function websocketVirtualPad() {
    if (!bridgeState.frame || performance.now() - bridgeState.lastSeen > 2000) {
      return null;
    }

    const buttons = new Array(17).fill(null).map(() => ({ pressed: false, touched: false, value: 0 }));
    buttons[0] = semanticButton("A");
    buttons[1] = semanticButton("B");
    buttons[2] = semanticButton("X");
    buttons[3] = semanticButton("Y");
    buttons[4] = semanticButton("LB");
    buttons[5] = semanticButton("RB");
    buttons[6] = semanticButton("LT");
    buttons[7] = semanticButton("RT");
    buttons[8] = semanticButton("Back");
    buttons[9] = semanticButton("Start");
    buttons[10] = semanticButton("L3");
    buttons[11] = semanticButton("R3");
    buttons[12] = semanticButton("DPad_Up");
    buttons[13] = semanticButton("DPad_Down");
    buttons[14] = semanticButton("DPad_Left");
    buttons[15] = semanticButton("DPad_Right");
    buttons[16] = semanticButton("Guide");

    return {
      axes: [
        semanticAxis("LX"),
        semanticAxis("LY"),
        semanticAxis("RX"),
        semanticAxis("RY")
      ],
      buttons,
      connected: true,
      id: "Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)",
      index: 0,
      mapping: "standard",
      timestamp: performance.now(),
      vibrationActuator: null,
      hapticActuators: []
    };
  }

  function announceVirtualPadIfNeeded() {
    const pad = websocketVirtualPad();
    if (!pad || bridgeState.announced) {
      return;
    }
    bridgeState.announced = true;
    window.dispatchEvent(new GamepadEvent("gamepadconnected", { gamepad: pad }));
  }

  function connectLiveMonitor() {
    clearTimeout(bridgeState.reconnectTimer);
    try {
      bridgeState.ws = new WebSocket("ws://127.0.0.1:8137/live");
    } catch (error) {
      bridgeState.reconnectTimer = setTimeout(connectLiveMonitor, 1000);
      return;
    }

    bridgeState.ws.addEventListener("open", () => {
      bridgeState.connected = true;
      bridgeState.ws.send(JSON.stringify({ type: "heartbeat", at: new Date().toISOString(), from: "xbox-gamepad-bridge" }));
      console.info("[Xbox Cloud Gamepad Bridge] live monitor connected");
    });

    bridgeState.ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "semantic-frame" && message.frame) {
          bridgeState.frame = message.frame;
          bridgeState.lastSeen = performance.now();
          announceVirtualPadIfNeeded();
        }
      } catch (error) {
        console.warn("[Xbox Cloud Gamepad Bridge] bad live message", error);
      }
    });

    bridgeState.ws.addEventListener("close", () => {
      bridgeState.connected = false;
      bridgeState.announced = false;
      bridgeState.reconnectTimer = setTimeout(connectLiveMonitor, 1000);
    });

    bridgeState.ws.addEventListener("error", () => {
      bridgeState.connected = false;
    });
  }

  if (originalGetGamepads) {
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value() {
        const nativePads = Array.from(originalGetGamepads()).map(normalizePad);
        const virtualPad = websocketVirtualPad();
        if (!virtualPad) {
          return nativePads;
        }
        nativePads[0] = virtualPad;
        return nativePads;
      }
    });
  }

  const normalizeEvent = (event) => {
    if (!event || !event.gamepad) {
      return;
    }

    const normalized = normalizePad(event.gamepad);
    if (normalized === event.gamepad) {
      return;
    }

    event.stopImmediatePropagation();
    window.dispatchEvent(new GamepadEvent(event.type, { gamepad: normalized }));
  };

  window.addEventListener("gamepadconnected", normalizeEvent, true);
  window.addEventListener("gamepaddisconnected", normalizeEvent, true);
  connectLiveMonitor();
  console.info("[Xbox Cloud Gamepad Bridge] active");
})();

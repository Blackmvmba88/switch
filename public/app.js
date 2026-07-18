(async () => {
  const elements = {
    sysStatus: document.getElementById("sys-status"),
    leftStickDot: document.getElementById("left-stick-dot"),
    rightStickDot: document.getElementById("right-stick-dot"),
    valLx: document.getElementById("val-lx"),
    valLy: document.getElementById("val-ly"),
    valRx: document.getElementById("val-rx"),
    valRy: document.getElementById("val-ry"),
    btnSaveSens: document.getElementById("btn-save-sens"),
    btnResetCal: document.getElementById("btn-reset-cal"),
    calOffsets: document.getElementById("cal-offsets"),
    valDevice: document.getElementById("val-device"),
    valMode: document.getElementById("val-mode"),
    valClients: document.getElementById("val-clients"),
    valFrames: document.getElementById("val-frames"),
    btnRunDoctor: document.getElementById("btn-run-doctor"),
    btnRunVerify: document.getElementById("btn-run-verify"),
    btnClearConsole: document.getElementById("btn-clear-console"),
    consoleOutput: document.getElementById("console-output")
  };

  const sliders = {
    LX: document.getElementById("sens-lx"),
    LY: document.getElementById("sens-ly"),
    RX: document.getElementById("sens-rx"),
    RY: document.getElementById("sens-ry")
  };

  const sliderLabels = {
    LX: document.getElementById("label-sens-lx"),
    LY: document.getElementById("label-sens-ly"),
    RX: document.getElementById("label-sens-rx"),
    RY: document.getElementById("label-sens-ry")
  };

  // Helper to bind slider badge updates
  Object.keys(sliders).forEach((key) => {
    sliders[key].addEventListener("input", (e) => {
      sliderLabels[key].textContent = `${Number(e.target.value).toFixed(1)}x`;
    });
  });

  let ws = null;
  let pollInterval = null;

  function updateStatus(connected) {
    const dot = elements.sysStatus.querySelector(".status-dot");
    const text = elements.sysStatus.querySelector(".status-text");
    if (connected) {
      dot.className = "status-dot online";
      text.textContent = "EN VIVO";
    } else {
      dot.className = "status-dot offline";
      text.textContent = "DESCONECTADO";
    }
  }

  function appendConsole(text) {
    elements.consoleOutput.textContent += `\n[${new Date().toLocaleTimeString()}] ${text}`;
    elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
  }

  // Load profile values (sensitivity)
  async function loadProfile() {
    try {
      const res = await fetch("/api/v1/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.profile) {
          const profile = data.profile;
          // Set sensitivity sliders
          if (profile.sensitivity) {
            Object.keys(sliders).forEach((key) => {
              if (profile.sensitivity[key] !== undefined) {
                sliders[key].value = profile.sensitivity[key];
                sliderLabels[key].textContent = `${Number(profile.sensitivity[key]).toFixed(1)}x`;
              }
            });
          }
          // Set calibration offsets text
          if (profile.calibration && profile.calibration.offsets) {
            const o = profile.calibration.offsets;
            elements.calOffsets.textContent = `LX:${o.LX || 0} LY:${o.LY || 0} RX:${o.RX || 0} RY:${o.RY || 0}`;
          }
          appendConsole("Perfil de control cargado exitosamente.");
        }
      }
    } catch (err) {
      appendConsole(`Error al cargar perfil: ${err.message}`);
    }
  }

  // Save Sensitivity settings
  elements.btnSaveSens.addEventListener("click", async () => {
    const payload = {
      LX: parseFloat(sliders.LX.value),
      LY: parseFloat(sliders.LY.value),
      RX: parseFloat(sliders.RX.value),
      RY: parseFloat(sliders.RY.value)
    };

    try {
      elements.btnSaveSens.disabled = true;
      const res = await fetch("/api/v1/profile/sensitivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        appendConsole("Configuración de sensibilidad guardada exitosamente.");
        await loadProfile();
      } else {
        appendConsole("Error al guardar sensibilidad.");
      }
    } catch (err) {
      appendConsole(`Error de red al guardar: ${err.message}`);
    } finally {
      elements.btnSaveSens.disabled = false;
    }
  });

  // Reset Calibration
  elements.btnResetCal.addEventListener("click", async () => {
    if (!confirm("¿Estás seguro de reiniciar los offsets de calibración a 0?")) return;
    try {
      const res = await fetch("/api/v1/calibration/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" })
      });
      if (res.ok) {
        appendConsole("Calibración reiniciada. Se auto-calibrará en reposo.");
        await loadProfile();
      } else {
        appendConsole("Error al reiniciar calibración.");
      }
    } catch (err) {
      appendConsole(`Error de red: ${err.message}`);
    }
  });

  // Run Doctor check
  elements.btnRunDoctor.addEventListener("click", async () => {
    appendConsole("Ejecutando diagnóstico 'doctor'...");
    try {
      const res = await fetch("/api/doctor");
      if (res.ok) {
        const data = await res.json();
        elements.consoleOutput.textContent = JSON.stringify(data, null, 2);
      } else {
        appendConsole("Error al obtener reporte del doctor.");
      }
    } catch (err) {
      appendConsole(`Error: ${err.message}`);
    }
  });

  // Run Verify check
  elements.btnRunVerify.addEventListener("click", async () => {
    appendConsole("Ejecutando verificación 'verify'...");
    try {
      const res = await fetch("/api/verify");
      if (res.ok) {
        const data = await res.json();
        elements.consoleOutput.textContent = JSON.stringify(data, null, 2);
      } else {
        appendConsole("Error al obtener reporte de verificación.");
      }
    } catch (err) {
      appendConsole(`Error: ${err.message}`);
    }
  });

  elements.btnClearConsole.addEventListener("click", () => {
    elements.consoleOutput.textContent = "Consola limpia.";
  });

  // Poll Runtime Status
  async function pollRuntime() {
    try {
      const res = await fetch("/api/v1/runtime");
      if (res.ok) {
        const data = await res.json();
        elements.valDevice.textContent = data.gameMode?.lastEvent?.detail?.label || "-";
        elements.valMode.textContent = data.runtime?.state || "standby";
        elements.valClients.textContent = data.metrics?.restarts || "0";
      }
    } catch (_) {}
  }

  // WebSocket Live Updates (Port 8137/live)
  function connectWS() {
    if (ws) {
      try { ws.close(); } catch(_) {}
    }

    ws = new WebSocket("ws://127.0.0.1:8137/live");

    ws.addEventListener("open", () => {
      updateStatus(true);
      appendConsole("Conexión de datos en vivo establecida (WebSocket).");
      // WS is live — slow down HTTP polling to reduce server load
      setPollingRate(false);
    });

    ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "semantic-frame" && message.frame) {
          const frame = message.frame;
          const axes = frame.axes || {};
          const buttons = frame.buttons || {};

          // Update axis numerical indicators
          const lx = axes.LX?.value ?? 0;
          const ly = axes.LY?.value ?? 0;
          const rx = axes.RX?.value ?? 0;
          const ry = axes.RY?.value ?? 0;

          elements.valLx.textContent = Number(lx).toFixed(3);
          elements.valLy.textContent = Number(ly).toFixed(3);
          elements.valRx.textContent = Number(rx).toFixed(3);
          elements.valRy.textContent = Number(ry).toFixed(3);

          // Update visual stick dots: stick area is 160x160.
          // Centered at 0, 0. Coordinates range from -1 to 1.
          // Move from center (translate) by up to 70px (160/2 - dot_width/2)
          const range = 68;
          elements.leftStickDot.style.transform = `translate(calc(-50% + ${lx * range}px), calc(-50% + ${ly * range}px))`;
          elements.rightStickDot.style.transform = `translate(calc(-50% + ${rx * range}px), calc(-50% + ${ry * range}px))`;

          // Update active buttons highlights
          document.querySelectorAll(".btn-node").forEach((btnNode) => {
            const btnName = btnNode.getAttribute("data-btn");
            if (buttons[btnName]?.pressed) {
              btnNode.classList.add("active");
            } else {
              btnNode.classList.remove("active");
            }
          });

          // Metrics update
          if (message.calibration?.snapshot) {
            const warnings = message.calibration.warnings || [];
            if (warnings.length) {
              elements.calOffsets.style.color = "#ef4444";
              elements.calOffsets.textContent = `Alerta: ${warnings.join(", ")}`;
            } else {
              elements.calOffsets.style.color = "";
              const o = message.calibration.snapshot;
              elements.calOffsets.textContent = `LX:${o.LX?.offset || 0} LY:${o.LY?.offset || 0} RX:${o.RX?.offset || 0} RY:${o.RY?.offset || 0}`;
            }
          }
        }
      } catch (err) {
        console.warn("WebSocket parse error:", err);
      }
    });

    ws.addEventListener("close", () => {
      updateStatus(false);
      // Speed up polling while WS is down so UI stays fresh
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(pollRuntime, 2000);
      setTimeout(connectWS, 1000); // Autoreconnect
    });
  }

  function setPollingRate(fast) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(pollRuntime, fast ? 2000 : 5000);
  }

  // Init
  await loadProfile();
  connectWS();
  pollRuntime();
  // Start with slow polling; connectWS will speed up if WS drops
  setPollingRate(false);
})();

# Guitarra bridge

Use the standard Xbox/Gamepad API semantic profile when `Blackmvmba88/guitarra` consumes the live runtime.

```bash
PROFILE=profiles/xbox-standard-gamepad.normalized.json ./start-live-monitor.sh
```

Then open `gamepad-test/index.html`, connect the Xbox controller, and click **Connect live monitor**.

Expected semantic axes:

```text
LX = A0
LY = A1
RX = A2
RY = A3
```

`guitarra` consumes only semantic `RX/RY`; raw indices remain owned by this repository.

If the browser reports the Xbox controller with a non-standard mapping, stop and calibrate/import a device-specific profile instead of changing `guitarra`.

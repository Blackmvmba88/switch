# Robustness & Intelligence

The BlackMamba Cybernetic Runtime (BCR) includes several self-healing mechanisms to ensure a stable gaming experience.

## 1. Deep Bridge Verification
The `xcloud-bridge-agent.js` doesn't just check if a tab is open. It performs a "Deep Health Check" by querying the injected bridge's internal state:
- **Presence:** Is the bridge actually injected in the page?
- **Liveness:** Is the bridge receiving semantic frames from the monitor?
- **Staleness:** How long has it been since the last frame?

If the bridge is missing or stalled, the agent proactively re-injects it without user intervention.

## 2. Health Watchdog
A dedicated background service (`health-watchdog.js`) monitors the core BCR daemons:
- `live-monitor.js` (Semantic Bus)
- `hid-live-source` (Native Input)
- `xcloud-bridge-agent.js` (Injection Hub)

If any of these components crash or are manually stopped, the Watchdog automatically restarts them via `launchctl`.

## 3. HID Resilience
The native Swift HID source handles the device lifecycle intelligently:
- **Hot-plugging:** Automatically detects when the controller is plugged or unplugged.
- **WebSocket Recovery:** If the connection to the Semantic Bus is lost, the HID source attempts to reconnect exponentially.
- **Protocol Heartbeats:** Periodically sends heartbeats to ensure the monitor knows the source is still alive even when no buttons are being pressed.

## 4. Auto-Shutdown
BCR learns from your gaming sessions. If you finish a game and switch to another application for an extended period, the runtime will automatically shut itself down to save system resources and power.

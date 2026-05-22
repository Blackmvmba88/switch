# Runtime Layer

The Runtime Layer is responsible for the orchestration and execution of the BCR pipeline.

## Core Components

### `live-monitor.js`
The central hub for real-time input. It maintains a WebSocket server that receives samples from the HID source, translates them using the active profile, and broadcasts the semantic frames to connected clients (like the CDP Bridge).

### `xcloud-bridge-agent.js`
A background daemon that monitors the browser state and ensures the CDP Bridge is correctly injected and healthy during an xCloud session.

### `network-game-mode.js`
Optimizes the macOS network stack for cloud gaming by adjusting DNS settings, disabling intrusive background services, and enabling `caffeinate` to prevent system sleep.

## Operational Lifecycle

1. **Wake:** The runtime initializes the HID source and network optimizations.
2. **Inject:** The CDP Bridge is delivered to Chrome via the bridge agent.
3. **Monitor:** Real-time telemetry is streamed to the Control Room.
4. **Close:** The runtime safely releases resources and restores system network settings.

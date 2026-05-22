# Command Reference (`bmctl`)

The `bmctl` script is the primary operator for the BlackMamba Cybernetic Runtime.

## Usage

```bash
./bmctl [command]
```

## Normal Operation

- `app`, `ui`, `control-room`: Opens the Control Room management UI.
- `game-on`, `gaming-on`: Activates high-performance gaming mode (network optimizations + xCloud bridge).
- `game-off`, `gaming-off`: Deactivates gaming mode (non-intrusive daemon).
- `wake`, `play`: Launches xCloud and injects the controller bridge.
- `verify`, `verifica`: Confirms xCloud sees the virtual Xbox controller.
- `close`, `cerrar`: Safely stops the gaming runtime but keeps the Control Room alive.
- `shutdown`, `quit`: Stops everything, including the Control Room.

## Diagnostics & Telemetry

- `status`: Shows the live status of all BCR components (HID, Monitor, Bridge, Network).
- `net-status`: Displays latency, jitter, and packet loss metrics.
- `buttons`, `botones`: Live stream of controller inputs (sticks, triggers, buttons).
- `ram`, `memory`: System and process memory pressure report.
- `logs`: Tails the most relevant runtime logs.
- `sessions`: Shows play-session history and learned durations.

## Configuration & Setup

- `setup`: Initial runtime configuration and LaunchAgent installation.
- `fortnite-map`: Applies physical Xbox layout (maps by position, ignoring Switch labels).
- `switch-map`: Restores layout based on physical Switch labels (A/B and X/Y swapped relative to Xbox).
- `recycle`: Restarts all background daemons.

## Development & Repo Hygiene

- `test`: Runs the full offline/live smoke test suite.
- `repo-doctor`: Explains the state of source code vs. runtime artifacts.
- `repo-clean`: Cleans temporary caches and logs.
- `preflight`: Validates local dependencies before installation or release.
- `package-beta`: Creates a clean beta release package from committed git content.

## Visual Lab

- `lab`: Opens the local gamepad API testing lab.
- `map`: Opens the visual input mapper (experimental).
- `view`: Opens the high-fidelity telemetry visualizer.

# BlackMamba Cybernetic Runtime (BCR) 🐍🔥

Turn any supported HID controller into a semantic Xbox-compatible input system for cloud gaming on macOS.

> It is not just a mapper. It is a cybernetic interoperability platform.

BCR translates physical controller intent into a stable, observable, game-ready input layer. It was built first for Nintendo Switch-style controllers on macOS and Xbox Cloud Gaming, with a focus on fast setup, durable profiles, telemetry, and safe runtime control.

## Status

| Area | Status |
| --- | --- |
| macOS Apple Silicon | Beta |
| Chrome / Chromium xCloud bridge | Beta |
| Rock Candy / Switch-style HID mapping | Working |
| Control Room local UI | Working |
| Fortnite physical Xbox layout | Working |
| Native macOS virtual HID driver | Planned |
| Steam / native app emulation | Planned |

## What It Does

- Converts Switch-style physical layouts into Xbox-compatible semantic output.
- Runs Xbox Cloud Gaming with a controlled Chrome CDP bridge.
- Provides a local Control Room for runtime status, verification, logs, profiles, and safe shutdown.
- Tracks live input, network state, latency, jitter, packet loss, and session behavior.
- Preserves durable controller profiles for repeatable game layouts.

## Conceptual Pipeline

```text
┌──────────────────────┐
│ USB / HID Controller │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ macOS IOHID Source   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ BCR Semantic Bus     │
│ profiles + mappings  │
└──────────┬───────────┘
           │
           ├──► Telemetry / Observability
           │
           ▼
┌──────────────────────┐
│ CDP Gamepad Bridge   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ xCloud / Game Target │
└──────────────────────┘
```

## Quick Start

### 1. Install

```bash
npm install
./install.sh
```

### 2. Open Control Room

```bash
./bmctl app
```

Control Room runs locally at:

```text
http://127.0.0.1:8147
```

### 3. Start xCloud Game Mode

```bash
./bmctl game-on
```

Game mode starts the runtime, keeps the Mac awake with `caffeinate`, flushes local DNS once, and starts the network game monitor. It tracks gateway, internet, and xCloud latency, jitter, and packet loss. It does not make destructive network changes.

### 4. Prefer Wired Mode When Available

```bash
./bmctl net-wired
```

Wired mode turns Wi-Fi off for the session, refreshes local DNS, restarts the network monitor, and confirms the default route is using Ethernet.

### 5. Verify the Virtual Xbox Pad

```bash
./bmctl verify
```

### 6. Close the Runtime

```bash
./bmctl close
```

Close everything, including Control Room:

```bash
./bmctl shutdown
```

Uninstall:

```bash
./uninstall.sh
```

## Fortnite Layout

For Fortnite, use Xbox physical button positions:

```bash
./bmctl fortnite-map
./bmctl game-on
```

This intentionally ignores the letters printed on the Switch/Rock Candy shell and maps by where the button sits:

| Physical button | Printed on Switch pad | Xbox meaning |
| --- | --- | --- |
| Bottom | B | A |
| Right | A | B |
| Left | Y | X |
| Top | X | Y |

The D-pad is also part of this profile. The Rock Candy reports it as one quantized hat axis, not four normal buttons:

| D-pad direction | Raw source | Xbox button |
| --- | --- | --- |
| Up | `A9=-1` | `buttons[12]` |
| Down | `A9=0.143` | `buttons[13]` |
| Left | `A9=0.714` | `buttons[14]` |
| Right | `A9=-0.429` | `buttons[15]` |

If xCloud is already open:

```bash
./bmctl reinject
```

## Control Room

```bash
./bmctl app
```

Control Room centralizes:

- Wake xCloud
- Verify virtual Xbox pad
- Live buttons and axes
- Fortnite/Switch layout switching
- Independent per-input mapper
- Doctor, status, RAM, recycle, logs
- Safe close button for game/runtime processes

The app is served by LaunchAgent:

```text
com.blackmamba.control-room
```

## Why This Exists

### Cloud Gaming

Use a non-Xbox controller with Xbox Cloud Gaming while preserving Xbox physical layout expectations.

### Broken or Weird Controllers

Remap damaged, mislabeled, or non-standard inputs into stable semantic actions.

### Input Research

Capture HID behavior, normalize profiles, replay traces, and compare controller behavior over time.

### Accessibility Experiments

Build custom mappings where physical input does not have to match game assumptions.

## What Is What

```text
bmctl
  main operator command

app/
  local Control Room UI

runtime/
  HID source, live monitor, translator, CDP injector, diagnostics

xbox-gamepad-bridge/
  browser-side Gamepad API bridge used inside xCloud

profiles/
  durable semantic mappings, including Rock Candy Switch -> Xbox layout

fixtures/
  test samples used by replay and validation

fixtures/rock-candy-profile-test.normalized.json
  stable CI/test profile; does not change when the user remaps the live profile

device-signatures/
  observed USB/HID device fingerprints

logs/, .tmp-runtime-test/, chrome-xbox-control-profile/
  local generated runtime state, ignored by git

/tmp/blackmamba-xcloud-cdp-profile
  active Chrome CDP profile used while playing

~/Library/Application Support/BlackMambaInput
  installed runtime copy, LaunchAgent logs, active profile, status reports
```

## Repo Hygiene

Report what is source code vs generated runtime state:

```bash
./bmctl repo-doctor
```

Close the runtime and clean safe repo-local caches:

```bash
./bmctl repo-clean
```

`repo-clean` removes only local runtime artifacts such as repo logs, temporary build cache, and scratch Chrome profile. It does not delete source code, profiles, fixtures, or the active xCloud CDP profile.

## Beta Release Flow

Preflight:

```bash
npm run game-on
```

Control Room:

```bash
bmctl app
```

Diagnostics:

```bash
npm run status
npm run preflight
```

Tests:

```bash
npm test
```

## Laboratory & Tools

BCR includes a suite of laboratory tools for input research:

- **Live Monitor:** Real-time WebSocket event stream.
- **Replay Trace:** Offline validation of input sequences.
- **Semantic Diff:** Analytical comparison of controller profiles.
- **Visualizer:** Work-in-progress interactive telemetry dashboard.

## Visual Proof Checklist

Add these files under `docs/media/` as the project matures:

- `control-room.gif` — local UI booting and showing live state.
- `verify-pad.gif` — virtual Xbox pad verification.
- `fortnite-map.gif` — physical Switch layout mapped into Xbox meaning.
- `live-monitor.gif` — buttons, axes, and telemetry moving in real time.

Then embed them near the top of this README.

## Documentation Index

- [Vision & Philosophy](VISION.md)
- [Roadmap](ROADMAP.md)
- [Command Reference](docs/commands.md)
- [Architecture Overview](docs/architecture/README.md)
- [Semantic Bus & Mappings](docs/semantic-bus/README.md)
- [Telemetry & Observability](docs/telemetry/README.md)

## License

MIT - See [LICENSE](LICENSE)

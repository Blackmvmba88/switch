# BlackMamba Cybernetic Runtime (BCR) 🐍🔥

The BlackMamba Cybernetic Runtime is a high-performance, semantic-first input translation layer designed to bridge the gap between human hardware and machine intent on macOS.

> "It's not a mapper. It's a cybernetic interoperability platform."

## Conceptual Pipeline

```text
USB / HID device
-> macOS IOHID + browser Gamepad API
-> Semantic Translation Layer (BCR Bus)
-> Telemetry & Observability
-> High-Fidelity Injection (CDP Bridge)
-> xCloud / Target Application
```

## Architecture

BCR is built on several key pillars:
- **[Vision](VISION.md):** Our philosophy of human-machine interaction.
- **[Roadmap](ROADMAP.md):** The phased evolution from HID bridge to adaptive systems.
- **[Documentation](docs/architecture/):** Detailed architectural breakdowns.

## Quick Start

### Installation

```bash
npm install
./install.sh
```

Open the local app:

```bash
./bmctl app
```

Play in Atlas, recommended:

```bash
./bmctl atlas
./bmctl play-atlas
./bmctl atlas-jugar
./bmctl go
./bmctl entrar
```

Run xCloud in game mode:

```bash
./bmctl game-on
```

Game mode also starts the network game monitor. It keeps the Mac awake with
`caffeinate`, flushes the local DNS cache once, and tracks gateway/internet/xCloud
latency, jitter, and packet loss. It does not make destructive network changes.

When playing over Ethernet, prefer wired mode:

```bash
./bmctl net-wired
```

That turns Wi-Fi off for the session, refreshes local DNS, restarts the network
monitor, and confirms the default route is using the Ethernet interface.

Verify the virtual Xbox pad:

```bash
./bmctl verify
```

Close the game runtime when done:

```bash
./bmctl close
```

When game mode is installed, the xCloud agent also learns session length. It is
conservative: it only auto-closes after a real play session, after the xCloud
window/tab disappears, and after another app is frontmost for a grace period.
The default minimum session before auto-shutdown is 30 minutes.

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

This intentionally ignores the letters printed on the Switch/Rock Candy shell
and maps by where the button sits:

| Physical button | Printed on Switch pad | Xbox meaning |
| --- | --- | --- |
| Bottom | B | A |
| Right | A | B |
| Left | Y | X |
| Top | X | Y |

The D-pad is also part of this profile. The Rock Candy reports it as one
quantized hat axis, not four normal buttons:

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

Control Room runs at `http://127.0.0.1:8147` and centralizes:

- Wake xCloud
- Verify virtual Xbox pad
- Live buttons and axes
- Fortnite/Switch layout switching
- Independent per-input mapper
- Doctor, status, RAM, recycle, logs
- Safe close button for game/runtime processes

### Play in Atlas

Use the Atlas play command and the Control Room Atlas panel:

```bash
./bmctl atlas-jugar
./bmctl atlas-status
```

What these do:

- `./bmctl atlas-jugar` opens Atlas and jumps into play
- `./bmctl atlas` is the shortest direct Atlas command
- `./bmctl atlas-open` is a clear alias for opening Atlas
- `./bmctl atlas-run` is a clear alias for starting Atlas and jumping in
- `./bmctl atlas-game` is a clear alias for opening Atlas and playing
- `./bmctl go`, `./bmctl entrar`, and `./bmctl play-atlas` are shorter aliases for the same Atlas flow
- `./bmctl play` now tries Atlas first and only falls back to xCloud if Atlas is missing
- `./bmctl atlas-status` reports whether Atlas is installed and the target URL

The Control Room also exposes the same state over API:

- `GET /api/atlas-status`

Current limitation:

- Atlas is the direct play path
- Atlas opens without forcing Chromium-style CDP

### Manual Atlas Play Checklist

Because Atlas does not currently expose the same CDP bridge flow, play it as a
manual session:

1. Run `./bmctl atlas-jugar`.
2. Wait for Atlas to load `https://www.xbox.com/play`.
3. Use the Control Room to keep runtime state visible while you interact manually.
4. Use `./bmctl atlas-status` or `GET /api/atlas-status` to confirm Atlas stayed open.
5. If you need the broader runtime stack, keep `./bmctl game-on` available as the
  Chromium/CDP path, but do not treat it as Atlas support.

The app is served by LaunchAgent:

```text
com.blackmamba.control-room
```

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

`repo-clean` removes only local runtime artifacts such as repo logs, temporary
build cache, and scratch Chrome profile. It does not delete source code,
profiles, fixtures, or the active xCloud CDP profile.

## Beta Release

Preflight:

```bash
npm run game-on
```

### Control Room (UI)

```bash
bmctl app
```

### Diagnostics

```bash
npm run status
npm run preflight
```

## Laboratory & Tools

BCR includes a suite of laboratory tools for input research:
- **Live Monitor:** Real-time WebSocket event stream.
- **Replay Trace:** Offline validation of input sequences.
- **Semantic Diff:** Analytical comparison of controller profiles.
- **Visualizer:** (Work in Progress) Interactive telemetry dashboard.

## Development

### Testing

```bash
npm test
```

### Project Structure

- `runtime/`: Core translators, live monitor, CDP injector.
- `xbox-gamepad-bridge/`: Browser Gamepad API bridge.
- `profiles/`: Durable semantic controller profiles.
- `app/`: Local Control Room UI.
- `docs/`: Architectural and conceptual documentation.

## License

MIT - See [LICENSE](LICENSE)

## Documentation Index

- [Vision & Philosophy](VISION.md)
- [Command Reference](docs/commands.md)
- [Architecture Overview](docs/architecture/README.md)
- [Semantic Bus & Mappings](docs/semantic-bus/README.md)
- [Telemetry & Observability](docs/telemetry/README.md)
- [Roadmap](ROADMAP.md)

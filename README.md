# BlackMamba Input Runtime

Local macOS controller runtime for using a wired Rock Candy / Nintendo Switch
controller as a browser-visible Xbox-style gamepad for Xbox Cloud Gaming.

The important idea is simple: **macOS already does a surprisingly good job at
seeing this controller**. The runtime does not pretend the Mac is broken. It
organizes the layers around the Mac:

```text
USB / HID device
-> macOS IOHID + browser Gamepad API
-> semantic controller profile
-> local WebSocket runtime
-> Chrome DevTools injected Xbox gamepad bridge
-> xCloud
```

This repo is a lab and runtime for making that path visible, testable, and
recoverable.

## Current State

Working pieces:

- macOS detects the Rock Candy controller through HID.
- Browser polling sees live frames from the controller.
- The profile layer maps physical inputs into semantic Xbox-style controls.
- The D-pad is decoded as a hat axis on `A9`.
- The CDP bridge exposes an Xbox-like `navigator.getGamepads()` entry:
  `Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)`.
- Control Room provides a local UI for launch, verify, remap, logs, RAM, and
  shutdown.

Known boundary:

- This is a browser bridge, not a signed system-wide XInput driver.
- If Chrome CDP or xCloud changes state, use `./bmctl reinject`.

## Quick Start

Beta install:

```bash
./install.sh
```

Open the local app:

```bash
./bmctl app
```

Run xCloud in game mode:

```bash
./bmctl game-on
```

Game mode also starts the network game monitor. It keeps the Mac awake with
`caffeinate`, flushes the local DNS cache once, and tracks gateway/internet/xCloud
latency, jitter, and packet loss. It does not make destructive network changes.

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
./bmctl preflight
```

Create a clean beta package:

```bash
./bmctl package-beta
```

The package is written under `dist/` and is created from committed git content,
so local logs, caches, runtime state, and uncommitted live profile edits do not
leak into the beta artifact.

## Metacommands

```bash
./bmctl game-on      # open xCloud and inject the Xbox bridge
./bmctl play         # direct open/inject path
./bmctl reinject     # reapply bridge to current xCloud page
./bmctl verify       # prove xCloud sees the virtual Xbox pad
./bmctl buttons      # live controls: sticks, triggers, Back, Start, L3, R3
./bmctl status       # runtime status, HID, monitor, CDP tabs
./bmctl net-status   # gaming network latency, jitter, packet loss
./bmctl sessions     # learned play-session history and average duration
./bmctl app          # open Control Room
./bmctl close        # close game runtime, keep Control Room
./bmctl shutdown     # close runtime and Control Room
./bmctl test         # offline replay + live WebSocket smoke
./bmctl repo-doctor  # explain repo/runtime state
./bmctl repo-clean   # clean safe generated repo-local artifacts
./bmctl preflight    # validate local dependencies
./bmctl package-beta # create clean tar.gz beta package
```

## Validation

Full validation:

```bash
./bmctl test
```

Expected final line:

```text
OK runtime robust
```

Runtime proof in xCloud:

```bash
./bmctl verify
```

Expected signal:

```json
{
  "installed": true,
  "debug": {
    "connected": true,
    "hasFrame": true
  },
  "pads": [
    {
      "id": "Xbox 360 Controller (XInput STANDARD GAMEPAD Vendor: 045e Product: 028e)",
      "mapping": "standard"
    }
  ]
}
```

## Architecture

```text
runtime/hid-live-source.swift
  reads Rock Candy through IOHIDManager

runtime/live-monitor.js
  receives browser/native frames, applies profile, emits semantic frames

profiles/*.normalized.json
  maps raw sources like B1 or A9 into semantic controls like A or DPad_Up

xbox-gamepad-bridge/bridge.js
  runs in xCloud page and exposes a standard Xbox-like gamepad

runtime/inject-bridge-cdp.js
  uses Chrome DevTools Protocol to inject and verify the bridge

app/server.js + app/public/
  local Control Room for operation and mapping
```

## Notes

- The path that worked best here is not Steam Input.
- The reliable local path is HID/native source + live monitor + CDP bridge.
- Do not delete `/tmp/blackmamba-xcloud-cdp-profile` during a game session.
- Use `./bmctl close` before heavy work if you want RAM and browser state clean.
- Auto-shutdown waits for evidence that you left the game; it does not close
  just because a timer expired.

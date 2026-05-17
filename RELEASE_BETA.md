# BlackMamba Input Runtime v0.1.0-beta

This beta is a Mac-first controller bridge for Xbox Cloud Gaming.

## What This Beta Does

- Uses macOS HID/Gamepad visibility instead of fighting it.
- Translates a Rock Candy / Nintendo Switch wired controller into a semantic profile.
- Injects a browser-side Xbox-style gamepad into xCloud through Chrome DevTools.
- Provides Control Room at `http://127.0.0.1:8147`.
- Tracks play sessions and closes runtime conservatively after the user leaves xCloud.
- Adds network game mode for cloud gaming visibility: latency, jitter, loss, and caffeinate.

## Install

```bash
./install.sh
```

## Use

```bash
./bmctl app
./bmctl game-on
./bmctl verify
```

## Stop

```bash
./bmctl close
```

## Uninstall

```bash
./uninstall.sh
```

## Beta Boundaries

- This is not a signed system-wide XInput driver.
- It requires Google Chrome and local DevTools/CDP.
- LaunchAgents can fail on some macOS states; `game-on` has a direct fallback.
- xCloud page changes may need `./bmctl reinject`.

## Release Checklist

- `./doctor-preflight.sh`
- `./bmctl test`
- `./bmctl repo-doctor`
- `./bmctl game-on`
- `./bmctl verify`
- `./bmctl close`
- `./bmctl package-beta`

## Package

```bash
./bmctl package-beta
```

Output:

```text
dist/blackmamba-input-runtime-0.1.0-beta.tar.gz
```

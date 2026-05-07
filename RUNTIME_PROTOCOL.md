# Runtime Frame Protocol v0

`blackmamba.runtime.frame.v0` is the first portable input ABI for this lab.

It translates raw Gamepad API samples through a normalized profile into semantic state:

```json
{
  "protocol": "blackmamba.runtime.frame.v0",
  "timestampMs": 150,
  "buttons": {
    "A": {
      "pressed": true,
      "value": 1,
      "source": "B0"
    }
  },
  "axes": {
    "LX": {
      "value": -0.7,
      "raw": -0.98,
      "source": "A0"
    }
  },
  "transitions": {
    "A": {
      "justPressed": true,
      "justReleased": false,
      "heldMs": 0
    }
  }
}
```

## Trace Protocol

`blackmamba.runtime.trace.v0` wraps multiple frames:

```json
{
  "protocol": "blackmamba.runtime.trace.v0",
  "profile": {},
  "source": {},
  "frames": []
}
```

## Commands

Validate a normalized profile before using it:

```bash
node runtime/validate-profile.js profiles/device.normalized.json
```

Generate a normalized profile from a downloaded browser capture:

```bash
./import-controller-sample.sh /path/to/controller-sample.json
```

Translate the latest imported sample/profile into runtime frames:

```bash
./translate-latest-sample.sh
```

Or explicitly:

```bash
node runtime/translate-sample.js \
  --profile profiles/device.normalized.json \
  --sample samples/controller-sample.json \
  --out outputs/runtime-frames.json
```

Summarize or inspect a translated trace:

```bash
node runtime/summarize-trace.js outputs/runtime-frames.json
node adapters/debug/print-trace.js outputs/runtime-frames.json
node runtime/replay-trace.js --trace outputs/runtime-frames.json --expect A
node runtime/semantic-diff.js profiles/a.normalized.json profiles/b.normalized.json
```

Run the offline runtime safety check:

```bash
./test-runtime.sh
```

Run the full local health check:

```bash
./runtime-health.sh
```

## Live Diagnostics

Start the WebSocket monitor:

```bash
./start-live-monitor.sh
```

Then open `gamepad-test/index.html`, click `Connect live monitor`, and press `A`.
The runtime writes:

```text
logs/live-events.jsonl
reports/live-status.json
```

Minimal physical test:

```bash
./press-a-live-test.sh
```

Raw macOS HID monitor:

```bash
./hid-raw-monitor.sh
```

Persistent macOS watcher:

```bash
./install-controller-watch-agent.sh
```

## Design Rule

Adapters should consume semantic frame state, not raw `B0` / `A9` indices.

Observation/calibration stays silent by default. Gameplay output belongs in an explicit adapter path so a controller cannot start typing or emitting input unless the operator chooses that mode.

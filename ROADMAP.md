# Roadmap: The Evolution of BlackMamba

## Phase 1: HID Foundation (Baseline)
- [x] macOS HID detection (Rock Candy/Switch).
- [x] Raw frame capture and translation.
- [x] Browser Gamepad API bridge for xCloud.
- [x] `bmctl test` offline validation.

## Phase 2: Semantic Layer (Current)
- [x] Independent input capture and mapping.
- [x] Durable semantic profiles (`*.normalized.json`).
- [x] Fortnite physical layout vs Switch labels.
- [ ] Guided calibration UI in Control Room.

## Phase 3: Telemetry & Observability
- [x] Live events stream (`live-events.jsonl`).
- [x] Performance metrics (latency, jitter, loss).
- [ ] Visual telemetry dashboard in Control Room.
- [ ] Real-time "Semantic Drift" detection.

## Phase 4: Virtual HID Injection
- [ ] Native macOS Virtual HID driver (DriverKit).
- [ ] System-wide controller emulation (XInput/DualShock).
- [ ] Support for non-browser gaming (Steam, native apps).

## Phase 5: Adaptive Cybernetic Control
- [ ] AI-assisted input prediction and smoothing.
- [ ] Context-aware mapping (automatic layout switching based on game state).
- [ ] Universal human-machine interface experiments.

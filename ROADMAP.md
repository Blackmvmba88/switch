# Roadmap: The Evolution of BlackMamba

## Phase 1: HID Foundation (Baseline)
- [x] macOS HID detection (Rock Candy/Switch).
- [x] Raw frame capture and translation.
- [x] Browser Gamepad API bridge for xCloud.
- [x] `bmctl test` offline validation.

## Phase 2: Semantic Layer
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

## Phase 5: Adaptive Cybernetic Control (Started)
- [x] Define the initial Flight Assist / Heli Lab architecture and operator modes.
- [x] Add a conservative adaptive-control foundation with manual pilot override.
- [ ] AI-assisted input prediction and smoothing.
- [ ] Context-aware mapping (automatic layout switching based on game state).
- [x] Context task engine: takeoff, climb, cruise, approach, landing, hover, transition and recovery.
- [x] Keyboard-as-cockpit semantic profiles for aircraft and helicopter controls.
- [ ] Integrate MSFS telemetry from `flight-simu` / SimConnect as feedback into BCR.
- [ ] Cruise Assist for long-distance fixed-wing flight: heading, pitch/bank damping and workload reduction.
- [ ] Helicopter SAS: damp pitch/roll/yaw rates while preserving immediate pilot authority.
- [ ] BlackMamba Heli Lab: control trainer focused on maneuverability rather than travel.
  - [ ] Keep the helicopter visually fixed while applying the inverse simulated pose to the world.
  - [ ] 1-DOF trainers for cyclic pitch, cyclic roll, pedals/yaw and collective.
  - [ ] Progressive 2-DOF, 3-DOF and full hover exercises.
  - [ ] Freeze/inspect mode: input + state-before + state-after + result.
  - [ ] Stability, precision, workload and drift scoring.
  - [ ] Reference scene: horizon, grid, posts, targets and drift vectors.
- [ ] Universal human-machine interface experiments.

### Phase 5 operating principle

Adaptive assistance must remain transparent and reversible. The pilot's deliberate input always has priority; assistance starts as observation, smoothing and task guidance before any closed-loop stabilization is enabled.

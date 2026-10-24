# BlackMamba Heli Takeover — experimental gate

## State
A bounded, deterministic controller prototype exists at `runtime/heli-takeover.js`.
It is **NOT wired to Flight Simulator, xCloud, WARPBLACK or the virtual Xbox injector**.
Outputs are uncalibrated suggestions, not flight-safe commands.

## Command contract
1. Pilot presses a dedicated assistance button; the input adapter calls `toggle(telemetry, nowMs)`.
2. Every input/telemetry frame invokes `tick(telemetry, pilotFrame, nowMs)`.
3. If `active=true`, outputs are normalized `cyclicPitch`, `cyclicRoll`, `pedals`, `collectiveDelta` in [-0.35,0.35].
4. The injector MUST remain disabled until sign/direction, ranges, axes, and update rate are verified with a simulator-specific test adapter.
5. Any pilot movement over 0.12, another assist-button press, stale telemetry, or low-altitude/ground state disengages.
6. On disengagement the adapter must stop emitting assist commands and let the physical controller through unmodified.

## Critical unresolved interface
- **Game path**: native Microsoft Flight Simulator on Windows can use a dedicated telemetry adapter; Xbox Cloud in a browser does not automatically expose aircraft SimVars.
- **Telemetry**: eight named numeric fields, timestamp from the same clock domain, plus airborne/onGround flags.
- **Input arbitration**: confirm Xbox button choice and implement edge-triggered switching so a held button cannot repeatedly toggle.
- **Axis calibration**: signs and collective base/trim are deliberately unspecified.
- **Control performance**: replay traces and simulated disturbances before enabling any injection.

## Offline smoke test
```bash
node runtime/heli-takeover-smoke.js
npm run test:phase5
```

This is a simulation-only prototype, not evidence of real-game integration.

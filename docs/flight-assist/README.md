# BlackMamba Flight Assist / Heli Lab

Phase 5 adds adaptive control experiments on top of the BCR semantic input pipeline.

## Goals

1. Treat keyboard/controller inputs as pilot intent, not raw buttons.
2. Build context-aware task lists for phases such as takeoff, climb, cruise, approach, hover and recovery.
3. Reduce workload without hiding cause-and-effect from the pilot.
4. Preserve immediate manual override at all times.
5. Create a helicopter control laboratory focused on maneuverability and stability rather than travel.

## Operator modes

- `MANUAL`: transparent pass-through.
- `CRUISE_ASSIST`: conservative smoothing and future fixed-wing stabilization for long flights.
- `HELI_SAS`: future helicopter stability augmentation for pitch/roll/yaw damping.
- `HELI_LAB`: isolated control training and scoring.

## Heli Lab visual model

The helicopter remains visually centered. The simulation still integrates a virtual aircraft pose, but the scene root receives the inverse pose so the world moves around the aircraft.

```text
pilot input
   -> simulated helicopter state
   -> inverse pose
   -> world root transform

visual helicopter pose = fixed
```

This keeps attention on the relationship between cyclic, pedals, collective and resulting motion.

## Training progression

- 1 DOF: cyclic pitch
- 1 DOF: cyclic roll
- 1 DOF: pedals / yaw
- 1 DOF: collective / vertical response
- 2 DOF coupled exercises
- 3 DOF exercises
- full hover
- transition / recovery drills

## Freeze / Inspect

A training session should be pausable at any instant and capture:

- pilot input;
- simulated state before the input;
- simulated state after the input;
- angular and translational rates;
- detected coupling / over-correction;
- recommended next task.

## Task engine

The task engine should produce a short list from context instead of exposing the whole cockpit at once. Example:

```text
context: HOVER
controls: cyclic, collective, pedals
observed: descending, yaw rate positive
next tasks:
- arrest descent
- reduce yaw rate
- recenter cyclic
```

## Safety / design rule

Phase 5 begins with observation, semantic mapping, smoothing and training. Closed-loop control must be opt-in, bounded and immediately overridden by deliberate pilot input.

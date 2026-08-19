'use strict';

const AIRCRAFT_TYPES = Object.freeze({
  FIXED_WING: 'FIXED_WING',
  HELICOPTER: 'HELICOPTER',
});

const CONTEXTS = Object.freeze({
  UNKNOWN: 'UNKNOWN',
  PREFLIGHT: 'PREFLIGHT',
  TAXI: 'TAXI',
  TAKEOFF: 'TAKEOFF',
  CLIMB: 'CLIMB',
  CRUISE: 'CRUISE',
  DESCENT: 'DESCENT',
  APPROACH: 'APPROACH',
  LANDING: 'LANDING',
  HOVER: 'HOVER',
  TRANSITION: 'TRANSITION',
  RECOVERY: 'RECOVERY',
});

const CONTEXT_CONTROLS = Object.freeze({
  [CONTEXTS.PREFLIGHT]: ['engine', 'configuration', 'trim'],
  [CONTEXTS.TAXI]: ['throttle', 'brakes', 'rudder'],
  [CONTEXTS.TAKEOFF]: ['throttle', 'rudder', 'pitch', 'roll', 'gear', 'flaps', 'trim'],
  [CONTEXTS.CLIMB]: ['pitch', 'roll', 'yaw', 'throttle', 'trim', 'heading'],
  [CONTEXTS.CRUISE]: ['pitch', 'roll', 'yaw', 'throttle', 'trim', 'heading', 'altitude'],
  [CONTEXTS.DESCENT]: ['pitch', 'roll', 'yaw', 'throttle', 'trim', 'speedbrake'],
  [CONTEXTS.APPROACH]: ['pitch', 'roll', 'yaw', 'throttle', 'flaps', 'gear', 'trim'],
  [CONTEXTS.LANDING]: ['pitch', 'roll', 'yaw', 'throttle', 'brakes', 'flaps', 'gear'],
  [CONTEXTS.HOVER]: ['cyclic', 'collective', 'pedals'],
  [CONTEXTS.TRANSITION]: ['cyclic', 'collective', 'pedals', 'trim'],
  [CONTEXTS.RECOVERY]: ['cyclic', 'collective', 'pedals', 'power'],
  [CONTEXTS.UNKNOWN]: [],
});

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function abs(value) {
  return Math.abs(num(value));
}

function observation(id, message, value = null) {
  return { id, message, value };
}

function task(id, priority, control, message, reason) {
  return { id, priority, control, message, reason };
}

function inferFixedWingContext(state) {
  const onGround = Boolean(state.onGround);
  const ias = num(state.indicatedAirspeedKt ?? state.airspeedKt);
  const agl = num(state.altitudeAglFt ?? state.aglFt);
  const vs = num(state.verticalSpeedFpm);

  if (onGround && ias < 5) return CONTEXTS.PREFLIGHT;
  if (onGround && ias < 35) return CONTEXTS.TAXI;
  if (onGround || (agl < 250 && vs > 150)) return CONTEXTS.TAKEOFF;
  if (agl < 350 && vs < -150) return CONTEXTS.LANDING;
  if (agl < 1500 && ias < 140 && vs <= 250) return CONTEXTS.APPROACH;
  if (vs > 300) return CONTEXTS.CLIMB;
  if (vs < -300) return CONTEXTS.DESCENT;
  return CONTEXTS.CRUISE;
}

function inferHelicopterContext(state) {
  const onGround = Boolean(state.onGround);
  const agl = num(state.altitudeAglFt ?? state.aglFt);
  const groundSpeed = num(state.groundSpeedKt);
  const vs = num(state.verticalSpeedFpm);
  const bank = abs(state.bankDeg ?? state.rollDeg);
  const pitch = abs(state.pitchDeg);

  if (onGround && groundSpeed < 2) return CONTEXTS.PREFLIGHT;
  if (!onGround && (bank > 35 || pitch > 25 || abs(vs) > 1200)) return CONTEXTS.RECOVERY;
  if (!onGround && agl < 200 && groundSpeed < 12 && abs(vs) < 450) return CONTEXTS.HOVER;
  if (!onGround && groundSpeed >= 12 && groundSpeed < 45) return CONTEXTS.TRANSITION;
  if (vs > 350) return CONTEXTS.CLIMB;
  if (vs < -350) return CONTEXTS.DESCENT;
  return CONTEXTS.CRUISE;
}

function inferContext(state = {}, options = {}) {
  if (options.context && Object.values(CONTEXTS).includes(options.context)) {
    return options.context;
  }

  const aircraftType = options.aircraftType || state.aircraftType || AIRCRAFT_TYPES.FIXED_WING;
  if (aircraftType === AIRCRAFT_TYPES.HELICOPTER) return inferHelicopterContext(state);
  return inferFixedWingContext(state);
}

function safetyTasks(state) {
  const tasks = [];
  if (state.stallWarning) {
    tasks.push(task(
      'STALL_WARNING',
      100,
      'flight-controls',
      'Recover from stall condition before lower-priority tasks.',
      'Simulator stall warning is active.',
    ));
  }
  if (state.overspeedWarning) {
    tasks.push(task(
      'OVERSPEED_WARNING',
      95,
      'energy-management',
      'Reduce excess airspeed before lower-priority tasks.',
      'Simulator overspeed warning is active.',
    ));
  }
  return tasks;
}

function hoverTasks(state) {
  const tasks = [];
  const vs = num(state.verticalSpeedFpm);
  const yawRate = num(state.yawRateDegS);
  const roll = num(state.bankDeg ?? state.rollDeg);
  const pitch = num(state.pitchDeg);
  const drift = num(state.driftSpeedKt ?? state.groundSpeedKt);

  if (vs < -120) {
    tasks.push(task('ARREST_DESCENT', 90, 'collective', 'Reduce the descent rate.', `Vertical speed is ${Math.round(vs)} ft/min.`));
  } else if (vs > 180) {
    tasks.push(task('REDUCE_CLIMB', 70, 'collective', 'Reduce the climb rate toward a stable hover.', `Vertical speed is +${Math.round(vs)} ft/min.`));
  }

  if (abs(yawRate) > 4) {
    tasks.push(task('DAMP_YAW', 85, 'pedals', 'Reduce yaw rate toward zero.', `Yaw rate is ${yawRate.toFixed(1)} deg/s.`));
  }

  if (abs(roll) > 5 || abs(pitch) > 5) {
    tasks.push(task('RECENTER_CYCLIC', 80, 'cyclic', 'Bring pitch and roll closer to level.', `Pitch ${pitch.toFixed(1)}°, roll ${roll.toFixed(1)}°.`));
  }

  if (drift > 3) {
    tasks.push(task('REDUCE_DRIFT', 65, 'cyclic', 'Reduce lateral/forward drift.', `Drift speed is ${drift.toFixed(1)} kt.`));
  }

  return tasks;
}

function fixedWingTasks(context, state) {
  const tasks = [];
  const bank = num(state.bankDeg);
  const pitch = num(state.pitchDeg);
  const headingError = num(state.headingErrorDeg);
  const altitudeError = num(state.altitudeErrorFt);
  const vs = num(state.verticalSpeedFpm);

  if ([CONTEXTS.CLIMB, CONTEXTS.CRUISE, CONTEXTS.DESCENT].includes(context) && abs(bank) > 20) {
    tasks.push(task('REDUCE_BANK', 75, 'roll', 'Reduce unnecessary bank angle.', `Bank is ${bank.toFixed(1)}°.`));
  }

  if (context === CONTEXTS.CRUISE && abs(headingError) > 8) {
    tasks.push(task('CORRECT_HEADING', 70, 'heading', 'Correct the heading deviation.', `Heading error is ${headingError.toFixed(1)}°.`));
  }

  if (context === CONTEXTS.CRUISE && abs(altitudeError) > 250) {
    tasks.push(task('CORRECT_ALTITUDE', 65, 'pitch/trim', 'Reduce altitude deviation gradually.', `Altitude error is ${Math.round(altitudeError)} ft.`));
  }

  if (context === CONTEXTS.APPROACH && abs(vs) > 1000) {
    tasks.push(task('STABILIZE_DESCENT', 85, 'pitch/throttle', 'Reduce excessive descent rate for the current approach.', `Vertical speed is ${Math.round(vs)} ft/min.`));
  }

  if (context === CONTEXTS.TAKEOFF && pitch < -2) {
    tasks.push(task('CHECK_TAKEOFF_ATTITUDE', 70, 'pitch', 'Avoid a nose-down takeoff attitude.', `Pitch is ${pitch.toFixed(1)}°.`));
  }

  return tasks;
}

function helicopterTasks(context, state) {
  if (context === CONTEXTS.HOVER) return hoverTasks(state);

  const tasks = [];
  const yawRate = num(state.yawRateDegS);
  const bank = num(state.bankDeg ?? state.rollDeg);
  const pitch = num(state.pitchDeg);

  if (abs(yawRate) > 8) {
    tasks.push(task('DAMP_YAW', 80, 'pedals', 'Reduce yaw rate before adding more maneuver input.', `Yaw rate is ${yawRate.toFixed(1)} deg/s.`));
  }
  if (context === CONTEXTS.RECOVERY && (abs(bank) > 30 || abs(pitch) > 20)) {
    tasks.push(task('RECOVER_ATTITUDE', 95, 'cyclic', 'Return toward a controlled attitude.', `Pitch ${pitch.toFixed(1)}°, roll ${bank.toFixed(1)}°.`));
  }
  return tasks;
}

function collectObservations(state) {
  const observations = [];
  if (state.verticalSpeedFpm != null) observations.push(observation('VERTICAL_SPEED', 'Vertical speed', num(state.verticalSpeedFpm)));
  if (state.yawRateDegS != null) observations.push(observation('YAW_RATE', 'Yaw rate', num(state.yawRateDegS)));
  if (state.bankDeg != null || state.rollDeg != null) observations.push(observation('ROLL', 'Roll / bank', num(state.bankDeg ?? state.rollDeg)));
  if (state.pitchDeg != null) observations.push(observation('PITCH', 'Pitch', num(state.pitchDeg)));
  if (state.groundSpeedKt != null) observations.push(observation('GROUND_SPEED', 'Ground speed', num(state.groundSpeedKt)));
  return observations;
}

function evaluateContext(state = {}, options = {}) {
  const aircraftType = options.aircraftType || state.aircraftType || AIRCRAFT_TYPES.FIXED_WING;
  const context = inferContext(state, { ...options, aircraftType });
  const maxTasks = Math.max(1, Math.min(5, Number(options.maxTasks) || 3));

  const tasks = [
    ...safetyTasks(state),
    ...(aircraftType === AIRCRAFT_TYPES.HELICOPTER
      ? helicopterTasks(context, state)
      : fixedWingTasks(context, state)),
  ]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxTasks);

  return {
    aircraftType,
    context,
    controls: CONTEXT_CONTROLS[context] || [],
    observations: collectObservations(state),
    tasks,
  };
}

module.exports = {
  AIRCRAFT_TYPES,
  CONTEXTS,
  CONTEXT_CONTROLS,
  evaluateContext,
  inferContext,
};

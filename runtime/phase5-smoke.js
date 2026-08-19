'use strict';

const fs = require('fs');
const path = require('path');
const { AdaptiveController, MODES } = require('./adaptive-control.js');
const { AIRCRAFT_TYPES, CONTEXTS, evaluateContext } = require('./context-task-engine.js');
const { FlightAssistSession } = require('./flight-assist-session.js');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testAdaptiveController() {
  const manual = new AdaptiveController({ mode: MODES.MANUAL });
  const manualFrame = manual.process({ axes: [0.2, -0.2] });
  assert(manualFrame.assist.active === false, 'MANUAL must not activate assistance');
  assert(manualFrame.axes[0] === 0.2, 'MANUAL must preserve axis values');

  const assisted = new AdaptiveController({ mode: MODES.HELI_LAB, deadband: 0.03 });
  const assistedFrame = assisted.process({ axes: [0.01, 0.25] });
  assert(assistedFrame.assist.active === true, 'HELI_LAB should permit bounded smoothing');
  assert(assistedFrame.axes[0] === 0, 'Deadband should zero tiny axis input');

  const overrideFrame = assisted.process({ axes: [0.9, 0] });
  assert(overrideFrame.assist.pilotOverride === true, 'Deliberate pilot input must immediately override assistance');
}

function testHoverContext() {
  const result = evaluateContext({
    aircraftType: AIRCRAFT_TYPES.HELICOPTER,
    onGround: false,
    altitudeAglFt: 42,
    groundSpeedKt: 1.5,
    verticalSpeedFpm: -240,
    yawRateDegS: 6.4,
    bankDeg: -7,
    pitchDeg: 2,
  });

  assert(result.context === CONTEXTS.HOVER, `Expected HOVER, got ${result.context}`);
  assert(result.tasks.length <= 3, 'Task list should remain intentionally short');
  assert(result.tasks.some((item) => item.id === 'ARREST_DESCENT'), 'Hover should detect descent task');
  assert(result.tasks.some((item) => item.id === 'DAMP_YAW'), 'Hover should detect yaw task');
  assert(result.controls.includes('cyclic') && result.controls.includes('collective') && result.controls.includes('pedals'), 'Hover controls must expose cyclic/collective/pedals');
}

function testRecoveryPriority() {
  const result = evaluateContext({
    aircraftType: AIRCRAFT_TYPES.HELICOPTER,
    onGround: false,
    altitudeAglFt: 60,
    groundSpeedKt: 3,
    verticalSpeedFpm: -300,
    yawRateDegS: 9,
    bankDeg: 42,
    pitchDeg: 4,
  });

  assert(result.context === CONTEXTS.RECOVERY, `Expected RECOVERY to outrank HOVER, got ${result.context}`);
  assert(result.tasks.some((item) => item.id === 'RECOVER_ATTITUDE'), 'Recovery should surface attitude recovery first');
}

function testCruiseContext() {
  const result = evaluateContext({
    aircraftType: AIRCRAFT_TYPES.FIXED_WING,
    onGround: false,
    altitudeAglFt: 8000,
    indicatedAirspeedKt: 180,
    verticalSpeedFpm: 40,
    bankDeg: 3,
    pitchDeg: 1,
    headingErrorDeg: 12,
    altitudeErrorFt: -420,
  });

  assert(result.context === CONTEXTS.CRUISE, `Expected CRUISE, got ${result.context}`);
  assert(result.tasks.some((item) => item.id === 'CORRECT_HEADING'), 'Cruise should surface heading deviation');
  assert(result.tasks.some((item) => item.id === 'CORRECT_ALTITUDE'), 'Cruise should surface altitude deviation');
}

function testKeyboardProfile() {
  const profilePath = path.join(__dirname, '..', 'profiles', 'flight-keyboard.semantic.json');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

  assert(profile.global.Escape === 'PilotOverride_Manual', 'Escape must remain the global manual override');
  assert(profile.global.Space === 'FreezeInspect_Toggle', 'Space must be reserved for Freeze/Inspect');
  assert(profile.helicopter.cyclic.W === 'Cyclic_Forward', 'Helicopter cyclic forward binding missing');
  assert(profile.helicopter.collective.ArrowUp === 'Collective_Increase', 'Collective binding missing');
  assert(profile.fixedWing.configuration.G === 'LandingGear_Toggle', 'Landing gear binding missing');
}

function testFlightAssistSession() {
  const session = new FlightAssistSession({
    aircraftType: AIRCRAFT_TYPES.HELICOPTER,
    mode: MODES.HELI_LAB,
  });

  const tick = session.tick(
    { axes: [0.02, 0.15, 0, 0] },
    {
      onGround: false,
      altitudeAglFt: 30,
      groundSpeedKt: 1,
      verticalSpeedFpm: -180,
      yawRateDegS: 5.5,
      bankDeg: 2,
      pitchDeg: 1,
    },
  );

  assert(tick.decision.context === CONTEXTS.HOVER, 'Session should infer HOVER from telemetry');
  assert(tick.assist.mode === MODES.HELI_LAB, 'Session should preserve controller mode');
  assert(Array.isArray(tick.outputFrame.axes), 'Session should return an output frame');
}

function run() {
  testAdaptiveController();
  testHoverContext();
  testRecoveryPriority();
  testCruiseContext();
  testKeyboardProfile();
  testFlightAssistSession();
  console.log('OK Phase 5 smoke: adaptive control + context engine + session + keyboard cockpit profile');
}

if (require.main === module) run();

module.exports = { run };

'use strict';

const { AdaptiveController, MODES } = require('./adaptive-control.js');
const { AIRCRAFT_TYPES, evaluateContext } = require('./context-task-engine.js');

class FlightAssistSession {
  constructor(options = {}) {
    this.aircraftType = options.aircraftType || AIRCRAFT_TYPES.FIXED_WING;
    this.context = options.context || null;
    this.maxTasks = options.maxTasks || 3;
    this.controller = options.controller || new AdaptiveController({
      mode: options.mode || MODES.MANUAL,
      deadband: options.deadband,
      timeConstantSeconds: options.timeConstantSeconds,
      pilotOverrideThreshold: options.pilotOverrideThreshold,
    });
  }

  setAircraftType(aircraftType) {
    if (!Object.values(AIRCRAFT_TYPES).includes(aircraftType)) {
      throw new Error(`Unsupported aircraft type: ${aircraftType}`);
    }
    this.aircraftType = aircraftType;
  }

  setMode(mode) {
    this.controller.setMode(mode);
  }

  setContext(context = null) {
    this.context = context;
  }

  reset() {
    this.controller.reset();
    this.context = null;
  }

  tick(inputFrame = {}, flightState = {}, dtSeconds = 1 / 60) {
    const decision = evaluateContext(
      { ...flightState, aircraftType: this.aircraftType },
      {
        aircraftType: this.aircraftType,
        context: this.context || undefined,
        maxTasks: this.maxTasks,
      },
    );

    const outputFrame = this.controller.process(inputFrame, dtSeconds);

    return {
      inputFrame,
      outputFrame,
      flightState,
      decision,
      assist: outputFrame.assist,
    };
  }
}

module.exports = {
  FlightAssistSession,
};

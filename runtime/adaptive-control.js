'use strict';

const MODES = Object.freeze({
  MANUAL: 'MANUAL',
  CRUISE_ASSIST: 'CRUISE_ASSIST',
  HELI_SAS: 'HELI_SAS',
  HELI_LAB: 'HELI_LAB',
});

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function applyDeadband(value, deadband = 0.03) {
  const v = clamp(value);
  const d = Math.max(0, Math.min(0.95, deadband));
  if (Math.abs(v) <= d) return 0;
  const scaled = (Math.abs(v) - d) / (1 - d);
  return Math.sign(v) * scaled;
}

function smoothingAlpha(dtSeconds, timeConstantSeconds) {
  const dt = Math.max(0, Number(dtSeconds) || 0);
  const tau = Math.max(0.001, Number(timeConstantSeconds) || 0.001);
  return 1 - Math.exp(-dt / tau);
}

function smoothAxis(previous, target, dtSeconds, timeConstantSeconds = 0.08) {
  const alpha = smoothingAlpha(dtSeconds, timeConstantSeconds);
  return clamp(previous + (target - previous) * alpha);
}

class AdaptiveController {
  constructor(options = {}) {
    this.mode = options.mode || MODES.MANUAL;
    this.deadband = options.deadband ?? 0.03;
    this.timeConstantSeconds = options.timeConstantSeconds ?? 0.08;
    this.pilotOverrideThreshold = options.pilotOverrideThreshold ?? 0.75;
    this.previousAxes = [];
  }

  setMode(mode) {
    if (!Object.values(MODES).includes(mode)) {
      throw new Error(`Unsupported adaptive-control mode: ${mode}`);
    }
    this.mode = mode;
  }

  reset() {
    this.previousAxes = [];
  }

  process(frame, dtSeconds = 1 / 60) {
    const axes = Array.isArray(frame?.axes) ? frame.axes.map(clamp) : [];

    if (this.mode === MODES.MANUAL) {
      this.previousAxes = [...axes];
      return { ...frame, axes, assist: { mode: this.mode, active: false, pilotOverride: true } };
    }

    const deliberatePilotInput = axes.some(
      (value) => Math.abs(value) >= this.pilotOverrideThreshold,
    );

    if (deliberatePilotInput) {
      this.previousAxes = [...axes];
      return { ...frame, axes, assist: { mode: this.mode, active: false, pilotOverride: true } };
    }

    const assistedAxes = axes.map((value, index) => {
      const target = applyDeadband(value, this.deadband);
      const previous = this.previousAxes[index] ?? target;
      return smoothAxis(previous, target, dtSeconds, this.timeConstantSeconds);
    });

    this.previousAxes = [...assistedAxes];

    return {
      ...frame,
      axes: assistedAxes,
      assist: {
        mode: this.mode,
        active: true,
        pilotOverride: false,
      },
    };
  }
}

module.exports = {
  MODES,
  AdaptiveController,
  applyDeadband,
  clamp,
  smoothAxis,
  smoothingAlpha,
};

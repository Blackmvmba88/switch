const AXIS_NAMES = ["LX", "LY", "RX", "RY"];

function round(value, digits = 3) {
  return Number(Number(value || 0).toFixed(digits));
}

function clamp(value, min = -1, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function createAxisState() {
  return {
    offset: 0,
    samples: [],
    idleStreak: 0
  };
}

function createStickCalibration(options = {}) {
  const sampleLimit = Number(options.sampleLimit || 32);
  const captureThreshold = Number(options.captureThreshold || 0.35);
  const minSamples = Number(options.minSamples || 8);
  const updateThreshold = Number(options.updateThreshold || 0.015);
  const maxOffset = Number(options.maxOffset || 0.2);
  const decay = Number(options.decay || 0.2);
  const snapThreshold = Number(options.snapThreshold || 0.04);

  const axes = {
    LX: createAxisState(),
    LY: createAxisState(),
    RX: createAxisState(),
    RY: createAxisState()
  };

  function updateAxis(name, raw) {
    const axis = axes[name];
    if (!axis) return { raw, corrected: raw, offset: 0, calibrated: false };

    const value = Number(raw || 0);
    if (!Number.isFinite(value)) {
      return { raw: 0, corrected: 0, offset: round(axis.offset), calibrated: false };
    }

      if (Math.abs(value) <= captureThreshold) {
        axis.samples.push(value);
        axis.idleStreak += 1;
        if (axis.samples.length > sampleLimit) {
          axis.samples.shift();
        }
      } else {
        axis.samples.length = 0;
        axis.idleStreak = 0;
      }

    let calibrated = false;
      if (axis.samples.length >= minSamples) {
        const sorted = [...axis.samples].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        if (Math.abs(median) >= updateThreshold) {
          axis.offset = clamp(axis.offset * (1 - decay) + median * decay, -maxOffset, maxOffset);
          calibrated = true;
        }
        if (axis.idleStreak >= minSamples * 2 && Math.abs(median) < snapThreshold) {
          axis.offset = 0;
          calibrated = true;
        }
      }

    let corrected = clamp(value - axis.offset);
    if (Math.abs(corrected) < snapThreshold) {
      corrected = 0;
    }
    return {
      raw: round(value),
      corrected: round(corrected),
      offset: round(axis.offset),
      calibrated
    };
  }

  function updateAxes(rawAxes = []) {
    const result = {};
    for (let index = 0; index < AXIS_NAMES.length; index += 1) {
      result[AXIS_NAMES[index]] = updateAxis(AXIS_NAMES[index], rawAxes[index]);
    }
    return result;
  }

  function validate() {
    const warnings = [];
    for (const name of AXIS_NAMES) {
      const axis = axes[name];
      const current = axis.samples.at(-1);
      if (axis.offset && Math.abs(axis.offset) > 0.08) {
        warnings.push(`${name} offset=${round(axis.offset, 4)}`);
      }
      if (Number.isFinite(current)) {
        const residual = current - axis.offset;
        if (Math.abs(current) < captureThreshold && Math.abs(residual) > snapThreshold) {
          warnings.push(`${name} residual=${round(residual, 4)}`);
        }
      }
    }
    return warnings;
  }

  return {
    updateAxes,
    validate,
    serialize() {
      return {
        offsets: Object.fromEntries(AXIS_NAMES.map((name) => [name, round(axes[name].offset, 4)]))
      };
    },
    restore(state = {}) {
      const offsets = state.offsets || {};
      for (const name of AXIS_NAMES) {
        if (Number.isFinite(offsets[name])) {
          axes[name].offset = clamp(Number(offsets[name]), -maxOffset, maxOffset);
        }
      }
    },
    snapshot() {
      return Object.fromEntries(
        AXIS_NAMES.map((name) => [name, { offset: round(axes[name].offset, 4), samples: axes[name].samples.length }])
      );
    }
  };
}

module.exports = {
  createStickCalibration
};

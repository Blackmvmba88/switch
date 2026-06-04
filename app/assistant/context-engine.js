const { getActionsForSignal, listKnownSignals } = require("./action-registry");

const SIGNAL_RULES = Object.freeze([
  {
    signal: "low_health",
    when: (context) => Number(context.health) > 0 && Number(context.health) <= 35,
    confidence: (context) => clamp01((35 - Number(context.health)) / 35)
  },
  {
    signal: "ammo_low",
    when: (context) => Number(context.ammo) >= 0 && Number(context.ammo) <= 6,
    confidence: (context) => clamp01((6 - Number(context.ammo)) / 6)
  },
  {
    signal: "enemy_visible",
    when: (context) => context.enemyVisible === true,
    confidence: (context) => clamp01(Number(context.enemyConfidence ?? 0.8))
  },
  {
    signal: "footsteps_left",
    when: (context) => context.audioCue === "footsteps_left",
    confidence: (context) => clamp01(Number(context.audioConfidence ?? 0.75))
  },
  {
    signal: "open_door",
    when: (context) => context.openDoor === true,
    confidence: (context) => clamp01(Number(context.doorConfidence ?? 0.65))
  },
  {
    signal: "zone_pressure",
    when: (context) => context.zoneClosing === true || Number(context.zoneSeconds ?? Infinity) <= 45,
    confidence: (context) => {
      if (context.zoneClosing === true) return 0.85;
      return clamp01((45 - Number(context.zoneSeconds)) / 45);
    }
  }
]);

function clamp01(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function detectSignals(context = {}) {
  return SIGNAL_RULES
    .filter((rule) => rule.when(context))
    .map((rule) => ({
      signal: rule.signal,
      confidence: Number(rule.confidence(context).toFixed(3))
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

function scoreAction(action, signalConfidence) {
  return Number((action.priority * (0.65 + signalConfidence * 0.35)).toFixed(2));
}

function evaluateContext(context = {}) {
  const signals = detectSignals(context);
  const actionMap = new Map();

  for (const detected of signals) {
    for (const action of getActionsForSignal(detected.signal)) {
      const scored = {
        ...action,
        signal: detected.signal,
        confidence: detected.confidence,
        score: scoreAction(action, detected.confidence)
      };

      const existing = actionMap.get(action.id);
      if (!existing || scored.score > existing.score) {
        actionMap.set(action.id, scored);
      }
    }
  }

  const topActions = [...actionMap.values()].sort((a, b) => b.score - a.score);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    mode: "assistive_observer",
    knownSignals: listKnownSignals(),
    signals,
    topActions,
    summary: summarize(signals, topActions)
  };
}

function summarize(signals, actions) {
  if (signals.length === 0) return "No actionable signals detected.";
  const leadSignal = signals[0].signal;
  const leadAction = actions[0]?.label || "Observe";
  return `Lead signal: ${leadSignal}. Suggested action: ${leadAction}.`;
}

module.exports = {
  detectSignals,
  evaluateContext
};

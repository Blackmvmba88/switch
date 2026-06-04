const ACTION_REGISTRY = Object.freeze({
  low_health: [
    {
      id: "heal_when_safe",
      label: "Heal when safe",
      priority: 95,
      reason: "Health is low and survival value is high."
    },
    {
      id: "take_cover",
      label: "Take cover",
      priority: 90,
      reason: "Create safety before using resources."
    },
    {
      id: "disengage",
      label: "Disengage",
      priority: 78,
      reason: "Avoid forcing a fight while vulnerable."
    }
  ],
  ammo_low: [
    {
      id: "reload_if_clear",
      label: "Reload if clear",
      priority: 88,
      reason: "Low ammo reduces fight readiness."
    },
    {
      id: "swap_weapon",
      label: "Swap weapon",
      priority: 74,
      reason: "Weapon swap may be safer than reloading under pressure."
    },
    {
      id: "search_ammo",
      label: "Search ammo",
      priority: 58,
      reason: "Replenish resources when threat pressure is low."
    }
  ],
  enemy_visible: [
    {
      id: "mark_threat",
      label: "Mark threat",
      priority: 82,
      reason: "Threat awareness improves positioning decisions."
    },
    {
      id: "take_cover",
      label: "Take cover",
      priority: 80,
      reason: "Cover reduces exposure before committing."
    },
    {
      id: "engage_if_advantaged",
      label: "Engage if advantaged",
      priority: 68,
      reason: "Only commit when health, ammo, and position are favorable."
    }
  ],
  footsteps_left: [
    {
      id: "check_left_angle",
      label: "Check left angle",
      priority: 86,
      reason: "Directional audio suggests a nearby threat."
    },
    {
      id: "reduce_noise",
      label: "Reduce noise",
      priority: 65,
      reason: "Moving quietly helps confirm threat position."
    }
  ],
  open_door: [
    {
      id: "assume_recent_presence",
      label: "Assume recent presence",
      priority: 72,
      reason: "Open paths can imply another player moved through."
    },
    {
      id: "clear_room",
      label: "Clear room",
      priority: 69,
      reason: "Check corners before crossing a threshold."
    }
  ],
  zone_pressure: [
    {
      id: "rotate_early",
      label: "Rotate early",
      priority: 92,
      reason: "Early rotation reduces forced fights and storm damage."
    },
    {
      id: "avoid_open_ground",
      label: "Avoid open ground",
      priority: 77,
      reason: "Zone movement often exposes weak paths."
    }
  ]
});

function listKnownSignals() {
  return Object.keys(ACTION_REGISTRY).sort();
}

function getActionsForSignal(signal) {
  return [...(ACTION_REGISTRY[signal] || [])].sort((a, b) => b.priority - a.priority);
}

module.exports = {
  ACTION_REGISTRY,
  listKnownSignals,
  getActionsForSignal
};

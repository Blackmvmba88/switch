/**
 * Action Registry
 * Centralized definition and management of all available actions
 * Provides single source of truth for action schema and metadata
 */

export const actionRegistry = {
  // OFFENSIVE ACTIONS (Player-triggered)
  OFFENSIVE: {
    CUE_SAFE_SHOT: {
      id: 'cue_safe_shot',
      name: 'Safe Shot Cue',
      description: 'Auditory/haptic cue indicating optimal shot window',
      category: 'offensive',
      execution: 'human_confirmed',
      feedbackChannels: ['audio', 'haptic', 'visual'],
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['cue_safe_shot'] },
          execution: { type: 'string', enum: ['human_confirmed'] },
          urgency: { type: 'string', enum: ['instant', 'delayed'] },
          feedback: { type: 'object' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['id', 'execution']
      }
    }
  },

  // RESOURCE MANAGEMENT
  RESOURCE: {
    AMMO_OPTIMIZATION: {
      id: 'ammo_optimization',
      name: 'Ammunition Optimization',
      description: 'Suggests ammunition management strategy based on context',
      category: 'resource',
      execution: 'assistant_recommend',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['ammo_optimization'] },
          execution: { type: 'string', enum: ['assistant_recommend'] },
          recommendation: { type: 'object' },
          urgency: { type: 'string', enum: ['instant', 'delayed'] }
        },
        required: ['id', 'execution']
      }
    }
  },

  // SAFETY ALERTS
  SAFETY: {
    ALLY_WARNING: {
      id: 'halt_fire_warning',
      name: 'Ally in Line of Fire',
      description: 'Critical warning when ally detected in shot trajectory',
      category: 'safety',
      execution: 'human_confirmed',
      urgency: 'critical',
      feedbackChannels: ['audio', 'haptic', 'visual'],
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['halt_fire_warning'] },
          execution: { type: 'string', enum: ['human_confirmed'] },
          allyPosition: { type: 'object' },
          confidence: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['id', 'execution']
      }
    }
  },

  // AWARENESS
  AWARENESS: {
    TARGET_LOST: {
      id: 'target_lost_notification',
      name: 'Target Lost Notification',
      description: 'Notifies when tracked target becomes unvisible',
      category: 'awareness',
      execution: 'automatic_notification',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string', enum: ['target_lost_notification'] },
          execution: { type: 'string', enum: ['automatic_notification'] },
          lastKnownPosition: { type: 'object' }
        },
        required: ['id', 'execution']
      }
    }
  },

  // FORBIDDEN ACTIONS (Permanent blocklist)
  FORBIDDEN: {
    AUTO_FIRE: {
      id: 'auto_fire',
      name: '[FORBIDDEN] Auto Fire',
      description: 'Autonomous firing without player input',
      blocked: true,
      reason: 'Violates fair play principles'
    },
    AUTO_AIM: {
      id: 'auto_aim',
      name: '[FORBIDDEN] Auto Aim',
      description: 'Automatic aiming assistance',
      blocked: true,
      reason: 'Violates fair play principles'
    },
    AIM_BOT: {
      id: 'aim_bot',
      name: '[FORBIDDEN] Aim Bot',
      description: 'Automated targeting system',
      blocked: true,
      reason: 'Anti-cheat violation'
    },
    TRIGGER_BOT: {
      id: 'trigger_bot',
      name: '[FORBIDDEN] Trigger Bot',
      description: 'Automated shot firing',
      blocked: true,
      reason: 'Anti-cheat violation'
    },
    WALL_HACK: {
      id: 'wall_hack',
      name: '[FORBIDDEN] Wall Hack',
      description: 'Bypass vision obstacles',
      blocked: true,
      reason: 'Unfair gameplay advantage'
    }
  }
};

/**
 * Get action definition by ID
 */
export function getActionDefinition(actionId) {
  for (const category in actionRegistry) {
    for (const key in actionRegistry[category]) {
      const action = actionRegistry[category][key];
      if (action.id === actionId) {
        return action;
      }
    }
  }
  return null;
}

/**
 * List all permitted actions
 */
export function getPermittedActions() {
  const permitted = [];
  const forbidden = actionRegistry.FORBIDDEN;

  for (const category in actionRegistry) {
    if (category === 'FORBIDDEN') continue;
    for (const key in actionRegistry[category]) {
      permitted.push(actionRegistry[category][key]);
    }
  }

  return permitted;
}

/**
 * List all forbidden actions
 */
export function getForbiddenActions() {
  return Object.values(actionRegistry.FORBIDDEN);
}

/**
 * Validate action payload against schema
 */
export function validateActionSchema(actionId, payload) {
  const action = getActionDefinition(actionId);
  if (!action) {
    return { valid: false, error: `Action '${actionId}' not found in registry` };
  }

  if (action.blocked) {
    return { valid: false, error: `Action '${actionId}' is forbidden: ${action.reason}` };
  }

  if (!action.schema) {
    return { valid: true }; // No schema defined
  }

  // Basic schema validation (can be extended with JSON Schema library)
  const schema = action.schema;
  for (const required of schema.required || []) {
    if (!(required in payload)) {
      return { valid: false, error: `Missing required field: '${required}'` };
    }
  }

  return { valid: true };
}

export default { actionRegistry, getActionDefinition, getPermittedActions, getForbiddenActions, validateActionSchema };
/**
 * Safety Policy
 * Enforces ethical boundaries and prevents autonomous cheating behaviors
 * Acts as guardian middleware intercepting all action payloads
 */

export class SafetyPolicy {
  constructor(config = {}) {
    this.config = {
      enableLogging: config.enableLogging !== false,
      blocklistSeverity: config.blocklistSeverity || 'CRITICAL',
      ...config
    };

    // Absolute blocklist - actions that are NEVER permitted
    this.blocklist = [
      'auto_fire',
      'auto_aim',
      'teleport',
      'wall_hack',
      'infinite_ammo',
      'instant_kill',
      'speed_hack',
      'noclip',
      'esp',
      'aim_bot',
      'trigger_bot'
    ];

    // Actions that must have human confirmation
    this.requiresHumanConfirmation = [
      'cue_safe_shot',
      'halt_fire_warning',
      'swap_weapon_if_pressure',
      'reload_if_clear'
    ];

    // Execution types that are NEVER autonomous
    this.forbiddenExecutionTypes = [
      'autonomous',
      'auto_execute',
      'background_execution'
    ];
  }

  /**
   * Core validation pipeline for all action payloads
   * Returns { valid: boolean, reason: string, action: object }
   */
  validatePayload(actionPayload) {
    // Step 1: Check if action is explicitly blocklisted
    if (this.isBlocklisted(actionPayload.id)) {
      return {
        valid: false,
        reason: `[SAFETY BLOCK] Action '${actionPayload.id}' is prohibited`,
        severity: 'CRITICAL',
        action: actionPayload
      };
    }

    // Step 2: Check execution type for autonomy attempts
    if (this.forbiddenExecutionTypes.includes(actionPayload.execution)) {
      return {
        valid: false,
        reason: `[SAFETY BLOCK] Autonomous execution forbidden for '${actionPayload.id}'`,
        severity: 'CRITICAL',
        action: actionPayload
      };
    }

    // Step 3: Verify human confirmation for sensitive actions
    if (this.requiresHumanConfirmation.includes(actionPayload.id)) {
      if (actionPayload.execution !== 'human_confirmed') {
        return {
          valid: false,
          reason: `[SAFETY BLOCK] Action '${actionPayload.id}' requires human confirmation`,
          severity: 'HIGH',
          action: actionPayload
        };
      }
    }

    // Step 4: Payload structure validation
    const structureCheck = this.validateStructure(actionPayload);
    if (!structureCheck.valid) {
      return structureCheck;
    }

    // All checks passed
    if (this.config.enableLogging) {
      console.log(`[SAFETY PASS] Action '${actionPayload.id}' validated successfully`);
    }

    return {
      valid: true,
      reason: 'Action passed all safety checks',
      severity: 'INFO',
      action: actionPayload
    };
  }

  /**
   * Check if action ID is in blocklist
   */
  isBlocklisted(actionId) {
    return this.blocklist.includes(actionId.toLowerCase());
  }

  /**
   * Validate payload structure
   */
  validateStructure(payload) {
    if (!payload || typeof payload !== 'object') {
      return {
        valid: false,
        reason: 'Invalid payload structure',
        severity: 'HIGH'
      };
    }

    if (!payload.id || typeof payload.id !== 'string') {
      return {
        valid: false,
        reason: 'Missing or invalid action ID',
        severity: 'HIGH'
      };
    }

    if (!payload.execution || typeof payload.execution !== 'string') {
      return {
        valid: false,
        reason: 'Missing or invalid execution type',
        severity: 'HIGH'
      };
    }

    return { valid: true };
  }

  /**
   * Log security event
   */
  logSecurityEvent(eventType, payload, result) {
    const event = {
      timestamp: Date.now(),
      type: eventType,
      actionId: payload?.id,
      result: result.valid ? 'ALLOWED' : 'BLOCKED',
      reason: result.reason,
      severity: result.severity
    };

    if (this.config.enableLogging) {
      console.log(`[SECURITY] ${JSON.stringify(event)}`);
    }

    return event;
  }

  /**
   * Add custom rule to blocklist
   */
  addToBlocklist(actionId) {
    if (!this.blocklist.includes(actionId)) {
      this.blocklist.push(actionId);
      if (this.config.enableLogging) {
        console.log(`[POLICY UPDATE] Added '${actionId}' to blocklist`);
      }
    }
  }

  /**
   * Remove action from blocklist (for testing/reconfiguration)
   */
  removeFromBlocklist(actionId) {
    const index = this.blocklist.indexOf(actionId);
    if (index > -1) {
      this.blocklist.splice(index, 1);
      if (this.config.enableLogging) {
        console.log(`[POLICY UPDATE] Removed '${actionId}' from blocklist`);
      }
    }
  }

  /**
   * Get current policy summary
   */
  getPolicySummary() {
    return {
      blocklistSize: this.blocklist.length,
      requiresConfirmationSize: this.requiresHumanConfirmation.length,
      forbiddenExecutionTypes: this.forbiddenExecutionTypes,
      config: this.config
    };
  }
}

export default SafetyPolicy;
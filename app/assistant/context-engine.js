/**
 * Context Engine
 * Evaluates game state and environment variables in real-time
 * Provides structured context for tactical rule evaluation
 */

export class ContextEngine {
  constructor(config = {}) {
    this.config = config;
    this.state = {
      enemyVisible: false,
      aimAligned: false,
      enemyConfidence: 0,
      noAllyInLineOfFire: true,
      currentAmmo: 0,
      magazineSize: 30,
      reserveAmmo: 0,
      pressureLevel: 'LOW', // LOW, MEDIUM, HIGH
      targetVector: { x: 0, y: 0, z: 0 },
      aimVector: { x: 0, y: 0, z: 0 },
      timestamp: Date.now()
    };
  }

  /**
   * Calculate aiming accuracy using dot product of aim and target vectors
   * Returns cosine similarity (0 to 1, where 1 is perfect alignment)
   * 
   * Mathematical foundation:
   * cos(θ) = (V_aim · V_target) / (||V_aim|| * ||V_target||)
   */
  calculateAimAlignment() {
    const dotProduct = 
      this.state.aimVector.x * this.state.targetVector.x +
      this.state.aimVector.y * this.state.targetVector.y +
      this.state.aimVector.z * this.state.targetVector.z;

    const aimMagnitude = Math.sqrt(
      this.state.aimVector.x ** 2 +
      this.state.aimVector.y ** 2 +
      this.state.aimVector.z ** 2
    );

    const targetMagnitude = Math.sqrt(
      this.state.targetVector.x ** 2 +
      this.state.targetVector.y ** 2 +
      this.state.targetVector.z ** 2
    );

    if (aimMagnitude === 0 || targetMagnitude === 0) {
      return 0;
    }

    const cosineSimilarity = dotProduct / (aimMagnitude * targetMagnitude);
    return Math.max(0, Math.min(1, cosineSimilarity));
  }

  /**
   * Evaluate if current alignment meets threshold
   * Default threshold: 0.85 (approximately 31.8 degrees)
   */
  isAimAligned(threshold = 0.85) {
    const alignment = this.calculateAimAlignment();
    return alignment >= threshold;
  }

  /**
   * Update context from game state snapshot
   */
  updateContext(snapshot) {
    this.state = {
      ...this.state,
      ...snapshot,
      timestamp: Date.now()
    };
  }

  /**
   * Get current context for rule evaluation
   */
  getContext() {
    return {
      ...this.state,
      aimAlignment: this.calculateAimAlignment()
    };
  }

  /**
   * Evaluate ammunition pressure (percentage of magazine used)
   */
  evaluatePressureLevel() {
    const usagePercent = (this.state.currentAmmo / this.state.magazineSize) * 100;
    
    if (usagePercent < 25) {
      this.state.pressureLevel = 'HIGH';
    } else if (usagePercent < 75) {
      this.state.pressureLevel = 'MEDIUM';
    } else {
      this.state.pressureLevel = 'LOW';
    }

    return this.state.pressureLevel;
  }

  /**
   * Check if there are allies blocking line of fire (simplified check)
   */
  validateLineOfFire(allyPositions = []) {
    // This would integrate with actual game state detection
    // For now, returns the configured state
    return this.state.noAllyInLineOfFire;
  }
}

export default ContextEngine;
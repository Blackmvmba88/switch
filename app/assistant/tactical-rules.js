/**
 * Tactical Rules Engine
 * Defines game-aware rules that suggest actions to the human player
 * Never executes autonomously; only provides recommendations with urgency levels
 */

export const tacticalRules = [
  {
    id: "RULE_SAFE_SHOT",
    name: "Safe Shot Detection",
    description: "Detects optimal window for human player to fire",
    category: "offensive",
    priority: "high",
    
    when: (ctx) => 
      ctx.enemyVisible === true &&
      ctx.aimAligned === true &&
      ctx.enemyConfidence >= 0.9 &&
      ctx.noAllyInLineOfFire === true &&
      ctx.currentAmmo > 0,
    
    action: {
      id: "cue_safe_shot",
      type: "player_cue",
      execution: "human_confirmed", // Always requires human input
      urgency: "instant",
      feedback: {
        audio: "beep_short_high",
        haptic: "pulse_double",
        visual: "overlay_green_border"
      },
      recommendation: "SAFE SHOT - Press to fire"
    }
  },
  
  {
    id: "RULE_AMMO_CRITICAL",
    name: "Ammunition Management",
    description: "Evaluates ammunition status and suggests reload timing",
    category: "resource",
    priority: "medium",
    
    when: (ctx) => ctx.currentAmmo <= ctx.magazineSize * 0.25, // Below 25%
    
    action: {
      id: "ammo_optimization",
      type: "resource_suggestion",
      execution: "assistant_recommend",
      urgency: "delayed",
      
      getRecommendation: (ctx) => {
        const ammoPercent = (ctx.currentAmmo / ctx.magazineSize) * 100;
        
        if (ammoPercent === 0) {
          return {
            action: "search_ammo",
            label: "Out of ammo - search for supplies",
            priority: "critical"
          };
        }
        
        if (ctx.pressureLevel === "HIGH" && ctx.reserveAmmo > 0) {
          return {
            action: "swap_weapon_if_pressure",
            label: "High pressure: consider swapping weapon",
            priority: "high"
          };
        }
        
        if (ctx.pressureLevel === "LOW" && ctx.enemyVisible === false) {
          return {
            action: "reload_if_clear",
            label: "Clear area: reload magazine",
            priority: "medium"
          };
        }
        
        return {
          action: "conserve_ammo",
          label: "Conserve remaining ammunition",
          priority: "low"
        };
      },
      
      feedback: {
        audio: "beep_low_medium",
        haptic: "pulse_single",
        visual: "ammo_indicator_flash"
      }
    }
  },
  
  {
    id: "RULE_ALLY_PROTECTION",
    name: "Ally Detection",
    description: "Warns when allies are in potential line of fire",
    category: "safety",
    priority: "critical",
    
    when: (ctx) => ctx.noAllyInLineOfFire === false,
    
    action: {
      id: "halt_fire_warning",
      type: "safety_alert",
      execution: "human_confirmed",
      urgency: "critical",
      feedback: {
        audio: "alarm_high_pitched",
        haptic: "pulse_rapid",
        visual: "overlay_red_warning"
      },
      recommendation: "CAUTION - Ally in line of fire!"
    }
  },
  
  {
    id: "RULE_ENEMY_LOST",
    name: "Target Lost",
    description: "Notifies when tracked enemy becomes unvisible",
    category: "awareness",
    priority: "medium",
    
    when: (ctx) => ctx.enemyVisible === false && ctx.aimAligned === true,
    
    action: {
      id: "target_lost_notification",
      type: "status_update",
      execution: "automatic_notification",
      urgency: "delayed",
      feedback: {
        audio: "beep_descending",
        haptic: "pulse_fade",
        visual: "overlay_fade_out"
      },
      recommendation: "Target lost - reacquire"
    }
  }
];

/**
 * Evaluate all tactical rules against current context
 * Returns array of triggered rules sorted by priority
 */
export function evaluateTacticalRules(context) {
  const triggered = [];

  for (const rule of tacticalRules) {
    if (rule.when(context)) {
      const ruleResult = {
        ...rule,
        triggeredAt: Date.now(),
        contextSnapshot: { ...context }
      };

      // If action has dynamic recommendation function, compute it
      if (rule.action.getRecommendation) {
        ruleResult.action.recommendation = rule.action.getRecommendation(context);
      }

      triggered.push(ruleResult);
    }
  }

  // Sort by priority: critical > high > medium > low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  triggered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return triggered;
}

export default { tacticalRules, evaluateTacticalRules };
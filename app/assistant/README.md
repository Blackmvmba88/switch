# Assistant System Architecture

The Assistant subsystem provides **high-fidelity gameplay support** while maintaining ethical boundaries and player agency. This system never executes actions autonomously; instead, it evaluates game state, suggests optimal moments for player action, and prevents unfair advantages.

## Core Modules

### 1. Context Engine (`context-engine.js`)

**Responsibility**: Real-time game state evaluation

- Maintains live snapshot of game environment
- Calculates aiming accuracy using **vector mathematics**
- Evaluates ammunition pressure and resource status
- Provides structured context for rule evaluation

**Key Mathematical Foundation**:

Aiming alignment is computed using the dot product of normalized vectors:

```
cos(θ) = (V_aim · V_target) / (||V_aim|| * ||V_target||)
```

Where:
- `V_aim`: Player's current aiming vector
- `V_target`: Vector from player to target
- Result: Cosine similarity (0 to 1, where 1 = perfect alignment)

Threshold typically set at **0.85** (≈31.8° deviation tolerance)

### 2. Tactical Rules Engine (`tactical-rules.js`)

**Responsibility**: Game-aware rule evaluation and action suggestion

**Active Rules**:

1. **RULE_SAFE_SHOT**: Detects optimal firing window
   - Triggers when: Enemy visible + aim aligned + no allies in line of fire + ammo available
   - Execution: `human_confirmed` (player must press trigger)
   - Feedback: Audio beep + haptic pulse + visual overlay

2. **RULE_AMMO_CRITICAL**: Ammunition management
   - Triggers when: Magazine < 25% capacity
   - Execution: `assistant_recommend` (suggestion only)
   - Provides context-aware reload recommendations

3. **RULE_ALLY_PROTECTION**: Ally detection
   - Triggers when: Ally detected in line of fire
   - Execution: `human_confirmed` (blocks accidental friendly fire)
   - Feedback: Rapid haptic pulse + red visual warning

4. **RULE_ENEMY_LOST**: Target tracking
   - Triggers when: Enemy leaves visible range
   - Execution: `automatic_notification` (status update)
   - Feedback: Descending audio tone + haptic fade

### 3. Safety Policy (`safety-policy.js`)

**Responsibility**: Action validation and ethical enforcement

**Three-Layer Defense**:

1. **Blocklist Validation**: Absolutely prohibited actions
   - `auto_fire`, `auto_aim`, `aim_bot`, `trigger_bot`, `wall_hack`, `esp`, etc.
   - Rejected with `CRITICAL` severity

2. **Execution Type Enforcement**: No autonomous execution
   - Forbidden: `autonomous`, `auto_execute`, `background_execution`
   - Permitted: `human_confirmed`, `assistant_recommend`, `automatic_notification`

3. **Confirmation Requirement**: Sensitive actions require human input
   - Actions like `cue_safe_shot` must have `execution: "human_confirmed"`
   - Verified before payload reaches hardware/UI layer

**Validation Payload**:

```javascript
{
  valid: boolean,
  reason: string,
  severity: "INFO" | "HIGH" | "CRITICAL",
  action: object
}
```

### 4. Action Registry (`action-registry.js`)

**Responsibility**: Single source of truth for all actions

**Action Categories**:

- **OFFENSIVE**: Player-triggered firing cues
- **RESOURCE**: Ammunition and equipment management
- **SAFETY**: Friendly fire and collision warnings
- **AWARENESS**: Target tracking and status notifications
- **FORBIDDEN**: Permanently blocked (anti-cheat)

**Each Action Defines**:

```javascript
{
  id: string,                    // Unique identifier
  name: string,                  // Human-readable name
  description: string,           // Purpose and behavior
  category: string,              // Functional category
  execution: string,             // Execution mode (human_confirmed, etc.)
  feedbackChannels: string[],    // Audio, haptic, visual
  schema: JSONSchema             // Validation schema
}
```

## Data Flow

```
Game State Snapshot
        ↓
Context Engine (math evaluation)
        ↓
Tactical Rules Engine (condition evaluation)
        ↓
Triggered Rules Array (sorted by priority)
        ↓
Action Payload Generation
        ↓
Safety Policy Validation
        ↓
Human Confirmation (if required)
        ↓
Feedback Delivery (audio/haptic/visual)
```

## Execution Modes

### `human_confirmed`
- Requires explicit player action to trigger
- Used for: Safe shot cues, weapon swaps, fire halts
- Safety: Player always in control

### `assistant_recommend`
- Suggestion displayed to player
- Player decides whether to act
- Used for: Reload timing, ammo conservation, positioning
- Safety: Advisory only, no execution

### `automatic_notification`
- System status updates
- No player action required
- Used for: Target lost, enemy spotted, pressure alerts
- Safety: Informational only

## Mathematical Elegance

The system respects both **algorithmic precision** and **player agency**:

1. **Accuracy**: Aiming calculations use normalized vector math
2. **Responsiveness**: Real-time context evaluation with minimal latency
3. **Fairness**: No autonomous aim-assist, only feedback cues
4. **Transparency**: All thresholds and rules are configurable and auditable

## Integration Points

- **Input Mapping** (`../adapters/`): Maps physical controller inputs to game commands
- **Runtime Protocol** (`../../RUNTIME_PROTOCOL.md`): Defines message format to hardware
- **Device Signatures** (`../../device-signatures/`): Hardware-specific calibration
- **Profiles** (`../../profiles/`): User-specific settings and preferences

## Testing & Validation

See `fixtures/` and `samples/` directories for test cases and example payloads.

## Philosophy

> **The player is the driver; the assistant is the co-pilot.**
>
> The system provides:
> - **Situational awareness**: What's happening in the game
> - **Optimal timing**: When to act
> - **Fair feedback**: How to improve performance
>
> The system never:
> - **Aims for the player**: Only suggests when alignment is good
> - **Fires autonomously**: Cues require human trigger press
> - **Hides information**: All data flows transparently
> - **Cheats**: Strictly enforces anti-cheat principles

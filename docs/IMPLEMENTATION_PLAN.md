# Commlink Implementation Plan

## Current State vs Target Architecture

### What Exists Today

| Component | Status | Description |
|-----------|--------|-------------|
| **Web Dashboard** | ✅ Complete | Next.js UI with scenarios, runs, models pages |
| **Database** | ✅ Complete | Supabase with runs, metrics, models, scenarios tables |
| **World Model** | ✅ Complete | DreamerV3-style trajectory predictor (state → position) |
| **Training Pipeline** | ✅ Complete | PyTorch training with Supabase metric logging |
| **Simulation Setup** | ⚠️ Partial | Docker + PX4 SITL setup scripts, basic Gazebo world |
| **Data Collection Agent** | ⚠️ Partial | MAVLink agent follows waypoints, records state/action |
| **Progress Tracking** | ✅ Complete | Real-time progress with ETA in UI |

### What's Missing for Target Architecture

| Component | Status | Gap |
|-----------|--------|-----|
| **Natural Language Objectives** | ❌ Missing | Scenarios use waypoints, not NL commands |
| **LLM Planner** | ❌ Missing | No high-level planning from objectives |
| **Object Detection** | ❌ Missing | No camera processing or YOLO integration |
| **Exit Criteria System** | ❌ Missing | No success/failure condition handling |
| **Variant Generation** | ❌ Missing | No randomization of scenario parameters |
| **Video Recording** | ❌ Missing | No camera feed capture |
| **Decision Logging** | ❌ Missing | No LLM reasoning capture |
| **Mid-Level Planner** | ❌ Missing | No waypoint generation from subgoals |
| **MPC Controller** | ❌ Missing | World model not used for control yet |

---

## Implementation Phases

### Phase 2: Perception System
**Priority: HIGH** | **Effort: 2-3 weeks equivalent work**

Add camera integration and object detection to enable the drone to "see" its environment.

#### 2.1 Camera Integration in Gazebo

**Files to create:**
- `simulation/plugins/camera_plugin.cpp` - Gazebo camera sensor plugin
- `simulation/worlds/tracking_world.world` - World with trackable objects

**Files to modify:**
- `simulation/docker-compose.yml` - Add camera topic exposure
- `simulation/agent.py` - Subscribe to camera topic

**Tasks:**
1. Add RGB camera sensor to drone model in Gazebo
2. Configure camera topic publishing (30fps, 640x480)
3. Create world files with colored objects (red sphere, blue cube, etc.)
4. Test camera feed extraction from Gazebo

#### 2.2 Object Detection Pipeline

**Files to create:**
```
drone/
├── perception/
│   ├── __init__.py
│   ├── detector.py      # YOLOv8 wrapper for object detection
│   ├── depth.py         # Monocular depth estimation (optional)
│   └── world_state.py   # Aggregates detections into world state
```

**Tasks:**
1. Install ultralytics (YOLOv8) in simulation container
2. Create detector class that processes RGB frames
3. Train/fine-tune on drone imagery (colored objects)
4. Create world state aggregator (detections → 3D positions)

#### 2.3 Video Recording

**Files to create:**
- `drone/perception/recorder.py` - FFmpeg-based video recording

**Files to modify:**
- `simulation/agent.py` - Integrate recorder into collection loop

**Tasks:**
1. Record camera feed to MP4 during episodes
2. Sync video timestamps with telemetry
3. Upload videos to Supabase Storage

#### 2.4 Database Updates

**Files to modify:**
- `supabase/schema.sql` - Add video_url, detections table
- `src/types/index.ts` - Add Episode.video_url, Detection type

```sql
-- New table for object detections
CREATE TABLE detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES episodes(id),
  frame_number integer NOT NULL,
  timestamp float NOT NULL,
  objects jsonb NOT NULL, -- [{class, bbox, position_3d, confidence}]
  created_at timestamptz DEFAULT now()
);

-- Update episodes table
ALTER TABLE episodes ADD COLUMN video_url text;
ALTER TABLE episodes ADD COLUMN success boolean;
ALTER TABLE episodes ADD COLUMN exit_reason text;
```

---

### Phase 3: Natural Language & LLM Planner
**Priority: HIGH** | **Effort: 2-3 weeks equivalent work**

Enable natural language objectives and high-level planning.

#### 3.1 Scenario Schema Update

**Files to modify:**
- `supabase/schema.sql` - Add objective_text, exit_criteria, objects, variants
- `src/types/index.ts` - Update Scenario interface

**New Scenario structure:**
```typescript
interface Scenario {
  id: string;
  name: string;
  objective_text: string;  // "Locate and track the red sphere"
  environment: string;
  objects: ScenarioObject[];  // [{type: "sphere", color: "red", size: 0.5}]
  exit_criteria: ExitCriteria;
  variant_config: VariantConfig;
  created_at: string;
}

interface ExitCriteria {
  success: SuccessCondition[];  // [{type: "track_duration", target: "red_sphere", seconds: 300}]
  failure: FailureCondition[];  // [{type: "battery_low", threshold: 10}, {type: "collision"}, {type: "out_of_bounds"}]
}

interface VariantConfig {
  count: number;  // Number of variants to run
  randomize: string[];  // ["object_positions", "start_position", "wind"]
}
```

#### 3.2 LLM Planner Integration

**Files to create:**
```
drone/
├── planner/
│   ├── __init__.py
│   ├── llm_planner.py   # Claude/GPT API integration
│   ├── prompts/
│   │   ├── planning.txt      # System prompt for planning
│   │   ├── replanning.txt    # Prompt when conditions change
│   │   └── examples.json     # Few-shot examples
│   └── subgoal.py       # Subgoal data structures
```

**LLM Planner design:**
```python
class LLMPlanner:
    """High-level planner using LLM for natural language understanding."""

    def plan(self, objective: str, world_state: WorldState, constraints: dict) -> Plan:
        """
        Generate a plan from natural language objective.

        Args:
            objective: "Locate and track the red sphere"
            world_state: Current detected objects, drone position
            constraints: Battery level, time remaining, boundaries

        Returns:
            Plan with subgoals: ["search_area", "approach_target", "maintain_tracking"]
        """

    def replan(self, current_subgoal: str, world_state: WorldState, failure_reason: str) -> Plan:
        """Replan when current approach isn't working."""
```

#### 3.3 Decision Logging

**Files to create:**
- `supabase/schema.sql` - Add decisions table

**Files to modify:**
- `drone/planner/llm_planner.py` - Log all LLM interactions

```sql
CREATE TABLE decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES episodes(id),
  timestamp float NOT NULL,
  world_state jsonb NOT NULL,  -- Current perception state
  llm_input text NOT NULL,     -- Full prompt sent to LLM
  llm_output text NOT NULL,    -- Raw LLM response
  subgoal text NOT NULL,       -- Extracted subgoal
  reasoning text,              -- LLM's reasoning
  created_at timestamptz DEFAULT now()
);
```

#### 3.4 UI Updates for Scenarios

**Files to modify:**
- `src/app/scenarios/page.tsx` - Show objectives, exit criteria
- `src/app/scenarios/NewScenarioButton.tsx` - Add NL objective input
- `src/app/scenarios/[id]/page.tsx` - Scenario detail with objects

---

### Phase 4: Autonomous Control Loop
**Priority: HIGH** | **Effort: 3-4 weeks equivalent work**

Integrate all components into autonomous operation.

#### 4.1 Mid-Level Planner

**Files to create:**
```
drone/
├── planner/
│   └── mid_planner.py   # Translates subgoals to waypoints
```

**Supported Subgoals:**

| Subgoal | Meaning | Exit Condition |
|---------|---------|----------------|
| `search` | Scan area to find target | Target detected → `approach` |
| `approach` | Move toward detected target | Arc complete → `track` |
| `track` | Maintain position relative to target | Target lost → `search` |
| `return_home` | Fly back to start | Landed |
| `hover` | Hold current position | LLM provides new subgoal |

---

**Subgoal: `search`**
Pattern: Expanding square with intermittent 360° sector scans

```
Parameters:
  - search_bounds: extracted from objective by LLM (e.g., "north field" → bbox)
  - square_size_initial: 10m
  - square_expansion: 10m per loop
  - scan_interval: every 2nd waypoint (at corners)
  - scan_rotation: 360° in 4 steps (90° each)
  - altitude: 15m (configurable)

Behavior:
  1. Fly to corner of current square
  2. At corner: perform 360° sector scan (hover + rotate)
  3. Fly to next corner
  4. Fly to next corner (no scan)
  5. Continue until square complete
  6. Expand square by 10m, repeat
  7. If bounds exceeded, restart from center with offset

Waypoint sequence (10m square):
     2←───────1 (scan)
     │        ↑
     ↓        │
     3───────→4 (scan)
```

---

**Subgoal: `approach`**
Pattern: Fast approach with 180° arc maneuver for sensor sweep

```
Parameters:
  - target_position: from perception
  - approach_speed: 5 m/s (fast)
  - arc_radius: 15m from target
  - arc_sweep: 180° around target
  - arc_speed: 2 m/s (slower for readings)
  - final_distance: 10m

Behavior:
  1. Calculate direct path to arc start point
  2. Fly fast (5 m/s) toward arc entry
  3. Enter arc: fly 180° around target at 15m radius
     - Camera pointed at target throughout
     - Collect sensor readings for 3D understanding
  4. Exit arc at optimal tracking position

Path visualization:
  Drone ────→ Arc entry
                  ╭─────╮
                 ╱       ╲
                │ TARGET  │
                 ╲       ╱
                  ╰──○──╯ Final position
```

---

**Subgoal: `track`**
Pattern: Station keep at fixed offset

```
Parameters:
  - offset_vector: [-8m, 0, 6m] relative to target
    (8m behind, 0 lateral, 6m above)
  - tracking_tolerance: 2m
  - follow_speed: 2 m/s

Behavior:
  1. Calculate desired = target_position + offset_vector
  2. If distance to desired > tolerance:
     - Generate waypoint to desired position
  3. If target moves: smooth follow
  4. Maintain camera lock on target

Exit conditions:
  - Target lost > 3 seconds → `search`
  - Success criteria met → mission complete
  - Battery low → `return_home`
```

---

**Subgoal: `return_home`**
Pattern: Direct path to start

```
Parameters:
  - home_position: scenario start
  - return_speed: 4 m/s
  - safe_altitude: 20m

Behavior:
  1. Ascend to safe altitude
  2. Fly direct to home at return_speed
  3. Descend and land
```

---

**Subgoal: `hover`**
Pattern: Hold position

```
Parameters:
  - position: current
  - timeout: 30 seconds

Behavior:
  1. Maintain position ± 0.5m
  2. Continue sensor readings
  3. Wait for LLM decision
```

---

**Speed Summary:**

| Subgoal | Speed | Pattern |
|---------|-------|---------|
| `search` | 3 m/s | Expanding square + scans |
| `approach` | 5→2 m/s | Direct + 180° arc |
| `track` | 2 m/s | Station keep |
| `return_home` | 4 m/s | Direct to start |
| `hover` | 0 | Hold position |

#### 4.2 MPC Controller (World Model Integration)

**Files to create:**
```
drone/
├── controller/
│   ├── __init__.py
│   ├── mpc.py           # Model Predictive Control using world model
│   └── pid.py           # Fallback PID controller
```

**MPC Controller design:**
```python
class MPCController:
    """Uses world model for model-predictive control."""

    def __init__(self, world_model: WorldModel, horizon: int = 10):
        self.model = world_model
        self.horizon = horizon

    def compute_action(
        self,
        current_state: DroneState,
        target_waypoint: Waypoint,
        current_image: Optional[np.ndarray] = None
    ) -> DroneAction:
        """
        Use world model to find optimal action sequence.

        1. Sample candidate action sequences
        2. Predict trajectories using world model
        3. Score trajectories by proximity to target
        4. Return first action of best sequence
        """
```

#### 4.3 Main Control Loop

**Files to create:**
- `drone/main.py` - Main autonomous control loop

**Control loop design:**
```python
async def autonomous_control_loop(
    scenario: Scenario,
    variant_index: int,
    models: dict  # {planner, controller, vision}
):
    """
    Main autonomous control loop.

    1. Initialize environment with variant
    2. Get objective from scenario
    3. Loop until exit condition:
       a. Capture camera frame
       b. Run object detection
       c. Update world state
       d. Check exit conditions
       e. LLM planner: generate/update subgoal
       f. Mid planner: generate waypoint
       g. Controller: compute action
       h. Execute action
       i. Log everything
    4. Return episode data
    """
```

#### 4.4 Exit Condition Handler

**Files to create:**
- `drone/control/exit_handler.py` - Monitors and triggers exit conditions

```python
class ExitHandler:
    """Monitors exit conditions during autonomous operation."""

    def check(self, world_state: WorldState, scenario: Scenario) -> Optional[ExitResult]:
        """
        Check all exit conditions.

        Returns:
            None if should continue
            ExitResult(success=True/False, reason="...") if should stop
        """

        # Check success conditions
        for condition in scenario.exit_criteria.success:
            if self._check_success(condition, world_state):
                return ExitResult(success=True, reason=condition.type)

        # Check failure conditions
        for condition in scenario.exit_criteria.failure:
            if self._check_failure(condition, world_state):
                return ExitResult(success=False, reason=condition.type)

        return None
```

#### 4.5 Variant Generator

**Files to create:**
- `drone/control/variant_generator.py` - Generates scenario variants

```python
class VariantGenerator:
    """Generates variants of a scenario."""

    def generate(self, scenario: Scenario) -> list[VariantConfig]:
        """
        Generate N variants based on scenario config.

        Returns list of configs like:
        [
            {object_positions: {red_sphere: (10, 5, 0)}, start_position: (0, 0, 10)},
            {object_positions: {red_sphere: (15, -3, 0)}, start_position: (5, 5, 10)},
            ...
        ]
        """
```

---

### Phase 5: Training Pipeline Enhancement
**Priority: MEDIUM** | **Effort: 2-3 weeks equivalent work**

Enhance training to use all collected data.

#### 5.1 Vision Model Training

**Files to create:**
```
training/
├── vision/
│   ├── train_yolo.py    # Fine-tune YOLOv8 on drone imagery
│   ├── dataset.py       # Load detection data from episodes
│   └── augment.py       # Domain-specific augmentations
```

#### 5.2 LLM Fine-Tuning Pipeline

**Files to create:**
```
training/
├── planner/
│   ├── finetune_llm.py  # Fine-tune on successful decisions
│   ├── dataset.py       # Extract (objective, state) → decision pairs
│   └── evaluate.py      # Evaluate planning quality
```

#### 5.3 Enhanced World Model Training

**Files to modify:**
- `training/train.py` - Use real episode data with images
- `training/model.py` - Enable image encoder training

**Tasks:**
1. Load episode data with images
2. Train world model with vision
3. Evaluate on held-out episodes

#### 5.4 Model Registry Enhancement

**Files to modify:**
- `supabase/schema.sql` - Add model_type to models table
- `src/types/index.ts` - Add ModelType enum
- `src/app/models/page.tsx` - Filter by model type

```typescript
type ModelType = "vision" | "planner" | "controller";

interface Model {
  // ... existing fields
  model_type: ModelType;
}
```

---

### Phase 6: Analytics & Iteration
**Priority: MEDIUM** | **Effort: 1-2 weeks equivalent work**

Add analytics and comparison features.

#### 6.1 Performance Analytics

**Files to create:**
- `src/app/analytics/page.tsx` - Analytics dashboard
- `src/app/analytics/SuccessRateChart.tsx`
- `src/app/analytics/TrackingAccuracyChart.tsx`
- `src/app/analytics/ModelComparisonTable.tsx`

**Metrics to track:**
- Success rate by scenario
- Average time to completion
- Tracking accuracy (distance to target)
- LLM decision quality
- Model prediction accuracy

#### 6.2 A/B Testing

**Files to create:**
- `drone/control/ab_test.py` - Run scenarios with different models

**Tasks:**
1. Run same scenario with different model versions
2. Compare metrics
3. Statistical significance testing

#### 6.3 Episode Replay Viewer

**Files to create:**
- `src/app/episodes/[id]/page.tsx` - Episode replay
- `src/components/VideoPlayer.tsx` - Synced video + telemetry
- `src/components/DecisionTimeline.tsx` - LLM decisions overlay

---

## Recommended Implementation Order

```
Phase 2.1: Camera in Gazebo          ──┐
Phase 2.2: Object Detection            ├── Can parallelize
Phase 3.1: Scenario Schema Update    ──┘
                 │
                 ▼
Phase 2.3: Video Recording           ──┐
Phase 2.4: Database Updates            │
Phase 3.2: LLM Planner                 ├── Can parallelize
Phase 3.3: Decision Logging          ──┘
                 │
                 ▼
Phase 4.1: Mid-Level Planner         ──┐
Phase 4.4: Exit Condition Handler      ├── Sequential
Phase 4.5: Variant Generator         ──┘
                 │
                 ▼
Phase 4.2: MPC Controller            ──┐
Phase 4.3: Main Control Loop           ├── Final integration
Phase 3.4: UI Updates                ──┘
                 │
                 ▼
Phase 5: Training Pipeline           ──┐
Phase 6: Analytics                     ├── After core working
                                     ──┘
```

---

## File Structure After Implementation

```
commlink/
├── src/                              # Next.js frontend
│   ├── app/
│   │   ├── page.tsx                  # Dashboard
│   │   ├── runs/                     # Runs management
│   │   ├── scenarios/                # Scenario builder (NL objectives)
│   │   ├── models/                   # Model registry (by type)
│   │   ├── episodes/                 # Episode replay viewer
│   │   ├── analytics/                # Performance analytics
│   │   └── api/
│   ├── components/
│   │   ├── VideoPlayer.tsx
│   │   ├── DecisionTimeline.tsx
│   │   └── ...
│   └── types/
│       └── index.ts                  # Updated types
│
├── drone/                            # NEW: Drone software stack
│   ├── perception/
│   │   ├── detector.py               # YOLOv8 object detection
│   │   ├── depth.py                  # Depth estimation
│   │   ├── recorder.py               # Video recording
│   │   └── world_state.py            # State aggregation
│   ├── planner/
│   │   ├── llm_planner.py            # High-level LLM planner
│   │   ├── mid_planner.py            # Waypoint generation
│   │   └── prompts/                  # LLM prompt templates
│   ├── controller/
│   │   ├── mpc.py                    # Model predictive control
│   │   └── pid.py                    # Fallback PID
│   ├── control/
│   │   ├── exit_handler.py           # Exit condition monitoring
│   │   └── variant_generator.py      # Scenario variants
│   └── main.py                       # Main control loop
│
├── simulation/
│   ├── worlds/
│   │   ├── empty_world.world
│   │   └── tracking_world.world      # World with objects
│   ├── models/                       # 3D object models
│   │   ├── red_sphere/
│   │   └── blue_cube/
│   ├── plugins/
│   │   └── camera_plugin.cpp         # Camera sensor
│   ├── agent.py                      # Updated for autonomous mode
│   ├── docker-compose.yml
│   └── setup-sim.sh
│
├── training/
│   ├── model.py                      # World model (updated)
│   ├── train.py                      # Training script (updated)
│   ├── vision/
│   │   ├── train_yolo.py
│   │   └── dataset.py
│   └── planner/
│       ├── finetune_llm.py
│       └── dataset.py
│
├── supabase/
│   ├── schema.sql                    # Updated schema
│   └── migrations/
│       ├── 001_add_progress.sql
│       ├── 002_add_objectives.sql
│       ├── 003_add_detections.sql
│       └── 004_add_decisions.sql
│
└── docs/
    ├── ARCHITECTURE.md
    └── IMPLEMENTATION_PLAN.md
```

---

## Quick Start After Implementation

```bash
# 1. Setup (one-time)
./scripts/setup.sh
cd simulation && ./setup-sim.sh

# 2. Create a scenario in the UI
# - Name: "Track Red Sphere"
# - Objective: "Locate and track the red sphere"
# - Objects: [{type: "sphere", color: "red", size: 0.5}]
# - Success: Track for 5 minutes
# - Variants: 10

# 3. Start a run
# Click "New Run" in dashboard, select scenario

# 4. Run autonomous simulation
RUN_ID=<uuid> python drone/main.py

# 5. Monitor progress in dashboard
# - Watch video playback
# - See LLM decisions
# - Track success rate

# 6. Train improved models
python training/train.py --run-id <uuid>
python training/vision/train_yolo.py --run-id <uuid>

# 7. Deploy and iterate
# Select new models in UI, run more scenarios
```

---

## Estimated Total Effort

| Phase | Description | Effort |
|-------|-------------|--------|
| Phase 2 | Perception System | 2-3 weeks |
| Phase 3 | NL & LLM Planner | 2-3 weeks |
| Phase 4 | Autonomous Control | 3-4 weeks |
| Phase 5 | Training Enhancement | 2-3 weeks |
| Phase 6 | Analytics | 1-2 weeks |
| **Total** | | **10-15 weeks** |

*Effort estimates assume single developer. Can be parallelized with multiple developers.*

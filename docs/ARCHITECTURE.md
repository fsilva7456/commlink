# Commlink Architecture

## Vision

Commlink is a platform for training autonomous drones using a two-level AI control system:
- **High-Level Planner (LLM)**: Understands natural language objectives, reasons about the world, and generates plans
- **Low-Level Controller (World Model)**: Predicts physics and executes precise flight maneuvers

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              COMMLINK PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │   WEB DASHBOARD │    │  TRAINING       │    │  SIMULATION     │        │
│   │   (Next.js)     │    │  PIPELINE       │    │  ENVIRONMENT    │        │
│   │                 │    │  (PyTorch)      │    │  (Gazebo)       │        │
│   │  • Scenarios    │    │                 │    │                 │        │
│   │  • Runs         │    │  • LLM Trainer  │    │  • PX4 SITL     │        │
│   │  • Models       │    │  • World Model  │    │  • Objects      │        │
│   │  • Analytics    │    │  • Vision Model │    │  • Sensors      │        │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘        │
│            │                      │                      │                  │
│            └──────────────────────┼──────────────────────┘                  │
│                                   │                                         │
│                          ┌────────▼────────┐                               │
│                          │    SUPABASE     │                               │
│                          │                 │                               │
│                          │  • PostgreSQL   │                               │
│                          │  • Storage      │                               │
│                          │  • Realtime     │                               │
│                          └─────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Drone Control Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DRONE AI CONTROL STACK                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   NATURAL LANGUAGE INPUT                                                    │
│   "Locate and track the red sphere"                                         │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    HIGH-LEVEL PLANNER (LLM)                      │      │
│   │                                                                  │      │
│   │   Input:  • Natural language objective                          │      │
│   │           • Current world state (from perception)               │      │
│   │           • Mission constraints (battery, time, boundaries)     │      │
│   │                                                                  │      │
│   │   Output: • Subgoals ["search area", "approach target",         │      │
│   │                       "maintain tracking distance"]             │      │
│   │           • Success criteria                                    │      │
│   │           • Abort conditions                                    │      │
│   │                                                                  │      │
│   │   Model:  Fine-tuned LLM (Claude/GPT) or local (Llama)         │      │
│   └─────────────────────────────────┬───────────────────────────────┘      │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    MID-LEVEL PLANNER                             │      │
│   │                                                                  │      │
│   │   Input:  • Current subgoal from LLM                            │      │
│   │           • Detected objects from vision                        │      │
│   │           • Current drone state                                 │      │
│   │                                                                  │      │
│   │   Output: • Target waypoint (x, y, z, yaw)                      │      │
│   │           • Approach velocity                                   │      │
│   │           • Lookahead trajectory                                │      │
│   │                                                                  │      │
│   │   Model:  Learned policy or classical planner                   │      │
│   └─────────────────────────────────┬───────────────────────────────┘      │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                 LOW-LEVEL CONTROLLER (World Model)               │      │
│   │                                                                  │      │
│   │   Input:  • Target trajectory from planner                      │      │
│   │           • Current state (position, velocity, orientation)     │      │
│   │           • Recent action history                               │      │
│   │                                                                  │      │
│   │   Output: • Motor commands (throttle, roll, pitch, yaw)         │      │
│   │           • Predicted next states                               │      │
│   │                                                                  │      │
│   │   Model:  DreamerV3-style world model (current implementation)  │      │
│   │           + Model Predictive Control (MPC)                      │      │
│   └─────────────────────────────────┬───────────────────────────────┘      │
│                                     │                                       │
│                                     ▼                                       │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                    PX4 FLIGHT CONTROLLER                         │      │
│   │                                                                  │      │
│   │   • Attitude control (PID)                                      │      │
│   │   • Motor mixing                                                │      │
│   │   • Safety limits                                               │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Perception System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PERCEPTION PIPELINE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   CAMERA INPUT (RGB, 640x480, 30fps)                                       │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │  OBJECT         │    │  DEPTH          │    │  SEGMENTATION   │        │
│   │  DETECTION      │    │  ESTIMATION     │    │  (optional)     │        │
│   │                 │    │                 │    │                 │        │
│   │  • YOLOv8       │    │  • Monocular    │    │  • SAM          │        │
│   │  • Custom       │    │  • Stereo       │    │  • Semantic     │        │
│   │    classes      │    │  • LiDAR fusion │    │    classes      │        │
│   └────────┬────────┘    └────────┬────────┘    └────────┬────────┘        │
│            │                      │                      │                  │
│            └──────────────────────┼──────────────────────┘                  │
│                                   │                                         │
│                                   ▼                                         │
│                    ┌─────────────────────────┐                             │
│                    │     WORLD STATE         │                             │
│                    │                         │                             │
│                    │  • Detected objects     │                             │
│                    │    [{class, bbox,       │                             │
│                    │      position_3d,       │                             │
│                    │      confidence}]       │                             │
│                    │  • Free space map       │                             │
│                    │  • Obstacles            │                             │
│                    └─────────────────────────┘                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Collection & Training Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TRAINING LOOP                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. SCENARIO DEFINITION                                                    │
│      ┌─────────────────────────────────────────────────────────────┐       │
│      │  Objective: "Locate and track the red sphere"               │       │
│      │  Environment: warehouse_world                                │       │
│      │  Objects: [{type: "sphere", color: "red", size: 0.5m}]      │       │
│      │  Exit Criteria:                                              │       │
│      │    - Success: Track target for 5 minutes                    │       │
│      │    - Failure: Battery < 10%, Out of bounds, Collision       │       │
│      │  Variants: 10 (randomize sphere position)                   │       │
│      └─────────────────────────────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│   2. SIMULATION RUNS                                                        │
│      ┌─────────────────────────────────────────────────────────────┐       │
│      │  For each variant:                                          │       │
│      │    1. Spawn environment with randomized object positions    │       │
│      │    2. Initialize drone at start position                    │       │
│      │    3. Run autonomous control loop until exit condition      │       │
│      │    4. Record all data:                                      │       │
│      │       • Video frames (RGB camera)                           │       │
│      │       • Telemetry (position, velocity, orientation)         │       │
│      │       • LLM decisions (subgoals, reasoning)                 │       │
│      │       • Controller actions (motor commands)                 │       │
│      │       • Object detections                                   │       │
│      │       • Exit condition triggered                            │       │
│      └─────────────────────────────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│   3. DATA PROCESSING                                                        │
│      ┌─────────────────────────────────────────────────────────────┐       │
│      │  • Aggregate episodes from all variants                     │       │
│      │  • Label successful vs failed runs                          │       │
│      │  • Extract training pairs:                                  │       │
│      │    - Vision: (image, detected_objects)                      │       │
│      │    - Planner: (state + goal, subgoal)                      │       │
│      │    - Controller: (state + action, next_state)              │       │
│      │  • Compute metrics (success rate, tracking accuracy)        │       │
│      └─────────────────────────────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│   4. MODEL TRAINING                                                         │
│      ┌─────────────────────────────────────────────────────────────┐       │
│      │  Train/fine-tune models:                                    │       │
│      │    • Vision Model: Object detection on drone imagery        │       │
│      │    • LLM Planner: Fine-tune on (objective, state) → plan   │       │
│      │    • World Model: Train on (state, action) → next_state    │       │
│      │  Evaluate on held-out test episodes                         │       │
│      └─────────────────────────────────────────────────────────────┘       │
│                              │                                              │
│                              ▼                                              │
│   5. MODEL DEPLOYMENT                                                       │
│      ┌─────────────────────────────────────────────────────────────┐       │
│      │  • Register new model versions                              │       │
│      │  • A/B test against baseline                                │       │
│      │  • Deploy to simulation for validation                      │       │
│      │  • (Future) Deploy to real drone                           │       │
│      └─────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Database Schema (Extended)

```sql
-- Scenarios with natural language objectives
scenarios (
  id, name, objective_text, environment,
  objects[], exit_criteria{}, variant_config{},
  created_at
)

-- Runs with variant tracking
runs (
  id, scenario_id, variant_index,
  status, exit_reason, exit_condition,
  models_used{planner_id, controller_id, vision_id},
  config{}, progress, eta_seconds,
  started_at, completed_at, created_at
)

-- Episodes with rich data
episodes (
  id, run_id,
  video_url, telemetry_url, decisions_url,
  frames, duration_seconds,
  success, metrics{},
  created_at
)

-- Model registry with types
models (
  id, run_id,
  model_type (vision | planner | controller),
  version, checkpoint_url,
  eval_metrics{}, deployed,
  created_at
)

-- Training metrics per epoch
metrics (
  id, run_id, model_type,
  epoch, loss, eval_score,
  timestamp
)

-- LLM decisions log
decisions (
  id, episode_id, timestamp,
  world_state{},
  llm_input, llm_output,
  subgoal, reasoning
)

-- Object detections per frame
detections (
  id, episode_id, frame_number, timestamp,
  objects[{class, bbox, position_3d, confidence}]
)
```

## Technology Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| **Frontend** | Next.js 15, TypeScript, Tailwind | Dashboard, monitoring |
| **Backend** | Supabase (Postgres, Storage, Realtime) | Data persistence |
| **Simulation** | Gazebo, PX4 SITL | Physics, flight control |
| **Vision** | YOLOv8, OpenCV | Object detection |
| **LLM Planner** | Claude API / Local Llama | High-level planning |
| **World Model** | PyTorch (DreamerV3) | Low-level control |
| **Orchestration** | Docker Compose | Local development |
| **Video** | FFmpeg, OpenCV | Recording, processing |

## Directory Structure (Target)

```
commlink/
├── src/                          # Next.js frontend
│   ├── app/
│   │   ├── scenarios/            # Scenario management
│   │   ├── runs/                 # Run monitoring
│   │   ├── models/               # Model registry
│   │   └── analytics/            # Performance analytics
│   └── components/
│
├── drone/                        # Drone software stack
│   ├── perception/
│   │   ├── detector.py           # Object detection (YOLO)
│   │   ├── depth.py              # Depth estimation
│   │   └── world_state.py        # State aggregation
│   ├── planner/
│   │   ├── llm_planner.py        # High-level LLM planner
│   │   ├── mid_planner.py        # Waypoint generation
│   │   └── prompts/              # LLM prompt templates
│   ├── controller/
│   │   ├── world_model.py        # DreamerV3 model
│   │   ├── mpc.py                # Model predictive control
│   │   └── pid.py                # Low-level PID (fallback)
│   └── main.py                   # Main control loop
│
├── simulation/                   # Simulation environment
│   ├── worlds/                   # Gazebo world files
│   ├── models/                   # 3D object models
│   ├── spawner.py                # Dynamic object spawning
│   └── docker-compose.yml
│
├── training/                     # Model training
│   ├── vision/
│   │   ├── train_yolo.py         # Vision model training
│   │   └── dataset.py            # Image dataset loader
│   ├── planner/
│   │   ├── finetune_llm.py       # LLM fine-tuning
│   │   └── dataset.py            # Decision dataset
│   ├── controller/
│   │   ├── train.py              # World model training
│   │   └── model.py              # Model architecture
│   └── evaluate.py               # Cross-model evaluation
│
├── data/                         # Local data storage
│   ├── episodes/                 # Raw episode data
│   ├── videos/                   # Recorded videos
│   └── checkpoints/              # Model checkpoints
│
└── scripts/
    ├── setup.sh                  # Initial setup
    ├── run_scenario.py           # Run a scenario
    └── process_episodes.py       # Data processing
```

## Implementation Phases

### Phase 1: Foundation (Current) ✅
- Dashboard UI
- Basic simulation setup
- World model architecture
- Progress tracking

### Phase 2: Perception (Next)
- Camera integration in simulation
- Object detection (YOLOv8)
- Video recording
- Detection logging

### Phase 3: LLM Planner
- LLM integration (Claude API)
- Prompt engineering
- Decision logging
- Subgoal generation

### Phase 4: Autonomous Control
- Full control loop integration
- Exit condition handling
- Variant generation
- Success/failure tracking

### Phase 5: Training Pipeline
- Vision model training
- LLM fine-tuning pipeline
- Improved world model training
- Model deployment

### Phase 6: Analytics & Iteration
- Performance analytics
- A/B testing
- Model comparison
- Continuous improvement loop

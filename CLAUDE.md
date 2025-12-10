# Commlink

## Purpose

Commlink is a **platform for training autonomous drones using a two-level AI control system**:
- **High-Level Planner (LLM)**: Understands natural language objectives, reasons about the world, and generates plans
- **Low-Level Controller (World Model)**: Predicts physics and executes precise flight maneuvers

## Target Workflow

1. **Define Scenario** - Natural language objective ("Locate and track the red sphere") + exit criteria
2. **Run Variants** - Execute multiple simulation runs with randomized parameters
3. **Collect Data** - Capture video, telemetry, LLM decisions, and controller actions
4. **Train Models** - Improve vision, planning, and control models from collected data
5. **Deploy & Iterate** - Test new models, compare performance, repeat

### Two-Level AI Control

```
Natural Language Objective
         │
         ▼
┌─────────────────────────┐
│   HIGH-LEVEL PLANNER    │  ← LLM (Claude/GPT/Llama)
│   (LLM)                 │
│                         │
│   "Locate red sphere"   │
│   → ["search", "track"] │
└───────────┬─────────────┘
            │ subgoals
            ▼
┌─────────────────────────┐
│   LOW-LEVEL CONTROLLER  │  ← World Model (DreamerV3)
│   (World Model + MPC)   │
│                         │
│   subgoal + state       │
│   → motor commands      │
└─────────────────────────┘
```

### What is a World Model?

A world model is a neural network that learns to predict how the environment will change in response to actions. For Commlink:

- **Input**: Current drone state (position, velocity, orientation) + camera image + action
- **Output**: Predicted future trajectory (N-step position predictions)
- **Architecture**: DreamerV3-inspired latent dynamics model
- **Use Case**: Model Predictive Control (MPC) for precise flight maneuvers

## Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - Full system design with diagrams
- **[Implementation Plan](docs/IMPLEMENTATION_PLAN.md)** - Detailed roadmap to target architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VERCEL FRONTEND (Next.js)                       │
│              Dashboard, Runs, Scenarios, Models pages               │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                            SUPABASE                                 │
│        PostgreSQL (runs, metrics, models, scenarios, episodes)      │
│        Storage (episode data), Realtime (live updates)              │
└─────────────────────────────────────────────────────────────────────┘
                          │                    │
              ┌───────────┘                    └───────────┐
              ▼                                            ▼
┌──────────────────────────┐              ┌──────────────────────────┐
│   LOCAL SIMULATION       │              │   LOCAL TRAINING         │
│   (Docker)               │              │   (RTX 5070 GPU)         │
│                          │              │                          │
│   PX4 SITL + Gazebo      │              │   PyTorch World Model    │
│   MAVLink (pymavlink)    │──────────────│   DreamerV3 architecture │
│   Data Collector         │   episodes   │   Trajectory prediction  │
└──────────────────────────┘              └──────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | Supabase (PostgreSQL, Storage, Realtime) |
| Hosting | Vercel (auto-deploy from GitHub) |
| Simulation | PX4 SITL, Gazebo, MAVLink (MAVSDK/pymavlink) |
| ML Training | PyTorch, DreamerV3-style architecture |
| Local GPU | RTX 5070 (or any CUDA-capable GPU) |
| Dev Environment | GitHub Codespaces |

## Project Structure

```
commlink/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Dashboard - stats overview
│   │   ├── layout.tsx                  # Root layout with sidebar
│   │   ├── runs/
│   │   │   ├── page.tsx                # Training runs list
│   │   │   ├── NewRunButton.tsx        # Create run modal
│   │   │   └── [id]/
│   │   │       ├── page.tsx            # Run detail
│   │   │       ├── RunActions.tsx      # Status actions
│   │   │       └── MetricsChart.tsx    # Loss/MSE chart
│   │   ├── scenarios/
│   │   │   ├── page.tsx                # Scenarios list
│   │   │   └── NewScenarioButton.tsx   # Create scenario modal
│   │   ├── models/
│   │   │   └── page.tsx                # Models registry
│   │   └── api/
│   │       └── runs/[id]/
│   │           └── start-training/     # API to trigger training
│   ├── components/
│   │   └── Sidebar.tsx                 # Navigation sidebar
│   ├── lib/
│   │   └── supabase/                   # Supabase clients
│   └── types/
│       └── index.ts                    # TypeScript interfaces
├── simulation/
│   ├── Dockerfile                      # PX4 SITL + Gazebo container
│   ├── docker-compose.yml              # Orchestration
│   ├── agent.py                        # MAVLink agent for data collection
│   └── requirements.txt
├── training/
│   ├── model.py                        # World model (PyTorch)
│   ├── train.py                        # Training script
│   └── requirements.txt
├── scripts/
│   └── run_local.py                    # Local runner (orchestrates everything)
└── supabase/
    └── schema.sql                      # Database schema
```

## Implementation Status

### Phase 1: Foundation ✅ COMPLETE
- [x] Dashboard UI (Next.js, TypeScript, Tailwind)
- [x] Database schema (Supabase)
- [x] World model architecture (DreamerV3-style)
- [x] Progress tracking with ETA
- [x] Demo mode for easy onboarding

### Phase 2: Perception 🔲 PLANNED
- [ ] Camera integration in Gazebo
- [ ] Object detection (YOLOv8)
- [ ] Video recording
- [ ] Detection logging

### Phase 3: LLM Planner 🔲 PLANNED
- [ ] Natural language objectives
- [ ] LLM integration (Claude API)
- [ ] Decision logging
- [ ] Subgoal generation

### Phase 4: Autonomous Control 🔲 PLANNED
- [ ] Mid-level planner (subgoal → waypoint)
- [ ] MPC controller (world model integration)
- [ ] Exit condition handling
- [ ] Variant generation

### Phase 5: Training Pipeline 🔲 PLANNED
- [ ] Vision model training
- [ ] LLM fine-tuning pipeline
- [ ] Enhanced world model training

### Phase 6: Analytics 🔲 PLANNED
- [ ] Performance analytics dashboard
- [ ] A/B testing framework
- [ ] Episode replay viewer

See [IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for detailed breakdown.

## Quick Start

### 1. Run the Demo (No GPU Required)

Test the training pipeline with dummy data:

```bash
# Install Python dependencies
pip install torch numpy supabase

# Run demo
python scripts/run_local.py --demo
```

### 2. Run with Supabase Integration

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL=https://lwkmwwvzpzgeehqtnuht.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key

# Create a run in the dashboard, then:
python scripts/run_local.py --run-id <your-run-id>
```

### 3. Run Full Simulation (Docker)

```bash
cd simulation
docker-compose up
```

## Database Schema

```sql
runs (id, name, status, config, created_at, updated_at)
  └── status: pending → collecting → training → evaluating → completed

metrics (id, run_id, epoch, loss, trajectory_mse, timestamp)

models (id, run_id, version, checkpoint_url, eval_score, created_at)

scenarios (id, name, environment, waypoints, duration, config)

episodes (id, run_id, scenario_id, data_url, frames, created_at)
```

## World Model Architecture

```
Input: (state_t, action_t)
   │
   ├─► StateEncoder (MLP) ─────────────┐
   │                                   │
   └─► ActionEncoder (MLP) ──┐         │
                             │         │
                             ▼         ▼
                        ┌─────────────────┐
                        │ DynamicsModel   │
                        │ (GRU + MLP)     │
                        └─────────────────┘
                                   │
                                   ▼
                        ┌─────────────────┐
                        │ TrajectoryDecoder│
                        │ (MLP → xyz)     │
                        └─────────────────┘
                                   │
                                   ▼
                        predicted_position[t+1:t+N]
```

## Commands

### Frontend
```bash
npm run dev      # Start Next.js dev server
npm run build    # Production build
npm run lint     # ESLint
```

### Training
```bash
# Demo mode (dummy data)
python scripts/run_local.py --demo

# With Supabase run
python scripts/run_local.py --run-id <uuid>

# Direct training script
python training/train.py --use-dummy-data --epochs 50
```

### Simulation
```bash
cd simulation
docker-compose up          # Start PX4 + Gazebo + Agent
docker-compose down        # Stop all
```

## URLs

- **Production**: https://commlink-ew2rckdr7-fsilva7456s-projects.vercel.app
- **GitHub**: https://github.com/fsilva7456/commlink
- **Supabase**: https://supabase.com/dashboard/project/lwkmwwvzpzgeehqtnuht

## Development Workflow

```bash
# 1. Create feature branch
git checkout master && git pull
git checkout -b feature/your-feature

# 2. Make changes and test
npm run dev
python scripts/run_local.py --demo

# 3. Commit and push
git add -A
git commit -m "Description"
git push -u origin feature/your-feature

# 4. Create PR
gh pr create --title "Title" --body "Description"
```

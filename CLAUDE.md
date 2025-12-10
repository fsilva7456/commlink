# Commlink

## Purpose

Commlink is a **control panel for training, testing, and evaluating AI world models** for autonomous drone navigation. The system enables a closed-loop workflow:

1. **Simulate** - Run a drone in a simulated environment (PX4 SITL + Gazebo)
2. **Collect** - Gather synthetic training data (camera images, state vectors, actions)
3. **Train** - Train a world model to predict future trajectories
4. **Evaluate** - Measure prediction accuracy against ground truth
5. **Iterate** - Retrain with more data and measure improvement

### What is a World Model?

A world model is a neural network that learns to predict how the environment will change in response to actions. For Commlink:

- **Input**: Current drone state (position, velocity, orientation) + camera image + action
- **Output**: Predicted future trajectory (N-step position predictions)
- **Architecture**: DreamerV3-inspired latent dynamics model
- **Use Case**: Planning, model-predictive control, sim-to-real transfer

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

### Phase 1: Dashboard + DB ✅ COMPLETE
- [x] TypeScript types for all data models
- [x] Supabase database schema
- [x] Dashboard with stats and recent runs
- [x] Runs list and detail pages with metrics chart
- [x] Scenarios page with waypoint visualization
- [x] Models page with best model highlight
- [x] Dark theme UI with sidebar navigation

### Phase 2: Simulation + Training ✅ COMPLETE
- [x] Docker setup for PX4 SITL + Gazebo
- [x] MAVLink agent (MAVSDK) for drone control
- [x] Data collection pipeline
- [x] PyTorch world model (DreamerV3-style)
- [x] Training script with Supabase metric logging
- [x] Local runner script for end-to-end workflow
- [x] API endpoint to trigger training

### Phase 3: Evaluation (PLANNED)
- [ ] Model evaluation pipeline
- [ ] Trajectory prediction visualization
- [ ] Model comparison dashboard
- [ ] Real-time metric updates via Supabase Realtime

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

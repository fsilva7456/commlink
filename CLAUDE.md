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
│   LOCAL SIMULATION       │              │   CLOUD TRAINING         │
│   (Docker)               │              │   (RunPod GPU)           │
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
| Simulation | PX4 SITL, Gazebo, MAVLink (pymavlink) |
| ML Training | PyTorch, DreamerV3-style architecture |
| Cloud GPU | RunPod |
| Dev Environment | GitHub Codespaces |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Dashboard - stats overview
│   ├── layout.tsx                  # Root layout with sidebar
│   ├── runs/
│   │   ├── page.tsx                # Training runs list
│   │   ├── NewRunButton.tsx        # Create run modal
│   │   └── [id]/
│   │       ├── page.tsx            # Run detail (config, metrics, episodes)
│   │       ├── RunActions.tsx      # Status progression buttons
│   │       └── MetricsChart.tsx    # Loss/MSE visualization
│   ├── scenarios/
│   │   ├── page.tsx                # Simulation scenarios list
│   │   └── NewScenarioButton.tsx   # Create scenario modal
│   └── models/
│       └── page.tsx                # Trained models registry
├── components/
│   └── Sidebar.tsx                 # Navigation sidebar
├── lib/
│   └── supabase/
│       ├── client.ts               # Browser Supabase client
│       ├── server.ts               # Server Supabase client
│       └── index.ts                # Exports
└── types/
    └── index.ts                    # TypeScript interfaces

supabase/
└── schema.sql                      # Database schema (run in Supabase SQL Editor)
```

## Database Schema

```sql
-- Training runs (pending → collecting → training → evaluating → completed)
runs (id, name, status, config, created_at, updated_at)

-- Training metrics per epoch
metrics (id, run_id, epoch, loss, trajectory_mse, timestamp)

-- Model checkpoints
models (id, run_id, version, checkpoint_url, eval_score, created_at)

-- Simulation scenarios (environment + waypoints)
scenarios (id, name, environment, waypoints, duration, config)

-- Collected data episodes
episodes (id, run_id, scenario_id, data_url, frames, created_at)
```

## Implementation Status

### Phase 1: Dashboard + DB (COMPLETE)
- [x] TypeScript types for all data models
- [x] Supabase database schema
- [x] Dashboard with stats and recent runs
- [x] Runs list and detail pages
- [x] Scenarios page with waypoint visualization
- [x] Models page with best model highlight
- [x] Dark theme UI with sidebar navigation

### Phase 2: Simulation Integration (PLANNED)
- [ ] Docker container with PX4 SITL + Gazebo
- [ ] MAVLink agent (pymavlink) for drone control
- [ ] Data collection pipeline
- [ ] Episode upload to Supabase Storage

### Phase 3: Training Pipeline (PLANNED)
- [ ] World model implementation (PyTorch)
- [ ] RunPod integration for GPU training
- [ ] Metric logging to Supabase
- [ ] Model checkpoint storage

### Phase 4: Evaluation (PLANNED)
- [ ] Trajectory prediction evaluation
- [ ] Model comparison dashboard
- [ ] 3D trajectory visualization

## Data Flow

### Training Run Lifecycle

```
1. CREATE RUN (status: pending)
   └── User configures: scenario, learning rate, batch size, epochs

2. DATA COLLECTION (status: collecting)
   └── Simulation runs scenario
   └── MAVLink agent records frames
   └── Episodes uploaded to storage

3. TRAINING (status: training)
   └── RunPod loads episodes
   └── World model trains on transitions
   └── Metrics logged per epoch (loss, trajectory_mse)

4. EVALUATION (status: evaluating)
   └── Model predicts trajectories
   └── Compare to ground truth
   └── Store eval_score

5. COMPLETE (status: completed)
   └── Model checkpoint saved
   └── Available in Models page
```

### Frame Data Structure

Each frame collected during simulation:

```typescript
{
  timestamp: number,
  image: Uint8Array,           // RGB camera frame
  state: {
    position: [x, y, z],       // meters
    velocity: [vx, vy, vz],    // m/s
    orientation: [r, p, y],    // radians
    angular_velocity: [wx, wy, wz]
  },
  action: {
    throttle: number,          // 0-1
    roll: number,              // -1 to 1
    pitch: number,             // -1 to 1
    yaw: number                // -1 to 1
  }
}
```

## Environment Variables

Required in Vercel (already configured):
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key

For local development, copy `.env.local.example` to `.env.local`.

## Development Workflow

### Feature Branches

```bash
git checkout master
git pull origin master
git checkout -b feature/your-feature-name
# ... make changes ...
git add -A
git commit -m "Description of changes"
git push -u origin feature/your-feature-name
gh pr create --title "Title" --body "Description"
```

### Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
npx tsc --noEmit # Type check
```

## URLs

- **Production**: https://commlink-ew2rckdr7-fsilva7456s-projects.vercel.app
- **GitHub**: https://github.com/fsilva7456/commlink
- **Supabase**: https://supabase.com/dashboard/project/lwkmwwvzpzgeehqtnuht

## Key Concepts

### MAVLink
MAVLink (Micro Air Vehicle Link) is a protocol for communicating with drones. Commlink uses `pymavlink` to:
- Send commands (takeoff, waypoint navigation, land)
- Receive telemetry (position, velocity, orientation)
- Trigger data collection at each timestep

### PX4 SITL
PX4 is open-source flight control software. SITL (Software-In-The-Loop) runs the full PX4 stack in simulation, providing realistic drone behavior without hardware.

### Gazebo
Gazebo is a robotics simulator that provides:
- Physics simulation (gravity, collisions, aerodynamics)
- Sensor simulation (cameras, IMU, GPS)
- Environment rendering (worlds, obstacles)

### World Model (DreamerV3-style)
The world model learns environment dynamics in a latent space:
1. **Encoder**: Compresses image + state into latent representation
2. **Dynamics Model**: Predicts next latent state given action (RSSM/Transformer)
3. **Trajectory Head**: Decodes latent states to position predictions

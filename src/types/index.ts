// Run status
export type RunStatus = "pending" | "collecting" | "training" | "evaluating" | "completed" | "failed";

// Training run
export interface Run {
  id: string;
  name: string;
  status: RunStatus;
  config: RunConfig;
  created_at: string;
  updated_at: string;
}

export interface RunConfig {
  scenario_id: string;
  model_architecture: string;
  learning_rate: number;
  batch_size: number;
  epochs: number;
  trajectory_horizon: number; // N-step prediction
}

// Training metrics per epoch
export interface Metric {
  id: string;
  run_id: string;
  epoch: number;
  loss: number;
  trajectory_mse: number;
  timestamp: string;
}

// Model checkpoint
export interface Model {
  id: string;
  run_id: string;
  version: number;
  checkpoint_url: string;
  eval_score: number | null;
  created_at: string;
}

// Simulation scenario
export interface Scenario {
  id: string;
  name: string;
  environment: string;
  waypoints: Waypoint[];
  duration: number; // seconds
  config: ScenarioConfig;
  created_at: string;
}

export interface Waypoint {
  x: number;
  y: number;
  z: number;
  yaw?: number;
}

export interface ScenarioConfig {
  wind_speed?: number;
  wind_direction?: number;
  obstacles?: boolean;
  randomize_start?: boolean;
}

// Data collection episode
export interface Episode {
  id: string;
  run_id: string;
  scenario_id: string;
  data_url: string;
  frames: number;
  created_at: string;
}

// Frame data structure (for reference, stored as binary)
export interface FrameData {
  timestamp: number;
  image?: string; // base64 or URL
  state: DroneState;
  action: DroneAction;
}

export interface DroneState {
  position: [number, number, number]; // x, y, z
  velocity: [number, number, number]; // vx, vy, vz
  orientation: [number, number, number]; // roll, pitch, yaw
  angular_velocity: [number, number, number]; // wx, wy, wz
}

export interface DroneAction {
  throttle: number;
  roll: number;
  pitch: number;
  yaw: number;
}

// Dashboard stats
export interface DashboardStats {
  total_runs: number;
  active_runs: number;
  total_episodes: number;
  total_models: number;
  best_trajectory_mse: number | null;
}

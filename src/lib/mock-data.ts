/**
 * Mock data for demo mode
 * Used when Supabase is not configured
 */

import type { Run, Metric, Model, Scenario, Episode } from "@/types";

// Check if we're in demo mode (no Supabase configured)
export function isDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return !url || !key || url.includes("your-project") || key.includes("your-");
}

// Generate dates relative to now
const now = new Date();
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();

export const mockScenarios: Scenario[] = [
  {
    id: "scenario-1",
    name: "Square Pattern",
    environment: "empty_world",
    waypoints: [
      { x: 0, y: 0, z: 10 },
      { x: 20, y: 0, z: 10 },
      { x: 20, y: 20, z: 10 },
      { x: 0, y: 20, z: 10 },
      { x: 0, y: 0, z: 10 },
    ],
    duration: 120,
    config: { wind_speed: 0, obstacles: false },
    created_at: daysAgo(30),
  },
  {
    id: "scenario-2",
    name: "Figure-8 Flight",
    environment: "empty_world",
    waypoints: [
      { x: 0, y: 0, z: 10 },
      { x: 10, y: 10, z: 10 },
      { x: 20, y: 0, z: 10 },
      { x: 10, y: -10, z: 10 },
      { x: 0, y: 0, z: 10 },
    ],
    duration: 180,
    config: { wind_speed: 2, obstacles: false },
    created_at: daysAgo(25),
  },
  {
    id: "scenario-3",
    name: "Altitude Variation",
    environment: "empty_world",
    waypoints: [
      { x: 0, y: 0, z: 5 },
      { x: 10, y: 0, z: 15 },
      { x: 20, y: 0, z: 5 },
      { x: 30, y: 0, z: 20 },
    ],
    duration: 150,
    config: { wind_speed: 0, obstacles: false },
    created_at: daysAgo(20),
  },
];

export const mockRuns: Run[] = [
  {
    id: "run-1",
    name: "baseline-v1",
    status: "completed",
    config: {
      scenario_id: "scenario-1",
      model_architecture: "DreamerV3",
      learning_rate: 0.0001,
      batch_size: 32,
      epochs: 100,
      trajectory_horizon: 10,
    },
    progress: 1.0,
    current_step: "evaluating",
    total_steps: 3,
    started_at: daysAgo(7),
    eta_seconds: 0,
    created_at: daysAgo(7),
    updated_at: daysAgo(6),
  },
  {
    id: "run-2",
    name: "improved-encoder-v2",
    status: "completed",
    config: {
      scenario_id: "scenario-2",
      model_architecture: "DreamerV3",
      learning_rate: 0.0001,
      batch_size: 64,
      epochs: 150,
      trajectory_horizon: 15,
    },
    progress: 1.0,
    current_step: "evaluating",
    total_steps: 3,
    started_at: daysAgo(5),
    eta_seconds: 0,
    created_at: daysAgo(5),
    updated_at: daysAgo(4),
  },
  {
    id: "run-3",
    name: "long-horizon-test",
    status: "training",
    config: {
      scenario_id: "scenario-1",
      model_architecture: "DreamerV3",
      learning_rate: 0.0001,
      batch_size: 32,
      epochs: 200,
      trajectory_horizon: 20,
    },
    progress: 0.72,
    current_step: "training",
    total_steps: 3,
    started_at: hoursAgo(2),
    eta_seconds: 1800,
    created_at: hoursAgo(3),
    updated_at: new Date().toISOString(),
  },
  {
    id: "run-4",
    name: "new-architecture-test",
    status: "pending",
    config: {
      scenario_id: "scenario-3",
      model_architecture: "DreamerV3-Large",
      learning_rate: 0.00005,
      batch_size: 16,
      epochs: 100,
      trajectory_horizon: 10,
    },
    progress: 0,
    total_steps: 3,
    created_at: hoursAgo(1),
    updated_at: hoursAgo(1),
  },
];

// Generate realistic training metrics
function generateMetrics(runId: string, epochs: number, baseLoss: number, baseMse: number): Metric[] {
  const metrics: Metric[] = [];

  for (let epoch = 1; epoch <= epochs; epoch++) {
    const progress = epoch / epochs;
    const noise = (Math.random() - 0.5) * 0.02;

    const loss = baseLoss * Math.exp(-3 * progress) + 0.02 + noise;
    const mse = baseMse * Math.exp(-2.5 * progress) + 0.015 + noise;

    metrics.push({
      id: `metric-${runId}-${epoch}`,
      run_id: runId,
      epoch,
      loss: Math.max(0.01, loss),
      trajectory_mse: Math.max(0.01, mse),
      timestamp: daysAgo(7 - (epoch / epochs) * 1),
    });
  }

  return metrics;
}

export const mockMetrics: Metric[] = [
  ...generateMetrics("run-1", 100, 0.9, 0.6),
  ...generateMetrics("run-2", 150, 0.85, 0.55),
  ...generateMetrics("run-3", 144, 0.95, 0.65), // 72% of 200 epochs
];

export const mockModels: Model[] = [
  {
    id: "model-1",
    run_id: "run-1",
    version: 1,
    checkpoint_url: "https://storage.example.com/models/baseline-v1/best_model.pt",
    eval_score: 0.0423,
    created_at: daysAgo(6),
  },
  {
    id: "model-2",
    run_id: "run-2",
    version: 2,
    checkpoint_url: "https://storage.example.com/models/improved-encoder-v2/best_model.pt",
    eval_score: 0.0312,
    created_at: daysAgo(4),
  },
];

export const mockEpisodes: Episode[] = [
  {
    id: "episode-1",
    run_id: "run-1",
    scenario_id: "scenario-1",
    data_url: "./data/ep_baseline_0.json",
    frames: 350,
    created_at: daysAgo(7),
  },
  {
    id: "episode-2",
    run_id: "run-1",
    scenario_id: "scenario-1",
    data_url: "./data/ep_baseline_1.json",
    frames: 420,
    created_at: daysAgo(7),
  },
  {
    id: "episode-3",
    run_id: "run-2",
    scenario_id: "scenario-2",
    data_url: "./data/ep_improved_0.json",
    frames: 380,
    created_at: daysAgo(5),
  },
  {
    id: "episode-4",
    run_id: "run-3",
    scenario_id: "scenario-1",
    data_url: "./data/ep_longhorizon_0.json",
    frames: 290,
    created_at: hoursAgo(2),
  },
];

// Helper to get data by ID
export function getMockRun(id: string): Run | undefined {
  return mockRuns.find((r) => r.id === id);
}

export function getMockRunMetrics(runId: string): Metric[] {
  return mockMetrics.filter((m) => m.run_id === runId);
}

export function getMockRunEpisodes(runId: string): Episode[] {
  return mockEpisodes.filter((e) => e.run_id === runId);
}

export function getMockModel(runId: string): Model | undefined {
  return mockModels.find((m) => m.run_id === runId);
}

// Dashboard stats
export function getMockDashboardStats() {
  const activeRuns = mockRuns.filter((r) =>
    ["collecting", "training", "evaluating"].includes(r.status)
  ).length;

  const bestMse = mockMetrics.length > 0
    ? Math.min(...mockMetrics.map((m) => m.trajectory_mse))
    : null;

  return {
    totalRuns: mockRuns.length,
    activeRuns,
    totalModels: mockModels.length,
    bestMse,
  };
}

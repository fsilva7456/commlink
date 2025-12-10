/**
 * Data fetching layer with demo mode support
 * Falls back to mock data when Supabase is not configured
 */

import { createClient } from "@/lib/supabase/server";
import {
  isDemoMode,
  mockRuns,
  mockScenarios,
  mockModels,
  mockMetrics,
  mockEpisodes,
  getMockRun,
  getMockRunMetrics,
  getMockRunEpisodes,
  getMockDashboardStats,
} from "@/lib/mock-data";
import type { Run, Scenario, Model, Metric, Episode } from "@/types";

// Check demo mode on server
function checkDemoMode(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !url || !key || url.includes("your-project") || key.includes("your-");
}

export async function getRuns(): Promise<Run[]> {
  if (checkDemoMode()) {
    return mockRuns;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getRun(id: string): Promise<Run | null> {
  if (checkDemoMode()) {
    return getMockRun(id) || null;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("runs")
    .select("*")
    .eq("id", id)
    .single();

  return data;
}

export async function getRunMetrics(runId: string): Promise<Metric[]> {
  if (checkDemoMode()) {
    return getMockRunMetrics(runId);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("metrics")
    .select("*")
    .eq("run_id", runId)
    .order("epoch", { ascending: true });

  return data || [];
}

export async function getRunEpisodes(runId: string): Promise<Episode[]> {
  if (checkDemoMode()) {
    return getMockRunEpisodes(runId);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("episodes")
    .select("*")
    .eq("run_id", runId)
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getScenarios(): Promise<Scenario[]> {
  if (checkDemoMode()) {
    return mockScenarios;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("scenarios")
    .select("*")
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getModels(): Promise<(Model & { runs?: { id: string; name: string } })[]> {
  if (checkDemoMode()) {
    // Add run info to mock models
    return mockModels.map((model) => {
      const run = mockRuns.find((r) => r.id === model.run_id);
      return {
        ...model,
        runs: run ? { id: run.id, name: run.name } : undefined,
      };
    });
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("models")
    .select(`
      *,
      runs (
        id,
        name
      )
    `)
    .order("created_at", { ascending: false });

  return data || [];
}

export async function getDashboardStats() {
  if (checkDemoMode()) {
    return getMockDashboardStats();
  }

  const supabase = await createClient();

  const [runsResult, modelsResult, metricsResult] = await Promise.all([
    supabase.from("runs").select("id, status"),
    supabase.from("models").select("id"),
    supabase.from("metrics").select("trajectory_mse").order("trajectory_mse", { ascending: true }).limit(1),
  ]);

  const runs = runsResult.data || [];
  const models = modelsResult.data || [];
  const bestMse = metricsResult.data?.[0]?.trajectory_mse ?? null;

  const activeRuns = runs.filter((r) =>
    ["collecting", "training", "evaluating"].includes(r.status)
  ).length;

  return {
    totalRuns: runs.length,
    activeRuns,
    totalModels: models.length,
    bestMse,
  };
}

export async function getRecentRuns(limit: number = 5): Promise<Run[]> {
  if (checkDemoMode()) {
    return mockRuns.slice(0, limit);
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data || [];
}

// Export demo mode checker for UI
export { checkDemoMode as isServerDemoMode };

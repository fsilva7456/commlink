import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { RunActions } from "./RunActions";
import { MetricsChart } from "./MetricsChart";
import type { Run, Metric, Episode } from "@/types";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("runs")
    .select("*")
    .eq("id", id)
    .single();

  if (!run) {
    notFound();
  }

  const [metricsResult, episodesResult] = await Promise.all([
    supabase
      .from("metrics")
      .select("*")
      .eq("run_id", id)
      .order("epoch", { ascending: true }),
    supabase
      .from("episodes")
      .select("*")
      .eq("run_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const metrics = metricsResult.data || [];
  const episodes = episodesResult.data || [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-400 mb-2">
            <Link href="/runs" className="hover:text-white">
              Runs
            </Link>
            <span>/</span>
            <span className="text-zinc-300">{run.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{run.name}</h1>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={run.status} />
            <span className="text-sm text-zinc-400">
              Created {new Date(run.created_at).toLocaleString()}
            </span>
          </div>
        </div>
        <RunActions run={run} />
      </div>

      {/* Config Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Configuration</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Architecture</span>
              <span className="text-white">{run.config?.model_architecture || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Learning Rate</span>
              <span className="text-white">{run.config?.learning_rate || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Batch Size</span>
              <span className="text-white">{run.config?.batch_size || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Epochs</span>
              <span className="text-white">{run.config?.epochs || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Trajectory Horizon</span>
              <span className="text-white">{run.config?.trajectory_horizon || "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Progress</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Episodes Collected</span>
              <span className="text-white">{episodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Epochs Completed</span>
              <span className="text-white">{metrics.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Latest Loss</span>
              <span className="text-white">
                {metrics.length > 0 ? metrics[metrics.length - 1].loss.toFixed(4) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Best MSE</span>
              <span className="text-white">
                {metrics.length > 0
                  ? Math.min(...metrics.map((m: Metric) => m.trajectory_mse)).toFixed(4)
                  : "N/A"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Timeline</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Created</span>
              <span className="text-white">{new Date(run.created_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Last Updated</span>
              <span className="text-white">{new Date(run.updated_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Chart */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-4">Training Metrics</h3>
        {metrics.length > 0 ? (
          <MetricsChart metrics={metrics} />
        ) : (
          <div className="h-64 flex items-center justify-center text-zinc-500">
            No metrics recorded yet. Start training to see progress.
          </div>
        )}
      </div>

      {/* Episodes */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="font-medium text-white">Collected Episodes</h3>
        </div>
        {episodes.length > 0 ? (
          <div className="divide-y divide-zinc-800">
            {episodes.map((episode: Episode) => (
              <div key={episode.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm">Episode {episode.id.slice(0, 8)}</p>
                  <p className="text-zinc-400 text-xs">{episode.frames} frames</p>
                </div>
                <span className="text-sm text-zinc-400">
                  {new Date(episode.created_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500">
            No episodes collected yet
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-zinc-700 text-zinc-300",
    collecting: "bg-blue-900/50 text-blue-400",
    training: "bg-yellow-900/50 text-yellow-400",
    evaluating: "bg-purple-900/50 text-purple-400",
    completed: "bg-green-900/50 text-green-400",
    failed: "bg-red-900/50 text-red-400",
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

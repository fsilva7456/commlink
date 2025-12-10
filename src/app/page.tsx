import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Run, Scenario, Model } from "@/types";

export default async function Dashboard() {
  const supabase = await createClient();

  // Fetch stats
  const [runsResult, scenariosResult, modelsResult, metricsResult] = await Promise.all([
    supabase.from("runs").select("id, status"),
    supabase.from("scenarios").select("id"),
    supabase.from("models").select("id, eval_score"),
    supabase.from("metrics").select("trajectory_mse").order("trajectory_mse", { ascending: true }).limit(1),
  ]);

  const runs = runsResult.data || [];
  const scenarios = scenariosResult.data || [];
  const models = modelsResult.data || [];
  const bestMse = metricsResult.data?.[0]?.trajectory_mse;

  const activeRuns = runs.filter((r) => ["collecting", "training", "evaluating"].includes(r.status)).length;

  // Fetch recent runs
  const { data: recentRuns } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-zinc-400 mt-1">World model training overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Runs"
          value={runs.length}
          icon={<RunIcon />}
        />
        <StatCard
          label="Active Runs"
          value={activeRuns}
          icon={<ActiveIcon />}
          highlight={activeRuns > 0}
        />
        <StatCard
          label="Models"
          value={models.length}
          icon={<ModelIcon />}
        />
        <StatCard
          label="Best MSE"
          value={bestMse !== undefined ? bestMse.toFixed(4) : "N/A"}
          icon={<MetricIcon />}
        />
      </div>

      {/* Recent Runs */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="font-semibold text-white">Recent Runs</h2>
          <Link
            href="/runs"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            View all
          </Link>
        </div>

        {recentRuns && recentRuns.length > 0 ? (
          <div className="divide-y divide-zinc-800">
            {recentRuns.map((run: Run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
              >
                <div>
                  <p className="font-medium text-white">{run.name}</p>
                  <p className="text-sm text-zinc-400">
                    {new Date(run.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={run.status} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-zinc-500">
            <p>No runs yet</p>
            <Link
              href="/runs"
              className="mt-2 inline-block text-sm text-blue-400 hover:text-blue-300"
            >
              Start your first run
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickAction
          href="/runs"
          title="New Training Run"
          description="Start a new data collection and training run"
        />
        <QuickAction
          href="/scenarios"
          title="Configure Scenario"
          description="Set up simulation environments and waypoints"
        />
        <QuickAction
          href="/models"
          title="Compare Models"
          description="View and compare trained model performance"
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight = false,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <span className="text-zinc-400 text-sm">{label}</span>
        <span className="text-zinc-500">{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${highlight ? "text-green-400" : "text-white"}`}>
        {value}
      </p>
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

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
    >
      <h3 className="font-medium text-white">{title}</h3>
      <p className="mt-1 text-sm text-zinc-400">{description}</p>
    </Link>
  );
}

function RunIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
    </svg>
  );
}

function ActiveIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

function MetricIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

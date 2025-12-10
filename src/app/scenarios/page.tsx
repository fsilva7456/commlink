import { createClient } from "@/lib/supabase/server";
import { NewScenarioButton } from "./NewScenarioButton";
import type { Scenario, Waypoint } from "@/types";

export default async function ScenariosPage() {
  const supabase = await createClient();

  const { data: scenarios } = await supabase
    .from("scenarios")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Scenarios</h1>
          <p className="text-zinc-400 mt-1">Configure simulation environments and flight paths</p>
        </div>
        <NewScenarioButton />
      </div>

      {scenarios && scenarios.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scenarios.map((scenario: Scenario) => (
            <ScenarioCard key={scenario.id} scenario={scenario} />
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
          </div>
          <h3 className="text-white font-medium">No scenarios yet</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Create your first scenario to define flight paths
          </p>
        </div>
      )}
    </div>
  );
}

function ScenarioCard({ scenario }: { scenario: Scenario }) {
  const waypoints = scenario.waypoints as Waypoint[];

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-white">{scenario.name}</h3>
        <span className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">
          {scenario.environment}
        </span>
      </div>

      {/* Mini waypoint visualization */}
      <div className="h-32 bg-zinc-800 rounded mb-3 relative overflow-hidden">
        <WaypointPreview waypoints={waypoints} />
      </div>

      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-400">Waypoints</span>
          <span className="text-white">{waypoints.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-400">Duration</span>
          <span className="text-white">{scenario.duration}s</span>
        </div>
        {scenario.config?.wind_speed !== undefined && (
          <div className="flex justify-between">
            <span className="text-zinc-400">Wind</span>
            <span className="text-white">{scenario.config.wind_speed} m/s</span>
          </div>
        )}
      </div>
    </div>
  );
}

function WaypointPreview({ waypoints }: { waypoints: Waypoint[] }) {
  if (waypoints.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-xs">
        No waypoints
      </div>
    );
  }

  // Normalize waypoints to fit in preview
  const xs = waypoints.map((w) => w.x);
  const ys = waypoints.map((w) => w.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  const padding = 20;
  const width = 200;
  const height = 128;

  const points = waypoints.map((w) => ({
    x: padding + ((w.x - minX) / rangeX) * (width - padding * 2),
    y: padding + ((w.y - minY) / rangeY) * (height - padding * 2),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Path */}
      <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2} strokeDasharray="4 2" />

      {/* Waypoint dots */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={4}
          fill={i === 0 ? "#22c55e" : i === points.length - 1 ? "#ef4444" : "#3b82f6"}
        />
      ))}
    </svg>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProgressBar, StepProgress, ETADisplay } from "./ProgressBar";
import type { Run, Metric } from "@/types";

interface LiveProgressProps {
  run: Run;
  initialMetrics?: Metric[];
}

export function LiveProgress({ run: initialRun, initialMetrics = [] }: LiveProgressProps) {
  const [run, setRun] = useState<Run>(initialRun);
  const [metrics, setMetrics] = useState<Metric[]>(initialMetrics);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Subscribe to run updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`run-${initialRun.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "runs",
          filter: `id=eq.${initialRun.id}`,
        },
        (payload) => {
          setRun(payload.new as Run);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "metrics",
          filter: `run_id=eq.${initialRun.id}`,
        },
        (payload) => {
          setMetrics((prev) => [...prev, payload.new as Metric]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialRun.id]);

  // Update elapsed time every second when running
  useEffect(() => {
    if (!["collecting", "training", "evaluating"].includes(run.status)) {
      return;
    }

    const startTime = run.started_at ? new Date(run.started_at).getTime() : Date.now();

    const updateElapsed = () => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [run.status, run.started_at]);

  const isActive = ["collecting", "training", "evaluating"].includes(run.status);
  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;
  const bestMse = metrics.length > 0
    ? Math.min(...metrics.map(m => m.trajectory_mse))
    : null;

  // Get progress color based on status
  const getProgressColor = (): "blue" | "green" | "yellow" | "purple" => {
    switch (run.current_step) {
      case "collecting":
        return "blue";
      case "training":
        return "yellow";
      case "evaluating":
        return "purple";
      default:
        return "blue";
    }
  };

  if (!isActive && run.status !== "completed" && run.status !== "failed") {
    return (
      <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
        <div className="text-center text-zinc-400">
          <p>Waiting to start...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700 space-y-4">
      {/* Step Progress */}
      <StepProgress currentStep={run.current_step} status={run.status} />

      {/* Main Progress Bar */}
      {isActive && (
        <div className="pt-2">
          <ProgressBar
            progress={run.progress || 0}
            size="lg"
            color={getProgressColor()}
            animated={isActive}
          />
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
        <StatBox
          label="Status"
          value={run.current_step || run.status}
          highlight={isActive}
        />
        {latestMetric && (
          <>
            <StatBox
              label="Epoch"
              value={`${latestMetric.epoch}/${run.config?.epochs || "?"}`}
            />
            <StatBox
              label="Current Loss"
              value={latestMetric.loss.toFixed(4)}
            />
            <StatBox
              label="Best MSE"
              value={bestMse?.toFixed(4) || "N/A"}
              highlight
            />
          </>
        )}
      </div>

      {/* ETA Display */}
      <div className="pt-2 border-t border-zinc-700">
        <ETADisplay
          etaSeconds={run.eta_seconds}
          startedAt={run.started_at}
          status={run.status}
        />
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="text-xs text-zinc-500 uppercase tracking-wide">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          highlight ? "text-green-400" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// Compact version for list views
interface CompactProgressProps {
  run: Run;
}

export function CompactProgress({ run: initialRun }: CompactProgressProps) {
  const [run, setRun] = useState<Run>(initialRun);

  useEffect(() => {
    if (!["collecting", "training", "evaluating"].includes(initialRun.status)) {
      return;
    }

    const supabase = createClient();

    const channel = supabase
      .channel(`run-compact-${initialRun.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "runs",
          filter: `id=eq.${initialRun.id}`,
        },
        (payload) => {
          setRun(payload.new as Run);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [initialRun.id, initialRun.status]);

  const isActive = ["collecting", "training", "evaluating"].includes(run.status);

  if (!isActive) {
    return null;
  }

  const formatEta = (seconds: number | null | undefined): string => {
    if (!seconds) return "";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ProgressBar
            progress={run.progress || 0}
            size="sm"
            showPercent={false}
            color="yellow"
          />
        </div>
        <span className="text-xs text-zinc-400 w-24 text-right">
          {run.eta_seconds ? `ETA: ${formatEta(run.eta_seconds)}` : `${((run.progress || 0) * 100).toFixed(0)}%`}
        </span>
      </div>
    </div>
  );
}

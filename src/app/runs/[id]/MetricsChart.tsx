"use client";

import type { Metric } from "@/types";

export function MetricsChart({ metrics }: { metrics: Metric[] }) {
  if (metrics.length === 0) return null;

  const losses = metrics.map((m) => m.loss);
  const mses = metrics.map((m) => m.trajectory_mse);

  const maxLoss = Math.max(...losses);
  const maxMse = Math.max(...mses);

  const width = 800;
  const height = 200;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const lossPoints = losses.map((loss, i) => ({
    x: padding + (i / (losses.length - 1 || 1)) * chartWidth,
    y: padding + (1 - loss / (maxLoss || 1)) * chartHeight,
  }));

  const msePoints = mses.map((mse, i) => ({
    x: padding + (i / (mses.length - 1 || 1)) * chartWidth,
    y: padding + (1 - mse / (maxMse || 1)) * chartHeight,
  }));

  const lossPath = lossPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const msePath = msePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((y) => (
          <line
            key={y}
            x1={padding}
            y1={padding + y * chartHeight}
            x2={width - padding}
            y2={padding + y * chartHeight}
            stroke="#27272a"
            strokeWidth={1}
          />
        ))}

        {/* Loss line */}
        <path
          d={lossPath}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
        />

        {/* MSE line */}
        <path
          d={msePath}
          fill="none"
          stroke="#10b981"
          strokeWidth={2}
        />

        {/* Axis labels */}
        <text x={padding} y={height - 10} className="fill-zinc-500 text-xs">
          Epoch 1
        </text>
        <text x={width - padding} y={height - 10} className="fill-zinc-500 text-xs" textAnchor="end">
          Epoch {metrics.length}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span className="text-sm text-zinc-400">
            Loss ({losses[losses.length - 1]?.toFixed(4)})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-sm text-zinc-400">
            Trajectory MSE ({mses[mses.length - 1]?.toFixed(4)})
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

interface ProgressBarProps {
  progress: number; // 0 to 1
  size?: "sm" | "md" | "lg";
  showPercent?: boolean;
  color?: "blue" | "green" | "yellow" | "purple";
  animated?: boolean;
}

export function ProgressBar({
  progress,
  size = "md",
  showPercent = true,
  color = "blue",
  animated = true,
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, progress * 100));

  const heights = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const colors = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
  };

  return (
    <div className="w-full">
      <div className={`w-full bg-zinc-700 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${heights[size]} ${colors[color]} rounded-full transition-all duration-500 ease-out ${
            animated && percent < 100 ? "animate-pulse" : ""
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showPercent && (
        <div className="mt-1 text-right">
          <span className="text-xs text-zinc-400">{percent.toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

interface StepProgressProps {
  currentStep: string | null | undefined;
  status: string;
}

const STEPS = [
  { key: "collecting", label: "Collecting" },
  { key: "training", label: "Training" },
  { key: "evaluating", label: "Evaluating" },
];

export function StepProgress({ currentStep, status }: StepProgressProps) {
  const isCompleted = status === "completed";
  const isFailed = status === "failed";

  const getStepStatus = (stepKey: string): "completed" | "current" | "pending" | "failed" => {
    if (isFailed) {
      const stepIndex = STEPS.findIndex((s) => s.key === stepKey);
      const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
      if (stepIndex < currentIndex) return "completed";
      if (stepIndex === currentIndex) return "failed";
      return "pending";
    }

    if (isCompleted) return "completed";

    const stepIndex = STEPS.findIndex((s) => s.key === stepKey);
    const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

    if (currentIndex === -1) return "pending";
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => {
        const stepStatus = getStepStatus(step.key);

        return (
          <div key={step.key} className="flex items-center">
            {/* Step indicator */}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  stepStatus === "completed"
                    ? "bg-green-600 text-white"
                    : stepStatus === "current"
                    ? "bg-blue-600 text-white animate-pulse"
                    : stepStatus === "failed"
                    ? "bg-red-600 text-white"
                    : "bg-zinc-700 text-zinc-400"
                }`}
              >
                {stepStatus === "completed" ? (
                  <CheckIcon />
                ) : stepStatus === "failed" ? (
                  <XIcon />
                ) : (
                  index + 1
                )}
              </div>
              <span
                className={`mt-1 text-xs ${
                  stepStatus === "current"
                    ? "text-blue-400 font-medium"
                    : stepStatus === "completed"
                    ? "text-green-400"
                    : stepStatus === "failed"
                    ? "text-red-400"
                    : "text-zinc-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < STEPS.length - 1 && (
              <div
                className={`w-16 h-0.5 mx-2 ${
                  getStepStatus(STEPS[index + 1].key) !== "pending"
                    ? "bg-green-600"
                    : stepStatus === "current"
                    ? "bg-gradient-to-r from-blue-600 to-zinc-700"
                    : "bg-zinc-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface ETADisplayProps {
  etaSeconds: number | null | undefined;
  startedAt: string | null | undefined;
  status: string;
}

export function ETADisplay({ etaSeconds, startedAt, status }: ETADisplayProps) {
  if (status === "completed") {
    return (
      <div className="text-sm text-green-400">
        <span className="font-medium">Completed</span>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="text-sm text-red-400">
        <span className="font-medium">Failed</span>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="text-sm text-zinc-500">
        <span>Waiting to start...</span>
      </div>
    );
  }

  const elapsed = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    : 0;

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}m ${secs}s`;
    }
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  };

  const completionTime = etaSeconds
    ? new Date(Date.now() + etaSeconds * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4 text-sm">
        <div className="text-zinc-400">
          <span className="text-zinc-500">Elapsed:</span>{" "}
          <span className="text-white">{formatTime(elapsed)}</span>
        </div>
        {etaSeconds !== null && etaSeconds !== undefined && (
          <>
            <div className="text-zinc-400">
              <span className="text-zinc-500">ETA:</span>{" "}
              <span className="text-white">{formatTime(etaSeconds)}</span>
            </div>
            {completionTime && (
              <div className="text-zinc-400">
                <span className="text-zinc-500">Done at:</span>{" "}
                <span className="text-white">{completionTime}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

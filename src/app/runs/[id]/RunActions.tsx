"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Run } from "@/types";

export function RunActions({ run }: { run: Run }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const updateStatus = async (status: string) => {
    setIsLoading(true);
    await supabase.from("runs").update({ status }).eq("id", run.id);
    setIsLoading(false);
    router.refresh();
  };

  const deleteRun = async () => {
    if (!confirm("Are you sure you want to delete this run?")) return;

    setIsLoading(true);
    await supabase.from("runs").delete().eq("id", run.id);
    router.push("/runs");
    router.refresh();
  };

  const canStart = run.status === "pending" || run.status === "failed";
  const canStop = ["collecting", "training", "evaluating"].includes(run.status);

  return (
    <div className="flex items-center gap-2">
      {canStart && (
        <button
          onClick={() => updateStatus("collecting")}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Start Collection
        </button>
      )}

      {run.status === "collecting" && (
        <button
          onClick={() => updateStatus("training")}
          disabled={isLoading}
          className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Start Training
        </button>
      )}

      {run.status === "training" && (
        <button
          onClick={() => updateStatus("evaluating")}
          disabled={isLoading}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Evaluate
        </button>
      )}

      {run.status === "evaluating" && (
        <button
          onClick={() => updateStatus("completed")}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Complete
        </button>
      )}

      {canStop && (
        <button
          onClick={() => updateStatus("failed")}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          Stop
        </button>
      )}

      <button
        onClick={deleteRun}
        disabled={isLoading}
        className="px-4 py-2 text-red-400 hover:text-red-300 transition-colors text-sm"
      >
        Delete
      </button>
    </div>
  );
}

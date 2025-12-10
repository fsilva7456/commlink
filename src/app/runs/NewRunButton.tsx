"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewRunButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("runs")
      .insert({
        name: name.trim(),
        status: "pending",
        config: {
          scenario_id: null,
          model_architecture: "dreamer_v3",
          learning_rate: 0.0001,
          batch_size: 32,
          epochs: 100,
          trajectory_horizon: 10,
        },
      })
      .select()
      .single();

    setIsLoading(false);

    if (error) {
      console.error("Error creating run:", error);
      return;
    }

    setIsOpen(false);
    setName("");
    router.push(`/runs/${data.id}`);
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
      >
        New Run
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-zinc-900 rounded-lg border border-zinc-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">
              Create New Training Run
            </h2>

            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-2">
                Run Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Experiment 1"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={isLoading || !name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

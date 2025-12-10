"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function NewScenarioButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("empty_world");
  const [duration, setDuration] = useState(60);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) return;

    setIsLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("scenarios").insert({
      name: name.trim(),
      environment,
      duration,
      waypoints: [
        { x: 0, y: 0, z: 10 },
        { x: 10, y: 0, z: 10 },
        { x: 10, y: 10, z: 10 },
        { x: 0, y: 10, z: 10 },
        { x: 0, y: 0, z: 10 },
      ],
      config: {
        wind_speed: 0,
        obstacles: false,
      },
    });

    setIsLoading(false);

    if (error) {
      console.error("Error creating scenario:", error);
      return;
    }

    setIsOpen(false);
    setName("");
    router.refresh();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
      >
        New Scenario
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setIsOpen(false)}
          />
          <div className="relative bg-zinc-900 rounded-lg border border-zinc-800 p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">
              Create New Scenario
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Scenario Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Square Pattern"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Environment
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="empty_world">Empty World</option>
                  <option value="urban">Urban</option>
                  <option value="forest">Forest</option>
                  <option value="warehouse">Warehouse</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 60)}
                  min={10}
                  max={600}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
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

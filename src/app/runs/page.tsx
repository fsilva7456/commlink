import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { NewRunButton } from "./NewRunButton";
import type { Run } from "@/types";

export default async function RunsPage() {
  const supabase = await createClient();

  const { data: runs } = await supabase
    .from("runs")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Training Runs</h1>
          <p className="text-zinc-400 mt-1">Manage data collection and training</p>
        </div>
        <NewRunButton />
      </div>

      {runs && runs.length > 0 ? (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Name</th>
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Status</th>
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Created</th>
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Updated</th>
                <th className="text-right text-sm font-medium text-zinc-400 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {runs.map((run: Run) => (
                <tr key={run.id} className="hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <Link href={`/runs/${run.id}`} className="font-medium text-white hover:text-blue-400">
                      {run.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(run.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(run.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/runs/${run.id}`}
                      className="text-sm text-blue-400 hover:text-blue-300"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
            </svg>
          </div>
          <h3 className="text-white font-medium">No training runs yet</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Create your first run to start collecting data and training
          </p>
        </div>
      )}
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

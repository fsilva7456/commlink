import Link from "next/link";
import { getModels } from "@/lib/data";
import type { Model, Run } from "@/types";

export default async function ModelsPage() {
  const models = await getModels();

  // Find best model by eval_score
  const bestModel = models.reduce((best: Model | null, current: Model) => {
    if (current.eval_score === null) return best;
    if (best === null || best.eval_score === null) return current;
    return current.eval_score < best.eval_score ? current : best;
  }, null);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Models</h1>
        <p className="text-zinc-400 mt-1">Trained world model checkpoints</p>
      </div>

      {/* Best Model Highlight */}
      {bestModel && (
        <div className="mb-8 bg-gradient-to-r from-green-900/20 to-zinc-900 rounded-lg border border-green-800/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            <span className="text-green-400 font-medium">Best Model</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Version {bestModel.version}</p>
              <p className="text-sm text-zinc-400">
                Trajectory MSE: {bestModel.eval_score?.toFixed(4)}
              </p>
            </div>
            <Link
              href={`/runs/${bestModel.run_id}`}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              View Run
            </Link>
          </div>
        </div>
      )}

      {models.length > 0 ? (
        <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Version</th>
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Run</th>
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Eval Score (MSE)</th>
                <th className="text-left text-sm font-medium text-zinc-400 px-4 py-3">Created</th>
                <th className="text-right text-sm font-medium text-zinc-400 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {models.map((model: Model & { runs: Pick<Run, 'id' | 'name'> }) => (
                <tr key={model.id} className="hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">v{model.version}</span>
                      {bestModel?.id === model.id && (
                        <span className="px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded text-xs">
                          Best
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/runs/${model.run_id}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {model.runs?.name || "Unknown"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {model.eval_score !== null ? (
                      <span className="text-white">{model.eval_score.toFixed(4)}</span>
                    ) : (
                      <span className="text-zinc-500">Not evaluated</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400">
                    {new Date(model.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={model.checkpoint_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-zinc-400 hover:text-white"
                    >
                      Download
                    </a>
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <h3 className="text-white font-medium">No models yet</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Train your first model to see it here
          </p>
          <Link
            href="/runs"
            className="mt-4 inline-block text-sm text-blue-400 hover:text-blue-300"
          >
            Start a training run
          </Link>
        </div>
      )}

      {/* Model Comparison Info */}
      <div className="mt-8 bg-zinc-900 rounded-lg border border-zinc-800 p-4">
        <h3 className="font-medium text-white mb-2">About Model Evaluation</h3>
        <p className="text-sm text-zinc-400">
          Models are evaluated using Trajectory MSE (Mean Squared Error) which measures how accurately
          the model predicts future drone positions. Lower scores indicate better performance.
          The best model is automatically highlighted above.
        </p>
      </div>
    </div>
  );
}

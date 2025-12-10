import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  // Test the connection by checking if we can reach Supabase
  let connectionStatus: "connected" | "error" | "not_configured" = "not_configured";
  let errorMessage = "";

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    try {
      // Simple health check - get the current timestamp from Supabase
      const { error } = await supabase.from("_health_check").select("*").limit(1);

      // A 404/relation not found error actually means we connected successfully
      // (the table doesn't exist, but we reached the server)
      if (!error || error.code === "PGRST116" || error.code === "42P01") {
        connectionStatus = "connected";
      } else {
        connectionStatus = "error";
        errorMessage = error.message;
      }
    } catch (e) {
      connectionStatus = "error";
      errorMessage = e instanceof Error ? e.message : "Unknown error";
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main className="flex flex-col items-center gap-8 p-8">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50">
          Commlink
        </h1>

        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
            Infrastructure Status
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-zinc-700 dark:text-zinc-300">
                Next.js (Vercel) - Running
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  connectionStatus === "connected"
                    ? "bg-green-500"
                    : connectionStatus === "error"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }`}
              />
              <span className="text-zinc-700 dark:text-zinc-300">
                Supabase -{" "}
                {connectionStatus === "connected"
                  ? "Connected"
                  : connectionStatus === "error"
                  ? "Error"
                  : "Not Configured"}
              </span>
            </div>
          </div>

          {connectionStatus === "not_configured" && (
            <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
              <p className="font-medium">Configuration Required</p>
              <p className="mt-1">
                Add your Supabase credentials to <code className="rounded bg-yellow-100 px-1 dark:bg-yellow-900/40">.env.local</code>:
              </p>
              <pre className="mt-2 overflow-x-auto text-xs">
{`NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
              </pre>
            </div>
          )}

          {connectionStatus === "error" && errorMessage && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              <p className="font-medium">Connection Error</p>
              <p className="mt-1">{errorMessage}</p>
            </div>
          )}

          {connectionStatus === "connected" && (
            <div className="mt-4 rounded-md bg-green-50 p-3 text-sm text-green-800 dark:bg-green-900/20 dark:text-green-200">
              <p className="font-medium">Ready to go!</p>
              <p className="mt-1">
                Your Vercel frontend is connected to Supabase.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

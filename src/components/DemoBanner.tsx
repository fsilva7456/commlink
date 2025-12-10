"use client";

import { useState } from "react";

interface DemoBannerProps {
  isDemo: boolean;
}

export function DemoBanner({ isDemo }: DemoBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!isDemo || dismissed) {
    return null;
  }

  return (
    <div className="bg-yellow-900/30 border-b border-yellow-800/50 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-sm text-yellow-200">
            <strong>Demo Mode</strong> - Showing sample data. Connect Supabase in{" "}
            <code className="bg-yellow-900/50 px-1 rounded">.env.local</code> for full functionality.
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-yellow-400 hover:text-yellow-300 p-1"
          aria-label="Dismiss"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

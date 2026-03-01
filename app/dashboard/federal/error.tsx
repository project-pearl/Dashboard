'use client';

import { useEffect } from 'react';

export default function FederalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Federal Dashboard] Unhandled error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-6 text-center">
      <div className="text-4xl">⚠️</div>
      <h2 className="text-lg font-semibold text-slate-800">
        Something went wrong loading the Federal Dashboard
      </h2>
      <p className="text-sm text-slate-500 max-w-md">
        {error.message || 'An unexpected error occurred.'}
        {error.digest && (
          <span className="block mt-1 text-xs text-slate-400">
            Error ID: {error.digest}
          </span>
        )}
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

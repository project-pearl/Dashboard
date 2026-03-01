'use client';

/**
 * CacheAgeBadge — Inline badge showing data freshness with "Update Now" button.
 *
 * - Green dot + "2h ago" when fresh
 * - Yellow dot + "3 days old" when stale
 * - Spinner + "Refreshing..." during refresh
 * - "Update Now" button (disabled during refresh)
 */

import React from 'react';
import { RefreshCw } from 'lucide-react';

interface CacheAgeBadgeProps {
  fetchedAt?: string;
  ageLabel?: string;
  isStale?: boolean;
  refreshInProgress?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function CacheAgeBadge({
  fetchedAt,
  ageLabel,
  isStale = false,
  refreshInProgress = false,
  onRefresh,
  className = '',
}: CacheAgeBadgeProps) {
  if (!fetchedAt && !refreshInProgress) return null;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${className}`}>
      {refreshInProgress ? (
        <>
          <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />
          <span className="text-blue-400">Refreshing...</span>
        </>
      ) : (
        <>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isStale ? 'bg-yellow-400' : 'bg-emerald-400'
            }`}
          />
          <span className={isStale ? 'text-yellow-400/80' : 'text-slate-500'}>
            {ageLabel || 'cached'}
          </span>
        </>
      )}

      {onRefresh && (
        <button
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          disabled={refreshInProgress}
          className="ml-1 text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          title="Refresh data now"
        >
          {!refreshInProgress && <RefreshCw className="w-3 h-3" />}
        </button>
      )}
    </span>
  );
}

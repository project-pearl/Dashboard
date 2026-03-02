'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { useCacheStatus } from '@/hooks/useCacheStatus';

/**
 * Subtle footer showing when dashboard data was last refreshed.
 * Pulls the most recent cache build timestamp from the cache-status API.
 */
export function DataFreshnessFooter() {
  const { data, isLoading } = useCacheStatus();

  // Find the most recent ageHours across all caches (smallest = most recent build)
  let mostRecentLabel = '';
  if (data?.caches) {
    let minAge = Infinity;
    for (const cache of Object.values(data.caches)) {
      if (cache.ageHours !== null && cache.ageHours < minAge) {
        minAge = cache.ageHours;
      }
    }
    if (minAge < Infinity) {
      if (minAge < 1) mostRecentLabel = 'less than 1 hour ago';
      else if (minAge < 24) mostRecentLabel = `${Math.round(minAge)}h ago`;
      else mostRecentLabel = `${Math.round(minAge / 24)}d ago`;
    }
  }

  // Also show the response timestamp as an absolute time
  const responseTime = data?.timestamp
    ? new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;
  const responseDate = data?.timestamp
    ? new Date(data.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  const loaded = data?.summary?.loaded ?? 0;
  const total = data?.summary?.total ?? 0;

  if (isLoading || !data) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-slate-400">
      <Clock className="w-3 h-3" />
      <span>
        Data as of {responseDate} {responseTime} EST
        {mostRecentLabel && <> · Last pipeline refresh: {mostRecentLabel}</>}
        {total > 0 && <> · {loaded}/{total} sources active</>}
      </span>
    </div>
  );
}

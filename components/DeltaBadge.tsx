'use client';

import React from 'react';
import type { CacheDelta } from '@/lib/cacheUtils';

interface DeltaBadgeProps {
  delta: CacheDelta | null | undefined;
  countKey?: string;
}

export function DeltaBadge({ delta, countKey }: DeltaBadgeProps) {
  if (!delta) {
    return (
      <span className="inline-flex items-center text-2xs px-1.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
        —
      </span>
    );
  }

  if (!delta.dataChanged) return null;

  let totalDiff = 0;
  if (countKey && delta.counts[countKey]) {
    totalDiff = delta.counts[countKey].diff;
  } else {
    for (const { diff } of Object.values(delta.counts)) {
      totalDiff += diff;
    }
  }

  if (totalDiff === 0) return null;

  const isPositive = totalDiff > 0;
  const isMixed = Object.values(delta.counts).some(c => c.diff > 0) &&
                  Object.values(delta.counts).some(c => c.diff < 0);

  let colorClasses: string;
  let label: string;

  if (isMixed && !countKey) {
    colorClasses = 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400';
    label = `~${Math.abs(totalDiff).toLocaleString()}`;
  } else if (isPositive) {
    colorClasses = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400';
    label = `+${totalDiff.toLocaleString()}`;
  } else {
    colorClasses = 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400';
    label = `−${Math.abs(totalDiff).toLocaleString()}`;
  }

  return (
    <span className={`inline-flex items-center text-2xs px-1.5 py-0.5 rounded-full font-semibold ${colorClasses}`}>
      {label}
    </span>
  );
}

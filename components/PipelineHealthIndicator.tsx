'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Radio, X } from 'lucide-react';
import { useCacheStatus } from '@/hooks/useCacheStatus';
import { CACHE_META } from '@/lib/cacheDeltaDescriber';

// ── PipelineHealthIndicator (replaces static "Live Data" pill) ──────────

export function PipelineHealthIndicator() {
  const { pipelineHealth, isLoading } = useCacheStatus();
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPopover]);

  if (isLoading) {
    return (
      <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500">
        <Radio className="w-3 h-3 animate-pulse" />
        <span className="font-semibold">Loading...</span>
      </div>
    );
  }

  const { fresh, stale, pending } = pipelineHealth;
  const total = fresh.length + stale.length + pending.length;
  const stalePct = total > 0 ? Math.round((stale.length / total) * 100) : 0;

  // Color logic
  let dotColor: string;
  let textColor: string;
  let bgColor: string;
  let borderColor: string;

  if (stalePct > 30) {
    dotColor = 'bg-red-500';
    textColor = 'text-red-600 dark:text-red-400';
    bgColor = 'bg-red-50 dark:bg-red-500/10';
    borderColor = 'border-red-200 dark:border-red-500/20';
  } else if (stale.length > 0 || pending.length > 2) {
    dotColor = 'bg-amber-500';
    textColor = 'text-amber-600 dark:text-amber-400';
    bgColor = 'bg-amber-50 dark:bg-amber-500/10';
    borderColor = 'border-amber-200 dark:border-amber-500/20';
  } else {
    dotColor = 'bg-emerald-500';
    textColor = 'text-emerald-600 dark:text-emerald-400';
    bgColor = 'bg-emerald-50 dark:bg-emerald-500/10';
    borderColor = 'border-emerald-200 dark:border-emerald-500/20';
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        className={`hidden sm:flex items-center gap-1.5 text-xs ${textColor} ${bgColor} px-2.5 py-1 rounded-full border ${borderColor} cursor-pointer hover:opacity-80 transition-opacity`}
        onClick={() => setShowPopover(!showPopover)}
      >
        <span className={`w-2 h-2 rounded-full ${dotColor} ${stale.length === 0 && pending.length === 0 ? 'animate-pulse' : ''}`} />
        <span className="font-semibold">{fresh.length}/{total} Fresh</span>
      </button>

      {showPopover && (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-lg border shadow-lg z-50 p-3"
          style={{ background: 'var(--bg-card)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Pipeline Health Breakdown
          </div>

          {/* Fresh */}
          {fresh.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold text-emerald-600 mb-1">
                Fresh ({fresh.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {fresh.map(name => (
                  <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                    {CACHE_META[name]?.friendlyName ?? name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stale */}
          {stale.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-semibold text-red-600 mb-1">
                Stale &gt;48h ({stale.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {stale.map(name => (
                  <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400">
                    {CACHE_META[name]?.friendlyName ?? name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold text-slate-500 mb-1">
                Pending ({pending.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {pending.map(name => (
                  <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                    {CACHE_META[name]?.friendlyName ?? name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── PipelineWarningBanner ───────────────────────────────────────────────

export function PipelineWarningBanner() {
  const { pipelineHealth, isLoading } = useCacheStatus();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;

  const { stale, fresh, pending } = pipelineHealth;
  const total = fresh.length + stale.length + pending.length;
  const stalePct = total > 0 ? Math.round((stale.length / total) * 100) : 0;

  if (stalePct <= 30) return null;

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs bg-amber-50 border-b border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300">
      <span>
        Warning: {stalePct}% of data pipelines are stale (&gt;48h). Some dashboard data may be outdated.
      </span>
      <button onClick={() => setDismissed(true)} className="ml-3 hover:opacity-70">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

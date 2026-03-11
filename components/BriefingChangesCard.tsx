'use client';

import React, { useState } from 'react';
import { Sparkles, ChevronDown, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCacheStatus } from '@/hooks/useCacheStatus';
import { describeDelta, CACHE_META } from '@/lib/cacheDeltaDescriber';
import { DeltaBadge } from './DeltaBadge';
import type { CacheDelta } from '@/lib/cacheUtils';

export function BriefingChangesCard() {
  const { data, isLoading } = useCacheStatus();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Collect caches with actual data changes
  const changedCaches: Array<{ name: string; delta: CacheDelta }> = [];
  let totalRecordDiff = 0;

  if (data?.caches) {
    for (const [name, cache] of Object.entries(data.caches)) {
      const delta = cache.lastDelta;
      if (delta?.dataChanged) {
        changedCaches.push({ name, delta });
        for (const { diff } of Object.values(delta.counts)) {
          totalRecordDiff += diff;
        }
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-600" />
          What Changed Overnight — National
        </CardTitle>
        <CardDescription>Real-time delta data from all cache rebuilds</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-xs text-center py-4" style={{ color: 'var(--text-dim)' }}>
            Loading delta data...
          </div>
        ) : changedCaches.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border p-4" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            <span className="text-xs">All data sources stable — no changes since last refresh.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Summary row */}
            <div className="text-xs mb-3 px-1" style={{ color: 'var(--text-dim)' }}>
              Since last refresh: <strong>{changedCaches.length}</strong> cache{changedCaches.length !== 1 ? 's' : ''} updated,{' '}
              <strong>{totalRecordDiff > 0 ? '+' : ''}{totalRecordDiff.toLocaleString()}</strong> net records changed
            </div>

            {changedCaches.map(({ name, delta }) => {
              const meta = CACHE_META[name];
              const time = new Date(delta.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isExpanded = expandedId === name;

              return (
                <div key={name}>
                  <div
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all"
                    style={{ borderColor: 'var(--border-subtle)' }}
                    onClick={() => setExpandedId(isExpanded ? null : name)}
                  >
                    <span className="text-2xs font-mono whitespace-nowrap mt-0.5" style={{ color: 'var(--text-dim)' }}>
                      {time}
                    </span>
                    <span className="text-xs flex-1" style={{ color: 'var(--text-primary)' }}>
                      {describeDelta(name, delta)}
                    </span>
                    <DeltaBadge delta={delta} />
                    <ChevronDown
                      size={14}
                      className={`flex-shrink-0 transition-transform mt-0.5`}
                      style={{ color: 'var(--text-dim)', transform: isExpanded ? 'rotate(180deg)' : undefined }}
                    />
                  </div>

                  {isExpanded && (
                    <div className="ml-4 mt-1 rounded-lg border p-3" style={{ borderColor: 'var(--accent-purple, #7c3aed)', background: 'var(--bg-card)' }}>
                      {/* Per-count breakdown table */}
                      <table className="w-full text-xs mb-2">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <th className="text-left py-1 font-semibold" style={{ color: 'var(--text-dim)' }}>Metric</th>
                            <th className="text-right py-1 font-semibold" style={{ color: 'var(--text-dim)' }}>Before</th>
                            <th className="text-right py-1 font-semibold" style={{ color: 'var(--text-dim)' }}>After</th>
                            <th className="text-right py-1 font-semibold" style={{ color: 'var(--text-dim)' }}>Diff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(delta.counts).map(([key, { before, after, diff }]) => (
                            <tr key={key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td className="py-1" style={{ color: 'var(--text-primary)' }}>{key}</td>
                              <td className="text-right py-1 font-mono" style={{ color: 'var(--text-secondary)' }}>{before.toLocaleString()}</td>
                              <td className="text-right py-1 font-mono" style={{ color: 'var(--text-secondary)' }}>{after.toLocaleString()}</td>
                              <td className={`text-right py-1 font-mono font-semibold ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-600' : ''}`}>
                                {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* State changes */}
                      {delta.states && (delta.states.added.length > 0 || delta.states.removed.length > 0) && (
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {delta.states.added.length > 0 && (
                            <span className="text-emerald-600">Added: {delta.states.added.join(', ')}</span>
                          )}
                          {delta.states.added.length > 0 && delta.states.removed.length > 0 && ' · '}
                          {delta.states.removed.length > 0 && (
                            <span className="text-red-600">Removed: {delta.states.removed.join(', ')}</span>
                          )}
                        </div>
                      )}

                      {/* Build duration */}
                      {delta.buildDurationSec != null && (
                        <div className="text-2xs mt-1" style={{ color: 'var(--text-dim)' }}>
                          Build time: {delta.buildDurationSec}s · Source: {meta?.agency ?? 'Unknown'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import React from 'react';
import { Clock, AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCacheStatus } from '@/hooks/useCacheStatus';
import { isSignificantSwing } from '@/lib/cacheDeltaDescriber';
import { exportDeltaLog } from '@/lib/cacheUtils';
import { DeltaBadge } from './DeltaBadge';

export function DeltaChangelog() {
  const { data, changelog } = useCacheStatus();

  const handleExport = () => {
    if (!data?.caches) return;
    const snapshot = exportDeltaLog(data.caches);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `delta-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Data Change Log
            </CardTitle>
            <CardDescription>Session-accumulated delta timeline from cache rebuilds</CardDescription>
          </div>
          {changelog.length > 0 && (
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleExport}>
              <Download className="h-3 w-3" />
              Export JSON
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {changelog.length === 0 ? (
          <div className="text-xs text-center py-4" style={{ color: 'var(--text-dim)' }}>
            No delta changes recorded this session.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
            {changelog.map((entry, i) => {
              const significant = isSignificantSwing(entry.delta);
              const time = new Date(entry.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

              return (
                <div
                  key={`${entry.cacheName}-${entry.recordedAt}-${i}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-xs ${
                    significant ? 'border-amber-300 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/5' : ''
                  }`}
                  style={significant ? undefined : { borderColor: 'var(--border-subtle)' }}
                >
                  {significant && <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />}
                  <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: 'var(--text-dim)' }}>
                    {time}
                  </span>
                  <span className="font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                    {entry.friendlyName}
                  </span>
                  <DeltaBadge delta={entry.delta} />
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

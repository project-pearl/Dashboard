/* ------------------------------------------------------------------ */
/*  WeatherAlertsSection — Severe weather alerts panel for FMC        */
/*  Shows count by type, installations with nearby warnings.          */
/* ------------------------------------------------------------------ */

'use client';

import React, { useEffect, useState } from 'react';
import { CloudLightning, AlertTriangle, Loader2 } from 'lucide-react';
import type { NwsAlert } from '@/lib/nwsAlertCache';

interface AlertsByType {
  type: string;
  count: number;
  color: string;
}

function categorizeAlerts(alerts: NwsAlert[]): AlertsByType[] {
  const counts = new Map<string, number>();
  for (const a of alerts) {
    const lower = a.event.toLowerCase();
    let cat = 'Other';
    if (lower.includes('tornado')) cat = 'Tornado';
    else if (lower.includes('severe thunderstorm')) cat = 'Severe Thunderstorm';
    else if (lower.includes('flash flood')) cat = 'Flash Flood';
    else if (lower.includes('hurricane') || lower.includes('tropical')) cat = 'Hurricane/Tropical';
    else if (lower.includes('high wind') || lower.includes('extreme wind')) cat = 'High Wind';
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
  }

  const colorMap: Record<string, string> = {
    Tornado: 'bg-red-500',
    'Severe Thunderstorm': 'bg-amber-500',
    'Flash Flood': 'bg-blue-500',
    'Hurricane/Tropical': 'bg-violet-500',
    'High Wind': 'bg-orange-500',
    Other: 'bg-gray-500',
  };

  return Array.from(counts.entries())
    .map(([type, count]) => ({ type, count, color: colorMap[type] || 'bg-gray-500' }))
    .sort((a, b) => b.count - a.count);
}

export function WeatherAlertsSection() {
  const [alerts, setAlerts] = useState<NwsAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/nws-weather-alerts?severe=true')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.alerts) setAlerts(data.alerts);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <Loader2 size={14} className="animate-spin" />
        Loading severe weather data...
      </div>
    );
  }

  const categories = categorizeAlerts(alerts);

  if (alerts.length === 0) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <div className="flex items-center gap-2">
          <CloudLightning size={14} />
          No active severe weather warnings.
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle size={14} className="text-amber-500" />
        {alerts.length} active severe weather warning{alerts.length !== 1 ? 's' : ''}
      </div>

      {/* Breakdown by type */}
      <div className="grid grid-cols-2 gap-2">
        {categories.map(cat => (
          <div key={cat.type} className="flex items-center gap-2 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full ${cat.color}`} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {cat.type}: <strong>{cat.count}</strong>
            </span>
          </div>
        ))}
      </div>

      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
        Source: NWS Weather Alerts API. Refreshed every 10 min.
      </p>
    </div>
  );
}

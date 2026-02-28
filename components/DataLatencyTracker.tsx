'use client';

import React, { useEffect, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';

interface CacheEntry {
  name: string;
  records: number;
  ageHours: number;
  lastBuilt: string | null;
}

interface CacheStatusResponse {
  caches: Record<string, CacheEntry>;
  timestamp: string;
}

const SOURCE_META: Record<string, { friendlyName: string; agency: string; cadence: string }> = {
  wqp:         { friendlyName: 'Water Quality Portal',     agency: 'EPA / USGS',   cadence: 'Daily' },
  attains:     { friendlyName: 'EPA ATTAINS',              agency: 'EPA',           cadence: 'Daily' },
  nwisGw:      { friendlyName: 'USGS WDFN Groundwater',   agency: 'USGS',          cadence: 'Daily' },
  echo:        { friendlyName: 'EPA ECHO',                 agency: 'EPA',           cadence: 'Weekly' },
  coops:       { friendlyName: 'NOAA CO-OPS Tides',        agency: 'NOAA',          cadence: 'Daily' },
  icis:        { friendlyName: 'ICIS-NPDES Enforcement',   agency: 'EPA',           cadence: 'Daily' },
  sdwis:       { friendlyName: 'SDWIS Drinking Water',     agency: 'EPA',           cadence: 'Daily' },
  stateReport: { friendlyName: 'State Reports',            agency: 'Multi-agency',  cadence: 'Daily' },
  sentinel:    { friendlyName: 'Sentinel Monitoring',      agency: 'PIN',           cadence: 'Hourly' },
  insights:    { friendlyName: 'AI Insights',              agency: 'PIN',           cadence: 'Daily' },
  hucScoring:  { friendlyName: 'HUC-8 Scoring',           agency: 'PIN',           cadence: 'Daily' },
  economyOverlay: { friendlyName: 'Economy Overlay',       agency: 'Census / BLS',  cadence: 'Monthly' },
};

function ageColor(hours: number): string {
  const days = hours / 24;
  if (days < 7) return 'var(--status-healthy, #22c55e)';
  if (days < 30) return '#F9A825';
  if (days < 90) return '#E65100';
  return '#D32F2F';
}

function ageBadgeClass(hours: number): string {
  const days = hours / 24;
  if (days < 7) return 'bg-green-500/10 text-green-600 border-green-500/20';
  if (days < 30) return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  if (days < 90) return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
  return 'bg-red-500/10 text-red-600 border-red-500/20';
}

function formatAge(hours: number): string {
  if (hours < 1) return '<1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export function DataLatencyTracker() {
  const [caches, setCaches] = useState<Record<string, CacheEntry> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cache-status')
      .then(r => r.json())
      .then((data: CacheStatusResponse) => {
        setCaches(data.caches);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" style={{ color: 'var(--text-dim)' }} />
        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Loading data freshness...</div>
      </div>
    );
  }

  if (!caches) {
    return (
      <div className="rounded-lg p-6 text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>Unable to load cache status.</div>
      </div>
    );
  }

  const entries = Object.entries(caches).map(([key, entry]) => ({
    key,
    ...entry,
    meta: SOURCE_META[key],
  })).filter(e => e.meta);

  const avgAge = entries.length > 0
    ? Math.round(entries.reduce((s, e) => s + e.ageHours, 0) / entries.length / 24)
    : 0;

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Data Freshness Tracker</span>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          Across {entries.length} sources, average data age is {avgAge} day{avgAge !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th className="text-left px-4 py-2 font-semibold" style={{ color: 'var(--text-dim)' }}>Source</th>
              <th className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--text-dim)' }}>Agency</th>
              <th className="text-center px-3 py-2 font-semibold" style={{ color: 'var(--text-dim)' }}>Official Cadence</th>
              <th className="text-center px-3 py-2 font-semibold" style={{ color: 'var(--text-dim)' }}>Records</th>
              <th className="text-center px-3 py-2 font-semibold" style={{ color: 'var(--text-dim)' }}>Last Updated</th>
              <th className="text-center px-3 py-2 font-semibold" style={{ color: 'var(--text-dim)' }}>Age</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.key} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-primary)' }}>{e.meta.friendlyName}</td>
                <td className="px-3 py-2.5" style={{ color: 'var(--text-secondary)' }}>{e.meta.agency}</td>
                <td className="px-3 py-2.5 text-center" style={{ color: 'var(--text-dim)' }}>{e.meta.cadence}</td>
                <td className="px-3 py-2.5 text-center font-mono" style={{ color: 'var(--text-secondary)' }}>{e.records.toLocaleString()}</td>
                <td className="px-3 py-2.5 text-center" style={{ color: 'var(--text-dim)' }}>
                  {e.lastBuilt ? new Date(e.lastBuilt).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ageBadgeClass(e.ageHours)}`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: ageColor(e.ageHours) }} />
                    {formatAge(e.ageHours)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 text-[10px]" style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)' }}>
        Color key: <span className="text-green-600">green</span> &lt;7d · <span className="text-amber-600">yellow</span> 7–30d · <span className="text-orange-600">orange</span> 30–90d · <span className="text-red-600">red</span> &gt;90d
      </div>
    </div>
  );
}

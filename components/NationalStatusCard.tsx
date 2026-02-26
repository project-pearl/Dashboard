// components/NationalStatusCard.tsx
// National Water Quality Status — tells one story in three layers:
// scope, health (TMDL gap), and action (high-alert states + operational).

'use client';

import { useEffect, useState } from 'react';
import type { NationalSummary } from '@/lib/national-summary';

// ── Relative-time helper ─────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? 's' : ''} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 min

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  /** Pre-fetched summary from parent (used as initial data, then self-refreshes) */
  summary: NationalSummary | null;
}

// ── Tooltip wrapper ──────────────────────────────────────────────────────────

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="group relative">
      {children}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-md text-[11px] leading-tight whitespace-normal max-w-[220px] text-center opacity-0 group-hover:opacity-100 transition-opacity z-50"
        style={{ background: 'var(--bg-tooltip, #1e293b)', color: 'var(--text-tooltip, #f8fafc)' }}
      >
        {text}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-xl p-5 space-y-5 animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}>
      <div className="space-y-2">
        <div className="h-4 w-56 rounded" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-3 w-40 rounded" style={{ background: 'var(--border-subtle)' }} />
      </div>
      <div className="space-y-3">
        <div className="h-8 w-48 rounded" style={{ background: 'var(--border-subtle)' }} />
        <div className="h-3 rounded-full" style={{ background: 'var(--border-subtle)' }} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-20 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
          ))}
        </div>
      </div>
      <div className="h-16 rounded-lg" style={{ background: 'var(--border-subtle)' }} />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function NationalStatusCard({ summary: initialSummary }: Props) {
  const [data, setData] = useState<NationalSummary | null>(initialSummary);

  // Sync when parent provides fresh data
  useEffect(() => {
    if (initialSummary) setData(initialSummary);
  }, [initialSummary]);

  // Self-refresh every 5 minutes
  useEffect(() => {
    const tick = async () => {
      try {
        const res = await fetch('/api/national-summary');
        if (res.ok) setData(await res.json());
      } catch { /* silent — will retry next interval */ }
    };
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  if (!data) return <Skeleton />;

  const {
    totalWaterbodies,
    totalImpaired,
    totalHealthy,
    tmdlGap,        // impaired with NO TMDL (Cat 5)
    tmdlCompleted,  // impaired with TMDL (Cat 4a)
    tmdlAlternative, // impaired with alt controls (Cat 4b)
    statesReporting,
    realtimeSites,
    activeAlerts,
    worstStates,
    generatedAt,
  } = data;

  // Derive the four health-cascade buckets
  const good = totalHealthy;
  const watchList = Math.max(0, totalImpaired - tmdlGap - tmdlCompleted - tmdlAlternative);
  const impairedWithTmdl = tmdlCompleted + tmdlAlternative;
  const impairedNoTmdl = tmdlGap;

  // Impairment ratio
  const impairmentPct = totalWaterbodies > 0
    ? Math.round((totalImpaired / totalWaterbodies) * 100)
    : 0;

  // TMDL gap ratio
  const tmdlGapPct = totalImpaired > 0
    ? Math.round((impairedNoTmdl / totalImpaired) * 100)
    : 0;

  // High-alert states (top 3 + overflow)
  const topAlert = worstStates.slice(0, 3);
  const remaining = Math.max(0, worstStates.length - 3);

  // Unassessed footnote
  const accounted = good + watchList + impairedWithTmdl + impairedNoTmdl;
  const unaccounted = Math.max(0, totalWaterbodies - accounted);

  return (
    <div
      id="section-situation"
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)' }}
    >
      {/* ── Header ── */}
      <div className="px-5 pt-4 pb-3">
        <h3 className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-bright)' }}>
          National Water Quality Status
        </h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
          Live intelligence across {statesReporting} reporting state{statesReporting !== 1 ? 's' : ''}
          {generatedAt && <> &middot; Updated {timeAgo(generatedAt)}</>}
        </p>
      </div>

      {/* ── LAYER 1: Scope ── */}
      <div className="px-5 pb-4 space-y-4">
        {/* Headline number */}
        <div>
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--text-bright)' }}>
            {totalWaterbodies.toLocaleString()}
          </span>
          <span className="text-sm ml-1.5" style={{ color: 'var(--text-dim)' }}>waterbodies tracked</span>
        </div>

        {/* Impairment progress bar */}
        <div className="space-y-1">
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, #e5e7eb)' }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${impairmentPct}%`, background: '#EF4444' }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span style={{ color: 'var(--text-dim)' }}>
              <span className="font-semibold" style={{ color: '#EF4444' }}>{impairmentPct}%</span> impaired
            </span>
            <span style={{ color: 'var(--text-dim)' }}>
              {totalImpaired.toLocaleString()} of {totalWaterbodies.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Four health-cascade boxes */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Tip text="Waterbodies meeting designated uses under CWA assessment">
            <HealthBox label="Good Standing" count={good} color="#22C55E" />
          </Tip>
          <Tip text="Waterbodies showing declining trends or threatened status, not yet formally impaired">
            <HealthBox label="Watch List" count={watchList} color="#F59E0B" />
          </Tip>
          <Tip text="CWA Categories 4a/4b — impaired with Total Maximum Daily Load established">
            <HealthBox label="Impaired — TMDL Set" count={impairedWithTmdl} color="#F97316" />
          </Tip>
          <Tip text="CWA Category 5 — impaired, requires TMDL development">
            <HealthBox label="Impaired — No TMDL" count={impairedNoTmdl} color="#EF4444" />
          </Tip>
        </div>

        {unaccounted > 0 && (
          <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
            * {unaccounted.toLocaleString()} waterbodies not yet categorized or pending assessment
          </p>
        )}
      </div>

      {/* ── LAYER 2: The Punchline (TMDL gap) ── */}
      <div className="mx-5 mb-4 rounded-lg px-4 py-3" style={{ background: 'var(--bg-surface, var(--bg-card))', border: '1px solid var(--border-subtle)' }}>
        <Tip text="Percentage of impaired waterbodies without a federal remediation plan (TMDL)">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>
              {tmdlGapPct}% of impaired waterbodies have no remediation plan
            </p>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bar-track, #e5e7eb)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${tmdlGapPct}%`, background: '#EF4444' }}
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
              {impairedNoTmdl.toLocaleString()} of {totalImpaired.toLocaleString()} impaired lack a TMDL
            </p>
          </div>
        </Tip>
      </div>

      {/* ── LAYER 3: High Alert States ── */}
      {topAlert.length > 0 && (
        <div className="px-5 pb-3">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-dim)' }}>
            High Alert
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {topAlert.map(s => (
              <div
                key={s.abbr}
                className="rounded-lg px-3 py-2 text-center min-w-[56px]"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <div className="text-xs font-bold" style={{ color: '#EF4444' }}>{s.abbr}</div>
                <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-dim)' }}>{s.score}</div>
              </div>
            ))}
            {remaining > 0 && (
              <span className="text-xs" style={{ color: 'var(--text-dim)' }}>+ {remaining} more</span>
            )}
          </div>
        </div>
      )}

      {/* ── Footer: Operational stats ── */}
      <div
        className="flex items-center justify-between gap-4 px-5 py-2.5 text-xs flex-wrap"
        style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}
      >
        <Tip text="Total threshold exceedances, violations, and watch-level events across all monitored sources">
          <span className="tabular-nums">{activeAlerts.toLocaleString()} active alerts</span>
        </Tip>
        <Tip text="Waterbodies with active USGS NWIS-IV sensor monitoring">
          <span className="tabular-nums">{realtimeSites.toLocaleString()} real-time sites</span>
        </Tip>
        <span className="tabular-nums">{statesReporting}/51 reporting</span>
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function HealthBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      className="rounded-lg px-3 py-3 text-center"
      style={{ background: `${color}0A`, border: `1px solid ${color}30` }}
    >
      <div className="text-lg font-bold tabular-nums" style={{ color }}>{count.toLocaleString()}</div>
      <div className="text-[11px] mt-0.5 leading-tight" style={{ color: 'var(--text-dim)' }}>{label}</div>
      <div className="mt-1.5 mx-auto w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
    </div>
  );
}

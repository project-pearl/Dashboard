/* ------------------------------------------------------------------ */
/*  WeatherAlertsSection — Severe weather warnings card                */
/*  Role-aware: Federal sees national, State/Local/MS4 sees their     */
/*  state only.  Shows top-5 per category with expandable dropdown.   */
/* ------------------------------------------------------------------ */

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CloudLightning,
  HelpCircle,
  Loader2,
  MapPin,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NwsAlert } from '@/lib/nwsAlertCache';

/* ── Props ─────────────────────────────────────────────────────────── */

interface Props {
  /** 2-letter state code. When set, only that state's alerts are shown.
   *  `undefined` = show all (Federal national view). */
  userState?: string;
}

/* ── Helpers ────────────────────────────────────────────────────────── */

const CATEGORY_META: Record<string, { label: string; dot: string; border: string }> = {
  Tornado:              { label: 'Tornado',              dot: 'bg-red-500',    border: 'border-l-red-500' },
  'Severe Thunderstorm':{ label: 'Severe Thunderstorm',  dot: 'bg-amber-500',  border: 'border-l-amber-500' },
  'Flash Flood':        { label: 'Flash Flood',          dot: 'bg-blue-500',   border: 'border-l-blue-500' },
  'Hurricane/Tropical': { label: 'Hurricane / Tropical', dot: 'bg-violet-500', border: 'border-l-violet-500' },
  'High Wind':          { label: 'High Wind',            dot: 'bg-orange-500', border: 'border-l-orange-500' },
  Other:                { label: 'Other Severe',         dot: 'bg-gray-500',   border: 'border-l-gray-500' },
};

function categorize(event: string): string {
  const e = event.toLowerCase();
  if (e.includes('tornado')) return 'Tornado';
  if (e.includes('severe thunderstorm')) return 'Severe Thunderstorm';
  if (e.includes('flash flood')) return 'Flash Flood';
  if (e.includes('hurricane') || e.includes('tropical')) return 'Hurricane/Tropical';
  if (e.includes('high wind') || e.includes('extreme wind')) return 'High Wind';
  return 'Other';
}

interface CategoryGroup {
  category: string;
  alerts: NwsAlert[];
}

function groupByCategory(alerts: NwsAlert[]): CategoryGroup[] {
  const map = new Map<string, NwsAlert[]>();
  for (const a of alerts) {
    const cat = categorize(a.event);
    const arr = map.get(cat) ?? [];
    arr.push(a);
    map.set(cat, arr);
  }
  return Array.from(map.entries())
    .map(([category, items]) => ({ category, alerts: items }))
    .sort((a, b) => b.alerts.length - a.alerts.length);
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60_000);
  if (mins < 0) return 'expired';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

const PREVIEW_COUNT = 3;

/* ── Component ──────────────────────────────────────────────────────── */

export function WeatherAlertsSection({ userState }: Props) {
  const [raw, setRaw] = useState<NwsAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const qs = userState
      ? `severe=true&state=${encodeURIComponent(userState)}`
      : 'severe=true';
    fetch(`/api/nws-weather-alerts?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.alerts) setRaw(data.alerts);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userState]);

  const groups = useMemo(() => groupByCategory(raw), [raw]);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const toggle = (cat: string) =>
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  /* ── Loading ───────────────────────────────────────────────────── */
  if (isLoading) {
    return (
      <Card className="border" style={{ borderColor: 'var(--border-primary)' }}>
        <CardContent className="flex items-center gap-2 py-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={14} className="animate-spin" />
          Loading severe weather data{userState ? ` for ${userState}` : ''}...
        </CardContent>
      </Card>
    );
  }

  /* ── Empty ─────────────────────────────────────────────────────── */
  if (raw.length === 0) {
    return (
      <Card className="border" style={{ borderColor: 'var(--border-primary)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <CloudLightning size={16} className="text-slate-400" />
            Severe Weather Warnings
            {userState && (
              <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>
                {userState}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No active severe weather warnings{userState ? ` in ${userState}` : ''}.
        </CardContent>
      </Card>
    );
  }

  /* ── Active warnings ───────────────────────────────────────────── */
  return (
    <Card className="border border-gray-200/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <AlertTriangle size={18} className="text-amber-500" />
            Severe Weather Warnings
            <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {raw.length}
            </span>
            {userState && (
              <span className="ml-auto text-xs font-normal px-2 py-0.5 rounded-full" style={{ background: 'var(--surface-secondary)', color: 'var(--text-secondary)' }}>
                {userState}
              </span>
            )}
          </CardTitle>
          <button className="p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm hover:bg-slate-50 transition-colors" title="Active severe weather warnings from the NWS Weather Alerts API. Categories include tornado, severe thunderstorm, flash flood, hurricane, and high wind events. Refreshed every 10 minutes.">
            <HelpCircle size={16} className="text-slate-400" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {groups.map(({ category, alerts }) => {
          const meta = CATEGORY_META[category] ?? CATEGORY_META.Other;
          const expanded = expandedCats.has(category);
          const shown = expanded ? alerts : alerts.slice(0, PREVIEW_COUNT);
          const hasMore = alerts.length > PREVIEW_COUNT;

          return (
            <div key={category} className="space-y-1">
              {/* Category header */}
              <button
                type="button"
                onClick={() => toggle(category)}
                className="w-full flex items-center gap-2 text-sm font-semibold py-1 px-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                style={{ color: 'var(--text-primary)' }}
              >
                <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                {meta.label}
                <span className="font-bold" style={{ color: 'var(--text-secondary)' }}>
                  ({alerts.length})
                </span>
                <span className="ml-auto">
                  {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </span>
              </button>

              {/* Alert rows */}
              <div className={`space-y-1 pl-1 ${expanded ? 'max-h-[200px] overflow-y-auto' : ''}`}>
                {shown.map((a) => (
                  <div
                    key={a.id}
                    className={`text-xs rounded-md border-l-2 px-2.5 py-1.5 ${meta.border}`}
                    style={{ background: 'var(--surface-secondary)' }}
                  >
                    <div className="flex items-start gap-1.5">
                      <span className="font-medium flex-1 leading-snug" style={{ color: 'var(--text-primary)' }}>
                        {a.headline || a.event}
                      </span>
                      {a.expires && (
                        <span
                          className="shrink-0 flex items-center gap-0.5 tabular-nums"
                          style={{ color: 'var(--text-tertiary)' }}
                          title={`Expires: ${new Date(a.expires).toLocaleString()}`}
                        >
                          <Clock size={10} />
                          {relativeTime(a.expires)}
                        </span>
                      )}
                    </div>
                    {a.areaDesc && (
                      <div className="flex items-center gap-1 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{a.areaDesc}</span>
                      </div>
                    )}
                  </div>
                ))}

                {/* Show more / show less toggle */}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => toggle(category)}
                    className="text-xs px-2 py-0.5 rounded hover:underline"
                    style={{ color: 'var(--text-link, var(--text-secondary))' }}
                  >
                    {expanded
                      ? 'Show less'
                      : `Show ${alerts.length - PREVIEW_COUNT} more...`}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Footer */}
        <p className="text-2xs pt-1" style={{ color: 'var(--text-tertiary)' }}>
          Source: NWS Weather Alerts API. Refreshed every 10 min.
        </p>
      </CardContent>
    </Card>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, CheckCircle, Flame, Wind, Flag, Shield } from 'lucide-react';
import { CappedList } from '@/components/CappedList';

interface InstRisk {
  id: string;
  name: string;
  branch: string;
  region: string;
  type: 'installation' | 'embassy';
  burnPitHistory: boolean;
  fireScore: number;
  aqiScore: number;
  burnPitScore: number;
  windScore: number;
  droughtScore: number;
  seismicScore: number;
  damScore: number;
  composite: number;
  nearestFireDist: number | null;
  nearestFireFrp: number | null;
  aqiValue: number | null;
  windContext: string | null;
  droughtLevel: string | null;
  nearestQuakeDist: number | null;
  nearestQuakeMag: number | null;
  nearestDamDist: number | null;
  nearestDamName: string | null;
}

interface NtasData {
  status: 'none' | 'bulletin' | 'elevated' | 'imminent';
  fetchedAt: string;
}

const REGION_LABELS: Record<string, string> = {
  'middle-east': 'CENTCOM',
  'conus': 'CONUS',
  'indo-pacific': 'INDOPACOM',
  'europe': 'EUCOM',
  'africa': 'AFRICOM',
};

const NTAS_PILL: Record<string, { label: string; color: string; bg: string }> = {
  bulletin: { label: 'NTAS Bulletin', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  elevated: { label: 'NTAS Elevated', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  imminent: { label: 'NTAS Imminent', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

function rowBorderColor(score: number): string {
  if (score >= 75) return '#ef4444';
  if (score >= 50) return '#f59e0b';
  return '#eab308';
}

function compositeBadgeClass(score: number): string {
  if (score >= 75) return 'bg-red-100 text-red-800';
  if (score >= 50) return 'bg-amber-100 text-amber-800';
  return 'bg-yellow-100 text-yellow-800';
}

export function AtRiskFacilitiesCard() {
  const [facilities, setFacilities] = useState<InstRisk[]>([]);
  const [total, setTotal] = useState(0);
  const [ntas, setNtas] = useState<NtasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch('/api/fire-aq/installation-risk?elevated=true')
        .then(r => r.ok ? r.json() : null),
      fetch('/api/ntas')
        .then(r => r.ok ? r.json() : null),
    ])
      .then(([riskJson, ntasJson]) => {
        if (cancelled) return;
        if (riskJson) {
          setFacilities(riskJson.installations || []);
          setTotal(riskJson.total || 0);
          setFetchedAt(new Date().toISOString());
        }
        if (ntasJson) setNtas(ntasJson);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert size={16} className="text-amber-600" />
            At-Risk Installations &amp; Embassies
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Loading facility risk data...</div>
        </CardContent>
      </Card>
    );
  }

  // Empty state — all clear
  if (facilities.length === 0) {
    return (
      <Card style={{ border: '1px solid rgba(34,197,94,0.25)', background: 'rgba(34,197,94,0.06)' }}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldAlert size={16} className="text-green-600" />
            At-Risk Installations &amp; Embassies
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {ntas && ntas.status !== 'none' && (
            <div className="mb-2">
              <span
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold"
                style={{ color: NTAS_PILL[ntas.status]?.color, background: NTAS_PILL[ntas.status]?.bg }}
              >
                {NTAS_PILL[ntas.status]?.label}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm text-green-700 font-medium">
              All facilities operating within normal environmental parameters.
            </span>
          </div>
          <div className="text-2xs text-right" style={{ color: 'var(--text-dim)' }}>
            0 of {total} facilities at elevated risk
            {fetchedAt && <> &middot; {new Date(fetchedAt).toLocaleString()}</>}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <ShieldAlert size={16} className="text-amber-600" />
          At-Risk Installations &amp; Embassies
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {/* NTAS pill */}
        {ntas && ntas.status !== 'none' && (
          <div className="mb-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold"
              style={{ color: NTAS_PILL[ntas.status]?.color, background: NTAS_PILL[ntas.status]?.bg }}
            >
              {NTAS_PILL[ntas.status]?.label}
            </span>
          </div>
        )}

        {/* Facility rows */}
        <CappedList
          items={facilities}
          maxVisible={5}
          searchable={facilities.length > 5}
          searchPlaceholder="Search facilities..."
          getSearchText={(f) => `${f.name} ${f.branch} ${REGION_LABELS[f.region] || f.region}`}
          getKey={(f) => f.id}
          className="space-y-1.5"
          renderItem={(f) => (
            <div
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs"
              style={{
                borderLeft: `4px solid ${rowBorderColor(f.composite)}`,
                background: 'var(--bg-secondary, rgba(0,0,0,0.02))',
              }}
            >
              {/* Icon */}
              {f.type === 'embassy'
                ? <Flag size={13} className="text-blue-500 shrink-0" />
                : <Shield size={13} className="text-slate-500 shrink-0" />
              }

              {/* Name / branch / region */}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate" style={{ color: 'var(--text-bright)' }}>
                  {f.name}
                </div>
                <div className="text-2xs" style={{ color: 'var(--text-dim)' }}>
                  {f.branch} &middot; {REGION_LABELS[f.region] || f.region}
                </div>
              </div>

              {/* Threat chips */}
              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                {f.fireScore > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-medium bg-orange-100 text-orange-700">
                    <Flame size={9} />
                    {f.nearestFireDist != null ? `${f.nearestFireDist} mi` : 'nearby'}
                  </span>
                )}
                {f.aqiScore > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-medium bg-purple-100 text-purple-700">
                    <Wind size={9} />
                    AQI {f.aqiValue}
                  </span>
                )}
                {f.burnPitScore > 0 && (
                  <Badge variant="outline" className="text-2xs px-1 py-0 bg-red-50 text-red-600 border-red-200">
                    BP
                  </Badge>
                )}
                {f.windContext && f.windScore > 0 && (
                  <span className="text-2xs px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">
                    {f.windContext}
                  </span>
                )}
                {f.droughtScore > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-medium bg-orange-100 text-orange-800">
                    {f.droughtLevel || 'Drought'}
                  </span>
                )}
                {f.seismicScore > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-medium bg-slate-100 text-slate-800">
                    M{f.nearestQuakeMag} {f.nearestQuakeDist != null ? `${f.nearestQuakeDist} mi` : ''}
                  </span>
                )}
                {f.damScore > 0 && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-2xs font-medium bg-cyan-100 text-cyan-800">
                    Dam {f.nearestDamDist != null ? `${f.nearestDamDist} mi` : 'nearby'}
                  </span>
                )}
              </div>

              {/* Composite badge */}
              <Badge variant="outline" className={`font-mono text-2xs shrink-0 ${compositeBadgeClass(f.composite)}`}>
                {f.composite}
              </Badge>
            </div>
          )}
        />

        {/* Footer */}
        <div className="text-2xs text-right pt-1" style={{ color: 'var(--text-dim)' }}>
          {facilities.length} of {total} facilities at elevated risk
          {fetchedAt && <> &middot; {new Date(fetchedAt).toLocaleString()}</>}
        </div>
      </CardContent>
    </Card>
  );
}

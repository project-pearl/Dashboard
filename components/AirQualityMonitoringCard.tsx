'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Wind, MapPin, Activity, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useJurisdictionContext } from '@/lib/jurisdiction-context';

type AirQualityReading = {
  state: string;
  timestamp: string | null;
  provider: 'airnow' | 'open-meteo';
  monitorCount: number;
  nearestMonitorDistanceMi: number | null;
  confidence: 'high' | 'medium' | 'low';
  impactedCounty: string | null;
  impactedCounties: Array<{ name: string; fips: string | null }>;
  impactedZipCount: number;
  usAqi: number | null;
  pm25: number | null;
  ozone: number | null;
  no2: number | null;
};

function formatLocalTime(iso: string | null): string {
  if (!iso) return 'Unavailable';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unavailable';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function normalize(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function aqiBand(aqi: number | null): { label: string; className: string } {
  if (aqi == null) return { label: 'No AQI', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  if (aqi >= 151) return { label: 'Unhealthy', className: 'bg-red-100 text-red-700 border-red-200' };
  if (aqi >= 101) return { label: 'USG', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (aqi >= 51) return { label: 'Moderate', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
  return { label: 'Good', className: 'bg-green-100 text-green-700 border-green-200' };
}

export function AirQualityMonitoringCard({
  fallbackStateAbbr,
  title = 'Air Quality Monitoring',
  description = 'Jurisdiction-aware air quality context for monitoring and protective actions.',
}: {
  fallbackStateAbbr?: string;
  title?: string;
  description?: string;
}) {
  const { activeJurisdiction } = useJurisdictionContext();
  const effectiveState = (activeJurisdiction?.parent_state || fallbackStateAbbr || 'MD').toUpperCase();

  const [loading, setLoading] = useState(true);
  const [reading, setReading] = useState<AirQualityReading | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/air-quality/latest?state=${encodeURIComponent(effectiveState)}`);
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || `Failed to load air quality for ${effectiveState}`);
        }
        if (!cancelled) setReading((json.reading || null) as AirQualityReading | null);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Unable to load air quality data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [effectiveState]);

  const scope = useMemo(() => {
    if (!activeJurisdiction) {
      return { label: 'Entity scope', detail: `${effectiveState} statewide` };
    }
    const countyNames = (reading?.impactedCounties || []).map((c) => normalize(c.name));
    const keywordSource = activeJurisdiction.name_keywords?.length
      ? activeJurisdiction.name_keywords
      : [activeJurisdiction.jurisdiction_name];
    const keywordHit = keywordSource
      .map(normalize)
      .filter(Boolean)
      .some((kw) => countyNames.some((c) => c.includes(kw) || kw.includes(c)));

    return keywordHit
      ? { label: 'Local match', detail: `${activeJurisdiction.jurisdiction_name} context matched` }
      : { label: 'Local scope', detail: `${activeJurisdiction.jurisdiction_name} (state-level fallback)` };
  }, [activeJurisdiction, effectiveState, reading?.impactedCounties]);

  const band = aqiBand(reading?.usAqi ?? null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wind className="h-5 w-5 text-cyan-600" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={band.className}>{band.label}</Badge>
          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
            <MapPin className="h-3 w-3 mr-1" />
            {scope.detail}
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{scope.label}</Badge>
        </div>

        {loading && <div className="text-xs text-slate-500">Loading air quality context...</div>}
        {!loading && error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">{error}</div>
        )}
        {!loading && !error && !reading && (
          <div className="text-xs text-slate-500">No air quality reading available for {effectiveState}.</div>
        )}

        {!loading && !error && reading && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border bg-cyan-50 border-cyan-200 p-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-cyan-700">US AQI</div>
                <div className="text-xl font-bold text-cyan-800">{reading.usAqi ?? 'N/A'}</div>
              </div>
              <div className="rounded-xl border bg-blue-50 border-blue-200 p-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-blue-700">PM2.5</div>
                <div className="text-xl font-bold text-blue-800">{reading.pm25 ?? 'N/A'}</div>
              </div>
              <div className="rounded-xl border bg-slate-50 border-slate-200 p-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-600">Monitors</div>
                <div className="text-xl font-bold text-slate-800">{reading.monitorCount}</div>
              </div>
              <div className="rounded-xl border bg-amber-50 border-amber-200 p-3">
                <div className="text-[10px] uppercase tracking-wide font-semibold text-amber-700">Confidence</div>
                <div className="text-xl font-bold text-amber-800">{reading.confidence}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-1">
              <div className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-slate-500" />
                Updated: {formatLocalTime(reading.timestamp)}
              </div>
              <div>Provider: {reading.provider} {reading.nearestMonitorDistanceMi != null ? `· nearest monitor ${reading.nearestMonitorDistanceMi.toFixed(1)} mi` : ''}</div>
              <div>
                Impacted counties: {reading.impactedCounties.slice(0, 3).map((c) => c.name).join(', ') || reading.impactedCounty || 'Not available'}
                {reading.impactedCounties.length > 3 ? ` +${reading.impactedCounties.length - 3} more` : ''}
              </div>
              <div>Estimated impacted ZIPs: {reading.impactedZipCount}</div>
            </div>

            {(reading.usAqi != null && reading.usAqi >= 101) && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <div className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Protective action suggested
                </div>
                <div className="mt-1">Issue sensitive-group outdoor activity guidance for the active scope.</div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}


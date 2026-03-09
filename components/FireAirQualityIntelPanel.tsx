'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Flame, Wind, Shield, AlertTriangle, Heart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FireDetectionCard } from './FireDetectionCard';
import { AirQualityMonitoringCard } from './AirQualityMonitoringCard';

interface RegionSummary {
  region: string;
  label: string;
  detectionCount: number;
  highConfidenceCount: number;
  maxFrp: number;
}

type ThreatLevel = 'none' | 'low' | 'elevated' | 'high' | 'critical';

function getThreatLevel(fires: number, highConf: number, maxFrp: number): ThreatLevel {
  if (fires === 0) return 'none';
  if (highConf >= 6 || maxFrp > 100) return 'critical';
  if (highConf >= 3 || maxFrp > 50) return 'high';
  if (fires >= 5) return 'elevated';
  return 'low';
}

const THREAT_STYLES: Record<ThreatLevel, { bg: string; text: string; border: string; label: string }> = {
  none:     { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200', label: 'No Threat' },
  low:      { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',  label: 'Low' },
  elevated: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', label: 'Elevated' },
  high:     { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'High' },
  critical: { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    label: 'Critical' },
};

export function FireAirQualityIntelPanel({
  focusRegion,
  selectedState,
}: {
  focusRegion?: string;
  selectedState?: string;
}) {
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [distinctDates, setDistinctDates] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/firms/latest')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.regions) setRegions(data.regions);
        if (!cancelled && data?.distinctDates) setDistinctDates(data.distinctDates);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const totalFires = regions.reduce((s, r) => s + r.detectionCount, 0);
  const totalHighConf = regions.reduce((s, r) => s + r.highConfidenceCount, 0);
  const maxFrp = Math.max(0, ...regions.map(r => r.maxFrp));
  const threatLevel = getThreatLevel(totalFires, totalHighConf, maxFrp);
  const style = THREAT_STYLES[threatLevel];

  return (
    <div className="space-y-4">
      {/* ── Threat Status Badges ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <CardTitle className="text-base">Fire & Air Quality Threat Assessment</CardTitle>
            </div>
            <Badge variant="outline" className={`${style.bg} ${style.text} ${style.border}`}>
              {style.label}
            </Badge>
          </div>
          <CardDescription className="text-xs">
            Combined satellite fire detection and air quality intelligence for military force health protection.
            {distinctDates.length >= 2 && (
              <span className="ml-1 text-slate-400">
                Covering {distinctDates[distinctDates.length - 1]} to {distinctDates[0]}.
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`rounded-lg px-3 py-2 text-center border ${style.border} ${style.bg}`}>
              <Flame className={`w-4 h-4 mx-auto mb-1 ${style.text}`} />
              <p className={`text-lg font-bold ${style.text}`}>{totalFires}</p>
              <p className="text-[10px] text-slate-500">Active Fires</p>
            </div>
            <div className="rounded-lg px-3 py-2 text-center border border-slate-200 bg-slate-50">
              <AlertTriangle className="w-4 h-4 mx-auto mb-1 text-red-500" />
              <p className="text-lg font-bold text-slate-800">{totalHighConf}</p>
              <p className="text-[10px] text-slate-500">High-Confidence</p>
            </div>
            <div className="rounded-lg px-3 py-2 text-center border border-slate-200 bg-slate-50">
              <Wind className="w-4 h-4 mx-auto mb-1 text-blue-500" />
              <p className="text-lg font-bold text-slate-800">{maxFrp > 0 ? maxFrp.toFixed(1) : '—'}</p>
              <p className="text-[10px] text-slate-500">Max FRP (MW)</p>
            </div>
            <div className="rounded-lg px-3 py-2 text-center border border-slate-200 bg-slate-50">
              <Shield className="w-4 h-4 mx-auto mb-1 text-emerald-500" />
              <p className="text-lg font-bold text-slate-800">{distinctDates.length || '—'}</p>
              <p className="text-[10px] text-slate-500">Days of Data</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Fire Detection Card (embedded) ── */}
      <FireDetectionCard focusRegion={focusRegion} />

      {/* ── Air Quality Card (reused) ── */}
      <AirQualityMonitoringCard
        fallbackStateAbbr={selectedState}
        title="Air Quality - Force Health Context"
        description="Jurisdiction-aware air quality monitoring for smoke exposure and force health protection."
      />

      {/* ── Health Advisory ── */}
      <HealthAdvisoryCard threatLevel={threatLevel} totalFires={totalFires} maxFrp={maxFrp} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Health Advisory Subcomponent                                       */
/* ------------------------------------------------------------------ */

function HealthAdvisoryCard({
  threatLevel,
  totalFires,
  maxFrp,
}: {
  threatLevel: ThreatLevel;
  totalFires: number;
  maxFrp: number;
}) {
  const showAdvisory = threatLevel !== 'none' && threatLevel !== 'low';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-rose-500" />
          <CardTitle className="text-base">Burn Pit & Smoke Health Advisory</CardTitle>
        </div>
        <CardDescription className="text-xs">
          PM2.5 exposure guidance, PACT Act context, and protective action recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* ── PM2.5 Thresholds Reference ── */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-left text-slate-500">
                <th className="px-3 py-1.5 font-medium">PM2.5 Range</th>
                <th className="px-3 py-1.5 font-medium">Category</th>
                <th className="px-3 py-1.5 font-medium">Protective Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-slate-700">
              <tr>
                <td className="px-3 py-1.5 font-mono">0-12.0</td>
                <td className="px-3 py-1.5"><Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px]">Good</Badge></td>
                <td className="px-3 py-1.5">Normal operations</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">12.1-35.4</td>
                <td className="px-3 py-1.5"><Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px]">Moderate</Badge></td>
                <td className="px-3 py-1.5">Sensitive groups reduce outdoor exertion</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">35.5-55.4</td>
                <td className="px-3 py-1.5"><Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-[10px]">USG</Badge></td>
                <td className="px-3 py-1.5">Limit prolonged outdoor exertion; N95 masks recommended</td>
              </tr>
              <tr>
                <td className="px-3 py-1.5 font-mono">55.5+</td>
                <td className="px-3 py-1.5"><Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px]">Unhealthy</Badge></td>
                <td className="px-3 py-1.5">Minimize all outdoor activity; full respiratory protection</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Active Advisory ── */}
        {showAdvisory && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">Active Fire-Smoke Advisory</span>
            </div>
            <p className="text-xs text-amber-700">
              {totalFires} active fire{totalFires !== 1 ? 's' : ''} detected by satellite with max fire radiative power
              of {maxFrp.toFixed(1)} MW. Personnel in downwind areas should monitor local AQI readings and implement
              appropriate respiratory protection per OEHHA/DHA guidelines.
            </p>
          </div>
        )}

        {/* ── PACT Act Context ── */}
        <div className="border border-blue-100 bg-blue-50 rounded-lg p-3 space-y-1">
          <p className="text-xs font-semibold text-blue-800">PACT Act Burn Pit Exposure Reference</p>
          <p className="text-xs text-blue-700">
            The Sergeant First Class Heath Robinson Honoring our Promise to Address Comprehensive Toxics (PACT) Act
            of 2022 expands VA health care and benefits for veterans exposed to burn pits and other toxic substances.
            Installations with documented burn pit history are flagged in fire detection alerts. Active fires near
            these installations warrant immediate air quality monitoring and exposure documentation for
            service members under VA presumptive conditions.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

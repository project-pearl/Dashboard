'use client';

import React, { useEffect, useState } from 'react';
import { Flame, MapPin, AlertTriangle, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RegionSummary {
  region: string;
  label: string;
  detectionCount: number;
  highConfidenceCount: number;
  maxFrp: number;
}

interface RegionDetail {
  region: string;
  label: string;
  bbox: [number, number, number, number];
  detectionCount: number;
  highConfidenceCount: number;
  maxFrp: number;
  detections: Array<{
    lat: number;
    lng: number;
    brightness: number;
    acq_date: string;
    acq_time: string;
    confidence: 'nominal' | 'high';
    frp: number;
    daynight: 'D' | 'N';
    region: string;
    nearestInstallation: string | null;
    distanceToInstallationMi: number | null;
  }>;
}

interface CacheStatus {
  loaded: boolean;
  built?: string;
  totalDetections?: number;
}

export function FireDetectionCard({
  focusRegion,
  title = 'NASA FIRMS Fire Detection',
  description = 'Active fire detections from VIIRS NOAA-20 satellite across military command regions.',
}: {
  focusRegion?: string;
  title?: string;
  description?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionSummary[]>([]);
  const [focusDetail, setFocusDetail] = useState<RegionDetail | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (focusRegion) {
          const res = await fetch(`/api/firms/latest?region=${encodeURIComponent(focusRegion)}`);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!cancelled) {
            setFocusDetail(data.region);
            setCacheStatus(data.cache);
          }
        } else {
          const res = await fetch('/api/firms/latest');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          if (!cancelled) {
            setRegions(data.regions || []);
            setCacheStatus(data.cache);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [focusRegion]);

  const totalFires = focusDetail
    ? focusDetail.detectionCount
    : regions.reduce((s, r) => s + r.detectionCount, 0);
  const totalHighConf = focusDetail
    ? focusDetail.highConfidenceCount
    : regions.reduce((s, r) => s + r.highConfidenceCount, 0);
  const maxFrp = focusDetail
    ? focusDetail.maxFrp
    : Math.max(0, ...regions.map(r => r.maxFrp));
  const activeRegions = focusDetail ? 1 : regions.filter(r => r.detectionCount > 0).length;

  // Near-installation alerts (fires within 25mi)
  const nearInstFires = focusDetail?.detections?.filter(
    d => d.distanceToInstallationMi != null && d.distanceToInstallationMi <= 25
  ) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {totalFires > 0 && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
              {totalFires} active fire{totalFires !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && <p className="text-sm text-slate-500">Loading fire detection data...</p>}
        {error && <p className="text-sm text-red-600">Error: {error}</p>}

        {!loading && !error && (
          <>
            {/* ── Summary Tiles ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryTile label="Active Fires" value={totalFires} icon={<Flame className="w-4 h-4 text-orange-500" />} />
              <SummaryTile label="High-Confidence" value={totalHighConf} icon={<AlertTriangle className="w-4 h-4 text-red-500" />} />
              <SummaryTile label="Max FRP (MW)" value={maxFrp > 0 ? maxFrp.toFixed(1) : '—'} icon={<Activity className="w-4 h-4 text-amber-500" />} />
              <SummaryTile label="Regions Active" value={activeRegions} icon={<MapPin className="w-4 h-4 text-blue-500" />} />
            </div>

            {/* ── Region Breakdown ── */}
            {!focusDetail && regions.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-3 py-2 font-medium">Region</th>
                      <th className="px-3 py-2 font-medium text-right">Fires</th>
                      <th className="px-3 py-2 font-medium text-right">High-Conf</th>
                      <th className="px-3 py-2 font-medium text-right">Max FRP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {regions.map(r => (
                      <tr key={r.region} className={r.detectionCount > 0 ? '' : 'text-slate-400'}>
                        <td className="px-3 py-2">{r.label}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.detectionCount}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.highConfidenceCount}</td>
                        <td className="px-3 py-2 text-right font-mono">{r.maxFrp > 0 ? r.maxFrp.toFixed(1) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Near-Installation Alerts ── */}
            {nearInstFires.length > 0 && (
              <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700">
                    {nearInstFires.length} fire{nearInstFires.length !== 1 ? 's' : ''} near military installations
                  </span>
                </div>
                <div className="space-y-1">
                  {nearInstFires.slice(0, 10).map((f, i) => (
                    <div key={i} className="text-xs text-red-600 flex justify-between">
                      <span>{f.nearestInstallation}</span>
                      <span className="font-mono">{f.distanceToInstallationMi?.toFixed(1)}mi &middot; {f.frp.toFixed(1)} MW</span>
                    </div>
                  ))}
                  {nearInstFires.length > 10 && (
                    <p className="text-xs text-red-500">+ {nearInstFires.length - 10} more</p>
                  )}
                </div>
              </div>
            )}

            {/* ── Cache Footer ── */}
            {cacheStatus && (
              <p className="text-xs text-slate-400 pt-1">
                {cacheStatus.loaded
                  ? `Last updated: ${new Date(cacheStatus.built!).toLocaleString()}`
                  : 'Cache not loaded — run rebuild-firms cron'}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SummaryTile({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

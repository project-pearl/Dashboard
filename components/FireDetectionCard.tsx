'use client';

import React, { useMemo, useEffect, useState } from 'react';
import { Flame, MapPin, AlertTriangle, Activity, ChevronUp, ChevronDown, ArrowUpDown, Search, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RegionSummary {
  region: string;
  label: string;
  detectionCount: number;
  highConfidenceCount: number;
  maxFrp: number;
}

interface Detection {
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
}

interface RegionDetail {
  region: string;
  label: string;
  bbox: [number, number, number, number];
  detectionCount: number;
  highConfidenceCount: number;
  maxFrp: number;
  detections: Detection[];
}

interface CacheStatus {
  loaded: boolean;
  built?: string;
  totalDetections?: number;
}

type SortOption = 'frp_desc' | 'frp_asc' | 'date_desc' | 'date_asc' | 'distance_asc';
type RegionSortCol = 'detectionCount' | 'highConfidenceCount' | 'maxFrp';

const SORT_LABELS: Record<SortOption, string> = {
  frp_desc: 'Intensity (High→Low)',
  frp_asc: 'Intensity (Low→High)',
  date_desc: 'Newest First',
  date_asc: 'Oldest First',
  distance_asc: 'Nearest Installation',
};

const PAGE_SIZE = 25;

function formatDatePill(dateStr: string): string {
  // dateStr is "YYYY-MM-DD"
  const [, m, d] = dateStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
}

function formatTime(t: string): string {
  // acq_time is HHMM
  if (t.length < 3) return t;
  return `${t.slice(0, -2)}:${t.slice(-2)}`;
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

  // Sort & filter state
  const [sortBy, setSortBy] = useState<SortOption>('date_desc');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [regionSort, setRegionSort] = useState<{ col: RegionSortCol; dir: 'asc' | 'desc' }>({ col: 'detectionCount', dir: 'desc' });
  const [showCount, setShowCount] = useState(PAGE_SIZE);
  const [instFireSearch, setInstFireSearch] = useState('');

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

  // Reset pagination when filter/sort changes
  useEffect(() => { setShowCount(PAGE_SIZE); }, [dateFilter, sortBy]);

  const detections = focusDetail?.detections ?? [];

  // Distinct dates sorted descending
  const distinctDates = useMemo(() => {
    const dates = new Set(detections.map(d => d.acq_date));
    return [...dates].sort().reverse();
  }, [detections]);

  // Filtered detections
  const filteredDetections = useMemo(() => {
    if (dateFilter === 'all') return detections;
    return detections.filter(d => d.acq_date === dateFilter);
  }, [detections, dateFilter]);

  // Sorted detections
  const sortedDetections = useMemo(() => {
    const arr = [...filteredDetections];
    switch (sortBy) {
      case 'frp_desc':
        return arr.sort((a, b) => b.frp - a.frp);
      case 'frp_asc':
        return arr.sort((a, b) => a.frp - b.frp);
      case 'date_desc':
        return arr.sort((a, b) => {
          const dc = b.acq_date.localeCompare(a.acq_date);
          return dc !== 0 ? dc : b.acq_time.localeCompare(a.acq_time);
        });
      case 'date_asc':
        return arr.sort((a, b) => {
          const dc = a.acq_date.localeCompare(b.acq_date);
          return dc !== 0 ? dc : a.acq_time.localeCompare(b.acq_time);
        });
      case 'distance_asc':
        return arr.sort((a, b) => (a.distanceToInstallationMi ?? 9999) - (b.distanceToInstallationMi ?? 9999));
      default:
        return arr;
    }
  }, [filteredDetections, sortBy]);

  // Sorted regions
  const sortedRegions = useMemo(() => {
    const arr = [...regions];
    const { col, dir } = regionSort;
    arr.sort((a, b) => {
      const va = a[col];
      const vb = b[col];
      return dir === 'asc' ? va - vb : vb - va;
    });
    return arr;
  }, [regions, regionSort]);

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

  function toggleRegionSort(col: RegionSortCol) {
    setRegionSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'desc' }
    );
  }

  function RegionSortIcon({ col }: { col: RegionSortCol }) {
    if (regionSort.col !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40 inline" />;
    return regionSort.dir === 'desc'
      ? <ChevronDown className="w-3 h-3 ml-1 inline" />
      : <ChevronUp className="w-3 h-3 ml-1 inline" />;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {totalFires > 0 && (
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                {totalFires} active fire{totalFires !== 1 ? 's' : ''}
              </Badge>
            )}
            <button className="p-1 rounded-md border border-slate-200 bg-white/90 shadow-sm hover:bg-slate-50 transition-colors" title="Active fire detections from NASA FIRMS satellite data, updated every 3 hours.">
              <HelpCircle className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
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

            {/* ── Region Breakdown (all-regions mode) ── */}
            {!focusDetail && sortedRegions.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-3 py-2 font-medium">Region</th>
                      <th
                        className="px-3 py-2 font-medium text-right cursor-pointer select-none hover:text-slate-700"
                        onClick={() => toggleRegionSort('detectionCount')}
                      >
                        Fires<RegionSortIcon col="detectionCount" />
                      </th>
                      <th
                        className="px-3 py-2 font-medium text-right cursor-pointer select-none hover:text-slate-700"
                        onClick={() => toggleRegionSort('highConfidenceCount')}
                      >
                        High-Conf<RegionSortIcon col="highConfidenceCount" />
                      </th>
                      <th
                        className="px-3 py-2 font-medium text-right cursor-pointer select-none hover:text-slate-700"
                        onClick={() => toggleRegionSort('maxFrp')}
                      >
                        Max FRP<RegionSortIcon col="maxFrp" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sortedRegions.map(r => (
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
            {nearInstFires.length > 0 && (() => {
              const q = instFireSearch.toLowerCase();
              const filtered = q
                ? nearInstFires.filter(f =>
                    f.nearestInstallation?.toLowerCase().includes(q) ||
                    `${f.lat.toFixed(2)},${f.lng.toFixed(2)}`.includes(q)
                  )
                : nearInstFires;
              return (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-700">
                      {nearInstFires.length} fire{nearInstFires.length !== 1 ? 's' : ''} near military installations
                    </span>
                    <div className="ml-auto relative">
                      <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-red-400" />
                      <input
                        type="text"
                        value={instFireSearch}
                        onChange={e => setInstFireSearch(e.target.value)}
                        placeholder="Filter installations…"
                        className="pl-6 pr-2 py-1 text-xs rounded border border-red-200 bg-white/80 text-red-700 placeholder:text-red-300 w-48 focus:outline-none focus:ring-1 focus:ring-red-300"
                      />
                    </div>
                  </div>
                  <div className="max-h-[180px] overflow-y-auto space-y-1">
                    {filtered.map((f, i) => (
                      <div key={i} className="text-xs text-red-600 flex justify-between">
                        <span>{f.nearestInstallation}</span>
                        <span className="font-mono">{f.distanceToInstallationMi?.toFixed(1)}mi &middot; {f.frp.toFixed(1)} MW</span>
                      </div>
                    ))}
                    {q && filtered.length === 0 && (
                      <p className="text-xs text-red-400 italic">No matches</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* ── Date Filter & Sort Controls (focus-region mode) ── */}
            {focusDetail && detections.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {/* Date pills */}
                <button
                  onClick={() => setDateFilter('all')}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    dateFilter === 'all'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Days ({detections.length})
                </button>
                {distinctDates.map(date => {
                  const count = detections.filter(d => d.acq_date === date).length;
                  return (
                    <button
                      key={date}
                      onClick={() => setDateFilter(date)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                        dateFilter === date
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {formatDatePill(date)} ({count})
                    </button>
                  );
                })}

                {/* Sort dropdown */}
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SortOption)}
                  className="ml-auto px-2 py-1 text-xs border border-slate-200 rounded-md bg-white text-slate-700"
                >
                  {Object.entries(SORT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Detection Detail Table (focus-region mode) ── */}
            {focusDetail && sortedDetections.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-left text-slate-500">
                      <th className="px-2 py-1.5 font-medium">Date</th>
                      <th className="px-2 py-1.5 font-medium">Time (UTC)</th>
                      <th className="px-2 py-1.5 font-medium">Lat/Lng</th>
                      <th className="px-2 py-1.5 font-medium text-right">FRP (MW)</th>
                      <th className="px-2 py-1.5 font-medium">Conf</th>
                      <th className="px-2 py-1.5 font-medium">Nearest Base</th>
                      <th className="px-2 py-1.5 font-medium text-right">Dist (mi)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {sortedDetections.slice(0, showCount).map((d, i) => (
                      <tr key={i} className={d.confidence === 'high' ? 'bg-red-50/40' : ''}>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">{d.acq_date}</td>
                        <td className="px-2 py-1.5 font-mono">{formatTime(d.acq_time)}</td>
                        <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                          {d.lat.toFixed(3)}, {d.lng.toFixed(3)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono font-semibold">{d.frp.toFixed(1)}</td>
                        <td className="px-2 py-1.5">
                          <Badge
                            variant="outline"
                            className={
                              d.confidence === 'high'
                                ? 'bg-red-50 text-red-700 border-red-200 text-2xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 text-2xs'
                            }
                          >
                            {d.confidence}
                          </Badge>
                        </td>
                        <td className="px-2 py-1.5 truncate max-w-[140px]">{d.nearestInstallation ?? '—'}</td>
                        <td className="px-2 py-1.5 text-right font-mono">
                          {d.distanceToInstallationMi != null ? d.distanceToInstallationMi.toFixed(1) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Show more / summary */}
                {sortedDetections.length > showCount && (
                  <div className="px-3 py-2 bg-slate-50 border-t text-center">
                    <button
                      onClick={() => setShowCount(prev => prev + PAGE_SIZE)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Show more ({sortedDetections.length - showCount} remaining)
                    </button>
                  </div>
                )}
                {sortedDetections.length <= showCount && sortedDetections.length > 0 && (
                  <div className="px-3 py-1.5 bg-slate-50 border-t">
                    <p className="text-2xs text-slate-400 text-center">
                      Showing all {sortedDetections.length} detection{sortedDetections.length !== 1 ? 's' : ''}
                      {dateFilter !== 'all' ? ` for ${formatDatePill(dateFilter)}` : ''}
                    </p>
                  </div>
                )}
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
      <p className="text-2xs text-slate-500 leading-tight">{label}</p>
    </div>
  );
}

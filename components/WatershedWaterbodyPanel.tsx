'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, ChevronRight, ChevronLeft, AlertTriangle, Waves, Search } from 'lucide-react';
import {
  RegionRow, AttainsBulkEntry, WatershedGroup,
  groupByWatershed, isPriorityWaterbody, isCoastalWaterbody,
} from '@/lib/huc8Utils';

// ─── Helpers (duplicated from StateManagementCenter to keep panel self-contained) ─
function levelToLabel(level: string): string {
  return level === 'high' ? 'Severe' : level === 'medium' ? 'Impaired' : level === 'low' ? 'Watch' : 'Healthy';
}

function scoreToGrade(score: number): { letter: string; color: string; bg: string } {
  if (score >= 97) return { letter: 'A+', color: 'text-green-700', bg: 'bg-green-100 border-green-300' };
  if (score >= 93) return { letter: 'A',  color: 'text-green-700', bg: 'bg-green-100 border-green-300' };
  if (score >= 90) return { letter: 'A-', color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
  if (score >= 87) return { letter: 'B+', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 83) return { letter: 'B',  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 80) return { letter: 'B-', color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' };
  if (score >= 77) return { letter: 'C+', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' };
  if (score >= 73) return { letter: 'C',  color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' };
  if (score >= 70) return { letter: 'C-', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
  if (score >= 67) return { letter: 'D+', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300' };
  if (score >= 63) return { letter: 'D',  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
  if (score >= 60) return { letter: 'D-', color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' };
  return { letter: 'F', color: 'text-red-700', bg: 'bg-red-50 border-red-300' };
}

const SEVERITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

// ─── Types ──────────────────────────────────────────────────────────────────

type FilterLevel = 'all' | 'high' | 'impaired' | 'monitored';

interface RegionMeta {
  huc8: string;
  name: string;
  [key: string]: any;
}

interface Props {
  stateAbbr: string;
  stateName: string;
  regionData: RegionRow[];
  attainsBulk: AttainsBulkEntry[];
  attainsBulkLoaded: boolean;
  activeDetailId: string | null;
  setActiveDetailId: (id: string | null) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function WatershedWaterbodyPanel({
  stateAbbr,
  stateName,
  regionData,
  attainsBulk,
  attainsBulkLoaded,
  activeDetailId,
  setActiveDetailId,
}: Props) {
  // ── Internal state ──
  const [activeWatershed, setActiveWatershed] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<FilterLevel>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showAllPriority, setShowAllPriority] = useState(false);
  const [huc8Names, setHuc8Names] = useState<Record<string, string>>({});
  const [registryMeta, setRegistryMeta] = useState<Record<string, RegionMeta>>({});

  // ── Load HUC-8 names lazily ──
  useEffect(() => {
    import('@/data/huc8-names.json')
      .then((mod) => setHuc8Names(mod.default || mod))
      .catch(() => setHuc8Names({}));
  }, []);

  // ── Load registry meta lazily ──
  useEffect(() => {
    import('@/lib/station-registry.json')
      .then((mod) => {
        const data = (mod.default || mod) as any;
        setRegistryMeta(data.regions || {});
      })
      .catch(() => setRegistryMeta({}));
  }, []);

  // ── ATTAINS lookup maps ──
  const attainsLookup = useMemo(() => {
    const byId = new Map<string, AttainsBulkEntry>();
    const byName = new Map<string, AttainsBulkEntry>();
    for (const a of attainsBulk) {
      if (a.id) byId.set(a.id, a);
      const norm = a.name.toLowerCase().trim();
      if (norm) byName.set(norm, a);
    }
    return { byId, byName };
  }, [attainsBulk]);

  function findAttainsEntry(row: RegionRow): AttainsBulkEntry | undefined {
    let match = attainsLookup.byId.get(row.id);
    if (match) return match;
    const normName = row.name.toLowerCase().replace(/,.*$/, '').trim();
    match = attainsLookup.byName.get(normName);
    if (match) return match;
    for (const a of attainsBulk) {
      const aN = a.name.toLowerCase().trim();
      if (aN.includes(normName) || normName.includes(aN)) return a;
    }
    return undefined;
  }

  // ── Watershed groups ──
  const watersheds = useMemo(
    () => groupByWatershed(regionData, attainsBulk, huc8Names, registryMeta),
    [regionData, attainsBulk, huc8Names, registryMeta]
  );

  // ── Priority waterbodies ──
  const priorityWaterbodies = useMemo(() => {
    return regionData
      .filter(r => isPriorityWaterbody(r, findAttainsEntry(r)))
      .sort((a, b) => b.activeAlerts - a.activeAlerts || a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionData, attainsBulk]);

  // ── Coastal waterbodies ──
  const coastalWaterbodies = useMemo(() => {
    return regionData.filter(r => isCoastalWaterbody(findAttainsEntry(r)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionData, attainsBulk]);

  // ── Stats ──
  const stats = useMemo(() => {
    const high = regionData.filter(r => r.alertLevel === 'high').length;
    const medium = regionData.filter(r => r.alertLevel === 'medium').length;
    const monitored = regionData.filter(r => r.status === 'monitored').length;
    return { total: regionData.length, high, medium, monitored, assessed: regionData.filter(r => r.status === 'assessed').length };
  }, [regionData]);

  // ── Active watershed data ──
  const activeWs = activeWatershed
    ? watersheds.find(w => w.huc8 === activeWatershed) || null
    : null;

  // ── Filtering logic ──
  function filterWaterbodies(rows: RegionRow[]): RegionRow[] {
    let filtered = rows;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    if (filterLevel !== 'all') {
      if (filterLevel === 'impaired') {
        filtered = filtered.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium');
      } else if (filterLevel === 'monitored') {
        filtered = filtered.filter(r => r.status === 'monitored');
      } else {
        filtered = filtered.filter(r => r.alertLevel === filterLevel);
      }
    }
    return [...filtered].sort((a, b) => SEVERITY_ORDER[b.alertLevel] - SEVERITY_ORDER[a.alertLevel] || a.name.localeCompare(b.name));
  }

  function filterWatersheds(groups: WatershedGroup[]): WatershedGroup[] {
    let filtered = groups;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(ws =>
        ws.name.toLowerCase().includes(q) ||
        ws.huc8.includes(q) ||
        ws.waterbodies.some(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      );
    }
    if (filterLevel !== 'all') {
      if (filterLevel === 'impaired') {
        filtered = filtered.filter(ws => ws.waterbodies.some(r => r.alertLevel === 'high' || r.alertLevel === 'medium'));
      } else if (filterLevel === 'monitored') {
        filtered = filtered.filter(ws => ws.waterbodies.some(r => r.status === 'monitored'));
      } else {
        filtered = filtered.filter(ws => ws.waterbodies.some(r => r.alertLevel === filterLevel));
      }
    }
    return filtered;
  }

  // Compute search match counts per watershed for badge display
  function searchMatchCount(ws: WatershedGroup): number {
    if (!searchQuery) return 0;
    const q = searchQuery.toLowerCase();
    return ws.waterbodies.filter(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)).length;
  }

  // ── Drill-down filtered list ──
  const drillDownList = activeWs ? filterWaterbodies(activeWs.waterbodies) : [];
  const displayedDrillDown = showAll ? drillDownList : drillDownList.slice(0, 20);

  // ── Watershed-level filtered list ──
  const filteredWatersheds = filterWatersheds(watersheds);
  const displayedWatersheds = showAll ? filteredWatersheds : filteredWatersheds.slice(0, 15);

  // Auto-drill: when searching narrows to waterbodies in a single watershed, jump in
  const autoDrillTarget = useMemo(() => {
    if (!searchQuery || activeWatershed !== null) return null;
    const q = searchQuery.toLowerCase();
    // Find which watersheds have waterbody-level matches (not just watershed name matches)
    const withWbMatches = filteredWatersheds.filter(ws =>
      ws.waterbodies.some(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
    );
    return withWbMatches.length === 1 ? withWbMatches[0].huc8 : null;
  }, [searchQuery, activeWatershed, filteredWatersheds]);

  useEffect(() => {
    if (autoDrillTarget) setActiveWatershed(autoDrillTarget);
  }, [autoDrillTarget]);

  // ── Filter pill counts (context-aware) ──
  const pillCounts = useMemo(() => {
    const source = activeWs ? activeWs.waterbodies : regionData;
    return {
      impaired: source.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length,
      severe: source.filter(r => r.alertLevel === 'high').length,
      monitored: source.filter(r => r.status === 'monitored').length,
    };
  }, [activeWs, regionData]);

  // Reset showAll when switching views or filters
  useEffect(() => { setShowAll(false); }, [activeWatershed, filterLevel, searchQuery]);

  // ── Render: Waterbody row (reused in drill-down and priority section) ──
  function renderWaterbodyRow(r: RegionRow) {
    const isActive = r.id === activeDetailId;
    return (
      <div
        key={r.id}
        onClick={() => setActiveDetailId(isActive ? null : r.id)}
        className={`flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors ${
          isActive ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'
        }`}
      >
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-medium ${isActive ? 'text-blue-900' : ''}`}>{r.name}</div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {r.status === 'assessed' ? (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                r.alertLevel === 'high' ? 'bg-red-100 text-red-700' :
                r.alertLevel === 'medium' ? 'bg-orange-100 text-orange-700' :
                r.alertLevel === 'low' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {levelToLabel(r.alertLevel)}
              </span>
            ) : r.status === 'monitored' ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                ◐ {r.dataSourceCount} source{r.dataSourceCount !== 1 ? 's' : ''}
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">— Unmonitored</span>
            )}
            {r.activeAlerts > 0 && <span>{r.activeAlerts} alert{r.activeAlerts !== 1 ? 's' : ''}</span>}
            {r.status === 'assessed' && <span className="text-[9px] text-slate-400">EPA ATTAINS</span>}
          </div>
        </div>
        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mr-1" />}
      </div>
    );
  }

  // ── Render: Watershed card ──
  function renderWatershedCard(ws: WatershedGroup) {
    const matchCount = searchQuery ? searchMatchCount(ws) : 0;
    return (
      <div
        key={ws.huc8}
        onClick={() => { setActiveWatershed(ws.huc8); setShowAll(false); }}
        className="rounded-lg border border-slate-200 p-3 cursor-pointer transition-colors hover:bg-slate-50 hover:border-slate-300"
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-800 truncate">{ws.name}</div>
            <div className="text-[10px] text-slate-400 font-mono">{ws.huc8 !== 'OTHER' ? `HUC-8 ${ws.huc8}` : ''}</div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {matchCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700">
                {matchCount} match{matchCount !== 1 ? 'es' : ''}
              </span>
            )}
            {ws.activeAlerts > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                {ws.activeAlerts} alert{ws.activeAlerts !== 1 ? 's' : ''}
              </span>
            )}
            <ChevronRight size={14} className="text-slate-400" />
          </div>
        </div>
        {/* Stats row */}
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-slate-500">{ws.total} waterbod{ws.total !== 1 ? 'ies' : 'y'}</span>
          {ws.severe > 0 && <span className="text-red-600 font-medium">{ws.severe} severe</span>}
          {ws.impaired > 0 && <span className="text-orange-600 font-medium">{ws.impaired} impaired</span>}
        </div>
        {/* Health bar */}
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              ws.healthPct >= 80 ? 'bg-green-400' :
              ws.healthPct >= 60 ? 'bg-yellow-400' :
              ws.healthPct >= 40 ? 'bg-orange-400' : 'bg-red-400'
            }`}
            style={{ width: `${ws.healthPct}%` }}
          />
        </div>
        <div className="text-[10px] text-slate-400 mt-0.5">{ws.healthPct}% healthy</div>
      </div>
    );
  }

  // ── Grade circle ──
  const gradeCircle = useMemo(() => {
    const assessed = regionData.filter(r => r.status === 'assessed');
    if (assessed.length === 0) return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 bg-slate-100 border-slate-300">
        <div className="text-2xl font-black text-slate-400">N/A</div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500">Ungraded</div>
          <div className="text-[10px] text-slate-400">{attainsBulkLoaded ? 'No data' : 'Loading...'}</div>
        </div>
      </div>
    );
    const avgScore = Math.round(assessed.reduce((sum, r) => sum + (r.alertLevel === 'none' ? 100 : r.alertLevel === 'low' ? 85 : r.alertLevel === 'medium' ? 65 : 40), 0) / assessed.length);
    const grade = scoreToGrade(avgScore);
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 ${grade.bg}`}>
        <div className={`text-2xl font-black ${grade.color}`}>{grade.letter}</div>
        <div className="text-right">
          <div className={`text-sm font-bold ${grade.color}`}>{avgScore}%</div>
          <div className="text-[10px] text-slate-500">{assessed.length} assessed</div>
        </div>
      </div>
    );
  }, [regionData, attainsBulkLoaded]);

  return (
    <Card className="lg:col-span-1 border-2 border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MapPin size={18} />
              <span>{stateName}</span>
            </CardTitle>
            <CardDescription>
              {activeWatershed
                ? `${activeWs?.name || 'Watershed'} — ${activeWs?.total || 0} waterbodies`
                : `${watersheds.length} watershed${watersheds.length !== 1 ? 's' : ''} · ${regionData.length} waterbodies`}
            </CardDescription>
          </div>
          {gradeCircle}
        </div>

        {/* Quick stats — 4-tile row */}
        <div className="grid grid-cols-4 gap-1.5 text-center mt-3">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-lg font-bold text-slate-800">{regionData.length}</div>
            <div className="text-[10px] text-slate-500">Total</div>
          </div>
          <div className="rounded-lg bg-green-50 p-2">
            <div className="text-lg font-bold text-green-700">{stats.assessed}</div>
            <div className="text-[10px] text-slate-500">Assessed</div>
          </div>
          <div className="rounded-lg bg-blue-50 p-2">
            <div className="text-lg font-bold text-blue-600">{regionData.filter(r => r.status === 'monitored').length}</div>
            <div className="text-[10px] text-slate-500">Monitored</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-lg font-bold text-slate-400">{regionData.filter(r => r.status === 'unmonitored').length}</div>
            <div className="text-[10px] text-slate-500">No Data</div>
          </div>
        </div>

        {/* Filter pills */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {([
            { key: 'all' as const, label: 'All', color: 'bg-slate-100 text-slate-700 border-slate-200' },
            { key: 'impaired' as const, label: 'Impaired', color: 'bg-orange-100 text-orange-700 border-orange-200' },
            { key: 'high' as const, label: 'Severe', color: 'bg-red-100 text-red-700 border-red-200' },
            { key: 'monitored' as const, label: 'Monitored', color: 'bg-blue-100 text-blue-700 border-blue-200' },
          ] as const).map((f) => (
            <button
              key={f.key}
              onClick={() => { setFilterLevel(f.key); setShowAll(false); }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                filterLevel === f.key
                  ? f.color + ' ring-1 ring-offset-1 shadow-sm'
                  : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
              {f.key !== 'all' && (() => {
                const count = f.key === 'impaired' ? pillCounts.impaired
                  : f.key === 'high' ? pillCounts.severe
                  : pillCounts.monitored;
                return count > 0 ? ` (${count})` : '';
              })()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mt-2">
          <input
            type="text"
            placeholder={activeWatershed ? 'Search waterbodies...' : 'Search watersheds & waterbodies...'}
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowAll(false); }}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
          />
          {searchQuery && (
            <div className="text-[10px] text-slate-400 mt-1">
              {activeWatershed
                ? `${drillDownList.length} of ${activeWs?.total || 0} waterbodies`
                : `${filteredWatersheds.length} of ${watersheds.length} watersheds`}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-1.5 max-h-[480px] overflow-y-auto">

          {/* ═══ DRILL-DOWN VIEW ═══ */}
          {activeWatershed !== null ? (
            <>
              {/* Back breadcrumb */}
              <button
                onClick={() => { setActiveWatershed(null); setSearchQuery(''); setFilterLevel('all'); }}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mb-2 -mt-1"
              >
                <ChevronLeft size={14} />
                Back to Watersheds
              </button>

              {/* Watershed header */}
              {activeWs && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 mb-2">
                  <div className="text-sm font-semibold text-slate-800">{activeWs.name}</div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-1">
                    {activeWs.huc8 !== 'OTHER' && <span className="font-mono">HUC-8 {activeWs.huc8}</span>}
                    <span>{activeWs.total} waterbod{activeWs.total !== 1 ? 'ies' : 'y'}</span>
                    {activeWs.severe > 0 && <span className="text-red-600 font-medium">{activeWs.severe} severe</span>}
                    {activeWs.impaired > 0 && <span className="text-orange-600 font-medium">{activeWs.impaired} impaired</span>}
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        activeWs.healthPct >= 80 ? 'bg-green-400' :
                        activeWs.healthPct >= 60 ? 'bg-yellow-400' :
                        activeWs.healthPct >= 40 ? 'bg-orange-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${activeWs.healthPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Waterbody list */}
              {drillDownList.length === 0 ? (
                <div className="text-sm text-slate-500 py-8 text-center">
                  {searchQuery ? 'No waterbodies match your search.' : 'No waterbodies in this watershed.'}
                </div>
              ) : (
                <>
                  {displayedDrillDown.map(renderWaterbodyRow)}
                  {drillDownList.length > 20 && !showAll && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="w-full py-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Show all {drillDownList.length} waterbodies
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            /* ═══ WATERSHED CARD VIEW ═══ */
            <>
              {/* Priority Waterbodies */}
              {priorityWaterbodies.length > 0 && filterLevel === 'all' && !searchQuery && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <AlertTriangle size={13} className="text-amber-600" />
                    <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide">Priority Waterbodies</span>
                  </div>
                  <div className="space-y-1 border-l-2 border-amber-400 pl-2">
                    {(showAllPriority ? priorityWaterbodies : priorityWaterbodies.slice(0, 5)).map(renderWaterbodyRow)}
                    {priorityWaterbodies.length > 5 && !showAllPriority && (
                      <button
                        onClick={() => setShowAllPriority(true)}
                        className="w-full py-1 text-[11px] text-amber-600 hover:text-amber-800 font-medium"
                      >
                        Show all {priorityWaterbodies.length} priority waterbodies
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Coastal Zones */}
              {coastalWaterbodies.length > 0 && filterLevel === 'all' && !searchQuery && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Waves size={13} className="text-teal-600" />
                    <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">Coastal Zones</span>
                  </div>
                  <div className="space-y-1 border-l-2 border-teal-400 pl-2">
                    {coastalWaterbodies.slice(0, 5).map(renderWaterbodyRow)}
                    {coastalWaterbodies.length > 5 && (
                      <div className="text-[10px] text-teal-500 pl-1">+{coastalWaterbodies.length - 5} more coastal waterbodies</div>
                    )}
                  </div>
                </div>
              )}

              {/* Watershed Cards */}
              {filteredWatersheds.length === 0 ? (
                <div className="text-sm text-slate-500 py-8 text-center">
                  {searchQuery ? 'No watersheds match your search.' : 'No waterbodies registered for this state yet.'}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {displayedWatersheds.map(renderWatershedCard)}
                  </div>
                  {filteredWatersheds.length > 15 && !showAll && (
                    <button
                      onClick={() => setShowAll(true)}
                      className="w-full py-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Show all {filteredWatersheds.length} watersheds
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

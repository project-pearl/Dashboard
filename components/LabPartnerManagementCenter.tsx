'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLensParam } from '@/lib/useLensParam';
import HeroBanner from './HeroBanner';
import dynamic from 'next/dynamic';
import { STATE_GEO_LEAFLET, FIPS_TO_ABBR, STATE_NAMES } from '@/lib/mapUtils';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false }
);
const MapboxMarkers = dynamic(
  () => import('@/components/MapboxMarkers').then(m => m.MapboxMarkers),
  { ssr: false }
);
import {
  Droplets,
  AlertTriangle,
  Users,
  MapPin,
  Activity,
  FlaskConical,
  Waves,
  Bug,
  Leaf,
  Thermometer,
  ShieldAlert,
  Building2,
} from 'lucide-react';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { getRegionById } from '@/lib/regionsConfig';
import { getStateMS4Jurisdictions } from '@/lib/stateWaterData';
import { getEJScore } from '@/lib/ejVulnerability';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertLevel = 'none' | 'low' | 'medium' | 'high';

type WaterbodyRow = {
  id: string;
  name: string;
  state: string;
  alertLevel: AlertLevel;
  causes: string[];
  status: 'assessed' | 'monitored' | 'unmonitored';
  dataSourceCount: number;
  lat?: number;
  lon?: number;
};

type Props = {
  stateAbbr: string;
};

// ─── Lab-market trend card data ──────────────────────────────────────────────

const TREND_CARDS = [
  { param: 'PFAS', icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-50 border-red-200', trend: '+42%', period: 'YoY demand', insight: 'EPA MCL at 4 ppt drives massive testing demand. Labs with EPA 533/537.1 capacity are booked 3+ months out.' },
  { param: 'Nutrients (N/P)', icon: Leaf, color: 'text-green-600', bg: 'bg-green-50 border-green-200', trend: '+18%', period: 'YoY demand', insight: 'Bay TMDL milestones and MS4 permit renewals require quarterly nutrient monitoring at new outfall points.' },
  { param: 'Pathogens', icon: Bug, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', trend: '+12%', period: 'YoY demand', insight: 'Beach advisories and recreational water quality standards drive seasonal E. coli / Enterococcus testing spikes.' },
  { param: 'TSS / Sediment', icon: Waves, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', trend: '+8%', period: 'YoY demand', insight: 'Construction stormwater permits (CGP) and stream restoration projects require pre/post TSS monitoring.' },
  { param: 'Metals', icon: FlaskConical, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', trend: '+15%', period: 'YoY demand', insight: 'Lead & Copper Rule revisions (LCRR) expand compliance sampling for all community water systems.' },
  { param: 'Dissolved Oxygen', icon: Thermometer, color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200', trend: '+5%', period: 'YoY demand', insight: 'Continuous DO monitoring for aquatic life protection — sensor calibration and lab verification demand steady.' },
];

// ─── Data Generation ─────────────────────────────────────────────────────────

function generateStateWaterbodies(stateAbbr: string): WaterbodyRow[] {
  const rows: WaterbodyRow[] = [];
  for (const [id, meta] of Object.entries(REGION_META)) {
    const fips = meta.stateCode.replace('US:', '');
    const abbr = FIPS_TO_ABBR[fips] || fips;
    if (abbr !== stateAbbr) continue;

    const sources = getWaterbodyDataSources(id);
    rows.push({
      id,
      name: meta.name,
      state: abbr,
      alertLevel: 'none',
      causes: [],
      status: sources.length > 0 ? 'monitored' : 'unmonitored',
      dataSourceCount: sources.length,
    });
  }
  return rows;
}

function getMarkerColor(alertLevel: AlertLevel): string {
  return alertLevel === 'high' ? '#ef4444' :
         alertLevel === 'medium' ? '#f59e0b' :
         alertLevel === 'low' ? '#eab308' : '#22c55e';
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LabPartnerManagementCenter({ stateAbbr }: Props) {
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;

  // Lens param (default to overview)
  type LabLens = 'wq-overview' | 'impairment-map' | 'monitoring-gaps' | 'param-trends' | 'my-clients';
  const [viewLens] = useLensParam<LabLens>('wq-overview');

  // Base waterbody data from REGION_META
  const baseRows = useMemo(() => generateStateWaterbodies(stateAbbr), [stateAbbr]);

  // ATTAINS bulk data
  const [attainsBulk, setAttainsBulk] = useState<Array<{ id: string; name: string; category: string; alertLevel: AlertLevel; causes: string[]; lat?: number | null; lon?: number | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function fetchAttains() {
      try {
        const r = await fetch('/api/water-data?action=attains-national-cache');
        if (!r.ok) return;
        const json = await r.json();
        const stateData = json.states?.[stateAbbr];
        if (!stateData || cancelled) return;
        const waterbodies = (stateData.waterbodies || []).map((wb: any) => ({
          id: wb.id || '',
          name: wb.name || '',
          category: wb.category || '',
          alertLevel: (wb.alertLevel || 'none') as AlertLevel,
          causes: wb.causes || [],
          lat: wb.lat ?? null,
          lon: wb.lon ?? null,
        }));
        if (!cancelled) setAttainsBulk(waterbodies);
      } catch (e: any) {
        console.warn('[LabPartner ATTAINS] Failed:', e.message);
      }
    }
    const timer = setTimeout(fetchAttains, 800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [stateAbbr]);

  // Merge ATTAINS into waterbody rows
  const waterbodies = useMemo(() => {
    if (attainsBulk.length === 0) return baseRows;

    const SEVERITY: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
    const merged = baseRows.map(r => {
      const normName = r.name.toLowerCase().replace(/,.*$/, '').trim();
      const match = attainsBulk.find(a => {
        const aN = a.name.toLowerCase().trim();
        return aN.includes(normName) || normName.includes(aN);
      });
      if (!match) return r;
      return {
        ...r,
        alertLevel: SEVERITY[match.alertLevel] > SEVERITY[r.alertLevel] ? match.alertLevel : r.alertLevel,
        causes: match.causes.length > 0 ? match.causes : r.causes,
        status: 'assessed' as const,
      };
    });

    // Add ATTAINS-only Cat 5 waterbodies
    const existingNames = new Set(merged.map(r => r.name.toLowerCase().replace(/,.*$/, '').trim()));
    for (const a of attainsBulk) {
      const aN = a.name.toLowerCase().trim();
      const alreadyExists = [...existingNames].some(e => e.includes(aN) || aN.includes(e));
      if (!alreadyExists && a.category.includes('5')) {
        const id = a.id || `${stateAbbr.toLowerCase()}_${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`;
        merged.push({
          id,
          name: a.name,
          state: stateAbbr,
          alertLevel: a.alertLevel,
          causes: a.causes,
          status: 'assessed',
          dataSourceCount: 0,
          lat: a.lat ?? undefined,
          lon: a.lon ?? undefined,
        });
        existingNames.add(aN);
      }
    }
    return merged;
  }, [baseRows, attainsBulk, stateAbbr]);

  // ATTAINS coordinate lookup map
  const attainsCoordMap = useMemo(() => {
    const m = new Map<string, { lat: number; lon: number }>();
    for (const a of attainsBulk) {
      if (a.lat != null && a.lon != null && a.id) m.set(a.id, { lat: a.lat, lon: a.lon });
      if (a.lat != null && a.lon != null && a.name) {
        m.set(`name:${a.name.toLowerCase().trim()}`, { lat: a.lat, lon: a.lon });
      }
    }
    return m;
  }, [attainsBulk]);

  // Waterbody markers with 3-priority coordinate resolution
  const wbMarkers = useMemo(() => {
    const resolved: (WaterbodyRow & { lat: number; lon: number })[] = [];
    for (const r of waterbodies) {
      // If the row already has coordinates (ATTAINS-only entries)
      if (r.lat != null && r.lon != null) {
        resolved.push({ ...r, lat: r.lat, lon: r.lon });
        continue;
      }
      // Priority 1: ATTAINS centroid
      const byId = attainsCoordMap.get(r.id);
      const byName = !byId ? attainsCoordMap.get(`name:${r.name.toLowerCase().trim()}`) : null;
      const attainsCoord = byId || byName;
      if (attainsCoord) {
        resolved.push({ ...r, lat: attainsCoord.lat, lon: attainsCoord.lon });
        continue;
      }
      // Priority 2: regionsConfig
      const cfg = getRegionById(r.id) as any;
      if (cfg) {
        const lat = cfg.lat ?? cfg.latitude ?? null;
        const lon = cfg.lon ?? cfg.lng ?? cfg.longitude ?? null;
        if (lat != null && lon != null) {
          resolved.push({ ...r, lat, lon });
          continue;
        }
      }
      // Priority 3: name-based fallback
      const approx = resolveWaterbodyCoordinates(r.name, stateAbbr);
      if (approx) {
        resolved.push({ ...r, lat: approx.lat, lon: approx.lon });
      }
    }
    return resolved;
  }, [waterbodies, stateAbbr, attainsCoordMap]);

  // Derived stats
  const ms4Jurisdictions = useMemo(() => getStateMS4Jurisdictions(stateAbbr), [stateAbbr]);
  const ejScore = useMemo(() => getEJScore(stateAbbr), [stateAbbr]);

  const totalWaterbodies = waterbodies.length;
  const impaired = waterbodies.filter(w => w.alertLevel === 'high' || w.alertLevel === 'medium').length;
  const unmonitored = waterbodies.filter(w => w.status === 'unmonitored').length;
  const impairedList = wbMarkers.filter(w => w.alertLevel === 'high' || w.alertLevel === 'medium');

  // All top causes across impaired waterbodies
  const topCauses = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const wb of waterbodies) {
      for (const c of wb.causes) {
        counts[c] = (counts[c] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [waterbodies]);

  // ATTAINS category distribution
  const categoryBars = useMemo(() => {
    const cats: Record<string, number> = {};
    for (const a of attainsBulk) {
      const cat = a.category || 'Unknown';
      cats[cat] = (cats[cat] || 0) + 1;
    }
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [attainsBulk]);

  const leafletGeo = STATE_GEO_LEAFLET[stateAbbr] || { center: [39.8, -98.5] as [number, number], zoom: 4 };

  // Mapbox marker data
  const markerData = useMemo(() =>
    wbMarkers.map((m) => ({
      id: m.id,
      lat: m.lat,
      lon: m.lon,
      color: getMarkerColor(m.alertLevel),
      name: m.name,
      status: m.status,
      alertLevel: m.alertLevel,
      causes: m.causes.slice(0, 3).join(', '),
    })),
    [wbMarkers]
  );

  // Hover state for Mapbox popups
  const [hoveredFeature, setHoveredFeature] = useState<mapboxgl.MapboxGeoJSONFeature | null>(null);
  const onMouseMove = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    setHoveredFeature(e.features?.[0] ?? null);
  }, []);
  const onMouseLeave = useCallback(() => {
    setHoveredFeature(null);
  }, []);

  // Lens visibility
  const show = (section: string) => viewLens === section || viewLens === 'wq-overview';

  return (
    <div className="min-h-full">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <HeroBanner role="lab-partner" />
      </div>

      <LayoutEditor ccKey="LabPartner">
        {({ sections, isEditMode, onToggleVisibility }) => (
          <div className="px-4 sm:px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">

            {/* ── WQ Overview ────────────────────────────────────────────── */}
            <DraggableSection id="wq-overview" isEditMode={isEditMode} isVisible={show('wq-overview')} label="State WQ Overview" onToggleVisibility={onToggleVisibility}>
              {/* KPI Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Droplets className="w-4 h-4 text-blue-500" />
                    <span className="text-xs text-slate-500 font-medium">Waterbodies</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">{totalWaterbodies}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">in {stateName}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-slate-500 font-medium">Impaired</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-600">{impaired}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{totalWaterbodies > 0 ? Math.round((impaired / totalWaterbodies) * 100) : 0}% of total</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-4 h-4 text-slate-500" />
                    <span className="text-xs text-slate-500 font-medium">Unmonitored</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-600">{unmonitored}</div>
                  <div className="text-[10px] text-emerald-600 font-medium mt-0.5">Business dev leads</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-slate-500 font-medium">EJ Vulnerability</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">{ejScore}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">EPA EJScreen score</div>
                </div>
              </div>

              {/* MS4 Jurisdiction count */}
              <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2.5 mb-4">
                <Building2 className="w-4 h-4 text-cyan-600" />
                <span className="text-sm text-cyan-800 font-medium">
                  {ms4Jurisdictions.length} MS4 jurisdictions in {stateName}
                </span>
                <span className="text-xs text-cyan-600 ml-auto">Potential municipal clients</span>
              </div>

              {/* ATTAINS Category Distribution */}
              {categoryBars.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm mb-4">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">ATTAINS Assessment Categories</h4>
                  <div className="space-y-2">
                    {categoryBars.map(([cat, count]) => {
                      const maxCount = categoryBars[0]?.[1] || 1;
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-xs text-slate-600 w-24 flex-shrink-0 truncate">Cat {cat}</span>
                          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${cat.includes('5') ? 'bg-red-400' : cat.includes('4') ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${(count / maxCount) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500 w-8 text-right">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Top Causes */}
              {topCauses.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Top Impairment Causes</h4>
                  <div className="flex flex-wrap gap-2">
                    {topCauses.map(([cause, count]) => (
                      <span key={cause} className="inline-flex items-center gap-1.5 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full border border-red-200">
                        {cause}
                        <span className="text-red-400 font-mono text-[10px]">{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </DraggableSection>

            {/* ── Impairment Map ─────────────────────────────────────────── */}
            <DraggableSection id="impairment-map" isEditMode={isEditMode} isVisible={show('impairment-map')} label="Impairment Map" onToggleVisibility={onToggleVisibility}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Map (2/3) */}
                <div className="lg:col-span-2 rounded-xl overflow-hidden border border-slate-200">
                  <MapboxMapShell
                    center={leafletGeo.center}
                    zoom={leafletGeo.zoom}
                    height="450px"
                    interactiveLayerIds={['lab-markers']}
                    onMouseMove={onMouseMove}
                    onMouseLeave={onMouseLeave}
                  >
                    <MapboxMarkers
                      data={markerData}
                      layerId="lab-markers"
                      radius={6}
                      hoveredFeature={hoveredFeature}
                    />
                  </MapboxMapShell>
                </div>

                {/* Impaired waterbody list (1/3) */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm overflow-y-auto max-h-[450px]">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">
                    Impaired Waterbodies ({impairedList.length})
                  </h4>
                  {impairedList.length === 0 ? (
                    <p className="text-xs text-slate-400">Loading ATTAINS data...</p>
                  ) : (
                    <div className="space-y-2">
                      {impairedList.map((w) => (
                        <div key={w.id} className="flex items-start gap-2 py-2 border-b border-slate-100 last:border-0">
                          <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${w.alertLevel === 'high' ? 'bg-red-500' : 'bg-amber-500'}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-800 truncate">{w.name}</div>
                            {w.causes.length > 0 && (
                              <div className="text-[10px] text-slate-400 truncate">{w.causes.slice(0, 3).join(', ')}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DraggableSection>

            {/* ── Monitoring Gaps ─────────────────────────────────────────── */}
            <DraggableSection id="monitoring-gaps" isEditMode={isEditMode} isVisible={show('monitoring-gaps')} label="Monitoring Gaps" onToggleVisibility={onToggleVisibility}>
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-slate-700">Unmonitored Waterbodies — Business Development Leads</h4>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
                    {unmonitored} leads
                  </span>
                </div>
                {unmonitored === 0 ? (
                  <p className="text-xs text-slate-400">All waterbodies in {stateName} have monitoring data sources.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Waterbody</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Status</th>
                          <th className="text-left py-2 px-3 text-slate-500 font-medium text-xs">Opportunity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waterbodies
                          .filter(w => w.status === 'unmonitored')
                          .map((w) => (
                            <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                              <td className="py-2.5 px-3 text-slate-800 font-medium">{w.name}</td>
                              <td className="py-2.5 px-3">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Unmonitored</span>
                              </td>
                              <td className="py-2.5 px-3 text-xs text-emerald-600 font-medium">
                                Pitch monitoring services to local municipality
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </DraggableSection>

            {/* ── Parameter Trends ────────────────────────────────────────── */}
            <DraggableSection id="param-trends" isEditMode={isEditMode} isVisible={show('param-trends')} label="Parameter Trends" onToggleVisibility={onToggleVisibility}>
              {/* Trend KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium mb-1">Total Testing Demand</div>
                  <div className="text-2xl font-bold text-slate-900">+22%</div>
                  <div className="text-[10px] text-emerald-600 font-medium">YoY across all parameters</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium mb-1">Fastest Growth</div>
                  <div className="text-2xl font-bold text-red-600">PFAS</div>
                  <div className="text-[10px] text-slate-400">+42% driven by MCL rule</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium mb-1">Compliance Drivers</div>
                  <div className="text-2xl font-bold text-slate-900">3</div>
                  <div className="text-[10px] text-slate-400">Major federal rules pending</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                  <div className="text-xs text-slate-500 font-medium mb-1">State Impaired WBs</div>
                  <div className="text-2xl font-bold text-amber-600">{impaired}</div>
                  <div className="text-[10px] text-slate-400">Each requiring lab testing</div>
                </div>
              </div>

              {/* Trend cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {TREND_CARDS.map((tc) => {
                  const Icon = tc.icon;
                  return (
                    <div key={tc.param} className={`rounded-xl border p-4 ${tc.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${tc.color}`} />
                          <h4 className="text-sm font-semibold text-slate-800">{tc.param}</h4>
                        </div>
                        <span className={`text-sm font-bold ${tc.color}`}>{tc.trend}</span>
                      </div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1.5">{tc.period}</div>
                      <p className="text-xs text-slate-600 leading-relaxed">{tc.insight}</p>
                    </div>
                  );
                })}
              </div>
            </DraggableSection>

            {/* ── My Clients ─────────────────────────────────────────────── */}
            <DraggableSection id="my-clients" isEditMode={isEditMode} isVisible={show('my-clients')} label="My Clients" onToggleVisibility={onToggleVisibility}>
              <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm text-center">
                <Users className="w-10 h-10 text-cyan-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-slate-800 mb-1">Client Relationship Manager</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  Track your municipal and industrial clients. Connect lab results to waterbody improvements and
                  demonstrate ROI for continued monitoring contracts.
                </p>
                <div className="flex items-center justify-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-4 py-2.5 max-w-sm mx-auto">
                  <Building2 className="w-4 h-4 text-cyan-600" />
                  <span className="text-sm text-cyan-800 font-medium">
                    {ms4Jurisdictions.length} potential MS4 clients in {stateName}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-3">
                  Client linkage via Supabase <code className="bg-slate-100 px-1 py-0.5 rounded">lab_clients</code> table — coming soon
                </p>
              </div>
            </DraggableSection>

            {/* ── Disclaimer ─────────────────────────────────────────────── */}
            <DraggableSection id="disclaimer" isEditMode={isEditMode} isVisible label="Platform Disclaimer" onToggleVisibility={onToggleVisibility}>
              <PlatformDisclaimer />
            </DraggableSection>

          </div>
        )}
      </LayoutEditor>
    </div>
  );
}

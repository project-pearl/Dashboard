'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, MapPin, Droplets, Users, DollarSign, Leaf, TrendingUp, BarChart3, Gauge, Building2, ChevronDown, ChevronLeft } from 'lucide-react';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { STATE_ABBR_TO_NAME } from '@/lib/adminStateContext';
import { SentinelStatusBadge } from '@/components/SentinelStatusBadge';
import { StateDataReportCard } from '@/components/StateDataReportCard';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { getRegionById } from '@/lib/regionsConfig';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses } from '@/lib/restorationEngine';


// ─── Dynamic imports (must be at module level) ─────────────────────────────
const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);
const MapboxChoropleth = dynamic(
  () => import('@/components/MapboxChoropleth').then(m => m.MapboxChoropleth),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);
const SentinelAlertLayer = dynamic(
  () => import('@/components/SentinelAlertLayer').then(m => m.SentinelAlertLayer),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);

// ─── Constants ──────────────────────────────────────────────────────────────
const US_CENTER: [number, number] = [39.8, -98.5];
const US_ZOOM = 3.5;

type OverlayId = 'hotspots' | 'ms4' | 'ej' | 'economy' | 'wildlife' | 'trend' | 'coverage' | 'indices';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'hotspots', label: 'Water Quality Risk', description: 'Impairment severity from EPA 303(d) and state assessments', icon: Droplets },
  { id: 'ms4', label: 'Local Jurisdictions', description: 'Municipal and county permit holders under NPDES stormwater permits', icon: Building2 },
  { id: 'ej', label: 'EJ Vulnerability', description: 'Census ACS demographics + EPA drinking water violations — community environmental burden', icon: Users },
  { id: 'economy', label: 'Economic Exposure', description: 'Waterfront property value at risk from water quality degradation (hedonic model)', icon: DollarSign },
  { id: 'wildlife', label: 'Ecological Sensitivity', description: 'USFWS ESA-listed threatened & endangered species density (aquatic-weighted)', icon: Leaf },
  { id: 'trend', label: 'Trends', description: 'Water quality change vs prior assessment period', icon: TrendingUp },
  { id: 'coverage', label: 'Monitoring Coverage', description: 'Real-time sensor coverage and monitoring network gaps', icon: BarChart3 },
  { id: 'indices', label: 'Watershed Indices', description: 'Composite HUC-8 risk score from PEARL, Infrastructure, Recovery, and Permit indices', icon: Gauge },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface StateAgency { name: string; division: string; url: string; ms4Program: string; cwaSec: string }

export interface NationalMapSectionProps {
  mapSectionRef: React.RefObject<HTMLDivElement | null>;
  viewLens: string;
  overlay: string;
  setOverlay: (v: any) => void;
  topo: any;
  sentinel: {
    systemStatus: 'active' | 'degraded' | 'offline';
    lastFetched: string | null;
    sources: any;
    anomalyHucs: any[];
    criticalHucs: any[];
    watchHucs: any[];
    advisoryHucs: any[];
    newCriticalHucs: any[];
  };
  reducedMotion: boolean;
  setReducedMotion: (fn: (m: boolean) => boolean) => void;
  audioEnabled: boolean;
  toggleAudio: () => void;
  mapRef: React.RefObject<any>;
  handleMapRef: (ref: any) => void;
  handleStateClick: (e: any) => void;
  selectedState: string;
  setSelectedState: (v: string) => void;
  fillColorExpr: any;
  centroids: Record<string, { lat: number; lng: number }>;
  hucNames: Record<string, string>;
  selectedAlertHuc: string | null;
  setSelectedAlertHuc: (v: string | null) => void;
  selectedAlertId: string | null;
  setSelectedAlertId: (v: string | null) => void;
  selectedAlertLevel: string | null;
  setSelectedAlertLevel: (v: string) => void;
  alertDetailReturnRef: React.MutableRefObject<string>;
  sideCardMode: string;
  setSideCardMode: (v: any) => void;
  liveAlertFeed: any[];
  alertHistoryLoading: boolean;
  gulfCrosscheckSummary: { corroborated: number; incidents: number } | null;
  gulfCrosscheckLoading: boolean;
  topGulfIncidents: any[];
  formatEasternTimestamp: (ts: string) => string | null;
  formatRefreshAge: (ts: string) => string;
  selectedHistoryAlert: any;
  selectedHucIndices: any;
  fmcDrawerAlert: any;
  setFmcDrawerAlert: (v: any) => void;
  fmcDrawerOpen: boolean;
  setFmcDrawerOpen: (v: boolean) => void;
  stateReport: any;
  stateReportLoading: boolean;
  selectedStateRegions: any;
  overlayByState: Map<string, any>;
  MS4_JURISDICTIONS: Record<string, any>;
  STATE_AGENCIES: Record<string, StateAgency>;
  attainsAggregation: any;
  attainsBulk: any;
  attainsBulkLoading: any;
  attainsBulkLoaded: any;
  // Restoration plan props
  lens: any;
  activeDetailId: string | null;
  regionData: any[];
  waterData: any;
  attainsCache: Record<string, any>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function NationalMapSection(props: NationalMapSectionProps) {
  const {
    mapSectionRef,
    viewLens,
    overlay,
    setOverlay,
    topo,
    sentinel,
    reducedMotion,
    setReducedMotion,
    audioEnabled,
    toggleAudio,
    mapRef,
    handleMapRef,
    handleStateClick,
    selectedState,
    setSelectedState,
    fillColorExpr,
    centroids,
    hucNames,
    selectedAlertHuc,
    setSelectedAlertHuc,
    selectedAlertId,
    setSelectedAlertId,
    selectedAlertLevel,
    setSelectedAlertLevel,
    alertDetailReturnRef,
    sideCardMode,
    setSideCardMode,
    liveAlertFeed,
    alertHistoryLoading,
    gulfCrosscheckSummary,
    gulfCrosscheckLoading,
    topGulfIncidents,
    formatEasternTimestamp,
    formatRefreshAge,
    selectedHistoryAlert,
    selectedHucIndices,
    fmcDrawerAlert,
    setFmcDrawerAlert,
    fmcDrawerOpen,
    setFmcDrawerOpen,
    stateReport,
    stateReportLoading,
    selectedStateRegions,
    overlayByState,
    MS4_JURISDICTIONS,
    STATE_AGENCIES,
    attainsAggregation,
    attainsBulk,
    attainsBulkLoading,
    attainsBulkLoaded,
    lens,
    activeDetailId,
    regionData,
    waterData,
    attainsCache,
  } = props;

  const [showRestorationCard, setShowRestorationCard] = useState(false);

  return (
    <div className="space-y-6">
        {/* ── MONITORING NETWORK MAP ──────────────────────────────── */}

        <div ref={mapSectionRef} className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px] items-stretch">
          {/* Map Card */}
          <Card id="section-usmap">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-pin-text-bright">United States Monitoring Network</CardTitle>
                <BrandedPrintBtn sectionId="usmap" title="United States Monitoring Network" />
              </div>
              <CardDescription className="text-pin-text-secondary">
                Real state outlines. Colors reflect data based on selected overlay.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Overlay Selector */}
              <div className="flex flex-wrap gap-2 pb-3">
                {OVERLAYS.filter(o => {
                  // MS4 overlay only on compliance lens
                  if (o.id === 'ms4' && viewLens !== 'compliance') return false;
                  return true;
                }).map((o) => {
                  const Icon = o.icon;
                  const isActive = overlay === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setOverlay(o.id)}
                      title={o.description}
                      className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-all border ${
                        isActive
                          ? 'bg-pin-pill-bg-active text-pin-pill-text-active border-pin-pill-border-active'
                          : 'bg-pin-pill-bg text-pin-pill-text border-pin-pill-border'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1.5" />
                      {o.label}
                    </button>
                  );
                })}
              </div>

              {!topo ? (
                <div className="text-sm text-slate-500">
                  Map data unavailable. Ensure us-atlas and topojson-client are installed.
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-lg border border-pin-border-subtle">
                  <div className="px-3 py-2 text-2xs flex items-center justify-between text-pin-text-dim border-b border-pin-border-subtle">
                    <div className="flex items-center gap-2">
                      <span>Click a state to select</span>
                      <SentinelStatusBadge
                        systemStatus={sentinel.systemStatus}
                        lastFetched={sentinel.lastFetched}
                        sources={sentinel.sources}
                        anomalyCount={sentinel.anomalyHucs.length}
                        criticalCount={sentinel.criticalHucs.length}
                        watchCount={sentinel.watchHucs.length}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Accessibility controls */}
                      <button
                        onClick={() => setReducedMotion(m => !m)}
                        className="text-2xs hover:underline text-pin-text-dim"
                        title={reducedMotion ? 'Enable animations' : 'Reduce motion'}
                      >
                        {reducedMotion ? 'Motion: Off' : 'Motion: On'}
                      </button>
                      <button
                        onClick={toggleAudio}
                        className="text-2xs hover:underline text-pin-text-dim"
                        title={audioEnabled ? 'Disable alert audio' : 'Enable alert audio'}
                      >
                        {audioEnabled ? 'Audio: On' : 'Audio: Off'}
                      </button>
                      <button onClick={() => mapRef.current?.flyTo({ center: [US_CENTER[1], US_CENTER[0]], zoom: US_ZOOM, duration: 800 })}
                        className="text-2xs hover:underline text-pin-teal">
                        Reset View
                      </button>
                    </div>
                  </div>
                  <div className={`h-[560px] w-full relative${reducedMotion ? ' sentinel-motion-off' : ''}`}>
                    <MapboxMapShell
                      center={US_CENTER}
                      zoom={US_ZOOM}
                      height="100%"
                      onMapRef={handleMapRef}
                      interactiveLayerIds={['states-choropleth-fill']}
                      onClick={handleStateClick}
                    >
                      <MapboxChoropleth
                        geoData={topo}
                        fillColorExpression={fillColorExpr}
                        selectedState={selectedState}
                        fillOpacity={0.65}
                      />
                      <SentinelAlertLayer
                        anomalyHucs={sentinel.anomalyHucs}
                        criticalHucs={sentinel.criticalHucs}
                        watchHucs={sentinel.watchHucs}
                        advisoryHucs={sentinel.advisoryHucs}
                        centroids={centroids}
                        hucNames={hucNames}
                        onHucClick={(huc8, level) => {
                          setSelectedAlertHuc(huc8);
                          const matched = liveAlertFeed.find((e) => e.entityId === huc8);
                          setSelectedAlertId(matched?.id ?? null);
                          setSelectedAlertLevel(level);
                          alertDetailReturnRef.current = 'alerts';
                          setSideCardMode('alert-detail');
                          // Look up state from scored HUCs and set selectedState
                          const scoredHuc = [...sentinel.anomalyHucs, ...sentinel.criticalHucs, ...sentinel.watchHucs, ...sentinel.advisoryHucs].find(h => h.huc8 === huc8);
                          if (scoredHuc?.stateAbbr) setSelectedState(scoredHuc.stateAbbr);
                          const c = centroids[huc8];
                          if (c && mapRef.current) {
                            mapRef.current.flyTo({ center: [c.lng, c.lat], zoom: 6, duration: 800 });
                          }
                        }}
                        reducedMotion={reducedMotion}
                        selectedHuc={selectedAlertHuc}
                      />
                    </MapboxMapShell>
                    {/* Screen reader announcement for new CRITICAL events */}
                    <div aria-live="assertive" className="sr-only">
                      {sentinel.newCriticalHucs.length > 0 &&
                        `Critical alert: ${sentinel.newCriticalHucs.length} new watershed${sentinel.newCriticalHucs.length > 1 ? 's' : ''} at critical level`
                      }
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-t border-pin-border-subtle">
                    {overlay === 'hotspots' && (
                      <>
                        <span className="pin-label mr-1">Risk:</span>
                        <span className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm bg-pin-status-healthy" /> Healthy</span>
                        <span className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm bg-pin-status-warning" /> Watch</span>
                        <span className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm bg-pin-status-warning" /> Impaired</span>
                        <span className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm bg-pin-status-severe" /> Severe</span>
                      </>
                    )}
                    {overlay === 'ms4' && (
                      <>
                        <span className="pin-label mr-1">MS4 Permits:</span>
                        {[{ label: '<10', bg: '#fed7aa' }, { label: '10–29', bg: '#fdba74' }, { label: '30–74', bg: '#fb923c' }, { label: '75–149', bg: '#f97316' }, { label: '150–299', bg: '#ea580c' }, { label: '300+', bg: '#c2410c' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'ej' && (
                      <>
                        <span className="pin-label mr-1">EJScreen:</span>
                        {[{ label: 'Low', bg: '#d1d5db' }, { label: 'Moderate', bg: '#fde68a' }, { label: 'High', bg: '#f97316' }, { label: 'Very High', bg: '#dc2626' }, { label: 'Critical', bg: '#7f1d1d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'economy' && (
                      <>
                        <span className="pin-label mr-1">Economic Exposure:</span>
                        {[{ label: 'Minimal', bg: '#d1fae5' }, { label: 'Low', bg: '#fde68a' }, { label: 'Moderate', bg: '#f59e0b' }, { label: 'Elevated', bg: '#dc2626' }, { label: 'High', bg: '#7f1d1d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'wildlife' && (
                      <>
                        <span className="pin-label mr-1">T&E Species:</span>
                        {[{ label: 'Minimal', bg: '#d1d5db' }, { label: 'Low', bg: '#bbf7d0' }, { label: 'Moderate', bg: '#22c55e' }, { label: 'High', bg: '#16a34a' }, { label: 'Very High', bg: '#14532d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'trend' && (
                      <>
                        <span className="pin-label mr-1">Trend:</span>
                        {[{ label: 'Worsening', bg: 'var(--status-severe)' }, { label: 'Stable', bg: '#9ca3af' }, { label: 'Improving', bg: 'var(--status-healthy)' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'coverage' && (
                      <>
                        <span className="pin-label mr-1">Coverage:</span>
                        {[{ label: 'None', bg: '#d1d5db' }, { label: 'Ambient', bg: '#fde68a' }, { label: 'Treatment', bg: '#22c55e' }, { label: 'Full', bg: '#14532d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'indices' && (
                      <>
                        <span className="pin-label mr-1">Composite Risk:</span>
                        {[{ label: 'Low (0-33)', bg: '#22c55e' }, { label: 'Moderate (34-49)', bg: '#fbbf24' }, { label: 'Elevated (50-66)', bg: '#f59e0b' }, { label: 'High (67-100)', bg: '#dc2626' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-2xs text-pin-text-dim"><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dual-mode Side Card: Alert Monitor / State Detail */}
          <Card className="flex flex-col overflow-hidden bg-pin-bg-card">
           <div className="flex-1 min-h-0 overflow-y-auto">
            {sideCardMode === 'alerts' ? (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Live Alert Feed</h3>
                    <span className="text-xs text-slate-400 font-medium">Engine</span>
                  </div>
                  <span className="text-xs text-slate-500">{liveAlertFeed.length} recent</span>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      { label: 'Critical', count: liveAlertFeed.filter(e => e.severity === 'critical').length, cls: 'bg-red-50 border-red-200 text-red-700' },
                      { label: 'Warning', count: liveAlertFeed.filter(e => e.severity === 'warning').length, cls: 'bg-amber-50 border-amber-200 text-amber-700' },
                      { label: 'Info', count: liveAlertFeed.filter(e => e.severity === 'info').length, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
                    ].map((s) => (
                      <div key={s.label} className={`rounded-lg border px-2 py-2 ${s.cls}`}>
                        <div className="text-lg font-bold">{s.count}</div>
                        <div className="text-2xs uppercase tracking-wider">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={13} className="text-blue-700" />
                        <div className="text-2xs font-bold uppercase tracking-wider text-blue-800">Gulf Incident Cross-Check (48h)</div>
                      </div>
                      <span className="text-2xs text-blue-700">
                        {gulfCrosscheckSummary ? `${gulfCrosscheckSummary.corroborated}/${gulfCrosscheckSummary.incidents} corroborated` : 'monitoring'}
                      </span>
                    </div>
                    {gulfCrosscheckLoading && (
                      <div className="text-2xs text-blue-700/80">Refreshing Gulf signals and comparing to live alerts...</div>
                    )}
                    {!gulfCrosscheckLoading && topGulfIncidents.length === 0 && (
                      <div className="text-2xs text-blue-700/80">No Gulf oil/spill incident signals detected in the last 48 hours.</div>
                    )}
                    {!gulfCrosscheckLoading && topGulfIncidents.length > 0 && (
                      <div className="space-y-1">
                        {topGulfIncidents.map((inc) => (
                          <div key={inc.id} className="rounded border border-blue-200 bg-white px-2 py-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-slate-800 truncate">
                                  [{inc.state}] {inc.title}
                                </div>
                                <div className="text-2xs text-slate-500 truncate">
                                  {inc.source} · {inc.location || 'Gulf region'} · {formatEasternTimestamp(inc.timestamp) ?? inc.timestamp}
                                </div>
                              </div>
                              <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ${
                                inc.status === 'corroborated' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {inc.status === 'corroborated' ? `${inc.relatedAlerts} linked` : 'unconfirmed'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 max-h-[520px] overflow-y-auto">
                    {alertHistoryLoading && (
                      <div className="text-xs text-slate-400 py-6 text-center">Loading live alerts...</div>
                    )}
                    {!alertHistoryLoading && liveAlertFeed.length === 0 && (
                      <div className="text-xs text-slate-400 py-6 text-center">No recent alert events in engine history.</div>
                    )}
                    {!alertHistoryLoading && liveAlertFeed.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => {
                          setSelectedAlertHuc(ev.entityId);
                          setSelectedAlertId(ev.id);
                          setSelectedAlertLevel(ev.severity === 'critical' ? 'CRITICAL' : ev.severity === 'warning' ? 'WATCH' : 'ADVISORY');
                          alertDetailReturnRef.current = 'alerts';
                          setSideCardMode('alert-detail');
                          setFmcDrawerAlert(ev);
                          setFmcDrawerOpen(true);
                          if (/^\d{8}$/.test(ev.entityId)) {
                            const c = centroids[ev.entityId];
                            if (c && mapRef.current) mapRef.current.flyTo({ center: [c.lng, c.lat], zoom: 6, duration: 800 });
                          }
                        }}
                        className="w-full text-left rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-800 truncate">{ev.title}</div>
                            <div className="text-2xs text-slate-500 mt-0.5">
                              {ev.type.toUpperCase()} · {ev.entityLabel || ev.entityId}
                            </div>
                          </div>
                          <span className={`text-2xs font-bold px-2 py-0.5 rounded-full ${
                            ev.severity === 'critical' ? 'bg-red-100 text-red-700'
                              : ev.severity === 'warning' ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {ev.severity.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-2xs text-slate-400 mt-1">{formatEasternTimestamp(ev.createdAt) ?? ev.createdAt}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : sideCardMode === 'alert-detail' ? (
              <>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => { setSideCardMode(alertDetailReturnRef.current); setSelectedAlertHuc(null); setSelectedAlertId(null); }}
                      className="flex items-center gap-1 text-xs font-medium transition-colors text-pin-teal"
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                    >
                      <ChevronLeft size={14} />
                      {alertDetailReturnRef.current === 'state' ? `Back to ${STATE_ABBR_TO_NAME[selectedState] ?? selectedState}` : 'Back to Alerts'}
                    </button>
                    <span className="mx-1 text-pin-border-default">|</span>
                    <MapPin size={15} className="flex-shrink-0 text-pin-teal" />
                    <span className="font-semibold text-pin-text-primary">
                      {selectedHistoryAlert?.entityLabel
                        ?? hucNames[selectedAlertHuc ?? '']
                        ?? selectedAlertHuc
                        ?? 'Unknown'}
                    </span>
                  </CardTitle>
                  {selectedAlertHuc && (
                    <div className="text-2xs mt-0.5 ml-7 text-pin-text-dim">HUC-8: {selectedAlertHuc}</div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4 px-5 pb-5">
                  {selectedHistoryAlert && (
                    <div className="rounded-lg border border-red-200 bg-red-50/60 p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-2xs font-bold uppercase tracking-wider text-red-700">Why This Is Alerting</div>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-bold ${
                          selectedHistoryAlert.severity === 'critical' ? 'bg-red-600 text-white'
                            : selectedHistoryAlert.severity === 'warning' ? 'bg-amber-500 text-white'
                            : 'bg-blue-500 text-white'
                        }`}>
                          {selectedHistoryAlert.severity.toUpperCase()}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-2xs">
                        <div className="rounded border border-red-200 bg-white px-2 py-1.5">
                          <div className="text-red-500">Trigger</div>
                          <div className="font-bold text-red-700">{selectedHistoryAlert.type.toUpperCase()}</div>
                        </div>
                        <div className="rounded border border-red-200 bg-white px-2 py-1.5">
                          <div className="text-red-500">Entity</div>
                          <div className="font-bold text-red-700 truncate" title={selectedHistoryAlert.entityId}>{selectedHistoryAlert.entityId}</div>
                        </div>
                        <div className="rounded border border-red-200 bg-white px-2 py-1.5">
                          <div className="text-red-500">Detected</div>
                          <div className="font-bold text-red-700">{formatRefreshAge(selectedHistoryAlert.createdAt)}</div>
                        </div>
                      </div>
                      {Array.isArray(selectedHistoryAlert.metadata?.rationale) && (selectedHistoryAlert.metadata?.rationale as any[]).length > 0 && (
                        <div className="space-y-1">
                          <div className="text-2xs font-semibold text-red-700">Rationale</div>
                          <div className="space-y-1 max-h-36 overflow-y-auto">
                            {(selectedHistoryAlert.metadata?.rationale as any[]).slice(0, 6).map((r: any, idx: number) => (
                              <div key={`${selectedHistoryAlert.id}-why-${idx}`} className="rounded border border-red-200 bg-white px-2 py-1.5 text-2xs text-slate-700">
                                {String(r)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {Array.isArray(selectedHistoryAlert.metadata?.anomalies) && (selectedHistoryAlert.metadata?.anomalies as any[]).length > 0 && (
                        <div className="space-y-1">
                          <div className="text-2xs font-semibold text-red-700">Anomaly Signals</div>
                          <div className="space-y-1">
                            {(selectedHistoryAlert.metadata?.anomalies as any[]).slice(0, 4).map((a: any, idx: number) => (
                              <div key={`${selectedHistoryAlert.id}-sig-${idx}`} className="rounded border border-red-200 bg-white px-2 py-1.5 text-2xs">
                                <span className="font-semibold text-slate-700">{a.parameter || 'Signal'}</span>
                                <span className="text-slate-500"> · {a.severity || 'n/a'} · delta {typeof a.delta === 'number' ? a.delta.toFixed(1) : String(a.delta ?? 'n/a')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedHucIndices ? (
                    <div className="space-y-4">
                      {/* Composite score gauge */}
                      <div className="flex items-center gap-4 py-2 border-b border-pin-border-subtle">
                        <div className="relative w-20 h-20 flex-shrink-0">
                          <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" stroke="var(--border-subtle)" />
                            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                              stroke={selectedHucIndices.composite >= 80 ? 'var(--status-healthy)' : selectedHucIndices.composite >= 60 ? 'var(--status-watch)' : selectedHucIndices.composite >= 40 ? 'var(--status-impaired)' : 'var(--status-severe)'}
                              strokeDasharray={`${selectedHucIndices.composite} ${100 - selectedHucIndices.composite}`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold text-pin-text-primary">{Math.round(selectedHucIndices.composite)}</span>
                            <span className="text-2xs text-pin-text-dim">
                              {selectedHucIndices.composite >= 80 ? 'Healthy' : selectedHucIndices.composite >= 60 ? 'Watch' : selectedHucIndices.composite >= 40 ? 'Impaired' : 'Severe'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-pin-text-primary">Composite Score</div>
                          <div className="text-2xs mt-1 text-pin-text-dim">
                            Derived from ecological health, permit risk, and infrastructure indices for this HUC-8 watershed.
                          </div>
                        </div>
                      </div>

                      {/* Index breakdown */}
                      <div className="space-y-2">
                        <div className="text-2xs font-bold uppercase tracking-wider text-pin-text-dim">Index Breakdown</div>
                        {[
                          { label: 'Load Velocity', key: 'pearlLoadVelocity', color: '#3b82f6' },
                          { label: 'Infrastructure', key: 'infrastructureFailure', color: 'var(--accent-teal)' },
                          { label: 'Watershed Recovery', key: 'watershedRecovery', color: 'var(--status-healthy)' },
                          { label: 'Permit Risk', key: 'permitRiskExposure', color: 'var(--status-impaired)' },
                          { label: 'Per Capita Load', key: 'perCapitaLoad', color: '#8b5cf6' },
                          { label: 'Ecological Health', key: 'ecologicalHealth', color: '#22c55e' },
                          { label: 'EJ Vulnerability', key: 'ejVulnerability', color: '#ef4444' },
                          { label: 'Governance', key: 'governanceResponse', color: '#f59e0b' },
                        ].map(idx => {
                          const raw = selectedHucIndices[idx.key];
                          const score = raw != null ? Math.round(typeof raw === 'object' && 'value' in raw ? raw.value : raw) : null;
                          return (
                            <div key={idx.key} className="flex items-center gap-2">
                              <div className="text-2xs w-28 text-right truncate text-pin-text-dim">{idx.label}</div>
                              <div className="flex-1 h-2 rounded-full overflow-hidden bg-pin-border-subtle">
                                <div className="h-full rounded-full transition-all" style={{ width: score != null ? `${score}%` : '0%', background: idx.color }} />
                              </div>
                              <div className="text-2xs w-6 font-semibold text-right text-pin-text-primary">{score ?? '\u2014'}</div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Alert level badge */}
                      {selectedAlertLevel && (
                        <div className="flex items-center gap-2 pt-2 border-t border-pin-border-subtle">
                          <span className="text-2xs font-bold uppercase tracking-wider text-pin-text-dim">Alert Level:</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${
                            selectedAlertLevel === 'CRITICAL' ? 'bg-pin-status-severe-bg text-pin-status-severe'
                            : selectedAlertLevel === 'WATCH' ? 'bg-pin-status-watch-bg text-pin-status-watch'
                            : 'bg-pin-status-impaired-bg text-pin-status-impaired'
                          }`}>
                            {selectedAlertLevel}
                          </span>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="text-xs animate-pulse py-8 text-center text-pin-text-dim">Loading watershed indices...</div>
                  )}
                </CardContent>
              </>
            ) : (
              <>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <button
                      onClick={() => { setSideCardMode('alerts'); setSelectedAlertHuc(null); setSelectedAlertId(null); }}
                      className="flex items-center gap-1 text-xs font-medium transition-colors text-pin-teal"
                      onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                    >
                      <ChevronLeft size={14} />
                      Back to Alerts
                    </button>
                    <span className="mx-1 text-pin-border-default">|</span>
                    <MapPin size={15} className="flex-shrink-0 text-pin-text-dim" />
                    <span className="font-semibold text-pin-text-primary">
                      {STATE_ABBR_TO_NAME[selectedState] ?? selectedState} ({selectedState})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 px-5 pb-5">
                  {/* ── Sentinel Alerts for selected state ──────────── */}
                  {(() => {
                    const stateAlerts = [
                      ...sentinel.criticalHucs.filter(h => h.stateAbbr === selectedState),
                      ...sentinel.watchHucs.filter(h => h.stateAbbr === selectedState),
                      ...sentinel.advisoryHucs.filter(h => h.stateAbbr === selectedState),
                    ];
                    const levelColor = (lvl: string) =>
                      lvl === 'CRITICAL' ? { bg: 'var(--status-severe-bg)', text: 'var(--status-severe)' }
                      : lvl === 'WATCH' ? { bg: 'var(--status-watch-bg)', text: 'var(--status-watch)' }
                      : { bg: 'var(--status-impaired-bg)', text: 'var(--status-impaired)' };

                    return stateAlerts.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="text-2xs font-bold uppercase tracking-wider text-pin-text-dim">
                          Sentinel Alerts ({stateAlerts.length})
                        </div>
                        <div className="space-y-1 max-h-[500px] overflow-y-auto">
                          {stateAlerts.map(h => {
                            const lc = levelColor(h.level);
                            return (
                              <div
                                key={h.huc8}
                                className="flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors border border-pin-border-subtle hover:bg-pin-bg-hover"
                                onClick={() => {
                                  setSelectedAlertHuc(h.huc8);
                                  const matched = liveAlertFeed.find((e) => e.entityId === h.huc8);
                                  setSelectedAlertId(matched?.id ?? null);
                                  setSelectedAlertLevel(h.level);
                                  alertDetailReturnRef.current = 'state';
                                  setSideCardMode('alert-detail');
                                  const c = centroids[h.huc8];
                                  if (c && mapRef.current) {
                                    mapRef.current.flyTo({ center: [c.lng, c.lat], zoom: 6, duration: 800 });
                                  }
                                }}
                              >
                                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-2xs font-bold uppercase" style={{ background: lc.bg, color: lc.text }}>
                                  {h.level}
                                </span>
                                <span className="text-xs truncate flex-1 text-pin-text-primary">
                                  {hucNames[h.huc8] ?? h.huc8}
                                </span>
                                <span className="text-2xs tabular-nums text-pin-text-dim">{h.score}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-xs text-pin-text-dim">No active Sentinel alerts for {STATE_ABBR_TO_NAME[selectedState] ?? selectedState}.</div>
                        <div className="text-2xs mt-1 text-pin-text-dim">Sentinel monitors HUC-8 watersheds for anomalous conditions.</div>
                      </div>
                    );
                  })()}
                </CardContent>
              </>
            )}
           </div>
          </Card>

        </div>

        {/* ── STATE DATA REPORT CARD — full width below map ── */}
        {selectedState && (
          <Card className="bg-pin-bg-card">
            <CardContent className="px-5 pt-4 pb-5">
              {stateReportLoading ? (
                <div className="text-xs text-center py-8 text-pin-text-dim">Loading state report...</div>
              ) : stateReport ? (
                <StateDataReportCard report={stateReport} stateName={STATE_ABBR_TO_NAME[selectedState] ?? selectedState} />
              ) : (
                <div className="text-xs text-center py-8 text-pin-text-dim">
                  No data report available for {STATE_ABBR_TO_NAME[selectedState] ?? selectedState}.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── AI INSIGHTS — hidden in overview & monitoring lenses ── */}
        {viewLens !== 'monitoring' && viewLens !== 'overview' && (
          <AIInsightsEngine key={selectedState} role="Federal" stateAbbr={selectedState} regionData={selectedStateRegions as any} />
        )}

        {/* ── MS4 & REGULATORY — Compact vertical card ────── */}
        {viewLens !== 'monitoring' && viewLens !== 'overview' && (() => {
          const ms4 = MS4_JURISDICTIONS[selectedState];
          const ov = overlayByState.get(selectedState);
          if (!ms4 && !ov) return null;
          const total = ms4 ? ms4.phase1 + ms4.phase2 : 0;
          const trendVal = ov?.trend ?? 0;
          const trendLabel = trendVal > 5 ? 'Improving' : trendVal < -5 ? 'Worsening' : 'Stable';
          const trendIsWorsening = trendVal < -5;
          return (
            <Card className="lg:max-w-[280px]">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 size={13} className="text-pin-text-dim" />
                  <span className="pin-section-label text-[10px]">MS4 & Regulatory</span>
                </div>
                <div className="space-y-1.5">
                  {ms4 && (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">Permits</span>
                        <span className="pin-stat-secondary text-sm">{total}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">Phase I / II</span>
                        <span className="text-xs text-pin-text-dim">{ms4.phase1} / {ms4.phase2}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="pin-label">Program</span>
                    <span className="text-xs text-pin-text-dim">{STATE_AGENCIES[selectedState]?.ms4Program || 'NPDES MS4'}</span>
                  </div>
                  {ov && (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">EJ Index</span>
                        <span className="pin-stat-secondary text-sm">{ov.ej}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">WQ Trend</span>
                        <span className={`text-xs font-semibold ${trendIsWorsening ? 'text-pin-status-severe' : 'text-pin-text-dim'}`}>{trendLabel}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ── RESTORATION PLAN — Standalone collapsible card ────── */}
        {lens.showRestorationPlan && activeDetailId && (() => {
          const nccRegion = regionData.find(r => r.id === activeDetailId);
          const regionConfig = getRegionById(activeDetailId);
          const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const stateAbbr = nccRegion?.state || '';
          const level = nccRegion?.alertLevel || 'none';

          // ── Water data params ──
          const params = waterData?.parameters ?? {};

          // ── ATTAINS data (per-waterbody AND bulk — always resolve both for worst-case comparison) ──
          const attainsData = attainsCache[activeDetailId];
          const bulkAttains = (() => {
            const stateData = attainsBulk[stateAbbr];
            if (!stateData) return null;
            const normName = regionName.toLowerCase().replace(/,.*$/, '').trim();
            return stateData.find((a: any) => {
              const aN = a.name.toLowerCase().trim();
              return aN.includes(normName) || normName.includes(aN);
            }) || null;
          })();
          // ── Resolve ATTAINS category & causes using shared helpers ──
          const attainsCategory = resolveAttainsCategory(
            attainsData?.category || '',
            bulkAttains?.category || '',
            level as any,
          );
          const attainsCauses = mergeAttainsCauses(
            attainsData?.causes || [],
            bulkAttains?.causes || [],
          );
          const attainsCycle = attainsData?.cycle || bulkAttains?.cycle || '';

          // ── Compute full restoration plan via engine ──
          const plan = computeRestorationPlan({
            regionName,
            stateAbbr,
            alertLevel: level as any,
            params,
            attainsCategory,
            attainsCauses,
            attainsCycle,
            attainsAcres: (attainsData as any)?.acres ?? (bulkAttains as any)?.acres ?? null,
          });

          // Destructure everything the JSX needs
          const {
            waterType, isCat5, isImpaired, tmdlStatus,
            impairmentClassification, tier1Count, tier2Count, tier3Count,
            totalClassified, pearlAddressable, addressabilityPct,
            hasNutrients, hasBacteria, hasSediment, hasMetals, hasStormwaterMetals,
            hasMercury, hasPFAS, hasPCBs, hasTemperature, hasHabitat, hasTrash,
            hasOrganic, hasDOImpairment,
            doSeverity, bloomSeverity, turbiditySeverity, nutrientSeverity,
            nutrientExceedsBiofilt, bacteriaElevated,
            isMD, thresholdSource, thresholdSourceShort,
            doCritical, doStressed, chlBloom, chlSignificant, chlSevere,
            turbElevated, turbImpaired,
            doVal, chlVal, turbVal, tnVal, tpVal,
            siteSeverityScore, siteSeverityLabel, siteSeverityColor,
            doScore, bloomScore, turbScore, impairScore, monitoringGapScore,
            treatmentPriorities, categories,
            pearlModel, totalBMPs, compliancePathway,
            totalQuads, totalUnits, phase1Quads, phase1Units, isPhasedDeployment,
            phase1AnnualCost, fullAnnualCost, phase1GPM, fullGPM,
            sizingBasis, estimatedAcres, acresSource,
            dataAgeDays, dataConfidence,
            threats, whyBullets, isHealthy,
          } = plan;
          const prelimSeverity = siteSeverityScore; // compat alias
          const severityMultiplier = siteSeverityScore; // compat alias

          if (isHealthy) {
            return (
              <Card className="border-2 border-green-300 shadow-md">
                <div className="px-4 py-4 flex items-center gap-3">
                  <span className="text-2xl">{'\u2705'}</span>
                  <div>
                    <div className="text-sm font-semibold text-green-800">
                      {regionName} — No Restoration Action Indicated
                    </div>
                    <div className="text-xs text-green-600 mt-0.5">
                      This waterbody is currently attaining designated uses with no Category 4/5 impairments or parameter exceedances detected.
                      Continuous monitoring recommended for early warning and baseline documentation.
                    </div>
                  </div>
                </div>
              </Card>
            );
          }

          return (
            <Card className="border-2 border-cyan-300 shadow-md">
              {/* Collapsed summary header — always visible */}
              <button
                onClick={() => setShowRestorationCard(prev => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-50/50 transition-colors rounded-t-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{'\ud83d\udd27'}</span>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-cyan-800 flex items-center gap-2">
                      Restoration Plan — {regionName}
                      <span className={`text-2xs font-bold px-1.5 py-0.5 rounded-full ${siteSeverityColor}`}>
                        {siteSeverityLabel} ({siteSeverityScore})
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {totalBMPs} recommended BMPs · {attainsCauses.length} impairment cause{attainsCauses.length !== 1 ? 's' : ''} · {compliancePathway}
                    </div>
                    {(attainsCategory || isCat5) && (
                      <div className="text-2xs mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className={`font-bold px-1.5 py-0.5 rounded ${
                          isCat5 ? 'bg-red-100 text-red-700' :
                          attainsCategory.includes('4') ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          Cat {isCat5 ? '5' : attainsCategory}{tmdlStatus === 'needed' ? ' \u2014 No TMDL' : tmdlStatus === 'completed' ? ' \u2014 TMDL in place' : tmdlStatus === 'alternative' ? ' \u2014 Alt. controls' : ''}
                        </span>
                        {attainsCauses.length > 0 && (
                          <span className="text-slate-500">
                            Listed for: <span className="font-medium text-slate-700">{attainsCauses.join(', ')}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 text-2xs">
                    {categories.reduce((n: number, c: any) => n + c.modules.filter((m: any) => m.status === 'warranted').length, 0) > 0 && (
                      <span className="bg-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded-full">
                        {categories.reduce((n: number, c: any) => n + c.modules.filter((m: any) => m.status === 'warranted').length, 0)} warranted
                      </span>
                    )}
                    <span className="bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">{totalBMPs} recommended</span>
                    {totalClassified > 0 && (
                      <span className={`font-bold px-1.5 py-0.5 rounded-full ${
                        addressabilityPct >= 80 ? 'bg-green-200 text-green-800' :
                        addressabilityPct >= 50 ? 'bg-amber-200 text-amber-800' :
                        'bg-slate-200 text-slate-700'
                      }`}>
                        {pearlAddressable}/{totalClassified} addressable
                      </span>
                    )}
                  </div>
                  <ChevronDown size={16} className={`text-cyan-600 transition-transform ${showRestorationCard ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Expanded content */}
              {showRestorationCard && (
                <CardContent className="pt-0 pb-4 space-y-4">

                  {/* ═══ EXECUTIVE SUMMARY ═══ */}
                  {(() => {
                    return (
                      <div className="rounded-lg border-2 border-slate-300 bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">Executive Summary</div>
                          <span className={`text-2xs font-bold px-2 py-1 rounded-full ${siteSeverityColor}`}>
                            Site Severity: {siteSeverityLabel} ({siteSeverityScore}/100)
                          </span>
                        </div>

                        {/* Severity score breakdown bar */}
                        <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
                          <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider">{isMD ? 'MD DNR Threshold' : 'EPA Criteria'} Assessment</div>
                          <div className="grid grid-cols-5 gap-1.5 text-2xs">
                            <div className="text-center">
                              <div className={`font-bold ${doSeverity === 'critical' ? 'text-red-700' : doSeverity === 'stressed' ? 'text-amber-600' : doSeverity === 'adequate' ? 'text-green-600' : 'text-slate-400'}`}>
                                {doSeverity === 'unknown' ? '?' : doVal?.toFixed(1)} mg/L
                              </div>
                              <div className="text-slate-500">DO</div>
                              <div className={`text-2xs font-medium ${doSeverity === 'critical' ? 'text-red-600' : doSeverity === 'stressed' ? 'text-amber-600' : 'text-green-600'}`}>
                                {doSeverity !== 'unknown' ? doSeverity : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${bloomSeverity === 'severe' || bloomSeverity === 'significant' ? 'text-red-700' : bloomSeverity === 'bloom' ? 'text-amber-600' : bloomSeverity === 'normal' ? 'text-green-600' : 'text-slate-400'}`}>
                                {bloomSeverity === 'unknown' ? '?' : chlVal} ug/L
                              </div>
                              <div className="text-slate-500">Chl-a</div>
                              <div className={`text-2xs font-medium ${bloomSeverity === 'severe' ? 'text-red-600' : bloomSeverity === 'significant' ? 'text-orange-600' : bloomSeverity === 'bloom' ? 'text-amber-600' : 'text-green-600'}`}>
                                {bloomSeverity !== 'unknown' ? bloomSeverity : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${turbiditySeverity === 'impaired' ? 'text-red-700' : turbiditySeverity === 'elevated' ? 'text-amber-600' : turbiditySeverity === 'clear' ? 'text-green-600' : 'text-slate-400'}`}>
                                {turbiditySeverity === 'unknown' ? '?' : turbVal?.toFixed(1)} FNU
                              </div>
                              <div className="text-slate-500">Turbidity</div>
                              <div className={`text-2xs font-medium ${turbiditySeverity === 'impaired' ? 'text-red-600' : turbiditySeverity === 'elevated' ? 'text-amber-600' : 'text-green-600'}`}>
                                {turbiditySeverity !== 'unknown' ? (turbiditySeverity === 'clear' ? 'ok' : turbiditySeverity) : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${nutrientSeverity === 'excessive' ? 'text-red-700' : nutrientSeverity === 'elevated' ? 'text-amber-600' : nutrientSeverity === 'normal' ? 'text-green-600' : 'text-slate-400'}`}>
                                {nutrientSeverity === 'unknown' ? '?' : `TN ${tnVal?.toFixed(1) ?? '?'}`}
                              </div>
                              <div className="text-slate-500">Nutrients</div>
                              <div className={`text-2xs font-medium ${nutrientSeverity === 'excessive' ? 'text-red-600' : nutrientSeverity === 'elevated' ? 'text-amber-600' : 'text-green-600'}`}>
                                {nutrientSeverity !== 'unknown' ? nutrientSeverity : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-slate-700">{attainsCategory || '?'}</div>
                              <div className="text-slate-500">ATTAINS</div>
                              <div className={`text-2xs font-medium ${isCat5 ? 'text-red-600' : isImpaired ? 'text-amber-600' : 'text-green-600'}`}>
                                {tmdlStatus === 'needed' ? 'no TMDL' : tmdlStatus === 'completed' ? 'has TMDL' : tmdlStatus}
                              </div>
                            </div>
                          </div>
                          {/* Severity bar */}
                          <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                            <div className={`h-2 rounded-full transition-all ${siteSeverityScore >= 75 ? 'bg-red-500' : siteSeverityScore >= 50 ? 'bg-amber-500' : siteSeverityScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, siteSeverityScore)}%` }} />
                          </div>
                          <div className="text-2xs text-slate-400">Composite: DO (25%) + Bloom/Nutrients (25%) + Turbidity (15%) + Impairment (20%) + Monitoring Gap (15%) | Thresholds: {thresholdSource}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Situation */}
                          <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                            <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Situation</div>
                            <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
                              <div><span className="font-semibold">{regionName}</span> is {isCat5 ? 'Category 5 impaired' : attainsCategory.includes('4') ? 'Category 4 impaired' : isImpaired ? 'impaired' : 'under monitoring'}{attainsCauses.length > 0 ? ` for ${attainsCauses.join(', ').toLowerCase()}` : ''}.</div>
                              {dataAgeDays !== null && <div>Most recent data is <span className="font-semibold">{dataAgeDays} days old</span>. Confidence is <span className={`font-semibold ${dataConfidence === 'low' ? 'text-red-600' : dataConfidence === 'moderate' ? 'text-amber-600' : 'text-green-600'}`}>{dataConfidence}</span>.</div>}
                              <div>{tmdlStatus === 'needed' ? 'No approved TMDL is in place.' : tmdlStatus === 'completed' ? 'An approved TMDL exists.' : tmdlStatus === 'alternative' ? 'Alternative controls are in place.' : 'TMDL status is not applicable.'}</div>
                            </div>
                          </div>

                          {/* Treatment Priorities */}
                          <div className="rounded-md bg-red-50 border border-red-200 p-3">
                            <div className="text-2xs font-bold text-red-700 uppercase tracking-wider mb-1.5">Treatment Priorities</div>
                            <div className="space-y-1 text-xs text-red-800 leading-relaxed">
                              {treatmentPriorities.length > 0 ? treatmentPriorities.slice(0, 3).map((tp: any, i: number) => (
                                <div key={i} className="flex items-start gap-1">
                                  <span className={`flex-shrink-0 font-bold ${tp.urgency === 'immediate' ? 'text-red-700' : tp.urgency === 'high' ? 'text-amber-700' : 'text-yellow-700'}`}>
                                    {tp.urgency === 'immediate' ? '!!!' : tp.urgency === 'high' ? '!!' : '!'}
                                  </span>
                                  <span>{tp.driver}</span>
                                </div>
                              )) : (
                                <>
                                  {isImpaired && <div>Regulatory exposure under CWA 303(d) and MS4 permits.</div>}
                                  {(dataAgeDays === null || dataAgeDays > 60) && <div>High uncertainty due to monitoring gaps.</div>}
                                  {!isImpaired && <div>Preventive action recommended to maintain water quality.</div>}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Plan */}
                          <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                            <div className="text-2xs font-bold text-blue-700 uppercase tracking-wider mb-1.5">Plan</div>
                            <div className="space-y-1 text-xs text-blue-800 leading-relaxed">
                              <div>Layered approach:</div>
                              <div className="pl-2 space-y-0.5 text-xs">
                                <div>{'\u2192'} Upstream BMPs and source control</div>
                                <div>{'\u2192'} Nature-based restoration for long-term recovery</div>
                                <div>{'\u2192'} Continuous monitoring and real-time verification</div>
                                <div>{'\u2192'} Community programs for compliance and stewardship</div>
                              </div>
                            </div>
                          </div>

                        </div>

                      </div>
                    );
                  })()}

                  {/* ═══ IMPAIRMENT CLASSIFICATION — What PIN Can/Can't Address ═══ */}
                  {impairmentClassification.length > 0 && (
                    <div className="rounded-lg border-2 border-slate-300 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                          Impairment Classification
                        </div>
                        <div className="flex items-center gap-2 text-2xs">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            addressabilityPct >= 80 ? 'bg-green-200 text-green-800' :
                            addressabilityPct >= 50 ? 'bg-amber-200 text-amber-800' :
                            'bg-red-200 text-red-800'
                          }`}>
                            {pearlAddressable} of {totalClassified} impairment{totalClassified !== 1 ? 's' : ''} treatable ({addressabilityPct}%)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {/* Tier 1 */}
                        {impairmentClassification.filter((i: any) => i.tier === 1).length > 0 && (
                          <div className="text-2xs font-bold text-green-700 uppercase tracking-wider mt-1">Tier 1 — Directly Treatable</div>
                        )}
                        {impairmentClassification.filter((i: any) => i.tier === 1).map((item: any, i: number) => (
                          <div key={`t1-${i}`} className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-green-50 border border-green-100">
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-green-900">{item.cause}</span>
                              <span className="text-green-700 ml-1">— {item.pearlAction}</span>
                            </div>
                          </div>
                        ))}

                        {/* Tier 2 */}
                        {impairmentClassification.filter((i: any) => i.tier === 2).length > 0 && (
                          <div className="text-2xs font-bold text-amber-700 uppercase tracking-wider mt-2">Tier 2 — Indirect / Supporting Treatment</div>
                        )}
                        {impairmentClassification.filter((i: any) => i.tier === 2).map((item: any, i: number) => (
                          <div key={`t2-${i}`} className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-amber-50 border border-amber-100">
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-amber-900">{item.cause}</span>
                              <span className="text-amber-700 ml-1">— {item.pearlAction}</span>
                            </div>
                          </div>
                        ))}

                        {/* Tier 3 */}
                        {impairmentClassification.filter((i: any) => i.tier === 3).length > 0 && (
                          <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mt-2">Tier 3 — Requires Different Intervention</div>
                        )}
                        {impairmentClassification.filter((i: any) => i.tier === 3).map((item: any, i: number) => (
                          <div key={`t3-${i}`} className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-slate-50 border border-slate-200">
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-slate-700">{item.cause}</span>
                              <span className="text-slate-500 ml-1">— {item.pearlAction}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-2xs text-slate-400 pt-1 border-t border-slate-100">
                        Classification based on EPA ATTAINS impairment causes and available treatment technologies. Tier 1: directly treatable. Tier 2: indirect benefit from treatment. Tier 3: requires different intervention.
                      </div>
                    </div>
                  )}

                  {/* Severity methodology footnote */}
                  <div className="text-2xs text-slate-400 pt-1 border-t border-slate-100">
                    Severity assessment derived from {isMD ? 'MD DNR Shallow Water Monitoring thresholds' : 'EPA National Recommended Water Quality Criteria'} and EPA ATTAINS impairment category. Composite weighted: DO (25%), Bloom/Nutrients (25%), Turbidity (15%), Impairment (20%), Monitoring Gap (15%).
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })()}

        </div>
  );
}

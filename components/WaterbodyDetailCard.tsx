// components/cards/WaterbodyDetailCard.tsx
// Reusable waterbody assessment card — used by NCC, SCC, and reports
// Shows: parameter grid, 5-tile row, observations, implications, regulatory context,
//        state agency contact, outreach summary, data provenance

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Info, Shield, Maximize2, X } from 'lucide-react';
import { calculateGrade, generateObservations, generateImplications, computeFreshnessScore, paramAgeTint, TOTAL_DISPLAY_PARAMS } from '@/lib/waterQualityScore';
import { resolveAttainsCategory, mergeAttainsCauses } from '@/lib/restorationEngine';
import { TierBadge } from '@/components/TierBadge';
import { DATA_SOURCES, getTierForSource } from '@/lib/useWaterData';
import type { DataSourceId } from '@/lib/useWaterData';

// ─── Static Config ───────────────────────────────────────────────────────────

const PARAM_DISPLAY: Record<string, { label: string; unit: string; target?: string; good?: (v: number) => boolean }> = {
  temperature: { label: 'Temperature', unit: '°C', target: '<30°C', good: v => v < 30 },
  DO: { label: 'Dissolved O₂', unit: 'mg/L', target: '≥5.0', good: v => v >= 5 },
  pH: { label: 'pH', unit: '', target: '6.5–8.5', good: v => v >= 6.5 && v <= 8.5 },
  turbidity: { label: 'Turbidity', unit: 'NTU', target: '<25', good: v => v < 25 },
  TSS: { label: 'TSS', unit: 'mg/L', target: '<30', good: v => v < 30 },
  TN: { label: 'Total Nitrogen', unit: 'mg/L', target: '<1.0', good: v => v < 1.0 },
  TP: { label: 'Total Phosphorus', unit: 'mg/L', target: '<0.1', good: v => v < 0.1 },
  conductivity: { label: 'Conductivity', unit: 'µS/cm' },
  salinity: { label: 'Salinity', unit: 'PSU' },
  DO_pct: { label: 'DO Saturation', unit: '%', target: '≥60%', good: v => v >= 60 },
  bacteria: { label: 'Bacteria', unit: 'MPN/100mL', target: '<235', good: v => v < 235 },
  chlorophyll: { label: 'Chlorophyll-a', unit: 'µg/L', target: '<20', good: v => v < 20 },
  gage_height: { label: 'Gage Height', unit: 'ft' },
  secchi: { label: 'Secchi Depth', unit: 'Meters' },
};

const PARAM_ORDER = ['DO', 'temperature', 'pH', 'turbidity', 'TSS', 'TN', 'TP', 'conductivity', 'salinity', 'bacteria', 'chlorophyll', 'DO_pct', 'gage_height', 'secchi'];

// Parameters excluded from display (raw field/operational data, not water quality indicators)
const EXCLUDED_PARAMS = new Set(['discharge', 'nitrate', 'nitrite', 'nitrate_nitrite', 'TKN', 'NITRATE', 'NITRITE', 'Nitrate', 'Nitrite']);

const SOURCE_COLOR: Record<string, string> = {
  USGS: 'bg-green-100 text-green-800',
  USGS_DV: 'bg-cyan-50 text-cyan-600',
  ERDDAP: 'bg-cyan-100 text-cyan-800',
  NOAA: 'bg-blue-100 text-blue-800',
  BWB: 'bg-purple-100 text-purple-800',
  WQP: 'bg-indigo-100 text-indigo-800',
  MMW: 'bg-lime-100 text-lime-800',
  EPA_EF: 'bg-orange-100 text-orange-700',
  STATE: 'bg-rose-100 text-rose-700',
  NASA_STREAM: 'bg-indigo-100 text-indigo-700',
  HYDROSHARE: 'bg-fuchsia-100 text-fuchsia-700',
  REFERENCE: 'bg-amber-100 text-amber-800',
  MOCK: 'bg-slate-100 text-slate-600',
};

function levelToLabel(level: string): string {
  return level === 'high' ? 'Severe' : level === 'medium' ? 'Impaired' : level === 'low' ? 'Watch' : 'Healthy';
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface StateAgency {
  name: string;
  division: string;
  url: string;
  phone?: string;
  ms4Program: string;
  cwaSec: string;
}

export interface WaterbodyDetailCardProps {
  // Identity
  regionName: string;
  stateAbbr: string;
  stateName: string;
  alertLevel: string;
  activeAlerts: number;
  lastUpdatedISO?: string;

  // Water data (from useWaterData or equivalent)
  waterData: any;
  waterLoading: boolean;
  hasRealData: boolean;

  // Pre-resolved ATTAINS (caller does cache lookups)
  attainsPerWb?: { category?: string; causes?: string[]; cycle?: string; loading?: boolean } | null;
  attainsBulk?: { category?: string; causes?: string[]; cycle?: string } | null;

  // EJ
  ejData?: { ejIndex?: number | null; loading?: boolean; error?: string } | null;
  ejDetail?: { povertyPct: number; uninsuredPct: number; drinkingWaterViol: number } | null;

  // Ecological
  ecoScore: number;
  ecoData?: { aquaticTE?: number; totalTE?: number; criticalHabitat?: string | number } | null;

  // Overlay (state-level)
  overlay?: { trend?: number; ej?: number; wildlife?: number } | null;

  // State summary (ATTAINS)
  stSummary?: { loading?: boolean; impairedPct?: number; totalAssessed?: number } | null;

  // State agency config
  stateAgency?: StateAgency | null;

  // Data source config (keyed by source ID → display name)
  dataSources?: Record<string, { name: string }>;

  // Coordinates
  coordinates?: { lat: number; lon: number } | null;

  // Callbacks
  onToast?: (msg: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function WaterbodyDetailCard({
  regionName, stateAbbr, stateName, alertLevel: level, activeAlerts: alerts, lastUpdatedISO,
  waterData, waterLoading, hasRealData,
  attainsPerWb, attainsBulk: bulkAttains,
  ejData, ejDetail,
  ecoScore, ecoData,
  overlay, stSummary,
  stateAgency: agency,
  coordinates,
  dataSources = {},
  onToast,
}: WaterbodyDetailCardProps) {

  // ── Expand modal state ──
  const [expandedParam, setExpandedParam] = useState<string | null>(null); // param key or 'health'

  // ── Resolve ATTAINS ──
  const attainsCategory = resolveAttainsCategory(
    attainsPerWb?.category || '',
    bulkAttains?.category || '',
    level as any,
  );
  const attainsCauses = mergeAttainsCauses(
    attainsPerWb?.causes || [],
    bulkAttains?.causes || [],
  );
  const attainsCycle = attainsPerWb?.cycle || bulkAttains?.cycle || '';
  const attainsIsLive = /[1-5]/.test(attainsCategory);
  const attainsLoading = attainsPerWb?.loading ?? false;
  const is303dListed = attainsIsLive
    ? attainsCategory.includes('5') || attainsCategory.includes('4')
    : level === 'high' || level === 'medium';

  // ── EJ ──
  const ejScore = ejData?.ejIndex ?? overlay?.ej ?? 0;
  const ejIsLive = ejData?.ejIndex !== null && ejData?.ejIndex !== undefined && !ejData?.loading;

  // ── Trend ──
  const trend = stSummary && !stSummary.loading && (stSummary.impairedPct ?? 0) > 0
    ? -(stSummary.impairedPct! - 50)
    : overlay?.trend ?? 0;

  // ── Grade ──
  const gradeParams: Record<string, { value: number; lastSampled?: string | null }> = {};
  if (waterData?.parameters) {
    for (const [key, p] of Object.entries(waterData.parameters)) {
      gradeParams[key] = { value: (p as any).value, lastSampled: (p as any).lastSampled };
    }
  }
  const grade = calculateGrade(gradeParams, 'freshwater', {
    attainsCategory,
    is303dListed,
    hasTmdl: is303dListed ? level !== 'high' : undefined,
    impairmentCauseCount: attainsCauses.length,
  });
  const { coverage } = grade;

  // ── Observations ──
  const observations: Array<{ icon: string; text: string }> = [];
  const implications: Array<{ icon: string; text: string }> = [];

  for (const obs of generateObservations(grade)) {
    observations.push({ icon: obs.icon, text: obs.text });
  }

  if (ejScore >= 70) {
    observations.push({ icon: '⚠️', text: `EJ vulnerability is high (${ejScore}/100)${ejDetail ? ` — ${ejDetail.povertyPct}% poverty, ${ejDetail.uninsuredPct}% uninsured, ${ejDetail.drinkingWaterViol} SDWA violations/100k` : ''}.` });
    implications.push({ icon: '🏘️', text: 'Communities near this waterbody face disproportionate environmental and health risks. Eligible for enhanced federal support under Justice40 and EPA EJ programs.' });
  } else if (ejScore >= 40) {
    observations.push({ icon: 'ℹ️', text: `Moderate EJ vulnerability (${ejScore}/100)${ejDetail ? ` — ${ejDetail.povertyPct}% poverty, ${ejDetail.drinkingWaterViol} SDWA violations/100k` : ''}.` });
  }

  if (ecoScore >= 70) {
    observations.push({ icon: '🌿', text: `High ecological sensitivity (${ecoScore}/100) — ${ecoData?.aquaticTE ?? '?'} aquatic T&E species, ${ecoData?.totalTE ?? '?'} total ESA-listed (USFWS ECOS).` });
    implications.push({ icon: '🐟', text: `${ecoData?.criticalHabitat ?? 'Multiple'} designated critical habitat areas. Water quality degradation has outsized ecosystem impacts — restoration co-benefits should be prioritized.` });
  } else if (ecoScore >= 40) {
    observations.push({ icon: '🌿', text: `Moderate ecological sensitivity (${ecoScore}/100) — ${ecoData?.aquaticTE ?? '?'} aquatic T&E species in state (USFWS ECOS).` });
  }

  if (trend < -5) {
    observations.push({ icon: '📉', text: 'State-level water quality trend is worsening.' });
    implications.push({ icon: '🔧', text: 'Systemic pressures likely from land use changes, increased impervious cover, or aging infrastructure.' });
  } else if (trend > 5) {
    observations.push({ icon: '📈', text: 'State-level water quality trend is improving.' });
  }

  if (attainsIsLive && attainsCauses.length > 0) {
    observations.push({ icon: '📋', text: `EPA ATTAINS: ${attainsCauses.length} cause${attainsCauses.length !== 1 ? 's' : ''} of impairment — ${attainsCauses.slice(0, 4).join(', ')}${attainsCauses.length > 4 ? ` +${attainsCauses.length - 4} more` : ''}.` });
  }
  if (attainsIsLive && attainsCategory) {
    observations.push({ icon: '🏛', text: `EPA IR Category: ${attainsCategory}${attainsCycle ? ` (reporting cycle ${attainsCycle})` : ''}.` });
  }
  if (stSummary && !stSummary.loading && (stSummary.totalAssessed ?? 0) > 0) {
    observations.push({ icon: '🗺', text: `Statewide: ${stSummary.impairedPct}% of assessed uses not supporting designated uses (ATTAINS summary).` });
  }

  for (const imp of generateImplications(grade)) {
    implications.push({ icon: imp.icon, text: imp.text });
  }

  // ── Derived colors ──
  const borderColor = grade.canBeGraded
    ? (grade.score! >= 80 ? 'border-green-200' : grade.score! >= 70 ? 'border-yellow-200' : grade.score! >= 60 ? 'border-orange-200' : 'border-red-200')
    : 'border-slate-200';
  const bgColor = grade.canBeGraded
    ? (grade.score! >= 80 ? 'bg-green-50/30' : grade.score! >= 70 ? 'bg-yellow-50/30' : grade.score! >= 60 ? 'bg-orange-50/30' : 'bg-red-50/30')
    : 'bg-slate-50/30';

  // ── Parameter sorting ──
  const params = waterData?.parameters ?? {};
  const sortedKeys = PARAM_ORDER.filter(k => params[k]).concat(
    Object.keys(params).filter(k => !PARAM_ORDER.includes(k))
  );

  const getSourceName = (sourceId: string) => dataSources[sourceId]?.name || sourceId;

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50/80 to-slate-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              {regionName}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5 flex items-center gap-2 flex-wrap">
              {stateAbbr && <span>{stateName || stateAbbr}</span>}
              {coordinates && (
                <>
                  <span>·</span>
                  <span className="font-mono text-slate-400">{coordinates.lat.toFixed(4)}, {coordinates.lon.toFixed(4)}</span>
                </>
              )}
              {waterData && (
                <>
                  <span>·</span>
                  {hasRealData ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                      Live — {waterData.activeSources.filter((s: string) => s !== 'MOCK').map((s: string) => getSourceName(s)).join(' + ')}
                    </span>
                  ) : (
                    <span className="text-amber-600">Reference data</span>
                  )}
                </>
              )}
              <span className="text-slate-400">·</span>
              <span className="text-slate-400">
                Data as of {waterData?.lastSampled
                  ? new Date(waterData.lastSampled).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : lastUpdatedISO
                    ? new Date(lastUpdatedISO).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className={`px-3 py-1.5 rounded-lg border text-sm font-bold ${
              level === 'high' ? 'text-red-600 bg-red-50 border-red-200' :
              level === 'medium' ? 'text-orange-600 bg-orange-50 border-orange-200' :
              level === 'low' ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
              'text-green-600 bg-green-50 border-green-200'
            }`}>
              {levelToLabel(level)}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading state */}
        {waterLoading && (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Fetching from USGS, NOAA, ERDDAP…
          </div>
        )}

        {/* Parameter grid — fixed order, all slots shown, excludes operational params */}
        {!waterLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
            {PARAM_ORDER.concat(Object.keys(params).filter(k => !PARAM_ORDER.includes(k))).filter(k => !EXCLUDED_PARAMS.has(k)).map(key => {
              const p = params[key];
              const display = PARAM_DISPLAY[key] || { label: key, unit: '' };

              if (!p) {
                // Empty slot — neutral card, no color
                return (
                  <div key={key} className="bg-white rounded-lg border border-slate-200 p-2.5 text-center cursor-pointer hover:border-blue-300 transition-colors" onClick={(e) => { e.stopPropagation(); setExpandedParam(key); }}>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-0.5">{display.label}</div>
                    <div className="text-lg font-bold text-slate-300">&mdash;</div>
                    <div className="text-[9px] text-slate-300 mt-1">No data</div>
                  </div>
                );
              }

              const isGood = display.good ? display.good(p.value) : undefined;
              const lastSampled = (p as any).lastSampled;
              const tintClass = paramAgeTint(lastSampled);

              let ageLabel: string | null = null;
              if (lastSampled) {
                const ageMs = Date.now() - new Date(lastSampled).getTime();
                if (!isNaN(ageMs)) {
                  if (ageMs < 3600000) ageLabel = `${Math.max(1, Math.floor(ageMs / 60000))}m ago`;
                  else if (ageMs < 86400000) ageLabel = `${Math.floor(ageMs / 3600000)}h ago`;
                  else ageLabel = `${Math.floor(ageMs / 86400000)}d ago`;
                }
              }

              return (
                <div key={key} className={`rounded-lg border p-2.5 text-center relative group cursor-pointer hover:border-blue-300 transition-colors ${tintClass}`} onClick={(e) => { e.stopPropagation(); setExpandedParam(key); }}>
                  <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); setExpandedParam(key); }} title="Expand details">
                    <Maximize2 size={10} />
                  </button>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{display.label}</div>
                  <div className={`text-lg font-bold ${
                    isGood === true ? 'text-green-700' : isGood === false ? 'text-red-600' : 'text-slate-800'
                  }`}>
                    {p.value < 0.01 && p.value > 0 ? p.value.toFixed(3) : p.value < 1 ? p.value.toFixed(2) : p.value < 100 ? p.value.toFixed(1) : Math.round(p.value).toLocaleString()}
                    {display.unit && <span className="text-[10px] font-normal text-slate-400 ml-0.5">{display.unit}</span>}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLOR[p.source] || 'bg-slate-100 text-slate-500'}`}>
                      {getSourceName(p.source)}
                    </span>
                    <TierBadge tier={getTierForSource(p.source as DataSourceId)} size="xs" compact />
                  </div>
                  <div className="text-[8px] text-slate-400 mt-0.5">
                    {ageLabel || <span className="text-slate-300">No timestamp</span>}
                  </div>
                  {display.target && (
                    <div className="text-[9px] text-slate-400 mt-0.5">Target: {display.target}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Assessment context */}
        {!waterLoading && (() => {
          return (
            <div className="space-y-3">
              {/* 5-tile row */}
              <div className="grid grid-cols-5 gap-2">
                {/* Tile 1: Grade */}
                <div className={`rounded-lg border-2 ${grade.canBeGraded ? grade.borderColor : 'border-slate-300'} ${grade.canBeGraded ? grade.bgColor : 'bg-slate-50'} p-2 text-center relative group cursor-pointer hover:border-blue-300 transition-colors`} onClick={(e) => { e.stopPropagation(); setExpandedParam('health'); }}>
                  <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); setExpandedParam('health'); }} title="Expand details">
                    <Maximize2 size={10} />
                  </button>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Grade</div>
                  <div className={`text-base font-bold ${grade.canBeGraded ? grade.color : 'text-slate-400'}`}>
                    {grade.canBeGraded ? grade.letter : 'N/A'}
                  </div>
                  {grade.canBeGraded && grade.gradeSource === 'attains' && (
                    <div className="text-[9px] text-amber-600 font-medium">ATTAINS-based</div>
                  )}
                  {grade.canBeGraded && grade.gradeSource !== 'attains' && (
                    <div className="text-[9px] text-slate-400">
                      {grade.score}/100{grade.isPartialGrade ? ` · ${grade.gradedParamCount}/${grade.gradedParamTotal} params` : ''}
                    </div>
                  )}
                  {!grade.canBeGraded && <div className="text-[9px] text-slate-400">Ungraded</div>}
                </div>
                {/* Tile 2: Monitoring */}
                <div className={`rounded-lg border-2 ${
                  coverage.liveKeyParamCount === 0
                    ? 'border-amber-300 bg-amber-50'
                    : `${coverage.borderColor} ${coverage.bgColor}`
                } p-2 text-center`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Monitoring</div>
                  {coverage.liveKeyParamCount === 0 ? (
                    <>
                      <div className="text-base font-bold text-amber-600">
                        {coverage.keyParamsPresent > 0 ? 'Reference' : 'None'}
                      </div>
                      <div className="text-[9px] text-amber-500">
                        {coverage.keyParamsPresent > 0 ? `${coverage.keyParamsPresent} ref · No live` : 'No live monitoring'}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`text-base font-bold ${coverage.color}`}>
                        {coverage.icon} {coverage.liveKeyParamCount}/{coverage.keyParamsTotal}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {coverage.liveKeyParamCount >= 5 ? 'Comprehensive' :
                         coverage.liveKeyParamCount >= 3 ? 'Adequate' :
                         'Limited'} live
                      </div>
                    </>
                  )}
                </div>
                {/* Tile 3: EJ Index */}
                <div className={`rounded-lg border-2 ${ejScore >= 70 ? 'border-red-200 bg-red-50' : ejScore >= 40 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'} p-2 text-center`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">EJ Index</div>
                  <div className={`text-base font-bold ${ejScore >= 70 ? 'text-red-700' : ejScore >= 40 ? 'text-amber-700' : 'text-slate-700'}`}>
                    {ejScore}/100
                  </div>
                  <div className="text-[9px] text-slate-400">{ejIsLive ? 'EJScreen' : 'Census/SDWIS'}</div>
                </div>
                {/* Tile 4: Ecological */}
                <div className={`rounded-lg border-2 ${ecoScore >= 70 ? 'border-green-200 bg-green-50' : ecoScore >= 40 ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'} p-2 text-center`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Ecological</div>
                  <div className={`text-base font-bold ${ecoScore >= 70 ? 'text-green-700' : ecoScore >= 40 ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {ecoScore}/100
                  </div>
                  <div className="text-[9px] text-slate-400">USFWS ECOS</div>
                </div>
                {/* Tile 5: Freshness — composite of coverage + recency */}
                {(() => {
                  const allTs: Record<string, string | null | undefined> = {};
                  for (const [k, p] of Object.entries(params)) {
                    if (!EXCLUDED_PARAMS.has(k)) allTs[k] = (p as any).lastSampled ?? null;
                  }
                  // Total = number of non-excluded param slots displayed in grid
                  const displayedSlotCount = PARAM_ORDER.concat(Object.keys(params).filter(k => !PARAM_ORDER.includes(k))).filter(k => !EXCLUDED_PARAMS.has(k)).length;
                  const fresh = computeFreshnessScore(allTs, displayedSlotCount);
                  return (
                    <div className={`rounded-lg border-2 ${
                      fresh.score >= 70 ? 'border-green-200 bg-green-50'
                      : fresh.score >= 40 ? 'border-yellow-200 bg-yellow-50'
                      : 'border-red-200 bg-red-50'
                    } p-2 text-center`}>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Freshness</div>
                      <div className={`text-base font-bold ${
                        fresh.score >= 70 ? 'text-green-700'
                        : fresh.score >= 40 ? 'text-yellow-700'
                        : 'text-red-700'
                      }`}>
                        {fresh.populated}/{fresh.total}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {fresh.label} · {fresh.score}/100
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Observations */}
              {observations.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Observations</div>
                  {observations.map((o, i) => (
                    <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="flex-shrink-0 mt-0.5">{o.icon}</span>
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Implications */}
              {implications.length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Implications</div>
                  {implications.map((o, i) => (
                    <div key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="flex-shrink-0 mt-0.5">{o.icon}</span>
                      <span>{o.text}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sources row */}
              <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400 pt-1">
                <span>Sources: {attainsIsLive ? '✅ ATTAINS' : '⚠ Mock 303(d)'} · {ejIsLive ? '✅ EJScreen' : '✅ Census/SDWIS'} · ALIA monitoring</span>
              </div>

              {/* Regulatory Context */}
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/40 p-3 space-y-2">
                <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Shield size={13} /> Regulatory Context
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-white rounded-md border border-indigo-100 p-2">
                    <div className="text-[10px] text-slate-500 uppercase">303(d) Status {attainsIsLive && <span className="text-green-500 ml-0.5">● ATTAINS</span>}{attainsLoading && <span className="animate-pulse text-blue-400 ml-0.5">fetching...</span>}</div>
                    <div className={`text-sm font-semibold ${is303dListed ? 'text-red-600' : 'text-green-600'}`}>
                      {attainsIsLive
                        ? `${attainsCategory.includes('5') ? 'Listed — Category 5' : attainsCategory.includes('4a') ? 'Listed — Category 4a' : attainsCategory.includes('4') ? 'Category 4' : attainsCategory.includes('3') ? 'Insufficient Data' : attainsCategory.includes('2') ? 'Partially Assessed' : attainsCategory.includes('1') ? 'Attaining' : `Cat. ${attainsCategory}`}`
                        : level === 'high' ? 'Listed — Category 5' : level === 'medium' ? 'Listed — Category 4a' : level === 'low' ? 'Monitored' : 'Attaining'}
                    </div>
                    {attainsIsLive && attainsCauses.length > 0 && (
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate" title={attainsCauses.join(', ')}>
                        Causes: {attainsCauses.slice(0, 3).join(', ')}{attainsCauses.length > 3 ? ` +${attainsCauses.length - 3} more` : ''}
                      </div>
                    )}
                  </div>
                  <div className="bg-white rounded-md border border-indigo-100 p-2">
                    <div className="text-[10px] text-slate-500 uppercase">TMDL Coverage</div>
                    <div className={`text-sm font-semibold ${level === 'high' ? 'text-orange-600' : 'text-green-600'}`}>
                      {level === 'high' ? 'Needed — Not established' : level === 'medium' ? 'Approved TMDL' : 'Not required'}
                    </div>
                  </div>
                  <div className="bg-white rounded-md border border-indigo-100 p-2">
                    <div className="text-[10px] text-slate-500 uppercase">MS4 Permit</div>
                    <div className="text-sm font-semibold text-slate-700">{agency?.ms4Program || 'NPDES MS4'}</div>
                  </div>
                  <div className="bg-white rounded-md border border-indigo-100 p-2">
                    <div className="text-[10px] text-slate-500 uppercase">CWA Authority</div>
                    <div className="text-sm font-semibold text-slate-700">{agency?.cwaSec || '§303(d)/§402'}</div>
                  </div>
                </div>
                {level === 'high' && (
                  <div className="text-xs text-indigo-700 bg-indigo-100/60 rounded px-2 py-1.5">
                    ⚡ <span className="font-medium">Action recommended:</span> This waterbody is Category 5 impaired without an approved TMDL. Federal oversight or enforcement referral may be warranted under CWA §303(d). Consider coordinating with the state agency on TMDL development timeline.
                  </div>
                )}
                {level === 'medium' && ejScore >= 60 && (
                  <div className="text-xs text-indigo-700 bg-indigo-100/60 rounded px-2 py-1.5">
                    ⚡ <span className="font-medium">EJ priority overlap:</span> This impaired waterbody intersects a high EJ-burden community. Eligible for enhanced federal support under Executive Order 14008 (Justice40) and EPA Office of Environmental Justice programs.
                  </div>
                )}
              </div>

              {/* State Agency Contact */}
              {agency && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
                  <div className="text-xs font-semibold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
                    🏛 State Agency Contact
                  </div>
                  <div className="bg-white rounded-md border border-emerald-100 p-3">
                    <div className="font-medium text-sm text-slate-800">{agency.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{agency.division}</div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <a href={agency.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md transition-colors">
                        🔗 Water Quality Program →
                      </a>
                      {agency.phone && (
                        <a href={`tel:${agency.phone}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md transition-colors">
                          📞 {agency.phone}
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Pre-drafted outreach summary */}
                  <div className="bg-white rounded-md border border-emerald-100 p-3 space-y-1.5">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Outreach Summary — Ready to Adapt</div>
                    <div className="text-xs text-slate-700 leading-relaxed">
                      <span className="font-medium">{regionName}</span> in {stateName || stateAbbr} currently shows{' '}
                      <span className={`font-semibold ${level === 'high' ? 'text-red-600' : level === 'medium' ? 'text-orange-600' : 'text-green-600'}`}>
                        {levelToLabel(level).toLowerCase()}
                      </span>{' '}
                      conditions with {alerts} active alert{alerts !== 1 ? 's' : ''}.
                      {ejScore >= 60 ? ` EJ vulnerability is elevated (${ejScore}/100), indicating disproportionate community health risk.` : ''}
                      {ecoScore >= 60 ? ` Ecological sensitivity is high (${ecoScore}/100), with critical habitat or species concerns.` : ''}
                      {' '}ALIA's multi-stage biofiltration system could address MS4 compliance requirements under the{' '}
                      {agency.ms4Program} permit while providing measurable water quality improvements and aquatic restoration co-benefits.
                    </div>
                    <button
                      onClick={() => {
                        const text = `${regionName} in ${stateName || stateAbbr} currently shows ${levelToLabel(level).toLowerCase()} conditions with ${alerts} active alert${alerts !== 1 ? 's' : ''}. ALIA's multi-stage biofiltration system could address MS4 compliance requirements under the ${agency.ms4Program} permit while providing measurable water quality improvements and aquatic restoration co-benefits.`;
                        navigator.clipboard.writeText(text).then(() => {
                          onToast?.('Outreach summary copied to clipboard');
                        });
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 mt-1"
                    >
                      📋 Copy Summary
                    </button>
                  </div>

                  {/* Federal resources */}
                  <div className="flex flex-wrap gap-1.5">
                    <a href="https://www.epa.gov/npdes/npdes-stormwater-program" target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
                      EPA Stormwater Program →
                    </a>
                    <a href="https://www.epa.gov/tmdl" target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
                      EPA TMDL Resources →
                    </a>
                    <a href="https://www.epa.gov/waterdata/waters-geospatial-data-downloads" target="_blank" rel="noopener noreferrer"
                      className="text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full">
                      WATERS GIS Data →
                    </a>
                    {ejScore >= 50 && (
                      <a href="https://screeningtool.geoplatform.gov/" target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-purple-600 hover:text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full">
                        CEJST Screening Tool →
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Data Provenance */}
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Data Provenance</div>
                <div className="text-[10px] text-slate-400 italic">
                  This assessment is informational and derived from public sources. It is not an official EPA, state, or federal determination.
                </div>
                <div className="text-[11px] text-slate-500 space-y-0.5">
                  <div>• <span className="font-medium">Alert level & active alerts</span> — ALIA NCC regional monitoring database (aggregated from USGS NWIS, Water Quality Portal, NOAA CO-OPS, and other public feeds)</div>
                  <div>• <span className="font-medium">EJ vulnerability index</span> — {ejIsLive
                    ? <span className="text-green-600 font-medium">EPA EJScreen API (live lookup)</span>
                    : <>Composite derived from <a href="https://data.census.gov" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Census ACS</a> + EPA SDWIS state-level indicators</>
                  }</div>
                  <div>• <span className="font-medium">Ecological sensitivity</span> — Derived from <a href="https://ecos.fws.gov/ecp/species-reports" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">USFWS ECOS</a> Threatened & Endangered species data</div>
                  <div>• <span className="font-medium">WQ trend</span> — {stSummary && !stSummary.loading && (stSummary.totalAssessed ?? 0) > 0
                    ? <span className="text-green-600 font-medium">ATTAINS state summary ({stSummary.impairedPct}% impaired of {stSummary.totalAssessed?.toLocaleString()} assessed uses)</span>
                    : 'Comparison of state integrated report (§305(b)) assessment periods (most recent cycle vs. prior)'
                  }</div>
                  <div>• <span className="font-medium">303(d) & TMDL status</span> — {attainsIsLive
                    ? <span className="text-green-600 font-medium">EPA ATTAINS API (live — cycle {attainsCycle || 'latest'}){attainsCauses.length > 0 ? ` — ${attainsCauses.length} cause${attainsCauses.length !== 1 ? 's' : ''} of impairment` : ''}</span>
                    : <>Derived from alert logic and public indicators; for official listings consult{' '}
                      <a href="https://www.epa.gov/waterdata/attains" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">EPA ATTAINS</a>{' '}
                      or the relevant state agency directly</>
                  }</div>
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-2">Important Notes</div>
                <div className="text-[10px] text-slate-400 space-y-0.5">
                  <div>• This card is read-only at the national level. Corrections, updates, and official designations flow through state agency review processes.</div>
                  <div>• ALIA does not perform primary data collection or regulatory assessments. All grades, alerts, and indices are automated interpretations of publicly available data and should not be used as substitutes for official agency reports or compliance decisions.</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Compliance Context — EPA Envirofacts enrichment */}
        {waterData?.parameters?._epa_violations && (
          <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-orange-800 uppercase tracking-wide flex items-center gap-1.5">
              <Shield size={13} /> Compliance Context
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium ml-1">EPA Envirofacts</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-medium">{waterData.parameters._epa_violations.value}</span> SDWIS drinking water violation{waterData.parameters._epa_violations.value !== 1 ? 's' : ''} found
              in this state via EPA Envirofacts.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://data.epa.gov/efservice/" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-orange-600 hover:text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                EPA Envirofacts Portal →
              </a>
              <a href="https://echo.epa.gov/" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-orange-600 hover:text-orange-800 bg-orange-100 px-2 py-0.5 rounded-full">
                ECHO Compliance →
              </a>
            </div>
          </div>
        )}

        {/* CBP DataHub Enrichment — Chesapeake Bay watershed only */}
        {waterData?.parameters?._cbp_fluorescence && (
          <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
              Chlorophyll Profiles
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium ml-1">CBP DataHub</span>
            </div>
            <div className="text-xs text-slate-600">
              Latest chlorophyll fluorescence (CHL_F): <span className="font-medium">{waterData.parameters._cbp_fluorescence.value}</span> {waterData.parameters._cbp_fluorescence.unit} in this HUC8 watershed via CBP Fluorescence monitoring.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://datahub.chesapeakebay.net/Fluorescence" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-teal-600 hover:text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                CBP Fluorescence Data →
              </a>
            </div>
          </div>
        )}

        {waterData?.parameters?._cbp_pointsource && (
          <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
              Point Source Discharges
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium ml-1">CBP DataHub</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-medium">{waterData.parameters._cbp_pointsource.value}</span> active discharge {waterData.parameters._cbp_pointsource.value === 1 ? 'facility' : 'facilities'} tracked in this watershed via CBP Point Source monitoring.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://datahub.chesapeakebay.net/PointSource" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-teal-600 hover:text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                CBP Point Source Data →
              </a>
            </div>
          </div>
        )}

        {waterData?.parameters?._cbp_toxics && (
          <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
              Contaminant Monitoring
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium ml-1">CBP DataHub</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-medium">{waterData.parameters._cbp_toxics.value}</span> contaminant {waterData.parameters._cbp_toxics.value === 1 ? 'sample' : 'samples'} (PAH, pesticides, metals) recorded in this HUC8 watershed over the past 5 years.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://datahub.chesapeakebay.net/Toxics" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-teal-600 hover:text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                CBP Toxics Data →
              </a>
            </div>
          </div>
        )}

        {waterData?.parameters?._cbp_benthic && (
          <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
              Benthic Health
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium ml-1">CBP DataHub</span>
            </div>
            <div className="text-xs text-slate-600">
              Benthic Index of Biotic Integrity (IBI): <span className="font-medium">{waterData.parameters._cbp_benthic.value}</span> {waterData.parameters._cbp_benthic.unit} — measures bottom-dwelling organism community health in tidal waters.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://datahub.chesapeakebay.net/LivingResources" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-teal-600 hover:text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                CBP Living Resources Data →
              </a>
            </div>
          </div>
        )}

        {/* CEDEN Enrichment — California state data */}
        {waterData?.parameters?._ceden_bacteria && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
              California Water Quality
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium ml-1">CEDEN</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-medium">{waterData.parameters._ceden_bacteria.value}</span> bacteria indicator {waterData.parameters._ceden_bacteria.value === 1 ? 'sample' : 'samples'} (E.&nbsp;coli, Enterococcus, Coliform) recorded near this location via California&apos;s CEDEN monitoring network.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://data.ca.gov/dataset/surface-water-chemistry-results" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-amber-600 hover:text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                CEDEN Chemistry Data →
              </a>
            </div>
          </div>
        )}

        {waterData?.parameters?._ceden_toxicity && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
              Toxicity Monitoring
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium ml-1">CEDEN</span>
            </div>
            <div className="text-xs text-slate-600">
              <span className="font-medium">{waterData.parameters._ceden_toxicity.value}</span> toxicity {waterData.parameters._ceden_toxicity.value === 1 ? 'test' : 'tests'} recorded near this location. {waterData.parameters._ceden_toxicity.parameterName}
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://data.ca.gov/dataset/surface-water-toxicity-results" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-amber-600 hover:text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                CEDEN Toxicity Data →
              </a>
            </div>
          </div>
        )}

        {/* Supplementary: Satellite Data (NASA STREAM) */}
        {waterData && !waterLoading && (
          <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-indigo-800 uppercase tracking-wide flex items-center gap-1.5">
              Satellite Data
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium ml-1">NASA</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Satellite-derived water quality estimates (chlorophyll-a, turbidity, Secchi depth) may be available for this waterbody via NASA STREAM and Landsat/Sentinel imagery.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href="https://earthdata.nasa.gov/topics/water-quality" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">
                NASA Earth Data — Water Quality →
              </a>
              <a href="https://oceancolor.gsfc.nasa.gov/" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-indigo-600 hover:text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full">
                Ocean Color Web →
              </a>
            </div>
          </div>
        )}

        {/* Supplementary: Related Datasets (HydroShare) */}
        {waterData && !waterLoading && (
          <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/30 p-3 space-y-1.5">
            <div className="text-xs font-semibold text-fuchsia-800 uppercase tracking-wide flex items-center gap-1.5">
              Related Datasets
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 font-medium ml-1">HydroShare</span>
            </div>
            <div className="text-[11px] text-slate-500">
              CUAHSI HydroShare may have research datasets, model outputs, and historical data related to {regionName}.
            </div>
            <div className="flex flex-wrap gap-1.5">
              <a href={`https://www.hydroshare.org/search/?q=${encodeURIComponent(regionName)}`} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-fuchsia-600 hover:text-fuchsia-800 bg-fuchsia-100 px-2 py-0.5 rounded-full">
                Search HydroShare for &ldquo;{regionName}&rdquo; →
              </a>
              <a href="https://www.hydroshare.org" target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-fuchsia-600 hover:text-fuchsia-800 bg-fuchsia-100 px-2 py-0.5 rounded-full">
                HydroShare Repository →
              </a>
            </div>
          </div>
        )}

        {/* Source attribution strip */}
        {waterData && waterData.sourceDetails?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
            <span className="font-medium">Sources:</span>
            {waterData.sourceDetails.map((sd: any, i: number) => (
              <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${SOURCE_COLOR[sd.source.id] || 'bg-slate-100'}`}>
                {sd.source.name} ({sd.parameterCount}) — {sd.stationName}
                <TierBadge tier={getTierForSource(sd.source.id as DataSourceId)} size="xs" compact />
              </span>
            ))}
            {waterData.lastSampled && (
              <span className="ml-auto text-slate-400">
                Updated: {new Date(waterData.lastSampled).toLocaleString()}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-blue-200/50 text-[10px] text-slate-400">
          <Info size={10} className="flex-shrink-0" />
          <span>Grades derived from {waterData?.activeSources?.filter((s: string) => s !== 'MOCK').join(', ') || 'EPA ATTAINS'} against regulatory targets. Informational only — not an official assessment.</span>
        </div>

        {/* Expand modal overlay */}
        {expandedParam && (() => {
          const isHealth = expandedParam === 'health';
          const p = !isHealth ? params[expandedParam] : null;
          const display = !isHealth && p ? (PARAM_DISPLAY[expandedParam] || { label: p.parameterName || expandedParam, unit: p.unit || '' }) : null;
          const isGood = display?.good && p ? display.good(p.value) : undefined;

          // Compute age for parameter
          let ageLabel: string | null = null;
          let ageMs: number | null = null;
          if (p?.lastSampled) {
            ageMs = Date.now() - new Date(p.lastSampled).getTime();
            if (!isNaN(ageMs)) {
              if (ageMs < 3600000) ageLabel = `${Math.max(1, Math.floor(ageMs / 60000))} min ago`;
              else if (ageMs < 86400000) ageLabel = `${Math.floor(ageMs / 3600000)} hours ago`;
              else ageLabel = `${Math.floor(ageMs / 86400000)} days ago`;
            }
          }

          // Simple sparkline from value (simulated range visualization)
          const renderSparkline = (value: number, target?: { min?: number; max?: number }) => {
            const min = target?.min ?? 0;
            const max = target?.max ?? value * 2;
            const range = max - min || 1;
            const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));
            return (
              <div className="mt-3">
                <div className="text-[10px] text-slate-500 mb-1">Value in range</div>
                <div className="h-3 bg-slate-100 rounded-full relative overflow-hidden">
                  <div className={`h-full rounded-full ${isGood === true ? 'bg-green-400' : isGood === false ? 'bg-red-400' : 'bg-blue-400'}`}
                    style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                  <span>{min}{display?.unit ? ` ${display.unit}` : ''}</span>
                  <span>{max}{display?.unit ? ` ${display.unit}` : ''}</span>
                </div>
              </div>
            );
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={(e) => { e.stopPropagation(); setExpandedParam(null); }}>
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[420px] max-w-[90vw] max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {isHealth ? 'Waterbody Health Grade' : display?.label || expandedParam}
                  </h3>
                  <button onClick={() => setExpandedParam(null)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {isHealth ? (
                    <>
                      {/* Health grade expanded view */}
                      <div className="text-center">
                        <div className={`text-5xl font-bold ${grade.canBeGraded ? grade.color : 'text-slate-400'}`}>
                          {grade.canBeGraded ? grade.letter : 'N/A'}
                        </div>
                        {grade.canBeGraded && (
                          <div className="text-lg text-slate-500 mt-1">{grade.score}/100</div>
                        )}
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
                        {grade.reason}
                      </div>
                      {grade.canBeGraded && (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-slate-500">Source</div>
                            <div className="font-medium text-slate-700">{grade.gradeSource === 'attains' ? 'EPA ATTAINS' : grade.gradeSource === 'sensor' ? 'Live sensors' : 'N/A'}</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-slate-500">Parameters</div>
                            <div className="font-medium text-slate-700">{grade.gradedParamCount}/{grade.gradedParamTotal} graded</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-slate-500">Monitoring</div>
                            <div className="font-medium text-slate-700">{coverage.liveKeyParamCount} live / {coverage.referenceKeyParamCount} ref</div>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-2">
                            <div className="text-slate-500">Freshness</div>
                            <div className="font-medium text-slate-700">
                              {(() => {
                                const allTs: Record<string, string | null | undefined> = {};
                                for (const [k, val] of Object.entries(params)) {
                                  allTs[k] = (val as any).lastSampled ?? null;
                                }
                                const f = computeFreshnessScore(allTs, TOTAL_DISPLAY_PARAMS);
                                return `${f.populated}/${f.total} · ${f.label}`;
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                      {coverage.missingLabels.length > 0 && (
                        <div className="text-xs text-slate-500">
                          <div className="font-medium text-slate-600 mb-1">Missing parameters:</div>
                          <div className="flex flex-wrap gap-1">
                            {coverage.missingLabels.map((label, i) => (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-full text-[10px]">{label}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : p && display ? (
                    <>
                      {/* Parameter expanded view */}
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${
                          isGood === true ? 'text-green-700' : isGood === false ? 'text-red-600' : 'text-slate-800'
                        }`}>
                          {p.value < 0.01 && p.value > 0 ? p.value.toFixed(4) : p.value < 1 ? p.value.toFixed(3) : p.value < 100 ? p.value.toFixed(2) : Math.round(p.value).toLocaleString()}
                          <span className="text-base font-normal text-slate-400 ml-1">{display.unit}</span>
                        </div>
                        <div className={`text-sm mt-1 font-medium ${
                          isGood === true ? 'text-green-600' : isGood === false ? 'text-red-500' : 'text-slate-500'
                        }`}>
                          {isGood === true ? 'Within target range' : isGood === false ? 'Outside target range' : 'No target defined'}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-slate-50 rounded-lg p-2">
                          <div className="text-slate-500">Target</div>
                          <div className="font-medium text-slate-700">{display.target || 'N/A'}</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <div className="text-slate-500">Source</div>
                          <div className="font-medium text-slate-700 flex items-center gap-1">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${SOURCE_COLOR[p.source] || 'bg-slate-100 text-slate-500'}`}>
                              {getSourceName(p.source)}
                            </span>
                            <TierBadge tier={getTierForSource(p.source as DataSourceId)} size="xs" />
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <div className="text-slate-500">Last sampled</div>
                          <div className="font-medium text-slate-700">
                            {p.lastSampled
                              ? new Date(p.lastSampled).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : 'No timestamp'}
                          </div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2">
                          <div className="text-slate-500">Data age</div>
                          <div className="font-medium text-slate-700">{ageLabel || 'Unknown'}</div>
                        </div>
                      </div>
                      {p.stationName && (
                        <div className="bg-slate-50 rounded-lg p-2 text-xs">
                          <div className="text-slate-500">Station</div>
                          <div className="font-medium text-slate-700">{p.stationName}{p.stationId ? ` (${p.stationId})` : ''}</div>
                        </div>
                      )}
                      {/* Range bar */}
                      {display.good && renderSparkline(p.value, display.target ? {
                        min: display.target.includes('≥') ? 0 : undefined,
                        max: display.target.includes('<') ? parseFloat(display.target.replace(/[^0-9.]/g, '')) * 1.5 : undefined,
                      } : undefined)}
                    </>
                  ) : !isHealth ? (
                    <>
                      {/* Empty parameter — no data reported */}
                      <div className="text-center py-6">
                        <div className="text-4xl font-bold text-slate-300">&mdash;</div>
                        <div className="text-sm text-slate-500 mt-2">No data reported</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {(PARAM_DISPLAY[expandedParam]?.label || expandedParam)} has no monitoring data for this waterbody.
                        </div>
                      </div>
                      {PARAM_DISPLAY[expandedParam]?.target && (
                        <div className="bg-slate-50 rounded-lg p-2 text-xs">
                          <div className="text-slate-500">Target</div>
                          <div className="font-medium text-slate-700">{PARAM_DISPLAY[expandedParam].target}</div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

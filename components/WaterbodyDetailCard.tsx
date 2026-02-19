// components/cards/WaterbodyDetailCard.tsx
// Reusable waterbody assessment card — used by NCC, SCC, and reports
// Shows: parameter grid, 5-tile row, observations, implications, regulatory context,
//        state agency contact, outreach summary, data provenance

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Info, Shield } from 'lucide-react';
import { calculateGrade, generateObservations, generateImplications } from '@/lib/waterQualityScore';
import { resolveAttainsCategory, mergeAttainsCauses } from '@/lib/restorationEngine';

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
  discharge: { label: 'Discharge', unit: 'cfs' },
  DO_pct: { label: 'DO Saturation', unit: '%', target: '≥60%', good: v => v >= 60 },
  bacteria: { label: 'Bacteria', unit: 'MPN/100mL', target: '<235', good: v => v < 235 },
  chlorophyll: { label: 'Chlorophyll-a', unit: 'µg/L', target: '<20', good: v => v < 20 },
  gage_height: { label: 'Gage Height', unit: 'ft' },
  secchi: { label: 'Secchi Depth', unit: 'Meters' },
};

const PARAM_ORDER = ['DO', 'temperature', 'pH', 'turbidity', 'TSS', 'TN', 'TP', 'conductivity', 'salinity', 'discharge', 'bacteria', 'chlorophyll', 'DO_pct', 'gage_height', 'secchi'];

const SOURCE_COLOR: Record<string, string> = {
  USGS: 'bg-green-100 text-green-800',
  ERDDAP: 'bg-cyan-100 text-cyan-800',
  NOAA: 'bg-blue-100 text-blue-800',
  BWB: 'bg-purple-100 text-purple-800',
  WQP: 'bg-indigo-100 text-indigo-800',
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
  dataSources = {},
  onToast,
}: WaterbodyDetailCardProps) {

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

        {/* Parameter grid */}
        {!waterLoading && sortedKeys.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 mb-3">
            {sortedKeys.map(key => {
              const p = params[key];
              const display = PARAM_DISPLAY[key] || { label: p.parameterName || key, unit: p.unit || '' };
              const isGood = display.good ? display.good(p.value) : undefined;

              return (
                <div key={key} className="bg-white rounded-lg border border-slate-200 p-2.5 text-center">
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
                <div className={`rounded-lg border-2 ${grade.canBeGraded ? grade.borderColor : 'border-slate-300'} ${grade.canBeGraded ? grade.bgColor : 'bg-slate-50'} p-2 text-center`}>
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
                <div className={`rounded-lg border-2 ${coverage.borderColor} ${coverage.bgColor} p-2 text-center`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Monitoring</div>
                  <div className={`text-base font-bold ${coverage.color}`}>
                    {coverage.icon} {coverage.keyParamsPresent}/{coverage.keyParamsTotal}
                  </div>
                  <div className="text-[9px] text-slate-400">{coverage.label}</div>
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
                {/* Tile 5: Freshness — uses weighted average age across ALL key params */}
                <div className={`rounded-lg border-2 ${
                  coverage.dataAgeDays !== null && coverage.dataAgeDays > 180 ? 'border-red-200 bg-red-50'
                  : coverage.dataAgeDays !== null && coverage.dataAgeDays > 60 ? 'border-orange-200 bg-orange-50'
                  : coverage.dataAgeDays !== null && coverage.dataAgeDays > 14 ? 'border-yellow-200 bg-yellow-50'
                  : 'border-green-200 bg-green-50'
                } p-2 text-center`}>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">Freshness</div>
                  <div className={`text-base font-bold ${
                    coverage.dataAgeDays !== null && coverage.dataAgeDays > 180 ? 'text-red-700'
                    : coverage.dataAgeDays !== null && coverage.dataAgeDays > 60 ? 'text-orange-700'
                    : coverage.dataAgeDays !== null && coverage.dataAgeDays > 14 ? 'text-yellow-700'
                    : 'text-green-700'
                  }`}>
                    {coverage.freshnessLabel}
                  </div>
                  <div className="text-[9px] text-slate-400">
                    {coverage.liveKeyParamCount > 0
                      ? `${coverage.liveKeyParamCount} live · ${coverage.referenceKeyParamCount} ref`
                      : `${coverage.keyParamsPresent} reference only`}
                  </div>
                </div>
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
                <span>Sources: {attainsIsLive ? '✅ ATTAINS' : '⚠ Mock 303(d)'} · {ejIsLive ? '✅ EJScreen' : '✅ Census/SDWIS'} · PEARL monitoring</span>
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
                      {' '}PEARL's multi-stage biofiltration system could address MS4 compliance requirements under the{' '}
                      {agency.ms4Program} permit while providing measurable water quality improvements and aquatic restoration co-benefits.
                    </div>
                    <button
                      onClick={() => {
                        const text = `${regionName} in ${stateName || stateAbbr} currently shows ${levelToLabel(level).toLowerCase()} conditions with ${alerts} active alert${alerts !== 1 ? 's' : ''}. PEARL's multi-stage biofiltration system could address MS4 compliance requirements under the ${agency.ms4Program} permit while providing measurable water quality improvements and aquatic restoration co-benefits.`;
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
                  <div>• <span className="font-medium">Alert level & active alerts</span> — PEARL NCC regional monitoring database (aggregated from USGS NWIS, Water Quality Portal, NOAA CO-OPS, and other public feeds)</div>
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
                  <div>• PEARL does not perform primary data collection or regulatory assessments. All grades, alerts, and indices are automated interpretations of publicly available data and should not be used as substitutes for official agency reports or compliance decisions.</div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Source attribution strip */}
        {waterData && waterData.sourceDetails?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
            <span className="font-medium">Sources:</span>
            {waterData.sourceDetails.map((sd: any, i: number) => (
              <span key={i} className={`px-1.5 py-0.5 rounded-full ${SOURCE_COLOR[sd.source.id] || 'bg-slate-100'}`}>
                {sd.source.name} ({sd.parameterCount}) — {sd.stationName}
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
      </CardContent>
    </Card>
  );
}

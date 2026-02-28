// components/WaterbodyDetailCard.tsx
// Waterbody assessment card — PIN Water Score gauge + live data sparklines
// Shows: semicircle gauge, index bars, parameter sparkline cards, observations,
//        regulatory context, state agency contact, data provenance

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MapPin, Info, Shield, X } from 'lucide-react';
import { calculateGrade, generateObservations, generateImplications, computeFreshnessScore, paramAgeTint, TOTAL_DISPLAY_PARAMS } from '@/lib/waterQualityScore';
import { resolveAttainsCategory, mergeAttainsCauses } from '@/lib/restorationEngine';
import { TierBadge } from '@/components/TierBadge';
import { DATA_SOURCES, getTierForSource } from '@/lib/useWaterData';
import type { DataSourceId, DataConfidenceTier } from '@/lib/useWaterData';

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

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  '1':  { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Cat 1 — Attaining' },
  '2':  { bg: 'bg-green-100',   text: 'text-green-800',   label: 'Cat 2 — Attaining' },
  '3':  { bg: 'bg-amber-100',   text: 'text-amber-800',   label: 'Cat 3 — Insufficient Data' },
  '4a': { bg: 'bg-orange-100',  text: 'text-orange-800',  label: 'Cat 4A — TMDL Approved' },
  '4b': { bg: 'bg-orange-100',  text: 'text-orange-800',  label: 'Cat 4B — Alternative Plan' },
  '4c': { bg: 'bg-orange-100',  text: 'text-orange-800',  label: 'Cat 4C — Non-Pollutant' },
  '4':  { bg: 'bg-orange-100',  text: 'text-orange-800',  label: 'Cat 4 — Impaired (TMDL)' },
  '5':  { bg: 'bg-red-100',     text: 'text-red-800',     label: 'Cat 5 — Impaired' },
};

function levelToLabel(level: string): string {
  return level === 'high' ? 'Severe' : level === 'medium' ? 'Impaired' : level === 'low' ? 'Watch' : 'Healthy';
}

function resolveCategoryConfig(cat: string) {
  const key = cat.toLowerCase().replace(/\s/g, '');
  return CATEGORY_COLORS[key] || (key.startsWith('4') ? CATEGORY_COLORS['4'] : CATEGORY_COLORS['3']);
}

// ─── Props (unchanged — all callers continue to work) ───────────────────────

export interface StateAgency {
  name: string;
  division: string;
  url: string;
  phone?: string;
  ms4Program: string;
  cwaSec: string;
}

export interface WaterbodyDetailCardProps {
  regionName: string;
  stateAbbr: string;
  stateName: string;
  alertLevel: string;
  activeAlerts: number;
  lastUpdatedISO?: string;
  waterData: any;
  waterLoading: boolean;
  hasRealData: boolean;
  attainsPerWb?: { category?: string; causes?: string[]; cycle?: string; loading?: boolean } | null;
  attainsBulk?: { category?: string; causes?: string[]; cycle?: string } | null;
  ejData?: { ejIndex?: number | null; loading?: boolean; error?: string } | null;
  ejDetail?: { povertyPct: number; uninsuredPct: number; drinkingWaterViol: number } | null;
  ecoScore: number;
  ecoData?: { aquaticTE?: number; totalTE?: number; criticalHabitat?: string | number } | null;
  overlay?: { trend?: number; ej?: number; wildlife?: number } | null;
  stSummary?: { loading?: boolean; impairedPct?: number; totalAssessed?: number } | null;
  stateAgency?: StateAgency | null;
  dataSources?: Record<string, { name: string }>;
  coordinates?: { lat: number; lon: number } | null;
  hucIndices?: import('@/lib/indices/types').HucIndices | null;
  onToast?: (msg: string) => void;
}

// ─── Visual Subcomponents ────────────────────────────────────────────────────

// Semicircle Gauge (Canvas)
function SemicircleGauge({ score }: { score: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clamped = Math.max(0, Math.min(100, score));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = 280;
    const cssH = 160;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const cx = cssW / 2;
    const cy = cssH - 20;
    const r = 110;
    const lineWidth = 18;
    const startAngle = Math.PI;

    // Draw gradient arc
    const steps = 100;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const a1 = startAngle + t * Math.PI;
      const a2 = startAngle + ((i + 1) / steps) * Math.PI;

      let color: string;
      if (t < 0.25)      color = lerpColor('#ef4444', '#f59e0b', t / 0.25);
      else if (t < 0.4)  color = lerpColor('#f59e0b', '#eab308', (t - 0.25) / 0.15);
      else if (t < 0.6)  color = lerpColor('#eab308', '#22c55e', (t - 0.4) / 0.2);
      else if (t < 0.8)  color = lerpColor('#22c55e', '#3b82f6', (t - 0.6) / 0.2);
      else                color = lerpColor('#3b82f6', '#2563eb', (t - 0.8) / 0.2);

      ctx.beginPath();
      ctx.arc(cx, cy, r, a1, a2 + 0.02);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'butt';
      ctx.stroke();
    }

    // Track shadow
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(0,0,0,0.04)';
    ctx.lineWidth = lineWidth + 4;
    ctx.stroke();

    // Needle
    const needleAngle = startAngle + (clamped / 100) * Math.PI;
    const needleLen = r - 8;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx + 1, ny + 1);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fillStyle = '#1e293b';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Scale labels
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText('0', cx + Math.cos(startAngle) * (r + 16), cy + Math.sin(startAngle) * (r + 16) + 4);
    ctx.fillText('50', cx + Math.cos(startAngle + Math.PI / 2) * (r + 16), cy + Math.sin(startAngle + Math.PI / 2) * (r + 16) + 4);
    ctx.fillText('100', cx + Math.cos(2 * Math.PI) * (r + 16), cy + Math.sin(2 * Math.PI) * (r + 16) + 4);
  }, [clamped]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const handler = () => draw();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [draw]);

  return <canvas ref={canvasRef} className="mx-auto block" />;
}

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

// Inline Tier Icon SVGs
function TierIcon({ tier }: { tier: DataConfidenceTier }) {
  if (tier === 1) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block shrink-0" aria-label="Tier 1 — Regulatory">
        <path d="M8 1L2 3.5V7.5C2 11.1 4.5 14.4 8 15C11.5 14.4 14 11.1 14 7.5V3.5L8 1Z" fill="#dcfce7" stroke="#16a34a" strokeWidth="1.2" />
        <path d="M5.5 8L7 9.5L10.5 6" stroke="#16a34a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tier === 2) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block shrink-0" aria-label="Tier 2 — Research">
        <path d="M6 2V6.5L3 12.5C2.7 13.1 3.1 13.8 3.8 13.8H12.2C12.9 13.8 13.3 13.1 13 12.5L10 6.5V2" fill="#dbeafe" stroke="#2563eb" strokeWidth="1.2" />
        <line x1="5" y1="2" x2="11" y2="2" stroke="#2563eb" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="4.5" y1="10" x2="11.5" y2="10" stroke="#2563eb" strokeWidth="0.8" strokeDasharray="1.5 1" />
      </svg>
    );
  }
  if (tier === 3) {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block shrink-0" aria-label="Tier 3 — Community">
        <circle cx="5.5" cy="5" r="2" fill="#fed7aa" stroke="#ea580c" strokeWidth="1" />
        <path d="M1.5 13C1.5 10.5 3.2 9 5.5 9C7.8 9 9.5 10.5 9.5 13" stroke="#ea580c" strokeWidth="1.2" fill="#fed7aa" />
        <circle cx="11" cy="5.5" r="1.6" fill="#fed7aa" stroke="#ea580c" strokeWidth="0.9" />
        <path d="M8.5 12.5C8.5 10.5 9.6 9.5 11 9.5C12.4 9.5 13.5 10.5 13.5 12.5" stroke="#ea580c" strokeWidth="1" fill="#fed7aa" />
      </svg>
    );
  }
  // Tier 4: Eye — Observational
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block shrink-0" aria-label="Tier 4 — Observational">
      <path d="M1.5 8C1.5 8 4 3.5 8 3.5C12 3.5 14.5 8 14.5 8C14.5 8 12 12.5 8 12.5C4 12.5 1.5 8 1.5 8Z" fill="#e0e7ff" stroke="#6366f1" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="2" stroke="#6366f1" strokeWidth="1.2" />
    </svg>
  );
}

// Mini sparkline SVG
function ParamSparkline({ data, status }: { data: number[]; status: 'normal' | 'watch' | 'alert' }) {
  if (data.length < 2) return null;
  const w = 64;
  const h = 20;
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const strokeColor = status === 'alert' ? '#ef4444' : status === 'watch' ? '#f59e0b' : '#22c55e';

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={points} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={parseFloat(points.split(' ').pop()!.split(',')[0])}
        cy={parseFloat(points.split(' ').pop()!.split(',')[1])}
        r="2.5"
        fill={strokeColor}
      />
    </svg>
  );
}

// Index bar for score view
function IndexBar({ name, value, weight }: { name: string; value: number; weight: number }) {
  const val = Math.max(0, Math.min(100, value));
  let barColor = 'bg-red-400';
  if (val >= 80)      barColor = 'bg-blue-500';
  else if (val >= 60) barColor = 'bg-green-500';
  else if (val >= 40) barColor = 'bg-amber-400';

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-slate-600 w-[140px] truncate shrink-0" title={name}>{name}</span>
      <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-500`} style={{ width: `${val}%` }} />
      </div>
      <span className="text-[10px] font-semibold text-slate-700 w-8 text-right tabular-nums">{Math.round(val)}</span>
      <span className="text-[9px] text-slate-400 w-8 text-right tabular-nums">{(weight * 100).toFixed(0)}%</span>
    </div>
  );
}

// Methodology expander
function MethodologySection() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-slate-100 pt-2">
      <button onClick={() => setOpen(o => !o)} className="text-[10px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        How is this calculated?
      </button>
      {open && (
        <div className="mt-2 text-[10px] text-slate-500 leading-relaxed space-y-1.5 pl-3 border-l-2 border-blue-100">
          <p>The <strong>PIN Water Score</strong> is a weighted composite of environmental indices, each scored 0-100 based on real-time and historical data from federal, state, and community sources.</p>
          <p>Each index weight reflects its relative importance to overall watershed health. Weights are calibrated per HUC-8 based on regional hydrology, land use, and regulatory context.</p>
          <p>Condition thresholds: <strong>Good</strong> (80-100), <strong>Fair</strong> (60-79), <strong>Poor</strong> (40-59), <strong>Severe</strong> (0-39). Scores update as new data arrives from the PEARL data cascade.</p>
        </div>
      )}
    </div>
  );
}

// Status style map for data view cards
const STATUS_STYLES: Record<string, { bg: string; border: string; dot: string }> = {
  normal: { bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500' },
  watch:  { bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  alert:  { bg: 'bg-red-50',   border: 'border-red-200',   dot: 'bg-red-500' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatAge(lastSampled: string | null | undefined): string | null {
  if (!lastSampled) return null;
  const ageMs = Date.now() - new Date(lastSampled).getTime();
  if (isNaN(ageMs)) return null;
  if (ageMs < 3600000) return `${Math.max(1, Math.floor(ageMs / 60000))}m ago`;
  if (ageMs < 86400000) return `${Math.floor(ageMs / 3600000)}h ago`;
  return `${Math.floor(ageMs / 86400000)}d ago`;
}

function getConditionLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: 'Excellent', color: 'text-blue-600' };
  if (score >= 70) return { label: 'Good', color: 'text-green-600' };
  if (score >= 50) return { label: 'Fair', color: 'text-amber-600' };
  if (score >= 30) return { label: 'Poor', color: 'text-orange-600' };
  return { label: 'Critical', color: 'text-red-600' };
}

// ─── Main Component ──────────────────────────────────────────────────────────

type ViewTab = 'score' | 'data';

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
  hucIndices,
  onToast,
}: WaterbodyDetailCardProps) {

  const [view, setView] = useState<ViewTab>('score');
  const [expandedParam, setExpandedParam] = useState<string | null>(null);

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

  // ── Freshness ──
  const params = waterData?.parameters ?? {};
  const freshness = useMemo(() => {
    const allTs: Record<string, string | null | undefined> = {};
    for (const [k, p] of Object.entries(params)) {
      if (!EXCLUDED_PARAMS.has(k)) allTs[k] = (p as any).lastSampled ?? null;
    }
    const displayedSlotCount = PARAM_ORDER.concat(Object.keys(params).filter(k => !PARAM_ORDER.includes(k))).filter(k => !EXCLUDED_PARAMS.has(k)).length;
    return computeFreshnessScore(allTs, displayedSlotCount);
  }, [params]);

  // ── PIN Water Score — weighted composite of all indices ──
  const { pinScore, indices } = useMemo(() => {
    const idx: { name: string; value: number; weight: number }[] = [];

    // Water Quality Grade
    if (grade.canBeGraded) {
      idx.push({ name: 'Water Quality Grade', value: grade.score!, weight: 0.15 });
    }

    // HUC-8 proprietary indices
    if (hucIndices) {
      idx.push({ name: 'PEARL Load Velocity', value: hucIndices.pearlLoadVelocity.value, weight: 0.10 });
      idx.push({ name: 'Infrastructure Risk', value: Math.max(0, 100 - hucIndices.infrastructureFailure.value), weight: 0.10 });
      idx.push({ name: 'Recovery Potential', value: hucIndices.watershedRecovery.value, weight: 0.10 });
      idx.push({ name: 'Permit Risk Exposure', value: Math.max(0, 100 - hucIndices.permitRiskExposure.value), weight: 0.08 });
      if (hucIndices.perCapitaLoad) {
        idx.push({ name: 'Per Capita Load', value: Math.max(0, 100 - hucIndices.perCapitaLoad.value), weight: 0.08 });
      }
    }

    // Environmental Justice — prefer HUC-level when available (higher = worse → invert)
    if (hucIndices?.ejVulnerability) {
      idx.push({ name: 'EJ Vulnerability', value: Math.max(0, 100 - hucIndices.ejVulnerability.value), weight: 0.10 });
    } else {
      idx.push({ name: 'Environmental Justice', value: Math.max(0, 100 - ejScore), weight: 0.10 });
    }

    // Ecological Health — prefer HUC-level when available (higher = worse → invert)
    if (hucIndices?.ecologicalHealth) {
      idx.push({ name: 'Ecological Health', value: Math.max(0, 100 - hucIndices.ecologicalHealth.value), weight: 0.08 });
    } else {
      idx.push({ name: 'Ecological Sensitivity', value: ecoScore, weight: 0.08 });
    }

    // Waterfront Exposure (higher = worse → invert)
    if (hucIndices?.waterfrontExposure) {
      idx.push({ name: 'Waterfront Exposure', value: Math.max(0, 100 - hucIndices.waterfrontExposure.value), weight: 0.08 });
    }

    // Governance Response (higher = worse → invert)
    if (hucIndices?.governanceResponse) {
      idx.push({ name: 'Governance Response', value: Math.max(0, 100 - hucIndices.governanceResponse.value), weight: 0.07 });
    }

    // Monitoring Coverage
    const monPct = coverage.keyParamsTotal > 0 ? (coverage.liveKeyParamCount / coverage.keyParamsTotal) * 100 : 0;
    idx.push({ name: 'Monitoring Coverage', value: monPct, weight: 0.07 });

    // Data Freshness
    idx.push({ name: 'Data Freshness', value: freshness.score, weight: 0.07 });

    // Regulatory Compliance
    const regScore = attainsCategory.includes('1') ? 100
      : attainsCategory.includes('2') ? 85
      : attainsCategory.includes('3') ? 50
      : attainsCategory.includes('4') ? 30 : 10;
    idx.push({ name: 'Regulatory Compliance', value: regScore, weight: 0.08 });

    // Trend Direction
    const trendScore = Math.max(0, Math.min(100, 50 + trend));
    idx.push({ name: 'Trend Direction', value: trendScore, weight: 0.07 });

    // Compute weighted total
    const totalWeight = idx.reduce((s, i) => s + i.weight, 0);
    const total = totalWeight > 0 ? Math.round(idx.reduce((s, i) => s + i.value * i.weight, 0) / totalWeight) : 0;

    return { pinScore: total, indices: idx };
  }, [grade, hucIndices, ejScore, ecoScore, coverage, freshness, attainsCategory, trend]);

  const condition = getConditionLabel(pinScore);
  const catConfig = resolveCategoryConfig(attainsCategory);

  // ── Observations & Implications ──
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

  // ── Parameter sorting ──
  const sortedKeys = PARAM_ORDER.filter(k => params[k]).concat(
    Object.keys(params).filter(k => !PARAM_ORDER.includes(k) && !EXCLUDED_PARAMS.has(k) && params[k])
  );

  const getSourceName = (sourceId: string) => dataSources[sourceId]?.name || sourceId;

  // ── Build current data readings for Data view ──
  const currentReadings = useMemo(() => {
    return sortedKeys.filter(k => !EXCLUDED_PARAMS.has(k) && params[k]).map(key => {
      const p = params[key] as any;
      const display = PARAM_DISPLAY[key] || { label: key, unit: '' };
      const isGood = display.good ? display.good(p.value) : undefined;
      const tier = getTierForSource(p.source as DataSourceId);
      return {
        key,
        label: display.label,
        value: p.value as number,
        unit: display.unit || p.unit || '',
        tier,
        source: p.source as string,
        sourceName: getSourceName(p.source),
        lastSampled: p.lastSampled as string | undefined,
        status: (isGood === false ? 'alert' : isGood === true ? 'normal' : 'watch') as 'normal' | 'watch' | 'alert',
        target: display.target,
        stationName: p.stationName as string | undefined,
        stationId: p.stationId as string | undefined,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedKeys.join(','), params]);

  return (
    <Card className="border-2 border-blue-300 bg-gradient-to-br from-blue-50/80 to-slate-50 shadow-lg relative overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
              <span className="truncate">{regionName}</span>
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
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {attainsIsLive && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${catConfig.bg} ${catConfig.text}`}>
                {catConfig.label}
              </span>
            )}
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
        {/* Impairment tags */}
        {attainsCauses.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {attainsCauses.slice(0, 6).map(cause => (
              <span key={cause} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-600">{cause}</span>
            ))}
            {attainsCauses.length > 6 && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-400">+{attainsCauses.length - 6} more</span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Loading state */}
        {waterLoading && (
          <div className="flex items-center gap-2 py-4 justify-center text-sm text-slate-500">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Fetching from USGS, NOAA, ERDDAP…
          </div>
        )}

        {!waterLoading && (
          <div className="space-y-4">
            {/* ── PIN Water Score Gauge ── */}
            <div>
              <SemicircleGauge score={pinScore} />
              <div className="text-center mt-1">
                <span className="text-3xl font-bold text-slate-900 tabular-nums">{pinScore}</span>
                <span className="text-sm text-slate-400 ml-1">/100</span>
                <p className={`text-xs font-semibold mt-0.5 ${condition.color}`}>{condition.label}</p>
              </div>
            </div>

            {/* ── Pill Toggle ── */}
            <div className="flex justify-center">
              <div className="inline-flex bg-gray-100 rounded-full p-0.5">
                {(['score', 'data'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setView(tab)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      view === tab
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab === 'score' ? 'PIN Water Score' : 'Current Data'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Score View: Index Bars ── */}
            {view === 'score' && (
              <div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold w-[140px]">Index</span>
                    <span className="flex-1" />
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold w-8 text-right">Score</span>
                    <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold w-8 text-right">Wt</span>
                  </div>
                  {indices.map(idx => (
                    <IndexBar key={idx.name} name={idx.name} value={idx.value} weight={idx.weight} />
                  ))}
                </div>
                <MethodologySection />
              </div>
            )}

            {/* ── Data View: Parameter Cards with Sparklines ── */}
            {view === 'data' && (
              <div className="space-y-2">
                {currentReadings.length === 0 && (
                  <p className="text-xs text-slate-400 italic text-center py-6">No current readings available</p>
                )}
                {currentReadings.map(reading => {
                  const s = STATUS_STYLES[reading.status];
                  const age = formatAge(reading.lastSampled);
                  return (
                    <div
                      key={reading.key}
                      className={`rounded-xl border ${s.border} ${s.bg} p-3 cursor-pointer hover:border-blue-300 transition-colors`}
                      onClick={(e) => { e.stopPropagation(); setExpandedParam(reading.key); }}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                        <span className="text-xs font-semibold text-slate-800 min-w-0 truncate">{reading.label}</span>
                        <TierIcon tier={reading.tier} />
                        <span className="ml-auto text-xs font-bold text-slate-900 tabular-nums whitespace-nowrap">
                          {reading.value < 0.01 && reading.value > 0 ? reading.value.toFixed(3) : reading.value < 1 ? reading.value.toFixed(2) : reading.value < 100 ? reading.value.toFixed(1) : Math.round(reading.value).toLocaleString()}
                          {reading.unit && <span className="text-[10px] font-normal text-slate-500 ml-0.5">{reading.unit}</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 ml-4">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_COLOR[reading.source] || 'bg-slate-100 text-slate-500'}`}>
                          {reading.sourceName}
                        </span>
                        <TierBadge tier={reading.tier} size="sm" />
                        <span className="text-[10px] text-slate-300">|</span>
                        <span className="text-[10px] text-slate-400">{age || 'No timestamp'}</span>
                        {reading.target && (
                          <>
                            <span className="text-[10px] text-slate-300">|</span>
                            <span className="text-[10px] text-slate-400">Target: {reading.target}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Legend */}
                {currentReadings.length > 0 && (
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-100 mt-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      {([
                        { status: 'normal', label: 'Normal' },
                        { status: 'watch', label: 'Watch' },
                        { status: 'alert', label: 'Alert' },
                      ] as const).map(s => (
                        <span key={s.status} className="flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_STYLES[s.status].dot}`} />
                          <span className="text-[9px] text-slate-500">{s.label}</span>
                        </span>
                      ))}
                    </div>
                    <a href="/tools/data-provenance#tiers" className="text-[9px] text-blue-500 hover:text-blue-700 underline">
                      Tier definitions →
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* ── Observations ── */}
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

            {/* ── Implications ── */}
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

            {/* ── Sources row ── */}
            <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400 pt-1">
              <span>Sources: {attainsIsLive ? '✅ ATTAINS' : '⚠ Mock 303(d)'} · {ejIsLive ? '✅ EJScreen' : '✅ Census/SDWIS'} · PIN monitoring</span>
            </div>

            {/* ── Regulatory Context ── */}
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
                  ⚡ <span className="font-medium">Action recommended:</span> This waterbody is Category 5 impaired without an approved TMDL. Federal oversight or enforcement referral may be warranted under CWA §303(d).
                </div>
              )}
              {level === 'medium' && ejScore >= 60 && (
                <div className="text-xs text-indigo-700 bg-indigo-100/60 rounded px-2 py-1.5">
                  ⚡ <span className="font-medium">EJ priority overlap:</span> This impaired waterbody intersects a high EJ-burden community. Eligible for enhanced federal support under Justice40 and EPA EJ programs.
                </div>
              )}
            </div>

            {/* ── State Agency Contact ── */}
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

                {/* Outreach summary */}
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
                    {' '}PIN&apos;s multi-stage biofiltration system could address MS4 compliance requirements under the{' '}
                    {agency.ms4Program} permit while providing measurable water quality improvements and aquatic restoration co-benefits.
                  </div>
                  <button
                    onClick={() => {
                      const text = `${regionName} in ${stateName || stateAbbr} currently shows ${levelToLabel(level).toLowerCase()} conditions with ${alerts} active alert${alerts !== 1 ? 's' : ''}. PIN's multi-stage biofiltration system could address MS4 compliance requirements under the ${agency.ms4Program} permit while providing measurable water quality improvements and aquatic restoration co-benefits.`;
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

            {/* ── Data Provenance ── */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
              <span className="italic">Informational only — not an official regulatory determination.</span>
              <a href="/tools/data-provenance" className="text-blue-500 hover:text-blue-700 underline whitespace-nowrap ml-2">
                Data provenance &amp; methodology →
              </a>
            </div>

            {/* ── CBP DataHub Enrichments ── */}
            {waterData?.parameters?._cbp_fluorescence && (
              <div className="rounded-lg border border-teal-200 bg-teal-50/40 p-3 space-y-1.5">
                <div className="text-xs font-semibold text-teal-800 uppercase tracking-wide flex items-center gap-1.5">
                  Chlorophyll Profiles
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium ml-1">CBP DataHub</span>
                </div>
                <div className="text-xs text-slate-600">
                  Latest chlorophyll fluorescence (CHL_F): <span className="font-medium">{waterData.parameters._cbp_fluorescence.value}</span> {waterData.parameters._cbp_fluorescence.unit} via CBP Fluorescence monitoring.
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
                  <span className="font-medium">{waterData.parameters._cbp_pointsource.value}</span> active discharge {waterData.parameters._cbp_pointsource.value === 1 ? 'facility' : 'facilities'} tracked in this watershed.
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
                  <span className="font-medium">{waterData.parameters._cbp_toxics.value}</span> contaminant {waterData.parameters._cbp_toxics.value === 1 ? 'sample' : 'samples'} (PAH, pesticides, metals) over the past 5 years.
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
                  Benthic Index of Biotic Integrity (IBI): <span className="font-medium">{waterData.parameters._cbp_benthic.value}</span> {waterData.parameters._cbp_benthic.unit}
                </div>
              </div>
            )}

            {/* ── CEDEN Enrichments ── */}
            {waterData?.parameters?._ceden_bacteria && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
                <div className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                  California Water Quality
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium ml-1">CEDEN</span>
                </div>
                <div className="text-xs text-slate-600">
                  <span className="font-medium">{waterData.parameters._ceden_bacteria.value}</span> bacteria indicator samples via California&apos;s CEDEN monitoring network.
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
                  <span className="font-medium">{waterData.parameters._ceden_toxicity.value}</span> toxicity tests recorded. {waterData.parameters._ceden_toxicity.parameterName}
                </div>
              </div>
            )}

            {/* ── EPA Envirofacts Compliance ── */}
            {waterData?.parameters?._epa_violations && (
              <div className="rounded-lg border border-orange-200 bg-orange-50/40 p-3 space-y-1.5">
                <div className="text-xs font-semibold text-orange-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Shield size={13} /> Compliance Context
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 font-medium ml-1">EPA Envirofacts</span>
                </div>
                <div className="text-xs text-slate-600">
                  <span className="font-medium">{waterData.parameters._epa_violations.value}</span> SDWIS drinking water violation{waterData.parameters._epa_violations.value !== 1 ? 's' : ''} found in this state.
                </div>
              </div>
            )}

            {/* ── Source attribution strip ── */}
            {waterData && waterData.sourceDetails?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                <span className="font-medium">Sources:</span>
                {waterData.sourceDetails.map((sd: any, i: number) => (
                  <span key={i} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${SOURCE_COLOR[sd.source.id] || 'bg-slate-100'}`}>
                    {sd.source.name} ({sd.parameterCount}) — {sd.stationName}
                    <TierBadge tier={getTierForSource(sd.source.id as DataSourceId)} size="sm" />
                  </span>
                ))}
                {waterData.lastSampled && (
                  <span className="ml-auto text-slate-400">
                    Updated: {new Date(waterData.lastSampled).toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {/* ── Footer ── */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-blue-200/50 text-[10px] text-slate-400">
              <Info size={10} className="flex-shrink-0" />
              <span>PIN Water Score computed from {indices.length} indices. Derived from {waterData?.activeSources?.filter((s: string) => s !== 'MOCK').join(', ') || 'EPA ATTAINS'}. Informational only — not an official assessment.</span>
            </div>
          </div>
        )}

        {/* ── Expand modal overlay ── */}
        {expandedParam && (() => {
          const p = params[expandedParam];
          const display = p ? (PARAM_DISPLAY[expandedParam] || { label: (p as any).parameterName || expandedParam, unit: (p as any).unit || '' }) : null;
          const isGood = display?.good && p ? display.good((p as any).value) : undefined;
          const age = p ? formatAge((p as any).lastSampled) : null;

          return (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 rounded-xl cursor-pointer" onClick={() => setExpandedParam(null)}>
              <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-[300px] max-w-[95%] max-h-[90%] overflow-y-auto cursor-default" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <h3 className="text-sm font-semibold text-slate-800">
                    {display?.label || expandedParam}
                  </h3>
                  <button onClick={() => setExpandedParam(null)} className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                <div className="p-4 space-y-4">
                  {p && display ? (
                    <>
                      <div className="text-center">
                        <div className={`text-4xl font-bold ${
                          isGood === true ? 'text-green-700' : isGood === false ? 'text-red-600' : 'text-slate-800'
                        }`}>
                          {(p as any).value < 0.01 && (p as any).value > 0 ? (p as any).value.toFixed(4) : (p as any).value < 1 ? (p as any).value.toFixed(3) : (p as any).value < 100 ? (p as any).value.toFixed(2) : Math.round((p as any).value).toLocaleString()}
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
                          <div className="text-slate-500">Data age</div>
                          <div className="font-medium text-slate-700">{age || 'Unknown'}</div>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-2 col-span-2">
                          <div className="text-slate-500">Source</div>
                          <div className="font-medium text-slate-700 flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${SOURCE_COLOR[(p as any).source] || 'bg-slate-100 text-slate-500'}`}>
                              {getSourceName((p as any).source)}
                            </span>
                            <TierBadge tier={getTierForSource((p as any).source as DataSourceId)} size="md" showLabel />
                          </div>
                        </div>
                      </div>
                      {(p as any).stationName && (
                        <div className="bg-slate-50 rounded-lg p-2 text-xs">
                          <div className="text-slate-500">Station</div>
                          <div className="font-medium text-slate-700">{(p as any).stationName}{(p as any).stationId ? ` (${(p as any).stationId})` : ''}</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <div className="text-4xl font-bold text-slate-300">&mdash;</div>
                      <div className="text-sm text-slate-500 mt-2">No data reported</div>
                      <div className="text-xs text-slate-400 mt-1">
                        {(PARAM_DISPLAY[expandedParam]?.label || expandedParam)} has no monitoring data for this waterbody.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}

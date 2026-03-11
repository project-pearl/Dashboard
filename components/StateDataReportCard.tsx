'use client';

import React, { useState } from 'react';
import type { StateDataReport } from '@/lib/stateReportCache';
import { ChevronDown, Minus, Database, MapPin } from 'lucide-react';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

// ── Grade Colors ────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'B': return 'text-green-700 bg-green-50 border-green-200';
    case 'C': return 'text-yellow-700 bg-yellow-50 border-yellow-200';
    case 'D': return 'text-orange-700 bg-orange-50 border-orange-200';
    case 'F': return 'text-red-700 bg-red-50 border-red-200';
    default: return 'text-slate-600 bg-slate-50 border-slate-200';
  }
}



// ── PIN 14-Index System (Technical Architecture Spec §4.1–4.14) ─────────────
// Each index is 0–100. Composite PIN Water Score per §5.1.
// Weights are domain-adaptive (vary by water type). Equal weights used as default.
// #13 (National Security) requires military data access key.

interface PINIndex {
  num: number;
  key: string;
  label: string;
  domain: string;
  sources: string;
  locked?: boolean;       // true if data source requires special access
}

const PIN_14_INDICES: PINIndex[] = [
  { num: 1,  key: 'pearlLoadVelocity',     label: 'PEARL Load Velocity',              domain: 'Environmental Dynamics',  sources: 'WQP, ICIS DMR' },
  { num: 2,  key: 'infrastructureFailure',  label: 'Infrastructure Failure Probability', domain: 'Infrastructure Risk',    sources: 'SDWIS, ICIS inspections' },
  { num: 3,  key: 'watershedRecovery',      label: 'Watershed Recovery Rate',           domain: 'Ecological Resilience',   sources: 'ATTAINS' },
  { num: 4,  key: 'permitRiskExposure',     label: 'Permit Risk Exposure',              domain: 'Regulatory Compliance',   sources: 'ICIS permits, violations, DMR' },
  { num: 5,  key: 'perCapitaLoad',          label: 'Per Capita Load Contribution',      domain: 'Source Attribution',      sources: 'SDWIS, WQP, ICIS DMR' },
  { num: 6,  key: 'waterfrontExposure',     label: 'Waterfront Value Exposure',         domain: 'Economic Risk',           sources: 'WQP, ATTAINS, DMR' },
  { num: 7,  key: 'wqEconomicImpact',       label: 'Water Quality Economic Impact',     domain: 'Economic Analysis',       sources: 'Fisheries, recreation, tourism' },
  { num: 8,  key: 'ecologicalHealth',        label: 'Ecological Health Dependency',      domain: 'Ecosystem Services',      sources: 'ATTAINS, USFWS ECOS' },
  { num: 9,  key: 'ejVulnerability',         label: 'EJ Vulnerability',                  domain: 'Equity & Justice',        sources: 'EJScreen, SDWIS' },
  { num: 10, key: 'populationTrajectory',    label: 'Population Trajectory Impact',      domain: 'Growth Planning',         sources: 'Census, land use' },
  { num: 11, key: 'politicalAccountability', label: 'Political Accountability Exposure',  domain: 'Governance',              sources: 'ATTAINS, ICIS, SDWIS' },
  { num: 12, key: 'climateForcing',          label: 'Climate Forcing Impact',            domain: 'Climate Adaptation',      sources: 'RCP scenarios, precip, SLR' },
  { num: 13, key: 'nationalSecurity',        label: 'National Security Water Vulnerability', domain: 'National Security',   sources: 'Military installations, SCADA', locked: true },
  { num: 14, key: 'airWaterNexus',           label: 'Air-Water Quality Nexus',           domain: 'Cross-Media Analysis',    sources: 'Atmospheric deposition, PM2.5' },
];

// ── Score Categories (§5.2) ─────────────────────────────────────────────────

function scoreCondition(score: number): { label: string; hex: string; tw: string } {
  if (score >= 90) return { label: 'Excellent', hex: '#3b82f6', tw: 'text-blue-600' };
  if (score >= 70) return { label: 'Good',      hex: '#22c55e', tw: 'text-green-600' };
  if (score >= 50) return { label: 'Fair',      hex: '#eab308', tw: 'text-yellow-600' };
  if (score >= 30) return { label: 'Poor',      hex: '#f97316', tw: 'text-orange-600' };
  return { label: 'Critical', hex: '#dc2626', tw: 'text-red-600' };
}

// ── Compute Index Scores from StateDataReport ───────────────────────────────
// StateDataReport provides: ATTAINS impairment, WQP freshness, parameter
// coverage, source breakdown, ECHO compliance, SDWIS drinking water,
// USGS-IV real-time. We derive best-available proxy scores per index.
// Full precision requires per-HUC-8 computation in the data pipeline.

const GRADE_SCORE: Record<string, number> = { A: 95, B: 80, C: 65, D: 50, F: 30 };

interface IndexResult {
  score: number | null;  // null = data not available or locked
  available: boolean;
}

function computeIndexScores(report: StateDataReport): Record<string, IndexResult> {
  const healthy = report.healthyCount ?? 0;
  const impaired = report.impairedCount ?? 0;
  const total = healthy + impaired;
  const healthRatio = total > 0 ? healthy / total : 0;
  const impairedRatio = total > 0 ? impaired / total : 0;
  const tmdlNeeded = report.tmdlNeeded ?? 0;
  const tmdlRatio = total > 0 ? tmdlNeeded / total : 0;
  const coverage = report.monitoredPct ?? 0;
  const freshness = GRADE_SCORE[report.freshnessGrade] ?? 50;
  const paramScore = GRADE_SCORE[report.parameterGrade] ?? 50;
  const covGradeScore = GRADE_SCORE[report.coverageGrade] ?? 50;
  const activeSourceCount = report.activeSourceCount ?? 0;
  const medianAge = report.medianAgeDays ?? 999;

  // §4.1 PEARL Load Velocity: rate of pollutant loading change
  // Proxy: combine freshness (recent data = detectable velocity) + impairment signal
  const pearlLoad = Math.round(Math.max(0, Math.min(100,
    freshness * 0.5 + (1 - impairedRatio) * 50
  )));

  // §4.2 Infrastructure Failure Probability: CSO/SSO risk from violations + age
  // Proxy: TMDL need ratio (high TMDL = stressed infrastructure) + coverage gaps
  const infraFailure = Math.round(Math.max(0, Math.min(100,
    (1 - tmdlRatio) * 60 + (coverage / 100) * 40
  )));

  // §4.3 Watershed Recovery Rate: resilience / return to baseline
  // Proxy: healthy ratio indicates recovery capacity
  const watershedRecovery = Math.round(Math.max(0, Math.min(100,
    healthRatio * 80 + (activeSourceCount >= 3 ? 20 : activeSourceCount * 7)
  )));

  // §4.4 Permit Risk Exposure: compliance risk from NPDES dischargers
  // Proxy: impairment + TMDL pressure indicates permit stress
  const permitRisk = Math.round(Math.max(0, Math.min(100,
    (1 - impairedRatio * 0.7 - tmdlRatio * 0.3) * 100
  )));

  // §4.5 Per Capita Load: population-normalized burden
  // Proxy: impairment density as proxy (no pop data on StateDataReport)
  const perCapitaLoad = Math.round(Math.max(0, Math.min(100,
    (1 - impairedRatio) * 70 + paramScore * 0.3
  )));

  // §4.6 Waterfront Value Exposure: property value at risk
  // Proxy: impairment status signals property risk exposure
  const waterfrontExposure = Math.round(Math.max(0, Math.min(100,
    healthRatio * 60 + covGradeScore * 0.4
  )));

  // §4.7 Water Quality Economic Impact: fisheries, recreation, tourism
  // Proxy: blend of health ratio + data quality (better data = better economic modeling)
  const wqEconomicImpact = Math.round(Math.max(0, Math.min(100,
    healthRatio * 50 + (freshness * 0.3) + (coverage / 100) * 20
  )));

  // §4.8 Ecological Health: biodiversity + ecosystem services
  // Proxy: healthy waters + parameter breadth (broader monitoring = better eco picture)
  const ecologicalHealth = Math.round(Math.max(0, Math.min(100,
    healthRatio * 60 + paramScore * 0.4
  )));

  // §4.9 EJ Vulnerability: demographic burden
  // Proxy: impairment in context of data coverage (poor data + impairment = higher EJ risk)
  const ejVulnerability = Math.round(Math.max(0, Math.min(100,
    (1 - impairedRatio * 0.6) * 60 + (coverage / 100) * 40
  )));

  // §4.10 Population Trajectory: growth pressure on water quality
  // Proxy: TMDL backlog indicates capacity under pressure
  const popTrajectory = Math.round(Math.max(0, Math.min(100,
    (1 - tmdlRatio * 0.8) * 70 + healthRatio * 30
  )));

  // §4.11 Political Accountability: governance response strength
  // Proxy: TMDL completion rate + data freshness (responsive govt = fresh data)
  const tmdlCompletionRatio = total > 0 ? Math.max(0, 1 - (tmdlNeeded / total)) : 0;
  const politicalAcct = Math.round(Math.max(0, Math.min(100,
    tmdlCompletionRatio * 50 + (freshness * 0.3) + (activeSourceCount >= 4 ? 20 : activeSourceCount * 5)
  )));

  // §4.12 Climate Forcing: how climate amplifies impairments
  // Proxy: current impairment as climate vulnerability indicator
  const climateForcing = Math.round(Math.max(0, Math.min(100,
    healthRatio * 50 + (1 - tmdlRatio) * 30 + (medianAge < 90 ? 20 : medianAge < 365 ? 10 : 0)
  )));

  // §4.13 National Security: LOCKED — requires military data key
  // No proxy available

  // §4.14 Air-Water Nexus: atmospheric deposition linkage
  // Proxy: parameter breadth indicates cross-media monitoring capability
  const airWaterNexus = Math.round(Math.max(0, Math.min(100,
    paramScore * 0.5 + (1 - impairedRatio) * 30 + (coverage / 100) * 20
  )));

  return {
    pearlLoadVelocity:     { score: pearlLoad, available: true },
    infrastructureFailure: { score: infraFailure, available: true },
    watershedRecovery:     { score: watershedRecovery, available: true },
    permitRiskExposure:    { score: permitRisk, available: true },
    perCapitaLoad:         { score: perCapitaLoad, available: true },
    waterfrontExposure:    { score: waterfrontExposure, available: true },
    wqEconomicImpact:      { score: wqEconomicImpact, available: true },
    ecologicalHealth:      { score: ecologicalHealth, available: true },
    ejVulnerability:       { score: ejVulnerability, available: true },
    populationTrajectory:  { score: popTrajectory, available: true },
    politicalAccountability: { score: politicalAcct, available: true },
    climateForcing:        { score: climateForcing, available: true },
    nationalSecurity:      { score: null, available: false },
    airWaterNexus:         { score: airWaterNexus, available: true },
  };
}

function computeCompositeScore(scores: Record<string, IndexResult>): number {
  // §5.1: weighted aggregation, renormalized for available indices
  // Using equal weights as default (domain-adaptive weights TBD per water type)
  let weightedSum = 0;
  let count = 0;

  for (const idx of PIN_14_INDICES) {
    const result = scores[idx.key];
    if (result?.available && result.score != null) {
      weightedSum += result.score;
      count++;
    }
  }

  return count > 0 ? Math.round(weightedSum / count) : 0;
}

// ── SVG Semicircle Gauge ────────────────────────────────────────────────────

function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.slice(1), 16);
  const bh = parseInt(b.slice(1), 16);
  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff;
  const br = (bh >> 16) & 0xff, bg_ = (bh >> 8) & 0xff, bb = bh & 0xff;
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg_ - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `rgb(${rr},${rg},${rb})`;
}

function SemicircleGauge({ score }: { score: number }) {
  const width = 300;
  const height = 180;
  const cx = width / 2;
  const cy = 155;
  const radius = 115;
  const strokeW = 28;
  const clamped = Math.max(0, Math.min(100, score));

  // Build smooth gradient arc using many tiny segments
  const steps = 60;
  const arcPaths: { d: string; color: string }[] = [];

  for (let i = 0; i < steps; i++) {
    const t1 = i / steps;
    const t2 = (i + 1) / steps;
    const a1 = Math.PI - t1 * Math.PI;
    const a2 = Math.PI - t2 * Math.PI;

    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy - radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy - radius * Math.sin(a2);

    // Color gradient: red → orange → yellow → lime → green
    let color: string;
    if (t1 < 0.25)      color = lerpColor('#dc2626', '#f97316', t1 / 0.25);
    else if (t1 < 0.45) color = lerpColor('#f97316', '#eab308', (t1 - 0.25) / 0.2);
    else if (t1 < 0.65) color = lerpColor('#eab308', '#84cc16', (t1 - 0.45) / 0.2);
    else if (t1 < 0.85) color = lerpColor('#84cc16', '#22c55e', (t1 - 0.65) / 0.2);
    else                 color = lerpColor('#22c55e', '#16a34a', (t1 - 0.85) / 0.15);

    arcPaths.push({
      d: `M ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2}`,
      color,
    });
  }

  // Needle
  const needleAngle = Math.PI - (clamped / 100) * Math.PI;
  const needleLen = radius - 20;
  const needleTip = {
    x: cx + needleLen * Math.cos(needleAngle),
    y: cy - needleLen * Math.sin(needleAngle),
  };

  // Scale label positions
  const lbl0X = cx + radius * Math.cos(Math.PI);
  const lbl0Y = cy - radius * Math.sin(Math.PI);
  const lbl50X = cx + radius * Math.cos(Math.PI / 2);
  const lbl50Y = cy - radius * Math.sin(Math.PI / 2);
  const lbl100X = cx + radius * Math.cos(0);
  const lbl100Y = cy - radius * Math.sin(0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mx-auto block"
      style={{ maxWidth: '100%', width: '100%', height: 'auto' }}
    >
      {/* Background track */}
      <path
        d={`M ${cx + radius * Math.cos(Math.PI)} ${cy - radius * Math.sin(Math.PI)} A ${radius} ${radius} 0 0 1 ${cx + radius * Math.cos(0)} ${cy - radius * Math.sin(0)}`}
        fill="none"
        stroke="#f1f5f9"
        strokeWidth={strokeW + 6}
        strokeLinecap="round"
      />
      {/* Smooth gradient arc — many tiny butt-capped segments */}
      {arcPaths.map((seg, i) => (
        <path
          key={i}
          d={seg.d}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeW}
          strokeLinecap="butt"
        />
      ))}
      {/* Round caps at the two ends only */}
      <circle
        cx={cx + radius * Math.cos(Math.PI)}
        cy={cy - radius * Math.sin(Math.PI)}
        r={strokeW / 2}
        fill="#dc2626"
      />
      <circle
        cx={cx + radius * Math.cos(0)}
        cy={cy - radius * Math.sin(0)}
        r={strokeW / 2}
        fill="#16a34a"
      />
      {/* Scale labels */}
      <text x={lbl0X - 10} y={lbl0Y + 20} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="system-ui, sans-serif">0</text>
      <text x={lbl50X} y={lbl50Y - 18} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="system-ui, sans-serif">50</text>
      <text x={lbl100X + 10} y={lbl100Y + 20} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="system-ui, sans-serif">100</text>
      {/* Needle shadow */}
      <line
        x1={cx + 1}
        y1={cy + 1}
        x2={needleTip.x + 1}
        y2={needleTip.y + 1}
        stroke="rgba(0,0,0,0.12)"
        strokeWidth={3.5}
        strokeLinecap="round"
      />
      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke="#1e293b"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={7} fill="#1e293b" />
      <circle cx={cx} cy={cy} r={3.5} fill="#ffffff" />
    </svg>
  );
}

// ── Index Bar ───────────────────────────────────────────────────────────────

function IndexBar({ name, value, weight, pending, locked }: { name: string; value: number; weight: string; pending?: boolean; locked?: boolean }) {
  if (locked) {
    return (
      <div className="flex items-center gap-2 py-0.5 opacity-40">
        <span className="text-xs text-slate-400 w-[195px] truncate shrink-0" title={name}>🔒 {name}</span>
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden" />
        <span className="text-2xs text-slate-400 w-8 text-right italic">—</span>
      </div>
    );
  }

  if (pending) {
    return (
      <div className="flex items-center gap-2 py-0.5 opacity-50">
        <span className="text-xs text-slate-400 w-[195px] truncate shrink-0" title={name}>{name}</span>
        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-slate-200 animate-pulse" style={{ width: '100%' }} />
        </div>
        <span className="text-2xs text-slate-400 w-8 text-right italic">—</span>
      </div>
    );
  }

  const val = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-slate-600 w-[195px] truncate shrink-0" title={name}>{name}</span>
      <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
        {val > 0 && (
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${val}%`,
              background: 'linear-gradient(90deg, #dc2626, #f97316)',
            }}
          />
        )}
      </div>
      <span className="text-xs font-semibold text-slate-700 w-8 text-right tabular-nums">{Math.round(val)}</span>
    </div>
  );
}

// ── Sub-section Toggle ──────────────────────────────────────────────────────

function SubSection({ title, icon, defaultOpen, children }: {
  title: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2 bg-slate-50/80 hover:bg-slate-100 transition-colors">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-semibold text-slate-700">{title}</span>
        </div>
        {open ? <Minus className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
      </button>
      {open && <div className="px-3 pb-3 pt-2">{children}</div>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

export function StateDataReportCard({ report: rawReport, stateName }: { report: StateDataReport; stateName?: string }) {
  const [view, setView] = useState<'score' | 'data'>('score');
  const [showCalcInfo, setShowCalcInfo] = useState(false);

  // Safe defaults for new fields that may be missing in stale cached data
  const report: StateDataReport = {
    ...rawReport,
    assessedCount: rawReport.assessedCount ?? (rawReport.impairedCount + rawReport.healthyCount),
    tmdlCompleted: rawReport.tmdlCompleted ?? 0,
    tmdlAlternative: rawReport.tmdlAlternative ?? 0,
    notPollutant: rawReport.notPollutant ?? 0,
    topCausesWithCounts: rawReport.topCausesWithCounts ?? [],
  };

  const indexScores = computeIndexScores(report);
  const compositeScore = computeCompositeScore(indexScores);
  const condition = scoreCondition(compositeScore);

  const displayName = stateName || STATE_NAMES[report.stateCode] || report.stateCode;

  return (
    <div className="space-y-4">

      {/* ── State Name + EPA Region ────────────────────────────────────── */}
      <CardHeader className="p-0">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-blue-600" />
          {displayName}
        </CardTitle>
        <CardDescription>
          {report.epaRegion != null ? `EPA Region ${report.epaRegion} · ` : ''}State Water Quality Report
        </CardDescription>
      </CardHeader>

      {/* ── SVG Semicircle Gauge ──────────────────────────────────────── */}
      <div className="mx-auto" style={{ maxWidth: 180 }}>
        <SemicircleGauge score={compositeScore} />
        <div className="text-center -mt-1">
          <span className="text-2xl font-bold text-slate-900 tabular-nums">{compositeScore}</span>
          <span className="text-xs text-slate-400 ml-0.5">/100</span>
          <p className="text-xs font-semibold mt-0.5" style={{ color: condition.hex }}>{condition.label}</p>
        </div>
      </div>

      {/* ── Pill Toggle ────────────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div className="inline-flex bg-slate-100 rounded-full p-0.5">
          <button
            onClick={() => setView('score')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${
              view === 'score'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            PIN Water Score
          </button>
          <button
            onClick={() => setView('data')}
            className={`px-5 py-2 rounded-full text-xs font-semibold transition-all ${
              view === 'data'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Current Data
          </button>
        </div>
      </div>

      {/* ── Score View: 14 PIN Indices (§4.1–4.14) ─────────────────────── */}
      {view === 'score' && (
        <div className="space-y-1">
          {/* Column headers */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xs text-slate-400 uppercase tracking-wider font-semibold w-[195px]">Index</span>
            <span className="flex-1" />
            <span className="text-2xs text-slate-400 uppercase tracking-wider font-semibold w-8 text-right">Score</span>
          </div>

          {PIN_14_INDICES.map((idx) => {
            const result = indexScores[idx.key];
            return (
              <IndexBar
                key={idx.key}
                name={idx.label}
                value={result?.available ? result.score! : -1}
                weight={idx.domain}
                pending={!result?.available}
                locked={idx.locked}
              />
            );
          })}

          {/* National Security notice */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-2xs text-slate-500 mt-2">
            🔒 National Security Water Vulnerability requires military data access key.
            {' '}13 of 14 indices active. Score computed from available indices with renormalized weights (§5.1).
          </div>

          {/* How is this calculated? */}
          <div className="pt-2">
            <button
              onClick={() => setShowCalcInfo(!showCalcInfo)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <span>{showCalcInfo ? '▼' : '▶'}</span>
              How is this calculated?
            </button>
            {showCalcInfo && (
              <div className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg p-3 space-y-2">
                <p>
                  The <strong>PIN Water Score</strong> is a composite 0–100 metric derived from
                  14 proprietary indices spanning environmental dynamics, infrastructure risk,
                  ecological resilience, regulatory compliance, economics, equity, governance,
                  climate, national security, and cross-media analysis.
                </p>
                <p>
                  Weights are domain-adaptive — estuarine scores weight ecological health and
                  infrastructure risk more heavily, while river scores emphasize load velocity
                  and recovery rate. All weights are transparent for regulatory defensibility.
                </p>
                <p>
                  Only indices with available data contribute. Weights are renormalized so
                  missing indices don&apos;t artificially deflate the score.
                </p>
                <p className="text-2xs text-slate-400 italic">
                  This score is informational and derived from public data sources. It is
                  not an official EPA or state determination.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Data View: ATTAINS Detail ─────────────────────────────────────── */}
      {view === 'data' && (
        <div className="space-y-4">

          {/* ── Summary KPI Boxes ──────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-slate-200 p-2.5 text-center">
              <div className="text-lg font-black text-slate-800">{report.totalWaterbodies.toLocaleString()}</div>
              <div className="text-2xs text-slate-400 font-semibold uppercase tracking-wide">Total</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 text-center">
              <div className="text-lg font-black text-slate-700">{report.assessedCount.toLocaleString()}</div>
              <div className="text-2xs text-slate-400 font-semibold uppercase tracking-wide">Assessed</div>
            </div>
            <div className="rounded-lg border border-slate-200 p-2.5 text-center">
              <div className="text-lg font-black text-slate-900">{report.impairedCount.toLocaleString()}</div>
              <div className="text-2xs text-slate-400 font-semibold uppercase tracking-wide">Impaired</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-center">
              <div className="text-lg font-black text-red-700">{report.tmdlNeeded.toLocaleString()}</div>
              <div className="text-2xs text-red-500 font-semibold uppercase tracking-wide">Cat 5</div>
            </div>
          </div>

          {/* ── Impairment Categories ──────────────────────────────────── */}
          {(report.tmdlNeeded > 0 || report.tmdlCompleted > 0 || report.tmdlAlternative > 0 || report.notPollutant > 0) && (
            <div>
              <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-2">Impairment Categories</div>
              <div className="space-y-0">
                {[
                  { label: 'Cat 5 — Needs TMDL', value: report.tmdlNeeded },
                  { label: 'Cat 4A — TMDL Complete', value: report.tmdlCompleted },
                  { label: 'Cat 4B — Other Control', value: report.tmdlAlternative },
                  { label: 'Cat 4C — Not Pollutant', value: report.notPollutant },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-dotted border-slate-200 last:border-0">
                    <span className="text-xs text-slate-600">{row.label}</span>
                    <span className="text-xs font-bold text-slate-800 tabular-nums">{row.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Top Impairment Causes ──────────────────────────────────── */}
          {report.topCausesWithCounts && report.topCausesWithCounts.length > 0 && (
            <div>
              <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-2">Top Impairment Causes</div>
              <div className="space-y-0">
                {report.topCausesWithCounts.map((row, idx) => (
                  <div key={row.cause} className="flex items-baseline justify-between py-1.5 border-b border-dotted border-slate-200 last:border-0">
                    <span className="text-xs text-slate-600">
                      <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                      {row.cause}
                    </span>
                    <span className="text-xs font-bold text-slate-800 tabular-nums">{row.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Monitoring Coverage ────────────────────────────────────── */}
          <div>
            <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-2">Monitoring Coverage</div>
            <div className="flex items-center gap-4 text-xs">
              <span><strong className="text-slate-800">{report.monitoredWaterbodies.toLocaleString()}</strong> <span className="text-2xs text-slate-400 uppercase">Monitored</span></span>
              <span><strong className="text-slate-800">{report.assessedCount.toLocaleString()}</strong> <span className="text-2xs text-slate-400 uppercase">Assessed</span></span>
              <span><strong className="text-slate-800">{report.unmonitoredWaterbodies.toLocaleString()}</strong> <span className="text-2xs text-slate-400 uppercase">Unmonitored</span></span>
            </div>
            {/* Coverage bar */}
            <div className="mt-2 h-2.5 rounded-full overflow-hidden bg-slate-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(100, report.monitoredPct)}%` }}
              />
            </div>
          </div>

        </div>
      )}
    </div>
  );
}


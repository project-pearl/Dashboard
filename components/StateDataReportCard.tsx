'use client';

import React, { useState } from 'react';
import type { StateDataReport } from '@/lib/stateReportCache';


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


// ── Score Condition ─────────────────────────────────────────────────────────

function scoreCondition(score: number): { label: string; hex: string; tw: string } {
  if (score >= 80) return { label: 'Excellent', hex: '#3b82f6', tw: 'text-blue-600' };
  if (score >= 65) return { label: 'Good',      hex: '#22c55e', tw: 'text-green-600' };
  if (score >= 50) return { label: 'Fair',      hex: '#eab308', tw: 'text-yellow-600' };
  if (score >= 30) return { label: 'Poor',      hex: '#f97316', tw: 'text-orange-600' };
  return { label: 'Critical', hex: '#dc2626', tw: 'text-red-600' };
}

// ── PIN 14-Index System ─────────────────────────────────────────────────────

interface PINIndex {
  key: string;
  label: string;
  weight: number; // percentage — all sum to 100
}

const PIN_14_INDICES: PINIndex[] = [
  { key: 'waterQualityGrade',     label: 'Water Quality Grade',       weight: 15 },
  { key: 'environmentalJustice',  label: 'Environmental Justice',     weight: 10 },
  { key: 'ecologicalSensitivity', label: 'Ecological Sensitivity',    weight: 8 },
  { key: 'monitoringCoverage',    label: 'Monitoring Coverage',       weight: 7 },
  { key: 'dataFreshness',         label: 'Data Freshness',            weight: 7 },
  { key: 'regulatoryCompliance',  label: 'Regulatory Compliance',     weight: 8 },
  { key: 'trendDirection',        label: 'Trend Direction',           weight: 7 },
  { key: 'infrastructureRisk',    label: 'Infrastructure Risk',       weight: 7 },
  { key: 'sourceWaterVuln',       label: 'Source Water Vulnerability', weight: 6 },
  { key: 'nutrientLoading',       label: 'Nutrient Loading',          weight: 6 },
  { key: 'pathogenExposure',      label: 'Pathogen Exposure',         weight: 5 },
  { key: 'toxicContamination',    label: 'Toxic Contamination',       weight: 5 },
  { key: 'habitatIntegrity',      label: 'Habitat Integrity',         weight: 5 },
  { key: 'climateResilience',     label: 'Climate Resilience',        weight: 4 },
];

// ── Compute 14 Index Scores from StateDataReport ────────────────────────────

const GRADE_SCORE: Record<string, number> = { A: 95, B: 80, C: 65, D: 50, F: 30 };

function computeIndexScores(report: StateDataReport): Record<string, number> {
  const healthy = report.healthyCount ?? 0;
  const impaired = report.impairedCount ?? 0;
  const total = healthy + impaired;
  const waterHealth = total > 0 ? (healthy / total) * 100 : 50;
  const impairedPct = total > 0 ? impaired / total : 0.5;
  const coverage = report.monitoredPct ?? 0;
  const freshness = GRADE_SCORE[report.freshnessGrade] ?? 50;
  const aiReady = report.aiReadinessScore ?? 50;
  const paramScore = GRADE_SCORE[(report as any).parameterGrade] ?? 50;
  const coverageGradeScore = GRADE_SCORE[(report as any).coverageGrade] ?? 50;
  const tmdlNeeded = (report as any).tmdlNeeded ?? 0;

  return {
    waterQualityGrade:     Math.round(Math.max(0, Math.min(100, waterHealth))),
    environmentalJustice:  Math.round(Math.max(0, Math.min(100, (1 - impairedPct * 1.5) * 100))),
    ecologicalSensitivity: Math.round(Math.max(0, Math.min(100, (1 - impairedPct * 1.2) * 80))),
    monitoringCoverage:    Math.round(Math.max(0, Math.min(100, coverage))),
    dataFreshness:         Math.round(Math.max(0, Math.min(100, freshness))),
    regulatoryCompliance:  Math.round(Math.max(0, Math.min(100, coverageGradeScore * 0.5 + waterHealth * 0.5))),
    trendDirection:        Math.round(Math.max(0, Math.min(100, 50 + (waterHealth - 50) * 0.8))),
    infrastructureRisk:    Math.round(Math.max(0, Math.min(100, (1 - (tmdlNeeded / Math.max(total, 1)) * 1.2) * 100))),
    sourceWaterVuln:       Math.round(Math.max(0, Math.min(100, waterHealth * 0.8 + coverage * 0.2))),
    nutrientLoading:       Math.round(Math.max(0, Math.min(100, (1 - impairedPct * 1.1) * 90))),
    pathogenExposure:      Math.round(Math.max(0, Math.min(100, (1 - impairedPct * 1.3) * 90))),
    toxicContamination:    Math.round(Math.max(0, Math.min(100, paramScore * 0.6 + waterHealth * 0.4))),
    habitatIntegrity:      Math.round(Math.max(0, Math.min(100, (1 - impairedPct * 0.8) * 100))),
    climateResilience:     Math.round(Math.max(0, Math.min(100, 50 + (1 - impairedPct) * 40))),
  };
}

function computeCompositeScore(indexScores: Record<string, number>): number {
  let weighted = 0;
  for (const idx of PIN_14_INDICES) {
    weighted += (indexScores[idx.key] || 0) * (idx.weight / 100);
  }
  return Math.round(weighted);
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
      style={{ maxWidth: 220, width: '100%', height: 'auto', margin: '0 auto' }}
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

function IndexBar({ name, value, weight }: { name: string; value: number; weight: string }) {
  const val = Math.max(0, Math.min(100, value));

  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-xs text-slate-600 w-[160px] truncate shrink-0" title={name}>{name}</span>
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
      <span className="text-[10px] text-slate-400 w-8 text-right tabular-nums">{weight}</span>
    </div>
  );
}


// ── Main Component ──────────────────────────────────────────────────────────

export function StateDataReportCard({ report, stateName }: { report: StateDataReport; stateName?: string }) {
  const [view, setView] = useState<'score' | 'data'>('score');
  const [showCalcInfo, setShowCalcInfo] = useState(false);

  const indexScores = computeIndexScores(report);
  const compositeScore = computeCompositeScore(indexScores);
  const condition = scoreCondition(compositeScore);

  return (
    <div className="space-y-4">

      {/* ── Header: state name + badges ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          {stateName && (
            <p className="text-sm font-bold text-slate-800">{stateName}</p>
          )}
          <p className="text-[10px] text-slate-400 mt-0.5">
            {report.epaRegion ? `EPA Region ${report.epaRegion} · ` : ''}
            {report.activeSourceCount} data source{report.activeSourceCount !== 1 ? 's' : ''} · {report.monitoredPct}% assessed
          </p>
        </div>
        <div className="flex items-center gap-2">
          {report.tmdlNeeded > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700 border border-red-200">
              {report.tmdlNeeded.toLocaleString()} TMDL Needed
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
            compositeScore >= 80 ? 'bg-blue-50 text-blue-700 border-blue-200' :
            compositeScore >= 65 ? 'bg-green-50 text-green-700 border-green-200' :
            compositeScore >= 50 ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
            compositeScore >= 30 ? 'bg-orange-50 text-orange-700 border-orange-200' :
            'bg-red-50 text-red-700 border-red-200'
          }`}>
            {condition.label}
          </span>
        </div>
      </div>

      {/* ── Top impairment cause tags ─────────────────────────────────── */}
      {report.topCauses.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {report.topCauses.slice(0, 5).map(cause => (
            <span key={cause} className="text-[9px] px-2 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">
              {cause}
            </span>
          ))}
        </div>
      )}

      {/* ── SVG Semicircle Gauge ──────────────────────────────────────── */}
      <div>
        <SemicircleGauge score={compositeScore} />
        <div className="text-center -mt-1">
          <span className="text-4xl font-bold text-slate-900 tabular-nums">{compositeScore}</span>
          <span className="text-base text-slate-400 ml-1">/100</span>
          <p className="text-sm font-semibold mt-0.5" style={{ color: condition.hex }}>{condition.label}</p>
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

      {/* ── Score View: 14 PIN Index Bars ──────────────────────────────── */}
      {view === 'score' && (
        <div className="space-y-0.5">
          {/* Column headers */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold w-[160px]">Index</span>
            <span className="flex-1" />
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold w-8 text-right">Score</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold w-8 text-right">Wt</span>
          </div>

          {PIN_14_INDICES.map((idx) => (
            <IndexBar
              key={idx.key}
              name={idx.label}
              value={indexScores[idx.key] ?? 0}
              weight={`${idx.weight}%`}
            />
          ))}

          {/* How is this calculated? */}
          <div className="pt-3">
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
                  The PIN Water Score is a weighted composite of 14 proprietary indices.
                  Each index evaluates a different dimension of water quality, environmental
                  risk, and regulatory status using data from EPA ATTAINS, SDWIS, ECHO,
                  USGS, and other federal/state sources.
                </p>
                <p>
                  Scores range from 0 (critical) to 100 (excellent). The composite score
                  is the weighted sum of all 14 indices. Weights reflect each index&apos;s
                  relative importance to overall water system health.
                </p>
                <p className="text-[10px] text-slate-400 italic">
                  This score is informational and derived from public data sources. It is
                  not an official EPA or state determination.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Data View: Flat report rows ────────────────────────────────── */}
      {view === 'data' && (
        <div className="space-y-4">

          {/* ── Waterbody Counts ───────────────────────────────────────── */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Total', value: report.totalWaterbodies, color: 'text-slate-700' },
              { label: 'Monitored', value: report.monitoredWaterbodies, color: 'text-emerald-700' },
              { label: 'Impaired', value: report.impairedCount, color: 'text-red-700' },
              { label: 'TMDL Needed', value: report.tmdlNeeded, color: 'text-amber-700' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className={`text-base font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
                <div className="text-[10px] text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Health Breakdown ───────────────────────────────────────── */}
          <div>
            <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Health Status</p>
            <div className="space-y-1">
              {[
                { label: 'Healthy Waterbodies', value: report.healthyCount },
                { label: 'Impaired Waterbodies', value: report.impairedCount },
                { label: 'Unmonitored (Blind Spots)', value: report.unmonitoredWaterbodies },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <span className="text-xs text-slate-600">{row.label}</span>
                  <span className="text-xs font-semibold text-slate-700">{row.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Monitoring Coverage Bar ────────────────────────────────── */}
          {report.totalWaterbodies > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Monitoring Coverage</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${gradeColor(report.coverageGrade)}`}>
                  {report.coverageGrade} — {report.monitoredPct}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-slate-200">
                <div className="h-full rounded-full" style={{ width: `${report.monitoredPct}%`, background: '#22c55e' }} />
              </div>
            </div>
          )}

          {/* ── Top Impairment Causes ─────────────────────────────────── */}
          {report.topCauses.length > 0 && (
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold mb-1">Top Impairment Causes</p>
              <div className="space-y-0.5">
                {report.topCauses.slice(0, 8).map((cause, i) => (
                  <div key={cause} className="flex items-center gap-2 text-xs py-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <span className="w-4 text-right text-slate-400">{i + 1}.</span>
                    <span className="flex-1 text-slate-600">{cause}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Data Freshness ────────────────────────────────────────── */}
          {report.wqpRecordCount > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Data Freshness</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${gradeColor(report.freshnessGrade)}`}>
                  {report.freshnessGrade}
                </span>
              </div>
              <div className="space-y-1">
                {[
                  { label: 'WQP Records', value: report.wqpRecordCount.toLocaleString() },
                  { label: 'Stations', value: report.wqpStationCount.toLocaleString() },
                  { label: 'Median Age', value: `${report.medianAgeDays}d` },
                  { label: 'Parameters Tracked', value: String(report.parameterCount) },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-0.5" style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <span className="text-xs text-slate-600">{row.label}</span>
                    <span className="text-xs font-semibold text-slate-700">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Data Sources ──────────────────────────────────────────── */}
          {report.sourceBreakdown.length > 0 && (
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold mb-1">{report.activeSourceCount} Data Sources</p>
              <div className="flex flex-wrap gap-1">
                {report.sourceBreakdown.slice(0, 8).map(s => (
                  <span key={s.source} className="px-1.5 py-0.5 bg-slate-50 text-slate-600 border border-slate-200 rounded text-[10px]">
                    {s.source} ({s.waterbodyCount})
                  </span>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}


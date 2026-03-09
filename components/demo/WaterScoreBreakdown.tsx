'use client';

import React, { useRef, useState, useEffect } from 'react';

/* ── Index data ─────────────────────────────────────────────────────── */

interface IndexBar {
  label: string;
  weight: string;
  score: number;
  sparkline: number[];
}

const GROUP_A: IndexBar[] = [
  { label: 'PEARL Load Velocity',   weight: '15%', score: 62, sparkline: [55, 58, 61, 59, 63, 62, 62] },
  { label: 'Per Capita Load',        weight: '13%', score: 67, sparkline: [60, 62, 64, 65, 66, 68, 67] },
  { label: 'Infrastructure Failure', weight: '14%', score: 41, sparkline: [48, 45, 43, 44, 42, 40, 41] },
  { label: 'Permit Risk Exposure',   weight: '12%', score: 38, sparkline: [42, 40, 39, 41, 38, 37, 38] },
  { label: 'Ecological Health',      weight: '12%', score: 71, sparkline: [65, 67, 68, 70, 69, 71, 71] },
  { label: 'Watershed Recovery',     weight: '10%', score: 55, sparkline: [50, 51, 53, 52, 54, 56, 55] },
  { label: 'Waterfront Exposure',    weight: '8%', score: 49, sparkline: [52, 50, 48, 49, 51, 50, 49] },
  { label: 'EJ Vulnerability',       weight: '8%', score: 33, sparkline: [38, 36, 35, 34, 33, 34, 33] },
  { label: 'Governance Response',    weight: '8%', score: 58, sparkline: [54, 55, 56, 57, 58, 57, 58] },
];

const GROUP_B: IndexBar[] = [
  { label: 'Water Quality Grade',     weight: '38%', score: 64, sparkline: [58, 60, 61, 63, 62, 64, 64] },
  { label: 'Monitoring Coverage',     weight: '8%', score: 72, sparkline: [66, 68, 69, 70, 71, 72, 72] },
  { label: 'Data Freshness',          weight: '20%', score: 81, sparkline: [74, 76, 78, 79, 80, 81, 81] },
  { label: 'Regulatory Compliance',   weight: '18%', score: 45, sparkline: [50, 48, 47, 46, 45, 44, 45] },
  { label: 'Trend Direction',         weight: '16%', score: 53, sparkline: [49, 50, 51, 52, 53, 52, 53] },
];

const COMPOSITE = 58;

/* ── Helpers ────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

/* ── Sparkline SVG ──────────────────────────────────────────────────── */

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const W = 60, H = 20, PAD = 2;
  const min = Math.min(...data) - 2;
  const max = Math.max(...data) + 2;
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const last = data[data.length - 1];
  const lx = W - PAD;
  const ly = H - PAD - ((last - min) / range) * (H - PAD * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0" style={{ width: 60, height: 20 }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lx} cy={ly} r="2" fill={color} />
    </svg>
  );
}

/* ── Score arc gauge ────────────────────────────────────────────────── */

function ScoreArc({ score }: { score: number }) {
  const size = 180;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const startAngle = 135;
  const totalAngle = 270;
  const pct = score / 100;
  const dashLen = circ * (totalAngle / 360) * pct;
  const gapLen = circ - dashLen;

  const color = scoreColor(score);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
        {/* Background arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={stroke}
          strokeDasharray={`${circ * (totalAngle / 360)} ${circ * ((360 - totalAngle) / 360)}`}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
        />
        {/* Score arc */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dashLen} ${gapLen}`}
          strokeLinecap="round"
          transform={`rotate(${startAngle} ${size / 2} ${size / 2})`}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-bold font-mono" style={{ color }}>{score}</span>
        <span className="text-sm text-slate-400">/100</span>
      </div>
    </div>
  );
}

/* ── Index bar row ──────────────────────────────────────────────────── */

function IndexBarRow({ bar, animate }: { bar: IndexBar; animate: boolean }) {
  const color = scoreColor(bar.score);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-44 text-sm text-slate-300 truncate">{bar.label}</div>
      <div className="text-xs text-slate-500 w-8 text-right font-mono">{bar.weight}</div>
      <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: animate ? `${bar.score}%` : '0%',
            background: color,
          }}
        />
      </div>
      <div className="w-8 text-sm font-mono font-bold text-right" style={{ color }}>
        {bar.score}
      </div>
      <Sparkline data={bar.sparkline} color={color} />
    </div>
  );
}

/* ── Component ──────────────────────────────────────────────────────── */

export function WaterScoreBreakdown() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setAnimate(true); },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="bg-slate-950 py-20 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header — score + watershed label */}
        <div className="flex flex-col sm:flex-row items-center gap-8 mb-12">
          <ScoreArc score={COMPOSITE} />
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">
              Chesapeake Bay / Potomac Watershed
            </h2>
            <p className="text-slate-400 text-sm">
              Composite Water Intelligence Score — 14 calibrated models
            </p>
          </div>
        </div>

        {/* Group A */}
        <div className="mb-10">
          <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-4">
            Group A — HUC-8 Watershed Models
          </h3>
          <div className="space-y-0.5">
            {GROUP_A.map((bar) => (
              <IndexBarRow key={bar.label} bar={bar} animate={animate} />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800 my-6" />

        {/* Group B */}
        <div className="mb-10">
          <h3 className="text-[10px] font-bold tracking-[0.2em] uppercase text-slate-500 mb-4">
            Group B — Waterbody Models
          </h3>
          <div className="space-y-0.5">
            {GROUP_B.map((bar) => (
              <IndexBarRow key={bar.label} bar={bar} animate={animate} />
            ))}
          </div>
        </div>

        {/* Bottom copy */}
        <p className="text-sm text-slate-500 italic text-center max-w-2xl mx-auto">
          The PIN Water Score is not a query. It is a model — 14 calibrated watershed
          intelligence models, synthesized into one number.
        </p>
      </div>
    </section>
  );
}

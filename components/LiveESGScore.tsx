'use client';

import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Droplets, Leaf, Fish, BarChart3 } from 'lucide-react';
import { WaterQualityData } from '@/lib/types';

interface LiveESGScoreProps {
  data: WaterQualityData;
  removalEfficiencies: Record<string, number>;
  regionName: string;
}

// SDG alignment mapping
const SDG_ALIGNMENT = [
  { number: 6,  label: 'Clean Water & Sanitation',  color: '#26BDE2', relevant: true },
  { number: 14, label: 'Life Below Water',           color: '#0A97D9', relevant: true },
  { number: 13, label: 'Climate Action',             color: '#3F7E44', relevant: true },
  { number: 11, label: 'Sustainable Cities',         color: '#FD9D24', relevant: true },
  { number: 15, label: 'Life on Land',               color: '#56C02B', relevant: false },
];

function calculateESGScores(data: WaterQualityData, removalEfficiencies: Record<string, number>) {
  // ── E: Water Quality Score (Environmental) ─────────────────────────────
  const doScore      = Math.min(100, (data.parameters.DO.value / 9) * 100);
  const turbScore    = Math.max(0, 100 - (data.parameters.turbidity.value / 50) * 100);
  const tnScore      = Math.max(0, 100 - (data.parameters.TN.value / 1.5) * 100);
  const tpScore      = Math.max(0, 100 - (data.parameters.TP.value / 0.15) * 100);
  const tssScore     = Math.max(0, 100 - (data.parameters.TSS.value / 100) * 100);
  const waterQuality = Math.round((doScore * 2 + turbScore + tnScore + tpScore + tssScore) / 6);

  // ── Load Reduction Score (Treatment Performance) ───────────────────────
  const tssEff  = Math.min(100, removalEfficiencies.TSS  || 0);
  const tnEff   = Math.min(100, removalEfficiencies.TN   || 0);
  const tpEff   = Math.min(100, removalEfficiencies.TP   || 0);
  const turbEff = Math.min(100, removalEfficiencies.turbidity || 0);
  const loadReduction = Math.round((tssEff * 1.5 + tnEff + tpEff + turbEff) / 4.5);

  // ── Ecosystem Health Score ─────────────────────────────────────────────
  const doEcosystem  = data.parameters.DO.value >= 6 ? 100 : data.parameters.DO.value >= 4 ? 60 : 20;
  const tnEcosystem  = data.parameters.TN.value <= 0.8 ? 100 : data.parameters.TN.value <= 1.5 ? 65 : 30;
  const tpEcosystem  = data.parameters.TP.value <= 0.05 ? 100 : data.parameters.TP.value <= 0.15 ? 65 : 25;
  const ecosystemHealth = Math.round((doEcosystem + tnEcosystem + tpEcosystem) / 3);

  // ── Overall ESG Score (weighted) ──────────────────────────────────────
  const overall = Math.round(waterQuality * 0.35 + loadReduction * 0.40 + ecosystemHealth * 0.25);

  return { waterQuality, loadReduction, ecosystemHealth, overall };
}

function getLetterGrade(score: number): { grade: string; color: string; bg: string } {
  if (score >= 93) return { grade: 'A+', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-300' };
  if (score >= 85) return { grade: 'A',  color: 'text-green-600',   bg: 'bg-green-50 border-green-300' };
  if (score >= 78) return { grade: 'B+', color: 'text-lime-600',    bg: 'bg-lime-50 border-lime-300' };
  if (score >= 70) return { grade: 'B',  color: 'text-yellow-600',  bg: 'bg-yellow-50 border-yellow-300' };
  if (score >= 60) return { grade: 'C',  color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-300' };
  return                   { grade: 'D',  color: 'text-red-600',     bg: 'bg-red-50 border-red-300' };
}

function ScoreRing({ score, label, color, size = 'sm' }: { score: number; label: string; color: string; size?: 'sm' | 'lg' }) {
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const r = size === 'lg' ? 52 : 36;
  const circumference = 2 * Math.PI * r;
  const strokeDash = (animated / 100) * circumference;
  const dim = size === 'lg' ? 120 : 84;

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: dim, height: dim }} className="relative">
        <svg width={dim} height={dim} className="-rotate-90">
          <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={size === 'lg' ? 10 : 7} />
          <circle
            cx={dim/2} cy={dim/2} r={r} fill="none"
            stroke={color} strokeWidth={size === 'lg' ? 10 : 7}
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1.5s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-black tabular-nums ${size === 'lg' ? 'text-3xl' : 'text-xl'}`} style={{ color }}>
            {Math.round(animated)}
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-600 text-center leading-tight">{label}</span>
    </div>
  );
}

export function LiveESGScore({ data, removalEfficiencies, regionName }: LiveESGScoreProps) {
  const scores = useMemo(() => calculateESGScores(data, removalEfficiencies), [data, removalEfficiencies]);
  const grade = getLetterGrade(scores.overall);
  const [prevScore, setPrevScore] = useState(scores.overall);
  const [trend, setTrend] = useState<'up' | 'down' | 'flat'>('flat');
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (scores.overall !== prevScore) {
      setTrend(scores.overall > prevScore ? 'up' : 'down');
      setFlash(true);
      setPrevScore(scores.overall);
      const t = setTimeout(() => { setFlash(false); setTrend('flat'); }, 2000);
      return () => clearTimeout(t);
    }
  }, [scores.overall, prevScore]);

  const subScores = [
    { key: 'waterQuality',   label: 'Water\nQuality',    value: scores.waterQuality,   color: '#3b82f6', icon: Droplets,  desc: 'DO, TSS, turbidity, nutrients vs. standards' },
    { key: 'loadReduction',  label: 'Load\nReduction',   value: scores.loadReduction,  color: '#10b981', icon: Leaf,      desc: 'Treatment performance vs. TMDL targets' },
    { key: 'ecosystemHealth',label: 'Ecosystem\nHealth', value: scores.ecosystemHealth,color: '#8b5cf6', icon: Fish,      desc: 'Habitat conditions for aquatic life' },
  ];

  return (
    <Card className={`border-2 shadow-xl transition-all duration-500 ${flash ? 'border-emerald-400 shadow-emerald-100' : 'border-teal-300'} bg-gradient-to-br from-slate-50 via-white to-teal-50`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
              <BarChart3 className="h-6 w-6 text-teal-600" />
              Live ESG Water Impact Score
            </CardTitle>
            <CardDescription>
              Real-time environmental performance — recalculates with every sensor update · {regionName}
            </CardDescription>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-2 bg-teal-900 text-white px-3 py-1.5 rounded-full text-xs font-semibold">
            <span className="inline-block w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            LIVE SCORE
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main score display */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Big ring */}
          <div className="flex-shrink-0">
            <ScoreRing score={scores.overall} label="" color={scores.overall >= 85 ? '#10b981' : scores.overall >= 65 ? '#f59e0b' : '#ef4444'} size="lg" />
          </div>

          {/* Grade + trend */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className={`text-5xl font-black ${grade.color} border-2 ${grade.bg} w-20 h-20 rounded-2xl flex items-center justify-center`}>
                {grade.grade}
              </div>
              <div>
                <div className="text-2xl font-black text-slate-900">{scores.overall}<span className="text-base font-semibold text-slate-400">/100</span></div>
                <div className="flex items-center gap-1 text-sm">
                  {trend === 'up'   && <><TrendingUp   className="h-4 w-4 text-green-500" /><span className="text-green-600 font-semibold">Improving</span></>}
                  {trend === 'down' && <><TrendingDown  className="h-4 w-4 text-red-500"   /><span className="text-red-600 font-semibold">Declining</span></>}
                  {trend === 'flat' && <span className="text-slate-500">Overall ESG Score</span>}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">Updates with live sensor data</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-score rings */}
        <div className="grid grid-cols-3 gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-200">
          {subScores.map(({ key, label, value, color, icon: Icon, desc }) => (
            <div key={key} className="flex flex-col items-center gap-2">
              <ScoreRing score={value} label={label.replace('\n', ' ')} color={color} size="sm" />
              <div className="flex items-center gap-1">
                <Icon className="h-3 w-3" style={{ color }} />
                <span className="text-xs text-slate-500 text-center leading-tight">{desc.split(' ').slice(0, 4).join(' ')}…</span>
              </div>
            </div>
          ))}
        </div>

        {/* SDG alignment */}
        <div>
          <div className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">UN SDG Alignment</div>
          <div className="flex flex-wrap gap-2">
            {SDG_ALIGNMENT.map(sdg => (
              <div
                key={sdg.number}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${sdg.relevant ? 'opacity-100' : 'opacity-40'}`}
                style={{ borderColor: sdg.color, backgroundColor: `${sdg.color}18`, color: sdg.color }}
              >
                <span className="font-black">SDG {sdg.number}</span>
                <span className="hidden sm:inline">· {sdg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Investor framing */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-xs text-teal-800">
          <strong>📊 For ESG Reporting:</strong> This score maps to GRI Standard 303 (Water and Effluents), SASB Environment metric EM-WM-140a.1, and Chesapeake Bay Program water quality indicators. Score recalculates in real time as sensor data updates.
        </div>
      </CardContent>
    </Card>
  );
}

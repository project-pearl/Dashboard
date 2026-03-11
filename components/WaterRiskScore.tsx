'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Search, Download, ExternalLink, ChevronDown, ChevronRight,
  Droplets, Building2, Scale, FlaskConical, Users, AlertTriangle, Info, Shield,
  Lock, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import PublicHeader from './PublicHeader';
import type { WaterRiskScoreResult, CategoryKey } from '@/lib/waterRiskScore';
import type { Observation } from '@/lib/waterQualityScore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocationInfo {
  lat: number;
  lng: number;
  state: string;
  label: string;
  zip?: string;
  huc8?: string;
  hucDistance?: number;
}

interface ApiResponse extends WaterRiskScoreResult {
  location: LocationInfo;
  generatedAt: string;
}

type ViewState = 'landing' | 'loading' | 'results' | 'error';

// ─── Constants ────────────────────────────────────────────────────────────────

const EXAMPLE_SEARCHES = [
  { label: 'Baltimore, MD', query: 'address=Baltimore+MD' },
  { label: 'Flint, MI', query: 'address=Flint+MI' },
  { label: 'ZIP 90210', query: 'zip=90210' },
  { label: '39.27, -76.61', query: 'lat=39.27&lng=-76.61' },
];

const CATEGORY_META: Record<CategoryKey, { icon: React.ReactNode; color: string }> = {
  waterQuality: { icon: <Droplets className="w-5 h-5" />, color: 'blue' },
  infrastructure: { icon: <Building2 className="w-5 h-5" />, color: 'amber' },
  compliance: { icon: <Scale className="w-5 h-5" />, color: 'purple' },
  contamination: { icon: <FlaskConical className="w-5 h-5" />, color: 'rose' },
  environmentalJustice: { icon: <Users className="w-5 h-5" />, color: 'teal' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectInputType(input: string): string {
  const trimmed = input.trim();
  if (/^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(trimmed)) {
    const [lat, lng] = trimmed.split(',').map(s => s.trim());
    return `lat=${lat}&lng=${lng}`;
  }
  if (/^\d{5}(-\d{4})?$/.test(trimmed)) {
    return `zip=${trimmed.slice(0, 5)}`;
  }
  return `address=${encodeURIComponent(trimmed)}`;
}

function conditionLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Poor';
  return 'Critical';
}

function conditionColorDark(score: number): string {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 70) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  if (score >= 30) return 'text-orange-400';
  return 'text-red-400';
}

function conditionBgDark(score: number): string {
  if (score >= 90) return 'bg-emerald-950/40 border-emerald-800/40';
  if (score >= 70) return 'bg-green-950/40 border-green-800/40';
  if (score >= 50) return 'bg-yellow-950/40 border-yellow-800/40';
  if (score >= 30) return 'bg-orange-950/40 border-orange-800/40';
  return 'bg-red-950/40 border-red-800/40';
}

function ringColor(score: number): string {
  if (score >= 90) return '#10b981'; // emerald-500
  if (score >= 70) return '#22c55e'; // green-500
  if (score >= 50) return '#eab308'; // yellow-500
  if (score >= 30) return '#f97316'; // orange-500
  return '#ef4444'; // red-500
}

function severityBorderDark(severity: Observation['severity']): string {
  switch (severity) {
    case 'critical': return 'border-l-red-500 bg-red-950/30';
    case 'warning': return 'border-l-yellow-500 bg-yellow-950/30';
    default: return 'border-l-blue-500 bg-blue-950/30';
  }
}

// ─── Score Gauge SVG ──────────────────────────────────────────────────────────

function ScoreGauge({ score, letter }: { score: number; letter: string }) {
  const radius = 80;
  const stroke = 10;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = ringColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={200} height={200} className="-rotate-90">
        <circle
          cx={100} cy={100} r={radius}
          fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={stroke}
        />
        <circle
          cx={100} cy={100} r={radius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-lg font-semibold" style={{ color }}>{letter}</span>
      </div>
    </div>
  );
}

// ─── Category Detail Section ──────────────────────────────────────────────────

function CategoryDetail({
  catKey,
  category,
}: {
  catKey: CategoryKey;
  category: WaterRiskScoreResult['categories'][CategoryKey];
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[catKey];

  return (
    <div className="bg-white/[0.05] border border-white/[0.08] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.05] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`text-${meta.color}-400`}>{meta.icon}</span>
          {expanded
            ? <ChevronDown className="w-4 h-4 text-slate-500" />
            : <ChevronRight className="w-4 h-4 text-slate-500" />
          }
          <div className="text-left">
            <h3 className="text-sm font-semibold text-white">{category.label}</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {category.factors.length} factor{category.factors.length !== 1 ? 's' : ''} analyzed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${conditionColorDark(category.score)}`}>
            {conditionLabel(category.score)}
          </span>
          <span className="text-sm font-bold text-white">{category.score}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/[0.06]">
          <div className="mt-3 space-y-2">
            {category.factors.map((f, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 text-sm border-b border-white/[0.04] last:border-0">
                <span className="text-slate-400">{f.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white">{f.value}</span>
                  <span className={`w-2 h-2 rounded-full ${
                    f.impact === 'positive' ? 'bg-green-500' :
                    f.impact === 'negative' ? 'bg-red-500' : 'bg-slate-600'
                  }`} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
            <Info className="w-3 h-3" />
            Confidence: {category.confidence}%
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Login Wall ───────────────────────────────────────────────────────────────

function LoginWall() {
  return (
    <div className="relative mt-8">
      {/* Blurred teaser rows */}
      <div className="space-y-3 opacity-30 blur-[6px] pointer-events-none select-none" aria-hidden>
        {['Water Quality', 'Infrastructure', 'Compliance', 'Contamination', 'Environmental Justice'].map(label => (
          <div key={label} className="bg-white/[0.05] border border-white/[0.08] rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 rounded bg-slate-700" />
              <span className="text-sm text-slate-400">{label}</span>
            </div>
            <div className="w-8 h-4 rounded bg-slate-700" />
          </div>
        ))}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center bg-slate-900/90 backdrop-blur-sm border border-white/[0.1] rounded-2xl px-8 py-8 max-w-md shadow-2xl">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
            <Lock className="w-5 h-5 text-cyan-400" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">
            Full breakdown requires an account
          </h3>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            Sign in to unlock detailed category scores, factor analysis, observations, implications, and PDF export.
          </p>
          <Link
            href="/sign-in"
            className="group inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-900 rounded-full text-sm font-semibold hover:bg-slate-100 transition-colors"
          >
            Sign in to unlock <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <p className="mt-3 text-xs text-slate-500">
            Free accounts available for qualified professionals
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WaterRiskScore() {
  const [view, setView] = useState<ViewState>('landing');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState('');
  const reportRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (queryString: string) => {
    setView('loading');
    setError('');
    try {
      const res = await fetch(`/api/water-risk-score?${queryString}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json: ApiResponse = await res.json();
      setData(json);
      setView('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setView('error');
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    doSearch(detectInputType(searchInput));
  };

  const handleExampleClick = (query: string) => {
    doSearch(query);
  };

  const handleExportPdf = async () => {
    const el = reportRef.current;
    if (!el) return;
    try {
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Water_Risk_Score_${dateStr}.pdf`;
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf().set({
        margin: [0.3, 0.4, 0.5, 0.4],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, windowWidth: 1000 },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' as const },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.risk-card'] },
      }).from(el).save();
    } catch {
      // silent fail
    }
  };

  // TODO: replace with real auth check (e.g. useSession or cookie check)
  const isAuthenticated = false;

  return (
    <div className="min-h-screen bg-slate-950">
      <PublicHeader />

      <main className="pt-20 pb-16">
        {/* ── Landing / Search ──────────────────────────────────────────── */}
        {(view === 'landing' || view === 'error') && (
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900" />
            <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-5" />
            <div className="relative max-w-3xl mx-auto px-6 py-20 text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs text-blue-200 mb-6">
                <Shield className="w-3.5 h-3.5" />
                Powered by EPA + PEARL Intelligence
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
                Water Risk Score
              </h1>
              <p className="text-lg text-slate-300 mb-10">
                Know your water risk in seconds. Enter any US address, ZIP code, or coordinates.
              </p>

              <form onSubmit={handleSubmit} className="max-w-xl mx-auto">
                <div className="flex bg-white/[0.08] border border-white/[0.12] rounded-xl shadow-2xl shadow-black/30 overflow-hidden backdrop-blur-sm">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={e => setSearchInput(e.target.value)}
                    placeholder="Address, ZIP code, or coordinates..."
                    className="flex-1 px-5 py-4 bg-transparent text-white placeholder:text-slate-500 outline-none text-base"
                  />
                  <button
                    type="submit"
                    className="px-6 bg-cyan-600 hover:bg-cyan-500 text-white transition-colors flex items-center gap-2 font-medium"
                  >
                    <Search className="w-4 h-4" />
                    Score
                  </button>
                </div>
              </form>

              {error && (
                <div className="mt-4 text-red-300 text-sm bg-red-900/30 rounded-lg px-4 py-2 inline-block">
                  {error}
                </div>
              )}

              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {EXAMPLE_SEARCHES.map(ex => (
                  <button
                    key={ex.label}
                    onClick={() => handleExampleClick(ex.query)}
                    className="text-xs px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 rounded-full transition-colors border border-white/[0.08]"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Loading ───────────────────────────────────────────────────── */}
        {view === 'loading' && (
          <div className="max-w-3xl mx-auto px-6 py-32 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-950/50 border border-blue-800/30 mb-6">
              <Droplets className="w-8 h-8 text-blue-400 animate-pulse" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Analyzing Water Risk</h2>
            <p className="text-sm text-slate-500">
              Querying EPA databases, HUC-8 indices, and environmental data...
            </p>
            <div className="mt-8 flex justify-center gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Results ───────────────────────────────────────────────────── */}
        {view === 'results' && data && (
          <div ref={reportRef} className="max-w-4xl mx-auto px-6 py-8 space-y-8">

            {/* Location strip */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{data.location.label}</h2>
                <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                  {data.location.state && (
                    <span className="px-2 py-0.5 bg-white/[0.06] rounded text-xs font-medium text-slate-400 border border-white/[0.08]">
                      {data.location.state}
                    </span>
                  )}
                  <span>{data.location.lat.toFixed(4)}, {data.location.lng.toFixed(4)}</span>
                  {data.location.huc8 && (
                    <span className="text-xs text-slate-500">HUC-8: {data.location.huc8}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setView('landing'); setData(null); setSearchInput(''); }}
                className="text-sm text-cyan-400 hover:text-cyan-300 font-medium"
              >
                Search again
              </button>
            </div>

            {/* Score hero card — always visible */}
            <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-8 text-center">
              <ScoreGauge score={data.composite.score} letter={data.composite.letter} />
              <div className="mt-4">
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${conditionBgDark(data.composite.score)} ${conditionColorDark(data.composite.score)}`}>
                  {conditionLabel(data.composite.score)} Condition
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Confidence: {data.composite.confidence}%
              </p>
              {data.composite.confidence < 40 && (
                <div className="mt-4 mx-auto max-w-md px-4 py-2 bg-amber-950/30 border border-amber-800/30 rounded-lg text-xs text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5" />
                  Limited data available. Score has been adjusted to reflect uncertainty.
                </div>
              )}
            </div>

            {/* Category KPI strip — always visible */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {(Object.keys(CATEGORY_META) as CategoryKey[]).map(key => {
                const cat = data.categories[key];
                const meta = CATEGORY_META[key];
                return (
                  <div
                    key={key}
                    className={`risk-card rounded-xl p-4 text-center ${conditionBgDark(cat.score)} border`}
                  >
                    <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.06] text-${meta.color}-400 mb-2`}>
                      {meta.icon}
                    </div>
                    <div className="text-2xl font-bold text-white">{cat.score}</div>
                    <div className={`text-xs font-semibold ${conditionColorDark(cat.score)}`}>
                      {conditionLabel(cat.score)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">{cat.label}</div>
                  </div>
                );
              })}
            </div>

            {/* ── Login wall OR full details ─────────────────────────────── */}
            {!isAuthenticated ? (
              <LoginWall />
            ) : (
              <>
                {/* Category detail cards */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                    Detailed Breakdown
                  </h3>
                  {(Object.keys(CATEGORY_META) as CategoryKey[]).map(key => (
                    <CategoryDetail key={key} catKey={key} category={data.categories[key]} />
                  ))}
                </div>

                {/* Observations */}
                {data.details.observations.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                      Observations
                    </h3>
                    {data.details.observations.map((obs, i) => (
                      <div key={i} className={`border-l-4 rounded-lg px-4 py-3 text-sm text-slate-300 ${severityBorderDark(obs.severity)}`}>
                        <span className="mr-2">{obs.icon}</span>
                        {obs.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Implications */}
                {data.details.implications.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                      Implications
                    </h3>
                    {data.details.implications.map((imp, i) => (
                      <div key={i} className={`border-l-4 rounded-lg px-4 py-3 text-sm text-slate-300 ${severityBorderDark(imp.severity)}`}>
                        <span className="mr-2">{imp.icon}</span>
                        {imp.text}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleExportPdf}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export PDF
                  </button>
                  <a
                    href={`/dashboard/infrastructure?lens=overview`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/[0.15] text-slate-300 rounded-lg text-sm font-medium hover:bg-white/[0.05] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Full Site Intelligence Dashboard
                  </a>
                </div>
              </>
            )}

            {/* Data source attribution */}
            <div className="border-t border-white/[0.06] pt-6 text-xs text-slate-500">
              <p className="font-medium text-slate-400 mb-1">Data Sources</p>
              <p>{data.dataSources.join(' | ')}</p>
              <p className="mt-2">
                Generated {new Date(data.generatedAt).toLocaleString()}. Scores are estimates
                based on publicly available data and should not replace professional assessment.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

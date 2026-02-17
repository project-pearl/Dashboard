'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, Shield, TrendingUp, TrendingDown, Activity, MapPin,
  ChevronRight, ArrowRight, BarChart3, Zap, Database, Building2,
  GraduationCap, Globe, Users, Lock, Eye, AlertTriangle, CheckCircle,
  Search, FlaskConical, DollarSign, FileCheck, Waves, Leaf, ChevronDown,
  ExternalLink, Mail,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type AlertLevel = 'high' | 'medium' | 'low' | 'none';

interface BayHealthMetric {
  label: string;
  value: number;
  trend: 'up' | 'down' | 'flat';
  trendPct: number;
  unit: string;
  description: string;
}

interface ImpairedWaterbody {
  name: string;
  state: string;
  category: string;
  causes: string[];
  alertLevel: AlertLevel;
}

interface StateSnapshot {
  state: string;
  abbr: string;
  totalAssessed: number;
  impairedPct: number;
  trend: 'improving' | 'declining' | 'stable';
}

// ─── Constants ──────────────────────────────────────────────────────────────

const HERO_STATS = [
  { value: '24/7', label: 'Continuous Monitoring', icon: Activity },
  { value: '88-95%', label: 'TSS Removal (Pilot)', icon: Droplets },
  { value: '629+', label: 'MD Waterbodies Tracked', icon: MapPin },
  { value: '<$1.27', label: 'Per Cubic Meter Treatment', icon: DollarSign },
];

// Chesapeake Bay TMDL progress — sourced from CBP annual report data
const CHESAPEAKE_HEALTH: BayHealthMetric[] = [
  { label: 'Dissolved Oxygen', value: 58, trend: 'up', trendPct: 3.2, unit: '%', description: 'Volume meeting DO standards in summer' },
  { label: 'Water Clarity', value: 42, trend: 'down', trendPct: 1.8, unit: '%', description: 'Bay area meeting clarity goals' },
  { label: 'Chlorophyll-a', value: 65, trend: 'up', trendPct: 2.1, unit: '%', description: 'Stations below algal bloom threshold' },
  { label: 'Nitrogen Load', value: 47, trend: 'flat', trendPct: 0.3, unit: '% of goal', description: 'Progress toward 2025 TMDL target' },
  { label: 'Phosphorus Load', value: 72, trend: 'up', trendPct: 4.5, unit: '% of goal', description: 'Progress toward 2025 TMDL target' },
  { label: 'Sediment Load', value: 81, trend: 'up', trendPct: 1.9, unit: '% of goal', description: 'Progress toward 2025 TMDL target' },
];

const WATERSHED_STATES: StateSnapshot[] = [
  { state: 'Maryland', abbr: 'MD', totalAssessed: 629, impairedPct: 41, trend: 'stable' },
  { state: 'Virginia', abbr: 'VA', totalAssessed: 512, impairedPct: 38, trend: 'improving' },
  { state: 'Pennsylvania', abbr: 'PA', totalAssessed: 845, impairedPct: 52, trend: 'declining' },
  { state: 'Washington DC', abbr: 'DC', totalAssessed: 24, impairedPct: 83, trend: 'improving' },
  { state: 'New York', abbr: 'NY', totalAssessed: 210, impairedPct: 35, trend: 'stable' },
  { state: 'West Virginia', abbr: 'WV', totalAssessed: 180, impairedPct: 44, trend: 'declining' },
];

// Cat 4/5 impaired waterbodies (public EPA ATTAINS data — no auth)
const RECENT_IMPAIRMENTS: ImpairedWaterbody[] = [
  { name: 'Back River', state: 'MD', category: '5', causes: ['Nitrogen', 'Phosphorus', 'Sediment'], alertLevel: 'high' },
  { name: 'Anacostia River', state: 'DC', category: '5', causes: ['PCBs', 'Bacteria', 'Trash'], alertLevel: 'high' },
  { name: 'Middle Branch', state: 'MD', category: '5', causes: ['Dissolved Oxygen', 'TSS', 'Bacteria'], alertLevel: 'high' },
  { name: "Gwynn's Falls", state: 'MD', category: '5', causes: ['Bacteria', 'Sediment'], alertLevel: 'high' },
  { name: 'Elizabeth River', state: 'VA', category: '5', causes: ['PCBs', 'Metals'], alertLevel: 'high' },
  { name: 'Conestoga River', state: 'PA', category: '5', causes: ['Nitrogen', 'Sediment', 'Bacteria'], alertLevel: 'high' },
  { name: 'Jones Falls', state: 'MD', category: '4a', causes: ['Bacteria', 'Trash'], alertLevel: 'medium' },
  { name: 'Rock Creek', state: 'DC', category: '4a', causes: ['Bacteria', 'Sediment'], alertLevel: 'medium' },
];

const ROLE_CARDS = [
  {
    role: 'MS4 Compliance Officer',
    icon: Building2,
    colorBg: 'bg-cyan-100', colorText: 'text-cyan-700', hoverBorder: 'hover:border-cyan-300',
    headline: 'Cut monitoring costs 40-60%',
    description: 'Continuous compliance data, automated MDE reports, nutrient credit tracking. Replace grab sampling with 24/7 sensor-based monitoring.',
    features: ['Automated MDE Annual Reports', 'TMDL Load Reduction Tracking', 'Nutrient Credit Calculator', 'Storm Event BMP Performance'],
    cta: 'See ROI Calculator',
  },
  {
    role: 'State Regulator',
    icon: Shield,
    colorBg: 'bg-blue-100', colorText: 'text-blue-700', hoverBorder: 'hover:border-blue-300',
    headline: 'Statewide water quality intelligence',
    description: 'Real-time impairment tracking across all assessed waterbodies. ATTAINS integration, trend analysis, and restoration progress.',
    features: ['629+ Waterbody Dashboard', 'ATTAINS Auto-sync', 'Restoration Progress Tracking', 'Cross-jurisdiction Comparison'],
    cta: 'View State Dashboard',
  },
  {
    role: 'Researcher / University',
    icon: GraduationCap,
    colorBg: 'bg-indigo-100', colorText: 'text-indigo-700', hoverBorder: 'hover:border-indigo-300',
    headline: 'Continuous high-frequency data',
    description: 'Access sensor data at 15-minute intervals. Export for analysis, publish with PEARL citation, connect to USGS/WQP.',
    features: ['15-min Interval Sensor Data', 'QAPP-grade QA/QC', 'API Access & Bulk Export', 'Manuscript & Citation Tools'],
    cta: 'Explore Data Sources',
  },
  {
    role: 'Public / Community',
    icon: Users,
    colorBg: 'bg-green-100', colorText: 'text-green-700', hoverBorder: 'hover:border-green-300',
    headline: "Know what's in your water",
    description: 'Track local waterway health, understand impairment causes, and see how restoration efforts are progressing in your community.',
    features: ['Waterway Health Scores', 'Plain-language Alerts', 'Community Report Cards', 'Environmental Justice Mapping'],
    cta: 'Check Your Waterway',
  },
];

const DATA_SOURCES = [
  { name: 'EPA ATTAINS', desc: 'Assessment & impairment data for all US waterbodies', url: 'https://www.epa.gov/waterdata/attains' },
  { name: 'USGS NWIS', desc: 'National Water Information System — real-time streamflow & quality', url: 'https://waterdata.usgs.gov/nwis' },
  { name: 'Water Quality Portal', desc: 'Multi-agency water quality monitoring data', url: 'https://www.waterqualitydata.us' },
  { name: 'NOAA CO-OPS', desc: 'Tidal predictions, water levels, & oceanographic data', url: 'https://tidesandcurrents.noaa.gov' },
  { name: 'Chesapeake Bay Program', desc: 'Bay-wide monitoring, modeling, & restoration tracking', url: 'https://www.chesapeakebay.net' },
  { name: 'MDE / State Agencies', desc: 'State-specific compliance data & permit requirements', url: '' },
  { name: 'EJScreen', desc: 'EPA Environmental Justice screening & mapping', url: 'https://www.epa.gov/ejscreen' },
  { name: 'PEARL Sensors', desc: 'Proprietary 15-min interval continuous monitoring network', url: '' },
];

// ─── Sub-Components ─────────────────────────────────────────────────────────

function LivePulse({ className = '' }: { className?: string }) {
  return (
    <span className={`relative flex h-2.5 w-2.5 ${className}`}>
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
    </span>
  );
}

function HealthGauge({ metric, delay }: { metric: BayHealthMetric; delay: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(metric.value), delay);
    return () => clearTimeout(t);
  }, [metric.value, delay]);

  const barColor = metric.value >= 70 ? 'bg-emerald-500' : metric.value >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Activity;
  const trendColor = metric.trend === 'up' ? 'text-emerald-600' : metric.trend === 'down' ? 'text-red-500' : 'text-slate-400';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{metric.label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-slate-900">{metric.value}%</span>
          <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
          <span className={`text-xs font-medium ${trendColor}`}>
            {metric.trend === 'up' ? '+' : metric.trend === 'down' ? '-' : '±'}{metric.trendPct}%
          </span>
        </div>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
      <p className="text-[11px] text-slate-500">{metric.description}</p>
    </div>
  );
}

function ImpairmentRow({ wb }: { wb: ImpairedWaterbody }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer group">
      <div className={`flex-shrink-0 w-2 h-2 mt-2 rounded-full ${
        wb.alertLevel === 'high' ? 'bg-red-500' : 'bg-amber-500'
      }`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800">{wb.name}</span>
          <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${
            wb.category === '5' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            Cat {wb.category}
          </Badge>
          <span className="text-[11px] text-slate-400 font-medium">{wb.state}</span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">{wb.causes.join(' · ')}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors flex-shrink-0 mt-1" />
    </div>
  );
}

function StatePill({ snap, onClick }: { snap: StateSnapshot; onClick?: () => void }) {
  const trendIcon = snap.trend === 'improving' ? '↗' : snap.trend === 'declining' ? '↘' : '→';
  const trendColor = snap.trend === 'improving' ? 'text-emerald-600' : snap.trend === 'declining' ? 'text-red-500' : 'text-slate-500';
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg bg-white border border-slate-200 hover:border-cyan-300 transition-all cursor-pointer group"
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-100 text-sm font-bold text-slate-700 group-hover:bg-cyan-50 group-hover:text-cyan-700 transition-colors">
        {snap.abbr}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-800">{snap.state}</div>
        <div className="text-[11px] text-slate-500">{snap.totalAssessed.toLocaleString()} waterbodies assessed</div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-bold text-slate-800">{snap.impairedPct}%</div>
        <div className={`text-[11px] font-medium ${trendColor}`}>{trendIcon} {snap.trend}</div>
      </div>
    </div>
  );
}

// Animated number counter
function AnimatedNumber({ target, suffix = '', prefix = '', className = '' }: { target: number; suffix?: string; prefix?: string; className?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    let frame: number;
    const duration = 1800;
    const start = performance.now();
    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <span className={className}>{prefix}{count.toLocaleString()}{suffix}</span>;
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

interface PublicLandingProps {
  onSignIn: () => void;
  onExploreState?: (stateAbbr: string) => void;
}

export function PublicLanding({ onSignIn, onExploreState }: PublicLandingProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ── Live ATTAINS stats (public API — no auth needed) ──
  const [liveStats, setLiveStats] = useState({ totalAssessed: 0, totalImpaired: 0, loading: true });

  useEffect(() => {
    let cancelled = false;
    async function fetchPublicStats() {
      try {
        const r = await fetch('/api/water-data?action=attains-national-cache');
        if (!r.ok) return;
        const json = await r.json();
        let totalAssessed = 0;
        let totalImpaired = 0;
        for (const stateData of Object.values(json.states || {}) as any[]) {
          const wbs = stateData.waterbodies || [];
          totalAssessed += wbs.length;
          totalImpaired += wbs.filter((w: any) =>
            w.category?.includes('5') || w.category?.includes('4')
          ).length;
        }
        if (!cancelled) setLiveStats({ totalAssessed, totalImpaired, loading: false });
      } catch {
        if (!cancelled) setLiveStats(prev => ({ ...prev, loading: false }));
      }
    }
    fetchPublicStats();
    return () => { cancelled = true; };
  }, []);

  const displayAssessed = liveStats.totalAssessed || 2847;
  const displayImpaired = liveStats.totalImpaired || 1162;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">

      {/* ═══════════════════════════════════════════════════════════════════
          NAV BAR — sticky, translucent
          ═══════════════════════════════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-600 to-blue-700 shadow-sm">
                <Waves className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold tracking-tight text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
                  PEARL
                </div>
                <div className="text-[9px] font-medium text-slate-400 -mt-1 tracking-widest uppercase">
                  Water Quality Intelligence
                </div>
              </div>
            </div>

            {/* Section links */}
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
              <a href="#bay-health" className="hover:text-cyan-700 transition-colors">Bay Health</a>
              <a href="#impairments" className="hover:text-cyan-700 transition-colors">Impairments</a>
              <a href="#how-it-works" className="hover:text-cyan-700 transition-colors">How It Works</a>
              <a href="#data-sources" className="hover:text-cyan-700 transition-colors">Data</a>
            </div>

            {/* Auth */}
            <div className="flex items-center gap-3">
              <a
                href="mailto:doug@project-pearl.org?subject=PEARL%20Demo%20Request"
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-cyan-700 border border-cyan-300 rounded-lg hover:bg-cyan-50 transition-colors"
              >
                Request Demo
              </a>
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 rounded-lg hover:from-cyan-700 hover:to-blue-800 shadow-sm hover:shadow-md transition-all"
              >
                <Lock className="h-3.5 w-3.5" />
                Sign In
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Gradient backdrop */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50/50 via-blue-50/30 to-slate-50" />
        <div className="absolute inset-0 opacity-25" style={{
          backgroundImage: 'radial-gradient(circle at 15% 50%, rgba(6,182,212,0.15) 0%, transparent 50%), radial-gradient(circle at 85% 25%, rgba(59,130,246,0.1) 0%, transparent 50%)'
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-3xl">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm border border-emerald-200 shadow-sm mb-6">
              <LivePulse />
              <span className="text-xs font-semibold text-emerald-700">Monitoring Chesapeake Bay Watershed Now</span>
            </div>

            <h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight"
              style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}
            >
              The Chesapeake Bay
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-700">
                needs better data.
              </span>
            </h1>

            <p className="mt-6 text-lg text-slate-600 leading-relaxed max-w-2xl">
              PEARL combines oyster biofiltration with continuous sensor monitoring
              to deliver real-time water quality intelligence. One platform for
              compliance, restoration, and research across the entire watershed.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={onSignIn}
                className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-cyan-600 to-blue-700 rounded-xl hover:from-cyan-700 hover:to-blue-800 shadow-lg shadow-cyan-200/50 transition-all hover:shadow-cyan-300/50"
              >
                Explore the Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href="#bay-health"
                className="inline-flex items-center gap-2 px-6 py-3 text-base font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <Eye className="h-4 w-4" />
                View Public Data
              </a>
            </div>
          </div>

          {/* Hero stats row */}
          <div className={`mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-1000 delay-200 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {HERO_STATS.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-white/70 backdrop-blur-sm border border-slate-200/60 shadow-sm">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-cyan-50">
                    <Icon className="h-5 w-5 text-cyan-700" />
                  </div>
                  <div>
                    <div className="text-xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-[11px] text-slate-500">{stat.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          LIVE ATTAINS NUMBERS BAR
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl lg:text-3xl font-bold tabular-nums">
                <AnimatedNumber target={displayAssessed} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Waterbodies Assessed</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-red-400 tabular-nums">
                <AnimatedNumber target={displayImpaired} />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Currently Impaired</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-cyan-400">6</div>
              <div className="text-[11px] text-slate-400 mt-1">Watershed States + DC</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-bold text-emerald-400">14,000+</div>
              <div className="text-[11px] text-slate-400 mt-1">MS4 Permits Nationwide</div>
            </div>
          </div>
          <div className="text-center mt-3">
            <span className="text-[10px] text-slate-500">
              Source: EPA ATTAINS Assessment Database · Updated daily · {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          BAY HEALTH SCORECARD — public EPA/CBP data
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="bay-health" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3 bg-cyan-50 text-cyan-700 border-cyan-200 text-xs">Public Data · No Sign-in Required</Badge>
          <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
            Chesapeake Bay Health Scorecard
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Real-time progress toward Bay TMDL restoration goals.
            Data sourced from the Chesapeake Bay Program, EPA, and state agencies.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Health gauges (2/3) */}
          <div className="lg:col-span-2">
            <Card className="border-2 border-slate-200">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Droplets className="h-5 w-5 text-cyan-600" />
                  Key Health Indicators
                </CardTitle>
                <CardDescription>Chesapeake Bay watershed progress — multi-year trends</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {CHESAPEAKE_HEALTH.map((m, i) => (
                  <HealthGauge key={i} metric={m} delay={200 + i * 150} />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* State snapshots (1/3) */}
          <div>
            <Card className="border-2 border-slate-200 h-full">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Globe className="h-5 w-5 text-blue-600" />
                  Watershed States
                </CardTitle>
                <CardDescription>Impairment rates by state (EPA ATTAINS)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {WATERSHED_STATES.map((s, i) => (
                  <StatePill
                    key={i}
                    snap={s}
                    onClick={() => onExploreState?.(s.abbr)}
                  />
                ))}
                <div className="text-center pt-2">
                  <button
                    onClick={onSignIn}
                    className="text-xs font-medium text-cyan-600 hover:text-cyan-700 transition-colors"
                  >
                    Sign in for full state dashboards →
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          IMPAIRED WATERBODIES — public EPA data
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="impairments" className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-3 bg-red-50 text-red-700 border-red-200 text-xs">EPA ATTAINS · Cat 4 & 5</Badge>
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
              Impaired Waterbodies in the Watershed
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              Category 4 and 5 impaired waterbodies — these need attention.
              PEARL provides the continuous data to document restoration progress and compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-4xl mx-auto">
            {RECENT_IMPAIRMENTS.map((wb, i) => (
              <ImpairmentRow key={i} wb={wb} />
            ))}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-cyan-700 border-2 border-cyan-300 rounded-xl hover:bg-cyan-50 transition-colors"
            >
              <Search className="h-4 w-4" />
              Search All {displayAssessed > 0 ? displayAssessed.toLocaleString() : '2,800+'} Waterbodies
            </button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          HOW PEARL WORKS — 3-column value prop
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
            Nature-Based Infrastructure, Sensor-Grade Data
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            PEARL combines biological water treatment with continuous monitoring — replacing
            periodic grab sampling with 24/7 compliance-grade intelligence.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: FlaskConical,
              title: 'Oyster Biofiltration',
              body: 'Engineered oyster reef systems filter stormwater runoff, removing suspended solids, nutrients, and pathogens. Our Milton, FL pilot achieved 88-95% TSS removal.',
              stat: '88-95%', statLabel: 'TSS Removal',
            },
            {
              icon: Activity,
              title: 'Continuous Monitoring',
              body: 'Multi-parameter sondes measure DO, turbidity, nutrients, TSS, and conductivity every 15 minutes. Real-time QA/QC with automated anomaly detection.',
              stat: '96×', statLabel: 'More data than grab sampling',
            },
            {
              icon: FileCheck,
              title: 'Automated Compliance',
              body: 'MDE-format annual reports generated automatically. Storm event BMP documentation, nutrient credit calculations, and TMDL load reduction tracking — all from one platform.',
              stat: '$0.73–1.27', statLabel: 'Per m³ treatment cost',
            },
          ].map((step, i) => {
            const Icon = step.icon;
            return (
              <Card key={i} className="border-2 border-slate-200 hover:border-cyan-200 transition-colors group">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-50 group-hover:bg-cyan-100 transition-colors mb-4">
                    <Icon className="h-6 w-6 text-cyan-700" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">{step.body}</p>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-xl font-bold text-cyan-700">{step.stat}</div>
                    <div className="text-[11px] text-slate-500">{step.statLabel}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Pilot proof */}
        <div className="mt-8 p-5 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 border-2 border-emerald-200">
          <div className="flex items-start gap-4">
            <CheckCircle className="h-6 w-6 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-emerald-800">Proof of Concept Validated — Milton, FL (January 2025)</div>
              <p className="text-sm text-emerald-700 mt-1">
                7-day field deployment achieved 88-95% TSS removal with continuous sensor verification.
                Data quality validated against split-sample grab analysis. System operated autonomously
                through 3 rain events totaling 2.1 inches.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          ROLE-BASED VALUE CARDS
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
              Built for Every Stakeholder
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              One platform, four perspectives. Sign in with your role to see the tools that matter to you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ROLE_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <Card key={i} className={`border-2 border-slate-200 ${card.hoverBorder} transition-all group cursor-pointer`} onClick={onSignIn}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${card.colorBg} ${card.colorText}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wide">{card.role}</div>
                        <div className="text-lg font-bold text-slate-800">{card.headline}</div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{card.description}</p>
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      {card.features.map((f, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                          <CheckCircle className="h-3 w-3 text-cyan-600 flex-shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-700 group-hover:text-cyan-800 transition-colors">
                      {card.cta}
                      <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DATA SOURCES — credibility section
          ═══════════════════════════════════════════════════════════════════ */}
      <section id="data-sources" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-slate-900" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
            Authoritative Data Sources
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            PEARL integrates federal, state, and local data sources into one unified water quality platform.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DATA_SOURCES.map((src, i) => {
            const isExternal = src.url && src.url.startsWith('http');
            const Wrapper = isExternal ? 'a' : 'div';
            const wrapperProps = isExternal
              ? { href: src.url, target: '_blank', rel: 'noopener noreferrer' }
              : {};
            return (
              <Wrapper
                key={i}
                {...wrapperProps as any}
                className="flex flex-col p-4 rounded-xl bg-white border border-slate-200 hover:border-cyan-200 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-2">
                  <Database className="h-5 w-5 text-slate-400 group-hover:text-cyan-600 transition-colors" />
                  {isExternal && <ExternalLink className="h-3 w-3 text-slate-300 group-hover:text-cyan-500 transition-colors" />}
                </div>
                <div className="text-sm font-bold text-slate-800 group-hover:text-cyan-700 transition-colors">{src.name}</div>
                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">{src.desc}</div>
              </Wrapper>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FINAL CTA
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-gradient-to-r from-cyan-700 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-3xl font-bold text-white" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>
            Ready to see your watershed?
          </h2>
          <p className="mt-4 text-cyan-100 text-lg max-w-2xl mx-auto">
            Sign in to access jurisdiction-specific compliance tools, continuous monitoring data,
            and automated reporting. Or request a custom demo for your MS4 permit area.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold text-cyan-800 bg-white rounded-xl hover:bg-cyan-50 shadow-lg transition-all"
            >
              <Lock className="h-4 w-4" />
              Sign In to Dashboard
            </button>
            <a
              href="mailto:doug@project-pearl.org?subject=PEARL%20Demo%20Request&body=I'd%20like%20to%20schedule%20a%20demo%20for%20my%20jurisdiction.%0A%0AName%3A%0AOrganization%3A%0ARole%3A%0AState%2FJurisdiction%3A%0A"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white border-2 border-white/40 rounded-xl hover:border-white/70 hover:bg-white/10 transition-all"
            >
              <Mail className="h-4 w-4" />
              Request Custom Demo
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════════ */}
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Waves className="h-5 w-5 text-cyan-400" />
                <span className="text-lg font-bold text-white" style={{ fontFamily: "'DM Serif Display', Georgia, serif" }}>PEARL</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                Proactive Engineering for Aquatic Rehabilitation & Legacy.
                Nature-based water treatment infrastructure with continuous sensor monitoring.
              </p>
              <p className="text-xs text-slate-500 mt-4">
                © {new Date().getFullYear()} Local Seafood Projects Inc. · project-pearl.org
              </p>
            </div>

            {/* Platform links */}
            <div>
              <div className="text-sm font-semibold text-slate-300 mb-3">Platform</div>
              <div className="space-y-2 text-sm">
                <div className="hover:text-cyan-400 cursor-pointer transition-colors" onClick={onSignIn}>MS4 Compliance</div>
                <div className="hover:text-cyan-400 cursor-pointer transition-colors" onClick={onSignIn}>State Dashboard</div>
                <div className="hover:text-cyan-400 cursor-pointer transition-colors" onClick={onSignIn}>Research Tools</div>
                <a href="mailto:doug@project-pearl.org" className="block hover:text-cyan-400 transition-colors">Request Access</a>
              </div>
            </div>

            {/* Data source links */}
            <div>
              <div className="text-sm font-semibold text-slate-300 mb-3">Data Sources</div>
              <div className="space-y-2 text-sm">
                <a href="https://www.epa.gov/waterdata/attains" target="_blank" rel="noopener noreferrer" className="block hover:text-cyan-400 transition-colors">EPA ATTAINS</a>
                <a href="https://waterdata.usgs.gov/nwis" target="_blank" rel="noopener noreferrer" className="block hover:text-cyan-400 transition-colors">USGS NWIS</a>
                <a href="https://www.waterqualitydata.us" target="_blank" rel="noopener noreferrer" className="block hover:text-cyan-400 transition-colors">Water Quality Portal</a>
                <a href="https://www.chesapeakebay.net" target="_blank" rel="noopener noreferrer" className="block hover:text-cyan-400 transition-colors">Bay Program</a>
              </div>
            </div>
          </div>

          {/* Legal / status footer */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex flex-wrap justify-between items-center gap-4 text-[11px] text-slate-500">
              <div className="max-w-2xl">
                Data from EPA, USGS, NOAA, and state agencies. Assessment data informational only — not regulatory guidance.
                Contact your state environmental agency for official compliance determinations.
              </div>
              <div className="flex items-center gap-2">
                <LivePulse />
                <span>System operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

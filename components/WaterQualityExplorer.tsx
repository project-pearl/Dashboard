'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GeoJSON, CircleMarker } from 'react-leaflet';
import dynamic from 'next/dynamic';
import { getStatesGeoJSON, geoToAbbr, STATE_GEO_LEAFLET, STATE_NAMES as _SN } from '@/lib/leafletMapUtils';

const LeafletMapShell = dynamic(
  () => import('@/components/LeafletMapShell').then(m => m.LeafletMapShell),
  { ssr: false }
);
import Image from 'next/image';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import {
  ArrowRight, Droplets, AlertTriangle, ShieldCheck, TrendingDown, X, ChevronDown,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

const STATE_NAMES = _SN;

const CAUSE_EMOJI: Record<string, string> = {
  'PATHOGENS': '🦠', 'NUTRIENTS': '🧪', 'NITROGEN (TOTAL)': '🧪',
  'PHOSPHORUS (TOTAL)': '🧫', 'SEDIMENT': '🏜️', 'SEDIMENTATION/SILTATION': '🏜️',
  'MERCURY': '☠️', 'METALS (OTHER THAN MERCURY)': '⚙️', 'ORGANIC ENRICHMENT/OXYGEN DEPLETION': '💀',
  'TEMPERATURE': '🌡️', 'TEMPERATURE, WATER': '🌡️', 'PH/ACIDITY/CAUSTIC CONDITIONS': '⚗️',
  'TURBIDITY': '🌫️', 'TOTAL TOXICS': '☢️', 'CAUSE UNKNOWN': '❓',
  'CAUSE UNKNOWN - FISH KILLS': '🐟', 'CAUSE UNKNOWN - IMPAIRED BIOTA': '🐛',
  'POLYCHLORINATED BIPHENYLS (PCBS)': '🏭', 'PFAS': '🏭', 'ALGAL GROWTH': '🟢',
  'NOXIOUS AQUATIC PLANTS': '🌿', 'HABITAT ALTERATIONS': '🏗️',
  'FLOW ALTERATION(S)': '🚧', 'SALINITY/TOTAL DISSOLVED SOLIDS/CHLORIDES/SULFATES': '🧂',
  'TRASH': '🗑️', 'DISSOLVED OXYGEN': '💨', 'ENTEROCOCCUS': '🦠', 'FECAL COLIFORM': '🦠',
  'ESCHERICHIA COLI (E. COLI)': '🦠', 'CHLOROPHYLL-A': '🟢', 'IRON': '⚙️',
  'SULFATES': '🧂', 'CHLORIDE': '🧂', 'DIOXINS': '☢️', 'PESTICIDES': '🧴',
};

const CAUSE_DESCRIPTIONS: Record<string, string> = {
  'PATHOGENS': 'Harmful bacteria and viruses that make water unsafe for swimming and drinking.',
  'NUTRIENTS': 'Excess nitrogen and phosphorus that fuel toxic algal blooms and dead zones.',
  'NITROGEN (TOTAL)': 'Excess nitrogen from fertilizer runoff that triggers algal blooms and oxygen depletion.',
  'PHOSPHORUS (TOTAL)': 'Phosphorus pollution from agriculture and wastewater that accelerates eutrophication.',
  'SEDIMENT': 'Eroded soil particles that cloud water, smother habitat, and carry pollutants.',
  'SEDIMENTATION/SILTATION': 'Accumulated sediment that degrades habitat and reduces water clarity.',
  'MERCURY': 'Toxic heavy metal that accumulates in fish tissue and poses health risks to humans.',
  'METALS (OTHER THAN MERCURY)': 'Heavy metals like lead, copper, and zinc from industrial and urban runoff.',
  'ORGANIC ENRICHMENT/OXYGEN DEPLETION': 'Organic pollution that consumes dissolved oxygen, suffocating aquatic life.',
  'TEMPERATURE': 'Elevated water temperatures that stress cold-water species and reduce dissolved oxygen.',
  'TEMPERATURE, WATER': 'Thermal pollution from industrial discharge or loss of riparian shade.',
  'PH/ACIDITY/CAUSTIC CONDITIONS': 'Abnormal pH levels that harm aquatic organisms and corrode infrastructure.',
  'TURBIDITY': 'Cloudy water from suspended particles that blocks light and harms aquatic ecosystems.',
  'TOTAL TOXICS': 'Combined toxic substances that poison aquatic life and contaminate water supplies.',
  'CAUSE UNKNOWN': 'Waterbody is impaired but the specific pollutant has not yet been identified.',
  'CAUSE UNKNOWN - FISH KILLS': 'Unexplained fish kills indicating severe but unidentified water quality problems.',
  'CAUSE UNKNOWN - IMPAIRED BIOTA': 'Degraded biological communities from unidentified pollution sources.',
  'POLYCHLORINATED BIPHENYLS (PCBS)': 'Persistent industrial chemicals that accumulate in fish and sediment.',
  'PFAS': 'Forever chemicals from industrial processes that persist in water and living tissue.',
  'ALGAL GROWTH': 'Excessive algae that depletes oxygen, produces toxins, and degrades water quality.',
  'NOXIOUS AQUATIC PLANTS': 'Invasive or overgrown aquatic vegetation that disrupts ecosystems.',
  'HABITAT ALTERATIONS': 'Physical changes to waterways that degrade habitat for fish and wildlife.',
  'FLOW ALTERATION(S)': 'Disrupted natural water flow from dams, diversions, or land use changes.',
  'SALINITY/TOTAL DISSOLVED SOLIDS/CHLORIDES/SULFATES': 'Elevated salt and mineral levels that harm freshwater species.',
  'TRASH': 'Litter and debris that pollute waterways and harm wildlife.',
  'DISSOLVED OXYGEN': 'Insufficient oxygen levels that cannot support healthy aquatic life.',
  'ENTEROCOCCUS': 'Fecal indicator bacteria that signal contamination from sewage or animal waste.',
  'FECAL COLIFORM': 'Bacteria from human and animal waste indicating pathogen contamination.',
  'ESCHERICHIA COLI (E. COLI)': 'Fecal bacteria that indicate sewage contamination and health risks.',
  'CHLOROPHYLL-A': 'Elevated chlorophyll indicating excessive algal growth from nutrient pollution.',
  'IRON': 'Dissolved iron that stains water, clogs pipes, and harms aquatic organisms.',
  'PESTICIDES': 'Agricultural and urban chemicals that contaminate water and harm aquatic life.',
};

function getCauseEmoji(cause: string): string {
  if (CAUSE_EMOJI[cause]) return CAUSE_EMOJI[cause];
  const upper = cause.toUpperCase();
  for (const [k, v] of Object.entries(CAUSE_EMOJI)) {
    if (upper.includes(k) || k.includes(upper)) return v;
  }
  return '💧';
}

function getCauseDescription(cause: string): string {
  if (CAUSE_DESCRIPTIONS[cause]) return CAUSE_DESCRIPTIONS[cause];
  const upper = cause.toUpperCase();
  for (const [k, v] of Object.entries(CAUSE_DESCRIPTIONS)) {
    if (upper.includes(k) || k.includes(upper)) return v;
  }
  return 'A pollution source that degrades water quality and aquatic ecosystems.';
}

/* ═══ GRADING ═══ */

function scoreToGrade(score: number): { letter: string; color: string; bg: string; textColor: string } {
  if (score >= 97) return { letter: 'A+', color: 'text-green-600', bg: 'bg-green-500', textColor: 'text-green-700' };
  if (score >= 93) return { letter: 'A',  color: 'text-green-600', bg: 'bg-green-500', textColor: 'text-green-700' };
  if (score >= 90) return { letter: 'A-', color: 'text-green-500', bg: 'bg-green-500', textColor: 'text-green-600' };
  if (score >= 87) return { letter: 'B+', color: 'text-emerald-600', bg: 'bg-emerald-500', textColor: 'text-emerald-700' };
  if (score >= 83) return { letter: 'B',  color: 'text-emerald-500', bg: 'bg-emerald-500', textColor: 'text-emerald-600' };
  if (score >= 80) return { letter: 'B-', color: 'text-teal-500', bg: 'bg-teal-500', textColor: 'text-teal-600' };
  if (score >= 77) return { letter: 'C+', color: 'text-yellow-600', bg: 'bg-yellow-500', textColor: 'text-yellow-700' };
  if (score >= 73) return { letter: 'C',  color: 'text-yellow-600', bg: 'bg-yellow-500', textColor: 'text-yellow-700' };
  if (score >= 70) return { letter: 'C-', color: 'text-yellow-500', bg: 'bg-yellow-500', textColor: 'text-yellow-600' };
  if (score >= 67) return { letter: 'D+', color: 'text-orange-600', bg: 'bg-orange-500', textColor: 'text-orange-700' };
  if (score >= 63) return { letter: 'D',  color: 'text-orange-500', bg: 'bg-orange-500', textColor: 'text-orange-600' };
  if (score >= 60) return { letter: 'D-', color: 'text-orange-500', bg: 'bg-orange-500', textColor: 'text-orange-600' };
  return { letter: 'F', color: 'text-red-600', bg: 'bg-red-500', textColor: 'text-red-700' };
}

function gradeColorFill(score: number): string {
  if (score >= 90) return '#22c55e';
  if (score >= 80) return '#86efac';
  if (score >= 70) return '#fde68a';
  if (score >= 60) return '#f59e0b';
  return '#ef4444';
}

function computeStateGrade(s: { high: number; medium: number; low: number; none: number; total: number }) {
  if (s.total === 0) return { score: -1, ...scoreToGrade(0) };
  const highPct = (s.high / s.total) * 100;
  const medPct = (s.medium / s.total) * 100;
  const lowPct = (s.low / s.total) * 100;
  const score = Math.max(0, Math.min(100, 100 - (highPct * 1.5) - (medPct * 0.8) - (lowPct * 0.3)));
  return { score, ...scoreToGrade(score) };
}

/* ═══ TYPES ═══ */

interface CachedWaterbody {
  id: string;
  name: string;
  category: string;
  alertLevel: 'high' | 'medium' | 'low' | 'none';
  tmdlStatus: string;
  causes: string[];
  causeCount: number;
}

interface StateSummary {
  state: string;
  total: number;
  fetched: number;
  stored: number;
  high: number;
  medium: number;
  low: number;
  none: number;
  tmdlNeeded: number;
  tmdlCompleted: number;
  tmdlAlternative: number;
  topCauses: string[];
  waterbodies: CachedWaterbody[];
}

interface CacheResponse {
  cacheStatus: {
    status: string;
    loadedStates: number;
    totalStates: number;
    lastBuilt: string | null;
    statesLoaded: string[];
  };
  states: Record<string, StateSummary>;
}

/* ═══ ANIMATED COUNTER ═══ */

function Counter({ target, suffix = '', duration = 2000 }: {
  target: number; suffix?: string; duration?: number;
}) {
  const [count, setCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || target === 0) return;
    let frame: number;
    const start = performance.now();
    function step(now: number) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * target));
      if (p < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [visible, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WaterQualityExplorer() {
  const [selectedState, setSelectedState] = useState<string>('');
  const [nationalCache, setNationalCache] = useState<CacheResponse | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const aiCacheRef = useRef<Record<string, string>>({});
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<CachedWaterbody | null>(null);

  const geoData = useMemo(() => {
    try { return getStatesGeoJSON() as any; }
    catch { return null; }
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('/api/water-data?action=attains-national-cache')
      .then(r => r.json())
      .then(data => { setNationalCache(data); setCacheLoading(false); })
      .catch(() => setCacheLoading(false));
  }, []);

  const stateData = useMemo(() => {
    if (!selectedState || !nationalCache?.states?.[selectedState]) return null;
    return nationalCache.states[selectedState];
  }, [selectedState, nationalCache]);

  const stateGrade = useMemo(() => {
    if (!stateData) return null;
    return computeStateGrade(stateData);
  }, [stateData]);

  const nationalStats = useMemo(() => {
    if (!nationalCache?.states) return null;
    let totalWb = 0, totalCat5 = 0, fGradeCount = 0;
    Object.values(nationalCache.states).forEach(s => {
      totalWb += s.total;
      totalCat5 += s.high;
      const g = computeStateGrade(s);
      if (g.letter === 'F') fGradeCount++;
    });
    return { totalWb, totalCat5, fGradeCount, stateCount: Object.keys(nationalCache.states).length };
  }, [nationalCache]);

  const stateGrades = useMemo(() => {
    if (!nationalCache?.states) return {} as Record<string, { score: number; letter: string }>;
    const map: Record<string, { score: number; letter: string }> = {};
    Object.entries(nationalCache.states).forEach(([abbr, s]) => {
      const g = computeStateGrade(s);
      map[abbr] = { score: g.score, letter: g.letter };
    });
    return map;
  }, [nationalCache]);

  const fetchAiInsights = useCallback(async (abbr: string, data: StateSummary) => {
    if (aiCacheRef.current[abbr]) {
      setAiText(aiCacheRef.current[abbr]);
      return;
    }
    setAiLoading(true);
    setAiText('');
    try {
      const grade = computeStateGrade(data);
      const pctImpaired = data.total > 0 ? ((data.high / data.total) * 100).toFixed(1) : '0';
      const res = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemPrompt: `You are a water quality analyst writing for the general public. Write 3-4 prose paragraphs (no markdown, no bullets, no headers) summarizing the water quality situation in a U.S. state. Be informative, accessible, and slightly conversational. Mention specific pollutants, what they mean for people and wildlife, and what could improve the situation.`,
          userMessage: JSON.stringify({
            state: STATE_NAMES[abbr] || abbr,
            totalWaterbodies: data.total,
            category5Impaired: data.high,
            category4WithPlan: data.medium,
            category3InsufficientData: data.low,
            healthyCategory1or2: data.none,
            topCauses: data.topCauses,
            grade: grade.letter,
            percentImpaired: pctImpaired,
            tmdlNeeded: data.tmdlNeeded,
          }),
        }),
      });
      const json = await res.json();
      const text = json.text || (json.insights ? JSON.stringify(json.insights) : 'Analysis unavailable.');
      aiCacheRef.current[abbr] = text;
      setAiText(text);
    } catch {
      setAiText('Unable to load AI analysis at this time.');
    } finally {
      setAiLoading(false);
    }
  }, []);

  const handleStateSelect = useCallback((abbr: string) => {
    setSelectedState(abbr);
    setSelectedMarker(null);
    if (abbr && nationalCache?.states?.[abbr]) {
      fetchAiInsights(abbr, nationalCache.states[abbr]);
    } else {
      setAiText('');
    }
  }, [nationalCache, fetchAiInsights]);

  const causeFrequency = useMemo(() => {
    if (!stateData?.waterbodies) return [];
    const freq: Record<string, number> = {};
    stateData.waterbodies.forEach(wb => {
      wb.causes.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  }, [stateData]);

  const spotlight = useMemo(() => {
    if (!stateData?.waterbodies?.length) return null;
    const wbs = stateData.waterbodies;
    const worst = wbs.filter(w => w.alertLevel === 'high').sort((a, b) => b.causeCount - a.causeCount)[0] || null;
    const attaining = wbs.find(w => w.alertLevel === 'none') || null;
    const atRisk = wbs.filter(w => w.alertLevel === 'medium').sort((a, b) => b.causeCount - a.causeCount)[0] || null;
    return { worst, attaining, atRisk };
  }, [stateData]);

  const pctImpaired = stateData && stateData.total > 0
    ? ((stateData.high / stateData.total) * 100).toFixed(1)
    : '0';
  const pctAttaining = stateData && stateData.total > 0
    ? ((stateData.none / stateData.total) * 100).toFixed(1)
    : '0';

  /* ═══ RENDER ═══ */

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
        {/* Placeholder hero image — replace with real photo */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-800 via-slate-700 to-slate-900">
          <Image
            src="/marsh-waterfront.jpeg"
            alt="Water quality exploration"
            fill
            className="object-cover opacity-60"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />
        </div>

        <div className={`relative z-10 max-w-7xl mx-auto px-6 lg:px-8 pb-16 pt-32 w-full transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-600 mb-3">
              Free Public Data
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.08] tracking-tight">
              How healthy is<br />your water?
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-xl">
              Explore water quality across every state &mdash; powered by EPA assessment data
              and AI analysis. No account required.
            </p>

            {/* State selector */}
            <div className="mt-8 max-w-md">
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={e => handleStateSelect(e.target.value)}
                  className="w-full appearance-none rounded-xl bg-white border-2 border-slate-200 text-slate-800 text-lg px-6 py-4 pr-12 focus:outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 transition-all cursor-pointer shadow-lg"
                >
                  <option value="">Select a state to explore...</option>
                  {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                    <option key={abbr} value={abbr}>{name}</option>
                  ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronDown className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </div>

            {cacheLoading && (
              <p className="mt-4 text-sm text-slate-400 animate-pulse">Loading national water quality data...</p>
            )}
          </div>
        </div>
      </section>

      {/* ═══ NATIONAL STATS BAR ═══ */}
      {nationalStats && !selectedState && (
        <section className="py-12 bg-slate-50 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                  <Counter target={nationalStats.totalWb} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Assessed Waterbodies</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-3xl sm:text-4xl font-bold text-red-600">
                  <Counter target={nationalStats.totalCat5} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Severely Impaired (Category 5)</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-3xl sm:text-4xl font-bold text-orange-600">
                  <Counter target={nationalStats.fGradeCount} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">States with &ldquo;F&rdquo; Grade</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ STATE REPORT CARD ═══ */}
      {selectedState && stateData && stateGrade && (
        <section className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                {STATE_NAMES[selectedState]}
              </h2>
              <p className="mt-2 text-slate-500 text-lg">Water Quality Report Card</p>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-10">
              {/* Grade circle */}
              <div className="flex-shrink-0">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-xl ${stateGrade.bg}`}>
                  {stateGrade.letter}
                </div>
                <p className="text-center mt-3 text-sm text-slate-400">Overall Grade</p>
              </div>

              {/* KPI grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 flex-1 w-full">
                {[
                  { label: 'Total Waterbodies', value: stateData.total, suffix: '' },
                  { label: '% Impaired (Cat 5)', value: parseFloat(pctImpaired), suffix: '%' },
                  { label: '% Attaining', value: parseFloat(pctAttaining), suffix: '%' },
                  { label: 'TMDLs Needed', value: stateData.tmdlNeeded, suffix: '' },
                ].map(kpi => (
                  <div key={kpi.label} className="text-center p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                      <Counter target={kpi.value} suffix={kpi.suffix} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{kpi.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ AI STATE ANALYSIS ═══ */}
      {selectedState && stateData && (
        <section className="py-14 bg-white border-b border-slate-100">
          <div className="max-w-4xl mx-auto px-6">
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-semibold tracking-wide">
                  AI Analysis
                </span>
                <span className="text-xs text-slate-400">Powered by Claude</span>
              </div>

              {aiLoading ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-4 bg-slate-200 rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
                  ))}
                </div>
              ) : aiText ? (
                <div className="space-y-4">
                  {aiText.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} className="text-slate-600 leading-relaxed">{para}</p>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 italic">Select a state to see AI-powered analysis.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══ MAP ═══ */}
      <section id="map-section" className="py-16 bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              {selectedState ? `${STATE_NAMES[selectedState]} Water Quality Map` : 'National Water Quality Map'}
            </h2>
            <p className="mt-2 text-slate-500">
              {selectedState ? 'Waterbodies colored by impairment level. Click a marker for details.' : 'States colored by overall health grade. Click a state to explore.'}
            </p>
            {selectedState && (
              <button onClick={() => handleStateSelect('')} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-sm hover:bg-slate-200 transition-all">
                <ArrowRight className="h-3 w-3 rotate-180" /> Back to national view
              </button>
            )}
          </div>

          <div className="relative rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden shadow-sm">
            <div className="h-[300px] sm:h-[400px] lg:h-[500px]">
              {!selectedState ? (
                <LeafletMapShell center={[39.8, -98.5]} zoom={4} maxZoom={8} height="100%" showZoomControls={false}>
                  <GeoJSON
                    data={geoData}
                    style={(feature: any) => {
                      const abbr = geoToAbbr(feature as any);
                      const sg = abbr ? stateGrades[abbr] : undefined;
                      const fillColor = sg && sg.score >= 0 ? gradeColorFill(sg.score) : '#e2e8f0';
                      return { fillColor, fillOpacity: 0.85, color: '#94a3b8', weight: 0.5 };
                    }}
                    onEachFeature={(feature: any, layer: any) => {
                      const abbr = geoToAbbr(feature as any);
                      if (!abbr) return;
                      layer.on('click', () => handleStateSelect(abbr));
                      layer.on('mouseover', () => layer.setStyle({ color: '#0891b2', weight: 2 }));
                      layer.on('mouseout', () => layer.setStyle({ color: '#94a3b8', weight: 0.5 }));
                    }}
                  />
                </LeafletMapShell>
              ) : STATE_GEO_LEAFLET[selectedState] ? (
                <LeafletMapShell
                  center={STATE_GEO_LEAFLET[selectedState].center}
                  zoom={STATE_GEO_LEAFLET[selectedState].zoom}
                  maxZoom={12}
                  height="100%"
                  mapKey={selectedState}
                >
                  <GeoJSON
                    key={selectedState}
                    data={geoData}
                    style={(feature: any) => {
                      const abbr = geoToAbbr(feature as any);
                      const isSelected = abbr === selectedState;
                      return {
                        fillColor: isSelected ? '#cffafe' : '#f1f5f9',
                        fillOpacity: 1,
                        color: isSelected ? '#0891b2' : '#cbd5e1',
                        weight: isSelected ? 2 : 0.3,
                      };
                    }}
                  />
                  {stateData?.waterbodies?.slice(0, 200).map((wb, i) => {
                    const geo = STATE_GEO_LEAFLET[selectedState];
                    const latSpread = 3;
                    const lonSpread = 4;
                    const hash = (wb.id.charCodeAt(0) * 31 + wb.id.charCodeAt(Math.min(1, wb.id.length - 1)) * 17 + i) % 1000;
                    const lat = geo.center[0] + (hash / 1000 - 0.5) * latSpread;
                    const lon = geo.center[1] + ((hash * 7 % 1000) / 1000 - 0.5) * lonSpread;
                    const markerColor = wb.alertLevel === 'high' ? '#ef4444' : wb.alertLevel === 'medium' ? '#f59e0b' : wb.alertLevel === 'low' ? '#3b82f6' : '#22c55e';
                    const isActive = selectedMarker?.id === wb.id;
                    return (
                      <CircleMarker
                        key={wb.id}
                        center={[lat, lon]}
                        radius={isActive ? 6 : 3.5}
                        pathOptions={{
                          fillColor: markerColor,
                          color: isActive ? '#0f172a' : 'rgba(100,116,139,0.5)',
                          weight: isActive ? 2 : 0.8,
                          fillOpacity: 0.9,
                        }}
                        eventHandlers={{ click: () => setSelectedMarker(isActive ? null : wb) }}
                      />
                    );
                  })}
                </LeafletMapShell>
              ) : null}
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-4 py-2 rounded-lg bg-white/90 backdrop-blur border border-slate-200 text-[11px] text-slate-600 shadow-sm">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Healthy</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Moderate</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Impaired</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Severe</span>
            </div>

            {/* Marker popup */}
            {selectedMarker && (
              <div className="absolute top-3 left-3 z-20 max-w-xs w-full p-4 rounded-xl bg-white border border-slate-200 shadow-xl">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-900 leading-tight pr-2">{selectedMarker.name || selectedMarker.id}</h4>
                  <button onClick={() => setSelectedMarker(null)} className="text-slate-400 hover:text-slate-700 flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    selectedMarker.alertLevel === 'high' ? 'bg-red-100 text-red-700' :
                    selectedMarker.alertLevel === 'medium' ? 'bg-orange-100 text-orange-700' :
                    selectedMarker.alertLevel === 'low' ? 'bg-blue-100 text-blue-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    Category {selectedMarker.category}
                  </span>
                  <span className="text-[10px] text-slate-400">{selectedMarker.causeCount} pollutant{selectedMarker.causeCount !== 1 ? 's' : ''}</span>
                </div>
                {selectedMarker.causes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMarker.causes.slice(0, 5).map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{getCauseEmoji(c)} {c.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                    ))}
                    {selectedMarker.causes.length > 5 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">+{selectedMarker.causes.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══ TOP THREATS ═══ */}
      {selectedState && stateData && causeFrequency.length > 0 && (
        <section className="py-20 bg-slate-50 border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Top Water Quality Threats
              </h2>
              <p className="mt-2 text-slate-500">The most common pollutants affecting {STATE_NAMES[selectedState]}&rsquo;s waterbodies</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {causeFrequency.slice(0, 5).map(([cause, count]) => (
                <div key={cause} className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-2xl mb-2">{getCauseEmoji(cause)}</div>
                  <h3 className="text-sm font-semibold text-slate-800 mb-1 leading-tight">
                    {cause.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim()}
                  </h3>
                  <p className="text-2xl font-bold text-slate-900 mb-2"><Counter target={count} /></p>
                  <p className="text-xs text-slate-500 leading-relaxed">{getCauseDescription(cause)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ WATERBODY SPOTLIGHT ═══ */}
      {selectedState && spotlight && (spotlight.worst || spotlight.attaining || spotlight.atRisk) && (
        <section className="py-20 bg-white border-b border-slate-100">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                Waterbody Spotlight
              </h2>
              <p className="mt-2 text-slate-500">A closer look at notable waterbodies in {STATE_NAMES[selectedState]}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {spotlight.worst && (
                <div className="p-6 rounded-xl bg-white border-l-4 border-red-500 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">Most Impaired</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-tight">{spotlight.worst.name || spotlight.worst.id}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 uppercase mb-3">Category {spotlight.worst.category}</span>
                  <p className="text-xs text-slate-500 mb-2">{spotlight.worst.causeCount} identified pollutant{spotlight.worst.causeCount !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-1">
                    {spotlight.worst.causes.slice(0, 4).map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{getCauseEmoji(c)} {c.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {spotlight.attaining && (
                <div className="p-6 rounded-xl bg-white border-l-4 border-green-500 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-green-500" />
                    <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Healthy Example</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-tight">{spotlight.attaining.name || spotlight.attaining.id}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase mb-3">Category {spotlight.attaining.category}</span>
                  <p className="text-xs text-slate-500">Meeting water quality standards &mdash; an example of what&rsquo;s possible with proper stewardship.</p>
                </div>
              )}

              {spotlight.atRisk && (
                <div className="p-6 rounded-xl bg-white border-l-4 border-orange-500 border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Most At-Risk</span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2 leading-tight">{spotlight.atRisk.name || spotlight.atRisk.id}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 uppercase mb-3">Category {spotlight.atRisk.category}</span>
                  <p className="text-xs text-slate-500 mb-2">{spotlight.atRisk.causeCount} identified pollutant{spotlight.atRisk.causeCount !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-1">
                    {spotlight.atRisk.causes.slice(0, 4).map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{getCauseEmoji(c)} {c.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══ DID YOU KNOW ═══ */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
              Did You Know?
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
            {[
              { title: 'Half of US rivers and streams are impaired', desc: 'Over 50% of assessed rivers and streams don\'t meet water quality standards for at least one designated use.' },
              { title: 'Nutrient pollution costs billions', desc: 'Nutrient pollution in U.S. waterways costs an estimated $4.6 billion annually in drinking water treatment, lost recreation, and reduced property values.' },
              { title: 'Fish advisories span all 50 states', desc: 'Every state in the U.S. has issued fish consumption advisories due to mercury, PCBs, or other contaminants found in local waterways.' },
              { title: 'TMDLs drive real improvements', desc: 'Total Maximum Daily Load plans have helped restore thousands of waterbodies nationwide by setting science-based pollution limits.' },
            ].map(fact => (
              <div key={fact.title} className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-1">{fact.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed">{fact.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-20 bg-white border-t border-slate-200">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight">
            Want deeper insights?
          </h2>
          <p className="mt-4 text-lg text-slate-500 leading-relaxed max-w-xl mx-auto">
            Project PEARL gives municipalities, researchers, and regulators real-time water quality intelligence across every waterbody in the country.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <a
              href="mailto:doug@project-pearl.org?subject=PEARL Demo Request"
              className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-all shadow-lg"
            >
              Request a Demo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium text-slate-600 border border-slate-300 rounded-full hover:bg-slate-50 transition-all"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-10 bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
              <Link href="/treatment" className="hover:text-slate-900 transition-colors">Our Technology</Link>
              <Link href="/story" className="hover:text-slate-900 transition-colors">Our Story</Link>
            </div>
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} PEARL. All rights reserved.</p>
          </div>
          <p className="text-center mt-4 text-[11px] text-slate-400">
            Data sourced from EPA ATTAINS. Not affiliated with the U.S. Environmental Protection Agency.
          </p>
        </div>
      </footer>
    </div>
  );
}

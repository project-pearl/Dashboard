'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import MissionQuote from './MissionQuote';
import Image from 'next/image';
import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';
import { STATE_NAMES } from '@/lib/mapUtils';
import {
  STATE_AUTHORITIES, STATE_CHALLENGES, STATE_TMDL_CONTEXT,
  STATE_COMPLAINT_CONTACTS, getComplaintContact,
} from '@/lib/stateWaterData';
import { getEpaRegionForState, EPA_REGIONS } from '@/lib/epa-regions';
import {
  ArrowRight, ChevronDown, Building2, ExternalLink, Phone, Users,
  Droplets, ShieldCheck, FileText, BookOpen, Download,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

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

/* ═══ REPORT CARD ITEM TYPE ═══ */

interface ReportCardItem {
  title: string;
  description: string;
  status: 'green' | 'yellow' | 'red' | 'blue';
  badge?: string;
  emoji?: string;
}

interface ReportCardFinding {
  id: string;
  category: string;
  severity: 'critical' | 'warning' | 'info' | 'positive';
  title: string;
  detail: string;
  metric?: string;
  metricLabel?: string;
  dataSource: string;
}

interface ReportCardStat {
  label: string;
  value: string;
  subtext?: string;
}

interface ReportCardData {
  stateName: string;
  stateCode: string;
  grade: string;
  score: number;
  severity: string;
  reportingCycle: string;
  lastUpdated: string;
  findings: ReportCardFinding[];
  stats: ReportCardStat[];
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

/* ═══ STATUS DOT COMPONENT ═══ */

const STATUS_COLORS = {
  green:  { dot: 'bg-green-500',  bg: 'bg-green-50',  border: 'border-green-200', text: 'text-green-700' },
  yellow: { dot: 'bg-yellow-500', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
  red:    { dot: 'bg-red-500',    bg: 'bg-red-50',    border: 'border-red-200', text: 'text-red-700' },
  blue:   { dot: 'bg-blue-500',   bg: 'bg-blue-50',   border: 'border-blue-200', text: 'text-blue-700' },
};

/* ═══ NATIONAL MEDIAN TOTAL (approximate for monitoring coverage) ═══ */
const NATIONAL_MEDIAN_TOTAL = 800;

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WaterQualityExplorer() {
  const [selectedState, setSelectedState] = useState<string>('');
  const [nationalCache, setNationalCache] = useState<CacheResponse | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [reportCard, setReportCard] = useState<ReportCardData | null>(null);
  const [reportCardLoading, setReportCardLoading] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetch('/api/water-data?action=attains-national-cache')
      .then(r => r.json())
      .then(data => { setNationalCache(data); setCacheLoading(false); })
      .catch(() => setCacheLoading(false));
  }, []);

  // Fetch enriched report card when a state is selected
  useEffect(() => {
    if (!selectedState) { setReportCard(null); return; }
    setReportCardLoading(true);
    fetch(`/api/water-data?action=state-assessment&state=${selectedState}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { setReportCard(data); setReportCardLoading(false); })
      .catch(() => setReportCardLoading(false));
  }, [selectedState]);

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
    const attaining = wbs.find(w => w.alertLevel === 'none') || null;
    return { attaining };
  }, [stateData]);

  /* ═══ GEOJSON EXPORT ═══ */
  const exportGeoJSON = useCallback(() => {
    if (!stateData?.waterbodies || !selectedState) return;
    const features = stateData.waterbodies.map(wb => ({
      type: 'Feature' as const,
      properties: {
        id: wb.id,
        name: wb.name,
        category: wb.category,
        alertLevel: wb.alertLevel,
        tmdlStatus: wb.tmdlStatus,
        causes: wb.causes,
        causeCount: wb.causeCount,
      },
      geometry: null,
    }));
    const geojson = {
      type: 'FeatureCollection',
      metadata: {
        state: STATE_NAMES[selectedState],
        stateAbbr: selectedState,
        total: stateData.total,
        high: stateData.high,
        medium: stateData.medium,
        low: stateData.low,
        none: stateData.none,
        exportDate: new Date().toISOString(),
        source: 'EPA ATTAINS via Project PEARL',
      },
      features,
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PEARL_${selectedState}_waterbodies.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }, [stateData, selectedState]);

  /* ═══ REPORT CARD ITEMS (from enriched endpoint, fallback to ATTAINS-only) ═══ */
  const reportCardItems = useMemo((): ReportCardItem[] => {
    // Use enriched report card findings if available
    if (reportCard?.findings?.length) {
      return reportCard.findings.map(f => ({
        title: f.title,
        description: f.detail,
        status: f.severity === 'critical' ? 'red' as const
             : f.severity === 'warning' ? 'yellow' as const
             : f.severity === 'positive' ? 'green' as const
             : 'blue' as const,
        badge: f.metric,
      }));
    }

    // Fallback: ATTAINS-only report card
    if (!stateData || !stateGrade) return [];
    const items: ReportCardItem[] = [];
    const abbr = selectedState;

    const gradeStatus = stateGrade.letter.startsWith('A') || stateGrade.letter.startsWith('B')
      ? 'green' : stateGrade.letter.startsWith('C') ? 'yellow' : 'red';
    items.push({
      title: 'Overall Water Quality Grade',
      description: gradeStatus === 'green'
        ? `${STATE_NAMES[abbr]} earns a strong grade, with most waterbodies meeting quality standards.`
        : gradeStatus === 'yellow'
        ? `${STATE_NAMES[abbr]} has a moderate grade — some waterbodies are healthy, but others need attention.`
        : `${STATE_NAMES[abbr]} faces notable water quality challenges across many of its waterbodies.`,
      status: gradeStatus,
      badge: stateGrade.letter,
    });

    const attainingPct = stateData.total > 0 ? (stateData.none / stateData.total) * 100 : 0;
    const healthStatus = attainingPct > 70 ? 'green' : attainingPct >= 40 ? 'yellow' : 'red';
    items.push({
      title: 'Waterbody Health',
      description: healthStatus === 'green'
        ? `Over ${Math.round(attainingPct)}% of assessed waterbodies are meeting water quality standards — a positive sign.`
        : healthStatus === 'yellow'
        ? `About ${Math.round(attainingPct)}% of waterbodies are meeting standards, with room for improvement.`
        : `Less than ${Math.round(attainingPct)}% of waterbodies are fully meeting standards — indicating widespread challenges.`,
      status: healthStatus,
    });

    const totalTmdl = (stateData.tmdlCompleted || 0) + (stateData.tmdlAlternative || 0) + (stateData.tmdlNeeded || 0);
    if (totalTmdl > 0) {
      const tmdlDonePct = ((stateData.tmdlCompleted + stateData.tmdlAlternative) / totalTmdl) * 100;
      const tmdlStatus = tmdlDonePct > 60 ? 'green' : tmdlDonePct >= 30 ? 'yellow' : 'red';
      items.push({
        title: 'Pollution Cleanup Progress',
        description: tmdlStatus === 'green'
          ? 'Good progress on cleanup plans — the majority of needed pollution limits have been established or addressed.'
          : tmdlStatus === 'yellow'
          ? 'Cleanup plans are underway but many waterbodies still need pollution reduction strategies.'
          : 'Most impaired waterbodies still need formal pollution cleanup plans (TMDLs).',
        status: tmdlStatus,
      });
    }

    if (causeFrequency.length > 0) {
      const [topCause, topCount] = causeFrequency[0];
      const topPct = stateData.total > 0 ? (topCount / stateData.total) * 100 : 0;
      const causeName = topCause.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim();
      items.push({
        title: 'Top Pollution Concern',
        description: getCauseDescription(topCause),
        status: topPct > 30 ? 'red' : 'yellow',
        emoji: getCauseEmoji(topCause),
        badge: causeName,
      });
    }

    if (causeFrequency.length > 1) {
      const [cause2, count2] = causeFrequency[1];
      const pct2 = stateData.total > 0 ? (count2 / stateData.total) * 100 : 0;
      const causeName2 = cause2.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim();
      items.push({
        title: 'Second Concern',
        description: getCauseDescription(cause2),
        status: pct2 > 30 ? 'red' : 'yellow',
        emoji: getCauseEmoji(cause2),
        badge: causeName2,
      });
    }

    const highPct = stateData.total > 0 ? (stateData.high / stateData.total) * 100 : 0;
    const attentionStatus = highPct < 10 ? 'green' : highPct <= 25 ? 'yellow' : 'red';
    items.push({
      title: 'Waters Needing Attention',
      description: attentionStatus === 'green'
        ? 'Very few waterbodies have severe impairments — indicating effective environmental management.'
        : attentionStatus === 'yellow'
        ? 'A moderate number of waterbodies have severe impairments that need cleanup plans.'
        : 'A significant portion of waterbodies have severe impairments requiring urgent attention.',
      status: attentionStatus,
    });

    const coverageStatus = stateData.total > NATIONAL_MEDIAN_TOTAL * 1.2 ? 'green'
      : stateData.total >= NATIONAL_MEDIAN_TOTAL * 0.5 ? 'yellow' : 'red';
    items.push({
      title: 'Monitoring Coverage',
      description: coverageStatus === 'green'
        ? `With ${stateData.total.toLocaleString()} assessed waterbodies, this state has above-average monitoring coverage.`
        : coverageStatus === 'yellow'
        ? `${stateData.total.toLocaleString()} waterbodies are assessed — typical monitoring coverage for a state this size.`
        : `Only ${stateData.total.toLocaleString()} waterbodies are assessed — more monitoring would provide a clearer picture.`,
      status: coverageStatus,
    });

    const challenges = STATE_CHALLENGES[abbr];
    if (challenges?.length > 0) {
      const challenge = challenges[0];
      const dashParts = challenge.split(' — ');
      const desc = dashParts.length >= 2 ? dashParts.slice(1).join(' — ').trim() : challenge;
      items.push({ title: 'Key Current Challenge', description: desc || challenge.substring(0, 60), status: 'yellow' });
    }

    if (spotlight?.attaining) {
      items.push({
        title: 'Bright Spot',
        description: `${spotlight.attaining.name || spotlight.attaining.id} is meeting water quality standards — an example of what effective stewardship looks like.`,
        status: 'green',
      });
    }

    const tmdlCtx = STATE_TMDL_CONTEXT[abbr];
    if (tmdlCtx) {
      items.push({
        title: 'Regulatory Framework',
        description: `${tmdlCtx.framework}${tmdlCtx.deadline ? ` — ${tmdlCtx.deadline}` : ''}. Key focus areas include ${tmdlCtx.keyTMDLs.slice(0, 2).join(' and ')}.`,
        status: 'blue',
      });
    }

    return items;
  }, [reportCard, stateData, stateGrade, selectedState, causeFrequency, spotlight]);

  /* ═══ RENDER ═══ */

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[70vh] flex items-end overflow-hidden">
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
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700 mb-3">
              Free Public Data
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.08] tracking-tight">
              {selectedState && STATE_NAMES[selectedState]
                ? <>{STATE_NAMES[selectedState]}&rsquo;s<br />water story</>
                : <>Discover your<br />state&rsquo;s water story</>
              }
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed max-w-xl">
              {selectedState
                ? `See how ${STATE_NAMES[selectedState]} measures up — powered by EPA assessment data. No account required.`
                : 'Explore water quality across every state — powered by EPA assessment data. No account required.'
              }
            </p>

            {/* State selector */}
            <div className="mt-8 max-w-md">
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={e => setSelectedState(e.target.value)}
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

      {/* ═══ EJ QUOTE CALLOUT ═══ */}
      <MissionQuote role="public" variant="dark" />

      {/* ═══ NATIONAL STATS BAR (no state selected) ═══ */}
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
                <div className="text-3xl sm:text-4xl font-bold text-slate-900">
                  <Counter target={nationalStats.stateCount} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">States &amp; Territories Tracked</p>
              </div>
              <div className="text-center p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="text-3xl sm:text-4xl font-bold text-cyan-600">
                  <Counter target={nationalStats.totalWb - nationalStats.totalCat5} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Waterbodies Meeting Standards</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ STATE REPORT CARD ═══ */}
      {selectedState && stateData && stateGrade && reportCardItems.length > 0 && (
        <section className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-3 mb-4">
                {reportCard?.grade ? (
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-lg ${scoreToGrade(reportCard.score).bg}`}>
                    {reportCard.grade}
                  </div>
                ) : (
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-black text-white shadow-lg ${stateGrade.bg}`}>
                    {stateGrade.letter}
                  </div>
                )}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">
                {STATE_NAMES[selectedState]} Water Quality Report Card
              </h2>
              <p className="mt-2 text-slate-500">
                {reportCardItems.length} key findings based on {reportCard ? 'multi-source EPA data' : 'EPA assessment data'}
              </p>
              {reportCard?.stats && reportCard.stats.length > 0 && (
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                  {reportCard.stats.slice(0, 8).map((stat, i) => (
                    <div key={i} className="bg-white rounded-lg border border-slate-200 px-3 py-2.5 text-center">
                      <p className="text-lg font-bold text-slate-900">{stat.value}</p>
                      <p className="text-[11px] text-slate-500 font-medium">{stat.label}</p>
                      {stat.subtext && <p className="text-[10px] text-slate-400">{stat.subtext}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setSelectedState('')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-100 transition-all"
                >
                  <ArrowRight className="h-3 w-3 rotate-180" /> Back to national view
                </button>
                <button
                  onClick={exportGeoJSON}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-slate-600 text-sm hover:bg-slate-100 transition-all"
                >
                  <Download className="h-3 w-3" /> Export GeoJSON
                </button>
              </div>
            </div>


            <div className="space-y-3">
              {reportCardItems.map((item, i) => {
                const colors = STATUS_COLORS[item.status];
                return (
                  <div
                    key={i}
                    className={`flex items-start gap-4 p-5 rounded-xl border ${colors.border} ${colors.bg} transition-all`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {item.badge && item.badge.length <= 2 ? (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white ${
                          item.status === 'green' ? 'bg-green-500' : item.status === 'yellow' ? 'bg-yellow-500' : item.status === 'red' ? 'bg-red-500' : 'bg-blue-500'
                        }`}>
                          {item.badge}
                        </div>
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colors.dot}`}>
                          {item.emoji ? (
                            <span className="text-lg">{item.emoji}</span>
                          ) : (
                            <span className="w-3 h-3 rounded-full bg-white" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        {item.badge && item.badge.length > 2 && (
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-600 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ═══ STATE AUTHORITY ═══ */}
      {selectedState && (() => {
        const authority = STATE_AUTHORITIES[selectedState];
        const regionNum = getEpaRegionForState(selectedState);
        const region = regionNum ? EPA_REGIONS[regionNum] : null;
        if (!authority) return null;
        return (
          <section className="py-14 bg-white border-b border-slate-100">
            <div className="max-w-4xl mx-auto px-6">
              <h2 className="text-2xl font-bold text-slate-900 mb-6 text-center">
                Your State Environmental Authority
              </h2>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-6 w-6 text-cyan-600 flex-shrink-0" />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900 leading-tight">{authority.name}</h3>
                      <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full bg-cyan-100 text-cyan-700 text-xs font-bold tracking-wide">
                        {authority.abbr}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  {authority.primaryContact && (
                    <div className="flex items-start gap-2">
                      <Users className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-slate-500 text-xs">Primary Contact Division</p>
                        <p className="text-slate-800 font-medium">{authority.primaryContact}</p>
                      </div>
                    </div>
                  )}
                  {authority.website && (
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-slate-500 text-xs">Website</p>
                        <a
                          href={`https://${authority.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 font-medium hover:underline"
                        >
                          {authority.website}
                        </a>
                      </div>
                    </div>
                  )}
                  {region && (
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-slate-500 text-xs">EPA Oversight</p>
                        <p className="text-slate-800 font-medium">EPA {region.name} &mdash; {region.hq}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ═══ TAKE ACTION ═══ */}
      {selectedState && (
        <section className="py-14 bg-slate-50 border-b border-slate-200">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
              Take Action
            </h2>
            <p className="text-slate-500 text-center mb-8">
              Ways you can make a difference for {STATE_NAMES[selectedState]}&rsquo;s water quality
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Report Pollution */}
              {(() => {
                const contact = getComplaintContact(selectedState);
                return (
                  <a
                    href={contact.complaintUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all"
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <Droplets className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors">
                        Report a Pollution Issue
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">{contact.reportLabel}</p>
                      {contact.hotline && (
                        <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {contact.hotline}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-cyan-500 flex-shrink-0 mt-0.5" />
                  </a>
                );
              })()}

              {/* Contact Representatives */}
              <a
                href="https://www.usa.gov/elected-officials"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors">
                    Contact Your Representatives
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Let elected officials know clean water matters to you</p>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-cyan-500 flex-shrink-0 mt-0.5" />
              </a>

              {/* Conservation Groups */}
              <a
                href={`https://www.google.com/search?q=${encodeURIComponent(STATE_NAMES[selectedState] + ' watershed conservation groups')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all"
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <BookOpen className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors">
                    Join a Conservation Group
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">Find watershed and environmental groups in {STATE_NAMES[selectedState]}</p>
                </div>
                <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-cyan-500 flex-shrink-0 mt-0.5" />
              </a>

              {/* Agency Resources (conditional) */}
              {STATE_AUTHORITIES[selectedState]?.website && (
                <a
                  href={`https://${STATE_AUTHORITIES[selectedState].website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 p-5 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 group-hover:text-cyan-700 transition-colors">
                      Explore Agency Resources
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">Visit {STATE_AUTHORITIES[selectedState].abbr}&rsquo;s official website</p>
                  </div>
                  <ExternalLink className="h-4 w-4 text-slate-300 group-hover:text-cyan-500 flex-shrink-0 mt-0.5" />
                </a>
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
            <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.</p>
          </div>
          <p className="text-center mt-3 text-[10px] text-slate-400/70">
            Project Pearl&trade;, Pearl&trade;, ALIA&trade;, and AQUA-LO&trade; are trademarks of Local Seafood Projects.
          </p>
          <p className="text-center mt-2 text-[11px] text-slate-400">
            Data sourced from EPA ATTAINS. Not affiliated with the U.S. Environmental Protection Agency.
          </p>
        </div>
      </footer>
    </div>
  );
}

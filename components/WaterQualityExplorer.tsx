'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { feature } from 'topojson-client';
import statesTopo from 'us-atlas/states-10m.json';
import Image from 'next/image';
import { ArrowRight, ExternalLink, Droplets, AlertTriangle, ShieldCheck, TrendingDown, X } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */

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

const FIPS_TO_ABBR: Record<string, string> = {
  '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC',
  '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
  '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT',
  '31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH',
  '40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT',
  '50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY',
};

const NAME_TO_ABBR: Record<string, string> = Object.entries(STATE_NAMES).reduce(
  (acc, [abbr, name]) => { acc[name] = abbr; return acc; },
  {} as Record<string, string>,
);

const STATE_GEO: Record<string, { center: [number, number]; scale: number }> = {
  AL:{center:[-86.8,32.8],scale:4500},AK:{center:[-153,64],scale:900},
  AZ:{center:[-111.7,34.2],scale:4000},AR:{center:[-92.4,34.8],scale:5000},
  CA:{center:[-119.5,37.5],scale:2800},CO:{center:[-105.5,39.0],scale:4000},
  CT:{center:[-72.7,41.6],scale:12000},DE:{center:[-75.5,39.0],scale:14000},
  DC:{center:[-77.02,38.9],scale:90000},FL:{center:[-82.5,28.5],scale:3200},
  GA:{center:[-83.5,32.7],scale:4000},HI:{center:[-157,20.5],scale:5000},
  ID:{center:[-114.5,44.5],scale:3200},IL:{center:[-89.2,40.0],scale:3800},
  IN:{center:[-86.3,39.8],scale:5000},IA:{center:[-93.5,42.0],scale:4500},
  KS:{center:[-98.5,38.5],scale:4200},KY:{center:[-85.3,37.8],scale:4800},
  LA:{center:[-92.0,31.0],scale:4500},ME:{center:[-69.0,45.5],scale:4500},
  MD:{center:[-77.0,39.0],scale:7500},MA:{center:[-71.8,42.3],scale:9000},
  MI:{center:[-85.5,44.0],scale:3200},MN:{center:[-94.5,46.3],scale:3200},
  MS:{center:[-89.7,32.7],scale:4500},MO:{center:[-92.5,38.5],scale:4000},
  MT:{center:[-109.6,47.0],scale:3200},NE:{center:[-99.8,41.5],scale:3800},
  NV:{center:[-117.0,39.5],scale:3200},NH:{center:[-71.6,43.8],scale:7500},
  NJ:{center:[-74.7,40.1],scale:9000},NM:{center:[-106.0,34.5],scale:3800},
  NY:{center:[-75.5,42.5],scale:4000},NC:{center:[-79.5,35.5],scale:4500},
  ND:{center:[-100.5,47.5],scale:4500},OH:{center:[-82.8,40.2],scale:5000},
  OK:{center:[-97.5,35.5],scale:4200},OR:{center:[-120.5,44.0],scale:3500},
  PA:{center:[-77.6,41.0],scale:5000},RI:{center:[-71.5,41.7],scale:22000},
  SC:{center:[-80.9,33.8],scale:5500},SD:{center:[-100.2,44.5],scale:4200},
  TN:{center:[-86.3,35.8],scale:4800},TX:{center:[-99.5,31.5],scale:2500},
  UT:{center:[-111.7,39.5],scale:3800},VT:{center:[-72.6,44.0],scale:7500},
  VA:{center:[-79.5,37.8],scale:4500},WA:{center:[-120.5,47.5],scale:4000},
  WV:{center:[-80.6,38.6],scale:6000},WI:{center:[-89.8,44.5],scale:3800},
  WY:{center:[-107.5,43.0],scale:4000},
};

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

function scoreToGrade(score: number): { letter: string; color: string; bg: string } {
  if (score >= 90) return { letter: 'A', color: 'text-green-400', bg: 'bg-green-500' };
  if (score >= 80) return { letter: 'B', color: 'text-blue-400', bg: 'bg-blue-500' };
  if (score >= 70) return { letter: 'C', color: 'text-yellow-400', bg: 'bg-yellow-500' };
  if (score >= 60) return { letter: 'D', color: 'text-orange-400', bg: 'bg-orange-500' };
  return { letter: 'F', color: 'text-red-400', bg: 'bg-red-500' };
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

/* ═══ GEO HELPERS ═══ */

interface GeoFeature {
  id: string;
  properties?: { name?: string };
  rsmKey?: string;
}

function geoToAbbr(g: GeoFeature): string | undefined {
  if (g.id) {
    const fips = String(g.id).padStart(2, '0');
    if (FIPS_TO_ABBR[fips]) return FIPS_TO_ABBR[fips];
  }
  if (g.properties?.name && NAME_TO_ABBR[g.properties.name]) return NAME_TO_ABBR[g.properties.name];
  return undefined;
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

/* ═══ SECTION VISIBILITY HOOK ═══ */

function useSectionVisible(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, visible };
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function WaterQualityExplorer() {
  /* ─── State ─── */
  const [selectedState, setSelectedState] = useState<string>('');
  const [nationalCache, setNationalCache] = useState<CacheResponse | null>(null);
  const [cacheLoading, setCacheLoading] = useState(true);
  const aiCacheRef = useRef<Record<string, string>>({});
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<CachedWaterbody | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>([0, 0]);

  /* ─── Topo ─── */
  const topo = useMemo(() => {
    try { return feature(statesTopo as any, (statesTopo as any).objects.states) as any; }
    catch { return null; }
  }, []);

  /* ─── Mount animation ─── */
  useEffect(() => { setMounted(true); }, []);

  /* ─── Fetch national cache ─── */
  useEffect(() => {
    fetch('/api/water-data?action=attains-national-cache')
      .then(r => r.json())
      .then(data => { setNationalCache(data); setCacheLoading(false); })
      .catch(() => setCacheLoading(false));
  }, []);

  /* ─── Derived state data ─── */
  const stateData = useMemo(() => {
    if (!selectedState || !nationalCache?.states?.[selectedState]) return null;
    return nationalCache.states[selectedState];
  }, [selectedState, nationalCache]);

  const stateGrade = useMemo(() => {
    if (!stateData) return null;
    return computeStateGrade(stateData);
  }, [stateData]);

  /* ─── National aggregates ─── */
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

  /* ─── Per-state grade map for choropleth ─── */
  const stateGrades = useMemo(() => {
    if (!nationalCache?.states) return {} as Record<string, { score: number; letter: string }>;
    const map: Record<string, { score: number; letter: string }> = {};
    Object.entries(nationalCache.states).forEach(([abbr, s]) => {
      const g = computeStateGrade(s);
      map[abbr] = { score: g.score, letter: g.letter };
    });
    return map;
  }, [nationalCache]);

  /* ─── AI insights fetch ─── */
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

  /* ─── State selection handler ─── */
  const handleStateSelect = useCallback((abbr: string) => {
    setSelectedState(abbr);
    setSelectedMarker(null);
    setMapZoom(1);
    if (abbr && STATE_GEO[abbr]) {
      setMapCenter(STATE_GEO[abbr].center);
    }
    if (abbr && nationalCache?.states?.[abbr]) {
      fetchAiInsights(abbr, nationalCache.states[abbr]);
    } else {
      setAiText('');
    }
  }, [nationalCache, fetchAiInsights]);

  /* ─── Cause frequency for selected state ─── */
  const causeFrequency = useMemo(() => {
    if (!stateData?.waterbodies) return [];
    const freq: Record<string, number> = {};
    stateData.waterbodies.forEach(wb => {
      wb.causes.forEach(c => { freq[c] = (freq[c] || 0) + 1; });
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  }, [stateData]);

  /* ─── Spotlight waterbodies ─── */
  const spotlight = useMemo(() => {
    if (!stateData?.waterbodies?.length) return null;
    const wbs = stateData.waterbodies;
    const worst = wbs.filter(w => w.alertLevel === 'high').sort((a, b) => b.causeCount - a.causeCount)[0] || null;
    const attaining = wbs.find(w => w.alertLevel === 'none') || null;
    const atRisk = wbs.filter(w => w.alertLevel === 'medium').sort((a, b) => b.causeCount - a.causeCount)[0] || null;
    return { worst, attaining, atRisk };
  }, [stateData]);

  /* ─── Section visibility refs ─── */
  const overviewVis = useSectionVisible();
  const aiVis = useSectionVisible();
  const mapVis = useSectionVisible(0.1);
  const threatsVis = useSectionVisible();
  const spotlightVis = useSectionVisible();
  const infoVis = useSectionVisible();
  const ctaVis = useSectionVisible();

  /* ═══ RENDER ═══ */
  const playfair = "'Playfair Display', Georgia, serif";
  const instrument = "'Instrument Sans', 'DM Sans', system-ui, sans-serif";

  const pctImpaired = stateData && stateData.total > 0
    ? ((stateData.high / stateData.total) * 100).toFixed(1)
    : '0';
  const pctAttaining = stateData && stateData.total > 0
    ? ((stateData.none / stateData.total) * 100).toFixed(1)
    : '0';

  return (
    <div className="min-h-screen bg-slate-950" style={{ fontFamily: instrument }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/">
              <Image src="/Logo_Pearl_as_Headline.JPG" alt="Project PEARL" width={140} height={38} className="object-contain brightness-0 invert" priority />
            </a>
            <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold tracking-wide uppercase text-slate-400">
              <a href="/" className="hover:text-white transition-colors">Home</a>
              <a href="/methodology" className="hover:text-white transition-colors">Methodology</a>
              <a href="#map-section" className="hover:text-white transition-colors">Map</a>
            </div>
            <a href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-900 rounded-full bg-white hover:bg-slate-100 transition-colors">
              Sign In <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-slate-950 via-cyan-950/40 to-slate-950">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 30% 70%, rgba(6,182,212,.15) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(59,130,246,.1) 0%, transparent 50%)',
        }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div className={`relative z-10 max-w-4xl mx-auto px-6 text-center pt-24 pb-16 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/[0.06] backdrop-blur-md border border-white/10 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span className="text-xs font-semibold text-cyan-300 tracking-wide">Powered by EPA ATTAINS data</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.08] tracking-tight" style={{ fontFamily: playfair }}>
            How Healthy Is<br />Your Water?
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto font-light">
            Explore water quality across every state &mdash; powered by federal assessment data,
            AI analysis, and interactive maps. No account required.
          </p>

          <div className="mt-10 max-w-md mx-auto">
            <div className="relative">
              <select
                value={selectedState}
                onChange={e => handleStateSelect(e.target.value)}
                className="w-full appearance-none rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-lg px-8 py-4 pr-12 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all cursor-pointer"
                style={{ fontFamily: instrument }}
              >
                <option value="" className="bg-slate-900 text-slate-400">Select a state to explore...</option>
                {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                  <option key={abbr} value={abbr} className="bg-slate-900 text-white">{name}</option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <Droplets className="h-5 w-5 text-cyan-400/60" />
              </div>
            </div>
          </div>

          {cacheLoading && (
            <p className="mt-4 text-sm text-slate-500 animate-pulse">Loading national water quality data...</p>
          )}
        </div>
      </section>

      {/* ═══ STATE OVERVIEW ═══ */}
      {selectedState && stateData && stateGrade && (
        <section ref={overviewVis.ref} className={`py-20 bg-slate-950 transition-all duration-700 ${overviewVis.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white" style={{ fontFamily: playfair }}>
                {STATE_NAMES[selectedState]}
              </h2>
              <p className="mt-3 text-slate-400 text-lg">Water Quality Report Card</p>
            </div>

            <div className="flex flex-col lg:flex-row items-center gap-12">
              {/* Grade circle */}
              <div className="flex-shrink-0">
                <div className={`w-28 h-28 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-2xl ${stateGrade.bg}`}>
                  {stateGrade.letter}
                </div>
                <p className="text-center mt-3 text-sm text-slate-500">Overall Grade</p>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 flex-1 w-full">
                {[
                  { label: 'Total Waterbodies', value: stateData.total, suffix: '' },
                  { label: '% Impaired (Cat 5)', value: parseFloat(pctImpaired), suffix: '%' },
                  { label: '% Attaining', value: parseFloat(pctAttaining), suffix: '%' },
                  { label: 'TMDLs Needed', value: stateData.tmdlNeeded, suffix: '' },
                ].map(kpi => (
                  <div key={kpi.label} className="text-center p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-3xl sm:text-4xl font-bold text-white">
                      <Counter target={kpi.value} suffix={kpi.suffix} />
                    </div>
                    <p className="mt-2 text-sm text-slate-400">{kpi.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══ AI STATE SUMMARY ═══ */}
      {selectedState && stateData && (
        <section ref={aiVis.ref} className={`py-16 bg-gradient-to-b from-slate-950 to-slate-900 transition-all duration-700 ${aiVis.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="max-w-4xl mx-auto px-6">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-6">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold tracking-wide">
                  <span>🧠</span> AI Analysis
                </span>
                <span className="text-xs text-slate-500">Powered by Claude</span>
              </div>

              {aiLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-full" />
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-full" />
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-4/6 mt-6" />
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-full" />
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-full mt-6" />
                  <div className="h-4 bg-white/[0.06] rounded animate-pulse w-3/4" />
                </div>
              ) : aiText ? (
                <div className="space-y-4">
                  {aiText.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} className="text-slate-300 leading-relaxed text-[15px]">{para}</p>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 italic">Select a state to see AI-powered analysis.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══ INTERACTIVE MAP ═══ */}
      <section id="map-section" ref={mapVis.ref} className={`py-16 bg-slate-900 transition-all duration-700 ${mapVis.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: playfair }}>
              {selectedState ? `${STATE_NAMES[selectedState]} Water Quality Map` : 'National Water Quality Map'}
            </h2>
            <p className="mt-3 text-slate-400">
              {selectedState ? 'Waterbodies colored by impairment level. Click a marker for details.' : 'States colored by overall health grade. Click a state to explore.'}
            </p>
            {selectedState && (
              <button onClick={() => handleStateSelect('')} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.06] border border-white/[0.08] text-slate-300 text-sm hover:bg-white/[0.1] transition-all">
                <ArrowRight className="h-3 w-3 rotate-180" /> Back to national view
              </button>
            )}
          </div>

          <div className="relative rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
            <div className="h-[300px] sm:h-[400px] lg:h-[500px]">
              {!selectedState ? (
                /* ─── National view ─── */
                <ComposableMap
                  projection="geoAlbersUsa"
                  projectionConfig={{ scale: 1000 }}
                  width={800}
                  height={500}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Geographies geography={topo}>
                    {({ geographies }: { geographies: GeoFeature[] }) =>
                      geographies.map((g) => {
                        const abbr = geoToAbbr(g);
                        const sg = abbr ? stateGrades[abbr] : undefined;
                        const fill = sg && sg.score >= 0 ? gradeColorFill(sg.score) : '#334155';
                        return (
                          <Geography
                            key={g.rsmKey ?? g.id}
                            geography={g as any}
                            onClick={() => abbr && handleStateSelect(abbr)}
                            style={{
                              default: { fill, outline: 'none', stroke: '#1e293b', strokeWidth: 0.5, cursor: 'pointer' },
                              hover: { fill, outline: 'none', stroke: '#06b6d4', strokeWidth: 1.5, cursor: 'pointer' },
                              pressed: { fill, outline: 'none' },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ComposableMap>
              ) : STATE_GEO[selectedState] ? (
                /* ─── State view ─── */
                <ComposableMap
                  projection="geoMercator"
                  projectionConfig={{ center: STATE_GEO[selectedState].center, scale: STATE_GEO[selectedState].scale }}
                  width={800}
                  height={500}
                  style={{ width: '100%', height: '100%' }}
                >
                  <ZoomableGroup
                    zoom={mapZoom}
                    center={mapCenter}
                    onMoveEnd={({ coordinates, zoom }: { coordinates: [number, number]; zoom: number }) => { setMapCenter(coordinates); setMapZoom(zoom); }}
                    minZoom={1}
                    maxZoom={12}
                  >
                    <Geographies geography={topo}>
                      {({ geographies }: { geographies: GeoFeature[] }) =>
                        geographies.map((g) => {
                          const abbr = geoToAbbr(g);
                          const isSelected = abbr === selectedState;
                          return (
                            <Geography
                              key={g.rsmKey ?? g.id}
                              geography={g as any}
                              style={{
                                default: {
                                  fill: isSelected ? '#164e63' : '#1e293b',
                                  stroke: isSelected ? '#06b6d4' : '#334155',
                                  strokeWidth: (isSelected ? 1.5 : 0.3) / mapZoom,
                                  outline: 'none',
                                },
                                hover: { fill: isSelected ? '#164e63' : '#1e293b', stroke: '#06b6d4', strokeWidth: 1 / mapZoom, outline: 'none' },
                                pressed: { fill: isSelected ? '#164e63' : '#1e293b', outline: 'none' },
                              }}
                            />
                          );
                        })
                      }
                    </Geographies>

                    {/* Waterbody markers — sample up to 200 for performance */}
                    {stateData?.waterbodies?.slice(0, 200).map((wb, i) => {
                      // Distribute markers across state area with deterministic pseudo-random offsets
                      const geo = STATE_GEO[selectedState];
                      const scaleOffset = 5000 / geo.scale;
                      const hash = (wb.id.charCodeAt(0) * 31 + wb.id.charCodeAt(Math.min(1, wb.id.length - 1)) * 17 + i) % 1000;
                      const lon = geo.center[0] + (hash / 1000 - 0.5) * scaleOffset * 4;
                      const lat = geo.center[1] + ((hash * 7 % 1000) / 1000 - 0.5) * scaleOffset * 3;
                      const markerColor = wb.alertLevel === 'high' ? '#ef4444' : wb.alertLevel === 'medium' ? '#f59e0b' : wb.alertLevel === 'low' ? '#3b82f6' : '#22c55e';
                      const isActive = selectedMarker?.id === wb.id;

                      return (
                        <Marker key={wb.id} coordinates={[lon, lat]}>
                          <circle
                            r={(isActive ? 6 : 3.5) / mapZoom}
                            fill={markerColor}
                            stroke={isActive ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                            strokeWidth={(isActive ? 2 : 0.8) / mapZoom}
                            style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                            onClick={() => setSelectedMarker(isActive ? null : wb)}
                          />
                        </Marker>
                      );
                    })}
                  </ZoomableGroup>
                </ComposableMap>
              ) : null}
            </div>

            {/* Zoom controls */}
            {selectedState && (
              <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
                <button onClick={() => setMapZoom(z => Math.min(z * 1.5, 12))} className="w-8 h-8 rounded-lg bg-slate-800/80 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-slate-700 text-sm font-bold">+</button>
                <button onClick={() => setMapZoom(z => Math.max(z / 1.5, 1))} className="w-8 h-8 rounded-lg bg-slate-800/80 backdrop-blur border border-white/10 flex items-center justify-center text-white hover:bg-slate-700 text-sm font-bold">{'\u2212'}</button>
                <button onClick={() => { setMapZoom(1); if (STATE_GEO[selectedState]) setMapCenter(STATE_GEO[selectedState].center); }} className="w-8 h-8 rounded-lg bg-slate-800/80 backdrop-blur border border-white/10 flex items-center justify-center text-slate-400 hover:bg-slate-700 text-[10px] font-medium">{'\u2302'}</button>
              </div>
            )}

            {/* Map legend */}
            <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800/80 backdrop-blur border border-white/10 text-[11px] text-slate-300">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Healthy</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Moderate</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" /> Impaired</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Severe</span>
            </div>

            {/* Marker popup */}
            {selectedMarker && (
              <div className="absolute top-3 left-3 z-20 max-w-xs w-full p-4 rounded-xl bg-slate-800/95 backdrop-blur border border-white/10 shadow-2xl">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-semibold text-white leading-tight pr-2">{selectedMarker.name || selectedMarker.id}</h4>
                  <button onClick={() => setSelectedMarker(null)} className="text-slate-400 hover:text-white flex-shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    selectedMarker.alertLevel === 'high' ? 'bg-red-500/20 text-red-400' :
                    selectedMarker.alertLevel === 'medium' ? 'bg-orange-500/20 text-orange-400' :
                    selectedMarker.alertLevel === 'low' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    Category {selectedMarker.category}
                  </span>
                  <span className="text-[10px] text-slate-500">{selectedMarker.causeCount} pollutant{selectedMarker.causeCount !== 1 ? 's' : ''}</span>
                </div>
                {selectedMarker.causes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedMarker.causes.slice(0, 5).map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300">{getCauseEmoji(c)} {c.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</span>
                    ))}
                    {selectedMarker.causes.length > 5 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-500">+{selectedMarker.causes.length - 5} more</span>
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
        <section ref={threatsVis.ref} className={`py-20 bg-slate-950 transition-all duration-700 ${threatsVis.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: playfair }}>
                Top Water Quality Threats
              </h2>
              <p className="mt-3 text-slate-400">The most common pollutants affecting {STATE_NAMES[selectedState]}&rsquo;s waterbodies</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {causeFrequency.slice(0, 5).map(([cause, count], i) => (
                <div key={cause} className="group p-6 rounded-2xl bg-gradient-to-b from-white/[0.05] to-white/[0.02] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-300">
                  <div className="text-3xl mb-3">{getCauseEmoji(cause)}</div>
                  <h3 className="text-sm font-semibold text-white mb-1 leading-tight">
                    {cause.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim()}
                  </h3>
                  <p className="text-2xl font-bold text-white mb-2"><Counter target={count} /></p>
                  <p className="text-xs text-slate-500 leading-relaxed">{getCauseDescription(cause)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══ WATERBODY SPOTLIGHT ═══ */}
      {selectedState && spotlight && (spotlight.worst || spotlight.attaining || spotlight.atRisk) && (
        <section ref={spotlightVis.ref} className={`py-20 bg-gradient-to-b from-slate-950 to-slate-900 transition-all duration-700 ${spotlightVis.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-white" style={{ fontFamily: playfair }}>
                Waterbody Spotlight
              </h2>
              <p className="mt-3 text-slate-400">A closer look at notable waterbodies in {STATE_NAMES[selectedState]}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Worst */}
              {spotlight.worst && (
                <div className="p-6 rounded-2xl bg-white/[0.03] border-l-4 border-red-500 border-r border-t border-b border-r-white/[0.06] border-t-white/[0.06] border-b-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Most Impaired</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 leading-tight">{spotlight.worst.name || spotlight.worst.id}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 uppercase mb-3">Category {spotlight.worst.category}</span>
                  <p className="text-xs text-slate-400 mb-2">{spotlight.worst.causeCount} identified pollutant{spotlight.worst.causeCount !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-1">
                    {spotlight.worst.causes.slice(0, 4).map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">{getCauseEmoji(c)} {c.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim()}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Attaining */}
              {spotlight.attaining && (
                <div className="p-6 rounded-2xl bg-white/[0.03] border-l-4 border-green-500 border-r border-t border-b border-r-white/[0.06] border-t-white/[0.06] border-b-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="h-4 w-4 text-green-400" />
                    <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Healthy Example</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 leading-tight">{spotlight.attaining.name || spotlight.attaining.id}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 uppercase mb-3">Category {spotlight.attaining.category}</span>
                  <p className="text-xs text-slate-400">Meeting water quality standards &mdash; an example of what&rsquo;s possible with proper stewardship.</p>
                </div>
              )}

              {/* At-Risk */}
              {spotlight.atRisk && (
                <div className="p-6 rounded-2xl bg-white/[0.03] border-l-4 border-orange-500 border-r border-t border-b border-r-white/[0.06] border-t-white/[0.06] border-b-white/[0.06]">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-4 w-4 text-orange-400" />
                    <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">Most At-Risk</span>
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2 leading-tight">{spotlight.atRisk.name || spotlight.atRisk.id}</h3>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/20 text-orange-400 uppercase mb-3">Category {spotlight.atRisk.category}</span>
                  <p className="text-xs text-slate-400 mb-2">{spotlight.atRisk.causeCount} identified pollutant{spotlight.atRisk.causeCount !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-1">
                    {spotlight.atRisk.causes.slice(0, 4).map(c => (
                      <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">{getCauseEmoji(c)} {c.toLowerCase().replace(/\b\w/g, l => l.toUpperCase()).replace(/\(.*?\)/g, '').trim()}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ═══ INFOGRAPHIC / BY THE NUMBERS ═══ */}
      <section ref={infoVis.ref} className={`py-24 bg-slate-50 transition-all duration-700 ${infoVis.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900" style={{ fontFamily: playfair }}>
              By the Numbers
            </h2>
            <p className="mt-3 text-slate-500 text-lg">National water quality at a glance</p>
          </div>

          {nationalStats && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-20">
              <div className="text-center p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="text-4xl sm:text-5xl font-bold text-slate-900">
                  <Counter target={nationalStats.totalWb} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Assessed Waterbodies</p>
              </div>
              <div className="text-center p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="text-4xl sm:text-5xl font-bold text-red-600">
                  <Counter target={nationalStats.totalCat5} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">Category 5 (Severely Impaired)</p>
              </div>
              <div className="text-center p-8 rounded-2xl bg-white border border-slate-200 shadow-sm">
                <div className="text-4xl sm:text-5xl font-bold text-orange-600">
                  <Counter target={nationalStats.fGradeCount} />
                </div>
                <p className="mt-2 text-sm text-slate-500 font-medium">States with &ldquo;F&rdquo; Grade</p>
              </div>
            </div>
          )}

          <div className="text-center mb-10">
            <h3 className="text-2xl font-bold text-slate-900" style={{ fontFamily: playfair }}>Did You Know?</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { icon: '🏞️', title: 'Half of US rivers and streams are impaired', desc: 'According to the EPA, over 50% of assessed rivers and streams don\'t meet water quality standards for at least one designated use.' },
              { icon: '🚰', title: 'Nutrient pollution costs billions', desc: 'Nutrient pollution in U.S. waterways costs an estimated $4.6 billion annually in drinking water treatment, lost recreation, and reduced property values.' },
              { icon: '🐟', title: 'Fish advisories span all 50 states', desc: 'Every state in the U.S. has issued fish consumption advisories due to mercury, PCBs, or other contaminants found in local waterways.' },
              { icon: '🌊', title: 'TMDLs drive real improvements', desc: 'Total Maximum Daily Load plans have helped restore thousands of waterbodies nationwide by setting science-based pollution limits.' },
            ].map(fact => (
              <div key={fact.title} className="flex gap-4 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-2xl flex-shrink-0 mt-0.5">{fact.icon}</span>
                <div>
                  <h4 className="font-semibold text-slate-900 mb-1">{fact.title}</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">{fact.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PEARL CTA ═══ */}
      <section ref={ctaVis.ref} className={`py-24 bg-gradient-to-b from-slate-950 via-cyan-950 to-slate-950 relative overflow-hidden transition-all duration-700 ${ctaVis.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(6,182,212,.25) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59,130,246,.2) 0%, transparent 50%)',
        }}
      >
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />
        <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight" style={{ fontFamily: playfair }}>
            See What&rsquo;s Really Happening<br />Beneath the Surface
          </h2>
          <p className="mt-6 text-lg text-slate-300 leading-relaxed max-w-xl mx-auto">
            Project PEARL is America&rsquo;s surface water intelligence platform &mdash; connecting federal datasets,
            live sensors, and AI-powered analysis into decision-ready intelligence for every stakeholder.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a href="mailto:doug@project-pearl.org" className="group inline-flex items-center gap-3 px-8 py-4 text-base font-semibold text-slate-900 bg-white rounded-full hover:bg-slate-100 transition-all shadow-2xl shadow-black/20">
              Request a Demo <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a href="/" className="inline-flex items-center gap-2 px-8 py-4 text-base font-medium text-white/90 border border-white/20 rounded-full hover:bg-white/10 transition-all backdrop-blur-sm">
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="py-12 bg-slate-950 border-t border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a href="/" className="hover:text-white transition-colors">Home</a>
              <a href="/methodology" className="hover:text-white transition-colors">Methodology</a>
              <a href="mailto:doug@project-pearl.org" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-xs text-slate-600">&copy; {new Date().getFullYear()} Local Seafood Projects Inc. All rights reserved.</p>
          </div>
          <p className="text-center mt-4 text-[11px] text-slate-700">
            Data sourced from EPA ATTAINS. Not affiliated with the U.S. Environmental Protection Agency.
          </p>
        </div>
      </footer>
    </div>
  );
}

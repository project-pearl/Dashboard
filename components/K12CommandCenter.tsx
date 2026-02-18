'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import { feature } from 'topojson-client';
import statesTopo from 'us-atlas/states-10m.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Shield, ChevronDown, ChevronUp, Minus, AlertTriangle, CheckCircle, Search, Filter, Droplets, TrendingUp, BarChart3, Info, LogOut, Printer, BookOpen } from 'lucide-react';
import { getRegionById } from '@/lib/regionsConfig';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses, COST_PER_UNIT_YEAR } from '@/lib/restorationEngine';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { getEcoScore, getEcoData } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData, ejScoreLabel } from '@/lib/ejVulnerability';
import { STATE_AUTHORITIES } from '@/lib/stateWaterData';
import { useAuth } from '@/lib/authContext';
import { getRegionMockData, calculateRemovalEfficiency } from '@/lib/mockData';
import { WildlifeImpactDisclaimer } from '@/components/WildlifeImpactDisclaimer';
import { K12EducationalHub } from '@/components/K12EducationalHub';
import { WaterQualityChallenges } from '@/components/WaterQualityChallenges';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { exportK12FieldReport } from '@/components/PearlExports';
import dynamic from 'next/dynamic';

const GrantOpportunityMatcher = dynamic(
  () => import('@/components/GrantOpportunityMatcher').then((mod) => mod.GrantOpportunityMatcher),
  { ssr: false }
);


// ─── Types ───────────────────────────────────────────────────────────────────

type AlertLevel = 'none' | 'low' | 'medium' | 'high';

type RegionRow = {
  id: string;
  name: string;
  state: string;
  alertLevel: AlertLevel;
  activeAlerts: number;
  lastUpdatedISO: string;
  status: 'assessed' | 'monitored' | 'unmonitored';
  dataSourceCount: number;
};

type Props = {
  stateAbbr: string;
  isTeacher?: boolean;
  onSelectRegion?: (regionId: string) => void;
  onToggleDevMode?: () => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

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

const STATE_AGENCIES: Record<string, { name: string; division: string; url: string; phone?: string; ms4Program: string; cwaSec: string }> = {
  MD: { name: 'Maryland Dept. of the Environment', division: 'Water & Science Administration', url: 'https://mde.maryland.gov/programs/water', phone: '(410) 537-3000', ms4Program: 'MD MS4/NPDES', cwaSec: '§303(d)/§402' },
  FL: { name: 'Florida Dept. of Environmental Protection', division: 'Division of Water Resource Management', url: 'https://floridadep.gov/dear/water-quality-standards', phone: '(850) 245-2118', ms4Program: 'FL NPDES MS4', cwaSec: '§303(d)/§402' },
  VA: { name: 'Virginia DEQ', division: 'Water Planning Division', url: 'https://www.deq.virginia.gov/water', phone: '(804) 698-4000', ms4Program: 'VA VPDES MS4', cwaSec: '§303(d)/§402' },
  PA: { name: 'Pennsylvania DEP', division: 'Bureau of Clean Water', url: 'https://www.dep.pa.gov/Business/Water', phone: '(717) 787-5259', ms4Program: 'PA NPDES MS4', cwaSec: '§303(d)/§402' },
  DC: { name: 'DC Dept. of Energy & Environment', division: 'Water Quality Division', url: 'https://doee.dc.gov/service/water-quality', phone: '(202) 535-2600', ms4Program: 'DC MS4', cwaSec: '§303(d)/§402' },
  DE: { name: 'Delaware DNREC', division: 'Div. of Water', url: 'https://dnrec.delaware.gov/water/', phone: '(302) 739-9922', ms4Program: 'DE NPDES MS4', cwaSec: '§303(d)/§402' },
  WV: { name: 'West Virginia DEP', division: 'Div. of Water & Waste Management', url: 'https://dep.wv.gov/WWE', phone: '(304) 926-0495', ms4Program: 'WV NPDES MS4', cwaSec: '§303(d)/§402' },
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
  {} as Record<string, string>
);

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

// State-specific projection center [lon, lat] and scale for geoMercator
const STATE_GEO: Record<string, { center: [number, number]; scale: number }> = {
  AL: { center: [-86.8, 32.8], scale: 4500 }, AK: { center: [-153, 64], scale: 900 },
  AZ: { center: [-111.7, 34.2], scale: 4000 }, AR: { center: [-92.4, 34.8], scale: 5000 },
  CA: { center: [-119.5, 37.5], scale: 2800 }, CO: { center: [-105.5, 39.0], scale: 4000 },
  CT: { center: [-72.7, 41.6], scale: 12000 }, DE: { center: [-75.5, 39.0], scale: 14000 },
  DC: { center: [-77.02, 38.9], scale: 90000 }, FL: { center: [-82.5, 28.5], scale: 3200 },
  GA: { center: [-83.5, 32.7], scale: 4000 }, HI: { center: [-157, 20.5], scale: 5000 },
  ID: { center: [-114.5, 44.5], scale: 3200 }, IL: { center: [-89.2, 40.0], scale: 3800 },
  IN: { center: [-86.3, 39.8], scale: 5000 }, IA: { center: [-93.5, 42.0], scale: 4500 },
  KS: { center: [-98.5, 38.5], scale: 4200 }, KY: { center: [-85.3, 37.8], scale: 4800 },
  LA: { center: [-92.0, 31.0], scale: 4500 }, ME: { center: [-69.0, 45.5], scale: 4500 },
  MD: { center: [-77.0, 39.0], scale: 7500 }, MA: { center: [-71.8, 42.3], scale: 9000 },
  MI: { center: [-85.5, 44.0], scale: 3200 }, MN: { center: [-94.5, 46.3], scale: 3200 },
  MS: { center: [-89.7, 32.7], scale: 4500 }, MO: { center: [-92.5, 38.5], scale: 4000 },
  MT: { center: [-109.6, 47.0], scale: 3200 }, NE: { center: [-99.8, 41.5], scale: 3800 },
  NV: { center: [-117.0, 39.5], scale: 3200 }, NH: { center: [-71.6, 43.8], scale: 7500 },
  NJ: { center: [-74.7, 40.1], scale: 9000 }, NM: { center: [-106.0, 34.5], scale: 3800 },
  NY: { center: [-75.5, 42.5], scale: 4000 }, NC: { center: [-79.5, 35.5], scale: 4500 },
  ND: { center: [-100.5, 47.5], scale: 4500 }, OH: { center: [-82.8, 40.2], scale: 5000 },
  OK: { center: [-97.5, 35.5], scale: 4200 }, OR: { center: [-120.5, 44.0], scale: 3500 },
  PA: { center: [-77.6, 41.0], scale: 5000 }, RI: { center: [-71.5, 41.7], scale: 22000 },
  SC: { center: [-80.9, 33.8], scale: 5500 }, SD: { center: [-100.2, 44.5], scale: 4200 },
  TN: { center: [-86.3, 35.8], scale: 4800 }, TX: { center: [-99.5, 31.5], scale: 2500 },
  UT: { center: [-111.7, 39.5], scale: 3800 }, VT: { center: [-72.6, 44.0], scale: 7500 },
  VA: { center: [-79.5, 37.8], scale: 4500 }, WA: { center: [-120.5, 47.5], scale: 4000 },
  WV: { center: [-80.6, 38.6], scale: 6000 }, WI: { center: [-89.8, 44.5], scale: 3800 },
  WY: { center: [-107.5, 43.0], scale: 4000 },
};

function levelToLabel(level: string): string {
  return level === 'high' ? 'Severe' : level === 'medium' ? 'Impaired' : level === 'low' ? 'Watch' : 'Healthy';
}

const SEVERITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };

function scoreToGrade(score: number): { letter: string; color: string; bg: string } {
  if (score >= 90) return { letter: 'A', color: 'text-green-700', bg: 'bg-green-100 border-green-300' };
  if (score >= 80) return { letter: 'B', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-300' };
  if (score >= 70) return { letter: 'C', color: 'text-yellow-700', bg: 'bg-yellow-100 border-yellow-300' };
  if (score >= 60) return { letter: 'D', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-300' };
  return { letter: 'F', color: 'text-red-700', bg: 'bg-red-100 border-red-300' };
}

// ─── View Lens: controls what each view shows/hides ──────────────────────────

// ─── Map Overlay: what drives marker colors ──────────────────────────────────

type OverlayId = 'risk' | 'coverage';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'risk', label: 'Water Quality Risk', description: 'Impairment severity from EPA ATTAINS & state assessments', icon: Droplets },
  { id: 'coverage', label: 'Monitoring Coverage', description: 'Data source availability & assessment status', icon: BarChart3 },
];

function getMarkerColor(overlay: OverlayId, wb: { alertLevel: AlertLevel; status: string; dataSourceCount: number }): string {
  if (overlay === 'risk') {
    return wb.alertLevel === 'high' ? '#ef4444' :
           wb.alertLevel === 'medium' ? '#f59e0b' :
           wb.alertLevel === 'low' ? '#eab308' : '#22c55e';
  }
  // coverage: assessed vs monitored vs unmonitored
  if (wb.status === 'assessed') return '#166534'; // dark green — EPA assessed
  if (wb.status === 'monitored') return '#3b82f6'; // blue — monitored but not assessed
  return '#9ca3af'; // gray — no data
}

// ─── Data Generation (state-filtered) ────────────────────────────────────────

const LEGACY_ALERTS: Record<string, { alertLevel: AlertLevel; activeAlerts: number }> = {
  maryland_middle_branch:    { alertLevel: 'high',   activeAlerts: 5 },
  maryland_back_river:       { alertLevel: 'high',   activeAlerts: 4 },
  maryland_gwynns_falls:     { alertLevel: 'high',   activeAlerts: 4 },
  maryland_bear_creek:       { alertLevel: 'medium', activeAlerts: 3 },
  maryland_inner_harbor:     { alertLevel: 'high',   activeAlerts: 4 },
  maryland_jones_falls:      { alertLevel: 'medium', activeAlerts: 3 },
  maryland_patapsco_river:   { alertLevel: 'medium', activeAlerts: 2 },
  maryland_patapsco:         { alertLevel: 'medium', activeAlerts: 2 },
  maryland_stony_creek:      { alertLevel: 'medium', activeAlerts: 2 },
  maryland_gunpowder:        { alertLevel: 'low',    activeAlerts: 1 },
  maryland_potomac:          { alertLevel: 'high',   activeAlerts: 8 },
  maryland_chester_river:    { alertLevel: 'medium', activeAlerts: 2 },
  maryland_choptank_river:   { alertLevel: 'medium', activeAlerts: 2 },
  maryland_patuxent_river:   { alertLevel: 'medium', activeAlerts: 2 },
  maryland_severn_river:     { alertLevel: 'medium', activeAlerts: 2 },
  maryland_nanticoke_river:  { alertLevel: 'low',    activeAlerts: 1 },
  virginia_elizabeth:        { alertLevel: 'high',   activeAlerts: 6 },
  virginia_james_lower:      { alertLevel: 'high',   activeAlerts: 4 },
  virginia_rappahannock:     { alertLevel: 'medium', activeAlerts: 3 },
  virginia_york:             { alertLevel: 'medium', activeAlerts: 2 },
  virginia_lynnhaven:        { alertLevel: 'high',   activeAlerts: 4 },
  dc_anacostia:              { alertLevel: 'high',   activeAlerts: 6 },
  dc_rock_creek:             { alertLevel: 'high',   activeAlerts: 4 },
  dc_potomac:                { alertLevel: 'medium', activeAlerts: 3 },
  dc_oxon_run:               { alertLevel: 'medium', activeAlerts: 3 },
  dc_watts_branch:           { alertLevel: 'medium', activeAlerts: 2 },
  pennsylvania_conestoga:    { alertLevel: 'high',   activeAlerts: 5 },
  pennsylvania_swatara:      { alertLevel: 'high',   activeAlerts: 4 },
  pennsylvania_codorus:      { alertLevel: 'medium', activeAlerts: 3 },
  pennsylvania_susquehanna:  { alertLevel: 'medium', activeAlerts: 2 },
  delaware_christina:        { alertLevel: 'high',   activeAlerts: 4 },
  delaware_brandywine:       { alertLevel: 'medium', activeAlerts: 3 },
  florida_escambia:          { alertLevel: 'high',   activeAlerts: 4 },
  florida_tampa_bay:         { alertLevel: 'high',   activeAlerts: 5 },
  florida_charlotte_harbor:  { alertLevel: 'high',   activeAlerts: 4 },
  florida_pensacola_bay:     { alertLevel: 'medium', activeAlerts: 2 },
  westvirginia_shenandoah:   { alertLevel: 'high',   activeAlerts: 5 },
  westvirginia_opequon:      { alertLevel: 'high',   activeAlerts: 4 },
  westvirginia_potomac_sb:   { alertLevel: 'medium', activeAlerts: 3 },
};

function generateStateRegionData(stateAbbr: string): RegionRow[] {
  const now = new Date().toISOString();
  const rows: RegionRow[] = [];

  for (const [id, meta] of Object.entries(REGION_META)) {
    const fips = meta.stateCode.replace('US:', '');
    const abbr = FIPS_TO_ABBR[fips] || fips;
    if (abbr !== stateAbbr) continue;

    const legacy = LEGACY_ALERTS[id];
    const sources = getWaterbodyDataSources(id);

    rows.push({
      id,
      name: meta.name,
      state: abbr,
      alertLevel: legacy?.alertLevel ?? 'none',
      activeAlerts: legacy?.activeAlerts ?? 0,
      lastUpdatedISO: now,
      status: legacy ? 'assessed' : sources.length > 0 ? 'monitored' : 'unmonitored',
      dataSourceCount: sources.length,
    });
  }
  return rows;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function K12CommandCenter({ stateAbbr, isTeacher: isTeacherProp = false, onSelectRegion, onToggleDevMode }: Props) {
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const agency = STATE_AGENCIES[stateAbbr] || STATE_AUTHORITIES[stateAbbr] || null;
  const { user, logout } = useAuth();

  // ── K12-specific state ──
  const [isTeacher, setIsTeacher] = useState(isTeacherProp);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>('risk');
  const [showWildlife, setShowWildlife] = useState(!isTeacherProp);

  // ── Water fun facts for students ──
  const k12WaterFacts = [
    "Fish need dissolved oxygen (DO) above 5 mg/L to breathe — just like you need air!",
    "One inch of rain on one acre of land = 27,000 gallons of water runoff!",
    "Blue crabs in the Chesapeake Bay are sensitive to low oxygen — called dead zones.",
    "It takes 1,000 gallons of water to produce just one pound of beef.",
    "Wetlands filter pollution naturally — they are nature's water treatment plants!",
    "Turbidity (cloudiness) affects fish by blocking sunlight that underwater plants need.",
    "Phosphorus from fertilizers causes algae blooms that can kill fish.",
    "Waterfowl populations drop when water quality drops — they are great indicators!",
    "Dissolved oxygen drops at night because plants stop photosynthesizing.",
    "The first 30 minutes of a rainstorm carry the most pollution — called the first flush.",
  ];
  const [k12FactIndex] = useState(() => Math.floor(Math.random() * k12WaterFacts.length));

  // ── State-filtered region data ──
  const baseRegions = useMemo(() => generateStateRegionData(stateAbbr), [stateAbbr]);

  // ── Map: topo + projection ──
  const topo = useMemo(() => {
    try { return feature(statesTopo as any, (statesTopo as any).objects.states) as any; }
    catch { return null; }
  }, []);

  const stateGeo = STATE_GEO[stateAbbr] || { center: [-98.5, 39.8] as [number, number], scale: 1200 };

  // Waterbody marker coordinates from regionsConfig
  const wbMarkers = useMemo(() => {
    return baseRegions.map(r => {
      const cfg = getRegionById(r.id) as any;
      if (!cfg) return null;
      const lat = cfg.lat ?? cfg.latitude ?? null;
      const lon = cfg.lon ?? cfg.lng ?? cfg.longitude ?? null;
      if (lat == null || lon == null) return null;
      return { id: r.id, name: r.name, lat, lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount };
    }).filter(Boolean) as { id: string; name: string; lat: number; lon: number; alertLevel: AlertLevel; status: string; dataSourceCount: number }[];
  }, [baseRegions]);

  // ── ATTAINS bulk for this state ──
  const [attainsBulk, setAttainsBulk] = useState<Array<{ name: string; category: string; alertLevel: AlertLevel; causes: string[]; cycle: string }>>([]);
  const [attainsBulkLoaded, setAttainsBulkLoaded] = useState(false);

  // Merge ATTAINS into region data
  const regionData = useMemo(() => {
    if (attainsBulk.length === 0) return baseRegions;

    const SEVERITY: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
    const merged = baseRegions.map(r => {
      // Find matching ATTAINS entry
      const normName = r.name.toLowerCase().replace(/,.*$/, '').trim();
      const match = attainsBulk.find(a => {
        const aN = a.name.toLowerCase().trim();
        return aN.includes(normName) || normName.includes(aN);
      });
      if (!match) return r;
      // Upgrade if ATTAINS is worse
      if (SEVERITY[match.alertLevel] > SEVERITY[r.alertLevel]) {
        return { ...r, alertLevel: match.alertLevel, status: 'assessed' as const };
      }
      return { ...r, status: 'assessed' as const };
    });

    // Add ATTAINS-only waterbodies not in registry
    const existingNames = new Set(merged.map(r => r.name.toLowerCase().replace(/,.*$/, '').trim()));
    let addedCount = 0;
    for (const a of attainsBulk) {
      const aN = a.name.toLowerCase().trim();
      const alreadyExists = [...existingNames].some(e => e.includes(aN) || aN.includes(e));
      if (!alreadyExists && a.category.includes('5')) {
        const id = `${stateAbbr.toLowerCase()}_${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`;
        merged.push({
          id,
          name: a.name,
          state: stateAbbr,
          alertLevel: a.alertLevel,
          activeAlerts: a.causes.length,
          lastUpdatedISO: new Date().toISOString(),
          status: 'assessed',
          dataSourceCount: 0,
        });
        existingNames.add(aN);
        addedCount++;
      }
    }
    if (addedCount > 0) console.log(`[SCC] Added ${addedCount} ATTAINS-only Cat 5 waterbodies for ${stateAbbr}`);
    return merged;
  }, [baseRegions, attainsBulk, stateAbbr]);

  // Fetch ATTAINS bulk from cache for this state
  useEffect(() => {
    let cancelled = false;
    async function fetchAttains() {
      try {
        const r = await fetch('/api/water-data?action=attains-national-cache');
        if (!r.ok) return;
        const json = await r.json();
        const stateData = json.states?.[stateAbbr];
        if (!stateData || cancelled) return;
        const waterbodies = (stateData.waterbodies || []).map((wb: any) => ({
          name: wb.name || '',
          category: wb.category || '',
          alertLevel: (wb.alertLevel || 'none') as AlertLevel,
          causes: wb.causes || [],
          cycle: '',
        }));
        if (!cancelled) {
          setAttainsBulk(waterbodies);
          setAttainsBulkLoaded(true);
        }
      } catch (e: any) {
        console.warn('[SCC ATTAINS] Failed:', e.message);
      }
    }
    const timer = setTimeout(fetchAttains, 1_000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [stateAbbr]);

  // ── Per-waterbody caches ──
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [showRestorationPlan, setShowRestorationPlan] = useState(true);
  const [showRestorationCard, setShowRestorationCard] = useState(false);
  const [showCostPanel, setShowCostPanel] = useState(false);
  const [alertFeedMinimized, setAlertFeedMinimized] = useState(true);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id: string) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isSectionOpen = (id: string) => !collapsedSections[id];

  // Print a single card section by its DOM id
  const printSection = (sectionId: string, title: string) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title} — ${stateName} PEARL Explorer</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1e293b; }
        .print-header { border-bottom: 2px solid #3b82f6; padding-bottom: 12px; margin-bottom: 16px; }
        .print-header h1 { font-size: 16px; font-weight: 700; color: #1e3a5f; }
        .print-header p { font-size: 11px; color: #64748b; margin-top: 4px; }
        .print-content { font-size: 13px; line-height: 1.5; }
        .print-content table { width: 100%; border-collapse: collapse; margin: 8px 0; }
        .print-content th, .print-content td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; font-size: 12px; }
        .print-content th { background: #f8fafc; font-weight: 600; }
        canvas, svg { max-width: 100%; }
        button, [role="button"] { display: none !important; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div class="print-header">
        <h1>🦪 ${title}</h1>
        <p>${stateName} PEARL Explorer · Printed ${new Date().toLocaleDateString()} · Project PEARL</p>
      </div>
      <div class="print-content">${el.innerHTML}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  };
  const { waterData, isLoading: waterLoading, hasRealData } = useWaterData(activeDetailId);

  // ── Mock data bridge: supplies removalEfficiencies, stormEvents, displayData to child components ──
  // getRegionMockData only has data for pre-configured demo regions — wrap defensively
  const regionMockData = useMemo(() => {
    if (!activeDetailId) return null;
    try { return getRegionMockData(activeDetailId); } catch { return null; }
  }, [activeDetailId]);
  const influentData = useMemo(() => regionMockData?.influent ?? null, [regionMockData]);
  const effluentData = useMemo(() => regionMockData?.effluent ?? null, [regionMockData]);
  const stormEvents = useMemo(() => regionMockData?.storms ?? [], [regionMockData]);
  const removalEfficiencies = useMemo(() => {
    if (!influentData || !effluentData) return { DO: 0, turbidity: 0, TN: 0, TP: 0, TSS: 0, salinity: 0 };
    try {
      return {
        DO: calculateRemovalEfficiency(influentData.parameters.DO.value, effluentData.parameters.DO.value, 'DO'),
        turbidity: calculateRemovalEfficiency(influentData.parameters.turbidity.value, effluentData.parameters.turbidity.value, 'turbidity'),
        TN: calculateRemovalEfficiency(influentData.parameters.TN.value, effluentData.parameters.TN.value, 'TN'),
        TP: calculateRemovalEfficiency(influentData.parameters.TP.value, effluentData.parameters.TP.value, 'TP'),
        TSS: calculateRemovalEfficiency(influentData.parameters.TSS.value, effluentData.parameters.TSS.value, 'TSS'),
        salinity: calculateRemovalEfficiency(influentData.parameters.salinity.value, effluentData.parameters.salinity.value, 'salinity'),
      };
    } catch { return { DO: 0, turbidity: 0, TN: 0, TP: 0, TSS: 0, salinity: 0 }; }
  }, [influentData, effluentData]);
  const displayData = useMemo(() => regionMockData?.ambient ?? null, [regionMockData]);

  const [attainsCache, setAttainsCache] = useState<Record<string, {
    category: string; causes: string[]; causeCount: number; status: string; cycle: string; loading: boolean;
  }>>({});
  const [ejCache, setEjCache] = useState<Record<string, {
    ejIndex: number | null; loading: boolean; error?: string;
  }>>({});
  const [stateSummaryCache, setStateSummaryCache] = useState<Record<string, {
    loading: boolean; impairedPct: number; totalAssessed: number;
  }>>({});

  // Fetch per-waterbody ATTAINS when detail opens
  useEffect(() => {
    if (!activeDetailId) return;
    const nccRegion = regionData.find(r => r.id === activeDetailId);
    if (!nccRegion) return;
    if (attainsCache[activeDetailId] && !attainsCache[activeDetailId].loading) return;
    setAttainsCache(prev => ({ ...prev, [activeDetailId]: { category: '', causes: [], causeCount: 0, status: '', cycle: '', loading: true } }));

    const regionConfig = getRegionById(activeDetailId);
    const regionName = regionConfig?.name || nccRegion.name;
    const encodedName = encodeURIComponent(regionName);
    fetch(`/api/water-data?action=attains-assessments&assessmentUnitName=${encodedName}&statecode=${stateAbbr}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setAttainsCache(prev => ({
          ...prev,
          [activeDetailId]: {
            category: data.category || '',
            causes: data.causes || [],
            causeCount: data.causeCount || 0,
            status: data.overallStatus || '',
            cycle: data.reportingCycle || '',
            loading: false,
          },
        }));
      })
      .catch(() => setAttainsCache(prev => ({ ...prev, [activeDetailId]: { ...prev[activeDetailId], loading: false } })));
  }, [activeDetailId, regionData, stateAbbr, attainsCache]);

  // Fetch EJ data when detail opens
  useEffect(() => {
    if (!activeDetailId) return;
    if (ejCache[activeDetailId] && !ejCache[activeDetailId].loading) return;
    setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: true } }));

    const nccRegion = regionData.find(r => r.id === activeDetailId);
    if (!nccRegion) return;
    const regionConfig = getRegionById(activeDetailId);
    const lat = (regionConfig as any)?.lat || 39.0;
    const lng = (regionConfig as any)?.lon || (regionConfig as any)?.lng || -76.5;
    fetch(`/api/water-data?action=ejscreen&lat=${lat}&lng=${lng}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) {
          setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: false, error: 'unavailable' } }));
          return;
        }
        setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: data.ejIndex ?? null, loading: false } }));
      })
      .catch(() => setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: false, error: 'failed' } })));
  }, [activeDetailId, regionData, ejCache]);

  // Fetch state summary
  useEffect(() => {
    if (stateSummaryCache[stateAbbr]) return;
    setStateSummaryCache(prev => ({ ...prev, [stateAbbr]: { loading: true, impairedPct: 0, totalAssessed: 0 } }));
    fetch(`/api/water-data?action=attains-state-summary&statecode=${stateAbbr}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setStateSummaryCache(prev => ({
          ...prev,
          [stateAbbr]: { loading: false, impairedPct: data.impairedPct ?? 0, totalAssessed: data.totalAssessed ?? 0 },
        }));
      })
      .catch(() => setStateSummaryCache(prev => ({ ...prev, [stateAbbr]: { ...prev[stateAbbr], loading: false } })));
  }, [stateAbbr, stateSummaryCache]);

  // ── Filtering & sorting ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low' | 'impaired' | 'monitored'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const sortedRegions = useMemo(() => {
    let filtered = regionData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    if (filterLevel !== 'all') {
      if (filterLevel === 'impaired') {
        filtered = filtered.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium');
      } else if (filterLevel === 'monitored') {
        filtered = filtered.filter(r => r.status === 'monitored');
      } else {
        filtered = filtered.filter(r => r.alertLevel === filterLevel);
      }
    }
    return [...filtered].sort((a, b) => SEVERITY_ORDER[b.alertLevel] - SEVERITY_ORDER[a.alertLevel] || a.name.localeCompare(b.name));
  }, [regionData, searchQuery, filterLevel]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const high = regionData.filter(r => r.alertLevel === 'high').length;
    const medium = regionData.filter(r => r.alertLevel === 'medium').length;
    const low = regionData.filter(r => r.alertLevel === 'low').length;
    const monitored = regionData.filter(r => r.dataSourceCount > 0).length;
    return { total: regionData.length, high, medium, low, monitored };
  }, [regionData]);

  // ── MS4 jurisdictions ──


  // ── Hotspots: Top 5 worsening / improving (state-scoped) ──
  const hotspots = useMemo(() => {
    const assessed = regionData.filter(r => r.status === 'assessed');
    const worsening = [...assessed]
      .sort((a, b) => (SEVERITY_ORDER[b.alertLevel] - SEVERITY_ORDER[a.alertLevel]) || (b.activeAlerts - a.activeAlerts))
      .slice(0, 5);
    const improving = [...assessed]
      .sort((a, b) => (SEVERITY_ORDER[a.alertLevel] - SEVERITY_ORDER[b.alertLevel]) || (a.activeAlerts - b.activeAlerts))
      .slice(0, 5);
    return { worsening, improving };
  }, [regionData]);

  // Bulk ATTAINS → matching helper for WaterbodyDetailCard
  function resolveBulkAttains(regionName: string) {
    if (attainsBulk.length === 0) return null;
    const normName = regionName.toLowerCase().replace(/,.*$/, '').trim();
    return attainsBulk.find(a => {
      const aN = a.name.toLowerCase().trim();
      return aN.includes(normName) || normName.includes(aN);
    }) || null;
  }

  // ── Waterbody display limit ──
  const [showAll, setShowAll] = useState(false);
  const displayedRegions = showAll ? sortedRegions : sortedRegions.slice(0, 15);

  // ── Expanded sections ──
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ waterbodies: true });
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-50">
      <div className="mx-auto max-w-7xl p-4 space-y-6">

        {/* Toast */}
        {toastMsg && (
          <div className="fixed top-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-top-2">
            <div className="bg-white border-2 border-blue-300 rounded-xl shadow-lg p-4 flex items-start gap-3">
              <div className="text-blue-600 mt-0.5">ℹ️</div>
              <div className="flex-1"><div className="text-sm text-slate-700">{toastMsg}</div></div>
              <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="relative h-12 w-40 cursor-default select-none flex-shrink-0"
              onDoubleClick={() => onToggleDevMode?.()}
            >
              <Image src="/Logo_Pearl_as_Headline.JPG" alt="Project Pearl Logo" fill className="object-contain object-left" priority />
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-800">{stateName} PEARL Explorer</div>
              <div className="text-sm text-slate-600">
                {isTeacher
                  ? 'NGSS-aligned water quality data, field report tools & curriculum resources'
                  : 'Discover your local waterways — explore real water quality data and learn what it means for wildlife'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Teacher / Student toggle */}
            <button
              onClick={() => setIsTeacher(false)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                !isTeacher
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-emerald-50 hover:text-emerald-600'
              }`}
            >
              🎒 Student
            </button>
            <button
              onClick={() => setIsTeacher(true)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                isTeacher
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-500 hover:bg-purple-50 hover:text-purple-600'
              }`}
            >
              📚 Teacher
            </button>
            {/* Role badge */}
            <div className={`hidden md:inline-flex items-center h-7 px-2.5 text-[10px] font-bold rounded-full border ${
              isTeacher
                ? 'border-purple-300 bg-purple-50 text-purple-700'
                : 'border-emerald-300 bg-emerald-50 text-emerald-700'
            }`}>
              {isTeacher ? '👩‍🏫 Teacher' : '🎓 Student'}
            </div>
            {/* Account */}
            {user && (
            <div className="relative">
              <button
                onClick={() => setShowAccountPanel(!showAccountPanel)}
                className="inline-flex items-center h-7 px-2.5 text-[10px] font-semibold rounded-md border bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Shield className="h-3 w-3 mr-1" />
                {user.name || (isTeacher ? 'Teacher' : 'Student')}
                <span className="ml-1 text-indigo-400">▾</span>
              </button>
              {showAccountPanel && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountPanel(false)} />
                <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                          <div className="text-[11px] text-slate-500">{user.email || 'student@project-pearl.org'}</div>
                        </div>
                      </div>
                      <button onClick={() => setShowAccountPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-xs border-b border-slate-100">
                    <div className="flex justify-between"><span className="text-slate-500">Role</span><span className="font-medium text-slate-700">{user.role || 'K12'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Organization</span><span className="font-medium text-slate-700 text-right">{user.organization || `${stateName} School District`}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Monitoring</span><span className="font-medium text-slate-700">{stateName} · {regionData.length.toLocaleString()} waterbodies</span></div>
                  </div>
                  <div className="px-4 py-2.5 space-y-1">
                    <button onClick={() => { setShowAccountPanel(false); logout(); }} className="w-full text-left px-3 py-2 rounded-md text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                      <LogOut size={13} />Sign Out
                    </button>
                  </div>
                </div>
                </>
              )}
            </div>
            )}
          </div>
        </div>

        {/* ── DATA SOURCES & RESEARCH CONTEXT — above map ── */}
        {(() => {
          const agency = STATE_AGENCIES[stateAbbr];
          const ejScore = getEJScore(stateAbbr);
          const stableHash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
          const trendVal = Math.round((stableHash01(stateAbbr + '|trend') * 100 - 50) * 10) / 10;
          const trendLabel = trendVal > 5 ? '↑ Improving' : trendVal < -5 ? '↓ Worsening' : '— Stable';
          const trendColor = trendVal > 5 ? 'text-green-700' : trendVal < -5 ? 'text-red-700' : 'text-slate-500';
          const trendBg = trendVal > 5 ? 'bg-green-50 border-green-200' : trendVal < -5 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200';
          const wbCount = regionData.length;
          const impairedCount = regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;

          return (
            <div id="section-regprofile" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapse('regprofile')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Droplets size={15} className="text-purple-600" />
                  <span className="text-sm font-bold text-slate-800">{stateName} — Water Health Dashboard</span>
                </div>
                <div className="flex items-center gap-1.5">
                <span onClick={(e) => { e.stopPropagation(); printSection('regprofile', 'Water Health Dashboard'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                </span>
                {isSectionOpen('regprofile') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
              </button>
              {isSectionOpen('regprofile') && (
              <div className="px-4 pb-3 pt-1">
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-center">
                    <div className="text-2xl font-black text-blue-700">{wbCount}</div>
                    <div className="text-[10px] text-blue-600 font-medium">Waterbodies</div>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-100 p-2.5 text-center">
                    <div className="text-xl font-bold text-red-700">{impairedCount}</div>
                    <div className="text-[10px] text-red-500">Need Help 🔴</div>
                  </div>
                  <div className="rounded-lg bg-green-50 border border-green-100 p-2.5 text-center">
                    <div className="text-xl font-bold text-green-700">{wbCount - impairedCount}</div>
                    <div className="text-[10px] text-green-500">Healthy 🟢</div>
                  </div>
                  <div className="rounded-lg bg-cyan-50 border border-cyan-200 p-2.5 text-center">
                    <div className="text-sm font-bold text-cyan-700 leading-tight">Real Data</div>
                    <div className="text-[10px] text-cyan-400">From EPA Sensors</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 border border-purple-100 p-2.5 text-center">
                    <div className="text-xl font-bold text-purple-700">{ejScore}<span className="text-xs font-normal text-purple-400">/100</span></div>
                    <div className="text-[10px] text-purple-500">EJ Score</div>
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-center">
                    <div className="text-sm font-bold text-amber-700 leading-tight">6</div>
                    <div className="text-[10px] text-amber-400">Data Sources</div>
                  </div>
                  <div className={`rounded-lg border p-2.5 text-center ${trendBg}`}>
                    <div className={`text-sm font-bold ${trendColor}`}>{trendLabel}</div>
                    <div className="text-[10px] text-slate-400">WQ Trend</div>
                  </div>
                </div>
              </div>
              )}
            </div>
          );
        })()}

        {/* ── STATEWIDE ALERT FEED — above map ── */}
        {(() => {
          const alertRegions = regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium');
          if (alertRegions.length === 0) return null;
          const criticalCount = alertRegions.filter(r => r.alertLevel === 'high').length;
          return (
            <div id="section-ej" className="rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 shadow-sm overflow-hidden">
              <div className={`flex items-center justify-between px-4 py-3 ${alertFeedMinimized ? '' : 'border-b border-orange-200'} bg-orange-50`}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                  </span>
                  <span className="text-sm font-bold text-orange-900">
                    Statewide Alert Feed — {stateName} Watershed Network
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-200 text-orange-800">
                    {criticalCount > 0 ? `${criticalCount} Critical` : `${alertRegions.length} Active`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-orange-600">{alertRegions.length} waterbodies with active alerts</span>
                  <button
                    onClick={() => setAlertFeedMinimized(prev => !prev)}
                    className="p-1 text-orange-700 bg-white border border-orange-300 rounded hover:bg-orange-100 transition-colors"
                    title={alertFeedMinimized ? 'Expand' : 'Minimize'}
                  >
                    {alertFeedMinimized ? <ChevronDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              {!alertFeedMinimized && (
              <div className="divide-y divide-orange-100 max-h-64 overflow-y-auto">
                {alertRegions.slice(0, 15).map((region, idx) => {
                  const causes = attainsCache[region.id]?.causes || [];
                  const category = attainsCache[region.id]?.category || '';
                  const isCat5 = category.includes('5');
                  return (
                    <div key={idx} className={`flex items-start gap-3 px-4 py-3 hover:bg-orange-50 transition-colors ${
                      region.alertLevel === 'high' ? 'bg-red-50/60' : ''
                    }`}>
                      <div className={`mt-2 flex-shrink-0 w-2 h-2 rounded-full ${
                        region.alertLevel === 'high' ? 'bg-red-500' : 'bg-amber-500'
                      }`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-slate-800 truncate">{region.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                            region.alertLevel === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {region.alertLevel === 'high' ? 'SEVERE' : 'WARNING'}
                          </span>
                          {isCat5 && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-red-200 text-red-800">Cat 5</span>}
                          {causes.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                              {causes.slice(0, 2).join(', ')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          {isCat5 ? 'Category 5 impaired — no TMDL established. ' : ''}
                          {causes.length > 0 ? `Listed for ${causes.join(', ').toLowerCase()}.` : `${region.activeAlerts} active alert${region.activeAlerts !== 1 ? 's' : ''}.`}
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveDetailId(region.id)}
                        className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-orange-700 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-all"
                      >
                        Jump →
                      </button>
                    </div>
                  );
                })}
              </div>
              )}
            </div>
          );
        })()}

        {/* ── Wildlife Toggle Banner — above the map (teachers only; students always see wildlife) ── */}
        {!isTeacher && <WildlifeImpactDisclaimer enabled={showWildlife} onToggle={setShowWildlife} />}

        {/* ── MAIN CONTENT: Map (2/3) + Waterbody List (1/3) ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: State Map (2/3 width — matches NCC layout) */}
          <Card className="lg:col-span-2 border-2 border-slate-200">
            <CardHeader>
              <CardTitle>{stateName} Monitoring Network</CardTitle>
              <CardDescription>
                Real state outlines. Colors reflect data based on selected overlay.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Overlay Selector */}
              <div className="flex flex-wrap gap-2 pb-3">
                {OVERLAYS.map((o) => {
                  const Icon = o.icon;
                  return (
                    <Button
                      key={o.id}
                      variant={overlay === o.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setOverlay(o.id)}
                      title={o.description}
                    >
                      <Icon className="h-4 w-4 mr-1" />
                      {o.label}
                    </Button>
                  );
                })}
              </div>

              {!topo ? (
                <div className="p-8 text-sm text-slate-500 text-center">
                  Map data unavailable. Install react-simple-maps, us-atlas, and topojson-client.
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="p-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span>{stateName} · {regionData.length} waterbodies monitored</span>
                    {attainsBulkLoaded && <span className="text-green-600 font-medium">● ATTAINS live</span>}
                  </div>
                  <div className="h-[480px] w-full">
                    <ComposableMap
                      projection="geoMercator"
                      projectionConfig={{ center: stateGeo.center, scale: stateGeo.scale }}
                      width={800}
                      height={500}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <Geographies geography={topo}>
                        {({ geographies }: { geographies: GeoFeature[] }) =>
                          geographies.map((g: GeoFeature) => {
                            const abbr = geoToAbbr(g);
                            const isSelected = abbr === stateAbbr;
                            return (
                              <Geography
                                key={g.rsmKey ?? g.id}
                                geography={g as any}
                                style={{
                                  default: {
                                    fill: isSelected ? '#e0e7ff' : '#f1f5f9',
                                    outline: 'none',
                                    stroke: isSelected ? '#4338ca' : '#cbd5e1',
                                    strokeWidth: isSelected ? 1.5 : 0.3,
                                  },
                                  hover: {
                                    fill: isSelected ? '#c7d2fe' : '#f1f5f9',
                                    outline: 'none',
                                    stroke: isSelected ? '#4338ca' : '#cbd5e1',
                                    strokeWidth: isSelected ? 1.5 : 0.3,
                                  },
                                  pressed: { fill: isSelected ? '#c7d2fe' : '#f1f5f9', outline: 'none' },
                                }}
                              />
                            );
                          })
                        }
                      </Geographies>

                      {/* Waterbody markers — color driven by overlay */}
                      {wbMarkers.map(wb => {
                        const isActive = wb.id === activeDetailId;
                        const markerColor = getMarkerColor(overlay, wb);
                        return (
                          <Marker key={wb.id} coordinates={[wb.lon, wb.lat]}>
                            <circle
                              r={isActive ? 7 : 4.5}
                              fill={markerColor}
                              stroke={isActive ? '#1e40af' : '#ffffff'}
                              strokeWidth={isActive ? 2.5 : 1.5}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setActiveDetailId(isActive ? null : wb.id)}
                            />
                            {isActive && (
                              <text
                                textAnchor="middle"
                                y={-12}
                                style={{ fontSize: '10px', fontWeight: 700, fill: '#1e3a5f', pointerEvents: 'none' }}
                              >
                                {wb.name}
                              </text>
                            )}
                          </Marker>
                        );
                      })}
                    </ComposableMap>
                  </div>
                  {/* Dynamic Legend */}
                  <div className="flex flex-wrap gap-2 p-3 text-xs bg-slate-50 border-t border-slate-200">
                    {overlay === 'risk' && (
                      <>
                        <span className="text-slate-500 font-medium self-center mr-1">Impairment Risk:</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Healthy</Badge>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Watch</Badge>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Impaired</Badge>
                        <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Severe</Badge>
                      </>
                    )}
                    {overlay === 'coverage' && (
                      <>
                        <span className="text-slate-500 font-medium self-center mr-1">Data Status:</span>
                        <Badge variant="secondary" className="bg-gray-200 text-gray-700">No Data</Badge>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Monitored</Badge>
                        <Badge variant="secondary" className="bg-green-800 text-white">EPA Assessed</Badge>
                      </>
                    )}
                    <span className="ml-auto text-slate-400">Click markers to select</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* RIGHT: Waterbody List (1/3 width) — matches NCC layout */}
          <Card className="lg:col-span-1 border-2 border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin size={18} />
                    <span>{stateName}</span>
                  </CardTitle>
                  <CardDescription>Waterbody monitoring summary</CardDescription>
                </div>
                {/* State Grade Circle */}
                {(() => {
                  const assessed = regionData.filter(r => r.status === 'assessed');
                  if (assessed.length === 0) return (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 bg-slate-100 border-slate-300">
                      <div className="text-2xl font-black text-slate-400">N/A</div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500">Ungraded</div>
                        <div className="text-[10px] text-slate-400">{attainsBulkLoaded ? 'No data' : 'Loading...'}</div>
                      </div>
                    </div>
                  );
                  const avgScore = Math.round(assessed.reduce((sum, r) => sum + (r.alertLevel === 'none' ? 100 : r.alertLevel === 'low' ? 85 : r.alertLevel === 'medium' ? 65 : 40), 0) / assessed.length);
                  const grade = scoreToGrade(avgScore);
                  return (
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 ${grade.bg}`}>
                      <div className={`text-2xl font-black ${grade.color}`}>{grade.letter}</div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${grade.color}`}>{avgScore}%</div>
                        <div className="text-[10px] text-slate-500">{assessed.length} assessed</div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Quick stats — matching NCC 4-tile row */}
              <div className="grid grid-cols-4 gap-1.5 text-center mt-3">
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold text-slate-800">{regionData.length}</div>
                  <div className="text-[10px] text-slate-500">Total</div>
                </div>
                <div className="rounded-lg bg-green-50 p-2">
                  <div className="text-lg font-bold text-green-700">{regionData.filter(r => r.status === 'assessed').length}</div>
                  <div className="text-[10px] text-slate-500">Assessed</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-2">
                  <div className="text-lg font-bold text-blue-600">{regionData.filter(r => r.status === 'monitored').length}</div>
                  <div className="text-[10px] text-slate-500">Monitored</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold text-slate-400">{regionData.filter(r => r.status === 'unmonitored').length}</div>
                  <div className="text-[10px] text-slate-500">No Data</div>
                </div>
              </div>

              {/* Filter pills — matching NCC tabs */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {([
                  { key: 'all' as const, label: 'All', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                  { key: 'impaired' as const, label: 'Impaired', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                  { key: 'high' as const, label: 'Severe', color: 'bg-red-100 text-red-700 border-red-200' },
                  { key: 'monitored' as const, label: 'Monitored', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                ] as const).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setFilterLevel(f.key); setShowAll(false); }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                      filterLevel === f.key
                        ? f.color + ' ring-1 ring-offset-1 shadow-sm'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                    {f.key !== 'all' && (() => {
                      const count = f.key === 'impaired'
                        ? regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length
                        : f.key === 'high'
                        ? regionData.filter(r => r.alertLevel === 'high').length
                        : regionData.filter(r => r.status === 'monitored').length;
                      return count > 0 ? ` (${count})` : '';
                    })()}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative mt-2">
                <input
                  type="text"
                  placeholder="Search waterbodies..."
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowAll(false); }}
                  className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-300"
                />
                {searchQuery && (
                  <div className="text-[10px] text-slate-400 mt-1">{sortedRegions.length} of {regionData.length} waterbodies</div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[480px] overflow-y-auto">
                {sortedRegions.length === 0 ? (
                  <div className="text-sm text-slate-500 py-8 text-center">
                    {searchQuery ? 'No waterbodies match your search.' : 'No waterbodies registered for this state yet.'}
                  </div>
                ) : (
                  <>
                    {displayedRegions.map(r => {
                      const isActive = r.id === activeDetailId;
                      return (
                        <div
                          key={r.id}
                          onClick={() => setActiveDetailId(isActive ? null : r.id)}
                          className={`flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors ${
                            isActive ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className={`truncate text-sm font-medium ${isActive ? 'text-blue-900' : ''}`}>{r.name}</div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {r.status === 'assessed' ? (
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                                  r.alertLevel === 'high' ? 'bg-red-100 text-red-700' :
                                  r.alertLevel === 'medium' ? 'bg-orange-100 text-orange-700' :
                                  r.alertLevel === 'low' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {levelToLabel(r.alertLevel)}
                                </span>
                              ) : r.status === 'monitored' ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-600">
                                  ◐ {r.dataSourceCount} source{r.dataSourceCount !== 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">— Unmonitored</span>
                              )}
                              {r.activeAlerts > 0 && <span>{r.activeAlerts} alert{r.activeAlerts !== 1 ? 's' : ''}</span>}
                              {r.status === 'assessed' && <span className="text-[9px] text-slate-400">EPA ATTAINS</span>}
                            </div>
                          </div>
                          {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mr-1" />}
                        </div>
                      );
                    })}
                    {sortedRegions.length > 15 && !showAll && (
                      <button
                        onClick={() => setShowAll(true)}
                        className="w-full py-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Show all {sortedRegions.length} waterbodies
                      </button>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── WATERBODY DETAIL — student-friendly / teacher-enhanced ── */}
        {(
        <div className="space-y-4">

            {/* No selection state */}
            {!activeDetailId && (
              <Card className="border-2 border-dashed border-slate-300 bg-white/50">
                <div className="py-12 text-center">
                  <MapPin className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <div className="text-base font-medium text-slate-500">Select a waterbody to view details</div>
                  <div className="text-sm text-slate-400 mt-1">Click a marker on the map or a waterbody from the list</div>
                </div>
              </Card>
            )}

            {/* K12 Waterbody Detail — student-friendly with teacher extras */}
            {activeDetailId && (() => {
              const nccRegion = regionData.find(r => r.id === activeDetailId);
              const regionConfig = getRegionById(activeDetailId);
              const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const bulkMatch = resolveBulkAttains(regionName);
              const level = nccRegion?.alertLevel || 'none';
              const attainsData = attainsCache[activeDetailId];
              const causes = attainsData?.causes || bulkMatch?.causes || [];
              const category = attainsData?.category || bulkMatch?.category || '';
              const params = waterData?.parameters ?? {};

              // Health grade
              const gradeScore = level === 'none' ? 95 : level === 'low' ? 80 : level === 'medium' ? 60 : 35;
              const grade = scoreToGrade(gradeScore);
              const gradeEmoji = gradeScore >= 90 ? '🌟' : gradeScore >= 80 ? '😊' : gradeScore >= 70 ? '😐' : gradeScore >= 60 ? '😟' : '😰';

              // Kid-friendly cause labels
              const kidCauseMap: Record<string, { kid: string; icon: string }> = {
                'nutrients': { kid: 'Too much fertilizer washing into the water', icon: '🌱' },
                'nitrogen': { kid: 'Too much fertilizer (nitrogen) in the water', icon: '🌱' },
                'phosphorus': { kid: 'Too much fertilizer (phosphorus) causing green algae', icon: '🧪' },
                'sediment': { kid: 'Too much dirt and mud making the water cloudy', icon: '🪨' },
                'sedimentation': { kid: 'Dirt and sand settling on the bottom and harming habitat', icon: '🪨' },
                'turbidity': { kid: 'Water is too cloudy for fish to see and plants to grow', icon: '🌫️' },
                'dissolved oxygen': { kid: 'Not enough oxygen in the water for fish to breathe', icon: '🫧' },
                'oxygen': { kid: 'Not enough oxygen for fish and crabs', icon: '🫧' },
                'bacteria': { kid: 'Germs in the water that make it unsafe to swim', icon: '🦠' },
                'e. coli': { kid: 'Bacteria from sewage making the water unsafe', icon: '🦠' },
                'fecal coliform': { kid: 'Bacteria from animal waste in the water', icon: '🦠' },
                'temperature': { kid: 'Water is too warm — warm water holds less oxygen', icon: '🌡️' },
                'metals': { kid: 'Metals from old factories or roads washing into the water', icon: '⚙️' },
                'mercury': { kid: 'Mercury pollution that builds up in fish', icon: '⚙️' },
                'pcbs': { kid: 'Chemical pollution from old industrial sites', icon: '🏭' },
                'ph': { kid: 'Water is too acidic or too basic for aquatic life', icon: '⚗️' },
                'chlorophyll-a': { kid: 'Too much algae growing in the water', icon: '🟢' },
                'trash': { kid: 'Litter and trash polluting the water', icon: '🗑️' },
                'oil': { kid: 'Oil and grease from roads and parking lots', icon: '🛢️' },
              };

              const getKidCause = (cause: string) => {
                const lower = cause.toLowerCase();
                for (const [key, val] of Object.entries(kidCauseMap)) {
                  if (lower.includes(key)) return val;
                }
                return { kid: cause, icon: '⚠️' };
              };

              // Wildlife impact based on alert level and causes
              const wildlifeImpacts = (() => {
                const impacts: { animal: string; emoji: string; effect: string }[] = [];
                if (causes.some(c => c.toLowerCase().includes('oxygen') || c.toLowerCase().includes('dissolved'))) {
                  impacts.push({ animal: 'Fish', emoji: '🐟', effect: 'Fish need oxygen to breathe. Low oxygen can cause fish kills.' });
                }
                if (causes.some(c => c.toLowerCase().includes('nutrient') || c.toLowerCase().includes('nitrogen') || c.toLowerCase().includes('phosphor') || c.toLowerCase().includes('chlorophyll'))) {
                  impacts.push({ animal: 'Blue Crabs', emoji: '🦀', effect: 'Algae blooms from too much fertilizer create dead zones where crabs can\'t survive.' });
                }
                if (causes.some(c => c.toLowerCase().includes('sediment') || c.toLowerCase().includes('turbid'))) {
                  impacts.push({ animal: 'Turtles', emoji: '🐢', effect: 'Cloudy water blocks sunlight that underwater grasses need. Turtles eat those grasses!' });
                }
                if (causes.some(c => c.toLowerCase().includes('bacteria') || c.toLowerCase().includes('e. coli') || c.toLowerCase().includes('fecal'))) {
                  impacts.push({ animal: 'Otters', emoji: '🦦', effect: 'Bacteria makes the water unsafe for animals that swim and play in it.' });
                }
                // Default impacts if none matched
                if (impacts.length === 0) {
                  if (level === 'high') {
                    impacts.push({ animal: 'Fish', emoji: '🐟', effect: 'Polluted water makes it hard for fish to survive and reproduce.' });
                    impacts.push({ animal: 'Birds', emoji: '🦅', effect: 'Herons and osprey depend on clean water to catch healthy fish.' });
                  } else if (level === 'medium') {
                    impacts.push({ animal: 'Blue Crabs', emoji: '🦀', effect: 'Water quality affects crabs that live on the bottom.' });
                  } else {
                    impacts.push({ animal: 'Oysters', emoji: '🦪', effect: 'Oysters filter water and help keep it clean — they love healthy water!' });
                  }
                }
                return impacts;
              })();

              // Simple restoration summary
              const restorationSummary = level === 'high'
                ? 'Scientists and engineers are working on cleanup plans. PEARL devices help filter the water using natural oyster and mussel power!'
                : level === 'medium'
                ? 'This waterbody is being monitored closely. Rain gardens and PEARL filters are being considered to help clean it up.'
                : level === 'low'
                ? 'This waterbody is mostly healthy but being watched. Planting trees along the shore and reducing fertilizer use can help.'
                : 'This waterbody is healthy! Keeping it this way means protecting the land around it from pollution.';

              // Waterbody fun facts
              const wbFunFacts = [
                `${regionName} is monitored by real scientists using sensors that take readings every 15 minutes — that's 96 times per day!`,
                `The water in ${regionName} is connected to the ocean through rivers and streams. What happens here affects the whole ecosystem!`,
                `Every rainstorm washes pollutants from roads and lawns into ${regionName}. The first 30 minutes carry the most pollution!`,
                `Oysters can filter up to 50 gallons of water per day — nature's water treatment plant at ${regionName}!`,
              ];
              const wbFactIdx = Math.abs(regionName.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % wbFunFacts.length;

              return (
                <Card className={`border-2 ${level === 'high' ? 'border-red-300' : level === 'medium' ? 'border-amber-300' : level === 'low' ? 'border-yellow-200' : 'border-green-300'} shadow-md`}>
                  <CardContent className="p-5 space-y-4">
                    {/* Header: Name + Grade */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold text-slate-800">{regionName}</div>
                        <div className="text-xs text-slate-500">{stateName} · {nccRegion?.status === 'assessed' ? 'EPA Assessed' : nccRegion?.status === 'monitored' ? 'Monitored' : 'Data Pending'}</div>
                      </div>
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${grade.bg}`}>
                        <span className="text-2xl">{gradeEmoji}</span>
                        <div>
                          <div className={`text-3xl font-black ${grade.color}`}>{grade.letter}</div>
                          <div className="text-[10px] text-slate-500">Health Grade</div>
                        </div>
                      </div>
                    </div>

                    {/* What's wrong? — plain language */}
                    <div className={`rounded-xl p-4 ${level === 'none' ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                      <div className="text-sm font-bold text-slate-800 mb-2">
                        {level === 'none' ? '✅ This water is healthy!' : level === 'low' ? '👀 Keep an eye on this water' : level === 'medium' ? '⚠️ This water needs some help' : '🚨 This water needs serious help'}
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed">
                        {level === 'none'
                          ? `${regionName} is in good shape! The water quality is healthy for fish, crabs, and other wildlife.`
                          : level === 'low'
                          ? `${regionName} has some minor issues. Scientists are watching it to make sure it doesn't get worse.`
                          : level === 'medium'
                          ? `${regionName} has water quality problems that are hurting the animals and plants that live there.`
                          : `${regionName} has serious water quality problems. The water is unsafe for many animals and may not be safe for swimming.`
                        }
                      </div>
                    </div>

                    {/* Pollution causes — kid-friendly labels */}
                    {causes.length > 0 && (
                      <div className="rounded-xl bg-white border border-slate-200 p-4">
                        <div className="text-sm font-bold text-slate-800 mb-3">🔍 What&apos;s causing the problem?</div>
                        <div className="space-y-2">
                          {causes.slice(0, 5).map((cause, i) => {
                            const kidInfo = getKidCause(cause);
                            return (
                              <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-slate-50">
                                <span className="text-xl flex-shrink-0">{kidInfo.icon}</span>
                                <div>
                                  <div className="text-sm font-medium text-slate-800">{kidInfo.kid}</div>
                                  {isTeacher && <div className="text-[10px] text-slate-400 mt-0.5">EPA: {cause}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Why it matters — wildlife impact */}
                    <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-4">
                      <div className="text-sm font-bold text-cyan-900 mb-3">🐾 Why does this matter?</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {wildlifeImpacts.map((wi, i) => (
                          <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-cyan-100">
                            <span className="text-2xl flex-shrink-0">{wi.emoji}</span>
                            <div>
                              <div className="text-xs font-bold text-cyan-800">{wi.animal}</div>
                              <div className="text-xs text-slate-600 leading-relaxed">{wi.effect}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* What's being done? */}
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                      <div className="text-sm font-bold text-emerald-900 mb-2">🛠️ What&apos;s being done to help?</div>
                      <div className="text-sm text-emerald-800 leading-relaxed">{restorationSummary}</div>
                    </div>

                    {/* Fun fact */}
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-3">
                      <span className="text-xl flex-shrink-0">💡</span>
                      <div>
                        <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Fun Fact</div>
                        <div className="text-xs text-amber-900 leading-relaxed">{wbFunFacts[wbFactIdx]}</div>
                      </div>
                    </div>

                    {/* ── TEACHER EXTRAS ── */}
                    {isTeacher && (
                      <div className="space-y-4 pt-2 border-t-2 border-dashed border-purple-200">
                        <div className="text-xs font-bold text-purple-700 uppercase tracking-wider">📚 Teacher Details</div>

                        {/* Actual parameter values */}
                        {Object.keys(params).length > 0 && (
                          <div className="rounded-lg border border-purple-200 bg-white p-3">
                            <div className="text-xs font-bold text-slate-700 mb-2">Water Quality Parameters</div>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {Object.entries(params).map(([key, p]) => (
                                <div key={key} className="rounded bg-slate-50 p-2 text-center">
                                  <div className="text-sm font-bold text-slate-800">
                                    {(p as any).value < 0.01 && (p as any).value > 0 ? (p as any).value.toFixed(3) : (p as any).value < 1 ? (p as any).value.toFixed(2) : (p as any).value.toFixed(1)}
                                  </div>
                                  <div className="text-[10px] text-slate-500">{key} ({(p as any).unit || ''})</div>
                                  {(p as any).source && <div className="text-[9px] text-slate-400">{(p as any).source}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Impairment causes — proper names */}
                        {causes.length > 0 && (
                          <div className="rounded-lg border border-purple-200 bg-white p-3">
                            <div className="text-xs font-bold text-slate-700 mb-2">EPA Impairment Causes</div>
                            <div className="flex flex-wrap gap-1.5">
                              {causes.map((c, i) => (
                                <span key={i} className="px-2 py-1 rounded-full text-[10px] font-medium bg-orange-100 text-orange-800 border border-orange-200">{c}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Assessment category — explained */}
                        {category && (
                          <div className="rounded-lg border border-purple-200 bg-white p-3">
                            <div className="text-xs font-bold text-slate-700 mb-1">EPA Assessment Category</div>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-bold px-2 py-1 rounded ${
                                category.includes('5') ? 'bg-red-100 text-red-800' :
                                category.includes('4') ? 'bg-orange-100 text-orange-800' :
                                category.includes('3') ? 'bg-yellow-100 text-yellow-800' :
                                category.includes('2') ? 'bg-green-100 text-green-800' :
                                'bg-slate-100 text-slate-800'
                              }`}>Category {category}</span>
                              <span className="text-xs text-slate-600">
                                {category.includes('5') ? '= Needs a cleanup plan (TMDL required)' :
                                 category.includes('4a') ? '= Has a cleanup plan in place (TMDL completed)' :
                                 category.includes('4b') ? '= Being cleaned up through other programs' :
                                 category.includes('4c') ? '= Impaired but not by a pollutant' :
                                 category.includes('3') ? '= Not enough data to decide yet' :
                                 category.includes('2') ? '= Meeting water quality standards' :
                                 category.includes('1') ? '= All uses supported, water is healthy' :
                                 ''}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Data sources — simple list */}
                        <div className="rounded-lg border border-purple-200 bg-white p-3">
                          <div className="text-xs font-bold text-slate-700 mb-1">Data Sources</div>
                          <div className="flex flex-wrap gap-1.5">
                            {['EPA ATTAINS', 'USGS NWIS', 'Water Quality Portal', hasRealData ? 'Live Sensors' : null].filter(Boolean).map((src, i) => (
                              <span key={i} className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-200">{src}</span>
                            ))}
                          </div>
                        </div>

                        {/* Curriculum connections */}
                        <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                          <div className="text-xs font-bold text-purple-800 mb-2">🎯 Curriculum Connections</div>
                          <div className="space-y-1.5 text-xs text-purple-700">
                            <div>• <strong>NGSS ESS3.C:</strong> Human Impacts on Earth Systems — How human activity affects water quality at {regionName}</div>
                            <div>• <strong>NGSS LS2.C:</strong> Ecosystem Dynamics — How pollution disrupts food webs and habitats</div>
                            {causes.some(c => c.toLowerCase().includes('nutrient') || c.toLowerCase().includes('nitrogen')) && (
                              <div>• <strong>NGSS LS2.B:</strong> Cycles of Matter — Nitrogen and phosphorus cycles, eutrophication</div>
                            )}
                            <div>• <strong>NGSS ETS1.B:</strong> Developing Solutions — Engineering approaches to water quality (PEARL biofiltration)</div>
                            <div>• <strong>Common Core Math:</strong> Data analysis using real water quality measurements, graphing trends</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Restoration plan not shown in K12 mode */}
            {activeDetailId && false && (() => {
              const nccRegion = regionData.find(r => r.id === activeDetailId);
              const regionConfig = getRegionById(activeDetailId);
              const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const level = nccRegion?.alertLevel || 'none';
              const params = waterData?.parameters ?? {};

              const bulkMatch = resolveBulkAttains(regionName);
              const attainsCategory = resolveAttainsCategory(
                attainsCache[activeDetailId]?.category || '',
                bulkMatch?.category || '',
                level as any,
              );
              const attainsCauses = mergeAttainsCauses(
                attainsCache[activeDetailId]?.causes || [],
                bulkMatch?.causes || [],
              );
              const attainsCycle = attainsCache[activeDetailId]?.cycle || bulkMatch?.cycle || '';

              const plan = computeRestorationPlan({
                regionName, stateAbbr,
                alertLevel: level as any, params,
                attainsCategory, attainsCauses,
                attainsCycle,
                attainsAcres: null,
              });

              if (plan.isHealthy) {
                return (
                  <Card className="border-2 border-green-300 shadow-md">
                    <div className="px-4 py-4 flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <div className="text-sm font-semibold text-green-800">{regionName} — No Restoration Action Indicated</div>
                        <div className="text-xs text-green-600 mt-0.5">Currently attaining designated uses with no Category 4/5 impairments or parameter exceedances detected.</div>
                      </div>
                    </div>
                  </Card>
                );
              }

              const {
                waterType, isCat5, isImpaired, tmdlStatus,
                siteSeverityScore, siteSeverityLabel, siteSeverityColor,
                pearlModel, totalUnits, totalQuads, fullGPM, fullAnnualCost, totalBMPs,
                compliancePathway, addressabilityPct, pearlAddressable, totalClassified,
                categories, whyBullets, impairmentClassification, treatmentPriorities,
                isPhasedDeployment, phase1Units, phase1Quads, phase1GPM, phase1AnnualCost,
                sizingBasis,
                // Severity fields for exec summary + roadmap
                doSeverity, bloomSeverity, turbiditySeverity, nutrientSeverity,
                doVal, chlVal, turbVal, tnVal, tpVal,
                isMD, thresholdSource, thresholdSourceShort,
                doCritical, doStressed, chlBloom, chlSignificant, chlSevere, turbElevated, turbImpaired,
                hasNutrients, hasBacteria, hasSediment, hasMetals,
                dataAgeDays, dataConfidence,
                estimatedAcres, acresSource, threats,
              } = plan;
              const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

              return (
                <Card className="border-2 border-cyan-300 shadow-md">
                  {/* Collapsed summary header — always visible, click to expand */}
                  <button
                    onClick={() => setShowRestorationCard(prev => !prev)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-cyan-50/50 transition-colors rounded-t-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">🔧</span>
                      <div className="text-left">
                        <div className="text-sm font-semibold text-cyan-800 flex items-center gap-2">
                          Restoration Plan — {regionName}
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${siteSeverityColor}`}>
                            {siteSeverityLabel} ({siteSeverityScore})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {pearlModel} × {totalUnits} unit{totalUnits > 1 ? 's' : ''} ({totalQuads} quad{totalQuads > 1 ? 's' : ''}, {fullGPM} GPM) + {totalBMPs} BMPs · {waterType === 'brackish' ? '🦪 Oyster' : '🐚 Mussel'} Biofilt · {fmt(fullAnnualCost)}/yr
                        </div>
                        {(attainsCategory || isCat5) && (
                          <div className="text-[10px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span className={`font-bold px-1.5 py-0.5 rounded ${
                              isCat5 ? 'bg-red-100 text-red-700' :
                              attainsCategory.includes('4') ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              Cat {isCat5 ? '5' : attainsCategory}{tmdlStatus === 'needed' ? ' — No TMDL' : tmdlStatus === 'completed' ? ' — TMDL in place' : tmdlStatus === 'alternative' ? ' — Alt. controls' : ''}
                            </span>
                            {attainsCauses.length > 0 && (
                              <span className="text-slate-500">
                                Listed for: <span className="font-medium text-slate-700">{attainsCauses.join(', ')}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-[9px]">
                        {categories.reduce((n, c) => n + c.modules.filter(m => m.status === 'warranted').length, 0) > 0 && (
                          <span className="bg-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded-full">
                            {categories.reduce((n, c) => n + c.modules.filter(m => m.status === 'warranted').length, 0)} warranted
                          </span>
                        )}
                        <span className="bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">{totalBMPs} recommended</span>
                        {totalClassified > 0 && (
                          <span className={`font-bold px-1.5 py-0.5 rounded-full ${
                            addressabilityPct >= 80 ? 'bg-green-200 text-green-800' :
                            addressabilityPct >= 50 ? 'bg-amber-200 text-amber-800' :
                            'bg-slate-200 text-slate-700'
                          }`}>
                            {pearlAddressable}/{totalClassified} addressable
                          </span>
                        )}
                      </div>
                      <ChevronDown size={16} className={`text-cyan-600 transition-transform ${showRestorationCard ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {/* Expanded content */}
                  {showRestorationCard && (
                    <CardContent className="pt-0 pb-4 space-y-4">

                      {/* ═══ EXECUTIVE SUMMARY ═══ */}
                      <div className="rounded-lg border-2 border-slate-300 bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">Executive Summary</div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${siteSeverityColor}`}>
                            Site Severity: {siteSeverityLabel} ({siteSeverityScore}/100)
                          </span>
                        </div>
                        {/* Parameter assessment grid */}
                        <div className="rounded-md bg-slate-50 border border-slate-200 p-3 space-y-2">
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isMD ? 'MD DNR Threshold' : 'EPA Criteria'} Assessment</div>
                          <div className="grid grid-cols-5 gap-1.5 text-[10px]">
                            <div className="text-center">
                              <div className={`font-bold ${doSeverity === 'critical' ? 'text-red-700' : doSeverity === 'stressed' ? 'text-amber-600' : doSeverity === 'adequate' ? 'text-green-600' : 'text-slate-400'}`}>
                                {doSeverity === 'unknown' ? '?' : doVal?.toFixed(1)} mg/L
                              </div>
                              <div className="text-slate-500">DO</div>
                              <div className={`text-[9px] font-medium ${doSeverity === 'critical' ? 'text-red-600' : doSeverity === 'stressed' ? 'text-amber-600' : 'text-green-600'}`}>
                                {doSeverity !== 'unknown' ? doSeverity : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${bloomSeverity === 'severe' || bloomSeverity === 'significant' ? 'text-red-700' : bloomSeverity === 'bloom' ? 'text-amber-600' : bloomSeverity === 'normal' ? 'text-green-600' : 'text-slate-400'}`}>
                                {bloomSeverity === 'unknown' ? '?' : chlVal} ug/L
                              </div>
                              <div className="text-slate-500">Chl-a</div>
                              <div className={`text-[9px] font-medium ${bloomSeverity === 'severe' ? 'text-red-600' : bloomSeverity === 'significant' ? 'text-orange-600' : bloomSeverity === 'bloom' ? 'text-amber-600' : 'text-green-600'}`}>
                                {bloomSeverity !== 'unknown' ? bloomSeverity : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${turbiditySeverity === 'impaired' ? 'text-red-700' : turbiditySeverity === 'elevated' ? 'text-amber-600' : turbiditySeverity === 'clear' ? 'text-green-600' : 'text-slate-400'}`}>
                                {turbiditySeverity === 'unknown' ? '?' : turbVal?.toFixed(1)} FNU
                              </div>
                              <div className="text-slate-500">Turbidity</div>
                              <div className={`text-[9px] font-medium ${turbiditySeverity === 'impaired' ? 'text-red-600' : turbiditySeverity === 'elevated' ? 'text-amber-600' : 'text-green-600'}`}>
                                {turbiditySeverity !== 'unknown' ? (turbiditySeverity === 'clear' ? 'ok' : turbiditySeverity) : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`font-bold ${nutrientSeverity === 'excessive' ? 'text-red-700' : nutrientSeverity === 'elevated' ? 'text-amber-600' : nutrientSeverity === 'normal' ? 'text-green-600' : 'text-slate-400'}`}>
                                {nutrientSeverity === 'unknown' ? '?' : `TN ${tnVal?.toFixed(1) ?? '?'}`}
                              </div>
                              <div className="text-slate-500">Nutrients</div>
                              <div className={`text-[9px] font-medium ${nutrientSeverity === 'excessive' ? 'text-red-600' : nutrientSeverity === 'elevated' ? 'text-amber-600' : 'text-green-600'}`}>
                                {nutrientSeverity !== 'unknown' ? nutrientSeverity : 'no data'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="font-bold text-slate-700">{attainsCategory || '?'}</div>
                              <div className="text-slate-500">ATTAINS</div>
                              <div className={`text-[9px] font-medium ${isCat5 ? 'text-red-600' : isImpaired ? 'text-amber-600' : 'text-green-600'}`}>
                                {tmdlStatus === 'needed' ? 'no TMDL' : tmdlStatus === 'completed' ? 'has TMDL' : tmdlStatus}
                              </div>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                            <div className={`h-2 rounded-full transition-all ${siteSeverityScore >= 75 ? 'bg-red-500' : siteSeverityScore >= 50 ? 'bg-amber-500' : siteSeverityScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, siteSeverityScore)}%` }} />
                          </div>
                          <div className="text-[9px] text-slate-400">Composite: DO (25%) + Bloom/Nutrients (25%) + Turbidity (15%) + Impairment (20%) + Monitoring Gap (15%) | Thresholds: {thresholdSource}</div>
                        </div>
                        {/* Situation + Treatment Priorities */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Situation</div>
                            <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
                              <div><span className="font-semibold">{regionName}</span> is {isCat5 ? 'Category 5 impaired' : attainsCategory.includes('4') ? 'Category 4 impaired' : isImpaired ? 'impaired' : 'under monitoring'}{attainsCauses.length > 0 ? ` for ${attainsCauses.join(', ').toLowerCase()}` : ''}.</div>
                              {dataAgeDays !== null && <div>Most recent data is <span className="font-semibold">{dataAgeDays} days old</span>. Confidence is <span className={`font-semibold ${dataConfidence === 'low' ? 'text-red-600' : dataConfidence === 'moderate' ? 'text-amber-600' : 'text-green-600'}`}>{dataConfidence}</span>.</div>}
                              <div>{tmdlStatus === 'needed' ? 'No approved TMDL is in place.' : tmdlStatus === 'completed' ? 'An approved TMDL exists.' : tmdlStatus === 'alternative' ? 'Alternative controls are in place.' : 'TMDL status is not applicable.'}</div>
                            </div>
                          </div>
                          <div className="rounded-md bg-red-50 border border-red-200 p-3">
                            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1.5">Treatment Priorities</div>
                            <div className="space-y-1 text-xs text-red-800 leading-relaxed">
                              {treatmentPriorities.length > 0 ? treatmentPriorities.slice(0, 3).map((tp: any, i: number) => (
                                <div key={i} className="flex items-start gap-1">
                                  <span className={`flex-shrink-0 font-bold ${tp.urgency === 'immediate' ? 'text-red-700' : tp.urgency === 'high' ? 'text-amber-700' : 'text-yellow-700'}`}>
                                    {tp.urgency === 'immediate' ? '!!!' : tp.urgency === 'high' ? '!!' : '!'}
                                  </span>
                                  <span>{tp.driver}</span>
                                </div>
                              )) : (
                                <>
                                  {isImpaired && <div>Regulatory exposure under CWA 303(d) and MS4 permits.</div>}
                                  {(dataAgeDays === null || dataAgeDays > 60) && <div>High uncertainty due to monitoring gaps.</div>}
                                  {!isImpaired && <div>Preventive action recommended to maintain water quality.</div>}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Why PEARL */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Why PEARL at {regionName}</div>
                        {whyBullets.map((b, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="flex-shrink-0 mt-0.5">{b.icon}</span>
                            <div>
                              <span className="text-red-700 font-medium">{b.problem}</span>
                              <span className="text-slate-400 mx-1">→</span>
                              <span className="text-green-700">{b.solution}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Impairment classification */}
                      {impairmentClassification.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Impairment Classification ({impairmentClassification.length} causes · {addressabilityPct}% PEARL-addressable)
                          </div>
                          <div className="grid gap-1">
                            {impairmentClassification.map((imp, i) => (
                              <div key={i} className="flex items-start gap-2 text-xs bg-white rounded border border-slate-100 px-2.5 py-1.5">
                                <span className="flex-shrink-0">{imp.icon}</span>
                                <div className="flex-1">
                                  <span className="font-medium text-slate-800">{imp.cause}</span>
                                  <span className="mx-1.5 text-slate-300">|</span>
                                  <span className={`text-[10px] font-semibold ${imp.tier === 1 ? 'text-green-700' : imp.tier === 2 ? 'text-amber-700' : 'text-slate-500'}`}>
                                    {imp.tierLabel}
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-500 max-w-[40%] text-right">{imp.pearlAction}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Categories summary */}
                      <div className="space-y-2">
                        {categories.map(cat => (
                          <div key={cat.id} className={`rounded-lg border p-2.5 ${cat.color}`}>
                            <div className="text-xs font-semibold flex items-center gap-1.5">
                              <span>{cat.icon}</span> {cat.title}
                              <span className="text-[10px] font-normal text-slate-500 ml-auto">{cat.modules.length} modules</span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">{cat.subtitle}</div>
                          </div>
                        ))}
                      </div>

                      {/* Sizing & cost summary */}
                      <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-3">
                        <div className="text-xs font-semibold text-cyan-800 uppercase tracking-wide mb-2">Deployment Summary</div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <div className="text-lg font-bold text-cyan-800">{totalQuads}Q / {totalUnits}</div>
                            <div className="text-[10px] text-cyan-600">Quads / Units</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-cyan-800">{fullGPM}</div>
                            <div className="text-[10px] text-cyan-600">GPM Capacity</div>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-cyan-800">{fmt(fullAnnualCost)}</div>
                            <div className="text-[10px] text-cyan-600">Annual Cost</div>
                          </div>
                        </div>
                        {isPhasedDeployment && (
                          <div className="text-[11px] text-cyan-700 mt-2 text-center">
                            Phase 1: {phase1Units} units ({phase1GPM} GPM) · {fmt(phase1AnnualCost)}/yr
                          </div>
                        )}
                      </div>

                      {/* ═══ DEPLOYMENT ROADMAP — Phase 1-3 ═══ */}
                      {isPhasedDeployment && (() => {
                        type PhaseInfo = { phase: string; quads: number; units: number; gpm: number; cost: number; mission: string; placement: string; why: string; trigger: string; color: string; bgColor: string };
                        const phases: PhaseInfo[] = [];
                        const hasMonitoringGap = dataAgeDays === null || dataAgeDays > 365;
                        const monitoringNote = hasMonitoringGap
                          ? `+ Monitoring continuity & verification (restores data record lost for ${dataAgeDays !== null ? Math.round(dataAgeDays / 365) + '+ year' + (Math.round(dataAgeDays / 365) > 1 ? 's' : '') : 'an extended period'})`
                          : '+ Continuous monitoring, compliance-grade data & treatment verification';

                        // Phase 1
                        const p1Mission = (hasNutrients || (bloomSeverity !== 'normal' && bloomSeverity !== 'unknown'))
                          ? 'Primary Nutrient Interception'
                          : hasBacteria ? 'Primary Pathogen Treatment'
                          : hasSediment ? 'Primary Sediment Capture'
                          : 'Primary Treatment & Monitoring';
                        const p1Placement = (hasNutrients || (bloomSeverity !== 'normal' && bloomSeverity !== 'unknown'))
                          ? '#1 critical zone: Highest-load tributary confluence -- intercept nutrient and sediment loading at the dominant inflow'
                          : hasBacteria ? '#1 critical zone: Highest-volume discharge point -- treat pathogen loading at the primary outfall'
                          : hasSediment ? '#1 critical zone: Primary tributary mouth -- capture suspended solids at the highest-load inflow'
                          : '#1 critical zone: Highest-priority inflow -- treat and monitor at the most impacted location';
                        const p1Why = (bloomSeverity !== 'normal' && bloomSeverity !== 'unknown')
                          ? `Chlorophyll at ${chlVal} ug/L confirms active bloom cycle. #1 priority -- intercept nutrients at the dominant source. ${monitoringNote}.`
                          : hasNutrients ? `ATTAINS lists nutrient impairment. #1 priority: treat the primary urban watershed inflow. ${monitoringNote}.`
                          : hasBacteria ? `Bacteria exceeds recreational standards. #1 priority: treat at highest-volume discharge. ${monitoringNote}.`
                          : hasSediment ? `Turbidity at ${turbVal?.toFixed(1) ?? '?'} FNU. #1 priority: capture sediment at the dominant tributary. ${monitoringNote}.`
                          : `#1 priority treatment zone. ${monitoringNote}.`;
                        phases.push({
                          phase: 'Phase 1', quads: phase1Quads, units: phase1Units, gpm: phase1GPM,
                          cost: phase1AnnualCost, mission: p1Mission, placement: p1Placement, why: p1Why,
                          trigger: 'Immediate -- deploy within 30 days of site assessment',
                          color: 'border-cyan-400 text-cyan-900', bgColor: 'bg-cyan-50',
                        });

                        // Phase 2
                        if (totalQuads >= 2) {
                          const p2Quads = totalQuads === 2 ? (totalQuads - phase1Quads) : 1;
                          const p2Units = p2Quads * 4;
                          const p2Mission = (hasSediment || turbiditySeverity !== 'clear')
                            ? 'Secondary Outfall Treatment'
                            : (hasNutrients || bloomSeverity !== 'normal') ? 'Secondary Nutrient Treatment'
                            : hasBacteria ? 'Secondary Source Treatment'
                            : 'Secondary Zone Treatment';
                          const p2Placement = waterType === 'brackish'
                            ? '#2 critical zone: MS4 outfall cluster along shoreline -- treat stormwater from adjacent subwatersheds'
                            : '#2 critical zone: Secondary tributary or stormwater outfall cluster -- capture additional loading';
                          const p2Why = (turbiditySeverity !== 'clear' && turbiditySeverity !== 'unknown')
                            ? `Turbidity at ${turbVal?.toFixed(1)} FNU indicates sediment loading from multiple sources. Phase 2 treats the next-highest loading zone. ${monitoringNote}.`
                            : hasNutrients && (bloomSeverity !== 'normal')
                            ? `Bloom conditions persist beyond the primary inflow. Phase 2 treats the #2 nutrient loading zone. ${monitoringNote}.`
                            : attainsCauses.length >= 3
                            ? `${attainsCauses.length} impairment causes indicate multiple pollution sources. Phase 2 addresses the #2 priority loading pathway. ${monitoringNote}.`
                            : `Phase 1 data identifies the second-highest treatment priority. ${monitoringNote}.`;
                          phases.push({
                            phase: 'Phase 2', quads: p2Quads, units: p2Units, gpm: p2Units * 50,
                            cost: p2Units * COST_PER_UNIT_YEAR, mission: p2Mission, placement: p2Placement, why: p2Why,
                            trigger: 'After 90 days -- Phase 1 data confirms #2 priority zone and optimal placement',
                            color: 'border-blue-300 text-blue-900', bgColor: 'bg-blue-50',
                          });
                        }

                        // Phase 3
                        if (totalQuads >= 3) {
                          const remainQuads = totalQuads - phase1Quads - (totalQuads === 2 ? totalQuads - phase1Quads : 1);
                          const remainUnits = remainQuads * 4;
                          if (remainQuads > 0) {
                            const p3Mission = waterType === 'brackish'
                              ? (hasBacteria ? 'Tertiary Outfall Treatment' : 'Tertiary Zone Treatment')
                              : 'Tertiary Zone Treatment';
                            const p3Placement = waterType === 'brackish'
                              ? '#3 critical zone: Remaining outfall cluster or CSO discharge -- treat loading from the third-highest contributing subwatershed'
                              : '#3 critical zone: Tertiary inflow or accumulation point -- extend treatment coverage to remaining untreated loading area';
                            const p3Why = attainsCauses.length >= 3
                              ? `${attainsCauses.length} documented impairment causes require treatment across multiple zones. Phase 3 extends to the #3 priority zone -- ${totalUnits} total units, ${fullGPM} GPM. ${monitoringNote}.`
                              : `Phase 3 extends treatment to the third-highest loading zone. Full ${totalQuads}-quad deployment ensures coverage across all major pollution sources. ${monitoringNote}.`;
                            phases.push({
                              phase: totalQuads > 3 ? `Phase 3 (${remainQuads}Q)` : 'Phase 3', quads: remainQuads, units: remainUnits, gpm: remainUnits * 50,
                              cost: remainUnits * COST_PER_UNIT_YEAR, mission: p3Mission, placement: p3Placement, why: p3Why,
                              trigger: 'After 180 days -- Phase 1+2 data identifies #3 priority zone and confirms full-build need',
                              color: 'border-indigo-300 text-indigo-900', bgColor: 'bg-indigo-50',
                            });
                          }
                        }

                        return (
                          <div className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
                            <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Deployment Roadmap -- Path to {totalQuads} Quads ({totalUnits} Units)</div>
                            <div className="space-y-2">
                              {phases.map((p, i) => (
                                <div key={i} className={`rounded-md border-2 ${p.color} ${p.bgColor} p-2.5`}>
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${i === 0 ? 'bg-cyan-700 text-white' : i === 1 ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'}`}>
                                        {p.phase}
                                      </span>
                                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">{p.mission}</span>
                                    </div>
                                    <span className="text-xs font-bold">{p.quads} quad{p.quads > 1 ? 's' : ''} ({p.units}U, {p.gpm} GPM) -- {fmt(p.cost)}/yr</span>
                                  </div>
                                  <div className="text-[11px] leading-relaxed">
                                    <span className="font-semibold">Placement:</span> {p.placement}
                                  </div>
                                  <div className="text-[11px] leading-relaxed mt-1">
                                    <span className="font-semibold">Justification:</span> {p.why}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1">
                                    <span className="font-medium">Trigger:</span> {p.trigger}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* ═══ 3 ACTION BUTTONS — matches NCC ═══ */}
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            const subject = encodeURIComponent(`PEARL Pilot Deployment Request — ${regionName}, ${stateAbbr}`);
                            const body = encodeURIComponent(
                              `PEARL Pilot Deployment Request\n` +
                              `${'='.repeat(40)}\n\n` +
                              `Site: ${regionName}\n` +
                              `State: ${stateName}\n` +
                              `Site Severity: ${siteSeverityLabel} (${siteSeverityScore}/100)\n` +
                              `EPA Category: ${attainsCategory || 'N/A'}\n` +
                              `Impairment Causes: ${attainsCauses.join(', ') || 'N/A'}\n` +
                              `TMDL Status: ${tmdlStatus === 'needed' ? 'Needed — not established' : tmdlStatus === 'completed' ? 'Approved' : tmdlStatus === 'alternative' ? 'Alternative controls' : 'N/A'}\n` +
                              `Recommended Config: ${pearlModel} (${waterType === 'brackish' ? 'Oyster' : 'Mussel'} Biofiltration)\n` +
                              `Deployment: ${totalQuads} quad${totalQuads > 1 ? 's' : ''} (${totalUnits} units, ${fullGPM} GPM)${isPhasedDeployment ? `\nPhase 1: ${phase1Quads} quad${phase1Quads > 1 ? 's' : ''} (${phase1Units} units, ${phase1GPM} GPM)` : ''}\n` +
                              `Estimated Annual Cost: $${fullAnnualCost.toLocaleString()}${isPhasedDeployment ? ` (Phase 1: $${phase1AnnualCost.toLocaleString()}/yr)` : '/yr'}\n` +
                              `Sizing Basis: ${sizingBasis}\n` +
                              `Compliance Pathway: ${compliancePathway}\n\n` +
                              `Requesting organization: \n` +
                              `Contact name: \n` +
                              `Contact email: \n` +
                              `Preferred timeline: \n` +
                              `Additional notes: \n`
                            );
                            window.open(`mailto:info@project-pearl.org?subject=${subject}&body=${body}`, '_blank');
                          }}
                          className="flex-1 min-w-[140px] bg-cyan-700 hover:bg-cyan-800 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition-colors shadow-sm"
                        >
                          🚀 Deploy PEARL Pilot Here
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const pdf = new BrandedPDFGenerator('portrait');
                              await pdf.loadLogo();
                              pdf.initialize();

                              // Sanitize text for jsPDF (no emoji, no extended unicode)
                              const clean = (s: string) => s
                                .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
                                .replace(/[\u{2600}-\u{27BF}]/gu, '')
                                .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
                                .replace(/[\u{200D}]/gu, '')
                                .replace(/[\u{E0020}-\u{E007F}]/gu, '')
                                .replace(/\u00B5/g, 'u').replace(/\u03BC/g, 'u')
                                .replace(/\u2192/g, '->').replace(/\u2190/g, '<-')
                                .replace(/\u2014/g, '--').replace(/\u2013/g, '-')
                                .replace(/\u00A7/g, 'Section ').replace(/\u2022/g, '-')
                                .replace(/\u00B0/g, ' deg')
                                .replace(/\u2019/g, "'").replace(/\u2018/g, "'")
                                .replace(/\u201C/g, '"').replace(/\u201D/g, '"')
                                .replace(/[^\x00-\x7F]/g, '')
                                .replace(/\s+/g, ' ').trim();

                              const catTitleMap: Record<string, string> = {
                                source: 'SOURCE CONTROL -- Upstream BMPs',
                                nature: 'NATURE-BASED SOLUTIONS',
                                pearl: 'PEARL -- Treatment Accelerator',
                                community: 'COMMUNITY ENGAGEMENT & STEWARDSHIP',
                                regulatory: 'REGULATORY & PLANNING',
                              };

                              // ─── Title ───
                              pdf.addTitle('PEARL Deployment Plan');
                              pdf.addText(clean(`${regionName}, ${stateName}`), { bold: true, fontSize: 12 });
                              pdf.addText(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { fontSize: 9 });
                              pdf.addSpacer(5);

                              // ─── Executive Summary ───
                              pdf.addSubtitle('Executive Summary');
                              pdf.addDivider();

                              pdf.addText(`SITE SEVERITY: ${siteSeverityLabel} (${siteSeverityScore}/100)`, { bold: true });
                              pdf.addText(clean(`Assessment based on ${thresholdSource}: DO (${doSeverity}), Bloom/Nutrients (${bloomSeverity !== 'unknown' ? bloomSeverity : nutrientSeverity}), Turbidity (${turbiditySeverity}), Impairment (${attainsCategory || 'N/A'}).`), { indent: 5, fontSize: 9 });
                              pdf.addSpacer(3);

                              pdf.addText('SITUATION', { bold: true });
                              pdf.addText(clean(`${regionName} is ${isCat5 ? 'Category 5 impaired' : attainsCategory.includes('4') ? 'Category 4 impaired' : isImpaired ? 'impaired' : 'under monitoring'}${attainsCauses.length > 0 ? ` for ${attainsCauses.slice(0, 3).join(', ').toLowerCase()}` : ''}.`), { indent: 5 });
                              if (dataAgeDays !== null) pdf.addText(clean(`Most recent data is ${dataAgeDays} days old. Confidence: ${dataAgeDays > 90 ? 'LOW' : dataAgeDays > 30 ? 'MODERATE' : 'HIGH'}.`), { indent: 5 });
                              pdf.addText(clean(`TMDL Status: ${tmdlStatus === 'needed' ? 'No approved TMDL in place' : tmdlStatus === 'completed' ? 'Approved TMDL exists' : tmdlStatus === 'alternative' ? 'Alternative controls in place' : 'Not applicable'}.`), { indent: 5 });
                              pdf.addSpacer(3);

                              pdf.addText('TREATMENT PRIORITIES', { bold: true });
                              if (treatmentPriorities.length > 0) {
                                for (const tp of treatmentPriorities.slice(0, 4)) {
                                  pdf.addText(clean(`- [${(tp as any).urgency.toUpperCase()}] ${(tp as any).driver}`), { indent: 5 });
                                  pdf.addText(clean(`  -> ${(tp as any).action}`), { indent: 10, fontSize: 9 });
                                }
                              } else {
                                if (hasBacteria) pdf.addText('- Ongoing public health risk from pathogens.', { indent: 5 });
                                if (hasNutrients) pdf.addText('- Eutrophication risk from nutrient loading.', { indent: 5 });
                                if (isImpaired) pdf.addText('- Regulatory exposure under CWA Section 303(d) and MS4 permits.', { indent: 5 });
                                if (dataAgeDays === null || dataAgeDays > 60) pdf.addText('- High uncertainty due to monitoring gaps.', { indent: 5 });
                              }
                              pdf.addSpacer(3);

                              pdf.addText('RECOMMENDED ACTION', { bold: true });
                              pdf.addText(clean(`Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} unit${phase1Units > 1 ? 's' : ''}, ${phase1GPM} GPM)` : `${totalUnits} PEARL unit${totalUnits > 1 ? 's' : ''}`} at ${regionName} and begin continuous monitoring within 30 days.`), { indent: 5, bold: true });
                              pdf.addText('Typical deployment: 30-60 days. Pilot generates continuous data and measurable reductions within the first operating cycle.', { indent: 5, fontSize: 9 });
                              pdf.addSpacer(5);

                              // ─── Site Profile ───
                              pdf.addSubtitle('Site Profile');
                              pdf.addDivider();
                              pdf.addTable(
                                ['Attribute', 'Value'],
                                [
                                  ['Waterbody', clean(regionName)],
                                  ['State', stateName],
                                  ['Water Type', waterType === 'brackish' ? 'Brackish / Estuarine' : 'Freshwater'],
                                  ['Site Severity', `${siteSeverityLabel} (${siteSeverityScore}/100)`],
                                  ['EPA IR Category', attainsCategory || 'Not assessed'],
                                  ['Impairment Causes', clean(attainsCauses.join(', ')) || 'None listed'],
                                  ['TMDL Status', tmdlStatus === 'needed' ? 'Needed -- not established' : tmdlStatus === 'completed' ? 'Approved' : tmdlStatus === 'alternative' ? 'Alternative controls' : 'N/A'],
                                  ['Compliance Pathway', clean(compliancePathway)],
                                  ['Data Age', dataAgeDays !== null ? `${dataAgeDays} days` : 'Unknown'],
                                  ['Waterbody Size', `~${estimatedAcres} acres (${acresSource})`],
                                  ['DO Status', `${doSeverity !== 'unknown' ? `${doVal?.toFixed(1)} mg/L (${doSeverity})` : 'No data'}`],
                                  ['Bloom Status', `${bloomSeverity !== 'unknown' ? `${chlVal} ug/L (${bloomSeverity})` : nutrientSeverity !== 'unknown' ? `Nutrients: ${nutrientSeverity}` : 'No data'}`],
                                  ['Turbidity Status', `${turbiditySeverity !== 'unknown' ? `${turbVal?.toFixed(1)} FNU (${turbiditySeverity})` : 'No data'}`],
                                ],
                                [55, 115]
                              );
                              pdf.addSpacer(3);

                              // ─── Current Water Quality Parameters ───
                              const paramKeys = Object.keys(params);
                              if (paramKeys.length > 0) {
                                pdf.addSubtitle('Current Water Quality Parameters');
                                pdf.addDivider();
                                const paramRows = paramKeys.map(key => {
                                  const p = params[key];
                                  const val = p.value < 0.01 && p.value > 0 ? p.value.toFixed(3) : p.value < 1 ? p.value.toFixed(2) : p.value < 100 ? p.value.toFixed(1) : Math.round(p.value).toLocaleString();
                                  return [
                                    key,
                                    clean(`${val} ${p.unit || ''}`),
                                    p.source || '',
                                    p.lastSampled ? new Date(p.lastSampled).toLocaleDateString() : 'N/A',
                                  ];
                                });
                                pdf.addTable(['Parameter', 'Value', 'Source', 'Last Sampled'], paramRows, [40, 45, 35, 50]);
                                pdf.addSpacer(3);
                              }

                              // ─── Why PEARL ───
                              pdf.addSubtitle('Why PEARL at This Site');
                              pdf.addDivider();
                              for (const b of whyBullets) {
                                pdf.addText(clean(`- ${b.problem}`), { indent: 5, bold: true });
                                pdf.addText(clean(`  -> ${b.solution}.`), { indent: 10 });
                              }
                              pdf.addSpacer(3);

                              // ─── PEARL Configuration ───
                              pdf.addSubtitle(`PEARL Configuration: ${pearlModel}`);
                              pdf.addDivider();
                              pdf.addText(`System Type: ${waterType === 'brackish' ? 'Oyster (C. virginica)' : 'Freshwater Mussel'} Biofiltration`, { indent: 5 });
                              const pearlCatMods = categories.find(c => c.id === 'pearl');
                              if (pearlCatMods) {
                                const modRows = pearlCatMods.modules
                                  .filter((m: any) => m.status !== 'co-benefit')
                                  .map((m: any) => [clean(m.label), m.status.toUpperCase(), clean(m.detail)]);
                                pdf.addTable(['Module', 'Status', 'Detail'], modRows, [50, 25, 95]);
                              }
                              pdf.addSpacer(3);

                              // ─── Deployment Sizing & Cost ───
                              pdf.addSubtitle('Deployment Sizing & Cost Estimate');
                              pdf.addDivider();
                              pdf.addTable(
                                ['Metric', 'Value'],
                                [
                                  ['Sizing Method', 'Severity-driven treatment need assessment'],
                                  ['Site Severity Score', `${siteSeverityScore}/100 (${siteSeverityLabel})`],
                                  ['Unit Capacity', '50 GPM per PEARL unit (4 units per quad)'],
                                  ['Waterbody Size', `~${estimatedAcres} acres (${acresSource})`],
                                  ['Deployment Size', `${totalQuads} quad${totalQuads > 1 ? 's' : ''} (${totalUnits} units, ${fullGPM} GPM)`],
                                  ...(isPhasedDeployment ? [
                                    ['Phase 1', `${phase1Quads} quad${phase1Quads > 1 ? 's' : ''} (${phase1Units} units, ${phase1GPM} GPM)`],
                                    ['Phase 1 Annual Cost', `$${phase1AnnualCost.toLocaleString()}/yr`],
                                    ['Full Build Annual Cost', `$${fullAnnualCost.toLocaleString()}/yr`],
                                  ] : [
                                    ['Annual Cost', `$${fullAnnualCost.toLocaleString()}/yr ($200,000/unit)`],
                                  ]),
                                  ['Sizing Basis', clean(sizingBasis)],
                                ],
                                [55, 115]
                              );
                              pdf.addSpacer(2);
                              pdf.addText('SIZING METHODOLOGY', { bold: true, fontSize: 9 });
                              pdf.addText(clean(`Site severity score derived from ${thresholdSource}. Thresholds: DO criteria (${doStressed} mg/L avg, ${doCritical} mg/L min), chlorophyll bloom thresholds (${chlBloom}/${chlSignificant}/${chlSevere} ug/L), turbidity ${isMD ? 'SAV' : 'habitat'} threshold (${turbElevated} FNU), and EPA ATTAINS impairment category. Composite score weighted: DO 25%, Bloom/Nutrients 25%, Turbidity 15%, Impairment 20%, Monitoring Gap 15%. Severity floor: impaired + >1yr data gap = minimum DEGRADED; Cat 5 + >180d gap = near-CRITICAL. CRITICAL (>=75): 3 quads. DEGRADED (>=50): 2 quads. STRESSED (>=25): 1 quad. Large waterbodies (>500 acres) add scale modifier.`), { indent: 5, fontSize: 8 });
                              if (isPhasedDeployment) {
                                pdf.addText(clean(`Phased deployment recommended. Deploy Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} units) at highest-priority inflow zone(s), then scale to full ${totalQuads}-quad build based on 90 days of monitoring data.`), { indent: 5, fontSize: 9 });
                              }
                              pdf.addSpacer(3);

                              // ─── Phased Deployment Roadmap ───
                              if (isPhasedDeployment) {
                                pdf.addSubtitle('Phased Deployment Roadmap');
                                pdf.addDivider();

                                const pdfHasMonitoringGap = dataAgeDays === null || dataAgeDays > 365;
                                const pdfMonitoringNote = pdfHasMonitoringGap
                                  ? `+ Monitoring continuity & verification (restores data record lost for ${dataAgeDays !== null ? Math.round(dataAgeDays / 365) + '+ year' + (Math.round(dataAgeDays / 365) > 1 ? 's' : '') : 'an extended period'})`
                                  : '+ Continuous monitoring, compliance-grade data & treatment verification';

                                // Phase 1
                                const pdfP1Mission = (hasNutrients || bloomSeverity !== 'normal' || bloomSeverity === 'unknown')
                                  ? 'Primary Nutrient Interception'
                                  : hasBacteria ? 'Primary Pathogen Treatment'
                                  : hasSediment ? 'Primary Sediment Capture'
                                  : 'Primary Treatment & Monitoring';
                                const pdfP1Placement = (hasNutrients || bloomSeverity !== 'normal' || bloomSeverity === 'unknown')
                                  ? '#1 critical zone: Highest-load tributary confluence -- intercept nutrient and sediment loading at the dominant inflow before it reaches the receiving waterbody'
                                  : hasBacteria ? '#1 critical zone: Highest-volume discharge point -- treat pathogen loading at the primary outfall or CSO'
                                  : hasSediment ? '#1 critical zone: Primary tributary mouth -- capture suspended solids at the highest-load inflow'
                                  : '#1 critical zone: Highest-priority inflow -- treat and monitor at the most impacted location';
                                const pdfP1Why = bloomSeverity !== 'normal' && bloomSeverity !== 'unknown'
                                  ? `Chlorophyll at ${chlVal} ug/L confirms active bloom cycle. #1 priority -- intercept nutrients at the dominant source before they drive downstream eutrophication. ${pdfMonitoringNote}.`
                                  : hasNutrients ? `ATTAINS lists nutrient impairment. #1 priority: treat the primary urban watershed inflow. ${pdfMonitoringNote}.`
                                  : hasBacteria ? `Bacteria exceeds recreational standards. #1 priority: treat at highest-volume discharge. ${pdfMonitoringNote}.`
                                  : hasSediment ? `Turbidity at ${turbVal?.toFixed(1) ?? '?'} FNU. #1 priority: capture sediment at the dominant tributary. ${pdfMonitoringNote}.`
                                  : `#1 priority treatment zone. ${pdfMonitoringNote}.`;

                                pdf.addText(`PHASE 1: ${pdfP1Mission.toUpperCase()} -- ${phase1Quads} quad${phase1Quads > 1 ? 's' : ''} (${phase1Units} units, ${phase1GPM} GPM) -- $${phase1AnnualCost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                                pdf.addText(clean(`Placement: ${pdfP1Placement}`), { indent: 5, fontSize: 9 });
                                pdf.addText(clean(`Justification: ${pdfP1Why}`), { indent: 5, fontSize: 8 });
                                pdf.addText('Trigger: Immediate -- deploy within 30 days of site assessment', { indent: 5, fontSize: 8 });
                                pdf.addSpacer(2);

                                // Phase 2
                                if (totalQuads >= 2) {
                                  const pdfP2Quads = totalQuads === 2 ? (totalQuads - phase1Quads) : 1;
                                  const pdfP2Units = pdfP2Quads * 4;
                                  const pdfP2GPM = pdfP2Units * 50;
                                  const pdfP2Cost = pdfP2Units * COST_PER_UNIT_YEAR;

                                  const pdfP2Mission = (hasSediment || turbiditySeverity !== 'clear')
                                    ? 'Secondary Outfall Treatment'
                                    : (hasNutrients || bloomSeverity !== 'normal') ? 'Secondary Nutrient Treatment'
                                    : hasBacteria ? 'Secondary Source Treatment'
                                    : 'Secondary Zone Treatment';
                                  const pdfP2Placement = waterType === 'brackish'
                                    ? (hasSediment || turbiditySeverity !== 'clear'
                                      ? '#2 critical zone: MS4 outfall cluster along shoreline -- treat stormwater discharge from adjacent subwatersheds where multiple outfalls concentrate pollutant loading'
                                      : '#2 critical zone: Embayment or low-circulation area -- treat where longest water residence time allows bloom development and DO depletion')
                                    : (hasSediment || turbiditySeverity !== 'clear'
                                      ? '#2 critical zone: Secondary tributary or stormwater outfall cluster -- capture additional loading from adjacent drainage area'
                                      : '#2 critical zone: Secondary inflow or pooling area -- treat where nutrient accumulation drives worst conditions');
                                  const pdfP2Why = turbiditySeverity !== 'clear' && turbiditySeverity !== 'unknown'
                                    ? `Turbidity at ${turbVal?.toFixed(1)} FNU indicates sediment loading from multiple sources. Phase 1 intercepts the primary tributary; Phase 2 treats the next-highest loading zone. ${pdfMonitoringNote}.`
                                    : hasNutrients && (bloomSeverity !== 'normal')
                                    ? `Bloom conditions persist beyond the primary inflow. Phase 2 treats the #2 nutrient loading zone. ${pdfMonitoringNote}.`
                                    : attainsCauses.length >= 3
                                    ? `${attainsCauses.length} impairment causes indicate multiple pollution sources. Phase 2 addresses the #2 priority loading pathway. ${pdfMonitoringNote}.`
                                    : `Phase 1 data identifies the second-highest treatment priority. ${pdfMonitoringNote}.`;

                                  pdf.addText(`PHASE 2: ${pdfP2Mission.toUpperCase()} -- ${pdfP2Quads} quad${pdfP2Quads > 1 ? 's' : ''} (${pdfP2Units} units, ${pdfP2GPM} GPM) -- $${pdfP2Cost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                                  pdf.addText(clean(`Placement: ${pdfP2Placement}`), { indent: 5, fontSize: 9 });
                                  pdf.addText(clean(`Justification: ${pdfP2Why}`), { indent: 5, fontSize: 8 });
                                  pdf.addText('Trigger: After 90 days -- Phase 1 data confirms #2 priority zone and optimal placement', { indent: 5, fontSize: 8 });
                                  pdf.addSpacer(2);
                                }

                                // Phase 3
                                if (totalQuads >= 3) {
                                  const pdfP3RemainQuads = totalQuads - phase1Quads - (totalQuads === 2 ? totalQuads - phase1Quads : 1);
                                  const pdfP3Units = pdfP3RemainQuads * 4;
                                  const pdfP3GPM = pdfP3Units * 50;
                                  const pdfP3Cost = pdfP3Units * COST_PER_UNIT_YEAR;
                                  if (pdfP3RemainQuads > 0) {
                                    const pdfP3Mission = waterType === 'brackish'
                                      ? (hasBacteria ? 'Tertiary Outfall Treatment' : 'Tertiary Zone Treatment')
                                      : 'Tertiary Zone Treatment';
                                    const pdfP3Placement = waterType === 'brackish'
                                      ? (hasBacteria
                                        ? '#3 critical zone: Remaining outfall cluster or CSO discharge -- treat pathogen and nutrient loading from the third-highest contributing subwatershed along the tidal corridor'
                                        : hasNutrients || bloomSeverity !== 'normal'
                                        ? '#3 critical zone: Remaining tributary or embayment -- treat nutrient loading from the third-highest contributing inflow, capturing pollutants that Phases 1+2 cannot reach'
                                        : '#3 critical zone: Third-highest loading area along the shoreline -- extend treatment coverage to remaining untreated outfall discharge')
                                      : (hasNutrients
                                        ? '#3 critical zone: Tertiary inflow or accumulation point -- treat remaining nutrient loading from the third-highest contributing drainage area'
                                        : '#3 critical zone: Remaining untreated inflow -- extend treatment coverage to the third-highest loading area in the watershed');
                                    const pdfP3Why = attainsCauses.length >= 3
                                      ? `${attainsCauses.length} documented impairment causes require treatment across multiple zones. Phases 1+2 address the two highest-load sources. Phase 3 extends to the #3 priority zone -- ${totalUnits} total units providing ${fullGPM} GPM treatment capacity across all major loading points. ${pdfMonitoringNote}.`
                                      : `Phase 3 extends treatment to the third-highest loading zone identified by Phases 1+2 data. Full ${totalQuads}-quad deployment ensures coverage across all major pollution sources -- ${totalUnits} units, ${fullGPM} GPM total capacity. ${pdfMonitoringNote}.`;

                                    const pdfP3Label = totalQuads > 3 ? `PHASE 3 (${pdfP3RemainQuads}Q)` : 'PHASE 3';
                                    pdf.addText(`${pdfP3Label}: ${pdfP3Mission.toUpperCase()} -- ${pdfP3RemainQuads} quad${pdfP3RemainQuads > 1 ? 's' : ''} (${pdfP3Units} units, ${pdfP3GPM} GPM) -- $${pdfP3Cost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                                    pdf.addText(clean(`Placement: ${pdfP3Placement}`), { indent: 5, fontSize: 9 });
                                    pdf.addText(clean(`Justification: ${pdfP3Why}`), { indent: 5, fontSize: 8 });
                                    pdf.addText('Trigger: After 180 days -- Phase 1+2 data identifies #3 priority zone and confirms full-build need', { indent: 5, fontSize: 8 });
                                    pdf.addSpacer(2);
                                  }
                                }

                                pdf.addText(`FULL BUILD: ${totalQuads} quads (${totalUnits} units, ${fullGPM} GPM) -- $${fullAnnualCost.toLocaleString()}/yr`, { bold: true, fontSize: 9 });
                                pdf.addSpacer(3);
                              }

                              // ─── Impairment Classification ───
                              if (impairmentClassification.length > 0) {
                                pdf.addSubtitle(`Impairment Classification -- PEARL addresses ${pearlAddressable} of ${totalClassified} (${addressabilityPct}%)`);
                                pdf.addDivider();
                                pdf.addTable(
                                  ['Cause', 'Tier', 'PEARL Action'],
                                  impairmentClassification.map((item: any) => [
                                    clean(item.cause),
                                    item.tier === 1 ? 'T1 -- Primary Target' : item.tier === 2 ? 'T2 -- Contributes/Planned' : 'T3 -- Outside Scope',
                                    clean(item.pearlAction)
                                  ]),
                                  [45, 40, 85]
                                );
                                pdf.addSpacer(3);
                              }

                              // ─── Threat Assessment ───
                              if (threats.length > 0) {
                                pdf.addSubtitle('Threat Assessment');
                                pdf.addDivider();
                                pdf.addTable(
                                  ['Threat', 'Level', 'Detail'],
                                  threats.map((t: any) => [t.label, t.level, clean(t.detail)]),
                                  [35, 25, 110]
                                );
                                pdf.addSpacer(3);
                              }

                              // ─── Full Restoration Plan ───
                              pdf.addSubtitle('Full Restoration Plan');
                              pdf.addDivider();
                              pdf.addText(`This plan combines ${totalBMPs} conventional BMPs and nature-based solutions with PEARL accelerated treatment.`);
                              pdf.addSpacer(3);

                              for (const cat of categories.filter((c: any) => c.id !== 'pearl')) {
                                pdf.addText(catTitleMap[cat.id] || clean(cat.title), { bold: true });
                                const activeItems = cat.modules.filter((m: any) => m.status === 'warranted' || m.status === 'recommended');
                                const coItems = cat.modules.filter((m: any) => m.status === 'co-benefit');
                                for (const m of activeItems) {
                                  pdf.addText(clean(`- [${m.status.toUpperCase()}] ${m.label} -- ${m.detail}`), { indent: 5, fontSize: 9 });
                                }
                                if (coItems.length > 0) {
                                  pdf.addText(clean(`Co-benefits: ${coItems.map((m: any) => m.label).join(', ')}`), { indent: 5, fontSize: 8 });
                                }
                                pdf.addSpacer(3);
                              }

                              // ─── Recommended Next Steps ───
                              pdf.addSubtitle('Recommended Next Steps');
                              pdf.addDivider();
                              pdf.addText(clean(`1. Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} PEARL units, ${phase1GPM} GPM) at highest-priority inflow zone${phase1Quads > 1 ? 's' : ''}` : `${totalUnits} PEARL unit${totalUnits > 1 ? 's' : ''}`} within 30 days.`), { indent: 5 });
                              pdf.addText('2. Begin continuous water quality monitoring (15-min intervals, telemetered).', { indent: 5 });
                              pdf.addText('3. Use 90-day baseline dataset to calibrate treatment priorities and validate severity assessment.', { indent: 5 });
                              if (isPhasedDeployment) {
                                pdf.addText(clean(`4. Scale to full ${totalQuads}-quad (${totalUnits}-unit) deployment based on Phase 1 field data.`), { indent: 5 });
                                pdf.addText('5. Coordinate with state agency on compliance pathway and grant eligibility.', { indent: 5 });
                                pdf.addText('6. Implement supporting BMPs and nature-based solutions per this restoration plan.', { indent: 5 });
                              } else {
                                pdf.addText('4. Coordinate with state agency on compliance pathway and grant eligibility.', { indent: 5 });
                                pdf.addText('5. Implement supporting BMPs and nature-based solutions per this restoration plan.', { indent: 5 });
                              }
                              pdf.addSpacer(5);

                              pdf.addText('Contact: info@project-pearl.org | project-pearl.org', { bold: true });

                              const safeName = regionName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
                              pdf.download(`PEARL_Deployment_Plan_${safeName}_${stateAbbr}.pdf`);
                            } catch (err) {
                              console.error('PDF generation failed:', err);
                              alert('PDF generation failed. Check console for details.');
                            }
                          }}
                          className="flex-1 min-w-[140px] bg-white hover:bg-cyan-50 text-cyan-800 text-xs font-semibold px-4 py-2.5 rounded-lg border-2 border-cyan-300 transition-colors"
                        >
                          📋 Generate Deployment Plan
                        </button>
                        <button
                          onClick={() => setShowCostPanel(prev => !prev)}
                          className={`flex-1 min-w-[140px] text-xs font-semibold px-4 py-2.5 rounded-lg border-2 transition-colors ${showCostPanel ? 'bg-cyan-700 text-white border-cyan-700' : 'bg-white hover:bg-cyan-50 text-cyan-800 border-cyan-300'}`}
                        >
                          {showCostPanel ? '✕ Close' : '💰 Cost & Economics'}
                        </button>
                      </div>

                      {/* ═══ ECONOMICS PANEL (toggles open) — matches NCC ═══ */}
                      {showCostPanel && (() => {
                        const unitCost = COST_PER_UNIT_YEAR;
                        const p1Annual = phase1Units * unitCost;
                        const fullAnnual = totalUnits * unitCost;

                        const tradMonitoringLow = 100000; const tradMonitoringHigh = 200000;
                        const tradBMPLow = 150000; const tradBMPHigh = 400000;
                        const tradConsultingLow = 75000; const tradConsultingHigh = 175000;
                        const tradTotalLow = (tradMonitoringLow + tradBMPLow + tradConsultingLow) * totalQuads;
                        const tradTotalHigh = (tradMonitoringHigh + tradBMPHigh + tradConsultingHigh) * totalQuads;

                        const bucket1Low = Math.round(0.50 * tradMonitoringLow * totalQuads) + Math.round(0.40 * tradConsultingLow * totalQuads);
                        const bucket1High = Math.round(0.75 * tradMonitoringHigh * totalQuads) + Math.round(0.60 * tradConsultingHigh * totalQuads);
                        const bucket2Low = Math.round(0.05 * tradBMPLow * totalQuads);
                        const bucket2High = Math.round(0.10 * tradBMPHigh * totalQuads);
                        const compSavingsLowRound = Math.round((bucket1Low + bucket2Low) / 10000) * 10000;
                        const compSavingsHighRound = Math.round((bucket1High + bucket2High) / 10000) * 10000;
                        const offsetPctLow = Math.round((compSavingsLowRound / fullAnnual) * 100);
                        const offsetPctHigh = Math.round((compSavingsHighRound / fullAnnual) * 100);
                        const grantOffsetLow = Math.round(fullAnnual * 0.40);
                        const grantOffsetHigh = Math.round(fullAnnual * 0.75);
                        const effectiveCostLow = Math.max(0, fullAnnual - (compSavingsHighRound + grantOffsetHigh));
                        const effectiveCostHigh = Math.max(0, fullAnnual - (compSavingsLowRound + grantOffsetLow));

                        return (
                          <div className="rounded-lg border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-3 space-y-3">
                            <div className="text-[10px] font-bold text-green-800 uppercase tracking-wider">PEARL Economics -- {regionName}</div>

                            {/* Unit pricing */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase">PEARL Unit Pricing</div>
                              <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto] text-[11px]">
                                  <div className="px-2 py-1.5 bg-slate-100 font-semibold border-b border-slate-200">PEARL Unit (50 GPM)</div>
                                  <div className="px-2 py-1.5 bg-slate-100 font-bold text-right border-b border-slate-200">{fmt(unitCost)}/unit/year</div>
                                  <div className="px-2 py-1.5 border-b border-slate-100 text-[10px] text-slate-500" style={{ gridColumn: '1 / -1' }}>
                                    All-inclusive: hardware, deployment, calibration, continuous monitoring, dashboards, automated reporting, maintenance, and support
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Deployment costs */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase">{isPhasedDeployment ? 'Phased Deployment Costs' : 'Deployment Cost'}</div>
                              <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto_auto_auto] text-[11px]">
                                  <div className="px-2 py-1 bg-slate-200 font-bold border-b border-slate-300">Phase</div>
                                  <div className="px-2 py-1 bg-slate-200 font-bold text-right border-b border-slate-300">Units</div>
                                  <div className="px-2 py-1 bg-slate-200 font-bold text-right border-b border-slate-300">GPM</div>
                                  <div className="px-2 py-1 bg-slate-200 font-bold text-right border-b border-slate-300">Annual Cost</div>
                                  {isPhasedDeployment ? (
                                    <>
                                      <div className="px-2 py-1.5 font-semibold border-b border-slate-100">Phase 1 ({phase1Quads} quad{phase1Quads > 1 ? 's' : ''})</div>
                                      <div className="px-2 py-1.5 text-right border-b border-slate-100">{phase1Units}</div>
                                      <div className="px-2 py-1.5 text-right border-b border-slate-100">{phase1GPM}</div>
                                      <div className="px-2 py-1.5 font-bold text-right border-b border-slate-100">{fmt(p1Annual)}/yr</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="px-2 py-1.5 font-semibold border-b border-slate-100">Full deployment</div>
                                      <div className="px-2 py-1.5 text-right border-b border-slate-100">{totalUnits}</div>
                                      <div className="px-2 py-1.5 text-right border-b border-slate-100">{fullGPM}</div>
                                      <div className="px-2 py-1.5 font-bold text-right border-b border-slate-100">{fmt(fullAnnual)}/yr</div>
                                    </>
                                  )}
                                  <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800">Full Build</div>
                                  <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800 text-right">{totalUnits}</div>
                                  <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800 text-right">{fullGPM}</div>
                                  <div className="px-2 py-1.5 bg-cyan-100 font-bold text-cyan-800 text-right">{fmt(fullAnnual)}/yr</div>
                                </div>
                              </div>
                            </div>

                            {/* Traditional compliance baseline */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase">Current Compliance Cost Baseline ({totalQuads} Zones, Annual)</div>
                              <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto] text-[11px]">
                                  <div className="px-2 py-1.5 border-b border-slate-100">Continuous monitoring stations (install amortized + ops)</div>
                                  <div className="px-2 py-1.5 font-bold text-slate-600 text-right border-b border-slate-100">{fmt(tradMonitoringLow * totalQuads)} -- {fmt(tradMonitoringHigh * totalQuads)}/yr</div>
                                  <div className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">Treatment BMPs (constructed wetland / bioretention, amortized)</div>
                                  <div className="px-2 py-1.5 bg-slate-50 font-bold text-slate-600 text-right border-b border-slate-100">{fmt(tradBMPLow * totalQuads)} -- {fmt(tradBMPHigh * totalQuads)}/yr</div>
                                  <div className="px-2 py-1.5 border-b border-slate-100">MS4 consulting, lab work & permit reporting</div>
                                  <div className="px-2 py-1.5 font-bold text-slate-600 text-right border-b border-slate-100">{fmt(tradConsultingLow * totalQuads)} -- {fmt(tradConsultingHigh * totalQuads)}/yr</div>
                                  <div className="px-2 py-1.5 bg-slate-200 font-semibold text-slate-700">Traditional Total (separate contracts)</div>
                                  <div className="px-2 py-1.5 bg-slate-200 font-bold text-slate-700 text-right">{fmt(tradTotalLow)} -- {fmt(tradTotalHigh)}/yr</div>
                                </div>
                              </div>
                            </div>

                            {/* Compliance cost savings */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-green-700 uppercase">Compliance Cost Savings</div>
                              <div className="rounded-md bg-white border border-green-200 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto] text-[11px]">
                                  <div className="px-2 py-1.5 border-b border-green-100">
                                    <div className="font-semibold">Monitoring & reporting efficiency</div>
                                    <div className="text-[9px] text-slate-500">Replaces 50-75% of fixed stations, 40-60% of consulting & lab</div>
                                  </div>
                                  <div className="px-2 py-1.5 font-bold text-green-700 text-right border-b border-green-100">{fmt(bucket1Low)} -- {fmt(bucket1High)}/yr</div>
                                  <div className="px-2 py-1.5 bg-green-50/50 border-b border-green-100">
                                    <div className="font-semibold">BMP execution efficiency</div>
                                    <div className="text-[9px] text-slate-500">Better targeting reduces rework (5-10% of BMP program)</div>
                                  </div>
                                  <div className="px-2 py-1.5 bg-green-50/50 font-bold text-green-700 text-right border-b border-green-100">{fmt(bucket2Low)} -- {fmt(bucket2High)}/yr</div>
                                  <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900">Total Compliance Savings</div>
                                  <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900 text-right">{fmt(compSavingsLowRound)} -- {fmt(compSavingsHighRound)}/yr</div>
                                </div>
                              </div>
                            </div>

                            {/* Offset stats */}
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-md bg-green-100 border border-green-200 text-center py-2">
                                <div className="text-[9px] text-green-600">Compliance Savings Offset</div>
                                <div className="text-lg font-bold text-green-700">{offsetPctLow}% -- {offsetPctHigh}%</div>
                                <div className="text-[9px] text-green-500">of PEARL cost offset by reduced spend</div>
                              </div>
                              <div className="rounded-md bg-cyan-100 border border-cyan-200 text-center py-2">
                                <div className="text-[9px] text-cyan-600">Time to Compliance Data</div>
                                <div className="text-lg font-bold text-cyan-700">30 -- 60 days</div>
                                <div className="text-[9px] text-cyan-500">vs. 12-24 months traditional BMP</div>
                              </div>
                            </div>

                            {/* Grant offset */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase">Grant Funding Offset</div>
                              <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto] text-[11px]">
                                  <div className="px-2 py-1.5 border-b border-slate-100">Estimated grant-eligible portion (40-75%)</div>
                                  <div className="px-2 py-1.5 font-bold text-green-700 text-right border-b border-slate-100">{fmt(grantOffsetLow)} -- {fmt(grantOffsetHigh)}/yr</div>
                                  <div className="px-2 py-1.5 bg-slate-50 border-b border-slate-100">+ Compliance savings</div>
                                  <div className="px-2 py-1.5 bg-slate-50 font-bold text-green-700 text-right border-b border-slate-100">{fmt(compSavingsLowRound)} -- {fmt(compSavingsHighRound)}/yr</div>
                                  <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900">Effective Net Cost</div>
                                  <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900 text-right">{fmt(effectiveCostLow)} -- {fmt(effectiveCostHigh)}/yr</div>
                                </div>
                              </div>
                            </div>

                            {/* Grant alignment */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase">Grant Alignment</div>
                              <div className="grid grid-cols-3 gap-1 text-[10px]">
                                <div className="rounded bg-green-100 border border-green-200 p-1.5 text-center">
                                  <div className="font-bold text-green-800">Equipment</div>
                                  <div className="text-green-600 text-[9px]">"Pilot deployment & equipment"</div>
                                  <div className="font-bold text-green-700 mt-0.5">HIGHLY FUNDABLE</div>
                                </div>
                                <div className="rounded bg-green-100 border border-green-200 p-1.5 text-center">
                                  <div className="font-bold text-green-800">Monitoring</div>
                                  <div className="text-green-600 text-[9px]">"Monitoring, evaluation & data"</div>
                                  <div className="font-bold text-green-700 mt-0.5">HIGHLY FUNDABLE</div>
                                </div>
                                <div className="rounded bg-green-100 border border-green-200 p-1.5 text-center">
                                  <div className="font-bold text-green-800">Treatment</div>
                                  <div className="text-green-600 text-[9px]">"Nature-based BMP implementation"</div>
                                  <div className="font-bold text-green-700 mt-0.5">HIGHLY FUNDABLE</div>
                                </div>
                              </div>
                              <div className="text-[10px] text-slate-500">Eligible: EPA 319, {stateAbbr === 'MD' ? 'MD Bay Restoration Fund, ' : ''}Justice40, CBRAP, NOAA Habitat Restoration, state revolving funds</div>
                            </div>
                          </div>
                        );
                      })()}

                    </CardContent>
                  )}
                </Card>
              );
            })()}
          </div>
        )}

        {/* ── PEARL PILOT RESULTS — always visible, student mode only ── */}
        {!isTeacher && (
          <div className="my-8 rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-lg p-6">
            <div className="text-center mb-5">
              <div className="text-lg font-bold text-sky-900">📊 Real Results from Our First Pilot</div>
              <p className="text-sm text-sky-700 mt-1">These are real results from PEARL biofiltration systems — cleaning water using nature-inspired technology!</p>
            </div>
            <div className="flex flex-col gap-6">
              <div>
                <Image src="/tss-results-kid.jpg" alt="95% drop in Total Suspended Solids after PEARL filtration" width={600} height={400} className="w-full rounded-2xl shadow-lg object-cover" />
                <p className="text-xs text-sky-700 mt-2 text-center font-medium">95% drop in sediment (TSS)</p>
              </div>
              <div>
                <Image src="/ecoli-results-kid.jpg" alt="93.8% drop in E. coli after PEARL filtration" width={600} height={400} className="w-full rounded-2xl shadow-lg object-cover" />
                <p className="text-xs text-sky-700 mt-2 text-center font-medium">93.8% drop in E. coli bacteria</p>
              </div>
            </div>
          </div>
        )}

        {/* K12 Educational Hub — always visible */}
        <K12EducationalHub data={displayData} isTeacher={isTeacher} />

        {/* ── STORMWATER IMAGE — always visible, student mode only ── */}
        {!isTeacher && (
          <div className="my-6">
            <Image src="/stormwater.jpg" alt="Stormwater runoff carrying pollutants into a local waterway" width={1200} height={600} className="w-full rounded-2xl shadow-lg object-cover" />
            <p className="text-xs text-slate-400 mt-2 text-center">Stormwater runoff carries oil, trash, and chemicals from roads into our waterways — this is the #1 threat to water quality</p>
          </div>
        )}

        {/* Water Quality Challenges — always visible */}
        <WaterQualityChallenges context={isTeacher ? 'k12-teacher' : 'k12-student'} />

        {/* ── AI INSIGHTS ── */}
        <AIInsightsEngine role="K12" stateAbbr={stateAbbr} regionData={regionData as any} />

        {/* ── STATEWIDE COMPONENTS — shown when a waterbody is selected AND mock data is available ── */}
        {activeDetailId && displayData && regionMockData && (
          <div className="space-y-4">

            {/* Environmental Justice — Census ACS + EPA SDWIS (statewide) + EJScreen (per-waterbody) */}
            {(() => {
              const ejScore = getEJScore(stateAbbr);
              const ejDetail = getEJData(stateAbbr);
              if (!ejDetail) return null;
              const label = ejScoreLabel(ejScore);
              const scoreBg = ejScore >= 70 ? 'bg-red-600' : ejScore >= 50 ? 'bg-orange-500' : ejScore >= 30 ? 'bg-amber-500' : 'bg-green-500';
              const scoreBorder = ejScore >= 70 ? 'border-red-200' : ejScore >= 50 ? 'border-orange-200' : ejScore >= 30 ? 'border-amber-200' : 'border-green-200';
              // Per-waterbody EJScreen
              const wbEJ = activeDetailId ? ejCache[activeDetailId] : null;
              const wbEJScore = wbEJ?.ejIndex ?? null;
              const wbEJLoading = wbEJ?.loading ?? false;
              const wbName = (() => {
                const rc = getRegionById(activeDetailId || '');
                const nr = regionData.find(r => r.id === activeDetailId);
                return rc?.name || nr?.name || (activeDetailId || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              })();
              const wbScoreBg = wbEJScore !== null ? (wbEJScore >= 70 ? 'bg-red-600' : wbEJScore >= 50 ? 'bg-orange-500' : wbEJScore >= 30 ? 'bg-amber-500' : 'bg-green-500') : 'bg-slate-400';
              // Statewide rollup from ejCache
              const highEJWaterbodies = Object.entries(ejCache).filter(([, v]) => v.ejIndex !== null && v.ejIndex !== undefined && v.ejIndex >= 60).length;
              const totalEJCached = Object.entries(ejCache).filter(([, v]) => v.ejIndex !== null && v.ejIndex !== undefined).length;
              return (
                <div className={`rounded-xl border ${scoreBorder} bg-white shadow-sm overflow-hidden`}>
                  <button onClick={() => toggleCollapse('ej')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <span className="text-sm font-bold text-slate-800">⚖️ Environmental Justice — {wbName}</span>
                    <div className="flex items-center gap-2">
                      {wbEJLoading ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 bg-slate-200 animate-pulse">Loading…</span>
                      ) : wbEJScore !== null ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${wbScoreBg}`}>EJScreen {wbEJScore}/100</span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${scoreBg}`}>State {ejScore}/100</span>
                      )}
                      <div className="flex items-center gap-1.5">
                <span onClick={(e) => { e.stopPropagation(); printSection('ej', 'Environmental Justice'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                </span>
                {isSectionOpen('ej') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
                    </div>
                  </button>
                  {isSectionOpen('ej') && (
                    <div className="px-4 pb-4 pt-2 space-y-3">
                      {/* Per-waterbody EJScreen score — dynamic */}
                      {wbEJScore !== null && (
                        <div className={`rounded-lg border-2 p-3 ${wbEJScore >= 70 ? 'border-red-300 bg-red-50' : wbEJScore >= 50 ? 'border-orange-200 bg-orange-50' : wbEJScore >= 30 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-bold text-slate-800">{wbName} — EJScreen Index</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white ${wbScoreBg}`}>{wbEJScore}/100 {ejScoreLabel(wbEJScore)}</span>
                          </div>
                          <div className="text-xs text-slate-600">
                            {wbEJScore >= 70
                              ? 'This waterbody is in a high EJ-burden community. Eligible for enhanced federal support under Justice40 (EO 14008) and EPA Office of Environmental Justice programs.'
                              : wbEJScore >= 50
                              ? 'Moderate-to-high EJ vulnerability. Community faces elevated environmental and health burden relative to state baseline.'
                              : wbEJScore >= 30
                              ? 'Moderate EJ vulnerability. Some demographic indicators exceed state averages.'
                              : 'Low EJ vulnerability relative to national benchmarks.'
                            }
                          </div>
                          <div className="text-[9px] text-slate-400 mt-1">Source: EPA EJScreen API (live geospatial lookup)</div>
                        </div>
                      )}
                      {wbEJLoading && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 animate-pulse">
                          Fetching EJScreen data for {wbName}…
                        </div>
                      )}
                      {/* State Census baseline */}
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stateName} State Baseline — Census ACS</div>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        <div className="rounded-lg bg-purple-50 border border-purple-100 p-2 text-center">
                          <div className="text-lg font-bold text-purple-700">{ejDetail.povertyPct}%</div>
                          <div className="text-[10px] text-purple-500 font-medium">Below Poverty</div>
                          <div className="text-[9px] text-slate-400">Census ACS</div>
                        </div>
                        <div className="rounded-lg bg-purple-50 border border-purple-100 p-2 text-center">
                          <div className="text-lg font-bold text-purple-700">{ejDetail.minorityPct}%</div>
                          <div className="text-[10px] text-purple-500 font-medium">Minority</div>
                          <div className="text-[9px] text-slate-400">Census ACS</div>
                        </div>
                        <div className="rounded-lg bg-purple-50 border border-purple-100 p-2 text-center">
                          <div className="text-lg font-bold text-purple-700">{ejDetail.uninsuredPct}%</div>
                          <div className="text-[10px] text-purple-500 font-medium">Uninsured</div>
                          <div className="text-[9px] text-slate-400">Census ACS</div>
                        </div>
                        <div className="rounded-lg bg-purple-50 border border-purple-100 p-2 text-center">
                          <div className="text-lg font-bold text-purple-700">{ejDetail.lingIsolatedPct}%</div>
                          <div className="text-[10px] text-purple-500 font-medium">Ling. Isolated</div>
                          <div className="text-[9px] text-slate-400">Census ACS</div>
                        </div>
                        <div className="rounded-lg bg-purple-50 border border-purple-100 p-2 text-center">
                          <div className="text-lg font-bold text-purple-700">{ejDetail.noHSDiplomaPct}%</div>
                          <div className="text-[10px] text-purple-500 font-medium">No HS Diploma</div>
                          <div className="text-[9px] text-slate-400">Census ACS</div>
                        </div>
                        <div className="rounded-lg bg-red-50 border border-red-100 p-2 text-center">
                          <div className="text-lg font-bold text-red-700">{ejDetail.drinkingWaterViol}</div>
                          <div className="text-[10px] text-red-500 font-medium">SDWA Violations</div>
                          <div className="text-[9px] text-slate-400">per 100k (SDWIS)</div>
                        </div>
                      </div>
                      {/* Per-waterbody EJ breakdown */}
                      {totalEJCached > 0 && (
                        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                          <span className="font-semibold">Statewide EJScreen Rollup:</span>{' '}
                          {highEJWaterbodies} of {totalEJCached} assessed waterbodies have EJ index ≥60 (high vulnerability).
                          {highEJWaterbodies > 0 && ' These overlap EJ-designated communities and qualify for enhanced federal support under Justice40.'}
                        </div>
                      )}
                      {/* Policy callout */}
                      <div className="text-xs text-cyan-900 bg-cyan-50 border border-cyan-200 rounded-lg p-2.5">
                        <span className="font-bold">📋 Regulatory Relevance:</span>{' '}
                        {(wbEJScore ?? ejScore) >= 60
                          ? `${wbEJScore !== null ? wbName : stateName} has elevated EJ vulnerability. Impaired waterbodies in high-EJ communities are priority candidates for EPA Office of Environmental Justice grants, Justice40 funding (Executive Order 14008), and CEJST-designated community benefits.`
                          : `${wbEJScore !== null ? wbName : stateName} shows moderate EJ burden. Communities near impaired waterbodies may qualify for Justice40 and EPA EJ program support where local indicators exceed thresholds.`
                        }
                      </div>
                      <div className="text-[10px] text-slate-400 italic">
                        Sources: Census ACS 5-Year (2018–2022) S1701, DP05, S2701, S1601, S1501 · EPA SDWIS · EPA EJScreen API (per-waterbody)
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}


          </div>
        )}


        {/* ── TOP 10 WORSENING / IMPROVING — full + programs view ── */}
        {(
        <div id="section-top10" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('top10')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">🔥 Top 5 Worsening / Improving Waterbodies</span>
            <div className="flex items-center gap-1.5">
                <span onClick={(e) => { e.stopPropagation(); printSection('top10', 'Top 5 Worsening / Improving'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                </span>
                {isSectionOpen('top10') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
          </button>
          {isSectionOpen('top10') && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 p-4">
          <Card className="border-2 border-red-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Top 5 Worsening
              </CardTitle>
              <CardDescription>Highest priority intervention areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {/* #1 — Potomac River Sewage Spill (pinned, MD only) */}
                {stateAbbr === 'MD' && (
                <div
                  id="section-potomac"
                  className={`rounded-lg border-2 border-red-300 bg-red-50 overflow-hidden ${
                    activeDetailId === 'maryland_potomac' ? 'ring-2 ring-blue-400' : ''
                  }`}
                >
                  <div className="flex items-center justify-between p-2.5 cursor-pointer hover:bg-red-100/50 transition-colors"
                    onClick={() => setActiveDetailId('maryland_potomac')}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">1</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-red-900">Potomac River — Interceptor Collapse</div>
                        <div className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Active Sewage Spill · Cabin John, Montgomery County · Since Jan 19, 2026</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="destructive" className="text-xs animate-pulse">CRITICAL</Badge>
                      <button
                        onClick={(e) => { e.stopPropagation(); printSection('potomac', 'Potomac River Crisis'); }}
                        className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                        title="Print this section"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleCollapse('potomac'); }}
                        className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                        title={isSectionOpen('potomac') ? 'Collapse details' : 'Expand details'}
                      >
                        {isSectionOpen('potomac') ? <Minus className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {isSectionOpen('potomac') && (
                  <div className="px-3 pb-3 pt-1 text-xs text-red-900 leading-relaxed border-t border-red-200 bg-red-50/80 space-y-2">
                    {/* Incident summary */}
                    <div>
                      <span className="font-bold">Incident:</span> A 72″ section of the <span className="font-semibold">Potomac Interceptor</span> sewer line collapsed near Clara Barton Parkway on Jan 19, 2026, releasing raw sewage into the C&O Canal and Potomac River. The 1960s-era pipe carries ~60M gallons/day from as far as Dulles Airport to the Blue Plains Advanced Wastewater Treatment Plant. DC Water describes it as part of a 54-mile system already identified for rehabilitation.
                    </div>
                    {/* Scale */}
                    <div>
                      <span className="font-bold">Volume:</span> An estimated <span className="font-semibold text-red-700">243–300 million gallons</span> of untreated sewage discharged before bypass activation on Jan 24. Peak overflow rate was ~40M gallons/day (~2% of total Potomac flow). Additional overflow events have continued, including ~600K gallons on Feb 9 when pumps clogged with flushable wipes. UMD called it <span className="italic">one of the largest sewage spills in U.S. history</span>.
                    </div>
                    {/* Water quality */}
                    <div>
                      <span className="font-bold">Water Quality:</span> UMD researchers found E. coli levels <span className="font-semibold text-red-700">10,000× above EPA recreational standards</span> at the spill site on Jan 21. Potomac Riverkeeper Network measured <span className="font-semibold">nearly 12,000× safe limits</span> near Lockhouse 10. Staphylococcus aureus detected at 33% of sample sites, including antibiotic-resistant <span className="font-semibold">MRSA</span> at the overflow location. Downstream levels (10+ mi) still 1.5× above standards as of Jan 28.
                    </div>
                    {/* Public health */}
                    <div>
                      <span className="font-bold">Public Health:</span> DC/MD/VA agencies issued advisories — avoid all river contact, fishing, and keep pets away. Drinking water confirmed safe (separate system). MDE issued shellfish closure from spill site to Harry W. Nice Bridge (Rt 301). VA advisory covers 72.5 miles from I-495 to King George County. Frozen sewage expected to re-release bacteria as spring temperatures rise.
                    </div>
                    {/* Repair status */}
                    <div>
                      <span className="font-bold">Repair Status:</span> DC Water bypass system activated Jan 24, reducing overflow. Rock dam discovered inside pipe Feb 5 complicated repairs. Interim fix estimated 4–6 weeks; full repair ~9 months. DC Water has allocated <span className="font-semibold">$625M over 10 years</span> for Potomac Interceptor rehabilitation.
                    </div>
                    {/* Political */}
                    <div>
                      <span className="font-bold">Federal Response:</span> President Trump directed FEMA coordination on Feb 17. Gov. Moore's office noted the federal government has been responsible for the Potomac Interceptor since the last century. Potomac Conservancy submitted a letter signed by 2,100+ community members demanding accountability from DC Water.
                    </div>
                    {/* PEARL relevance */}
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2 text-cyan-900">
                      <span className="font-bold">🔬 PEARL Relevance:</span> This event demonstrates catastrophic infrastructure failure impact on receiving waters. PEARL's real-time monitoring capability would provide continuous E. coli, nutrient, and pathogen tracking during and after spill events — filling the gap that required UMD researchers and volunteer riverkeepers to manually sample. Continuous deployment at 6 DC Water monitoring sites would provide the 24/7 data regulators and the public need.
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">DC Water</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">NPR</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">The Hill</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">NBC News</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">UMD School of Public Health</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">Potomac Conservancy</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">DOEE</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">VDH</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">MD Matters</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-200 text-slate-700">Izaak Walton League</span>
                    </div>
                  </div>
                  )}
                </div>
                )}
                {/* Remaining slots — offset numbering if Potomac is shown */}
                {hotspots.worsening.slice(0, stateAbbr === 'MD' ? 4 : 5).map((region, idx) => (
                  <div
                    key={region.id}
                    onClick={() => setActiveDetailId(region.id)}
                    className={`rounded-lg border border-red-100 bg-white hover:bg-red-50 cursor-pointer transition-colors ${
                      activeDetailId === region.id ? 'ring-2 ring-blue-300' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between p-2.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold">
                          {stateAbbr === 'MD' ? idx + 2 : idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-slate-700 truncate">{region.name}</div>
                          <div className="text-xs text-slate-500">{region.activeAlerts} active alert{region.activeAlerts !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <Badge variant={region.alertLevel === 'high' ? 'destructive' : 'default'} className="text-xs">
                        {levelToLabel(region.alertLevel)}
                      </Badge>
                    </div>
                  </div>
                ))}
                {hotspots.worsening.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No assessed waterbodies with impairment data</div>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Top 5 Improving
              </CardTitle>
              <CardDescription>Success stories and best performers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {hotspots.improving.map((region, idx) => (
                  <div
                    key={region.id}
                    onClick={() => setActiveDetailId(region.id)}
                    className={`flex items-center justify-between p-2 rounded-lg border border-green-100 hover:bg-green-50 cursor-pointer transition-colors ${
                      activeDetailId === region.id ? 'ring-2 ring-blue-300' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-700 truncate">{region.name}</div>
                        <div className="text-xs text-slate-500">
                          {region.alertLevel === 'none' ? 'No alerts' : `${region.activeAlerts} minor alert${region.activeAlerts !== 1 ? 's' : ''}`}
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border-green-200">
                      {levelToLabel(region.alertLevel)}
                    </Badge>
                  </div>
                ))}
                {hotspots.improving.length === 0 && <div className="text-sm text-slate-400 py-4 text-center">No assessed waterbodies yet</div>}
              </div>
            </CardContent>
          </Card>
        </div>
          )}
        </div>
        )}

        {/* ── STUDENT LEARNING MODE ── */}
        <div id="section-learning" className="rounded-xl border-2 border-cyan-300 bg-gradient-to-r from-cyan-50 to-teal-50 shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('learning')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-cyan-100/50 transition-colors">
            <div className="flex items-center gap-2">
              <BookOpen size={15} className="text-cyan-600" />
              <span className="text-sm font-bold text-cyan-800">Student Learning Mode 🌊</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span onClick={(e) => { e.stopPropagation(); printSection('learning', 'Student Learning Mode'); }} className="p-1 hover:bg-cyan-200 rounded transition-colors" title="Print this section">
                <Printer className="h-3.5 w-3.5 text-cyan-400" />
              </span>
              {isSectionOpen('learning') ? <Minus className="h-4 w-4 text-cyan-400" /> : <ChevronDown className="h-4 w-4 text-cyan-400" />}
            </div>
          </button>
          {isSectionOpen('learning') && (
            <div className="px-4 pb-4 space-y-3">
              {activeDetailId && (
                <div className="rounded-lg border-2 border-cyan-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-cyan-800">🌊 You are viewing live water quality data from <span className="font-bold">{regionData.find(r => r.id === activeDetailId)?.name || 'this waterbody'}</span>.</p>
                  <p className="text-xs text-cyan-700 mt-1">These are real sensor readings. Scroll down to explore what the numbers mean, see how PEARL cleans the water, and export your field report.</p>
                </div>
              )}
              <p className="text-sm text-slate-700 leading-relaxed">
                <strong>Welcome!</strong> Green means healthy water — good for fish and plants! Red means the water needs help. Click on any waterbody on the map to explore its data.
              </p>
              <div className="p-2 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-900">
                <strong>💡 Did you know?</strong> {k12WaterFacts[k12FactIndex]}
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-medium">Water Quality Basics</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">Interactive Gauges</span>
                <span className="px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-md font-medium">Storm Events</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-md font-medium">Real EPA Data</span>
              </div>
            </div>
          )}
        </div>

        {/* ── SCIENCE FAIR & STEM PROJECT IDEAS ── */}
        <div id="section-projects" className="rounded-xl border-2 border-cyan-300 bg-gradient-to-br from-cyan-50 via-white to-cyan-50 shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('projects')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-cyan-100/50 transition-colors">
            <span className="text-sm font-bold text-cyan-800">🌟 Science Fair & STEM Project Ideas</span>
            <div className="flex items-center gap-1.5">
              <span onClick={(e) => { e.stopPropagation(); printSection('projects', 'Science Fair & STEM Project Ideas'); }} className="p-1 hover:bg-cyan-200 rounded transition-colors" title="Print this section">
                <Printer className="h-3.5 w-3.5 text-cyan-400" />
              </span>
              {isSectionOpen('projects') ? <Minus className="h-4 w-4 text-cyan-400" /> : <ChevronDown className="h-4 w-4 text-cyan-400" />}
            </div>
          </button>
          {isSectionOpen('projects') && (
            <div className="px-4 pb-4 space-y-3">
              <div className="text-xs font-semibold text-cyan-700 mb-1">🔬 Science Fair Project Ideas — Use Real Water Quality Data</div>
              <div className="space-y-2">
                {[
                  { title: 'How Does a Rainstorm Change Water Quality?', desc: "Compare water quality before, during, and after storm events. Use PEARL's time controls to see pollutant spikes.", ngss: 'NGSS MS-ESS3-3', tool: 'Storm Events Tab' },
                  { title: 'Do Green Infrastructure Projects Clean Water?', desc: 'Test if rain gardens and bioswales reduce pollutants. Compare influent vs effluent data using % Removal mode.', ngss: 'NGSS MS-ETS1-1', tool: '% Removal Tab' },
                  { title: 'Which Pollutant Is Worst After a Storm?', desc: 'Rank pollutants by concentration increase during storms. Export CSV data and create charts for your poster.', ngss: 'NGSS MS-ESS3-4', tool: 'Export CSV' },
                  { title: 'Can We Predict Algal Blooms?', desc: 'Track nitrogen and phosphorus levels to predict when algae will grow. Use Trends Chart to find patterns.', ngss: 'NGSS MS-LS2-3', tool: 'Trends & Gauges' },
                  { title: 'How Clean Is My Local Water?', desc: "Compare your region's water quality to EPA standards. Present findings with PEARL's gauges and scores.", ngss: 'NGSS HS-ESS3-4', tool: 'Regional Data' },
                ].map(p => (
                  <div key={p.title} className="bg-white p-3 rounded-lg border border-cyan-200">
                    <h4 className="font-medium text-sm text-cyan-900 mb-1">{p.title}</h4>
                    <p className="text-xs text-slate-600 mb-2">{p.desc}</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">{p.ngss}</span>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">{p.tool}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-xs font-semibold text-cyan-700 mt-3 mb-1">🎯 General STEM Ideas</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { title: 'Build a Mini Biofilter', desc: 'Design a small-scale version of PEARL using oyster shells, sand, and gravel. Test how well it cleans dirty water.' },
                  { title: 'Map Your Watershed', desc: 'Use the PEARL map to identify all waterbodies in your county. Create a poster showing how water flows from your school to the Bay.' },
                  { title: 'Wildlife & Water Quality', desc: 'Research which animals are most affected by poor water quality. Connect species data to PEARL monitoring results.' },
                  { title: 'Environmental Justice Report', desc: 'Use the EJ data on this dashboard to investigate if pollution affects all communities equally.' },
                ].map(p => (
                  <div key={p.title} className="bg-white p-3 rounded-lg border border-cyan-200">
                    <h4 className="font-medium text-xs text-cyan-900 mb-1">{p.title}</h4>
                    <p className="text-[10px] text-slate-600">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── SUCCESS STORY — always visible, student mode only ── */}
        {!isTeacher && (
          <div className="my-8 rounded-2xl border-2 border-green-200 bg-gradient-to-br from-green-50 to-white shadow-lg overflow-hidden">
            <Image src="/happy-neighbors.jpg" alt="Community members celebrating a successful water cleanup project" width={1200} height={600} className="w-full rounded-2xl shadow-lg object-cover" />
            <div className="p-5">
              <div className="text-base font-bold text-green-900 mb-1">🌟 Success Story — Communities Making a Difference</div>
              <p className="text-sm text-green-800 leading-relaxed">When communities work together to protect their waterways, everyone benefits — cleaner water, healthier wildlife, and happier neighbors!</p>
            </div>
          </div>
        )}

        {/* ── FIELD REPORT EXPORT ── */}
        <div id="section-fieldreport" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('fieldreport')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">📋 Field Report & Data Export</span>
            <div className="flex items-center gap-1.5">
              <span onClick={(e) => { e.stopPropagation(); printSection('fieldreport', 'Field Report & Data Export'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                <Printer className="h-3.5 w-3.5 text-slate-400" />
              </span>
              {isSectionOpen('fieldreport') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('fieldreport') && (
            <div className="p-4 space-y-3">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-amber-800 mb-2">📋 Student Field Report</div>
                <p className="text-xs text-amber-700 leading-relaxed mb-3">
                  Export a printable field investigation report with waterbody name, date, key parameters (DO, pH, turbidity, TSS, nutrients),
                  color-coded pass/fail vs EPA standards, space for student observations, and NGSS alignment tags.
                </p>
                <button
                  disabled={!displayData}
                  onClick={() => {
                    const regionConfig = getRegionById(activeDetailId!);
                    const nccRegion = regionData.find(r => r.id === activeDetailId);
                    const regionName = regionConfig?.name || nccRegion?.name || activeDetailId!.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    exportK12FieldReport(displayData, regionName);
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📋 Export Field Report
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── K12 EDUCATIONAL HUB ── */}
        <div id="section-eduhub" className="rounded-xl border-2 border-cyan-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('eduhub')} className="w-full flex items-center justify-between px-4 py-3 bg-cyan-50 hover:bg-cyan-100 transition-colors">
            <span className="text-sm font-bold text-cyan-800">🏫 K-12 Educational Hub</span>
            <div className="flex items-center gap-1.5">
              <span onClick={(e) => { e.stopPropagation(); printSection('eduhub', 'K-12 Educational Hub'); }} className="p-1 hover:bg-cyan-200 rounded transition-colors" title="Print this section">
                <Printer className="h-3.5 w-3.5 text-cyan-400" />
              </span>
              {isSectionOpen('eduhub') ? <Minus className="h-4 w-4 text-cyan-400" /> : <ChevronDown className="h-4 w-4 text-cyan-400" />}
            </div>
          </button>
          {isSectionOpen('eduhub') && (
            <div className="p-4 space-y-3">

              {/* Quick parameter explainers */}
              <div className="text-xs font-semibold text-slate-700 mb-1">🔬 What Do These Numbers Mean?</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { param: 'Dissolved Oxygen', unit: 'mg/L', good: '> 5.0', icon: '🫧', why: 'Fish breathe this!' },
                  { param: 'pH', unit: 'units', good: '6.5–8.5', icon: '⚗️', why: 'Too acid or basic hurts life' },
                  { param: 'Turbidity', unit: 'NTU', good: '< 25', icon: '🌫️', why: 'Cloudy water blocks sunlight' },
                  { param: 'TSS', unit: 'mg/L', good: '< 25', icon: '🪨', why: 'Dirt particles in water' },
                  { param: 'Nitrogen', unit: 'mg/L', good: '< 1.0', icon: '🌱', why: 'Too much feeds algae blooms' },
                  { param: 'Phosphorus', unit: 'mg/L', good: '< 0.1', icon: '🧪', why: 'Main cause of green water' },
                  { param: 'E. coli', unit: 'CFU/100mL', good: '< 126', icon: '🦠', why: 'Means sewage contamination' },
                  { param: 'Temperature', unit: '°C', good: '< 30', icon: '🌡️', why: 'Warm water holds less oxygen' },
                ].map(p => (
                  <div key={p.param} className="bg-white rounded-lg border border-cyan-100 p-2">
                    <div className="flex items-center gap-1">
                      <span>{p.icon}</span>
                      <span className="text-xs font-bold text-cyan-900">{p.param}</span>
                    </div>
                    <div className="text-[10px] text-cyan-700">Good: {p.good} {p.unit}</div>
                    <div className="text-[10px] text-slate-500 italic">{p.why}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── TEACHER RESOURCES (teacher mode only) ── */}
        {isTeacher && (
          <div id="section-teacher" className="rounded-xl border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('teacher')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-purple-100/50 transition-colors">
              <span className="text-sm font-bold text-purple-800">👩‍🏫 Teacher Resources & Curriculum Tools</span>
              <div className="flex items-center gap-1.5">
                <span onClick={(e) => { e.stopPropagation(); printSection('teacher', 'Teacher Resources & Curriculum Tools'); }} className="p-1 hover:bg-purple-200 rounded transition-colors" title="Print this section">
                  <Printer className="h-3.5 w-3.5 text-purple-400" />
                </span>
                {isSectionOpen('teacher') ? <Minus className="h-4 w-4 text-purple-400" /> : <ChevronDown className="h-4 w-4 text-purple-400" />}
              </div>
            </button>
            {isSectionOpen('teacher') && (
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-white rounded-lg border border-purple-200 p-3">
                    <div className="text-xs font-semibold text-purple-800">📚 Lesson Plan Builder</div>
                    <p className="text-[10px] text-purple-600 mt-1">Auto-generate lesson plans from current waterbody data. Aligned to NGSS, Common Core Math, and state standards.</p>
                  </div>
                  <div className="bg-white rounded-lg border border-purple-200 p-3">
                    <div className="text-xs font-semibold text-purple-800">📊 Student Data Portal</div>
                    <p className="text-[10px] text-purple-600 mt-1">Create class-specific data views with simplified parameters. Control which waterbodies and time ranges students see.</p>
                  </div>
                  <div className="bg-white rounded-lg border border-purple-200 p-3">
                    <div className="text-xs font-semibold text-purple-800">✅ Assessment Generator</div>
                    <p className="text-[10px] text-purple-600 mt-1">Build quizzes and lab practicals using live data. Auto-grade with answer keys. Track student progress across assignments.</p>
                  </div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-purple-700 mb-1">🎯 NGSS Standards Coverage</div>
                  <div className="flex flex-wrap gap-1">
                    {['MS-ESS3-3 (Human Impact)', 'MS-ESS3-4 (Solutions)', 'MS-LS2-3 (Ecosystems)', 'MS-ETS1-1 (Engineering)', 'HS-ESS3-4 (Sustainability)', 'HS-LS2-7 (Biodiversity)'].map(s => (
                      <span key={s} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded-full font-medium">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── GRANTS — teacher mode only ── */}
        {isTeacher && (
          <div id="section-grants" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">💰 K-12 Education Grant Opportunities — {stateName}</span>
              <div className="flex items-center gap-1">
                {isSectionOpen('grants') && <span onClick={(e) => { e.stopPropagation(); printSection('grants', `K-12 Education Grants — ${stateName}`); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>
            {isSectionOpen('grants') && (
              <GrantOpportunityMatcher
                regionId={activeDetailId || `${stateAbbr.toLowerCase()}_statewide`}
                removalEfficiencies={removalEfficiencies as any}
                alertsCount={regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length}
                userRole="K12"
              />
            )}
          </div>
        )}

        {/* ── DISCLAIMER FOOTER ── */}
        <PlatformDisclaimer />

      </div>
    </div>
  );
}

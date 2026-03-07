'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import MissionQuote from './MissionQuote';
import { WhatChangedOvernight, StakeholderWatch } from './BriefingCards';
import { useLensParam } from '@/lib/useLensParam';
import Image from 'next/image';
import { getStatesGeoJSON, geoToAbbr, STATE_GEO_LEAFLET, FIPS_TO_ABBR as _FIPS, STATE_NAMES as _SN } from '@/lib/mapUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Shield, ChevronDown, ChevronUp, Minus, AlertTriangle, CheckCircle, Search, Filter, Droplets, TrendingUp, BarChart3, Info, LogOut, Printer, Users, Heart, Leaf, AlertCircle, Gauge, Fish, ShieldAlert, Bug, Megaphone, Banknote, Clock, Trophy, Scale } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getRegionById } from '@/lib/regionsConfig';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import HeroBanner from './HeroBanner';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { useTierFilter } from '@/lib/useTierFilter';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses, COST_PER_UNIT_YEAR } from '@/lib/restorationEngine';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { getEcoScore, getEcoData, ecoScoreLabel } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData, ejScoreLabel } from '@/lib/ejVulnerability';
import { scoreToGrade, alertLevelAvgScore, ALERT_LEVEL_SCORES, ecoScoreStyle, ejScoreStyle } from '@/lib/scoringUtils';
import { STATE_AUTHORITIES } from '@/lib/stateWaterData';
import { useAuth } from '@/lib/authContext';
import { getRegionMockData, calculateRemovalEfficiency } from '@/lib/mockData';
import { WaterQualityChallenges } from '@/components/WaterQualityChallenges';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import { PolicyTracker } from '@/components/PolicyTracker';
import { EmergingContaminantsTracker } from '@/components/EmergingContaminantsTracker';
import ResolutionPlanner from '@/components/ResolutionPlanner';
import RestorationPlanner from '@/components/RestorationPlanner';
import { DisasterEmergencyPanel } from '@/components/DisasterEmergencyPanel';
import { WatershedHealthPanel } from '@/components/WatershedHealthPanel';
import { RestorationProjectsPanel } from '@/components/RestorationProjectsPanel';
import { AdvocacyPanel } from '@/components/AdvocacyPanel';
import { VolunteerProgramPanel } from '@/components/VolunteerProgramPanel';
import { CitizenReportingPanel } from '@/components/CitizenReportingPanel';
import LocationReportCard from '@/components/LocationReportCard';
import { getEpaRegionForState } from '@/lib/epa-regions';
import { LayoutEditor } from './LayoutEditor';
import { DataFreshnessFooter } from '@/components/DataFreshnessFooter';
import { DraggableSection } from './DraggableSection';
import dynamic from 'next/dynamic';
import { useAdminState } from '@/lib/adminStateContext';
import RoleTrainingGuide from '@/components/RoleTrainingGuide';

const GrantOpportunityMatcher = dynamic(
  () => import('@/components/GrantOpportunityMatcher').then((mod) => mod.GrantOpportunityMatcher),
  { ssr: false }
);

const InitiativesTrackerPanel = dynamic(
  () => import('@/components/InitiativesTrackerPanel').then((mod) => mod.InitiativesTrackerPanel),
  { ssr: false }
);

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false }
);
const MapboxMarkers = dynamic(
  () => import('@/components/MapboxMarkers').then(m => m.MapboxMarkers),
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
  onSelectRegion?: (regionId: string) => void;
  onToggleDevMode?: () => void;
};

// ─── Lenses (18-view architecture) ───────────────────────────────────────────

type ViewLens = 'overview' | 'briefing' | 'political-briefing' | 'trends' | 'policy' | 'compliance' |
  'water-quality' | 'public-health' | 'habitat' | 'watershed-health' | 'restoration-projects' |
  'infrastructure' | 'monitoring' | 'disaster-emergency' | 'advocacy' |
  'scorecard' | 'reports' | 'volunteer-program' | 'citizen-reporting' | 'funding' | 'initiatives' | 'training';

const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  sections: Set<string> | null;
}> = {
  overview:    { label: 'Overview',    description: 'NGO watershed management overview',
    sections: new Set(['regprofile', 'map-grid', 'top10', 'partners', 'disclaimer']) },
  briefing:    { label: 'AI Briefing', description: 'AI-generated conservation intelligence briefing',
    sections: new Set(['insights', 'alertfeed', 'disclaimer']) },
  'political-briefing': {
    label: 'Political Briefing',
    description: 'Talking points, funding optics, EJ exposure, and council agenda suggestions',
    sections: new Set([
      'pol-talking-points', 'pol-constituent-concerns', 'pol-funding-wins', 'pol-funding-risks',
      'pol-regulatory-deadlines', 'pol-ej-exposure', 'pol-media-ready-grades',
      'pol-peer-comparison', 'pol-council-agenda', 'disclaimer',
    ]),
  },
  trends:      { label: 'Trends & Projections', description: 'Watershed health trends and conservation projections',
    sections: new Set(['trends-dashboard', 'disclaimer']) },
  policy:      { label: 'Policy Tracker', description: 'Water policy tracking for advocacy',
    sections: new Set(['policy-tracker', 'disclaimer']) },
  compliance:  { label: 'Compliance', description: 'Regulatory compliance monitoring',
    sections: new Set(['icis', 'sdwis', 'disclaimer']) },
  'water-quality': { label: 'Water Quality', description: 'Watershed water quality assessment',
    sections: new Set(['regprofile', 'map-grid', 'detail', 'disclaimer']) },
  'public-health': { label: 'Public Health & Contaminants', description: 'Emerging contaminants and community health',
    sections: new Set(['contaminants-tracker', 'disclaimer']) },
  'watershed-health': { label: 'Watershed Health', description: 'Comprehensive watershed health assessment',
    sections: new Set(['watershed-health-panel', 'map-grid', 'disclaimer']) },
  'restoration-projects': { label: 'Restoration Projects', description: 'Active restoration project tracker',
    sections: new Set(['restoration-projects-panel', 'map-grid', 'disclaimer']) },
  infrastructure: { label: 'Infrastructure', description: 'Infrastructure impact on watersheds',
    sections: new Set(['groundwater', 'disclaimer']) },
  monitoring:  { label: 'Monitoring', description: 'Community-based monitoring network',
    sections: new Set(['regprofile', 'detail', 'disclaimer']) },
  'disaster-emergency': { label: 'Disaster & Emergency', description: 'Environmental emergency response',
    sections: new Set(['disaster-emergency-panel', 'resolution-planner', 'disclaimer']) },
  advocacy:    { label: 'Advocacy', description: 'Policy advocacy and regulatory engagement',
    sections: new Set(['advocacy-panel', 'policy', 'disclaimer']) },
  scorecard:   { label: 'Scorecard', description: 'Conservation program scorecard',
    sections: new Set(['scorecard-kpis', 'scorecard-grades', 'disclaimer']) },
  reports:     { label: 'Reports', description: 'Impact reports and data exports',
    sections: new Set(['reports-hub', 'disclaimer']) },
  'volunteer-program': { label: 'Volunteer Program', description: 'Volunteer monitoring program management',
    sections: new Set(['volunteer', 'community', 'volunteer-program-panel', 'disclaimer']) },
  'citizen-reporting': { label: 'Citizen Reporting', description: 'Community citizen science data submission and review',
    sections: new Set(['citizen-reporting-panel', 'volunteer-program-panel', 'community', 'disclaimer']) },
  funding:     { label: 'Funding & Grants', description: 'Conservation funding opportunities',
    sections: new Set(['grants', 'fund-active', 'fund-pipeline', 'disclaimer']) },
  habitat:     { label: 'Habitat & Ecology', description: 'Species conservation status and habitat health — supports advocacy and restoration',
    sections: new Set(['hab-ecoscore', 'hab-wildlife', 'disclaimer']) },
  initiatives: { label: 'Initiatives', description: 'Conservation initiative planning and tracking',
    sections: new Set(['initiatives-panel', 'disclaimer']) },
  training: {
    label: 'Training', description: 'Deployment training and onboarding guide',
    sections: new Set(['training']),
  },
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATE_NAMES = _SN;

const STATE_AGENCIES: Record<string, { name: string; division: string; url: string; phone?: string; ms4Program: string; cwaSec: string }> = {
  MD: { name: 'Maryland Dept. of the Environment', division: 'Water & Science Administration', url: 'https://mde.maryland.gov/programs/water', phone: '(410) 537-3000', ms4Program: 'MD MS4/NPDES', cwaSec: '§303(d)/§402' },
  FL: { name: 'Florida Dept. of Environmental Protection', division: 'Division of Water Resource Management', url: 'https://floridadep.gov/dear/water-quality-standards', phone: '(850) 245-2118', ms4Program: 'FL NPDES MS4', cwaSec: '§303(d)/§402' },
  VA: { name: 'Virginia DEQ', division: 'Water Planning Division', url: 'https://www.deq.virginia.gov/water', phone: '(804) 698-4000', ms4Program: 'VA VPDES MS4', cwaSec: '§303(d)/§402' },
  PA: { name: 'Pennsylvania DEP', division: 'Bureau of Clean Water', url: 'https://www.dep.pa.gov/Business/Water', phone: '(717) 787-5259', ms4Program: 'PA NPDES MS4', cwaSec: '§303(d)/§402' },
  DC: { name: 'DC Dept. of Energy & Environment', division: 'Water Quality Division', url: 'https://doee.dc.gov/service/water-quality', phone: '(202) 535-2600', ms4Program: 'DC MS4', cwaSec: '§303(d)/§402' },
  DE: { name: 'Delaware DNREC', division: 'Div. of Water', url: 'https://dnrec.delaware.gov/water/', phone: '(302) 739-9922', ms4Program: 'DE NPDES MS4', cwaSec: '§303(d)/§402' },
  WV: { name: 'West Virginia DEP', division: 'Div. of Water & Waste Management', url: 'https://dep.wv.gov/WWE', phone: '(304) 926-0495', ms4Program: 'WV NPDES MS4', cwaSec: '§303(d)/§402' },
};

const FIPS_TO_ABBR = _FIPS;


function levelToLabel(level: string): string {
  return level === 'high' ? 'Severe' : level === 'medium' ? 'Impaired' : level === 'low' ? 'Watch' : 'Healthy';
}

const SEVERITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };


// ─── Watershed Groups by State ───────────────────────────────────────────────

const WATERSHED_GROUPS: Record<string, string[]> = {
  MD: ['All Watersheds', 'Chesapeake Bay Watershed', 'Patuxent River', 'Anacostia Watershed', 'Severn River', 'South River', 'Magothy River', 'Chester River'],
  VA: ['All Watersheds', 'Chesapeake Bay Watershed', 'James River', 'York River', 'Rappahannock River', 'Elizabeth River'],
  FL: ['All Watersheds', 'Pensacola Bay', 'Blackwater River', 'Escambia River', 'Santa Rosa Sound'],
  PA: ['All Watersheds', 'Chesapeake Bay Watershed', 'Susquehanna River', 'Delaware River'],
  DC: ['All Watersheds', 'Anacostia Watershed', 'Potomac River', 'Rock Creek'],
  DE: ['All Watersheds', 'Christina River', 'Brandywine Creek', 'Delaware Bay'],
  WV: ['All Watersheds', 'Shenandoah River', 'Potomac South Branch', 'Opequon Creek'],
};

function getWatershedGroups(stateAbbr: string): string[] {
  return WATERSHED_GROUPS[stateAbbr] || ['All Watersheds'];
}

// Keyword match: does a waterbody name/id match the selected watershed group?
function matchesWatershed(wb: { id: string; name: string }, watershed: string): boolean {
  if (watershed === 'All Watersheds') return true;
  const kw = watershed.toLowerCase().replace(/\s*(river|watershed|creek|bay|sound|branch)\s*/gi, '').trim();
  const n = wb.name.toLowerCase();
  const i = wb.id.toLowerCase();
  return n.includes(kw) || i.includes(kw);
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

export function NGOManagementCenter({ stateAbbr: initialStateAbbr, onSelectRegion, onToggleDevMode }: Props) {
  const [adminState, setAdminState] = useAdminState();
  const [stateAbbr, setStateAbbr] = useState(adminState || initialStateAbbr);
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const agency = STATE_AGENCIES[stateAbbr] || STATE_AUTHORITIES[stateAbbr] || null;
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── Lens switching ──
  const [viewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] || LENS_CONFIG.overview;

  // ── View state ──
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>('risk');
  const [selectedWatershed, setSelectedWatershed] = useState('All Watersheds');
  const watershedGroups = useMemo(() => getWatershedGroups(stateAbbr), [stateAbbr]);

  // Keep NGO view aligned with the global state selector in the sidebar.
  useEffect(() => {
    if (adminState && adminState !== stateAbbr) {
      setStateAbbr(adminState);
      setSelectedWatershed('All Watersheds');
      setActiveDetailId(null);
    }
  }, [adminState, stateAbbr]);

  // ── State-filtered region data ──
  const baseRegions = useMemo(() => generateStateRegionData(stateAbbr), [stateAbbr]);

  // ── Map: geo data ──
  const geoData = useMemo(() => {
    try { return getStatesGeoJSON() as any; }
    catch { return null; }
  }, []);

  const leafletGeo = STATE_GEO_LEAFLET[stateAbbr] || { center: [39.8, -98.5] as [number, number], zoom: 4 };

  // ── ATTAINS bulk for this state ──
  const [attainsBulk, setAttainsBulk] = useState<Array<{ id: string; name: string; category: string; alertLevel: AlertLevel; causes: string[]; cycle: string; lat?: number | null; lon?: number | null }>>([]);
  const [attainsBulkLoaded, setAttainsBulkLoaded] = useState(false);

  // ── Scorecard: citizen sample counts ──
  const [sampleCounts, setSampleCounts] = useState<{ approved: number; pending: number } | null>(null);
  useEffect(() => {
    Promise.all([
      fetch(`/api/uploads/samples?stateAbbr=${stateAbbr}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/uploads/pending?stateAbbr=${stateAbbr}&userRole=NGO`).then(r => r.ok ? r.json() : null),
    ]).then(([approved, pending]) => {
      setSampleCounts({
        approved: Array.isArray(approved) ? approved.length : 0,
        pending: Array.isArray(pending) ? pending.length : 0,
      });
    }).catch(() => {});
  }, [stateAbbr]);

  // ── Scorecard: metrics derived from ATTAINS ──
  const scorecardMetrics = useMemo(() => {
    if (!attainsBulkLoaded || attainsBulk.length === 0) return null;
    const total = attainsBulk.length;
    const impaired = attainsBulk.filter(w => w.alertLevel === 'high' || w.alertLevel === 'medium').length;
    const healthy = total - impaired;
    const watershedHealthPct = Math.round((healthy / total) * 100);

    const cat4a = attainsBulk.filter(w => w.category === '4a').length;
    const cat5 = attainsBulk.filter(w => w.category === '5').length;
    const restorationPct = (cat4a + cat5) > 0 ? Math.round((cat4a / (cat4a + cat5)) * 100) : 0;

    const volunteerPct = sampleCounts && (sampleCounts.approved + sampleCounts.pending) > 0
      ? Math.round((sampleCounts.approved / (sampleCounts.approved + sampleCounts.pending)) * 100)
      : null;

    const gradeFromPct = (pct: number) =>
      pct >= 93 ? 'A' : pct >= 90 ? 'A-' : pct >= 87 ? 'B+' : pct >= 83 ? 'B' :
      pct >= 80 ? 'B-' : pct >= 77 ? 'C+' : pct >= 73 ? 'C' : pct >= 70 ? 'C-' : 'D';

    const avgScore = volunteerPct != null
      ? Math.round((watershedHealthPct + restorationPct + volunteerPct) / 3)
      : Math.round((watershedHealthPct + restorationPct) / 2);

    return { watershedHealthPct, restorationPct, volunteerPct, advocacyGrade: gradeFromPct(avgScore), gradeFromPct };
  }, [attainsBulk, attainsBulkLoaded, sampleCounts]);

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
        const id = a.id || `${stateAbbr.toLowerCase()}_${a.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '')}`;
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

  // Waterbody marker coordinates — 3-priority resolution (ATTAINS centroid → regionsConfig → name-based)
  const attainsCoordMap = useMemo(() => {
    const m = new Map<string, { lat: number; lon: number }>();
    for (const a of attainsBulk) {
      if (a.lat != null && a.lon != null && a.id) m.set(a.id, { lat: a.lat, lon: a.lon });
      if (a.lat != null && a.lon != null && a.name) m.set(`name:${a.name.toLowerCase().trim()}`, { lat: a.lat, lon: a.lon });
    }
    return m;
  }, [attainsBulk]);

  const wbMarkers = useMemo(() => {
    const resolved: { id: string; name: string; lat: number; lon: number; alertLevel: AlertLevel; status: string; dataSourceCount: number }[] = [];
    for (const r of regionData) {
      const byId = attainsCoordMap.get(r.id);
      const byName = !byId ? attainsCoordMap.get(`name:${r.name.toLowerCase().trim()}`) : null;
      const attainsCoord = byId || byName;
      if (attainsCoord) {
        resolved.push({ id: r.id, name: r.name, lat: attainsCoord.lat, lon: attainsCoord.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount });
        continue;
      }
      const cfg = getRegionById(r.id) as any;
      if (cfg) {
        const lat = cfg.lat ?? cfg.latitude ?? null;
        const lon = cfg.lon ?? cfg.lng ?? cfg.longitude ?? null;
        if (lat != null && lon != null) {
          resolved.push({ id: r.id, name: r.name, lat, lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount });
          continue;
        }
      }
      const approx = resolveWaterbodyCoordinates(r.name, stateAbbr);
      if (approx) {
        resolved.push({ id: r.id, name: r.name, lat: approx.lat, lon: approx.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount });
      }
    }
    return resolved;
  }, [regionData, stateAbbr, attainsCoordMap]);

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
          id: wb.id || '',
          name: wb.name || '',
          category: wb.category || '',
          alertLevel: (wb.alertLevel || 'none') as AlertLevel,
          causes: wb.causes || [],
          cycle: '',
          lat: wb.lat ?? null,
          lon: wb.lon ?? null,
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
  const [alertFeedMinimized, setAlertFeedMinimized] = useState(true);

  // Mapbox marker data — derived from wbMarkers + current overlay
  const markerData = useMemo(() =>
    wbMarkers.map((wb) => ({
      id: wb.id,
      lat: wb.lat,
      lon: wb.lon,
      color: getMarkerColor(overlay, wb),
      name: wb.name,
      alertLevel: wb.alertLevel,
      status: wb.status,
    })),
    [wbMarkers, overlay]
  );

  // Hover state for Mapbox popups
  const [hoveredFeature, setHoveredFeature] = useState<mapboxgl.MapboxGeoJSONFeature | null>(null);
  const onMarkerMouseMove = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    setHoveredFeature(e.features?.[0] ?? null);
  }, []);
  const onMarkerMouseLeave = useCallback(() => {
    setHoveredFeature(null);
  }, []);

  // Print a single card section by its DOM id
  const printSection = (sectionId: string, title: string) => {
    const el = document.getElementById(`section-${sectionId}`);
    if (!el) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title} — PEARL ${stateName} Watershed Advocacy Center</title>
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
        <p>${stateName} · Printed ${new Date().toLocaleDateString()} · Project PEARL</p>
      </div>
      <div class="print-content">${el.innerHTML}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); }, 400);
  };
  const { waterData: rawWaterData, isLoading: waterLoading, hasRealData } = useWaterData(activeDetailId);
  const waterData = useTierFilter(rawWaterData, 'NGO');

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
    const url = `/api/water-data?action=attains-assessments&assessmentUnitName=${encodedName}&statecode=${stateAbbr}`;

    let cancelled = false;
    const tryFetch = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = await r.json();
          if (!cancelled) {
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
          }
          return;
        } catch {
          if (attempt < 2 && !cancelled) {
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
          }
        }
      }
      if (!cancelled) {
        setAttainsCache(prev => ({ ...prev, [activeDetailId]: { category: 'Unavailable', causes: [], causeCount: 0, status: '', cycle: '', loading: false } }));
      }
    };
    tryFetch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailId, regionData, stateAbbr]);

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
    const url = `/api/water-data?action=ejscreen&lat=${lat}&lng=${lng}`;

    let cancelled = false;
    const tryFetch = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (cancelled) return;
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const data = await r.json();
          if (!cancelled) {
            setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: data.ejIndex ?? null, loading: false } }));
          }
          return;
        } catch {
          if (attempt < 2 && !cancelled) {
            await new Promise(res => setTimeout(res, 1000 * Math.pow(2, attempt)));
          }
        }
      }
      if (!cancelled) {
        setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: false, error: 'failed' } }));
      }
    };
    tryFetch();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailId, regionData]);

  // ── Filtering & sorting ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low' | 'impaired' | 'monitored'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const sortedRegions = useMemo(() => {
    let filtered = regionData;
    // Watershed group filter
    if (selectedWatershed !== 'All Watersheds') {
      filtered = filtered.filter(r => matchesWatershed(r, selectedWatershed));
    }
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
  }, [regionData, searchQuery, filterLevel, selectedWatershed]);

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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ waterbodies: true, volunteer: true });
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-emerald-50 via-teal-50/30 to-cyan-50">
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

        {/* ── HERO BANNER (clean — no overlay boxes) ── */}
        <HeroBanner role="ngo" onDoubleClick={() => onToggleDevMode?.()} />

        <MissionQuote role="ngo" variant="light" />

        <LayoutEditor ccKey="NGO">
        {({ sections, isEditMode, onToggleVisibility, onToggleCollapse, collapsedSections }) => {
          const isSectionOpen = (id: string) => !collapsedSections[id];
          return (<>
        <div className={`space-y-6 ${isEditMode ? 'pl-12' : ''}`}>

        {sections.filter(s => {
          if (isEditMode) return true;
          if (!s.visible) return false;
          if (s.lensControlled && lens.sections) return lens.sections.has(s.id);
          return true;
        }).map(section => {
          const DS = (children: React.ReactNode) => (
            <DraggableSection key={section.id} id={section.id} label={section.label}
              isEditMode={isEditMode} isVisible={section.visible} onToggleVisibility={onToggleVisibility} userRole="NGO">
              {children}
            </DraggableSection>
          );
          switch (section.id) {

            case 'regprofile': return DS(
        (() => {
          const agency = STATE_AGENCIES[stateAbbr];
          const ejScore = getEJScore(stateAbbr);
          const stableHash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
          const trendVal = Math.round((stableHash01(stateAbbr + '|trend') * 100 - 50) * 10) / 10;
          const trendLabel = trendVal > 5 ? '↑ Improving' : trendVal < -5 ? '↓ Worsening' : '— Stable';
          const trendColor = trendVal > 5 ? 'text-green-700' : trendVal < -5 ? 'text-red-700' : 'text-slate-500';
          const trendBg = trendVal > 5 ? 'bg-green-50 border-green-200' : trendVal < -5 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200';
          const wbCount = regionData.length;
          const impairedCount = regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
          const highAlertCount = regionData.filter(r => r.alertLevel === 'high').length;

          return (
            <div id="section-regprofile" className="rounded-2xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('regprofile')} className="w-full flex items-center justify-between px-6 py-3 bg-emerald-50/50 hover:bg-emerald-100/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Droplets size={15} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-900">{stateName} — Watershed Health Overview{selectedWatershed !== 'All Watersheds' ? ` · ${selectedWatershed}` : ''}</span>
                </div>
                <div className="flex items-center gap-1.5">
                <span onClick={(e) => { e.stopPropagation(); printSection('regprofile', 'Watershed Health Overview'); }} className="p-1 hover:bg-emerald-200 rounded transition-colors" title="Print this section">
                  <Printer className="h-3.5 w-3.5 text-emerald-400" />
                </span>
                {isSectionOpen('regprofile') ? <Minus className="h-4 w-4 text-emerald-400" /> : <ChevronDown className="h-4 w-4 text-emerald-400" />}
              </div>
              </button>
              {isSectionOpen('regprofile') && (
              <div className="p-6">
                <div className="space-y-3 text-xs">
                  {/* Hero — total with health breakdown bar */}
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                    <div className="flex items-end gap-3 mb-3">
                      <div className="text-4xl font-extrabold text-emerald-700">{wbCount}</div>
                      <div className="text-xs text-emerald-600 font-medium pb-1">Waterbodies Tracked</div>
                    </div>
                    {wbCount > 0 && (
                      <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex">
                        {highAlertCount > 0 && <div className="h-full bg-red-400" style={{ width: `${(highAlertCount / wbCount) * 100}%` }} title={`${highAlertCount} Critical`} />}
                        {(impairedCount - highAlertCount) > 0 && <div className="h-full bg-amber-400" style={{ width: `${((impairedCount - highAlertCount) / wbCount) * 100}%` }} title={`${impairedCount - highAlertCount} Impaired`} />}
                        <div className="h-full bg-green-400 flex-1" title={`${wbCount - impairedCount} Healthy`} />
                      </div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-[10px]">
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-400" /> {highAlertCount} Critical</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" /> {impairedCount - highAlertCount} Impaired</span>
                      <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-400" /> {wbCount - impairedCount} Healthy</span>
                    </div>
                  </div>
                  {/* Secondary metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-xl bg-purple-50 border border-purple-200 p-3 flex items-center gap-3">
                      <div className="text-2xl font-bold text-purple-700">{ejScore}<span className="text-xs font-normal text-purple-400">/100</span></div>
                      <div>
                        <div className="text-[10px] text-purple-500 font-medium">EJ Vulnerability</div>
                        <div className="mt-1 h-1.5 w-16 rounded-full bg-purple-100 overflow-hidden"><div className="h-full rounded-full bg-purple-500" style={{ width: `${ejScore}%` }} /></div>
                      </div>
                    </div>
                    <div className="rounded-xl bg-teal-50 border border-teal-200 p-3 flex items-center gap-3">
                      <div className="text-2xl font-bold text-teal-700">—</div>
                      <div className="text-[10px] text-teal-500 font-medium">Volunteer Monitors</div>
                    </div>
                    <div className={`rounded-xl border p-3 flex items-center gap-3 ${trendBg}`}>
                      <div className={`text-lg font-bold ${trendColor}`}>{trendLabel}</div>
                      <div className="text-[10px] text-slate-400">WQ Trend</div>
                    </div>
                  </div>
                </div>
                {(() => {
                  const agencyNotes = agency?.division;
                  return agencyNotes ? (
                    <div className="text-[10px] text-slate-400 italic mt-2">State agency: {agency?.name} — {agencyNotes}</div>
                  ) : null;
                })()}
              </div>
              )}
            </div>
          );
        })()
            );

            case 'insights': return DS(
              <AIInsightsEngine key={stateAbbr} role="NGO" stateAbbr={stateAbbr} regionData={regionData as any} />
            );

            case 'alertfeed': return DS(
        (() => {
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
        })()
            );

            case 'map-grid': return DS(
        <div className="space-y-4">
          {/* State & Watershed Lookup */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-emerald-600" />
              <span className="text-xs font-semibold text-slate-700">Location</span>
            </div>
            <select
              value={stateAbbr}
              onChange={(e) => {
                const next = e.target.value;
                setStateAbbr(next);
                setAdminState(next);
                setSelectedWatershed('All Watersheds');
                setActiveDetailId(null);
              }}
              className="h-8 px-3 text-xs font-medium rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                <option key={abbr} value={abbr}>{name}</option>
              ))}
            </select>
            {watershedGroups.length > 1 && (
              <select
                value={selectedWatershed}
                onChange={(e) => setSelectedWatershed(e.target.value)}
                className="h-8 px-3 text-xs font-medium rounded-md border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {watershedGroups.map(ws => (
                  <option key={ws} value={ws}>{ws}</option>
                ))}
              </select>
            )}
            <span className="text-[10px] text-slate-400 ml-auto">{regionData.length.toLocaleString()} waterbodies</span>
          </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT: State Map (2/3 width — matches NCC layout) */}
          <Card className="lg:col-span-2 rounded-2xl border-2 border-emerald-200">
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

              {!geoData ? (
                <div className="p-8 text-sm text-slate-500 text-center">
                  Map data unavailable.
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="p-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span>{stateName} · {regionData.length} waterbodies monitored</span>
                    {attainsBulkLoaded && <span className="text-green-600 font-medium">● ATTAINS live</span>}
                  </div>
                  <div className="h-[480px] w-full relative">
                    <MapboxMapShell
                      center={leafletGeo.center}
                      zoom={leafletGeo.zoom}
                      height="100%"
                      mapKey={stateAbbr}
                      interactiveLayerIds={['ngo-markers']}
                      onMouseMove={onMarkerMouseMove}
                      onMouseLeave={onMarkerMouseLeave}
                    >
                      <MapboxMarkers
                        data={markerData}
                        layerId="ngo-markers"
                        radius={5}
                        hoveredFeature={hoveredFeature}
                      />
                    </MapboxMapShell>
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
          <Card className="lg:col-span-1 rounded-2xl border-2 border-emerald-200">
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
                  const avgScore = alertLevelAvgScore(assessed);
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
        </div>
            );

            case 'detail': return DS(
        <>
        <div className="space-y-4">

            {/* No selection state */}
            {!activeDetailId && (
              <Card className="border-2 border-dashed border-slate-300 bg-white/50">
                <div className="p-6">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search waterbodies for conservation..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                      readOnly
                    />
                  </div>
                  <div className="text-center text-slate-400">
                    <MapPin className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs">Or click a marker on the map to view waterbody details</p>
                  </div>
                </div>
              </Card>
            )}

            {/* Waterbody Detail Card */}
            {activeDetailId && (() => {
              const nccRegion = regionData.find(r => r.id === activeDetailId);
              const regionConfig = getRegionById(activeDetailId);
              const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const bulkMatch = resolveBulkAttains(regionName);

              return (
                <WaterbodyDetailCard
                  regionName={regionName}
                  stateAbbr={stateAbbr}
                  stateName={stateName}
                  alertLevel={nccRegion?.alertLevel || 'none'}
                  activeAlerts={nccRegion?.activeAlerts ?? 0}
                  lastUpdatedISO={nccRegion?.lastUpdatedISO}
                  waterData={waterData}
                  waterLoading={waterLoading}
                  hasRealData={hasRealData}
                  attainsPerWb={attainsCache[activeDetailId]}
                  attainsBulk={bulkMatch}
                  ejData={ejCache[activeDetailId]}
                  ejDetail={getEJData(stateAbbr)}
                  ecoScore={getEcoScore(stateAbbr)}
                  ecoData={getEcoData(stateAbbr)}
                  stSummary={stateSummaryCache[stateAbbr]}
                  stateAgency={STATE_AGENCIES[stateAbbr]}
                  dataSources={DATA_SOURCES}
                  onToast={(msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 2500); }}
                />
              );
            })()}

            {/* Restoration Plan — NCC-matching collapsible with Deploy/PDF/Cost buttons */}
            {showRestorationPlan && activeDetailId && (() => {
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

                      {/* Why PIN */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Site Assessment — {regionName}</div>
                        {whyBullets.map((b, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="flex-shrink-0 mt-0.5">{b.icon}</span>
                            <div>
                              <span className="text-red-700 font-medium">{b.problem}</span>
                              <span className="text-slate-400 mx-1">—</span>
                              <span className="text-slate-600">{b.implication}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Impairment classification */}
                      {impairmentClassification.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                            Impairment Classification ({impairmentClassification.length} causes · {addressabilityPct}% PIN-addressable)
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

                    </CardContent>
                  )}
                </Card>
              );
            })()}
          </div>


        {/* ── STATEWIDE COMPONENTS — shown when a waterbody is selected AND mock data is available ── */}
        {activeDetailId && displayData && regionMockData && (
          <div className="space-y-4">

            {/* Environmental Justice — Census ACS + EPA SDWIS (statewide) + EJScreen (per-waterbody) */}
            {(() => {
              const ejScore = getEJScore(stateAbbr);
              const ejDetail = getEJData(stateAbbr);
              if (!ejDetail) return null;
              const label = ejScoreLabel(ejScore);
              const { bg: scoreBg, border: scoreBorder } = ejScoreStyle(ejScore);
              // Per-waterbody EJScreen
              const wbEJ = activeDetailId ? ejCache[activeDetailId] : null;
              const wbEJScore = wbEJ?.ejIndex ?? null;
              const wbEJLoading = wbEJ?.loading ?? false;
              const wbName = (() => {
                const rc = getRegionById(activeDetailId || '');
                const nr = regionData.find(r => r.id === activeDetailId);
                return rc?.name || nr?.name || (activeDetailId || '').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
              })();
              const wbScoreBg = wbEJScore !== null ? ejScoreStyle(wbEJScore).bg : 'bg-slate-400';
              // Statewide rollup from ejCache
              const highEJWaterbodies = Object.entries(ejCache).filter(([, v]) => v.ejIndex !== null && v.ejIndex !== undefined && v.ejIndex >= 60).length;
              const totalEJCached = Object.entries(ejCache).filter(([, v]) => v.ejIndex !== null && v.ejIndex !== undefined).length;
              return (
                <div className={`rounded-xl border ${scoreBorder} bg-white shadow-sm overflow-hidden`}>
                  <button onClick={() => onToggleCollapse('ej')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
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
        </>
            );

            case 'top10': return DS(
        <div id="section-top10" className="rounded-2xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('top10')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
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
                        onClick={(e) => { e.stopPropagation(); onToggleCollapse('potomac'); }}
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
            );

            case 'volunteer': return DS(
        <Card id="section-volunteer" className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/30 to-white">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('volunteer')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-green-600" />
                Volunteer Monitoring Network
              </CardTitle>
              {expandedSections.volunteer ? (
                <div className="flex items-center gap-1.5">
                  <span onClick={(e) => { e.stopPropagation(); printSection('volunteer', 'Volunteer Monitoring Network'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                    <Printer className="h-3.5 w-3.5 text-slate-400" />
                  </span>
                  <Minus className="h-4 w-4 text-slate-400" />
                </div>
              ) : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            <CardDescription>Coordinate citizen science water quality monitoring across {stateName} watersheds</CardDescription>
          </CardHeader>
          {expandedSections.volunteer && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg border border-green-200 p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">—</div>
                  <div className="text-xs text-green-600">Active Volunteers</div>
                </div>
                <div className="bg-white rounded-lg border border-blue-200 p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">—</div>
                  <div className="text-xs text-blue-700">Monitoring Sites</div>
                </div>
                <div className="bg-white rounded-lg border border-amber-200 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-600">—</div>
                  <div className="text-xs text-amber-700">Samples This Month</div>
                </div>
                <div className="bg-white rounded-lg border border-purple-200 p-3 text-center">
                  <div className="text-2xl font-bold text-purple-600">—</div>
                  <div className="text-xs text-purple-700">Data Quality Score</div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-green-800 mb-2">📋 Scaffold: VolunteerMonitoringHub</div>
                <p className="text-xs text-green-700 leading-relaxed">
                  Volunteer scheduling & site assignment, field kit tracking, sample collection protocols (EPA-approved citizen science methods),
                  QA/QC review workflow, data submission to Water Quality Portal (WQX format), training certifications, and seasonal campaign management.
                </p>
              </div>
            </CardContent>
          )}
        </Card>
            );

            case 'community': return DS(
        <>
        {/* ── WATER QUALITY CHALLENGES — core advocacy content ── */}
        <div className="rounded-2xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-white shadow-sm overflow-hidden p-6">
          <WaterQualityChallenges context="ngo" />
        </div>

        {/* ── ECOLOGICAL RESTORATION — turtle habitat (MD only) / oyster restoration (all other states) ── */}
        <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden mt-6">
          <div className="relative w-full h-[240px] md:h-[320px]">
            <Image
              src={stateAbbr === 'MD' ? '/turtle-eggs-solution.png' : '/oyster-restoration.png'}
              alt={stateAbbr === 'MD'
                ? "Turtle nesting habitat restoration — protecting Maryland's state reptile through water quality improvement"
                : 'Oyster reef restoration — community-driven biofiltration improving coastal water quality'}
              fill
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
              <div className="text-xs font-semibold text-teal-300 uppercase tracking-wide mb-1">Species &amp; Habitat Protection</div>
              <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">Why Clean Water Matters for Wildlife</h3>
              <p className="text-sm text-white/80 max-w-2xl leading-relaxed mb-3">
                {stateAbbr === 'MD'
                  ? "Impaired waterways threaten nesting habitats, egg viability, and juvenile survival for turtles, shorebirds, and other species that depend on healthy watersheds. PEARL monitoring data connects water quality metrics directly to ecological outcomes."
                  : 'Degraded water quality threatens aquatic ecosystems, from shellfish reefs to shorebird habitats. PEARL monitoring data connects water quality metrics directly to ecological outcomes, enabling targeted restoration and species protection.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30 backdrop-blur-sm">Habitat Restoration</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30 backdrop-blur-sm">Species Protection</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30 backdrop-blur-sm">Water Quality Nexus</span>
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white border border-white/30 backdrop-blur-sm">EJ Communities</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── COMMUNITY ENGAGEMENT & PUBLIC TRANSPARENCY ── */}
        <div id="section-community" className="mt-6 rounded-2xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('community')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">📢 Community Engagement & Public Transparency</span>
            <div className="flex items-center gap-1.5">
              <span onClick={(e) => { e.stopPropagation(); printSection('community', 'Community Engagement & Public Transparency'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                <Printer className="h-3.5 w-3.5 text-slate-400" />
              </span>
              {isSectionOpen('community') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('community') && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">🌐 Public Dashboard</div>
                  <p className="text-[10px] text-slate-500">Share real-time watershed health data with community members. Embeddable widgets for your website, social media shareable cards, and printable community reports.</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">📬 Community Alerts</div>
                  <p className="text-[10px] text-slate-500">Automated email/SMS alerts when waterbody conditions change. Swimming advisories, fish consumption warnings, and spill notifications for subscribed community members.</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">📊 Annual Watershed Report Card</div>
                  <p className="text-[10px] text-slate-500">Auto-generated annual report card grading each waterbody A-F. Designed for public meetings, grant applications, and media outreach. PDF export with branded templates.</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">🗺️ Story Maps</div>
                  <p className="text-[10px] text-slate-500">Interactive narrative maps showing watershed health over time. Before/after comparisons, restoration success stories, and community impact visualizations.</p>
                </div>
              </div>
            </div>
          )}
        </div>
        </>
            );

            case 'policy': return DS(
        <div id="section-policy" className="rounded-2xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('policy')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">⚖️ Policy Advocacy Toolkit</span>
            <div className="flex items-center gap-1.5">
              <span onClick={(e) => { e.stopPropagation(); printSection('policy', 'Policy Advocacy Toolkit'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                <Printer className="h-3.5 w-3.5 text-slate-400" />
              </span>
              {isSectionOpen('policy') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('policy') && (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-amber-800">📜 CWA §303(d) Tracker</div>
                  <p className="text-[10px] text-amber-700 mt-1">Track impaired waters listings, TMDL development timelines, and delisting progress. Generate public comment templates for Integrated Report cycles.</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-blue-800">🏛️ Permit Watchdog</div>
                  <p className="text-[10px] text-blue-700 mt-1">Monitor NPDES permit renewals, public comment periods, and enforcement actions via EPA ECHO. Alert when permits affecting your watersheds are up for renewal.</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-purple-800">📝 Testimony Generator</div>
                  <p className="text-[10px] text-purple-700 mt-1">Data-backed testimony templates for state legislature, county council, and public hearings. Auto-populate with local waterbody conditions, trends, and EJ data.</p>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-slate-700 mb-1">📋 Scaffold: PolicyAdvocacyToolkit</div>
                <p className="text-[10px] text-slate-500">Legislative tracking, public comment automation, coalition builder, media kit generator, and data-driven advocacy briefs. Integrates with state legislative calendars and EPA docket system.</p>
              </div>
            </div>
          )}
        </div>
            );

            case 'partners': return DS(
        <div id="section-partners" className="rounded-2xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('partners')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">🤝 Watershed Partnership Network</span>
            <div className="flex items-center gap-1.5">
              <span onClick={(e) => { e.stopPropagation(); printSection('partners', 'Watershed Partnership Network'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                <Printer className="h-3.5 w-3.5 text-slate-400" />
              </span>
              {isSectionOpen('partners') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('partners') && (
            <div className="p-4 space-y-3">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
                <div className="text-sm font-semibold text-teal-800 mb-2">📋 Scaffold: PartnershipNetwork</div>
                <p className="text-xs text-teal-700 leading-relaxed">
                  Directory of allied organizations (other NGOs, land trusts, watershed associations, riverkeepers), shared campaign coordination,
                  joint grant applications, inter-organizational data sharing agreements, and coalition letter tools.
                  Integrates with National Estuary Program, Chesapeake Bay Foundation network, and state watershed association directories.
                </p>
              </div>
            </div>
          )}
        </div>
            );

            case 'grants': return DS(
        activeDetailId && displayData && regionMockData ? (
          <div id="section-grants" className="rounded-2xl border-l-4 border-l-emerald-500 border border-emerald-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => onToggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">🌱 Grant & Funding Opportunities — {stateName}</span>
              <div className="flex items-center gap-1.5">
                <span onClick={(e) => { e.stopPropagation(); printSection('grants', 'Grant & Funding Opportunities'); }} className="p-1 hover:bg-slate-200 rounded transition-colors" title="Print this section">
                  <Printer className="h-3.5 w-3.5 text-slate-400" />
                </span>
                {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>
            {isSectionOpen('grants') && (
              <GrantOpportunityMatcher
                regionId={activeDetailId}
                removalEfficiencies={removalEfficiencies as any}
                alertsCount={regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length}
                userRole="NGO"
                stateAbbr={stateAbbr}
              />
            )}
          </div>
        ) : null
            );

            case 'trends-dashboard': return DS(
        (() => { return (
        <Card>
          <CardHeader>
            <CardTitle>Watershed & Impact Trends</CardTitle>
            <CardDescription>Water quality trajectories, community engagement metrics, and 5-year watershed recovery outlook</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trend KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Watershed Health', value: '↑ 6.1%', sub: 'composite index improvement', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Volunteer Hours', value: '↑ 18%', sub: 'year-over-year growth', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Advocacy Wins', value: '7', sub: 'policy actions this year', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Grant Success', value: '68%', sub: 'application award rate', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
              ].map(t => (
                <div key={t.label} className={`rounded-xl border p-4 ${t.bg}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.label}</div>
                  <div className={`text-2xl font-bold ${t.color} mt-1`}>{t.value}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{t.sub}</div>
                </div>
              ))}
            </div>

            {/* Category Trend Cards */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Watershed & Advocacy Trends</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { category: 'Water Quality Trajectory', trend: 'Improving', detail: 'Monitored streams showing 6.1% improvement in composite health index. Dissolved oxygen levels rising in 4 priority reaches.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Community Engagement', trend: 'Growing', detail: 'Volunteer monitoring participation up 18%. 12 new citizen science groups trained. Community cleanups removed 14 tons of debris.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Policy Influence', trend: 'Strong', detail: '7 policy actions supported this year including 2 new buffer ordinances and 1 stormwater fee adoption. Testimony provided at 15 hearings.', color: 'text-blue-700', bg: 'border-blue-200' },
                  { category: 'Restoration Outcomes', trend: 'On Track', detail: '23 acres of riparian buffer planted. 8 stream restoration projects completed. Fish passage restored at 3 barrier sites.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Funding Landscape', trend: 'Competitive', detail: 'Grant funding up 12% but applicant pool grew 25%. Federal infrastructure funds creating new restoration opportunities.', color: 'text-amber-700', bg: 'border-amber-200' },
                  { category: 'Partner Network', trend: 'Expanding', detail: '6 new organizational partnerships formed. Cross-watershed collaboration increased with 3 joint monitoring programs launched.', color: 'text-blue-700', bg: 'border-blue-200' },
                ].map(c => (
                  <div key={c.category} className={`border rounded-lg p-4 ${c.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-slate-800">{c.category}</h4>
                      <Badge variant="outline" className={`text-[10px] ${c.color}`}>{c.trend}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{c.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Outlook */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">5-Year Watershed Recovery Projection</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { scenario: 'Sustained Effort', impacts: ['3 additional stream segments expected to meet water quality standards', 'Volunteer network projected to reach 500+ active monitors', 'Riparian buffer coverage target of 60% achievable by 2030'] },
                  { scenario: 'Challenges Ahead', impacts: ['Climate variability may offset restoration gains in 2 watersheds', 'Volunteer retention requires expanded training and recognition programs', 'Aging infrastructure upstream could introduce new impairment sources'] },
                ].map(s => (
                  <div key={s.scenario} className="border border-slate-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">{s.scenario}</h4>
                    <ul className="space-y-1.5">
                      {s.impacts.map(imp => (
                        <li key={imp} className="text-xs text-slate-600 flex items-start gap-2">
                          <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0 mt-0.5" />
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 italic">
              Projections based on volunteer monitoring data, restoration project tracking, and watershed health assessments. Actual values will populate as historical snapshots accumulate.
            </div>
          </CardContent>
        </Card>
        ); })());

            // ── Shared panels ──
            case 'resolution-planner': return DS(<ResolutionPlanner userRole="ngo" scopeContext={{ scope: 'state', data: { abbr: stateAbbr, name: STATE_NAMES[stateAbbr] || stateAbbr, epaRegion: getEpaRegionForState(stateAbbr) || 0, totalWaterbodies: regionData.length, assessed: regionData.length, impaired: regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length, score: alertLevelAvgScore(regionData), grade: 'B', cat5: 0, cat4a: 0, cat4b: 0, cat4c: 0, topCauses: [] } }} />);
            case 'policy-tracker': return DS(<PolicyTracker />);
            case 'contaminants-tracker': return DS(<EmergingContaminantsTracker role="ngo" selectedState={stateAbbr} />);
            case 'icis': return DS(<ICISCompliancePanel state={stateAbbr} compactMode={false} />);
            case 'sdwis': return DS(<SDWISCompliancePanel state={stateAbbr} compactMode={false} />);
            case 'groundwater': return DS(<NwisGwPanel state={stateAbbr} compactMode={false} />);
            case 'disaster-emergency-panel': return DS(<DisasterEmergencyPanel selectedState={stateAbbr} stateRollup={[]} />);
            case 'scorecard-kpis': {
              const kpis = scorecardMetrics
                ? [
                    { label: 'Watershed Health', value: `${scorecardMetrics.watershedHealthPct}%`, color: scorecardMetrics.watershedHealthPct >= 70 ? 'text-green-600' : 'text-amber-600', bg: scorecardMetrics.watershedHealthPct >= 70 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200' },
                    { label: 'Volunteer Engagement', value: scorecardMetrics.volunteerPct != null ? `${scorecardMetrics.volunteerPct}%` : '—', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                    { label: 'Restoration Progress', value: `${scorecardMetrics.restorationPct}%`, color: scorecardMetrics.restorationPct >= 50 ? 'text-green-600' : 'text-amber-600', bg: scorecardMetrics.restorationPct >= 50 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200' },
                    { label: 'Advocacy Impact', value: scorecardMetrics.advocacyGrade, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                  ]
                : null;
              return DS(
                <Card><CardHeader><CardTitle>Conservation Program Scorecard</CardTitle><CardDescription>Key performance indicators for watershed conservation</CardDescription></CardHeader>
                <CardContent>
                  {!attainsBulkLoaded ? (
                    <div className="flex items-center justify-center py-8 text-sm text-slate-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400 mr-2" />Loading ATTAINS data…</div>
                  ) : kpis ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {kpis.map(k => <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div><div className={`text-2xl font-bold ${k.color} mt-1`}>{k.value}</div></div>)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[{ label: 'Watershed Health', value: '—', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' },
                        { label: 'Volunteer Engagement', value: '—', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' },
                        { label: 'Restoration Progress', value: '—', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' },
                        { label: 'Advocacy Impact', value: '—', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' }
                      ].map(k => <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div><div className={`text-2xl font-bold ${k.color} mt-1`}>{k.value}</div></div>)}
                    </div>
                  )}
                </CardContent></Card>
              );
            }
            case 'scorecard-grades': {
              const grades = scorecardMetrics
                ? [
                    { area: 'Watershed Restoration', grade: scorecardMetrics.gradeFromPct(scorecardMetrics.restorationPct) },
                    { area: 'Community Engagement', grade: scorecardMetrics.volunteerPct != null ? scorecardMetrics.gradeFromPct(scorecardMetrics.volunteerPct) : '—' },
                    { area: 'Policy Advocacy', grade: scorecardMetrics.gradeFromPct(scorecardMetrics.watershedHealthPct) },
                  ]
                : null;
              return DS(
                <Card><CardHeader><CardTitle>Program Grades</CardTitle></CardHeader>
                <CardContent>
                  {!attainsBulkLoaded ? (
                    <div className="flex items-center justify-center py-8 text-sm text-slate-500"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-400 mr-2" />Loading…</div>
                  ) : grades ? (
                    <div className="grid grid-cols-3 gap-3">
                      {grades.map(g => {
                        const s = g.grade !== '—' ? scoreToGrade(g.grade === 'A' ? 93 : g.grade === 'A-' ? 90 : g.grade === 'B+' ? 87 : g.grade === 'B' ? 83 : g.grade === 'B-' ? 80 : g.grade === 'C+' ? 77 : g.grade === 'C' ? 73 : g.grade === 'C-' ? 70 : 60) : { color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' };
                        return <div key={g.area} className={`text-center p-4 border rounded-lg ${s.bg}`}><div className={`text-3xl font-bold ${s.color}`}>{g.grade}</div><div className="text-xs text-slate-500 mt-1">{g.area}</div></div>;
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {[{ area: 'Watershed Restoration', grade: '—' }, { area: 'Community Engagement', grade: '—' }, { area: 'Policy Advocacy', grade: '—' }].map(g =>
                        <div key={g.area} className="text-center p-4 border rounded-lg"><div className="text-3xl font-bold text-slate-400">{g.grade}</div><div className="text-xs text-slate-500 mt-1">{g.area}</div></div>
                      )}
                    </div>
                  )}
                </CardContent></Card>
              );
            }
            case 'reports-hub': return DS(
              <Card><CardHeader><CardTitle>Impact Reports</CardTitle><CardDescription>Generated reports and impact documentation</CardDescription></CardHeader>
              <CardContent><div className="space-y-2">
                {['Annual Impact Report', 'Watershed Health Assessment', 'Volunteer Program Summary', 'Advocacy Outcomes Report'].map(r =>
                  <div key={r} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"><span className="text-sm text-slate-700">{r}</span><Badge variant="outline" className="text-[10px]">Generate</Badge></div>
                )}
              </div></CardContent></Card>
            );

            // ── NGO exclusive panels ──
            case 'watershed-health-panel': return DS(<WatershedHealthPanel stateAbbr={stateAbbr} />);
            case 'restoration-projects-panel': return DS(<RestorationProjectsPanel stateAbbr={stateAbbr} />);
            case 'advocacy-panel': return DS(<AdvocacyPanel stateAbbr={stateAbbr} />);
            case 'volunteer-program-panel': return DS(<VolunteerProgramPanel stateAbbr={stateAbbr} />);
            case 'citizen-reporting-panel': return DS(<CitizenReportingPanel stateAbbr={stateAbbr} />);
            case 'initiatives-panel': return DS(<InitiativesTrackerPanel stateAbbr={stateAbbr} />);

            case 'location-report': return DS(<LocationReportCard />);

            // ── Habitat & Ecology ──
            case 'hab-ecoscore': {
              const ecoData = getEcoData(stateAbbr);
              const ecoScore = getEcoScore(stateAbbr);
              const label = ecoScoreLabel(ecoScore);
              const scoreBg = ecoScoreStyle(ecoScore).bg;
              return DS(
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Leaf className="h-5 w-5 text-emerald-600" />
                      Conservation Priority — {stateName}
                    </CardTitle>
                    <CardDescription>ESA-listed species and ecological sensitivity</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className={`rounded-xl border p-4 flex items-center justify-between ${scoreBg}`}>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Eco Score</div>
                        <div className="text-xs opacity-80 mt-1">
                          {ecoData ? `${ecoData.totalTE} T&E species · ${ecoData.aquaticTE} aquatic · ${ecoData.criticalHabitat} critical habitat` : 'No T&E data available'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold">{ecoScore}</div>
                        <Badge variant="outline" className="text-[10px] mt-1">{label}</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            case 'hab-wildlife': {
              const teData = getEcoData(stateAbbr);
              const federalAquatic = teData?.aquaticTE ?? 0;
              const federalTotal = teData?.totalTE ?? 0;
              const critHab = teData?.criticalHabitat ?? 0;
              const aquaticPct = federalTotal > 0 ? ((federalAquatic / federalTotal) * 100).toFixed(0) : '0';
              const critPct = federalTotal > 0 ? ((critHab / federalTotal) * 100).toFixed(0) : '0';
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bug className="h-5 w-5 text-rose-600" />
                      Threatened & Endangered Species — {stateName}
                      <Badge variant="secondary" className="ml-1 text-[10px]">USFWS ECOS</Badge>
                    </CardTitle>
                    <CardDescription>ESA-listed species in your watershed — informs conservation and restoration advocacy</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-xl border p-4 bg-slate-50 border-slate-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total T&E</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{federalTotal}</div>
                        <div className="text-[10px] text-slate-400">Federal ESA</div>
                      </div>
                      <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Aquatic T&E</div>
                        <div className="text-2xl font-bold text-blue-700 mt-1">{federalAquatic}</div>
                        <div className="text-[10px] text-slate-400">Freshwater / marine</div>
                      </div>
                      <div className="rounded-xl border p-4 bg-rose-50 border-rose-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Critical Habitat</div>
                        <div className="text-2xl font-bold text-rose-700 mt-1">{critHab}</div>
                        <div className="text-[10px] text-slate-400">Designated areas</div>
                      </div>
                      <div className="rounded-xl border p-4 bg-amber-50 border-amber-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Eco Score</div>
                        <div className="text-2xl font-bold text-amber-700 mt-1">{getEcoScore(stateAbbr)}</div>
                        <div className="text-[10px] text-slate-400">{ecoScoreLabel(getEcoScore(stateAbbr))}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="flex items-center gap-1 text-slate-600"><Fish size={12} /> Aquatic species ratio</span>
                          <span className="font-semibold text-blue-700">{aquaticPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${aquaticPct}%` }} />
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="flex items-center gap-1 text-slate-600"><ShieldAlert size={12} /> Critical habitat coverage</span>
                          <span className="font-semibold text-rose-700">{critPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${critPct}%` }} />
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 italic">Source: USFWS ECOS — ESA-listed species by state (2024-2025)</p>
                  </CardContent>
                </Card>
              );
            }

            case 'fund-active': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    My Active Grants
                  </CardTitle>
                  <CardDescription>Currently active grant awards and their status.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { grant: 'EPA 319(h) Watershed Restoration', amount: '$275,000', period: '2024-2027', remaining: '$180,000', status: 'Active' },
                      { grant: 'NFWF Five Star & Urban Waters', amount: '$50,000', period: '2025-2026', remaining: '$42,000', status: 'Active' },
                      { grant: 'State Chesapeake Bay Trust', amount: '$95,000', period: '2025-2027', remaining: '$95,000', status: 'New' },
                    ].map((g, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{g.grant}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{g.amount}</span>
                          <span className="text-slate-400">{g.period}</span>
                          <span className="text-slate-500">Rem: {g.remaining}</span>
                          <Badge variant="outline" className={`text-[9px] ${g.status === 'New' ? 'border-blue-300 text-blue-700' : 'border-green-300 text-green-700'}`}>{g.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Grants management system, SAM.gov, foundation portals</p>
                </CardContent>
              </Card>
            );

            case 'fund-pipeline': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Opportunity Pipeline
                  </CardTitle>
                  <CardDescription>Upcoming grant opportunities and application pipeline.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { opportunity: 'EPA Environmental Education Grant', amount: 'Up to $100K', deadline: 'May 2026', status: 'Preparing' },
                      { opportunity: 'NFWF Chesapeake Bay Stewardship', amount: 'Up to $500K', deadline: 'Jul 2026', status: 'Eligible' },
                      { opportunity: 'NOAA Community Resilience Grant', amount: 'Up to $300K', deadline: 'Sep 2026', status: 'Researching' },
                    ].map((o, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{o.opportunity}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{o.amount}</span>
                          <span className="text-slate-400">Due: {o.deadline}</span>
                          <Badge variant="outline" className={`text-[9px] ${o.status === 'Preparing' ? 'border-amber-300 text-amber-700' : o.status === 'Eligible' ? 'border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600'}`}>{o.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Grants.gov, NFWF, foundation RFPs</p>
                </CardContent>
              </Card>
            );

            // ═══════════════════════════════════════════════════════════════════
            // POLITICAL BRIEFING SECTIONS
            // ═══════════════════════════════════════════════════════════════════

            case 'pol-talking-points': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Megaphone size={15} className="text-purple-600" /> Talking Points
                  </CardTitle>
                  <CardDescription>Auto-generated for briefings and public comment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">Lead</Badge>
                    <p>&ldquo;Our jurisdiction has replaced 340 of 1,200 identified lead service lines — 28% complete, ahead of the national average of 18%.&rdquo;</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-emerald-100 text-emerald-800 shrink-0">Grant</Badge>
                    <p>&ldquo;We secured $2.1M in DWSRF funding this quarter for water main rehabilitation, leveraging a 20% local match.&rdquo;</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">Quality</Badge>
                    <p>&ldquo;Water quality testing shows zero MCL exceedances for the 8th consecutive quarter across all 3 public water systems.&rdquo;</p>
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-constituent-concerns': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users size={15} className="text-purple-600" /> Constituent Concerns
                  </CardTitle>
                  <CardDescription>Top issues by volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { issue: 'Lead service line replacement timeline', calls: 47, trend: '↑ 23%' },
                      { issue: 'Water rate increase explanation', calls: 31, trend: '↓ 8%' },
                      { issue: 'Stormwater flooding on Oak Ave', calls: 18, trend: '↑ 45%' },
                      { issue: 'PFAS in drinking water', calls: 12, trend: '— stable' },
                    ].map(c => (
                      <div key={c.issue} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-slate-700">{c.issue}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{c.calls} contacts</Badge>
                          <span className="text-xs text-slate-500">{c.trend}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-funding-wins': return DS(
              <Card className="border-emerald-200 bg-emerald-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Banknote size={15} className="text-emerald-600" /> Funding Wins
                  </CardTitle>
                  <CardDescription>Recent awards and approvals</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { title: '$2.1M DWSRF Award', desc: 'Drinking Water State Revolving Fund — water main rehabilitation project approved Jan 2026.' },
                    { title: '$850K EPA WIIN Grant', desc: 'Water Infrastructure Improvements for the Nation — lead service line inventory and replacement.' },
                    { title: '$340K State 319 Grant', desc: 'Nonpoint source pollution control for Deer Creek watershed — BMP installation.' },
                  ].map(f => (
                    <div key={f.title} className="flex items-start gap-2 border border-emerald-200 rounded-lg px-4 py-2.5 bg-white">
                      <Badge className="bg-emerald-100 text-emerald-800 shrink-0">&#10003;</Badge>
                      <div><p className="text-sm font-medium text-slate-800">{f.title}</p><p className="text-xs text-slate-500">{f.desc}</p></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );

            case 'pol-funding-risks': return DS(
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-600" /> Funding Risks
                  </CardTitle>
                  <CardDescription>Expiring or at-risk funding</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2 border border-amber-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">&#9888;</Badge>
                    <div><p className="text-sm font-medium text-slate-800">ARPA Funds Expiring</p><p className="text-xs text-slate-500">$1.2M remaining ARPA allocation must be obligated by Dec 2026. Currently $480K unobligated.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-red-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-red-100 text-red-800 shrink-0">!</Badge>
                    <div><p className="text-sm font-medium text-slate-800">SRF Match Shortfall</p><p className="text-xs text-slate-500">FY2027 SRF application requires $600K local match. Current reserve: $410K — $190K gap.</p></div>
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-regulatory-deadlines': return DS(
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock size={15} className="text-amber-600" /> Regulatory Deadlines
                  </CardTitle>
                  <CardDescription>Upcoming compliance milestones</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { deadline: 'Mar 15, 2026', item: 'MS4 Annual Report due to state', daysLeft: 15, urgent: true },
                    { deadline: 'Jun 30, 2026', item: 'Lead Service Line Inventory submission', daysLeft: 122, urgent: false },
                    { deadline: 'Oct 1, 2026', item: 'PFAS monitoring results due to EPA', daysLeft: 215, urgent: false },
                    { deadline: 'Dec 31, 2026', item: 'ARPA fund obligation deadline', daysLeft: 306, urgent: true },
                  ].map(d => (
                    <div key={d.item} className="flex items-center justify-between border border-slate-200 rounded-lg px-4 py-2.5 bg-white">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{d.deadline} — {d.daysLeft} days</p>
                        <p className="text-xs text-slate-500">{d.item}</p>
                      </div>
                      <Badge className={d.urgent ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}>{d.urgent ? 'Soon' : 'On Track'}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );

            case 'pol-ej-exposure': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Heart size={15} className="text-purple-600" /> EJ Exposure Summary
                  </CardTitle>
                  <CardDescription>Politically sensitive EJ indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2 border border-amber-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">&#9888;</Badge>
                    <div><p className="text-sm font-medium text-slate-800">3 EJ Census Tracts</p><p className="text-xs text-slate-500">Tracts 240101, 240105, 240112 exceed 80th percentile on EJScreen composite index. Combined population: 14,200.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-red-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-red-100 text-red-800 shrink-0">!</Badge>
                    <div><p className="text-sm font-medium text-slate-800">Disproportionate Impact</p><p className="text-xs text-slate-500">Lead service lines are 3.2x more concentrated in EJ tracts vs. non-EJ areas. Prioritize replacement schedule.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-emerald-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-emerald-100 text-emerald-800 shrink-0">&#10003;</Badge>
                    <div><p className="text-sm font-medium text-slate-800">Justice40 Eligible</p><p className="text-xs text-slate-500">2 of 3 EJ tracts qualify for Justice40 benefits. $1.8M in additional funding potentially available.</p></div>
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-media-ready-grades': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Trophy size={15} className="text-purple-600" /> Media-Ready Grades
                  </CardTitle>
                  <CardDescription>Simplified report card for press releases</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { category: 'Water Quality', grade: 'B+', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                      { category: 'Infrastructure', grade: 'C+', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
                      { category: 'Compliance', grade: 'A-', color: 'text-green-700 bg-green-50 border-green-200' },
                      { category: 'Equity', grade: 'B-', color: 'text-teal-700 bg-teal-50 border-teal-200' },
                    ].map(g => (
                      <div key={g.category} className={`border rounded-xl p-4 text-center ${g.color}`}>
                        <p className="text-3xl font-bold">{g.grade}</p>
                        <p className="text-xs mt-1 font-medium">{g.category}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-peer-comparison': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 size={15} className="text-purple-600" /> Peer Comparison
                  </CardTitle>
                  <CardDescription>How you compare to similar jurisdictions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { metric: 'Water Quality Score', you: 87, peer: 82, unit: '/100' },
                      { metric: 'Compliance Rate', you: 94, peer: 89, unit: '%' },
                      { metric: 'Infrastructure Grade', you: 77, peer: 74, unit: '/100' },
                      { metric: 'Grant $ Per Capita', you: 22.7, peer: 18.3, unit: '' },
                    ].map(m => (
                      <div key={m.metric} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-slate-700">{m.metric}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-purple-700">You: {m.you}{m.unit}</span>
                          <span className="text-sm text-slate-500">Peers: {m.peer}{m.unit}</span>
                          {m.you > m.peer ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Above</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800">Below</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-council-agenda': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale size={15} className="text-purple-600" /> Council Agenda Suggestions
                  </CardTitle>
                  <CardDescription>Data-driven items for next meeting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-red-100 text-red-800 shrink-0">Urgent</Badge>
                    <p><strong>ARPA Fund Reallocation:</strong> $480K unobligated — propose allocation to lead service line replacement before Dec 2026 deadline.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">Action</Badge>
                    <p><strong>SRF Match Funding:</strong> Authorize $190K from capital reserve to close FY2027 SRF local match gap.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">Info</Badge>
                    <p><strong>Quarterly Water Quality Update:</strong> 8th consecutive quarter with zero MCL exceedances — recognition opportunity.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">Equity</Badge>
                    <p><strong>EJ Tract Prioritization:</strong> Present updated lead line replacement schedule prioritizing 3 EJ census tracts.</p>
                  </div>
                </CardContent>
              </Card>
            );

            case 'disclaimer': return null;

            case 'training': return DS(
              <RoleTrainingGuide rolePath="/dashboard/ngo" />
            );

            default: return null;
          }
        })}

        </div>
        </>);
        }}
        </LayoutEditor>
        <DataFreshnessFooter />

      </div>
    </div>
  );
}

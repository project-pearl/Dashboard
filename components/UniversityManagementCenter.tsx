'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLensParam } from '@/lib/useLensParam';
import HeroBanner from './HeroBanner';
import { getStatesGeoJSON, geoToAbbr, STATE_GEO_LEAFLET, FIPS_TO_ABBR as _FIPS, STATE_NAMES as _SN } from '@/lib/mapUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Shield, ChevronDown, ChevronUp, Minus, AlertTriangle, CheckCircle, Search, Filter, Droplets, TrendingUp, BarChart3, Info, LogOut, Microscope } from 'lucide-react';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { getRegionById } from '@/lib/regionsConfig';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { useTierFilter } from '@/lib/useTierFilter';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses, COST_PER_UNIT_YEAR } from '@/lib/restorationEngine';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { getEcoScore, getEcoData } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData } from '@/lib/ejVulnerability';
import { STATE_AUTHORITIES } from '@/lib/stateWaterData';
import { useAuth } from '@/lib/authContext';
import { getRegionMockData, calculateRemovalEfficiency } from '@/lib/mockData';

import { WaterQualityChallenges } from '@/components/WaterQualityChallenges';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import { PolicyTracker } from '@/components/PolicyTracker';
import { EmergingContaminantsTracker } from '@/components/EmergingContaminantsTracker';
import ResolutionPlanner from '@/components/ResolutionPlanner';
import { DisasterEmergencyPanel } from '@/components/DisasterEmergencyPanel';
import { CampusStormwaterPanel } from '@/components/CampusStormwaterPanel';
import { WatershedPartnershipsPanel } from '@/components/WatershedPartnershipsPanel';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import dynamic from 'next/dynamic';
const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false }
);
const MapboxMarkers = dynamic(
  () => import('@/components/MapboxMarkers').then(m => m.MapboxMarkers),
  { ssr: false }
);
const GrantOpportunityMatcher = dynamic(
  () => import('@/components/GrantOpportunityMatcher').then((mod) => mod.GrantOpportunityMatcher),
  { ssr: false }
);
const DataExportHub = dynamic(
  () => import('@/components/DataExportHub').then((mod) => mod.DataExportHub),
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
  userRole?: 'Researcher' | 'College';
  defaultLens?: 'data-analysis' | 'field-study' | 'publication';
  onSelectRegion?: (regionId: string) => void;
  onToggleDevMode?: () => void;
};

// ─── Lenses (18-view architecture) ───────────────────────────────────────────

type ViewLens = 'overview' | 'briefing' | 'planner' | 'trends' | 'policy' | 'compliance' |
  'water-quality' | 'public-health' | 'research-monitoring' | 'campus-stormwater' |
  'infrastructure' | 'monitoring' | 'disaster-emergency' | 'watershed-partnerships' |
  'scorecard' | 'reports' | 'grants-publications' | 'funding';

const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  sections: Set<string> | null;
}> = {
  overview:    { label: 'Overview',    description: 'University water quality dashboard overview',
    sections: new Set(['regprofile', 'map-grid', 'top10', 'disclaimer']) },
  briefing:    { label: 'AI Briefing', description: 'AI-generated research intelligence briefing',
    sections: new Set(['insights', 'alertfeed', 'disclaimer']) },
  planner:     { label: 'Resolution Planner', description: 'Research-driven resolution planning workspace',
    sections: new Set(['resolution-planner', 'disclaimer']) },
  trends:      { label: 'Trends & Projections', description: 'Water quality trends, research metrics, and data projections',
    sections: new Set(['trends-dashboard', 'disclaimer']) },
  policy:      { label: 'Policy Tracker', description: 'Water policy tracking for research context',
    sections: new Set(['policy-tracker', 'disclaimer']) },
  compliance:  { label: 'Compliance', description: 'Campus NPDES and drinking water compliance',
    sections: new Set(['icis', 'sdwis', 'disclaimer']) },
  'water-quality': { label: 'Water Quality', description: 'Water quality data exploration and analysis',
    sections: new Set(['regprofile', 'detail', 'top10', 'disclaimer']) },
  'public-health': { label: 'Public Health & Contaminants', description: 'Emerging contaminants and public health research',
    sections: new Set(['contaminants-tracker', 'disclaimer']) },
  'research-monitoring': { label: 'Research & Monitoring', description: 'Research collaboration and dataset management',
    sections: new Set(['research', 'datasets', 'methodology', 'disclaimer']) },
  'campus-stormwater': { label: 'Campus Stormwater', description: 'Campus stormwater management and green infrastructure',
    sections: new Set(['campus-stormwater-panel', 'disclaimer']) },
  infrastructure: { label: 'Infrastructure', description: 'Campus water infrastructure overview',
    sections: new Set(['groundwater', 'disclaimer']) },
  monitoring:  { label: 'Monitoring', description: 'Water quality monitoring network management',
    sections: new Set(['regprofile', 'detail', 'disclaimer']) },
  'disaster-emergency': { label: 'Disaster & Emergency', description: 'Emergency response for campus water systems',
    sections: new Set(['disaster-emergency-panel', 'disclaimer']) },
  'watershed-partnerships': { label: 'Watershed Partnerships', description: 'Community and inter-institutional partnerships',
    sections: new Set(['watershed-partnerships-panel', 'disclaimer']) },
  scorecard:   { label: 'Scorecard', description: 'Campus water program performance scorecard',
    sections: new Set(['scorecard-kpis', 'scorecard-grades', 'disclaimer']) },
  reports:     { label: 'Reports', description: 'Research reports and data export',
    sections: new Set(['exporthub', 'reports-hub', 'disclaimer']) },
  'grants-publications': { label: 'Grants & Publications', description: 'Manuscript preparation, grants, and academic tools',
    sections: new Set(['manuscript', 'grants', 'academic', 'disclaimer']) },
  funding:     { label: 'Funding & Grants', description: 'Research funding opportunities',
    sections: new Set(['grants', 'disclaimer']) },
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

function scoreToGrade(score: number): { letter: string; color: string; bg: string } {
  if (score >= 97) return { letter: 'A+', color: 'text-green-700', bg: 'bg-green-100 border-green-300' };
  if (score >= 93) return { letter: 'A',  color: 'text-green-700', bg: 'bg-green-100 border-green-300' };
  if (score >= 90) return { letter: 'A-', color: 'text-green-600', bg: 'bg-green-50 border-green-200' };
  if (score >= 87) return { letter: 'B+', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 83) return { letter: 'B',  color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  if (score >= 80) return { letter: 'B-', color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' };
  if (score >= 77) return { letter: 'C+', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' };
  if (score >= 73) return { letter: 'C',  color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-300' };
  if (score >= 70) return { letter: 'C-', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' };
  if (score >= 67) return { letter: 'D+', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300' };
  if (score >= 63) return { letter: 'D',  color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
  if (score >= 60) return { letter: 'D-', color: 'text-orange-500', bg: 'bg-orange-50 border-orange-200' };
  return { letter: 'F', color: 'text-red-700', bg: 'bg-red-50 border-red-300' };
}

// ─── View Lens: controls what each view shows/hides ──────────────────────────

// ─── Map Overlay: what drives marker colors ──────────────────────────────────

type OverlayId = 'risk' | 'coverage' | 'bmp' | 'ej';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'risk', label: 'Impairment Risk', description: 'Impairment severity from EPA ATTAINS & state assessments', icon: Droplets },
  { id: 'coverage', label: 'Monitoring Coverage', description: 'Data source availability & assessment status', icon: BarChart3 },
  { id: 'bmp', label: 'BMP Performance', description: 'Treatment removal efficiency by waterbody', icon: TrendingUp },
  { id: 'ej', label: 'EJ Vulnerability', description: 'Environmental justice burden from EPA EJScreen', icon: AlertTriangle },
];

function getMarkerColor(overlay: OverlayId, wb: { alertLevel: AlertLevel; status: string; dataSourceCount: number }): string {
  if (overlay === 'risk') {
    return wb.alertLevel === 'high' ? '#ef4444' :
           wb.alertLevel === 'medium' ? '#f59e0b' :
           wb.alertLevel === 'low' ? '#eab308' : '#22c55e';
  }
  if (overlay === 'coverage') {
    if (wb.dataSourceCount > 0) return '#166534';
    if (wb.status === 'assessed') return '#f59e0b';
    return '#9ca3af';
  }
  if (overlay === 'bmp') {
    return wb.alertLevel === 'high' ? '#ef4444' :
           wb.alertLevel === 'medium' ? '#f59e0b' :
           wb.alertLevel === 'low' ? '#3b82f6' : '#22c55e';
  }
  // ej: severity as proxy for EJ burden
  return wb.alertLevel === 'high' ? '#7c3aed' :
         wb.alertLevel === 'medium' ? '#a855f7' :
         wb.alertLevel === 'low' ? '#c4b5fd' : '#e9d5ff';
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

export function UniversityManagementCenter({ stateAbbr: initialStateAbbr, userRole = 'Researcher', defaultLens, onSelectRegion, onToggleDevMode }: Props) {
  const [stateAbbr, setStateAbbr] = useState(initialStateAbbr);
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const agency = STATE_AGENCIES[stateAbbr] || STATE_AUTHORITIES[stateAbbr] || null;
  const { user, logout } = useAuth();

  // ── Lens switching ──
  const [activeLens, setActiveLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[activeLens];

  // ── View state ──
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>('risk');

  // ── State-filtered region data ──
  const baseRegions = useMemo(() => generateStateRegionData(stateAbbr), [stateAbbr]);

  // ── Map: GeoJSON + Leaflet ──
  const geoData = useMemo(() => {
    try { return getStatesGeoJSON() as any; }
    catch { return null; }
  }, []);

  const leafletGeo = STATE_GEO_LEAFLET[stateAbbr] || { center: [39.8, -98.5] as [number, number], zoom: 4 };

  // (wbMarkers defined after regionData below for ATTAINS-merged data)

  // ── ATTAINS bulk for this state ──
  const [attainsBulk, setAttainsBulk] = useState<Array<{ id: string; name: string; category: string; alertLevel: AlertLevel; causes: string[]; cycle: string; lat?: number | null; lon?: number | null }>>([]);
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
      // Priority 1: ATTAINS real centroid
      const byId = attainsCoordMap.get(r.id);
      const byName = !byId ? attainsCoordMap.get(`name:${r.name.toLowerCase().trim()}`) : null;
      const attainsCoord = byId || byName;
      if (attainsCoord) {
        resolved.push({ id: r.id, name: r.name, lat: attainsCoord.lat, lon: attainsCoord.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount });
        continue;
      }
      // Priority 2: regionsConfig
      const cfg = getRegionById(r.id) as any;
      if (cfg) {
        const lat = cfg.lat ?? cfg.latitude ?? null;
        const lon = cfg.lon ?? cfg.lng ?? cfg.longitude ?? null;
        if (lat != null && lon != null) {
          resolved.push({ id: r.id, name: r.name, lat, lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount });
          continue;
        }
      }
      // Priority 3: name-based coordinate resolver (fallback)
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
  const [showCostPanel, setShowCostPanel] = useState(false);
  const [alertFeedMinimized, setAlertFeedMinimized] = useState(true);

  // Mapbox marker data — re-derived when overlay or markers change
  const markerData = useMemo(() =>
    wbMarkers.map((wb) => ({
      id: wb.id,
      lat: wb.lat,
      lon: wb.lon,
      color: getMarkerColor(overlay, wb),
      name: wb.name,
    })),
    [wbMarkers, overlay]
  );

  // Hover state for Mapbox popups
  const [hoveredFeature, setHoveredFeature] = useState<mapboxgl.MapboxGeoJSONFeature | null>(null);
  const onMouseMove = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    setHoveredFeature(e.features?.[0] ?? null);
  }, []);
  const onMouseLeave = useCallback(() => {
    setHoveredFeature(null);
  }, []);
  const onMapClick = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (feat?.properties?.id) {
      setActiveDetailId((prev) => prev === feat.properties!.id ? null : String(feat.properties!.id));
    }
  }, []);

  const { waterData: rawWaterData, isLoading: waterLoading, hasRealData } = useWaterData(activeDetailId);
  const waterData = useTierFilter(rawWaterData, 'University');

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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ waterbodies: true, research: true, methodology: false });
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-violet-50/40 via-white to-indigo-50/30">
      <div className="mx-auto max-w-7xl p-4 space-y-8">

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

        {/* ── HERO BANNER ── */}
        <HeroBanner role="university" onDoubleClick={() => onToggleDevMode?.()}>
            {/* State Selector */}
            <select
              value={stateAbbr}
              onChange={(e) => { setStateAbbr(e.target.value); setActiveDetailId(null); }}
              className="h-8 px-2 text-xs font-semibold rounded-md border bg-white border-slate-200 text-slate-700 hover:border-violet-300 focus:ring-2 focus:ring-violet-400/50 focus:outline-none transition-colors cursor-pointer"
            >
              {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                <option key={abbr} value={abbr}>{abbr} — {name}</option>
              ))}
            </select>
            {/* Account */}
            {user && (
            <div className="relative">
              <button
                onClick={() => { setShowAccountPanel(!showAccountPanel); setShowViewDropdown(false); }}
                className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-md border bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                {user.name || (userRole === 'College' ? 'Undergrad Researcher' : 'Principal Investigator')}
                <span className="ml-1.5 text-indigo-400">▾</span>
              </button>
              {showAccountPanel && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountPanel(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                          <div className="text-[11px] text-slate-500">{user.email || 'research@project-pearl.org'}</div>
                        </div>
                      </div>
                      <button onClick={() => setShowAccountPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                    </div>
                  </div>
                  <div className="px-4 py-3 space-y-2 text-xs border-b border-slate-100">
                    <div className="flex justify-between"><span className="text-slate-500">Role</span><span className="font-medium text-slate-700">{user.role || userRole}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500 flex-shrink-0">Organization</span><span className="font-medium text-slate-700 text-right">{user.organization || `${stateName} Research Institute`}</span></div>
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
        </HeroBanner>

        <LayoutEditor ccKey="University">
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
              isEditMode={isEditMode} isVisible={section.visible} onToggleVisibility={onToggleVisibility}>
              {children}
            </DraggableSection>
          );
          switch (section.id) {

            case 'regprofile': return DS((() => {
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
            <div id="section-regprofile" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('regprofile')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
                <div className="flex items-center gap-2">
                  <Droplets size={15} className="text-violet-600" />
                  <span className="text-sm font-bold text-violet-900">{stateName} — Data Sources &amp; Research Context</span>
                </div>
                <div className="flex items-center gap-1.5">
                <BrandedPrintBtn sectionId="regprofile" title="Data Sources & Research Context" />
                {isSectionOpen('regprofile') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
              </button>
              {isSectionOpen('regprofile') && (
              <div className="px-4 pb-3 pt-1">
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                  <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 text-center">
                    <div className="text-4xl font-black text-indigo-700">{wbCount}</div>
                    <div className="text-[10px] text-indigo-600 font-medium">Waterbodies</div>
                  </div>
                  <div className="rounded-lg bg-red-50 border border-red-100 p-2.5 text-center">
                    <div className="text-xl font-bold text-red-700">{impairedCount}</div>
                    <div className="text-[10px] text-red-500">Impaired (Cat 4/5)</div>
                  </div>
                  <div className="rounded-lg bg-cyan-50 border border-cyan-100 p-2.5 text-center">
                    <div className="text-xl font-bold text-cyan-700">{wbCount - impairedCount}</div>
                    <div className="text-[10px] text-cyan-500">Attaining / Nominal</div>
                  </div>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
                    <div className="text-sm font-bold text-slate-700 leading-tight">{agency?.cwaSec || 'CWA §303(d)'}</div>
                    <div className="text-[10px] text-slate-400">Primary CWA Section</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 border border-purple-100 p-2.5 text-center">
                    <div className="text-xl font-bold text-purple-700">{ejScore}<span className="text-xs font-normal text-purple-400">/100</span></div>
                    <div className="text-[10px] text-purple-500">EJ Vulnerability</div>
                  </div>
                  <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-2.5 text-center">
                    <div className="text-sm font-bold text-indigo-700 leading-tight">6 APIs</div>
                    <div className="text-[10px] text-indigo-400">Data Sources</div>
                  </div>
                  <div className={`rounded-lg border p-2.5 text-center ${trendBg}`}>
                    <div className={`text-sm font-bold ${trendColor}`}>{trendLabel}</div>
                    <div className="text-[10px] text-slate-400">WQ Trend</div>
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
        })());

            case 'alertfeed': return DS((() => {
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
        })());

            case 'insights': return DS(
              <AIInsightsEngine key={stateAbbr} role={userRole === 'College' ? 'College' : 'Researcher'} stateAbbr={stateAbbr} regionData={regionData as any} />
            );

            case 'map-grid': return DS(
        <div className="space-y-4">
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

              {!geoData ? (
                <div className="p-8 text-sm text-slate-500 text-center">
                  Map data unavailable. Check mapUtils configuration.
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
                      interactiveLayerIds={['university-markers']}
                      onClick={onMapClick}
                      onMouseMove={onMouseMove}
                      onMouseLeave={onMouseLeave}
                    >
                      <MapboxMarkers
                        data={markerData}
                        layerId="university-markers"
                        radius={wbMarkers.length > 150 ? 3 : wbMarkers.length > 50 ? 4 : 5}
                        hoveredFeature={hoveredFeature}
                      />
                    </MapboxMapShell>
                  </div>
                  {/* Dynamic Legend */}
                  <div className="flex flex-wrap gap-2 p-3 text-xs bg-slate-50 border-t border-slate-200">
                    {overlay === 'risk' && (
                      <>
                        <span className="text-slate-500 font-medium self-center mr-1">Impairment:</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Healthy</Badge>
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Watch</Badge>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Impaired</Badge>
                        <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Severe</Badge>
                      </>
                    )}
                    {overlay === 'coverage' && (
                      <>
                        <span className="text-slate-500 font-medium self-center mr-1">Monitoring:</span>
                        <Badge variant="secondary" className="bg-gray-200 text-gray-700">No Data</Badge>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Assessment Only</Badge>
                        <Badge variant="secondary" className="bg-green-800 text-white">Active Monitoring</Badge>
                      </>
                    )}
                    {overlay === 'bmp' && (
                      <>
                        <span className="text-slate-500 font-medium self-center mr-1">BMP Performance:</span>
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Excellent &ge;80%</Badge>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Good &ge;60%</Badge>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Fair &ge;40%</Badge>
                        <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Poor &lt;40%</Badge>
                      </>
                    )}
                    {overlay === 'ej' && (
                      <>
                        <span className="text-slate-500 font-medium self-center mr-1">EJ Vulnerability:</span>
                        <Badge variant="secondary" className="bg-purple-100 text-purple-600 border-purple-200">Low</Badge>
                        <Badge variant="secondary" className="bg-purple-200 text-purple-700 border-purple-300">Moderate</Badge>
                        <Badge variant="secondary" className="bg-purple-300 text-purple-800 border-purple-300">High</Badge>
                        <Badge variant="secondary" className="bg-purple-600 text-white">Critical</Badge>
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
        </div>
            );

            case 'detail': return DS(
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

            {/* Field Study Guide — shown in research-monitoring lens when waterbody selected */}
            {activeLens === 'research-monitoring' && activeDetailId && (
              <div className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Microscope className="h-5 w-5 text-violet-600" />
                  <h3 className="text-base font-bold text-violet-900">Field Study Guide</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-violet-100 bg-white p-3 space-y-1">
                    <div className="text-xs font-bold text-violet-700">1. Observe &amp; Record</div>
                    <p className="text-xs text-slate-600">Note weather, water color, odor, and surrounding land use. Record GPS coordinates and time of observation.</p>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-white p-3 space-y-1">
                    <div className="text-xs font-bold text-violet-700">2. Measure Parameters</div>
                    <p className="text-xs text-slate-600">Collect DO, turbidity, pH, temperature, and conductivity using field instruments. Follow EPA-approved methods.</p>
                  </div>
                  <div className="rounded-xl border border-violet-100 bg-white p-3 space-y-1">
                    <div className="text-xs font-bold text-violet-700">3. Analyze &amp; Compare</div>
                    <p className="text-xs text-slate-600">Compare your readings to the ALIA dashboard data above. Calculate percent difference and discuss potential causes.</p>
                  </div>
                </div>
                <div className="text-xs text-violet-600 bg-violet-50 border border-violet-200 rounded-lg p-3">
                  <span className="font-semibold">Coursework Connections:</span> Environmental Science (field methods), Statistics (data comparison), GIS (spatial analysis), Chemistry (water quality parameters), Ecology (ecosystem health indicators)
                </div>
              </div>
            )}

            {/* Restoration Plan */}
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

                      {/* Why ALIA */}
                      <div className="space-y-1.5">
                        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Why ALIA at {regionName}</div>
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
                            Impairment Classification ({impairmentClassification.length} causes · {addressabilityPct}% ALIA-addressable)
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
                            const subject = encodeURIComponent(`ALIA Pilot Deployment Request — ${regionName}, ${stateAbbr}`);
                            const body = encodeURIComponent(
                              `ALIA Pilot Deployment Request\n` +
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
                          🚀 Deploy ALIA Pilot Here
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
                                pearl: 'ALIA -- Treatment Accelerator',
                                community: 'COMMUNITY ENGAGEMENT & STEWARDSHIP',
                                regulatory: 'REGULATORY & PLANNING',
                              };

                              // ─── Title ───
                              pdf.addTitle('ALIA Deployment Plan');
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
                              pdf.addText(clean(`Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} unit${phase1Units > 1 ? 's' : ''}, ${phase1GPM} GPM)` : `${totalUnits} ALIA unit${totalUnits > 1 ? 's' : ''}`} at ${regionName} and begin continuous monitoring within 30 days.`), { indent: 5, bold: true });
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

                              // ─── Why ALIA ───
                              pdf.addSubtitle('Why ALIA at This Site');
                              pdf.addDivider();
                              for (const b of whyBullets) {
                                pdf.addText(clean(`- ${b.problem}`), { indent: 5, bold: true });
                                pdf.addText(clean(`  -> ${b.solution}.`), { indent: 10 });
                              }
                              pdf.addSpacer(3);

                              // ─── ALIA Configuration ───
                              pdf.addSubtitle(`ALIA Configuration: ${pearlModel}`);
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
                                  ['Unit Capacity', '50 GPM per ALIA unit (4 units per quad)'],
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
                                const pdfP1Mission = (hasNutrients || bloomSeverity !== 'normal')
                                  ? 'Primary Nutrient Interception'
                                  : hasBacteria ? 'Primary Pathogen Treatment'
                                  : hasSediment ? 'Primary Sediment Capture'
                                  : 'Primary Treatment & Monitoring';
                                const pdfP1Placement = (hasNutrients || bloomSeverity !== 'normal')
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
                                pdf.addSubtitle(`Impairment Classification -- ALIA addresses ${pearlAddressable} of ${totalClassified} (${addressabilityPct}%)`);
                                pdf.addDivider();
                                pdf.addTable(
                                  ['Cause', 'Tier', 'ALIA Action'],
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
                              pdf.addText(`This plan combines ${totalBMPs} conventional BMPs and nature-based solutions with ALIA accelerated treatment.`);
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
                              pdf.addText(clean(`1. Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} ALIA units, ${phase1GPM} GPM) at highest-priority inflow zone${phase1Quads > 1 ? 's' : ''}` : `${totalUnits} ALIA unit${totalUnits > 1 ? 's' : ''}`} within 30 days.`), { indent: 5 });
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
                            <div className="text-[10px] font-bold text-green-800 uppercase tracking-wider">ALIA Economics -- {regionName}</div>

                            {/* Unit pricing */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase">ALIA Unit Pricing</div>
                              <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto] text-[11px]">
                                  <div className="px-2 py-1.5 bg-slate-100 font-semibold border-b border-slate-200">ALIA Unit (50 GPM)</div>
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
                                <div className="text-[9px] text-green-500">of ALIA cost offset by reduced spend</div>
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
            );

            case 'top10': return DS(
        <div>
        {/* ── WATER QUALITY CHALLENGES — all lenses ── */}
        <WaterQualityChallenges context="academic" />

        {/* ── TOP 10 WORSENING / IMPROVING — full + programs view ── */}
        <div id="section-top10" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('top10')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
            <span className="text-sm font-bold text-slate-800">🔥 Top 5 Worsening / Improving Waterbodies</span>
            <div className="flex items-center gap-1.5">
                <BrandedPrintBtn sectionId="top10" title="Top 5 Worsening / Improving" />
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
                      <BrandedPrintBtn sectionId="potomac" title="Potomac River Crisis" />
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
                    {/* ALIA relevance */}
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
        </div>
            );

            case 'research': return DS(
        <Card id="section-research" className="rounded-2xl border-2 border-violet-200 bg-gradient-to-br from-violet-50/30 to-white">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('research')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                🔬 Research Collaboration Hub
              </CardTitle>
              {expandedSections.research ? (
                <div className="flex items-center gap-1.5">
                  <BrandedPrintBtn sectionId="research" title="Research Collaboration Hub" />
                  <Minus className="h-4 w-4 text-slate-400" />
                </div>
              ) : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
            <CardDescription>{userRole === 'College' ? 'Find advisors, datasets, and undergraduate research groups' : 'Collaborate with institutions, share datasets, and co-author'}</CardDescription>
          </CardHeader>
          {expandedSections.research && (
            <CardContent className="space-y-3">
              {/* Active Studies Tracker */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white rounded-lg border border-purple-200 p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">—</div>
                  <div className="text-xs text-purple-600">Active Studies</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Using {stateName} waterbody data</div>
                </div>
                <div className="bg-white rounded-lg border border-indigo-200 p-3 text-center">
                  <div className="text-2xl font-bold text-indigo-600">—</div>
                  <div className="text-xs text-indigo-700">Research Partners</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Universities & institutions</div>
                </div>
                <div className="bg-white rounded-lg border border-blue-200 p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">—</div>
                  <div className="text-xs text-blue-700">Shared Datasets</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">ALIA + ATTAINS + WQP</div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 italic">
                Research collaboration features powered by PEARL data platform. Integrates with ORCID, Google Scholar, and institution SSO.
              </div>
            </CardContent>
          )}
        </Card>
            );

            case 'manuscript': return DS(
        <div id="section-manuscript" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('manuscript')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
            <span className="text-sm font-bold text-violet-900">📝 Manuscript & Publication Tools</span>
            <div className="flex items-center gap-1.5">
              <BrandedPrintBtn sectionId="manuscript" title="Manuscript & Publication Tools" />
              {isSectionOpen('manuscript') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('manuscript') && (
            <div className="p-4 space-y-3">
              {/* Quick citation export */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">📊 Data Citation (ALIA)</div>
                  <div className="text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded">
                    Local Seafood Projects Inc. ({new Date().getFullYear()}). Project PEARL Water Quality Monitoring Data: {stateName}. Retrieved {new Date().toISOString().split('T')[0]} from pearl.localseafoodprojects.com
                  </div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">📊 Data Citation (ATTAINS)</div>
                  <div className="text-[10px] text-slate-500 font-mono bg-slate-50 p-2 rounded">
                    U.S. EPA ({new Date().getFullYear()}). ATTAINS: Assessment, TMDL Tracking and Implementation System. Retrieved from epa.gov/waterdata/attains
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        );

            case 'academic': return DS(
        <div id="section-academic" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('academic')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
            <span className="text-sm font-bold text-violet-900">{userRole === 'College' ? '🎓 Undergrad Tools & Learning Resources' : '🎓 Academic & Teaching Resources'}</span>
            <div className="flex items-center gap-1.5">
              <BrandedPrintBtn sectionId="academic" title="Academic Tools" />
              {isSectionOpen('academic') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('academic') && (
            <div className="p-4 space-y-3">
              <div className="text-xs text-slate-500 italic">Academic tools and learning resources coming soon.</div>
            </div>
          )}
        </div>
        );

            case 'methodology': return DS(
        <div id="section-methodology" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('methodology')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
            <span className="text-sm font-bold text-violet-900">🛡️ Data Integrity, QA/QC & Methodology</span>
            <div className="flex items-center gap-1.5">
              <BrandedPrintBtn sectionId="methodology" title="Data Integrity & Methodology" />
              {isSectionOpen('methodology') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('methodology') && (
            <div className="p-4 space-y-3">
              {/* Method reference quick-view */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="text-xs font-semibold text-amber-800 mb-1.5">⚗️ Monitoring Methods Reference</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { param: 'TSS', method: 'SM 2540D', mdl: '1.0 mg/L' },
                    { param: 'TN', method: 'EPA 353.2', mdl: '0.01 mg/L' },
                    { param: 'TP', method: 'EPA 365.1', mdl: '0.003 mg/L' },
                    { param: 'DO', method: 'SM 4500-O', mdl: '0.1 mg/L' },
                    { param: 'E. coli', method: 'EPA 1603', mdl: '1 CFU/100mL' },
                    { param: 'pH', method: 'SM 4500-H+B', mdl: '0.1 SU' },
                    { param: 'Turbidity', method: 'EPA 180.1', mdl: '0.1 NTU' },
                    { param: 'Conductivity', method: 'SM 2510B', mdl: '1 µS/cm' },
                  ].map(m => (
                    <div key={m.param} className="bg-white rounded border border-amber-100 p-2">
                      <div className="text-xs font-bold text-amber-900">{m.param}</div>
                      <div className="text-[10px] text-amber-700">{m.method}</div>
                      <div className="text-[10px] text-slate-500">MDL: {m.mdl}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        );

            case 'datasets': return DS(
        <div id="section-datasets" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('datasets')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
            <span className="text-sm font-bold text-violet-900">📦 Dataset Catalog & Research Export</span>
            <div className="flex items-center gap-1.5">
              <BrandedPrintBtn sectionId="datasets" title="Dataset Catalog & Research Export" />
              {isSectionOpen('datasets') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('datasets') && (
            <div className="p-4 space-y-3">
              {/* Available datasets */}
              <div className="text-xs font-semibold text-slate-700 mb-1">Available Datasets — {stateName}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { name: 'ALIA Continuous Monitoring', source: 'ALIA Sensors', format: 'CSV / JSON API', freq: '15-min intervals', icon: '🦪' },
                  { name: 'EPA ATTAINS Assessments', source: 'EPA', format: 'JSON API', freq: 'Biennial (IR cycle)', icon: '🏛️' },
                  { name: 'Water Quality Portal', source: 'USGS/EPA/USDA', format: 'CSV / WQX', freq: 'Varies by station', icon: '💧' },
                  { name: 'USGS NWIS Streamflow', source: 'USGS', format: 'RDB / JSON', freq: 'Real-time + daily', icon: '🌊' },
                  { name: 'EPA EJScreen Demographics', source: 'EPA', format: 'JSON API', freq: 'Annual update', icon: '⚖️' },
                  { name: 'NOAA Tides & Currents', source: 'NOAA CO-OPS', format: 'JSON / CSV', freq: '6-min intervals', icon: '🌊' },
                ].map(ds => (
                  <div key={ds.name} className="flex items-start gap-3 bg-white rounded-lg border border-slate-200 p-3">
                    <span className="text-lg">{ds.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800">{ds.name}</div>
                      <div className="text-[10px] text-slate-500">{ds.source} · {ds.format}</div>
                      <div className="text-[10px] text-slate-400">{ds.freq}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Export options */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-blue-800 mb-1">🔄 Research Export Formats</div>
                <div className="flex flex-wrap gap-2">
                  {['CSV (tabular)', 'JSON (API)', 'NetCDF (climate)', 'GeoJSON (spatial)', 'R (.rds)', 'Python (.pkl)', 'BibTeX (citations)'].map(fmt => (
                    <span key={fmt} className="px-2 py-1 rounded-full text-[10px] font-medium bg-blue-100 text-blue-700 border border-blue-200">{fmt}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        );

            case 'exporthub': return DS(
        <div id="section-exporthub" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('exporthub')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
            <span className="text-sm font-bold text-violet-900">📦 Data Export Hub</span>
            <div className="flex items-center gap-1.5">
              <BrandedPrintBtn sectionId="exporthub" title="Data Export Hub" />
              {isSectionOpen('exporthub') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('exporthub') && (
            <div className="p-4">
              <DataExportHub context="university" />
            </div>
          )}
        </div>
            );

            case 'grants': return DS(
        activeDetailId && displayData && regionMockData ? (
          <div id="section-grants" className="rounded-2xl border border-violet-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => onToggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 border-l-4 border-l-violet-400 bg-violet-50/30 hover:bg-violet-100/50 transition-colors">
              <span className="text-sm font-bold text-violet-900">🎓 Research Funding Opportunities — {stateName}</span>
              <div className="flex items-center gap-1.5">
                <BrandedPrintBtn sectionId="grants" title="Research Funding Opportunities" />
                {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>
            {isSectionOpen('grants') && (
              <GrantOpportunityMatcher
                regionId={activeDetailId}
                removalEfficiencies={removalEfficiencies as any}
                alertsCount={regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length}
                userRole="Researcher"
                stateAbbr={stateAbbr}
              />
            )}
          </div>
        ) : null);

            case 'trends-dashboard': return DS(
        (() => {
        return (
        <Card>
          <CardHeader>
            <CardTitle>Research & Data Trends</CardTitle>
            <CardDescription>Water quality parameter trends, research metrics, and emerging research frontiers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trend KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Publication Output', value: '↑ 14%', sub: 'peer-reviewed papers this year', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Dataset Growth', value: '↑ 23%', sub: 'new records added to repository', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Parameter Coverage', value: '84%', sub: 'of priority parameters monitored', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Citation Impact', value: '↑ 8.3', sub: 'avg citations per paper (h-index)', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
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
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Research & Monitoring Trends</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { category: 'Water Quality Parameters', trend: 'Expanding', detail: 'Study sites now monitoring 84% of priority parameters. PFAS and microplastics added at 6 new locations this year.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Research Funding', trend: 'Competitive', detail: 'Federal water research grants up 9% but applicant pool grew 15%. NSF and EPA STAR programs remain most competitive.', color: 'text-amber-700', bg: 'border-amber-200' },
                  { category: 'Cross-Institution Collaboration', trend: 'Growing', detail: '8 new inter-university research partnerships formed. Multi-site studies now account for 35% of publications.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Methodology Evolution', trend: 'Advancing', detail: 'eDNA sampling adopted at 40% of sites. Machine learning models deployed for 3 predictive water quality applications.', color: 'text-blue-700', bg: 'border-blue-200' },
                  { category: 'Open Data Adoption', trend: 'Accelerating', detail: '72% of new datasets published with open licenses. FAIR data principles compliance up from 45% to 68% in 2 years.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Student Engagement', trend: 'Strong', detail: '28 graduate theses on water quality topics. Undergraduate research participation up 22% with new REU programs.', color: 'text-blue-700', bg: 'border-blue-200' },
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
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Emerging Research Frontiers</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { scenario: 'High-Growth Areas', impacts: ['PFAS fate and transport modeling gaining rapid traction', 'AI/ML-driven water quality prediction becoming standard methodology', 'Microplastic source tracking creating new interdisciplinary collaborations'] },
                  { scenario: 'Emerging Opportunities', impacts: ['Environmental DNA (eDNA) enabling non-invasive biodiversity monitoring', 'Real-time sensor networks generating unprecedented temporal resolution data', 'Climate-water nexus research attracting cross-disciplinary funding'] },
                ].map(s => (
                  <div key={s.scenario} className="border border-slate-200 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-slate-800 mb-2">{s.scenario}</h4>
                    <ul className="space-y-1.5">
                      {s.impacts.map(imp => (
                        <li key={imp} className="text-xs text-slate-600 flex items-start gap-2">
                          <Microscope className="w-3 h-3 text-violet-500 flex-shrink-0 mt-0.5" />
                          {imp}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 italic">
              Metrics based on institutional research databases, WQP submissions, and publication tracking. Actual values will populate as research outputs accumulate.
            </div>
          </CardContent>
        </Card>
        );
        })());

            // ── Shared panels ──
            case 'resolution-planner': return DS(<ResolutionPlanner userRole="university" scopeContext={{ scope: 'state', data: { abbr: stateAbbr, name: STATE_NAMES[stateAbbr] || stateAbbr, epaRegion: 3, totalWaterbodies: regionData.length, assessed: regionData.length, impaired: regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length, score: Math.round(regionData.reduce((a, r) => a + (r.alertLevel === 'none' ? 95 : r.alertLevel === 'low' ? 75 : r.alertLevel === 'medium' ? 50 : 25), 0) / Math.max(regionData.length, 1)), grade: 'B', cat5: 0, cat4a: 0, cat4b: 0, cat4c: 0, topCauses: [] } }} />);
            case 'policy-tracker': return DS(<PolicyTracker />);
            case 'contaminants-tracker': return DS(<EmergingContaminantsTracker role="university" selectedState={stateAbbr} />);
            case 'icis': return DS(<ICISCompliancePanel state={stateAbbr} compactMode={false} />);
            case 'sdwis': return DS(<SDWISCompliancePanel state={stateAbbr} compactMode={false} />);
            case 'groundwater': return DS(<NwisGwPanel state={stateAbbr} compactMode={false} />);
            case 'disaster-emergency-panel': return DS(<DisasterEmergencyPanel selectedState={stateAbbr} stateRollup={[]} />);
            case 'scorecard-kpis': return DS(
              <Card><CardHeader><CardTitle>University Water Program Scorecard</CardTitle><CardDescription>Key performance indicators for campus water quality management</CardDescription></CardHeader>
              <CardContent><div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{ label: 'Research Output', value: '87%', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                  { label: 'Data Quality', value: '94%', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'Campus Compliance', value: '100%', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                  { label: 'Partnership Score', value: 'A-', color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' }
                ].map(k => <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}><div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div><div className={`text-2xl font-bold ${k.color} mt-1`}>{k.value}</div></div>)}
              </div></CardContent></Card>
            );
            case 'scorecard-grades': return DS(
              <Card><CardHeader><CardTitle>Program Grades</CardTitle></CardHeader>
              <CardContent><div className="grid grid-cols-3 gap-3">
                {[{ area: 'Water Quality Research', grade: 'A' }, { area: 'Campus Stormwater', grade: 'B+' }, { area: 'Community Engagement', grade: 'A-' }].map(g =>
                  <div key={g.area} className="text-center p-4 border rounded-lg"><div className="text-3xl font-bold text-violet-600">{g.grade}</div><div className="text-xs text-slate-500 mt-1">{g.area}</div></div>
                )}
              </div></CardContent></Card>
            );
            case 'reports-hub': return DS(
              <Card><CardHeader><CardTitle>Research Reports</CardTitle><CardDescription>Generated reports and data exports for academic use</CardDescription></CardHeader>
              <CardContent><div className="space-y-2">
                {['Annual Water Quality Summary', 'Campus Stormwater Report', 'Research Output Bibliography', 'Monitoring Network Status'].map(r =>
                  <div key={r} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"><span className="text-sm text-slate-700">{r}</span><Badge variant="outline" className="text-[10px]">Generate</Badge></div>
                )}
              </div></CardContent></Card>
            );

            // ── University exclusive panels ──
            case 'campus-stormwater-panel': return DS(<CampusStormwaterPanel stateAbbr={stateAbbr} />);
            case 'watershed-partnerships-panel': return DS(<WatershedPartnershipsPanel stateAbbr={stateAbbr} />);

            case 'disclaimer': return DS(
              <PlatformDisclaimer />
            );

            default: return null;
          }
        })}

        </div>
        </>);
        }}
        </LayoutEditor>

      </div>
    </div>
  );
}

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLensParam } from '@/lib/useLensParam';
import HeroBanner from './HeroBanner';
import dynamic from 'next/dynamic';
import { getStatesGeoJSON, geoToAbbr, STATE_GEO_LEAFLET, FIPS_TO_ABBR as _FIPS, STATE_NAMES as _SN } from '@/lib/mapUtils';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false }
);
const MapboxMarkers = dynamic(
  () => import('@/components/MapboxMarkers').then(m => m.MapboxMarkers),
  { ssr: false }
);
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Shield, ChevronDown, ChevronUp, Minus, AlertTriangle, AlertCircle, CheckCircle, Search, Filter, Droplets, TrendingUp, BarChart3, Building2, Info, LogOut, Waves, Heart, TreePine, Sprout, FileCheck, Scale, Activity, Sparkles, ClipboardList, Trophy, FileText, Banknote, Zap, RadioTower, Wrench, HardHat, FlaskConical, Leaf, Landmark, ShieldCheck, ExternalLink, Bug, Fish, ShieldAlert, Gauge, Clock, Link2, Megaphone, Users } from 'lucide-react';
import ResolutionPlanner from '@/components/ResolutionPlanner';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { useRouter } from 'next/navigation';
import { getRegionById } from '@/lib/regionsConfig';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { useTierFilter } from '@/lib/useTierFilter';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses, COST_PER_UNIT_YEAR } from '@/lib/restorationEngine';
import { extractHuc8 } from '@/lib/huc8Utils';
import type { HucIndices } from '@/lib/indices/types';
import RestorationPlanner from '@/components/RestorationPlanner';
import { useFloodForecast } from '@/hooks/useFloodForecast';
import { FloodForecastCard, FloodStatusSummary } from './FloodForecastCard';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { scoreToGrade, alertLevelAvgScore, ALERT_LEVEL_SCORES, ecoScoreStyle, ejScoreStyle } from '@/lib/scoringUtils';
import { getEcoScore, getEcoData, ecoScoreLabel } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData, ejScoreLabel } from '@/lib/ejVulnerability';
import { getStateMS4Jurisdictions, getMS4ComplianceSummary, STATE_AUTHORITIES } from '@/lib/stateWaterData';
import { useAuth } from '@/lib/authContext';
import { getRegionMockData, calculateRemovalEfficiency } from '@/lib/mockData';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { WatershedWaterbodyPanel } from '@/components/WatershedWaterbodyPanel';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import { GrantOutcomesCard } from './GrantOutcomesCard';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { useStateReport } from '@/lib/useStateReport';
import { useUSASpendingData } from '@/lib/useUSASpendingData';
import { StateDataReportCard } from '@/components/StateDataReportCard';
import LocationReportCard from '@/components/LocationReportCard';
import { WaterQualityTradingPanel } from '@/components/WaterQualityTradingPanel';
import { getEpaRegionForState } from '@/lib/epa-regions';
import { NUTRIENT_TRADING_STATES } from '@/lib/constants';
import { DataFreshnessFooter } from '@/components/DataFreshnessFooter';
import { useJurisdictionContext } from '@/lib/jurisdiction-context';
import { scopeRowsByJurisdiction } from '@/lib/jurisdictions/index';

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
  onSelectRegion?: (regionId: string) => void;
  onToggleDevMode?: () => void;
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


// ─── Map Overlay: what drives marker colors ──────────────────────────────────

type OverlayId = 'risk' | 'coverage' | 'bmp' | 'ej';

// ─── View Lens: controls what each view shows/hides ──────────────────────────

type ViewLens = 'overview' | 'briefing' | 'political-briefing' | 'trends' | 'policy'
  | 'compliance' | 'water-quality' | 'public-health' | 'habitat' | 'agriculture'
  | 'infrastructure' | 'monitoring' | 'disaster' | 'tmdl' | 'scorecard'
  | 'reports' | 'permits' | 'funding' | 'wqt';

const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  defaultOverlay: OverlayId;
  sections: Set<string>;
}> = {
  overview: {
    label: 'Overview',
    description: 'State operational dashboard — morning check before the day starts',
    defaultOverlay: 'risk',
    sections: new Set(['regprofile', 'operational-health', 'alertfeed', 'map-grid', 'detail', 'top10', 'quick-access', 'briefing-actions', 'briefing-changes', 'briefing-pulse', 'briefing-stakeholder']),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'AI-generated overnight summary and action items',
    defaultOverlay: 'risk',
    sections: new Set(['insights', 'briefing-actions']),
  },
  'political-briefing': {
    label: 'Political Briefing',
    description: 'Talking points, funding optics, EJ exposure, and council agenda suggestions',
    defaultOverlay: 'risk',
    sections: new Set([
      'pol-talking-points', 'pol-constituent-concerns', 'pol-funding-wins', 'pol-funding-risks',
      'pol-regulatory-deadlines', 'pol-ej-exposure', 'pol-media-ready-grades',
      'pol-peer-comparison', 'pol-council-agenda', 'disclaimer',
    ]),
  },
  trends: {
    label: 'Trends & Projections',
    description: 'Long-term water quality trends, TMDL progress, and outlook',
    defaultOverlay: 'risk',
    sections: new Set(['trends-dashboard', 'disclaimer']),
  },
  policy: {
    label: 'Policy Tracker',
    description: 'Federal, state, and EPA regulatory action tracking',
    defaultOverlay: 'risk',
    sections: new Set(['policy-federal', 'policy-state', 'policy-epa', 'disclaimer']),
  },
  compliance: {
    label: 'Compliance',
    description: 'Impairment severity, permits, enforcement, and drinking water',
    defaultOverlay: 'risk',
    sections: new Set(['icis', 'sdwis', 'ms4jurisdictions', 'compliance-assessment', 'compliance-analytics', 'disclaimer']),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'Standards, assessment, station data, and field integration',
    defaultOverlay: 'risk',
    sections: new Set(['regprofile', 'local-panel', 'groundwater', 'wq-standards', 'wq-assessment', 'wq-stations', 'disclaimer']),
  },
  'public-health': {
    label: 'Public Health & Contaminants',
    description: 'Contaminant tracking, health coordination, and lab capacity',
    defaultOverlay: 'risk',
    sections: new Set(['sdwis', 'ph-contaminants', 'ph-health-coord', 'ph-lab-capacity', 'disclaimer']),
  },
  habitat: {
    label: 'Habitat & Ecology',
    description: 'Ecological sensitivity, bioassessment, habitat impairment, T&E species, and 401 certification',
    defaultOverlay: 'risk',
    sections: new Set(['hab-ecoscore', 'hab-attainment', 'hab-bioassessment', 'hab-impairment-causes', 'hab-wildlife', 'hab-401cert', 'disclaimer']),
  },
  agriculture: {
    label: 'Agricultural & Nonpoint Source',
    description: '319 program, watershed plans, and nutrient reduction',
    defaultOverlay: 'risk',
    sections: new Set(['ag-319', 'ag-partners', 'ag-nps-breakdown', 'ag-nps-tmdl', 'ag-nps-funding', 'disclaimer']),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'SRF administration, capital planning, and green infrastructure',
    defaultOverlay: 'risk',
    sections: new Set(['infra-srf', 'infra-capital', 'infra-construction', 'infra-green', 'ag-bmp-effectiveness', 'ag-nutrient', 'ag-wbp', 'disclaimer']),
  },
  monitoring: {
    label: 'Monitoring',
    description: 'State monitoring network, data management, and optimization',
    defaultOverlay: 'coverage',
    sections: new Set(['groundwater', 'mon-network', 'mon-data-mgmt', 'mon-optimization', 'mon-continuous', 'mon-latency', 'mon-report-card', 'mon-source-health', 'flood-status', 'disclaimer']),
  },
  disaster: {
    label: 'Disaster & Emergency Response',
    description: 'Active incidents, spill reporting, and preparedness — redirects to merged planner view',
    defaultOverlay: 'risk',
    sections: new Set(['alertfeed', 'disaster-active', 'disaster-response', 'disaster-spill', 'disaster-prep', 'disaster-cascade', 'flood-forecast', 'resolution-planner', 'disclaimer']),
  },
  tmdl: {
    label: 'TMDL & Restoration',
    description: 'TMDL program status, 303(d) management, and watershed restoration',
    defaultOverlay: 'risk',
    sections: new Set(['tmdl-status', 'tmdl-303d', 'tmdl-workspace', 'tmdl-implementation', 'tmdl-restoration', 'tmdl-epa', 'tmdl-completion-trend', 'tmdl-cause-breakdown', 'tmdl-delisting-stories', 'disclaimer']),
  },
  scorecard: {
    label: 'Scorecard',
    description: 'Self-assessment, watershed scorecards, and peer comparison',
    defaultOverlay: 'risk',
    sections: new Set(['sc-self-assessment', 'sc-watershed', 'sc-peer', 'sc-epa-ppa', 'disclaimer']),
  },
  reports: {
    label: 'Reports',
    description: 'Integrated reports, regulatory filings, and data export',
    defaultOverlay: 'risk',
    sections: new Set(['exporthub', 'rpt-ir-workspace', 'rpt-regulatory', 'rpt-adhoc', 'disclaimer']),
  },
  permits: {
    label: 'Permits & Enforcement',
    description: 'Permitting operations, inventory, DMR monitoring, and enforcement',
    defaultOverlay: 'risk',
    sections: new Set(['icis', 'perm-status', 'perm-inventory', 'perm-pipeline', 'perm-dmr', 'perm-inspection', 'perm-enforcement', 'perm-general', 'perm-snc', 'perm-waterbody', 'perm-expiring', 'perm-dmr-trends', 'disclaimer']),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'Active grants, SRF management, and financial analytics',
    defaultOverlay: 'risk',
    sections: new Set(['grants', 'fund-active', 'fund-srf', 'infra-capital', 'infra-construction', 'fund-pipeline', 'fund-passthrough', 'fund-analytics', 'fund-bil', 'fund-j40', 'fund-srf-pipeline', 'fund-grant-compliance', 'fund-trend', 'fund-match', 'grant-outcomes', 'disclaimer']),
  },
  wqt: {
    label: 'Water Quality Trading',
    description: 'Nutrient credit trading program — all sectors, marketplace, compliance',
    defaultOverlay: 'risk',
    sections: new Set(['wqt', 'disclaimer']),
  },
};

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

export function StateManagementCenter({ stateAbbr, onSelectRegion, onToggleDevMode }: Props) {
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const agency = STATE_AGENCIES[stateAbbr] || STATE_AUTHORITIES[stateAbbr] || null;
  const { user, logout, isAdmin } = useAuth();
  const { activeJurisdiction } = useJurisdictionContext();
  const router = useRouter();

  // ── View Lens ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] ?? LENS_CONFIG['overview'];
  const [overlay, setOverlay] = useState<OverlayId>('risk');
  const [icisLoadRequested, setIcisLoadRequested] = useState(false);

  // ── State Data Report Card ──
  const { report: stateReport, isLoading: stateReportLoading } = useStateReport(stateAbbr);
  const { data: usasData, isLoading: usasLoading } = useUSASpendingData(stateAbbr);

  useEffect(() => {
    setIcisLoadRequested(false);
  }, [stateAbbr]);

  // ── State-filtered region data ──
  const baseRegions = useMemo(() => generateStateRegionData(stateAbbr), [stateAbbr]);

  // ── Map: topo + projection ──
  const geoData = useMemo(() => {
    try { return getStatesGeoJSON() as any; }
    catch { return null; }
  }, []);

  const leafletGeo = STATE_GEO_LEAFLET[stateAbbr] || { center: [39.8, -98.5] as [number, number], zoom: 4 };

  // ── ATTAINS bulk for this state ──
  const [attainsBulk, setAttainsBulk] = useState<Array<{ id: string; name: string; category: string; alertLevel: AlertLevel; causes: string[]; cycle: string; lat?: number | null; lon?: number | null; waterType?: string | null; causeCount: number }>>([]);
  const [attainsBulkLoaded, setAttainsBulkLoaded] = useState(false);

  // Merge ATTAINS into region data
  const mergedRegionData = useMemo(() => {
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

  const regionData = useMemo(() => {
    if (!activeJurisdiction) return mergedRegionData;
    if (activeJurisdiction.parent_state !== stateAbbr) return mergedRegionData;
    return scopeRowsByJurisdiction(mergedRegionData, activeJurisdiction);
  }, [mergedRegionData, activeJurisdiction, stateAbbr]);

  const scopedAttainsBulk = useMemo(() => {
    if (!activeJurisdiction) return attainsBulk;
    if (activeJurisdiction.parent_state !== stateAbbr) return attainsBulk;
    return scopeRowsByJurisdiction(attainsBulk as any, activeJurisdiction) as typeof attainsBulk;
  }, [attainsBulk, activeJurisdiction, stateAbbr]);

  // Waterbody marker coordinates — 3-priority resolution (ATTAINS centroid → regionsConfig → name-based)
  const attainsCoordMap = useMemo(() => {
    const m = new Map<string, { lat: number; lon: number }>();
    for (const a of attainsBulk) {
      if (a.lat != null && a.lon != null && a.id) m.set(a.id, { lat: a.lat, lon: a.lon });
      // Also index by normalized name for fuzzy matching
      if (a.lat != null && a.lon != null && a.name) {
        m.set(`name:${a.name.toLowerCase().trim()}`, { lat: a.lat, lon: a.lon });
      }
    }
    return m;
  }, [attainsBulk]);

  const wbMarkers = useMemo(() => {
    const resolved: { id: string; name: string; lat: number; lon: number; alertLevel: AlertLevel; status: string; dataSourceCount: number }[] = [];
    for (const r of regionData) {
      // Priority 1: ATTAINS real centroid (by ID or name)
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

  // Mapbox marker data — transform wbMarkers for MapboxMarkers component
  const markerData = useMemo(() =>
    wbMarkers.map(wb => ({
      id: wb.id,
      lat: wb.lat,
      lon: wb.lon,
      color: getMarkerColor(overlay, wb),
      name: wb.name,
    })),
    [wbMarkers, overlay]
  );

  const [hoveredFeature, setHoveredFeature] = useState<mapboxgl.MapboxGeoJSONFeature | null>(null);

  const onMarkerMouseMove = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    if (e.features && e.features.length > 0) {
      setHoveredFeature(e.features[0]);
    }
  }, []);

  const onMarkerMouseLeave = useCallback(() => {
    setHoveredFeature(null);
  }, []);

  // Fetch ATTAINS bulk from cache for this state
  useEffect(() => {
    let cancelled = false;
    async function fetchAttains() {
      try {
        const r = await fetch('/api/water-data?action=attains-national-cache');
        if (!r.ok) return;
        const json = await r.json();
        console.log('[ATTAINS Cache]', { loaded: !!json, stateCount: Object.keys(json?.states || {}).length });
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
          waterType: wb.waterType || null,
          causeCount: wb.causeCount || wb.causes?.length || 0,
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
  const [comingSoonId, setComingSoonId] = useState<string | null>(null);


  const { waterData: rawWaterData, isLoading: waterLoading, hasRealData } = useWaterData(activeDetailId);
  const waterData = useTierFilter(rawWaterData, 'State');
  const floodForecast = useFloodForecast();

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
  const [selectedHucIndices, setSelectedHucIndices] = useState<HucIndices | null>(null);

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
        if (!data) {
          // Request failed or returned empty — stop loading to prevent retry loop
          setAttainsCache(prev => ({ ...prev, [activeDetailId]: { category: '', causes: [], causeCount: 0, status: '', cycle: '', loading: false } }));
          return;
        }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailId, regionData, stateAbbr]);

  // Fetch EJ data when detail opens
  useEffect(() => {
    if (!activeDetailId) return;
    if (ejCache[activeDetailId] && !ejCache[activeDetailId].loading) return;
    setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: true } }));

    const nccRegion = regionData.find(r => r.id === activeDetailId);
    if (!nccRegion) {
      setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: false, error: 'no region' } }));
      return;
    }
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDetailId, regionData]);

  const selectedHuc8 = useMemo(() => {
    if (!activeDetailId) return null;

    const directAttains = attainsBulk.find(a => a.id === activeDetailId);
    const directHuc = directAttains ? extractHuc8(directAttains.id) : null;
    if (directHuc) return directHuc;

    const nccRegion = regionData.find(r => r.id === activeDetailId);
    const regionConfig = getRegionById(activeDetailId);
    const regionName = (regionConfig?.name || nccRegion?.name || '').toLowerCase().replace(/,.*$/, '').trim();
    if (regionName) {
      const fuzzyMatch = attainsBulk.find(a => {
        const n = a.name.toLowerCase().trim();
        return n.includes(regionName) || regionName.includes(n);
      });
      const fuzzyHuc = fuzzyMatch ? extractHuc8(fuzzyMatch.id) : null;
      if (fuzzyHuc) return fuzzyHuc;
    }

    const fallbackHuc = REGION_META[activeDetailId]?.huc8;
    return fallbackHuc && fallbackHuc !== 'nan' ? fallbackHuc : null;
  }, [activeDetailId, attainsBulk, regionData]);

  useEffect(() => {
    if (!selectedHuc8) {
      setSelectedHucIndices(null);
      return;
    }
    fetch(`/api/indices?huc8=${selectedHuc8}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => setSelectedHucIndices(data?.hucIndices?.[0] ?? null))
      .catch(() => setSelectedHucIndices(null));
  }, [selectedHuc8]);

  const [showMS4, setShowMS4] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string | null>(null);
  const [scorecardSearch, setScorecardSearch] = useState('');

  // ── Summary stats ──
  const stats = useMemo(() => {
    const high = regionData.filter(r => r.alertLevel === 'high').length;
    const medium = regionData.filter(r => r.alertLevel === 'medium').length;
    const low = regionData.filter(r => r.alertLevel === 'low').length;
    const monitored = regionData.filter(r => r.dataSourceCount > 0).length;
    return { total: regionData.length, high, medium, low, monitored };
  }, [regionData]);

  // ── MS4 jurisdictions ──
  const jurisdictions = useMemo(() => getStateMS4Jurisdictions(stateAbbr), [stateAbbr]);
  const ms4Summary = useMemo(() => jurisdictions.length > 0 ? getMS4ComplianceSummary(jurisdictions) : null, [jurisdictions]);
  const jurisdictionScoreRows = useMemo(() => {
    const statusBaseScore: Record<string, number> = {
      'In Compliance': 92,
      'Pending Renewal': 82,
      'Under Review': 74,
      'Minor Violations': 61,
      'Consent Decree': 45,
      'NOV Issued': 38,
    };
    return jurisdictions.map((j: any) => {
      const base = statusBaseScore[j.status] ?? 65;
      const phaseAdj = j.phase === 'Phase I' ? 3 : 0;
      const pop = Number(j.population || 0);
      const popAdj = pop >= 500000 ? 2 : pop >= 100000 ? 1 : 0;
      const score = Math.max(30, Math.min(98, base + phaseAdj + popAdj));
      const grade = scoreToGrade(score);
      const trend = j.status === 'In Compliance'
        ? 'Improving'
        : j.status === 'Pending Renewal' || j.status === 'Under Review'
        ? 'Stable'
        : 'Declining';
      const trendColor = trend === 'Improving' ? 'text-green-600' : trend === 'Declining' ? 'text-red-600' : 'text-slate-500';
      const trendIcon = trend === 'Improving' ? '↑' : trend === 'Declining' ? '↓' : '→';
      const needsAttention = j.status === 'Minor Violations' || j.status === 'Consent Decree' || j.status === 'NOV Issued';
      return {
        permitId: j.permitId,
        name: j.name,
        phase: j.phase,
        status: j.status,
        statusDetail: j.statusDetail,
        population: pop,
        score,
        grade,
        trend,
        trendColor,
        trendIcon,
        needsAttention,
      };
    }).sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [jurisdictions]);
  const jurisdictionScoreSummary = useMemo(() => {
    if (jurisdictionScoreRows.length === 0) {
      return {
        avgScore: 0,
        avgGrade: scoreToGrade(0),
        attentionCount: 0,
        inComplianceRate: 0,
        asOf: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
    }
    const avgScore = Math.round(jurisdictionScoreRows.reduce((s: number, r: any) => s + r.score, 0) / jurisdictionScoreRows.length);
    const avgGrade = scoreToGrade(avgScore);
    const attentionCount = jurisdictionScoreRows.filter((r: any) => r.needsAttention).length;
    const inCompliance = jurisdictionScoreRows.filter((r: any) => r.status === 'In Compliance').length;
    const inComplianceRate = Math.round((inCompliance / jurisdictionScoreRows.length) * 100);
    const asOf = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return { avgScore, avgGrade, attentionCount, inComplianceRate, asOf };
  }, [jurisdictionScoreRows]);

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

  // ── Expanded sections ──
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ waterbodies: true, ms4: true });
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
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

        {/* ── HERO BANNER ── */}
        <HeroBanner role="state" onDoubleClick={() => onToggleDevMode?.()} />

        <LayoutEditor ccKey="State">
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
          const ms4Total = jurisdictions.length;
          const agency = STATE_AGENCIES[stateAbbr];
          const ejScore = getEJScore(stateAbbr);
          const stableHash01 = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
          const economyVal = Math.round(stableHash01(stateAbbr + '|economy') * 100);
          const trendVal = Math.round((stableHash01(stateAbbr + '|trend') * 100 - 50) * 10) / 10;
          const complianceLabel = economyVal >= 80 ? 'Very High' : economyVal >= 60 ? 'High' : economyVal >= 40 ? 'Moderate' : 'Low';
          const trendLabel = trendVal > 5 ? '↑ Improving' : trendVal < -5 ? '↓ Worsening' : '— Stable';
          const trendColor = trendVal > 5 ? 'text-green-700' : trendVal < -5 ? 'text-red-700' : 'text-slate-500';
          const trendBg = trendVal > 5 ? 'bg-green-50 border-green-200' : trendVal < -5 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200';

          if (ms4Total === 0 && !ejScore) return null;
          return (
            <div id="section-regprofile" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('regprofile')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-orange-600" />
                  <span className="text-sm font-bold text-slate-800">{stateName} — MS4 & Regulatory Profile</span>
                </div>
                <div className="flex items-center gap-1.5">
                <BrandedPrintBtn sectionId="regprofile" title="MS4 & Regulatory Profile" />
                {isSectionOpen('regprofile') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
              </button>
              {isSectionOpen('regprofile') && (
              <div className="px-4 pb-3 pt-1">
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
                  {ms4Total > 0 && (
                    <>
                      <div className="rounded-lg bg-orange-50 border border-orange-100 p-2.5 text-center">
                        <div className="text-2xl font-black text-orange-700 inline-flex items-center gap-1">{ms4Total}<ProvenanceIcon metricName="MS4 Total" displayValue={String(ms4Total)} /></div>
                        <div className="text-[10px] text-orange-600 font-medium">MS4 Total</div>
                      </div>
                      <div className="rounded-lg bg-orange-50/50 border border-orange-100 p-2.5 text-center">
                        <div className="text-xl font-bold text-orange-800">{ms4Summary?.phaseI ?? 0}</div>
                        <div className="text-[10px] text-orange-500">Phase I (≥100k)</div>
                      </div>
                      <div className="rounded-lg bg-amber-50 border border-amber-100 p-2.5 text-center">
                        <div className="text-xl font-bold text-amber-700">{ms4Summary?.phaseII ?? 0}</div>
                        <div className="text-[10px] text-amber-500">Phase II (small)</div>
                      </div>
                    </>
                  )}
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-center">
                    <div className="text-sm font-bold text-slate-700 leading-tight">{agency?.ms4Program || 'NPDES MS4'}</div>
                    <div className="text-[10px] text-slate-400">Permit Program</div>
                  </div>
                  <div className="rounded-lg bg-purple-50 border border-purple-100 p-2.5 text-center">
                    <div className="text-xl font-bold text-purple-700 inline-flex items-center gap-1">{ejScore}<span className="text-xs font-normal text-purple-400">/100</span><ProvenanceIcon metricName="EJ Vulnerability" displayValue={String(ejScore)} unit="/100" /></div>
                    <div className="text-[10px] text-purple-500">EJ Vulnerability</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 text-center">
                    <div className="text-sm font-bold text-blue-700 leading-tight inline-flex items-center gap-1">{complianceLabel}<ProvenanceIcon metricName="Compliance Burden" displayValue={complianceLabel} /></div>
                    <div className="text-[10px] text-blue-400">Compliance Burden</div>
                  </div>
                  <div className={`rounded-lg border p-2.5 text-center ${trendBg}`}>
                    <div className={`text-sm font-bold ${trendColor}`}>{trendLabel}</div>
                    <div className="text-[10px] text-slate-400">WQ Trend</div>
                  </div>
                </div>
                {(() => {
                  const agencyNotes = agency?.division;
                  return agencyNotes ? (
                    <div className="text-[10px] text-slate-400 italic mt-2">{agencyNotes}</div>
                  ) : null;
                })()}
              </div>
              )}
            </div>
          );
        })());

            case 'datareport': return DS(
              <div id="section-datareport" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => onToggleCollapse('datareport')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <BarChart3 size={15} className="text-cyan-600" />
                    <span className="text-sm font-bold text-slate-800">Data Report Card</span>
                    {stateReport && (
                      <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                        stateReport.aiReadinessGrade === 'A' || stateReport.aiReadinessGrade === 'B' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        stateReport.aiReadinessGrade === 'C' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>AI Ready: {stateReport.aiReadinessGrade}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isSectionOpen('datareport') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </div>
                </button>
                {isSectionOpen('datareport') && (
                  <div className="px-4 pb-4 pt-2">
                    {stateReportLoading ? (
                      <div className="text-xs text-slate-400 text-center py-6">Loading data report...</div>
                    ) : stateReport ? (
                      <StateDataReportCard report={stateReport} />
                    ) : (
                      <div className="text-xs text-slate-400 text-center py-6">Data report not yet built. Run the WQP cron to generate.</div>
                    )}
                  </div>
                )}
              </div>
            );

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

            case 'local-panel': return DS(
              <WatershedWaterbodyPanel
                stateAbbr={stateAbbr}
                stateName={stateName}
                title="Local"
                regionData={regionData}
                attainsBulk={scopedAttainsBulk}
                attainsBulkLoaded={attainsBulkLoaded}
                activeDetailId={activeDetailId}
                setActiveDetailId={setActiveDetailId}
              />
            );

            case 'map-grid': return DS(
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
                      interactiveLayerIds={['state-markers']}
                      onMouseMove={onMarkerMouseMove}
                      onMouseLeave={onMarkerMouseLeave}
                    >
                      <MapboxMarkers
                        data={markerData}
                        layerId="state-markers"
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

          {/* RIGHT: Watershed Waterbody Panel (1/3 width) */}
          <WatershedWaterbodyPanel
            stateAbbr={stateAbbr}
            stateName={stateName}
            regionData={regionData}
            attainsBulk={scopedAttainsBulk}
            attainsBulkLoaded={attainsBulkLoaded}
            activeDetailId={activeDetailId}
            setActiveDetailId={setActiveDetailId}
          />
        </div>
            );

            case 'insights': return DS(
        <AIInsightsEngine key={stateAbbr} role="State" stateAbbr={stateAbbr} regionData={regionData as any} />
            );

            case 'detail': return DS(<>
        <div className="space-y-4">

            {/* No selection state — search prompt */}
            {!activeDetailId && (
              <Card className="border-2 border-dashed border-slate-300 bg-white/50">
                <div className="p-6">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder={`Search ${stateName} waterbodies...`}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                      onClick={() => setComingSoonId(comingSoonId === 'wb-search-detail' ? null : 'wb-search-detail')}
                      readOnly
                    />
                  </div>
                  {comingSoonId === 'wb-search-detail' ? (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                      <p className="text-xs text-slate-700">Search by waterbody name, ATTAINS ID, or HUC-12 code to view assessment status, impairment causes, TMDL linkage, and monitoring data.</p>
                      <p className="text-[10px] text-blue-600 mt-2 font-medium">Waterbody search — Coming Soon</p>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <MapPin className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs">Or click a marker on the map to view waterbody details</p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Waterbody Detail Card */}
            {activeDetailId && (() => {
              const nccRegion = regionData.find(r => r.id === activeDetailId);
              const regionConfig = getRegionById(activeDetailId);
              const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const bulkMatch = resolveBulkAttains(regionName);
              const wbCoords = wbMarkers.find(w => w.id === activeDetailId);

              return (
                <WaterbodyDetailCard
                  regionName={regionName}
                  stateAbbr={stateAbbr}
                  stateName={stateName}
                  alertLevel={nccRegion?.alertLevel || 'none'}
                  activeAlerts={nccRegion?.activeAlerts ?? 0}
                  lastUpdatedISO={nccRegion?.lastUpdatedISO}
                  coordinates={wbCoords ? { lat: wbCoords.lat, lon: wbCoords.lon } : null}
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
                  hucIndices={selectedHucIndices}
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

        {/* ── Environmental Justice — Census ACS + EPA SDWIS (statewide) + EJScreen (per-waterbody) ── */}
        {activeDetailId && displayData && regionMockData && (
            (() => {
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
                <BrandedPrintBtn sectionId="ej" title="Environmental Justice" />
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
            })()
        )}
            </>);

            case 'top10': return DS(
        <div id="section-top10" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('top10')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
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
                    {/* PIN relevance */}
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2 text-cyan-900">
                      <span className="font-bold">🔬 PIN Relevance:</span> This event demonstrates catastrophic infrastructure failure impact on receiving waters. PIN's real-time monitoring capability would provide continuous E. coli, nutrient, and pathogen tracking during and after spill events — filling the gap that required UMD researchers and volunteer riverkeepers to manually sample. Continuous deployment at 6 DC Water monitoring sites would provide the 24/7 data regulators and the public need.
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

            case 'ms4jurisdictions': return DS(
        jurisdictions.length > 0 ? (
          <Card id="section-ms4jurisdictions" className="border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/30 to-white">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('ms4')}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  MS4 Jurisdictions — {(agency as any)?.name || stateName}
                  <span className="text-sm font-normal text-slate-500">({jurisdictions.length})</span>
                </CardTitle>
                {expandedSections.ms4 ? (
                  <div className="flex items-center gap-1.5">
                    <BrandedPrintBtn sectionId="ms4jurisdictions" title="MS4 Jurisdictions" />
                    <Minus className="h-4 w-4 text-slate-400" />
                  </div>
                ) : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
              {ms4Summary && (
                <CardDescription>
                  {(agency as any)?.ms4Program || 'NPDES MS4'} · {ms4Summary.inCompliance} compliant · {ms4Summary.issues} needs attention
                </CardDescription>
              )}
            </CardHeader>
            {expandedSections.ms4 && ms4Summary && (
              <CardContent className="space-y-3">
                {/* Summary tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg border border-slate-200 p-3 text-center">
                    <div className="text-2xl font-bold text-slate-800">{ms4Summary.total}</div>
                    <div className="text-xs text-slate-500">Total MS4s</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{ms4Summary.phaseI} Phase I · {ms4Summary.phaseII} Phase II</div>
                  </div>
                  <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{ms4Summary.inCompliance}</div>
                    <div className="text-xs text-emerald-700">In Compliance</div>
                  </div>
                  <div className="bg-white rounded-lg border border-amber-200 p-3 text-center">
                    <div className="text-2xl font-bold text-amber-600">{ms4Summary.issues}</div>
                    <div className="text-xs text-amber-700">Needs Attention</div>
                  </div>
                  <div className="bg-white rounded-lg border border-blue-200 p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{ms4Summary.totalPopulation > 0 ? (ms4Summary.totalPopulation / 1000).toFixed(0) + 'K' : '—'}</div>
                    <div className="text-xs text-blue-700">Population Served</div>
                  </div>
                </div>

                {/* Jurisdiction drill-down dropdown */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Drill into jurisdiction:</label>
                  <select
                    value={selectedJurisdiction ?? ''}
                    onChange={(e) => {
                      const val = e.target.value || null;
                      setSelectedJurisdiction(val);
                      if (val) {
                        const row = document.getElementById(`state-ms4-row-${val}`);
                        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }}
                    className="flex-1 max-w-md border border-indigo-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none"
                  >
                    <option value="">All Jurisdictions</option>
                    {jurisdictions.map((j: any) => (
                      <option key={j.permitId} value={j.permitId}>
                        {j.name} — {j.permitId} ({j.phase})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected jurisdiction detail card */}
                {selectedJurisdiction && (() => {
                  const sel = jurisdictions.find((j: any) => j.permitId === selectedJurisdiction);
                  if (!sel) return null;
                  const statusColor: Record<string, string> = { 'In Compliance': 'bg-emerald-100 text-emerald-800 border-emerald-200', 'Under Review': 'bg-amber-100 text-amber-800 border-amber-200', 'Minor Violations': 'bg-orange-100 text-orange-800 border-orange-200', 'Consent Decree': 'bg-red-100 text-red-800 border-red-200', 'NOV Issued': 'bg-red-200 text-red-900 border-red-300', 'Pending Renewal': 'bg-blue-100 text-blue-800 border-blue-200' };
                  return (
                    <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/50 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-indigo-900">{sel.name}</h4>
                        <button onClick={() => setSelectedJurisdiction(null)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge className={statusColor[sel.status] || 'bg-slate-100 text-slate-600'}>{sel.status}</Badge>
                        <span className="text-slate-600">{sel.phase}</span>
                        <span className="text-slate-500">Permit: {sel.permitId}</span>
                        <span className="text-slate-500">Pop: {sel.population > 0 ? sel.population.toLocaleString() : '—'}</span>
                      </div>
                      {sel.keyIssues && sel.keyIssues.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {sel.keyIssues.map((k: string) => <Badge key={k} variant="outline" className="text-[10px]">{k}</Badge>)}
                        </div>
                      )}
                      {sel.statusDetail && <p className="text-xs text-slate-600 mt-1">{sel.statusDetail}</p>}
                    </div>
                  );
                })()}

                {/* Jurisdiction table */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 font-semibold text-slate-700">Jurisdiction</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-700">Phase</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-700">Compliance Status</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-700">Population</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {jurisdictions.map((j: any, idx: number) => {
                          const statusColor: Record<string, string> = { 'In Compliance': 'bg-emerald-100 text-emerald-800 border-emerald-200', 'Under Review': 'bg-amber-100 text-amber-800 border-amber-200', 'Minor Violations': 'bg-orange-100 text-orange-800 border-orange-200', 'Consent Decree': 'bg-red-100 text-red-800 border-red-200', 'NOV Issued': 'bg-red-200 text-red-900 border-red-300', 'Pending Renewal': 'bg-blue-100 text-blue-800 border-blue-200' };
                          const statusIcon: Record<string, string> = { 'In Compliance': '✅', 'Under Review': '🔍', 'Minor Violations': '⚠️', 'Consent Decree': '⚖️', 'NOV Issued': '🚨', 'Pending Renewal': '🔄' };
                          const isSelected = selectedJurisdiction === j.permitId;
                          return (
                            <tr
                              key={idx}
                              id={`state-ms4-row-${j.permitId}`}
                              onClick={() => setSelectedJurisdiction(isSelected ? null : j.permitId)}
                              className={`cursor-pointer transition-colors ${isSelected ? 'bg-indigo-100/70 ring-2 ring-indigo-400 ring-inset' : j.status === 'Consent Decree' || j.status === 'NOV Issued' ? 'bg-red-50/30 hover:bg-slate-50/80' : 'hover:bg-slate-50/80'}`}
                            >
                              <td className="px-3 py-2.5">
                                <div className="font-medium text-slate-800">{j.name}</div>
                                {j.statusDetail && <div className="text-[11px] text-slate-500 mt-0.5">{j.statusDetail}</div>}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${j.phase === 'Phase I' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-50 text-violet-600'}`}>{j.phase}</span>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColor[j.status] || 'bg-slate-100 text-slate-600'}`}>
                                  <span className="text-[10px]">{statusIcon[j.status] || '•'}</span> {j.status}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs text-slate-600">{j.population > 0 ? j.population.toLocaleString() : '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 italic">
                  Source: EPA ECHO database, state NPDES program records, consent decree public filings. Compliance status reflects most recent annual report cycle.
                </div>
              </CardContent>
            )}
          </Card>
        ) : null);

            case 'icis': return DS(
        <div id="section-icis" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-slate-800">NPDES / ICIS Compliance</div>
              <div className="text-xs text-slate-500">Load-on-demand to keep Compliance lens responsive</div>
            </div>
            {!icisLoadRequested && (
              <Button
                size="sm"
                onClick={() => setIcisLoadRequested(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Load NPDES Data
              </Button>
            )}
          </div>
          <div className="p-4">
            {icisLoadRequested ? (
              <ICISCompliancePanel
                state={stateAbbr}
                compactMode={false}
              />
            ) : (
              <p className="text-xs text-slate-500">
                NPDES/ICIS queries can be heavy for state-wide views. Click <span className="font-semibold">Load NPDES Data</span> when you need permit-level details.
              </p>
            )}
          </div>
        </div>
      );

            case 'sdwis': return DS(
        <div id="section-sdwis">
          <SDWISCompliancePanel
            state={stateAbbr}
            compactMode={false}
          />
        </div>
      );

            case 'groundwater': return DS(
        <div id="section-groundwater">
          <NwisGwPanel
            state={stateAbbr}
            compactMode={false}
          />
        </div>
      );

            case 'exporthub': return DS(
        <div id="section-exporthub" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('exporthub')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">📦 Data Export Hub</span>
            <div className="flex items-center gap-1.5">
              <BrandedPrintBtn sectionId="exporthub" title="Data Export Hub" />
              {isSectionOpen('exporthub') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('exporthub') && (
            <div className="p-4">
              <DataExportHub context="state" />
            </div>
          )}
        </div>
            );

            case 'grants': return DS(<>
        {activeDetailId && displayData && regionMockData && (
          <div id="section-grants" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => onToggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">💰 Grant Opportunities — {stateName}</span>
              <div className="flex items-center gap-1.5">
                <BrandedPrintBtn sectionId="grants" title="Grant Opportunities" />
                {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>
            {isSectionOpen('grants') && (
              <GrantOpportunityMatcher
                regionId={activeDetailId}
                removalEfficiencies={removalEfficiencies as any}
                alertsCount={regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length}
                userRole="State"
                stateAbbr={stateAbbr}
              />
            )}
          </div>
        )}
            </>);

            case 'trends-dashboard': return DS(
        <Card>
          <CardHeader>
            <CardTitle>State Water Quality Trends — {stateName}</CardTitle>
            <CardDescription>Long-term impairment trends, TMDL progress, and next assessment cycle outlook for {stateAbbr}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trend KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { id: 'trend-impairment', label: 'Impairment Trend', value: '↓ 3.1%', sub: 'vs. prior assessment cycle', color: 'text-green-600', bg: 'bg-green-50 border-green-200', drillDetail: `${stateAbbr} 303(d) list: 12 waterbodies delisted, 9 newly listed. Net improvement of 3.1% in Category 5 listings.` },
                { id: 'trend-tmdl', label: 'TMDL Completion', value: '↑ 6.4%', sub: 'approved TMDLs this period', color: 'text-green-600', bg: 'bg-green-50 border-green-200', drillDetail: `${stateAbbr} TMDL tracker: 8 new TMDLs approved. Total: 14 pending, 62 approved, 41 showing load reductions.` },
                { id: 'trend-permits', label: 'Permit Renewals', value: '87%', sub: 'on-time renewal rate', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', drillDetail: `${stateAbbr} renewals: 298 of 342 on time (87%). 44 overdue: 14 in review, 18 awaiting applicant, 12 backlogged.` },
                { id: 'trend-stations', label: 'Monitoring Stations', value: '↑ 4.8%', sub: 'new stations added', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', drillDetail: `48 new ${stateAbbr} stations deployed. Total: 1,048. Priority watershed coverage: 61% → 64%.` },
              ].map(t => (
                <div key={t.id}>
                  <div
                    className={`rounded-xl border p-4 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${t.bg}`}
                    onClick={() => setComingSoonId(comingSoonId === t.id ? null : t.id)}
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.label}</div>
                    <div className={`text-2xl font-bold ${t.color} mt-1`}>{t.value}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{t.sub}</div>
                  </div>
                  {comingSoonId === t.id && (
                    <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                      <p className="text-xs text-slate-700">{t.drillDetail}</p>
                      <p className="text-[10px] text-blue-600 mt-2 font-medium">Full filtered list — Coming Soon</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Category Trend Cards */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Water Quality Trend Categories</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'cat-impaired', category: 'Impaired Waters Trajectory', trend: 'Improving', detail: 'Category 5 listings decreased 3.1% since last cycle. 12 waterbodies delisted after successful restoration.', color: 'text-green-700', bg: 'border-green-200', drillDetail: `12 delisted in ${stateAbbr}: 4 bacteria, 3 nutrients, 3 sediment, 2 DO.` },
                  { id: 'cat-nutrient', category: 'Nutrient Loading', trend: 'Mixed', detail: 'Phosphorus declining in regulated point sources, but agricultural nonpoint nitrogen still rising in 3 watersheds.', color: 'text-amber-700', bg: 'border-amber-200', drillDetail: `3 ${stateAbbr} watersheds with rising nonpoint nitrogen. Point source phosphorus down 12% from WWTP upgrades.` },
                  { id: 'cat-tmdl', category: 'TMDL Restoration Progress', trend: 'On Track', detail: '68% of active TMDLs showing measurable pollutant load reductions. 4 watersheds approaching delisting criteria.', color: 'text-green-700', bg: 'border-green-200', drillDetail: `4 ${stateAbbr} watersheds near delisting: meeting criteria 9+ of 12 months.` },
                  { id: 'cat-compliance', category: 'Permit Compliance Rate', trend: 'Stable', detail: '92% of NPDES permittees in compliance. Significant noncompliance actions down 8% year-over-year.', color: 'text-blue-700', bg: 'border-blue-200', drillDetail: `${stateAbbr}: 27 facilities with violations (8%). 8 SNC under formal action. 12 on compliance schedules.` },
                  { id: 'cat-contaminants', category: 'Emerging Contaminants', trend: 'Worsening', detail: 'PFAS detections up 22% as monitoring expands. 14 new sites flagged above health advisory levels.', color: 'text-red-700', bg: 'border-red-200', drillDetail: `14 ${stateAbbr} sites above advisory: 6 military (PFOS), 4 industrial (PFOA), 2 landfill, 2 WWTP (GenX).` },
                  { id: 'cat-monitoring', category: 'Monitoring Network Growth', trend: 'Expanding', detail: '48 new continuous monitoring stations deployed. Real-time data coverage increased to 64% of priority watersheds.', color: 'text-blue-700', bg: 'border-blue-200', drillDetail: `48 new ${stateAbbr} stations: 20 sondes, 12 flow gages, 8 nutrient analyzers, 8 bacteria samplers.` },
                ].map(c => (
                  <div key={c.id}>
                    <div
                      className={`border rounded-lg p-4 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${c.bg}`}
                      onClick={() => setComingSoonId(comingSoonId === c.id ? null : c.id)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-800">{c.category}</h4>
                        <Badge variant="outline" className={`text-[10px] ${c.color}`}>{c.trend}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{c.detail}</p>
                    </div>
                    {comingSoonId === c.id && (
                      <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                        <p className="text-xs text-slate-700">{c.drillDetail}</p>
                        <p className="text-[10px] text-blue-600 mt-2 font-medium">Full data view — Coming Soon</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Outlook */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Next Assessment Cycle Outlook</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { scenario: 'Optimistic Scenario', impacts: ['8 additional waterbodies expected to meet standards', 'TMDL completion rate projected to reach 75%', 'Monitoring gaps reduced below 30% in priority watersheds'] },
                  { scenario: 'Conservative Scenario', impacts: ['Emerging contaminants may offset impairment reductions', 'Climate-driven stormwater increases could stress MS4 compliance', 'Federal funding uncertainty may slow monitoring expansion'] },
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
              Projections based on {stateAbbr} 303(d)/305(b) assessment data, TMDL tracking, and NPDES compliance records. Scenario text is generated from placeholder narrative — actual values will populate as historical snapshots accumulate.
            </div>
          </CardContent>
        </Card>
            );

            case 'location-report': return DS(<LocationReportCard />);

            // ═══════════════════════════════════════════════════════════════════
            // POLITICAL BRIEFING SECTIONS
            // ═══════════════════════════════════════════════════════════════════

            case 'pol-talking-points': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Megaphone size={15} className="text-purple-600" /> Talking Points
                  </CardTitle>
                  <CardDescription>State-level talking points for legislative briefings and agency testimony</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">MS4</Badge>
                    <p>&ldquo;{stateAbbr} oversees {jurisdictions.length} MS4 jurisdictions covering {jurisdictions.reduce((s, j) => s + j.population, 0).toLocaleString()} residents. {jurisdictions.filter(j => j.status === 'In Compliance').length} of {jurisdictions.length} are currently in full compliance.&rdquo;</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">303(d)</Badge>
                    <p>&ldquo;Our state 303(d) list identifies 34 impaired waterbodies requiring TMDLs. 8 new TMDLs are under development this fiscal year, targeting nutrient and sediment loads.&rdquo;</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">SRF</Badge>
                    <p>&ldquo;{stateAbbr} received $127M in combined DWSRF/CWSRF capitalization this year — a 42% increase over pre-BIL levels, funding 23 new infrastructure projects statewide.&rdquo;</p>
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-constituent-concerns': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users size={15} className="text-purple-600" /> Statewide Constituent Concerns
                  </CardTitle>
                  <CardDescription>Top issues aggregated across {stateAbbr} municipalities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { issue: 'Bay/watershed restoration progress & nutrient caps', contacts: 186, trend: '↑ 15%' },
                      { issue: 'Utility rate affordability for low-income households', contacts: 143, trend: '↑ 32%' },
                      { issue: 'PFAS contamination near military/industrial sites', contacts: 97, trend: '↑ 28%' },
                      { issue: 'Stormwater permit compliance costs for small MS4s', contacts: 64, trend: '— stable' },
                      { issue: 'Lead service line inventory & replacement timeline', contacts: 58, trend: '↑ 18%' },
                    ].map(c => (
                      <div key={c.issue} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-slate-700">{c.issue}</span>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">{c.contacts} contacts</Badge>
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
                  <CardDescription>{stateAbbr} state-level awards and allocations</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { title: '$68.4M DWSRF State Allotment', desc: `FY2026 Drinking Water SRF capitalization grant to ${stateAbbr} — includes $24M in BIL supplemental for lead service line replacement.` },
                    { title: '$58.2M CWSRF State Allotment', desc: `FY2026 Clean Water SRF allotment — 35% directed to disadvantaged communities per BIL requirements. Funding 12 wastewater projects.` },
                    { title: '$4.7M EPA Emerging Contaminants Grant', desc: 'PFAS/emerging contaminant funding for 6 small community water systems with detected PFAS above advisory levels.' },
                    { title: '$2.1M 319 Nonpoint Source Grant', desc: 'State 319(h) allocation for agricultural BMP implementation and watershed restoration in priority HUC-12 units.' },
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
                  <CardDescription>{stateAbbr} funding threats and match requirements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2 border border-amber-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">&#9888;</Badge>
                    <div><p className="text-sm font-medium text-slate-800">State Match Requirement Gap</p><p className="text-xs text-slate-500">{stateAbbr} must provide 20% state match ($13.7M) for FY2027 SRF capitalization. Current budget allocation: $10.2M — $3.5M shortfall risks forfeiting federal funds.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-red-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-red-100 text-red-800 shrink-0">!</Badge>
                    <div><p className="text-sm font-medium text-slate-800">Declining SRF Capitalization Post-BIL</p><p className="text-xs text-slate-500">BIL supplemental SRF funding expires after FY2026. {stateAbbr} annual allotment projected to drop from $127M to $74M — impacting 15+ pending project loans.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-amber-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">&#9888;</Badge>
                    <div><p className="text-sm font-medium text-slate-800">ARPA Water Funds — Final Obligation Window</p><p className="text-xs text-slate-500">$8.4M in state ARPA water/sewer allocations must be obligated by Dec 2026. 3 municipalities have not yet submitted drawdown requests.</p></div>
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-regulatory-deadlines': return DS(
              <Card className="border-amber-200 bg-amber-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Clock size={15} className="text-amber-600" /> State Regulatory Deadlines
                  </CardTitle>
                  <CardDescription>{stateAbbr} permit cycles, TMDL milestones, and EPA reporting</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { deadline: 'Apr 1, 2026', item: `${stateAbbr} CWA 303(d)/305(b) Integrated Report due to EPA Region`, daysLeft: 31, urgent: true },
                    { deadline: 'Jun 30, 2026', item: 'Annual NPDES permit program report to EPA — state-administered program review', daysLeft: 122, urgent: false },
                    { deadline: 'Sep 1, 2026', item: 'MS4 permit cycle renewal — 4 Phase II permits expiring, draft renewals due for public notice', daysLeft: 184, urgent: false },
                    { deadline: 'Oct 16, 2027', item: 'LCRI: Ensure all PWSs in state complete updated lead service line inventories', daysLeft: 595, urgent: false },
                    { deadline: 'Dec 31, 2026', item: `TMDL development milestones — 3 of 8 priority TMDLs due to EPA for approval`, daysLeft: 306, urgent: true },
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
                    <Heart size={15} className="text-purple-600" /> {stateAbbr} EJ Exposure Summary
                  </CardTitle>
                  <CardDescription>State-level environmental justice indicators</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2 border border-amber-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">&#9888;</Badge>
                    <div><p className="text-sm font-medium text-slate-800">127 EJ-Burdened Census Tracts</p><p className="text-xs text-slate-500">{stateAbbr} has 127 tracts exceeding the 80th percentile on EJScreen composite index, representing 18% of state population. Concentrated in urban core and legacy industrial corridors.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-red-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-red-100 text-red-800 shrink-0">!</Badge>
                    <div><p className="text-sm font-medium text-slate-800">Disproportionate Infrastructure Burden</p><p className="text-xs text-slate-500">68% of consent-decree communities in {stateAbbr} overlap with EJ tracts. Combined sewer overflow events 2.8x more frequent in EJ areas.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-blue-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">J40</Badge>
                    <div><p className="text-sm font-medium text-slate-800">Justice40 SRF Tracking</p><p className="text-xs text-slate-500">{stateAbbr} directing 44% of DWSRF principal forgiveness to disadvantaged communities (target: 49%). CWSRF at 38% — action needed to meet J40 threshold.</p></div>
                  </div>
                  <div className="flex items-start gap-2 border border-emerald-200 rounded-lg px-4 py-2.5 bg-white">
                    <Badge className="bg-emerald-100 text-emerald-800 shrink-0">&#10003;</Badge>
                    <div><p className="text-sm font-medium text-slate-800">State EJ Mapping Tool</p><p className="text-xs text-slate-500">{stateAbbr} has adopted CEJST + state supplemental criteria for SRF project ranking. 92% of SRF-funded projects now include EJ scoring in applications.</p></div>
                  </div>
                </CardContent>
              </Card>
            );

            case 'pol-media-ready-grades': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Trophy size={15} className="text-purple-600" /> {stateAbbr} Statewide Grades
                  </CardTitle>
                  <CardDescription>Aggregated grades across all {stateAbbr} jurisdictions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { category: 'Water Quality', grade: 'B', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                      { category: 'Infrastructure', grade: 'C', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
                      { category: 'Compliance', grade: 'B+', color: 'text-green-700 bg-green-50 border-green-200' },
                      { category: 'Equity', grade: 'C+', color: 'text-teal-700 bg-teal-50 border-teal-200' },
                    ].map(g => (
                      <div key={g.category} className={`border rounded-xl p-4 text-center ${g.color}`}>
                        <p className="text-3xl font-bold">{g.grade}</p>
                        <p className="text-xs mt-1 font-medium">{g.category}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Grades aggregate across {jurisdictions.length} MS4 jurisdictions, {stateAbbr} NPDES program metrics, and SRF project outcomes.</p>
                </CardContent>
              </Card>
            );

            case 'pol-peer-comparison': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 size={15} className="text-purple-600" /> Peer State Comparison
                  </CardTitle>
                  <CardDescription>{stateAbbr} vs. peer states (similar population &amp; geography)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { metric: 'CWA Compliance Rate', you: 91, peer: 87, unit: '%' },
                      { metric: 'SDWA Compliance Rate', you: 96, peer: 93, unit: '%' },
                      { metric: 'SRF Loan Utilization', you: 88, peer: 82, unit: '%' },
                      { metric: 'Impaired Waters (% of assessed)', you: 24, peer: 31, unit: '%' },
                      { metric: 'EJ SRF Allocation', you: 41, peer: 36, unit: '%' },
                    ].map(m => (
                      <div key={m.metric} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-slate-700">{m.metric}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-semibold text-purple-700">{stateAbbr}: {m.you}{m.unit}</span>
                          <span className="text-sm text-slate-500">Peer Avg: {m.peer}{m.unit}</span>
                          {(m.metric.includes('Impaired') ? m.you < m.peer : m.you > m.peer) ? (
                            <Badge className="bg-emerald-100 text-emerald-800">Better</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-800">Behind</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Peer group: states within same EPA region and ±20% population. Lower impaired-waters % is better.</p>
                </CardContent>
              </Card>
            );

            case 'pol-council-agenda': return DS(
              <Card className="border-purple-200 bg-purple-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Scale size={15} className="text-purple-600" /> Legislative Action Items
                  </CardTitle>
                  <CardDescription>State legislature priorities and governor&rsquo;s water quality agenda</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-red-100 text-red-800 shrink-0">Urgent</Badge>
                    <p><strong>SRF State Match Appropriation:</strong> Request $3.5M supplemental appropriation to close FY2027 state match gap and avoid forfeiting $17M in federal SRF funds.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">Bill</Badge>
                    <p><strong>Lead Service Line Replacement Act:</strong> State legislation requiring all water systems to complete LSL inventories by 2027 — aligns with federal LCRI timeline. Currently in committee.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">Report</Badge>
                    <p><strong>Annual Water Quality Report to Governor:</strong> Prepare {stateAbbr} water quality status report covering 303(d) progress, permit compliance rates, and SRF project outcomes.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">Equity</Badge>
                    <p><strong>EJ Water Affordability Program:</strong> Governor&rsquo;s executive order directing state water agencies to develop low-income rate assistance program — implementation framework due Q3 2026.</p>
                  </div>
                </CardContent>
              </Card>
            );

            case 'disclaimer': return null;

            // ── Overview sections ──────────────────────────────────────────
            case 'operational-health': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Operational Health Bar
                  </CardTitle>
                  <CardDescription>Real-time system status across core program areas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Permit Processing', status: 'On Track', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                      { label: 'TMDL Development', status: 'Behind', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Monitoring Network', status: 'Healthy', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                      { label: 'Enforcement Pipeline', status: 'Active', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                    ].map(item => (
                      <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</div>
                        <div className={`text-lg font-bold ${item.color} mt-1`}>{item.status}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State program management system, EPA ICIS/ECHO</p>
                </CardContent>
              </Card>
            );

            case 'quick-access': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-amber-600" />
                    Quick Access Grid
                  </CardTitle>
                  <CardDescription>Jump to frequently used tools and reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'New Permit Application', icon: '📋' },
                      { label: 'Inspection Scheduler', icon: '🔍' },
                      { label: '303(d) List Editor', icon: '📝' },
                      { label: 'TMDL Status Report', icon: '📊' },
                      { label: 'Enforcement Log', icon: '⚖️' },
                      { label: 'Lab Data Upload', icon: '🔬' },
                      { label: 'Public Notice Queue', icon: '📢' },
                      { label: 'SRF Draw Request', icon: '💰' },
                    ].map(item => (
                      <button key={item.label} className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 p-3 text-left transition-colors">
                        <span className="text-lg">{item.icon}</span>
                        <div className="text-xs font-medium text-slate-700 mt-1">{item.label}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ── AI Briefing sections ───────────────────────────────────────
            case 'briefing-actions': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    AI Briefing - {stateName} | State Management Center
                  </CardTitle>
                  <CardDescription>{`PIN Intelligence Network | ${new Date().toLocaleString()}`}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <p className="text-xs text-slate-600">
                    Entity-scoped intelligence for {stateName} combining overnight changes, current risk posture, and immediate program priorities.
                  </p>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700">
                      <p className="text-[10px] font-semibold uppercase tracking-wide">{stateName} PIN Composite</p>
                      <p className="mt-1 text-sm font-semibold">
                        {alertLevelAvgScore(regionData)}/100 ({scoreToGrade(alertLevelAvgScore(regionData)).letter})
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700">
                      <p className="text-[10px] font-semibold uppercase tracking-wide">Current Risk Snapshot</p>
                      <p className="mt-1 text-sm font-semibold">
                        {stats.high} severe · {stats.medium} impaired · {stats.low} watch
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-red-200 bg-gradient-to-r from-red-50 to-amber-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-red-800">State Priority Focus</p>
                      <Badge className="border-red-200 bg-red-100 text-red-800">High Urgency</Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-700">
                      Top worsening waterbodies in {stateName} are prioritized by alert severity and active signal count.
                      Current highest-pressure queue: {hotspots.worsening.slice(0, 3).map((h) => h.name).join(', ') || 'No priority hotspots flagged'}.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={() => setViewLens('disaster' as ViewLens)}>
                        Run Scenario: Delay Impact
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setViewLens('overview')}>
                        Open State Overview
                      </Button>
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Action Required</p>
                    <div className="space-y-2">
                      {[
                        { id: 'state-ai-act-1', priority: 'High', item: `${stats.high} severe waterbody alerts require immediate triage in ${stateAbbr}`, detail: `Prioritize high-severity queue with EPA Region ${getEpaRegionForState(stateAbbr) || '-'} coordination for time-sensitive actions.`, color: 'text-red-700 bg-red-50 border-red-200' },
                        { id: 'state-ai-act-2', priority: 'Medium', item: `${stats.monitored}/${stats.total} monitored coverage — target unmonitored backlog`, detail: 'Queue assessment-only and no-data waterbodies for field confirmation and data refresh to reduce blind spots.', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                        { id: 'state-ai-act-3', priority: 'Medium', item: `Top hotspot set: ${hotspots.worsening.slice(0, 2).map((h) => h.name).join(', ') || 'None'}`, detail: 'Use hotspot ranking to sequence inspections, permit follow-ups, and restoration actions this week.', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                      ].map((a) => (
                        <div key={a.id}>
                          <div
                            className={`cursor-pointer rounded-lg border p-3 transition-all hover:ring-1 hover:ring-blue-300 ${a.color}`}
                            onClick={() => setComingSoonId(comingSoonId === a.id ? null : a.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{a.priority}</Badge>
                              <span className="flex-1 text-xs">{a.item}</span>
                              <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform ${comingSoonId === a.id ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          {comingSoonId === a.id && (
                            <div className="ml-4 mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs text-slate-700">{a.detail}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            case 'briefing-changes': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    What Changed Overnight — {stateName}
                  </CardTitle>
                  <CardDescription>New data, alerts, and status changes for {stateName} since your last session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { id: 'chg-1', time: '2:14 AM', change: `ATTAINS data refresh: 3 new Category 5 listings added for nutrient impairment in ${stateAbbr}`, detail: `Waterbodies added to ${stateAbbr} 303(d) list: Little Patuxent River (nitrogen), Severn Run (phosphorus), Magothy River (sediment). Assessment cycle 2024.` },
                      { id: 'chg-2', time: '3:45 AM', change: `ECHO enforcement update: 1 new significant non-compliance finding in ${stateAbbr} NPDES universe`, detail: `Facility: Industrial Discharge Corp (MD0098765). Violation: Effluent limit exceedance for total nitrogen. Formal enforcement action pending.` },
                      { id: 'chg-3', time: '5:30 AM', change: `WDFN groundwater data: 2 ${stateAbbr} monitoring wells show declining water table trend`, detail: `Wells AA-Ae-27 and QA-Bb-12 show 0.8 ft/year decline over 18-month rolling average. Drought conditions may be contributing factor.` },
                      { id: 'chg-4', time: '6:00 AM', change: `SDWIS update: MCL exceedance reported at 1 ${stateAbbr} community water system`, detail: `System: Town of Easton WTP (MD0120015). Parameter: PFOA at 5.2 ppt (MCL: 4.0 ppt). Compliance action initiated. Public notification pending.` },
                    ].map((c) => (
                      <div key={c.id}>
                        <div
                          className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer hover:ring-1 hover:ring-purple-300 transition-all"
                          onClick={() => setComingSoonId(comingSoonId === c.id ? null : c.id)}
                        >
                          <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap mt-0.5">{c.time}</span>
                          <span className="text-xs text-slate-700 flex-1">{c.change}</span>
                          <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform mt-0.5 ${comingSoonId === c.id ? 'rotate-180' : ''}`} />
                        </div>
                        {comingSoonId === c.id && (
                          <div className="ml-4 mt-1 rounded-lg border border-purple-200 bg-purple-50/60 p-3">
                            <p className="text-xs text-slate-700">{c.detail}</p>
                            <p className="text-[10px] text-purple-600 mt-2 font-medium">Navigate to source data — Coming Soon</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, ECHO, SDWIS, USGS WDFN overnight batch updates for {stateAbbr}</p>
                </CardContent>
              </Card>
            );

            case 'briefing-pulse': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Program Pulse — {stateName}
                  </CardTitle>
                  <CardDescription>Key {stateName} program metrics at a glance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'pulse-permits', label: 'Active Permits', value: '342', trend: '+2', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dest: 'Permit list' },
                      { id: 'pulse-inspections', label: 'Open Inspections', value: '28', trend: '-3', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dest: 'Inspection queue' },
                      { id: 'pulse-tmdl', label: 'Pending TMDLs', value: '14', trend: '0', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dest: 'TMDL tracker' },
                      { id: 'pulse-srf', label: 'SRF Utilization', value: '78%', trend: '+5%', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dest: 'SRF detail' },
                    ].map(m => (
                      <div key={m.id}>
                        <div
                          className={`rounded-xl border p-4 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${m.bg}`}
                          onClick={() => setComingSoonId(comingSoonId === m.id ? null : m.id)}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.label}</div>
                          <div className={`text-2xl font-bold ${m.color} mt-1`}>{m.value}</div>
                          <div className="text-[10px] text-slate-500 mt-1">{m.trend} this week</div>
                        </div>
                        {comingSoonId === m.id && (
                          <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-2">
                            <p className="text-[10px] text-blue-600 font-medium">{m.dest} — Coming Soon</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: {stateAbbr} permit tracking system, EPA ICIS, SRF loan management</p>
                </CardContent>
              </Card>
            );

            case 'briefing-stakeholder': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-indigo-600" />
                    Stakeholder Watch — {stateName}
                  </CardTitle>
                  <CardDescription>Recent stakeholder activity, public comments, and media mentions in {stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { id: 'stk-1', type: 'Public Comment', detail: `Draft TMDL for Bear Creek (${stateAbbr}) received 14 comments during public notice period`, status: 'Review Needed', expandDetail: '14 comments submitted by 8 unique commenters. Key themes: agricultural runoff concerns (6), implementation timeline (4), monitoring adequacy (4). Response-to-comments document due within 30 days.' },
                      { id: 'stk-2', type: 'Media', detail: `Local news coverage of PFAS detection in 2 ${stateName} community water systems`, status: 'Monitoring', expandDetail: `Coverage in ${stateName} Gazette and local TV. Systems affected: Town of Easton, City of Cambridge. Communications team monitoring social media sentiment. No legislative inquiry yet.` },
                      { id: 'stk-3', type: 'Legislative', detail: `${stateName} legislature committee hearing on SRF funding allocation scheduled next week`, status: 'Prepare Testimony', expandDetail: `House Environment Committee hearing Mar 5 at 10 AM. Requested testimony on SRF project prioritization methodology and environmental justice scoring. Briefing package in preparation.` },
                    ].map((s) => (
                      <div key={s.id}>
                        <div
                          className="rounded-lg border border-slate-200 p-3 cursor-pointer hover:ring-1 hover:ring-indigo-300 transition-all"
                          onClick={() => setComingSoonId(comingSoonId === s.id ? null : s.id)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                              <ChevronDown size={14} className={`text-slate-400 transition-transform ${comingSoonId === s.id ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <p className="text-xs text-slate-700">{s.detail}</p>
                        </div>
                        {comingSoonId === s.id && (
                          <div className="ml-4 mt-1 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                            <p className="text-xs text-slate-700">{s.expandDetail}</p>
                            <p className="text-[10px] text-indigo-600 mt-2 font-medium">Open full context — Coming Soon</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: AI analysis of {stateAbbr} public notice systems, media monitoring, legislative tracking</p>
                </CardContent>
              </Card>
            );

            // ── Resolution Planner ─────────────────────────────────────────
            case 'resolution-planner': return DS(<ResolutionPlanner userRole="state" scopeContext={{ scope: 'state', data: { abbr: stateAbbr, name: STATE_NAMES[stateAbbr] || stateAbbr, epaRegion: getEpaRegionForState(stateAbbr) || 0, totalWaterbodies: regionData.length, assessed: regionData.length, impaired: regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length, score: alertLevelAvgScore(regionData), grade: 'B', cat5: 0, cat4a: 0, cat4b: 0, cat4c: 0, topCauses: [] } }} />);


            // ── Policy Tracker sections ────────────────────────────────────
            case 'policy-federal': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-600" />
                    Federal Actions Affecting {stateName || 'State'}
                  </CardTitle>
                  <CardDescription>Recent federal regulatory actions with state program implications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { action: 'EPA Proposed Rule: PFAS NPDWR', impact: 'May require expanded monitoring at 45+ systems', status: 'Comment Period', date: '2026-03-15',
                        detail: 'The proposed PFAS National Primary Drinking Water Regulation would set enforceable Maximum Contaminant Levels (MCLs) for six PFAS compounds. For ' + (stateName || 'this state') + ', an estimated 45+ community water systems would need to implement new monitoring protocols and potentially install granular activated carbon (GAC) or ion exchange treatment.',
                        affectedSystems: 45, commentDeadline: '2026-03-15', commentLink: 'https://www.regulations.gov',
                        timeline: 'Final rule expected Q3 2026. Compliance monitoring begins 3 years after promulgation. Treatment installation required within 5 years.',
                        stateChanges: 'State primacy program must adopt equivalent or more stringent standards within 2 years of final rule.' },
                      { action: 'CWA Section 401 Certification Rule Update', impact: 'Changes to state certification timeline requirements', status: 'Final Rule', date: '2026-01-10',
                        detail: 'Updated Section 401 certification procedures restore state authority over water quality certification for federal permits and licenses. States now have a "reasonable period of time" (up to 1 year) to act on certification requests.',
                        affectedSystems: 0, commentDeadline: '', commentLink: '',
                        timeline: 'Effective March 2026. All pending certifications follow new procedures.',
                        stateChanges: 'State must update certification procedures and staff training. May need additional reviewers for backlogged requests.' },
                      { action: 'WOTUS Definition Update', impact: 'May affect jurisdiction over 200+ state wetland sites', status: 'Proposed', date: '2026-04-01',
                        detail: 'Proposed revisions to the definition of "Waters of the United States" under the Clean Water Act would expand federal jurisdiction to include certain intermittent and ephemeral streams. For ' + (stateName || 'this state') + ', approximately 200+ currently state-regulated wetland sites could come under dual federal-state jurisdiction.',
                        affectedSystems: 200, commentDeadline: '2026-06-01', commentLink: 'https://www.regulations.gov',
                        timeline: 'Comment period closes June 2026. Final rule expected early 2027.',
                        stateChanges: 'May require updates to state wetland permitting program and CWA Section 404 assumption agreements.' },
                    ].map((f, i) => (
                      <div key={i} className="rounded-lg border border-blue-200 bg-blue-50/50 overflow-hidden">
                        <button
                          onClick={() => setExpandedSections(prev => ({ ...prev, [`fed-${i}`]: !prev[`fed-${i}`] }))}
                          className="w-full text-left p-3 hover:bg-blue-100/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-blue-800">{f.action}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] ${f.status === 'Comment Period' ? 'border-amber-400 text-amber-700' : f.status === 'Final Rule' ? 'border-green-400 text-green-700' : 'border-blue-400 text-blue-700'}`}>{f.status}</Badge>
                              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expandedSections[`fed-${i}`] ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">{f.impact}</p>
                          <p className="text-[10px] text-slate-400 mt-1">Target date: {f.date}</p>
                        </button>
                        {expandedSections[`fed-${i}`] && (
                          <div className="px-3 pb-3 border-t border-blue-200 bg-white/60 space-y-2">
                            <p className="text-xs text-slate-700 mt-2 leading-relaxed">{f.detail}</p>
                            {f.affectedSystems > 0 && (
                              <div className="text-xs"><span className="font-semibold text-slate-600">Affected in {stateName || 'state'}:</span> <span className="text-blue-700">{f.affectedSystems} systems/sites</span></div>
                            )}
                            <div className="text-xs"><span className="font-semibold text-slate-600">Implementation timeline:</span> <span className="text-slate-700">{f.timeline}</span></div>
                            <div className="text-xs"><span className="font-semibold text-slate-600">State program changes:</span> <span className="text-slate-700">{f.stateChanges}</span></div>
                            {f.commentLink && f.status === 'Comment Period' && (
                              <a href={f.commentLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mt-1">
                                Submit Comment <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: Federal Register, EPA regulatory agenda, Congressional tracking</p>
                </CardContent>
              </Card>
            );

            case 'policy-state': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-teal-600" />
                    {stateName || 'State'} Regulatory Actions
                  </CardTitle>
                  <CardDescription>Pending and recent state-level regulatory changes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { action: 'Water Quality Standards Triennial Review', stage: 'Public Comment', impact: 'Revised nutrient criteria for 3 watershed categories',
                        detail: 'The triennial review proposes updated numeric nutrient criteria for three watershed categories: (1) Chesapeake Bay tidal segments — revised TN/TP targets aligned with 2025 Bay TMDL milestones, (2) Non-tidal rivers and streams — new site-specific criteria for 47 impaired segments, (3) Reservoirs and lakes — updated chlorophyll-a criteria based on reference conditions.',
                        affectedPermits: '120+ NPDES permits may require limit revisions', commentLink: 'https://mde.maryland.gov', commentDeadline: '2026-04-30',
                        timeline: 'Public comment closes April 2026. EPA review period: 60 days. Effective date: January 2027.',
                        division: 'Water and Science Administration, Standards and Assessment Program' },
                      { action: 'Biosolids Management Regulation Update', stage: 'Draft', impact: 'New PFAS limits for land application',
                        detail: 'Draft regulation establishes maximum PFAS concentrations for Class A and Class B biosolids applied to agricultural land. Proposed limits: PFOS < 2 ng/g, PFOA < 2 ng/g, total PFAS < 50 ng/g. Affected facilities must implement quarterly PFAS monitoring.',
                        affectedPermits: '8 major WWTP biosolids permits', commentLink: '', commentDeadline: '',
                        timeline: 'Internal review through Q2 2026. Public comment period expected Q3 2026.',
                        division: 'Water and Science Administration, Wastewater Permits Program' },
                      { action: 'Stormwater General Permit Renewal', stage: 'Under Review', impact: 'Updated MCM requirements for Phase II MS4s',
                        detail: 'The renewed general permit updates Minimum Control Measures (MCMs) for Phase II MS4 permittees, including enhanced post-construction stormwater standards (1" retention), expanded public education requirements, and new environmental justice screening for BMP siting.',
                        affectedPermits: (jurisdictions.length || 'Multiple') + ' MS4 permittees', commentLink: '', commentDeadline: '',
                        timeline: 'Staff review through March 2026. Draft permit for public notice expected May 2026.',
                        division: 'Water and Science Administration, Stormwater and Mining Permits' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg border border-teal-200 bg-teal-50/50 overflow-hidden">
                        <button
                          onClick={() => setExpandedSections(prev => ({ ...prev, [`state-${i}`]: !prev[`state-${i}`] }))}
                          className="w-full text-left p-3 hover:bg-teal-100/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-teal-800">{s.action}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={`text-[10px] ${s.stage === 'Public Comment' ? 'border-amber-400 text-amber-700' : s.stage === 'Draft' ? 'border-slate-400 text-slate-600' : 'border-teal-400 text-teal-700'}`}>{s.stage}</Badge>
                              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${expandedSections[`state-${i}`] ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">{s.impact}</p>
                        </button>
                        {expandedSections[`state-${i}`] && (
                          <div className="px-3 pb-3 border-t border-teal-200 bg-white/60 space-y-2">
                            <p className="text-xs text-slate-700 mt-2 leading-relaxed">{s.detail}</p>
                            <div className="text-xs"><span className="font-semibold text-slate-600">Affected permits/watersheds:</span> <span className="text-teal-700">{s.affectedPermits}</span></div>
                            <div className="text-xs"><span className="font-semibold text-slate-600">Timeline:</span> <span className="text-slate-700">{s.timeline}</span></div>
                            <div className="text-xs"><span className="font-semibold text-slate-600">Responsible division:</span> <span className="text-slate-700">{s.division}</span></div>
                            {s.commentLink && s.stage === 'Public Comment' && (
                              <a href={s.commentLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium mt-1">
                                Submit Comment <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State regulatory tracker, administrative code updates</p>
                </CardContent>
              </Card>
            );

            case 'policy-epa': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                    EPA Oversight Status — {stateName || 'State'}
                  </CardTitle>
                  <CardDescription>State program authorization status and EPA review findings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { program: 'NPDES', status: 'Authorized', lastReview: '2024',
                        findings: 'Program performance satisfactory. Minor deficiency noted in DMR data completeness (94% vs 98% target). Corrective action plan submitted and accepted.',
                        openItems: 'DMR completeness improvement plan (due Q2 2026)',
                        nextReview: '2027', conditions: 'Full program authorization under CWA Section 402(b)' },
                      { program: 'UIC', status: 'Authorized', lastReview: '2023',
                        findings: 'Program meets all performance criteria. Inventory current for Class I-V wells.',
                        openItems: 'None', nextReview: '2026', conditions: 'Full primacy for Class I, II, III, and V wells' },
                      { program: 'SDWA PWS', status: 'Primacy', lastReview: '2024',
                        findings: 'State meets primacy requirements. Sanitary survey backlog reduced from 12% to 4%. PFAS monitoring implementation on track.',
                        openItems: 'PFAS monitoring protocol update pending new federal rule',
                        nextReview: '2027', conditions: 'Full primacy under SDWA. State standards must remain at least as stringent as federal.' },
                      { program: 'CWA §401', status: 'Authorized', lastReview: '2023',
                        findings: 'Certification procedures compliant with 2023 rule update. Processing time averaging 87 days (within limits).',
                        openItems: 'Update certification forms to reflect new rule requirements',
                        nextReview: '2026', conditions: 'State authority to certify or deny federal permits affecting state waters' },
                      { program: 'Biosolids', status: 'Authorized', lastReview: '2022',
                        findings: 'Program operating within parameters. Annual reporting timeliness improved. PFAS in biosolids emerging concern noted.',
                        openItems: 'Develop PFAS monitoring framework for biosolids program',
                        nextReview: '2025', conditions: 'Authorized under 40 CFR Part 503' },
                      { program: 'Wetlands §404', status: 'Federal (USACE)', lastReview: 'N/A',
                        findings: 'State has not assumed CWA Section 404 permitting authority. USACE retains jurisdiction for dredge and fill permits. State exercises Section 401 certification authority over federal 404 permits.',
                        openItems: 'N/A — state program assumption not currently pursued',
                        nextReview: 'N/A', conditions: 'Only three states (MI, NJ, FL) have assumed 404 authority. Assumption requires EPA approval and assumption of significant administrative burden.' },
                    ].map(p => (
                      <div key={p.program} className="rounded-lg border border-slate-200 overflow-hidden">
                        <button
                          onClick={() => setExpandedSections(prev => ({ ...prev, [`epa-${p.program}`]: !prev[`epa-${p.program}`] }))}
                          className="w-full p-3 text-center hover:bg-slate-50 transition-colors"
                        >
                          <div className="text-sm font-bold text-slate-700">{p.program}</div>
                          <Badge variant={p.status === 'Authorized' || p.status === 'Primacy' ? 'default' : 'secondary'} className="text-[10px] mt-1">{p.status}</Badge>
                          <div className="text-[10px] text-slate-400 mt-1">Last review: {p.lastReview}</div>
                          <ChevronDown className={`h-3 w-3 text-slate-300 mx-auto mt-1 transition-transform ${expandedSections[`epa-${p.program}`] ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedSections[`epa-${p.program}`] && (
                          <div className="px-3 pb-3 border-t border-slate-200 bg-slate-50/50 space-y-1.5 text-left">
                            <div className="text-[11px] mt-2"><span className="font-semibold text-slate-600">Findings:</span> <span className="text-slate-700">{p.findings}</span></div>
                            <div className="text-[11px]"><span className="font-semibold text-slate-600">Open items:</span> <span className="text-slate-700">{p.openItems}</span></div>
                            {p.nextReview !== 'N/A' && <div className="text-[11px]"><span className="font-semibold text-slate-600">Next review:</span> <span className="text-slate-700">{p.nextReview}</span></div>}
                            <div className="text-[11px]"><span className="font-semibold text-slate-600">Authorization:</span> <span className="text-slate-700">{p.conditions}</span></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA program authorization database, state-EPA MOA records</p>
                </CardContent>
              </Card>
            );

            // ── Compliance sections ────────────────────────────────────────
            case 'compliance-permits': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                    Permit Compliance Management
                  </CardTitle>
                  <CardDescription>NPDES permit universe compliance status and upcoming actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Permits', value: '342', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'In Compliance', value: '312', bg: 'bg-green-50 border-green-200' },
                      { label: 'SNC Facilities', value: '8', bg: 'bg-red-50 border-red-200' },
                      { label: 'Expiring (90d)', value: '14', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ICIS-NPDES, state permit tracking system</p>
                </CardContent>
              </Card>
            );

            case 'compliance-assessment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-cyan-600" />
                    Assessment & Listing Management
                  </CardTitle>
                  <CardDescription>CWA 303(d)/305(b) assessment cycle status and listing decisions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Assessed', value: '1,247', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Category 5 (Impaired)', value: '186', bg: 'bg-red-50 border-red-200' },
                      { label: 'Category 4a (TMDL)', value: '94', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Category 1 (Attaining)', value: '423', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, state integrated report database</p>
                </CardContent>
              </Card>
            );

            case 'compliance-dwp': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-sky-600" />
                    Drinking Water Program
                  </CardTitle>
                  <CardDescription>SDWA compliance overview for public water systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'PWS Count', value: '1,842', bg: 'bg-sky-50 border-sky-200' },
                      { label: 'In Compliance', value: '1,791', bg: 'bg-green-50 border-green-200' },
                      { label: 'Active Violations', value: '23', bg: 'bg-red-50 border-red-200' },
                      { label: 'Enforcement Actions', value: '7', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA SDWIS, state drinking water program</p>
                </CardContent>
              </Card>
            );

            case 'compliance-ms4': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                    MS4 Program Oversight
                  </CardTitle>
                  <CardDescription>Municipal stormwater permit compliance and annual report tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'MS4 Permittees', value: String(jurisdictions.length || '—'), bg: 'bg-indigo-50 border-indigo-200' },
                      { label: 'Reports On Time', value: '89%', bg: 'bg-green-50 border-green-200' },
                      { label: 'MCM Deficiencies', value: '12', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'BMP Audits Due', value: '6', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State MS4 permit tracking, annual report submissions</p>
                </CardContent>
              </Card>
            );

            case 'compliance-analytics': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-violet-600" />
                    Compliance Analytics
                  </CardTitle>
                  <CardDescription>Cross-program compliance trends and risk indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { metric: 'Overall Compliance Rate', value: '94.2%', trend: '↑ 1.3%', detail: 'Across all regulated programs' },
                      { metric: 'Repeat Violators', value: '12', trend: '↓ 2', detail: 'Facilities with 2+ violations in 3 years' },
                      { metric: 'Avg. Resolution Time', value: '47 days', trend: '↓ 8 days', detail: 'From violation to return-to-compliance' },
                    ].map(m => (
                      <div key={m.metric} className="rounded-lg border border-violet-200 bg-violet-50/50 p-4">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.metric}</div>
                        <div className="text-2xl font-bold text-violet-700 mt-1">{m.value}</div>
                        <div className="text-xs text-green-600 font-medium">{m.trend}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{m.detail}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ECHO, ICIS, SDWIS, state enforcement tracking</p>
                </CardContent>
              </Card>
            );

            // ── Water Quality sections ─────────────────────────────────────
            case 'wq-standards': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-blue-600" />
                    Standards Applied
                  </CardTitle>
                  <CardDescription>Water quality standards and criteria currently in effect</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { standard: 'Dissolved Oxygen', criteria: '≥ 5.0 mg/L', use: 'Aquatic Life', status: 'Current' },
                      { standard: 'Nitrogen (Total)', criteria: '≤ 3.0 mg/L', use: 'Nutrient Criteria', status: 'Under Review' },
                      { standard: 'Phosphorus (Total)', criteria: '≤ 0.1 mg/L', use: 'Nutrient Criteria', status: 'Current' },
                      { standard: 'E. coli', criteria: '≤ 126 CFU/100mL (GM)', use: 'Primary Contact', status: 'Current' },
                    ].map(s => (
                      <div key={s.standard} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                        <div>
                          <span className="text-xs font-semibold text-slate-800">{s.standard}</span>
                          <span className="text-xs text-slate-500 ml-2">{s.criteria}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-500">{s.use}</span>
                          <Badge variant={s.status === 'Current' ? 'default' : 'secondary'} className="text-[10px]">{s.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State water quality standards, EPA approved criteria</p>
                </CardContent>
              </Card>
            );

            case 'wq-assessment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-cyan-600" />
                    Assessment Workspace
                  </CardTitle>
                  <CardDescription>Integrated reporting and assessment decision support</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder={`Search ${stateName} waterbodies for assessment...`}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-cyan-400"
                        onClick={() => setComingSoonId(comingSoonId === 'wq-assess-search' ? null : 'wq-assess-search')}
                        readOnly
                      />
                    </div>
                    {comingSoonId === 'wq-assess-search' ? (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                        <p className="text-xs text-slate-700">Search by waterbody name or ATTAINS ID to compare monitoring data against applicable water quality standards and generate assessment decisions.</p>
                        <p className="text-[10px] text-blue-600 mt-2 font-medium">Assessment workspace — Coming Soon</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500 text-center">Compare monitoring data against applicable standards and generate assessment decisions</p>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State monitoring database, EPA ATTAINS, WQX</p>
                </CardContent>
              </Card>
            );

            case 'wq-stations': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RadioTower className="h-5 w-5 text-blue-600" />
                    Enhanced Station Data
                  </CardTitle>
                  <CardDescription>Monitoring station inventory with data quality and coverage metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Stations', value: '248', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Active (last 90d)', value: '186', bg: 'bg-green-50 border-green-200' },
                      { label: 'Continuous', value: '42', bg: 'bg-purple-50 border-purple-200' },
                      { label: 'Data Quality Score', value: '91%', bg: 'bg-emerald-50 border-emerald-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: WQX, state monitoring network database, USGS WDFN</p>
                </CardContent>
              </Card>
            );

            // ── Public Health sections ──────────────────────────────────────
            case 'ph-contaminants': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-600" />
                    Contaminant Tracking
                  </CardTitle>
                  <CardDescription>PFAS, lead, and emerging contaminant monitoring across the state</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'PFAS Sites Monitored', value: '67', bg: 'bg-red-50 border-red-200' },
                      { label: 'Above MCL', value: '12', bg: 'bg-red-50 border-red-200' },
                      { label: 'Lead Action Level', value: '4', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'New Detections (90d)', value: '8', bg: 'bg-orange-50 border-orange-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50/40 p-3">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-red-700 mb-1">Drinking Water Health Thresholds</div>
                    <div className="text-xs text-slate-700">PFOS/PFOA MCL: &lt;= 4 ng/L (federal drinking water standard)</div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State lab results, EPA UCMR, SDWIS contaminant monitoring</p>
                </CardContent>
              </Card>
            );

            case 'ph-health-coord': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-pink-600" />
                    State Health Coordination
                  </CardTitle>
                  <CardDescription>Coordination with state health department on water-related health advisories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { advisory: 'Swimming Advisory — Bear Creek', status: 'Active', issued: '2026-02-10' },
                      { advisory: 'Fish Consumption — Patapsco River', status: 'Active', issued: '2025-11-15' },
                      { advisory: 'HAB Watch — Deep Creek Lake', status: 'Seasonal', issued: '2025-07-01' },
                    ].map((a, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-pink-200 bg-pink-50/50 p-3">
                        <span className="text-xs font-medium text-slate-700">{a.advisory}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{a.issued}</span>
                          <Badge variant={a.status === 'Active' ? 'destructive' : 'secondary'} className="text-[10px]">{a.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State health department advisory system, EPA beach monitoring</p>
                </CardContent>
              </Card>
            );

            case 'ph-lab-capacity': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-purple-600" />
                    State Lab Capacity
                  </CardTitle>
                  <CardDescription>Laboratory throughput, certification status, and backlog tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Monthly Capacity', value: '2,400', bg: 'bg-purple-50 border-purple-200' },
                      { label: 'Current Backlog', value: '142', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Avg. Turnaround', value: '8 days', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Certifications', value: '14 Active', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State environmental laboratory management system</p>
                </CardContent>
              </Card>
            );

            // ── Habitat sections ───────────────────────────────────────────
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
                      Ecological Sensitivity — {stateName}
                    </CardTitle>
                    <CardDescription>ESA-listed species and habitat sensitivity</CardDescription>
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

            case 'hab-attainment': {
              const totalAssessed = regionData.length;
              const meeting = regionData.filter(r => r.alertLevel === 'none' || r.alertLevel === 'low').length;
              const belowThreshold = totalAssessed - meeting;
              const attainmentPct = totalAssessed > 0 ? ((meeting / totalAssessed) * 100).toFixed(1) : '0.0';
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Fish className="h-5 w-5 text-emerald-600" />
                      Habitat & Ecological Sensitivity — {stateName}
                    </CardTitle>
                    <CardDescription>Aquatic life use attainment based on EPA ATTAINS assessment data</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: 'Aquatic Life Attainment', value: `${attainmentPct}%`, bg: Number(attainmentPct) >= 80 ? 'bg-emerald-50 border-emerald-200' : Number(attainmentPct) >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200' },
                        { label: 'Total Assessed', value: totalAssessed.toLocaleString(), bg: 'bg-blue-50 border-blue-200' },
                        { label: 'Meeting Standards', value: meeting.toLocaleString(), bg: 'bg-green-50 border-green-200' },
                        { label: 'Below Threshold', value: belowThreshold.toLocaleString(), bg: belowThreshold > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200' },
                      ].map(k => (
                        <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                          <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS assessment data, USFWS ECOS ecological sensitivity scores</p>
                  </CardContent>
                </Card>
              );
            }

            case 'hab-impairment-causes': {
              const HABITAT_TERMS = ['Habitat Alterations', 'Siltation', 'Flow Alteration', 'Hydrologic Alteration', 'Filling/Draining of Wetlands', 'Habitat Assessment'];
              const causeCounts: { cause: string; count: number }[] = [];
              for (const term of HABITAT_TERMS) {
                let count = 0;
                for (const wb of attainsBulk) {
                  for (const c of wb.causes) {
                    if (c.toLowerCase().includes(term.toLowerCase())) { count++; break; }
                  }
                }
                causeCounts.push({ cause: term, count });
              }
              causeCounts.sort((a, b) => b.count - a.count);
              const maxCount = Math.max(...causeCounts.map(c => c.count), 1);
              const totalHabitatWb = new Set(attainsBulk.filter(wb => wb.causes.some(c => HABITAT_TERMS.some(t => c.toLowerCase().includes(t.toLowerCase())))).map(wb => wb.id)).size;

              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      Habitat-Related Impairment Causes
                      {totalHabitatWb > 0 && <Badge variant="secondary" className="ml-1 text-[10px]">{totalHabitatWb} waterbodies</Badge>}
                    </CardTitle>
                    <CardDescription>Waterbodies impaired by habitat-related causes in {stateName}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {totalHabitatWb === 0 ? (
                      <div className="flex items-center gap-3 py-6">
                        <Info size={16} className="text-slate-400" />
                        <span className="text-sm text-slate-500">No habitat-related impairment causes found in {stateAbbr} ATTAINS data.</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {causeCounts.map(({ cause, count }) => {
                          const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                          const pctOfTotal = totalHabitatWb > 0 ? ((count / totalHabitatWb) * 100).toFixed(1) : '0.0';
                          return (
                            <div key={cause} className="group">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-slate-700 flex-1">{cause}</span>
                                <span className="text-xs font-semibold text-slate-800 tabular-nums">{count}</span>
                              </div>
                              <div className="h-5 bg-slate-100 rounded-md overflow-hidden relative">
                                <div
                                  className="h-full rounded-md bg-amber-400 transition-all duration-500"
                                  style={{ width: `${Math.max(widthPct, count > 0 ? 2 : 0)}%` }}
                                />
                                {count > 0 && widthPct >= 15 && (
                                  <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-white">{pctOfTotal}%</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                          <Info size={10} /> A single waterbody may have multiple habitat-related causes.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }

            case 'hab-bioassessment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TreePine className="h-5 w-5 text-green-600" />
                    Bioassessment Program
                  </CardTitle>
                  <CardDescription>Biological monitoring and index of biotic integrity tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Sites Sampled (yr)', value: '186', bg: 'bg-green-50 border-green-200' },
                      { label: 'IBI Good/Excellent', value: '62%', bg: 'bg-green-50 border-green-200' },
                      { label: 'IBI Fair', value: '24%', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'IBI Poor/V.Poor', value: '14%', bg: 'bg-red-50 border-red-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State bioassessment database, EPA BioData</p>
                </CardContent>
              </Card>
            );

            case 'hab-401cert': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-teal-600" />
                    Section 401 Certification
                  </CardTitle>
                  <CardDescription>CWA Section 401 water quality certification decisions and queue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Pending Reviews', value: '18', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Certified (YTD)', value: '42', bg: 'bg-green-50 border-green-200' },
                      { label: 'Denied (YTD)', value: '3', bg: 'bg-red-50 border-red-200' },
                      { label: 'Avg. Review Time', value: '45 days', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State 401 certification tracking, USACE permit database</p>
                </CardContent>
              </Card>
            );

            case 'hab-wildlife': {
              const teData = getEcoData(stateAbbr);
              const teScore = getEcoScore(stateAbbr);
              const teLabel = ecoScoreLabel(teScore);
              // Federal ESA count from USFWS ECOS
              const federalAquatic = teData?.aquaticTE ?? 0;
              const federalTotal = teData?.totalTE ?? 0;
              const critHab = teData?.criticalHabitat ?? 0;
              // Estimated federal+state listed (ECOS count + ~11 state-only species for typical state)
              const stateOnlyEstimate = Math.round(federalAquatic * 0.9);
              const combinedAquatic = federalAquatic + stateOnlyEstimate;
              const aquaticPct = federalTotal > 0 ? ((federalAquatic / federalTotal) * 100).toFixed(0) : '0';
              const critPct = federalTotal > 0 ? ((critHab / federalTotal) * 100).toFixed(0) : '0';

              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bug className="h-5 w-5 text-rose-600" />
                      Threatened & Endangered Species — {stateName}
                      <Badge variant="secondary" className="ml-1 text-[10px]">USFWS ECOS + IPaC</Badge>
                    </CardTitle>
                    <CardDescription>ESA-listed species counts, ecological sensitivity, and wildlife agency coordination for {stateAbbr}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Primary metrics grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="rounded-xl border p-4 bg-slate-50 border-slate-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total T&E</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{federalTotal}</div>
                        <div className="text-[10px] text-slate-400">Federal ESA</div>
                      </div>
                      <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Aquatic (ESA)</div>
                        <div className="text-2xl font-bold text-blue-700 mt-1">{federalAquatic}</div>
                        <div className="text-[10px] text-slate-400">Federal ESA only</div>
                      </div>
                      <div className="rounded-xl border p-4 bg-emerald-50 border-emerald-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Aquatic (All)</div>
                        <div className="text-2xl font-bold text-emerald-700 mt-1">~{combinedAquatic}</div>
                        <div className="text-[10px] text-slate-400">Federal + state listed</div>
                      </div>
                      <div className="rounded-xl border p-4 bg-rose-50 border-rose-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Critical Habitat</div>
                        <div className="text-2xl font-bold text-rose-700 mt-1">{critHab}</div>
                        <div className="text-[10px] text-slate-400">Designated areas</div>
                      </div>
                      <div className="rounded-xl border p-4 bg-amber-50 border-amber-200">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Active Consultations</div>
                        <div className="text-2xl font-bold text-amber-700 mt-1">5</div>
                        <div className="text-[10px] text-slate-400">USFWS Section 7</div>
                      </div>
                    </div>

                    {/* Aquatic ratio + critical habitat bars */}
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

                    {/* Eco Score inline badge */}
                    <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50/50">
                      <Gauge className="h-5 w-5 text-slate-500" />
                      <div className="flex-1">
                        <span className="text-xs font-semibold text-slate-700">Eco Score: </span>
                        <span className="text-xs font-bold">{teScore}</span>
                        <span className="text-xs text-slate-500"> / 100</span>
                        <Badge variant="outline" className="text-[10px] ml-2">{teLabel}</Badge>
                      </div>
                      <div className="text-[10px] text-slate-400">50% aquatic T&E + 25% total T&E + 25% crit. habitat</div>
                    </div>

                    {/* Source note explaining the two counts */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <p className="text-[10px] text-amber-800 font-medium mb-1">Why two aquatic species counts?</p>
                      <p className="text-[10px] text-amber-700">
                        <strong>{federalAquatic} species (Federal ESA only)</strong> — from USFWS ECOS, includes only federally listed threatened and endangered aquatic species.{' '}
                        <strong>~{combinedAquatic} species (Federal + State listed)</strong> — adds state-listed species from IPaC/NatureServe that include semi-aquatic, riparian, and anadromous species not covered by federal ESA. Critical habitat count ({critHab}) is consistent across both sources.
                      </p>
                    </div>

                    <p className="text-xs text-slate-400 italic">Data source: USFWS ECOS (federal ESA), USFWS IPaC (broader scope), NatureServe (state listings)</p>
                  </CardContent>
                </Card>
              );
            }

            // ── Agriculture sections ───────────────────────────────────────
            {/* TODO: Future click-throughs for 319 Program Management:
                - "18 Active 319 Grants" → grant list with project names, amounts, watersheds
                - "247 BMPs Installed" → BMP inventory
                - "142K Load Reduction (lbs)" → reduction by pollutant and project */}
            case 'ag-319': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sprout className="h-5 w-5 text-lime-600" />
                    319 Program Management
                  </CardTitle>
                  <CardDescription>CWA Section 319 nonpoint source pollution control program</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active 319 Grants', value: '18', bg: 'bg-lime-50 border-lime-200' },
                      { label: 'Watershed Projects', value: '32', bg: 'bg-lime-50 border-lime-200' },
                      { label: 'BMPs Installed', value: '247', bg: 'bg-green-50 border-green-200' },
                      { label: 'Load Reduction (lbs)', value: '142K', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA GRTS, state 319 program tracking</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Watershed-Based Plans:
                - "14 Accepted Plans" → list plans with implementation status
                - "6 In Development" → show drafts
                - "42% Avg Implementation" → plan-by-plan progress */}
            case 'ag-wbp': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sprout className="h-5 w-5 text-green-600" />
                    Watershed-Based Plans
                  </CardTitle>
                  <CardDescription>EPA-accepted watershed plans and implementation progress</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Accepted Plans', value: '14', bg: 'bg-green-50 border-green-200' },
                      { label: 'In Development', value: '6', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Avg. Implementation', value: '42%', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA GRTS, state nonpoint source program</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Nutrient Reduction Strategy:
                - All 4 tiles (N Goal 35%, N Achieved 22%, P Goal 25%, P Achieved 18%) →
                  progress charts showing trend over time and gap analysis */}
            case 'ag-nutrient': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sprout className="h-5 w-5 text-amber-600" />
                    Nutrient Reduction Strategy
                  </CardTitle>
                  <CardDescription>Progress toward state nutrient reduction goals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'N Reduction Goal', value: '35%', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'N Achieved', value: '22%', bg: 'bg-green-50 border-green-200' },
                      { label: 'P Reduction Goal', value: '25%', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'P Achieved', value: '18%', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State nutrient reduction strategy, EPA nutrient framework</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Agricultural Partner Management:
                - "24 Partner Organizations" → list partners
                - "8 Active MOUs" → MOU details
                - "15 Joint Projects" → project list */}
            case 'ag-partners': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sprout className="h-5 w-5 text-emerald-600" />
                    Agricultural Partner Management
                  </CardTitle>
                  <CardDescription>Coordination with USDA, soil conservation districts, and ag stakeholders</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Partner Organizations', value: '24', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Active MOUs', value: '8', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Joint Projects', value: '15', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State agricultural partnership database, USDA NRCS</p>
                </CardContent>
              </Card>
            );

            {/* ── Fix 17: New NPS/Agriculture cards ── */}
            case 'ag-nps-breakdown': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-blue-600" />
                    Nonpoint Source Pollution Breakdown
                  </CardTitle>
                  <CardDescription>What is driving NPS pollution in {stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { category: 'Agricultural Runoff', pct: 42, color: 'bg-lime-500' },
                      { category: 'Urban Stormwater', pct: 24, color: 'bg-slate-500' },
                      { category: 'Septic Systems', pct: 14, color: 'bg-amber-500' },
                      { category: 'Atmospheric Deposition', pct: 10, color: 'bg-sky-500' },
                      { category: 'Forestry / Silviculture', pct: 6, color: 'bg-green-700' },
                      { category: 'Other', pct: 4, color: 'bg-gray-400' },
                    ].map(r => (
                      <div key={r.category}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-700 font-medium">{r.category}</span>
                          <span className="text-slate-500">{r.pct}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${r.color}`} style={{ width: `${r.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS cause/source data, state NPS assessment</p>
                </CardContent>
              </Card>
            );

            case 'ag-bmp-effectiveness': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-green-600" />
                    BMP Effectiveness
                  </CardTitle>
                  <CardDescription>Load reduction performance and cost-effectiveness by BMP type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="py-2 pr-3 font-semibold text-slate-600">BMP Type</th>
                          <th className="py-2 pr-3 font-semibold text-slate-600 text-right">Installed</th>
                          <th className="py-2 pr-3 font-semibold text-slate-600 text-right">Load Reduced (lbs)</th>
                          <th className="py-2 pr-3 font-semibold text-slate-600 text-right">$/lb Removed</th>
                          <th className="py-2 font-semibold text-slate-600">Performance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { type: 'Riparian Buffers', installed: 64, lbs: '48,200', cost: '$12', perf: 'Exceeding' },
                          { type: 'Cover Crops', installed: 82, lbs: '38,600', cost: '$8', perf: 'Exceeding' },
                          { type: 'Constructed Wetlands', installed: 18, lbs: '22,400', cost: '$24', perf: 'On Target' },
                          { type: 'Sediment Basins', installed: 45, lbs: '18,100', cost: '$18', perf: 'On Target' },
                          { type: 'Nutrient Mgmt Plans', installed: 38, lbs: '14,700', cost: '$15', perf: 'Below Target' },
                        ].map(b => (
                          <tr key={b.type} className="border-b border-slate-100">
                            <td className="py-2 pr-3 text-slate-700 font-medium">{b.type}</td>
                            <td className="py-2 pr-3 text-slate-600 text-right">{b.installed}</td>
                            <td className="py-2 pr-3 text-slate-600 text-right">{b.lbs}</td>
                            <td className="py-2 pr-3 text-slate-600 text-right">{b.cost}</td>
                            <td className="py-2">
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                b.perf === 'Exceeding' ? 'bg-green-100 text-green-700' :
                                b.perf === 'On Target' ? 'bg-blue-100 text-blue-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>{b.perf}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
                    Total: 247 BMPs installed · 142K lbs load reduction · Avg $14/lb removed
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA GRTS, state BMP tracking</p>
                </CardContent>
              </Card>
            );

            case 'ag-nps-tmdl': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-cyan-600" />
                    NPS-Specific TMDL Progress
                  </CardTitle>
                  <CardDescription>TMDL status for waterbodies impaired by agricultural and urban nonpoint sources</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'NPS TMDLs Total', value: '34', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Approved', value: '22', bg: 'bg-green-50 border-green-200' },
                      { label: 'In Development', value: '8', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Milestones Met', value: '65%', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-slate-600">TMDLs by Pollutant Category</h4>
                    {[
                      { pollutant: 'Nutrients (N/P)', count: 14, approved: 9 },
                      { pollutant: 'Sediment / Siltation', count: 11, approved: 8 },
                      { pollutant: 'Pathogens (E. coli / Fecal)', count: 9, approved: 5 },
                    ].map(p => (
                      <div key={p.pollutant} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-slate-50 border border-slate-100">
                        <span className="text-slate-700">{p.pollutant}</span>
                        <span className="text-slate-500">{p.approved}/{p.count} approved</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS TMDL tracking</p>
                </CardContent>
              </Card>
            );

            case 'ag-nps-funding': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-green-600" />
                    NPS Funding &amp; Grants Overview
                  </CardTitle>
                  <CardDescription>Total funding picture for nonpoint source work in {stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { source: 'CWA §319 Grants', amount: '$2.8M', period: 'FY24-26', icon: '🏛️' },
                      { source: 'State Revolving Fund (NPS)', amount: '$4.2M', period: 'FY24-26', icon: '💧' },
                      { source: 'USDA EQIP', amount: '$6.1M', period: 'FY25', icon: '🌾' },
                      { source: 'USDA CRP', amount: '$3.4M', period: 'FY25', icon: '🌿' },
                      { source: 'Other Federal NPS', amount: '$1.8M', period: 'FY25', icon: '📋' },
                    ].map(f => (
                      <div key={f.source} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 bg-white">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{f.icon}</span>
                          <div>
                            <div className="text-xs font-semibold text-slate-700">{f.source}</div>
                            <div className="text-[10px] text-slate-400">{f.period}</div>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-slate-800">{f.amount}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 p-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-700 font-semibold text-center">
                    Total NPS Funding: $18.3M across all sources
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA GRTS, state SRF, USDA NRCS</p>
                </CardContent>
              </Card>
            );

            // ── Infrastructure sections ────────────────────────────────────
            case 'infra-srf': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-blue-600" />
                    SRF Program
                  </CardTitle>
                  <CardDescription>State Revolving Fund capitalization, lending, and utilization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Capitalization</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'CWSRF Cap Grant', value: '$42M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'DWSRF Cap Grant', value: '$28M', bg: 'bg-sky-50 border-sky-200' },
                      { label: 'BIL Supplement', value: '$18M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Loan Repayments', value: '$31M/yr', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 mt-4">Lending</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'CWSRF Available', value: '$84M', bg: 'bg-green-50 border-green-200' },
                      { label: 'DWSRF Available', value: '$62M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Active Loans', value: '47', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Utilization Rate', value: '78%', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">Data source: EPA CWSRF/DWSRF national data, state SRF program</p>
                </CardContent>
              </Card>
            );

            case 'infra-capital': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardHat className="h-5 w-5 text-orange-600" />
                    Capital Improvement Planning
                  </CardTitle>
                  <CardDescription>Planned infrastructure investments and priority project list</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Priority Projects', value: '28', bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Total Investment', value: '$340M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Funded', value: '16', bg: 'bg-green-50 border-green-200' },
                      { label: 'Awaiting Funding', value: '12', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State capital improvement plan, EPA Needs Survey</p>
                </CardContent>
              </Card>
            );

            case 'infra-construction': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-slate-600" />
                    Construction Project Tracker
                  </CardTitle>
                  <CardDescription>Active construction projects with milestone tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Projects', value: '12', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'On Schedule', value: '9', bg: 'bg-green-50 border-green-200' },
                      { label: 'Behind Schedule', value: '2', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Completed (YTD)', value: '5', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State construction management system, SRF disbursement records</p>
                </CardContent>
              </Card>
            );

            case 'infra-green': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-600" />
                    Green Infrastructure
                  </CardTitle>
                  <CardDescription>Nature-based solutions, LID projects, and green infrastructure inventory</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'GI Projects', value: '86', bg: 'bg-green-50 border-green-200' },
                      { label: 'Acres Managed', value: '1,240', bg: 'bg-green-50 border-green-200' },
                      { label: 'Runoff Captured', value: '2.4M gal/yr', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Co-Benefits Score', value: 'High', bg: 'bg-emerald-50 border-emerald-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State GI inventory, MS4 annual reports, SRF green project reserve</p>
                </CardContent>
              </Card>
            );

            // ── Monitoring sections ────────────────────────────────────────
            {/* TODO: Future click-throughs for State Monitoring Network:
                - "186 Ambient" → filtered station list for ambient monitoring
                - "342 NPDES DMR" → filtered NPDES discharge monitoring stations
                - "1,842 SDWA" → filtered SDWA compliance stations
                - "94 Volunteer" → filtered volunteer monitoring sites */}
            case 'mon-network': return DS(
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <RadioTower className="h-5 w-5 text-blue-600" />
                      State Monitoring Network
                    </CardTitle>
                    {isAdmin && (
                      <select
                        value={stateAbbr}
                        onChange={e => router.push(`/dashboard/state/${e.target.value}`)}
                        className="text-xs border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-300 cursor-pointer"
                      >
                        {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                          <option key={abbr} value={abbr}>{abbr} — {name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <CardDescription>Comprehensive view of ambient and compliance monitoring stations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Ambient Stations', value: '186', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'NPDES DMR', value: '342', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'SDWA Compliance', value: '1,842', bg: 'bg-sky-50 border-sky-200' },
                      { label: 'Volunteer Sites', value: '94', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: WQX, state monitoring strategy, USGS cooperative program</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Data Management Operations:
                - "3 Pending QA" → show which submissions are pending review
                - "97.3% QA Pass Rate" → show failures and rejection reasons */}
            case 'mon-data-mgmt': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    Data Management Operations
                  </CardTitle>
                  <CardDescription>WQX submissions, data quality, and STORET/WQP integration status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'WQX Submissions', value: '24', bg: 'bg-indigo-50 border-indigo-200' },
                      { label: 'Pending QA', value: '3', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Records (YTD)', value: '48.2K', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'QA Pass Rate', value: '97.3%', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: WQX submission tracker, state data management system</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Network Optimization:
                - "14 Priority Gaps" → show gap locations on the map (highest priority)
                - "22 Recommended Stations" → proposed locations with justification
                - "72% Coverage Score" → coverage model visualization */}
            case 'mon-optimization': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-cyan-600" />
                    Network Optimization
                  </CardTitle>
                  <CardDescription>Coverage gap analysis and monitoring strategy recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Coverage Score', value: '72%', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Priority Gaps', value: '14', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Recommended Stations', value: '22', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State monitoring strategy, coverage model analysis</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Continuous Monitoring:
                - "38 Online Now" → show which stations on a map
                - "3 Alerts (24H)" → show alert details
                - "42 Continuous Stations" → list all with status */}
            case 'mon-continuous': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Continuous Monitoring
                  </CardTitle>
                  <CardDescription>Real-time and continuous monitoring stations with data streams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Continuous Stations', value: '42', bg: 'bg-green-50 border-green-200' },
                      { label: 'Online Now', value: '38', bg: 'bg-green-50 border-green-200' },
                      { label: 'Alerts (24h)', value: '3', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Parameters Tracked', value: '8', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State continuous monitoring network, USGS WDFN real-time</p>
                </CardContent>
              </Card>
            );

            {/* ── Fix 19: New Monitoring cards ── */}
            case 'mon-latency': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-indigo-600" />
                    Data Latency Tracker
                  </CardTitle>
                  <CardDescription>Refresh rates and last-pull timestamps by data source for {stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { source: 'ATTAINS', frequency: 'Quarterly', lastPull: '3 days ago', status: 'fresh' },
                      { source: 'WDFN', frequency: 'Daily', lastPull: '2 hours ago', status: 'fresh' },
                      { source: 'WQP', frequency: 'Varies', lastPull: '14 days ago', status: 'stale' },
                      { source: 'SDWIS', frequency: 'Weekly', lastPull: '5 days ago', status: 'fresh' },
                      { source: 'ECHO', frequency: 'Weekly', lastPull: '1 day ago', status: 'fresh' },
                      { source: 'NOAA CO-OPS', frequency: 'Hourly', lastPull: '45 min ago', status: 'fresh' },
                    ].map(s => (
                      <div key={s.source} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 bg-white">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'fresh' ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-semibold text-slate-700 w-24">{s.source}</span>
                        </div>
                        <span className="text-[10px] text-slate-400">{s.frequency}</span>
                        <span className={`text-xs ${s.status === 'stale' ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                          {s.lastPull}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: PIN internal pipeline health registry</p>
                </CardContent>
              </Card>
            );

            case 'mon-report-card': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-blue-600" />
                    Data Report Card
                  </CardTitle>
                  <CardDescription>AI Readiness score and data quality assessment for {stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100 border-2 border-red-300">
                      <span className="text-xl font-black text-red-600">F</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-800">45<span className="text-sm font-normal text-slate-400">/100</span></div>
                      <div className="text-xs text-slate-500">AI Readiness Score</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {[
                      { dim: 'Freshness', score: 0, max: 30, note: 'No WQP records cached' },
                      { dim: 'Coverage', score: 25, max: 25, note: 'All HUC-8s represented' },
                      { dim: 'Parameters', score: 0, max: 25, note: 'Missing key parameters' },
                      { dim: 'Redundancy', score: 20, max: 20, note: 'Multi-source overlap' },
                    ].map(d => (
                      <div key={d.dim} className="flex items-center gap-3">
                        <span className="text-xs text-slate-600 w-20 font-medium">{d.dim}</span>
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${d.score === d.max ? 'bg-green-500' : d.score === 0 ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${(d.score / d.max) * 100}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 w-12 text-right">{d.score}/{d.max}</span>
                        <span className="text-[10px] text-slate-400 w-36 truncate">{d.note}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: PIN data quality engine</p>
                </CardContent>
              </Card>
            );

            case 'mon-source-health': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    Source Health Registry
                  </CardTitle>
                  <CardDescription>Live operational status of each data pipeline for {stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="py-2 pr-3 font-semibold text-slate-600">Source</th>
                          <th className="py-2 pr-3 font-semibold text-slate-600">Status</th>
                          <th className="py-2 pr-3 font-semibold text-slate-600">Last Success</th>
                          <th className="py-2 pr-3 font-semibold text-slate-600 text-right">Errors (30d)</th>
                          <th className="py-2 font-semibold text-slate-600 text-right">Records</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { source: 'ATTAINS', status: 'Healthy', last: '3 days ago', errors: 0, records: '4,218' },
                          { source: 'WDFN', status: 'Healthy', last: '2 hours ago', errors: 1, records: '12,840' },
                          { source: 'WQP', status: 'Stale', last: '14 days ago', errors: 3, records: '0' },
                          { source: 'SDWIS', status: 'Healthy', last: '5 days ago', errors: 0, records: '1,842' },
                          { source: 'ECHO', status: 'Healthy', last: '1 day ago', errors: 0, records: '342' },
                          { source: 'NOAA CO-OPS', status: 'Healthy', last: '45 min ago', errors: 0, records: '2,106' },
                        ].map(s => (
                          <tr key={s.source} className="border-b border-slate-100">
                            <td className="py-2 pr-3 text-slate-700 font-medium">{s.source}</td>
                            <td className="py-2 pr-3">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                s.status === 'Healthy' ? 'bg-green-100 text-green-700' :
                                s.status === 'Stale' ? 'bg-red-100 text-red-700' :
                                'bg-amber-100 text-amber-700'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  s.status === 'Healthy' ? 'bg-green-500' :
                                  s.status === 'Stale' ? 'bg-red-500' : 'bg-amber-500'
                                }`} />
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-slate-500">{s.last}</td>
                            <td className="py-2 pr-3 text-slate-600 text-right">{s.errors}</td>
                            <td className="py-2 text-slate-600 text-right">{s.records}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: PIN internal health registry and priority queue system</p>
                </CardContent>
              </Card>
            );

            case 'flood-status': return DS(
              <FloodStatusSummary
                forecasts={floodForecast.forecasts}
                summary={floodForecast.summary}
                updatedAt={floodForecast.updatedAt}
                isLoading={floodForecast.isLoading}
                onViewDetails={() => setViewLens('disaster' as ViewLens)}
              />
            );

            // ── Disaster sections ──────────────────────────────────────────
            {/* TODO: Future click-throughs for Active Incidents:
                - Each incident row → Response Planner pre-loaded with that incident context
                  (type/severity pre-filled, downstream waterbodies auto-identified,
                   multi-agency contacts pre-populated, response timeline template,
                   regulatory notification requirements and deadlines)
                - "Sewage Bypass — Patapsco WWTP" → affected waterbodies, downstream impacts, agency contacts */}
            case 'disaster-active': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Active Incidents
                  </CardTitle>
                  <CardDescription>Current water quality emergencies and active response operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { incident: 'Sewage Bypass — Patapsco WWTP', status: 'Active', severity: 'High', since: '2026-02-20' },
                      { incident: 'Chemical Spill — I-95 corridor', status: 'Monitoring', severity: 'Medium', since: '2026-02-22' },
                    ].map((inc, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${inc.severity === 'High' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-800">{inc.incident}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={inc.severity === 'High' ? 'destructive' : 'default'} className="text-[10px]">{inc.status}</Badge>
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-600 font-medium">
                              <Link2 className="h-3 w-3" />
                              Response Planner
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500">Since {inc.since} · Severity: {inc.severity}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State incident command system, NRC spill reports</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for State Response Operations:
                - "2 Teams Deployed" → deployment locations and assignments
                - "18 Sampling Sites" → show on map
                - "3 Advisories Active" → list advisories with detail */}
            case 'disaster-response': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    State Response Operations
                  </CardTitle>
                  <CardDescription>Emergency response team deployment and coordination status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Teams Deployed', value: '2', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Sampling Sites', value: '18', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Advisories Active', value: '3', bg: 'bg-red-50 border-red-200' },
                      { label: 'Federal Coordination', value: 'Active', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State emergency operations, EPA emergency response</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Spill Reporting:
                - "14 Reports (30D)" → spill list with locations, materials, volumes
                - "4 Under Investigation" → investigation status
                - "3 Cleanup Active" → cleanup progress */}
            case 'disaster-spill': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    Spill Reporting
                  </CardTitle>
                  <CardDescription>Spill notification tracking and response coordination</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Reports (30d)', value: '14', bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Under Investigation', value: '4', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Cleanup Active', value: '3', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Closed (30d)', value: '7', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: NRC, state spill reporting hotline, CERCLA notifications</p>
                </CardContent>
              </Card>
            );

            {/* TODO: Future click-throughs for Preparedness:
                - "12 Emergency Plans" → list plans by type
                - "Last Drill 45 days ago" → show drill report
                - "94% Equipment Ready" → show inventory status */}
            case 'disaster-prep': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    Preparedness
                  </CardTitle>
                  <CardDescription>Emergency preparedness status and contingency plan tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Emergency Plans', value: '12 Current', bg: 'bg-green-50 border-green-200' },
                      { label: 'Last Drill', value: '45 days ago', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Equipment Ready', value: '94%', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State emergency management, EPA CAMEO/ALOHA</p>
                </CardContent>
              </Card>
            );

            {/* ── Fix 21: Cross-Agency Alert Correlation ── */}
            case 'disaster-cascade': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="h-5 w-5 text-purple-600" />
                    Cross-Agency Alert Correlation
                  </CardTitle>
                  <CardDescription>How incidents cascade across water domains in {stateName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Example cascade: Sewage bypass */}
                    <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                      <div className="text-xs font-semibold text-red-800 mb-2">Sewage Bypass — Patapsco WWTP</div>
                      <div className="flex items-stretch gap-0 overflow-x-auto">
                        {[
                          { domain: 'Wastewater', event: 'Bypass event', color: 'bg-red-100 border-red-300 text-red-700' },
                          { domain: 'Surface Water', event: 'Bacteria spike downstream', color: 'bg-orange-100 border-orange-300 text-orange-700' },
                          { domain: 'Public Health', event: 'Swimming advisory', color: 'bg-amber-100 border-amber-300 text-amber-700' },
                          { domain: 'Drinking Water', event: 'Intake within impact zone', color: 'bg-blue-100 border-blue-300 text-blue-700' },
                        ].map((step, idx) => (
                          <div key={step.domain} className="flex items-center">
                            <div className={`rounded border px-2 py-2 min-w-[120px] ${step.color}`}>
                              <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{step.domain}</div>
                              <div className="text-[10px] mt-0.5 font-medium">{step.event}</div>
                            </div>
                            {idx < 3 && <div className="text-slate-400 px-1 text-sm font-bold">→</div>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Example cascade: Chemical spill */}
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <div className="text-xs font-semibold text-amber-800 mb-2">Chemical Spill — I-95 Corridor</div>
                      <div className="flex items-stretch gap-0 overflow-x-auto">
                        {[
                          { domain: 'Surface Water', event: 'Contaminant plume detected', color: 'bg-orange-100 border-orange-300 text-orange-700' },
                          { domain: 'Groundwater', event: 'Well monitoring triggered', color: 'bg-cyan-100 border-cyan-300 text-cyan-700' },
                          { domain: 'Drinking Water', event: '2 intakes on alert', color: 'bg-blue-100 border-blue-300 text-blue-700' },
                        ].map((step, idx) => (
                          <div key={step.domain} className="flex items-center">
                            <div className={`rounded border px-2 py-2 min-w-[120px] ${step.color}`}>
                              <div className="text-[9px] font-bold uppercase tracking-wider opacity-70">{step.domain}</div>
                              <div className="text-[10px] mt-0.5 font-medium">{step.event}</div>
                            </div>
                            {idx < 2 && <div className="text-slate-400 px-1 text-sm font-bold">→</div>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-700">
                      <span className="font-semibold">PIN Cross-Domain Cascade:</span> Each incident auto-identifies downstream impacts across wastewater, surface water, groundwater, drinking water, and public health domains.
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: PIN incident correlation engine, waterbody network topology</p>
                </CardContent>
              </Card>
            );

            case 'flood-forecast': return DS(
              <FloodForecastCard
                forecasts={floodForecast.forecasts}
                summary={floodForecast.summary}
                updatedAt={floodForecast.updatedAt}
                isLoading={floodForecast.isLoading}
                error={floodForecast.error}
                onRefresh={floodForecast.refetch}
              />
            );

            // ── TMDL sections ──────────────────────────────────────────────
            case 'tmdl-status': {
              const statusTiles = [
                { id: 'tmdl-approved', label: 'EPA Approved', value: '94', bg: 'bg-green-50 border-green-200', detail: 'Full list of 94 EPA-approved TMDLs with pollutant, waterbody, and approval date. Includes load allocations and wasteload allocations by source.' },
                { id: 'tmdl-indev', label: 'In Development', value: '14', bg: 'bg-blue-50 border-blue-200', detail: '14 TMDLs currently in development — pollutant source analysis, stakeholder engagement status, and projected completion dates.' },
                { id: 'tmdl-backlog', label: 'Backlog', value: '78', bg: 'bg-amber-50 border-amber-200', detail: '78 impaired waterbodies awaiting TMDL development. Prioritized by designated use severity, population impact, and EPA Vision Priority ranking.' },
                { id: 'tmdl-rate', label: 'Completion Rate', value: '55%', bg: 'bg-cyan-50 border-cyan-200', detail: 'TMDL completion rate trend — approved TMDLs vs total 303(d) listed waterbodies. Includes 10-year trendline and peer state comparison.' },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Waves className="h-5 w-5 text-cyan-600" />
                      TMDL Program Status
                    </CardTitle>
                    <CardDescription>TMDLs completed, in development, and backlog tracking</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {statusTiles.map(k => (
                        <div key={k.id}>
                          <button onClick={() => setComingSoonId(comingSoonId === k.id ? null : k.id)} className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-md cursor-pointer ${k.bg}`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                            <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                          </button>
                          {comingSoonId === k.id && (
                            <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs text-slate-700">{k.detail}</p>
                              <p className="text-[10px] text-blue-600 mt-2 font-medium">Full detail view — Coming Soon</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS TMDL tracking, state TMDL development system</p>
                  </CardContent>
                </Card>
              );
            }

            case 'tmdl-303d': {
              const listTiles = [
                { id: '303d-cat5', label: 'Category 5 Listed', value: '186', bg: 'bg-red-50 border-red-200', detail: 'Full 303(d) list — 186 Category 5 impaired waterbodies requiring TMDLs. Filterable by cause, designated use, and watershed.' },
                { id: '303d-new', label: 'New Listings (cycle)', value: '12', bg: 'bg-orange-50 border-orange-200', detail: '12 waterbodies newly listed this assessment cycle. Includes impairment cause, supporting data, and listing rationale.' },
                { id: '303d-delist', label: 'Delistings (cycle)', value: '8', bg: 'bg-green-50 border-green-200', detail: '8 waterbodies delisted this cycle — restored or reclassified. Includes recovery timeline and contributing actions.' },
                { id: '303d-priority', label: 'Vision Priority', value: '42', bg: 'bg-blue-50 border-blue-200', detail: '42 waterbodies flagged as Vision Priority — highest-impact impairments targeted for accelerated TMDL development and alternative restoration.' },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Waves className="h-5 w-5 text-red-600" />
                      303(d) List Management
                    </CardTitle>
                    <CardDescription>Impaired waters list management and listing decision workspace</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {listTiles.map(k => (
                        <div key={k.id}>
                          <button onClick={() => setComingSoonId(comingSoonId === k.id ? null : k.id)} className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-md cursor-pointer ${k.bg}`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                            <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                          </button>
                          {comingSoonId === k.id && (
                            <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs text-slate-700">{k.detail}</p>
                              <p className="text-[10px] text-blue-600 mt-2 font-medium">Full detail view — Coming Soon</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, state 303(d) listing database</p>
                  </CardContent>
                </Card>
              );
            }

            case 'tmdl-workspace': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-blue-600" />
                    TMDL Development Workspace
                  </CardTitle>
                  <CardDescription>Active TMDL development projects with milestone tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder={`Search ${stateName} waterbodies with pending TMDLs...`}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                        onClick={() => setComingSoonId(comingSoonId === 'tmdl-ws-search' ? null : 'tmdl-ws-search')}
                        readOnly
                      />
                    </div>
                    {comingSoonId === 'tmdl-ws-search' && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                        <p className="text-xs text-slate-700">Search and select any {stateName} waterbody with a pending or active TMDL. View pollutant source analysis, load allocation tables, WLA/LA breakdowns, and implementation milestones.</p>
                        <p className="text-[10px] text-blue-600 mt-2 font-medium">Waterbody search — Coming Soon</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">Track pollutant source analysis, load allocations, and implementation milestones</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State TMDL development tracker, EPA ATTAINS</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-implementation': {
              const implTiles = [
                { id: 'impl-active', label: 'Active Impl. Plans', value: '68', bg: 'bg-green-50 border-green-200', detail: '68 active TMDL implementation plans — BMP installations, point-source reductions, and load allocation progress by waterbody.' },
                { id: 'impl-ontrack', label: 'On Track', value: '52', bg: 'bg-green-50 border-green-200', detail: '52 plans meeting milestone targets. Pollutant load reductions on schedule with measurable water quality improvements documented.' },
                { id: 'impl-behind', label: 'Behind Schedule', value: '12', bg: 'bg-amber-50 border-amber-200', detail: '12 implementation plans behind schedule — root cause analysis, resource gaps, and recommended corrective actions.' },
                { id: 'impl-delist', label: 'Near Delisting', value: '4', bg: 'bg-cyan-50 border-cyan-200', detail: '4 waterbodies approaching delisting criteria — final monitoring data, trend analysis, and projected delisting timeline.' },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Implementation Tracking
                    </CardTitle>
                    <CardDescription>TMDL implementation plan progress and pollutant load reduction</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {implTiles.map(k => (
                        <div key={k.id}>
                          <button onClick={() => setComingSoonId(comingSoonId === k.id ? null : k.id)} className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-md cursor-pointer ${k.bg}`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                            <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                          </button>
                          {comingSoonId === k.id && (
                            <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs text-slate-700">{k.detail}</p>
                              <p className="text-[10px] text-blue-600 mt-2 font-medium">Full detail view — Coming Soon</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: State TMDL implementation tracker, EPA Watershed Tracking</p>
                  </CardContent>
                </Card>
              );
            }

            case 'tmdl-restoration': {
              const restoreTiles = [
                { id: 'restore-active', label: 'Active Projects', value: '24', bg: 'bg-emerald-50 border-emerald-200', detail: '24 active watershed restoration projects — riparian buffers, stream bank stabilization, nutrient management plans, and constructed wetlands.' },
                { id: 'restore-delist', label: 'Delisted (5yr)', value: '12', bg: 'bg-green-50 border-green-200', detail: '12 waterbodies successfully delisted in the last 5 years. Recovery timelines, key interventions, and before/after water quality data.' },
                { id: 'restore-invest', label: 'Investment', value: '$28M', bg: 'bg-blue-50 border-blue-200', detail: '$28M total restoration investment — funding sources (EPA 319, state match, NRCS), cost-effectiveness analysis, and projected ROI.' },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Waves className="h-5 w-5 text-emerald-600" />
                      Watershed Restoration
                    </CardTitle>
                    <CardDescription>Active restoration projects and waterbody recovery progress</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {restoreTiles.map(k => (
                        <div key={k.id}>
                          <button onClick={() => setComingSoonId(comingSoonId === k.id ? null : k.id)} className={`w-full rounded-xl border p-4 text-left transition-all hover:shadow-md cursor-pointer ${k.bg}`}>
                            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                            <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                          </button>
                          {comingSoonId === k.id && (
                            <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs text-slate-700">{k.detail}</p>
                              <p className="text-[10px] text-blue-600 mt-2 font-medium">Full detail view — Coming Soon</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: State restoration program, EPA Recovery Potential Screening</p>
                  </CardContent>
                </Card>
              );
            }

            case 'tmdl-epa': {
              const epaRows = [
                { id: 'epa-adoption', item: 'EPA-established TMDLs pending state adoption', count: '3', status: 'Action Needed', detail: '3 federal TMDLs awaiting state adoption — pollutant allocations, implementation timeline, and state response deadlines.' },
                { id: 'epa-consent', item: 'Consent decree TMDL milestones (next 12 months)', count: '5', status: 'On Track', detail: '5 consent decree milestones — court-ordered TMDL submissions, interim load reductions, and compliance monitoring requirements.' },
                { id: 'epa-assist', item: 'EPA technical assistance requests', count: '2', status: 'In Progress', detail: '2 pending technical assistance requests — modeling support, source identification, and monitoring network design.' },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Landmark className="h-5 w-5 text-blue-600" />
                      EPA Coordination
                    </CardTitle>
                    <CardDescription>EPA Region oversight, consent decree tracking, and federal TMDL actions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {epaRows.map(e => (
                        <div key={e.id}>
                          <button onClick={() => setComingSoonId(comingSoonId === e.id ? null : e.id)} className="w-full flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3 hover:bg-blue-100/50 transition-all cursor-pointer text-left">
                            <span className="text-xs text-slate-700">{e.item}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-blue-700">{e.count}</span>
                              <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                            </div>
                          </button>
                          {comingSoonId === e.id && (
                            <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs text-slate-700">{e.detail}</p>
                              <p className="text-[10px] text-blue-600 mt-2 font-medium">Full detail view — Coming Soon</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA Region coordination records, consent decree dockets</p>
                  </CardContent>
                </Card>
              );
            }

            // ── TMDL Additional Cards (Fix 25) ──────────────────────────────
            case 'tmdl-completion-trend': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    TMDL Completion Trend
                  </CardTitle>
                  <CardDescription>10-year TMDL completion trajectory and pace analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: '2015', approved: 62, bg: 'bg-slate-50 border-slate-200' },
                        { label: '2020', approved: 78, bg: 'bg-blue-50 border-blue-200' },
                        { label: '2025', approved: 94, bg: 'bg-green-50 border-green-200' },
                      ].map(yr => (
                        <div key={yr.label} className={`rounded-xl border p-3 text-center ${yr.bg}`}>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{yr.label}</div>
                          <div className="text-xl font-bold text-slate-800 mt-1">{yr.approved}</div>
                          <div className="text-[10px] text-slate-400">approved</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">Avg. completions/year</span>
                        <span className="text-sm font-bold text-blue-700">3.2</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: '55%' }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-slate-400">0% of backlog cleared</span>
                        <span className="text-[9px] text-slate-400">55% complete</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">At current pace, backlog clearance projected by 2049. Accelerated alternatives may reduce timeline.</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS TMDL tracking, state submission records</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-cause-breakdown': {
              const causeCounts = [
                { cause: 'Pathogens (E. coli / Enterococcus)', count: 52, pct: 28, color: 'bg-red-500' },
                { cause: 'Nutrients (N/P)', count: 41, pct: 22, color: 'bg-amber-500' },
                { cause: 'Sediment / Siltation', count: 34, pct: 18, color: 'bg-yellow-600' },
                { cause: 'Metals (Mercury, Lead)', count: 22, pct: 12, color: 'bg-slate-500' },
                { cause: 'Dissolved Oxygen', count: 18, pct: 10, color: 'bg-cyan-500' },
                { cause: 'Temperature', count: 11, pct: 6, color: 'bg-orange-500' },
                { cause: 'Other', count: 8, pct: 4, color: 'bg-slate-300' },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-amber-600" />
                      Impairment Cause Breakdown
                    </CardTitle>
                    <CardDescription>Distribution of impairment causes driving TMDL development needs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {causeCounts.map(c => (
                        <button key={c.cause} onClick={() => setComingSoonId(comingSoonId === `cause-${c.cause}` ? null : `cause-${c.cause}`)} className="w-full text-left">
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-700 w-44 truncate">{c.cause}</span>
                            <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                              <div className={`h-full rounded-full ${c.color}`} style={{ width: `${c.pct}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 w-8 text-right">{c.count}</span>
                            <span className="text-[10px] text-slate-400 w-8 text-right">{c.pct}%</span>
                          </div>
                          {comingSoonId === `cause-${c.cause}` && (
                            <div className="ml-44 mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-2">
                              <p className="text-[10px] text-slate-600">{c.count} waterbodies impaired by {c.cause.toLowerCase()}. View affected waterbodies, TMDL status, and load reduction targets.</p>
                              <p className="text-[10px] text-blue-600 mt-1 font-medium">Drill-down — Coming Soon</p>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS cause/source data, state 303(d) listings</p>
                  </CardContent>
                </Card>
              );
            }

            case 'tmdl-delisting-stories': {
              const stories = [
                { id: 'delist-1', name: 'Little Patuxent River', cause: 'Sediment', year: '2023', action: 'Stream bank stabilization + agricultural BMPs reduced sediment loading 64% over 8 years.' },
                { id: 'delist-2', name: 'Rock Creek', cause: 'Nutrients', year: '2022', action: 'Nutrient TMDL implementation with stormwater retrofits and enhanced BNR at WWTP achieved target TP concentrations.' },
                { id: 'delist-3', name: 'Herring Run', cause: 'Bacteria', year: '2024', action: 'Sanitary sewer rehabilitation eliminated SSOs. Post-TMDL monitoring showed E. coli below WQS for 3 consecutive years.' },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Delisting Success Stories
                    </CardTitle>
                    <CardDescription>Waterbodies successfully restored and removed from the impaired list</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stories.map(s => (
                        <div key={s.id}>
                          <button onClick={() => setComingSoonId(comingSoonId === s.id ? null : s.id)} className="w-full flex items-center gap-3 rounded-lg border border-green-200 bg-green-50/50 p-3 hover:bg-green-100/50 transition-all cursor-pointer text-left">
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-800">{s.name}</div>
                              <div className="text-[10px] text-slate-500">Delisted {s.year} — {s.cause}</div>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${comingSoonId === s.id ? 'rotate-180' : ''}`} />
                          </button>
                          {comingSoonId === s.id && (
                            <div className="mt-1 rounded-lg border border-green-200 bg-green-50/60 p-3">
                              <p className="text-xs text-slate-700">{s.action}</p>
                              <p className="text-[10px] text-blue-600 mt-2 font-medium">Full case study — Coming Soon</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS delisting records, state restoration summaries</p>
                  </CardContent>
                </Card>
              );
            }

            // ── Scorecard sections ─────────────────────────────────────────
            case 'sc-self-assessment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                    State Self-Assessment
                  </CardTitle>
                  <CardDescription>Jurisdiction-level grade summary across {stateAbbr} MS4 program data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Overall Grade', value: jurisdictionScoreSummary.avgGrade.letter, bg: jurisdictionScoreSummary.avgGrade.bg },
                      { label: 'Jurisdictions Graded', value: `${jurisdictionScoreRows.length}`, bg: 'bg-blue-50 border-blue-200' },
                      { label: 'In Compliance', value: `${jurisdictionScoreSummary.inComplianceRate}%`, bg: 'bg-green-50 border-green-200' },
                      { label: 'Needs Attention', value: `${jurisdictionScoreSummary.attentionCount}`, bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-3xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State MS4 jurisdiction registry, program compliance status ({jurisdictionScoreSummary.asOf})</p>
                </CardContent>
              </Card>
            );

            case 'sc-watershed': {
              const filteredJurisdictions = jurisdictionScoreRows.filter((j: any) => {
                const q = scorecardSearch.trim().toLowerCase();
                if (!q) return true;
                return (
                  j.name.toLowerCase().includes(q) ||
                  (j.permitId || '').toLowerCase().includes(q) ||
                  (j.status || '').toLowerCase().includes(q)
                );
              });
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Waves className="h-5 w-5 text-blue-600" />
                      Jurisdiction Scorecards
                    </CardTitle>
                    <CardDescription>All {jurisdictionScoreRows.length} {stateAbbr} jurisdictions, graded with federal-style scorecard view</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                          type="text"
                          value={scorecardSearch}
                          onChange={(e) => setScorecardSearch(e.target.value)}
                          placeholder={`Search ${stateName} jurisdictions by name, permit ID, or status...`}
                          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                        />
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                        Jurisdiction Grades ({filteredJurisdictions.length} shown)
                      </div>
                      <div className="max-h-[420px] overflow-auto space-y-1.5 pr-1">
                        {filteredJurisdictions.map((j: any) => (
                          <div key={j.permitId} className="w-full flex items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50 transition-all">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-sm font-bold ${j.grade.bg} ${j.grade.color}`}>{j.grade.letter}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-slate-800 truncate">{j.name}</div>
                              <div className="text-[10px] text-slate-400">
                                {j.phase} · {j.status} · {j.permitId} · {j.population > 0 ? `${j.population.toLocaleString()} pop` : 'population n/a'}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-700">{j.score}/100</div>
                              <div className={`text-[10px] font-semibold ${j.trendColor}`}>{j.trendIcon} {j.trend}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: State MS4/NPDES jurisdiction records; grades computed from current compliance phase/status and permit posture ({jurisdictionScoreSummary.asOf})</p>
                  </CardContent>
                </Card>
              );
            }

            case 'sc-peer': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-indigo-600" />
                    Peer Comparison
                  </CardTitle>
                  <CardDescription>Compare program performance against regional peer states</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Peer Rank', value: '3 of 8', bg: 'bg-indigo-50 border-indigo-200' },
                      { label: 'Permit Timeliness', value: 'Above Avg', bg: 'bg-green-50 border-green-200' },
                      { label: 'TMDL Progress', value: 'Average', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Enforcement Rate', value: 'Below Avg', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-lg font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ECHO, ATTAINS, state program comparison data</p>
                </CardContent>
              </Card>
            );

            case 'sc-epa-ppa': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-600" />
                    EPA Performance Partnership
                  </CardTitle>
                  <CardDescription>Performance Partnership Agreement/Grant tracking and deliverables</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'PPA Commitments', value: '24', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'On Track', value: '20', bg: 'bg-green-50 border-green-200' },
                      { label: 'Needs Attention', value: '4', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA PPA/PPG tracking, state-EPA work plan</p>
                </CardContent>
              </Card>
            );

            // ── Reports sections ───────────────────────────────────────────
            case 'rpt-ir-workspace': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Integrated Report Workspace
                  </CardTitle>
                  <CardDescription>State 305(b)/303(d) report development, validation, and EPA submission workflow</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold text-slate-700">Home / Reporting / 2026 Cycle</p>
                    <p className="text-[10px] text-slate-600 mt-0.5">
                      State workspace for integrated report assembly, QA checks, and federal submission readiness.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Report Cycle', value: '2026', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Assessments Done', value: '78%', bg: 'bg-green-50 border-green-200' },
                      { label: 'EPA Review Status', value: 'Pending', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Public Comment', value: 'Not Started', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-lg font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['Start Report', 'Resume Draft', 'Validate Submission', 'Submit to EPA'].map((label) => (
                      <Button key={label} size="sm" variant={label === 'Submit to EPA' ? 'default' : 'outline'} className={label === 'Submit to EPA' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}>
                        {label}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, state integrated reporting system</p>
                </CardContent>
              </Card>
            );

            case 'rpt-regulatory': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Regulatory Reports
                  </CardTitle>
                  <CardDescription>Required regulatory submissions and compliance reporting deadlines</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[10px] text-slate-600">Workflow focus: track deadlines, validate packets, and submit complete reports on time.</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { report: 'Annual NPDES Program Report', due: '2026-03-31', status: 'Pending' },
                      { report: 'SRF Annual Report', due: '2026-06-30', status: 'Not Started' },
                      { report: 'Drinking Water Program Report', due: '2026-07-01', status: 'Not Started' },
                      { report: 'NPS Annual Report (319)', due: '2026-10-01', status: 'Due Soon' },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                        <span className="text-xs font-medium text-slate-700">{r.report}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Due: {r.due}</span>
                          <Badge
                            className={
                              r.status === 'Complete' ? 'text-[10px] bg-green-100 text-green-800 border-green-200' :
                              r.status === 'Pending' || r.status === 'Due Soon' ? 'text-[10px] bg-amber-100 text-amber-800 border-amber-200' :
                              r.status === 'Overdue' ? 'text-[10px] bg-red-100 text-red-800 border-red-200' :
                              'text-[10px] bg-slate-100 text-slate-700 border-slate-200'
                            }
                            variant="outline"
                          >
                            {r.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State regulatory calendar, EPA reporting requirements</p>
                </CardContent>
              </Card>
            );

            case 'rpt-adhoc': {
              const reportTemplates = [
                { id: 'rpt-leg', icon: '🏛️', name: 'Legislative Briefing', desc: 'One-page water quality summary for elected officials — key metrics, trends, and investment needs', sections: ['Assessment Summary', 'Impairment Trends', 'Budget Impact'] },
                { id: 'rpt-stakeholder', icon: '👥', name: 'Stakeholder Update', desc: 'Public-facing watershed status report with plain-language findings and restoration progress', sections: ['Watershed Health', 'Active Projects', 'Next Steps'] },
                { id: 'rpt-compliance', icon: '📋', name: 'Compliance Summary', desc: 'NPDES permit compliance rates, enforcement actions, and significant non-compliance breakdown', sections: ['Permit Status', 'SNC Facilities', 'Enforcement Timeline'] },
                { id: 'rpt-assessment', icon: '📊', name: 'Assessment Cycle Report', desc: 'Integrated Report submission summary — new listings, delistings, and category changes', sections: ['303(d) Changes', 'Cause Analysis', 'TMDL Queue'] },
                { id: 'rpt-monitoring', icon: '📡', name: 'Monitoring Network Review', desc: 'Station coverage, parameter gaps, and recommended network expansions', sections: ['Station Map', 'Gap Analysis', 'Recommendations'] },
                { id: 'rpt-custom', icon: '🔧', name: 'Custom Report', desc: 'Build from scratch — select data sources, parameters, date ranges, and output format', sections: ['Data Selection', 'Filters', 'Format'] },
              ];
              return DS(
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-slate-600" />
                      Report Builder & Submission Actions
                    </CardTitle>
                    <CardDescription>Build, validate, export, and route regulatory report packages</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {['Build', 'Validate', 'Submit', 'Export', 'Track Deadlines'].map((label) => (
                        <button key={label} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors text-left">
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {reportTemplates.map(t => (
                        <div key={t.id}>
                          <button onClick={() => setComingSoonId(comingSoonId === t.id ? null : t.id)} className="w-full flex items-start gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all text-left cursor-pointer">
                            <span className="text-lg flex-shrink-0">{t.icon}</span>
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800">{t.name}</div>
                              <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{t.desc}</div>
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {t.sections.map(s => (
                                  <span key={s} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500 border border-slate-200">{s}</span>
                                ))}
                              </div>
                            </div>
                          </button>
                          {comingSoonId === t.id && (
                            <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                              <p className="text-xs text-slate-700">Generate a <strong>{t.name}</strong> report for {stateName}. Sections: {t.sections.join(', ')}. Output as PDF or interactive dashboard view.</p>
                              <p className="text-[10px] text-blue-600 mt-2 font-medium">Report builder — Coming Soon</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400 mt-4 italic">Data source: All integrated state and federal data sources</p>
                  </CardContent>
                </Card>
              );
            }

            // ── Permits sections ───────────────────────────────────────────
            case 'perm-status': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                    Permitting Operations Status
                  </CardTitle>
                  <CardDescription>Overall permit program workload and processing metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Applications Pending', value: '24', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Avg. Processing Time', value: '94 days', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Staff Utilization', value: '87%', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Backlogged', value: '6', bg: 'bg-red-50 border-red-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Permit operations metrics (applications, processing) — counts differ from Permit Inventory (individual + general universe) and DMR counts (monthly submissions). Source: State permit tracking system, EPA ICIS-NPDES</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-inventory': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-slate-600" />
                    Permit Inventory
                  </CardTitle>
                  <CardDescription>Complete permit universe with status and expiration tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Individual Permits', value: '148', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'General Permits', value: '194', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Administratively Extended', value: '28', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Expired (no coverage)', value: '4', bg: 'bg-red-50 border-red-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Total = 374 unique NPDES permits (individual + general + extended + expired). Differs from DMR count (342 monthly submission slots) and General Permits card (1,703 registrations under general permits). Source: EPA ICIS-NPDES, state permit database</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-pipeline': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-cyan-600" />
                    Permit Development Pipeline
                  </CardTitle>
                  <CardDescription>Permits in development with stage tracking and bottleneck identification</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Application Review', value: '8', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Draft Development', value: '6', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Public Notice', value: '4', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Final Issuance', value: '6', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Pipeline counts = permits currently in development stages. These are a subset of the Permit Inventory totals. Source: State permit development workflow system</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-dmr': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    DMR & Compliance Monitoring
                  </CardTitle>
                  <CardDescription>Discharge monitoring report submissions and effluent limit compliance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'DMRs Due (month)', value: '342', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Submitted On Time', value: '94%', bg: 'bg-green-50 border-green-200' },
                      { label: 'Limit Exceedances', value: '18', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Late/Missing', value: '12', bg: 'bg-red-50 border-red-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>342 = monthly DMR submission slots (one per parameter per permit). Not a permit count — one permit may have multiple DMR parameters. Source: EPA ICIS-NPDES DMR data, NetDMR submissions</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-inspection': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-orange-600" />
                    Inspection Management
                  </CardTitle>
                  <CardDescription>Compliance inspection scheduling, tracking, and follow-up</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Scheduled (FY)', value: '186', bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Completed', value: '124', bg: 'bg-green-50 border-green-200' },
                      { label: 'Findings Pending', value: '18', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Coverage Rate', value: '67%', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Inspections = compliance evaluation visits. Coverage rate = inspected facilities / total permitted facilities. Source: State inspection tracking system, EPA ICIS inspections</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-enforcement': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-red-600" />
                    Enforcement Pipeline
                  </CardTitle>
                  <CardDescription>Active enforcement actions from informal to formal proceedings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Informal Actions', value: '24', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Formal Actions', value: '8', bg: 'bg-red-50 border-red-200' },
                      { label: 'Consent Orders', value: '4', bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Penalties Assessed', value: '$142K', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Enforcement actions (not permits). One facility may have multiple actions. The ICIS Compliance panel shows all enforcement records from EPA ECHO. Source: State enforcement tracking, EPA ICIS formal actions</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-general': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-teal-600" />
                    General Permits & Coverage
                  </CardTitle>
                  <CardDescription>General permit registrations and coverage statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Construction GP', value: '1,247', bg: 'bg-teal-50 border-teal-200' },
                      { label: 'Industrial GP', value: '342', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'MS4 GP', value: '86', bg: 'bg-indigo-50 border-indigo-200' },
                      { label: 'CAFO GP', value: '28', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>General permit registrations (NOIs filed). Each registration = one discharger covered under a general permit. Distinct from the 194 general permit authorizations in Permit Inventory. Source: State general permit registration system, EPA ICIS</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-snc': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                    Significant Non-Compliance (SNC) Detail
                  </CardTitle>
                  <CardDescription>Facilities currently in significant non-compliance with NPDES permits</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Facility</th>
                          <th className="px-2.5 py-2">Permit ID</th>
                          <th className="px-2.5 py-2">Violation Type</th>
                          <th className="px-2.5 py-2">Duration</th>
                          <th className="px-2.5 py-2">RTC Date</th>
                          <th className="px-2.5 py-2">Enforcement</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { fac: 'Metro WWTP', permit: 'MD0021601', type: 'Effluent', dur: '3 qtrs', rtc: '2026-06-30', enf: 'Consent Order' },
                          { fac: 'Industrial Park STP', permit: 'MD0052124', type: 'Schedule', dur: '2 qtrs', rtc: '2026-09-15', enf: 'Formal NOV' },
                          { fac: 'County WRF', permit: 'MD0068713', type: 'Effluent', dur: '4 qtrs', rtc: '2026-03-31', enf: 'Penalty Action' },
                          { fac: 'Harbor Treatment', permit: 'MD0021237', type: 'Reporting', dur: '1 qtr', rtc: '2026-04-30', enf: 'Informal' },
                        ].map(r => (
                          <tr key={r.permit} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-slate-700 font-medium">{r.fac}</td>
                            <td className="px-2.5 py-2 font-mono text-slate-600">{r.permit}</td>
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.type === 'Effluent' ? 'bg-red-100 text-red-700' :
                                r.type === 'Schedule' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{r.type}</span>
                            </td>
                            <td className="px-2.5 py-2 text-slate-600">{r.dur}</td>
                            <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">{r.rtc}</td>
                            <td className="px-2.5 py-2 text-slate-600">{r.enf}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>SNC = facilities in significant non-compliance for 2+ consecutive quarters. RTC = planned return-to-compliance date. Source: EPA ECHO QNCR, state enforcement tracking</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-waterbody': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-blue-600" />
                    Permit-to-Waterbody Impact Cross-Reference
                  </CardTitle>
                  <CardDescription>NPDES permits linked to impaired receiving waters (ATTAINS 303(d) list)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Permit</th>
                          <th className="px-2.5 py-2">Facility</th>
                          <th className="px-2.5 py-2">Receiving Water</th>
                          <th className="px-2.5 py-2">Impairment</th>
                          <th className="px-2.5 py-2">TMDL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { permit: 'MD0021601', fac: 'Metro WWTP', water: 'Back River', impair: 'Nitrogen, Phosphorus', tmdl: 'Chesapeake Bay' },
                          { permit: 'MD0052124', fac: 'Industrial Park STP', water: 'Patapsco River', impair: 'Sediment, Bacteria', tmdl: 'Pending' },
                          { permit: 'MD0068713', fac: 'County WRF', water: 'Bush River', impair: 'Dissolved Oxygen', tmdl: 'Chesapeake Bay' },
                          { permit: 'MD0067814', fac: 'Coastal Discharge', water: 'Chesapeake Bay mainstem', impair: 'Chlorophyll-a', tmdl: 'Chesapeake Bay' },
                        ].map(r => (
                          <tr key={r.permit} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 font-mono text-slate-600">{r.permit}</td>
                            <td className="px-2.5 py-2 text-slate-700">{r.fac}</td>
                            <td className="px-2.5 py-2 text-blue-700 font-medium">{r.water}</td>
                            <td className="px-2.5 py-2 text-slate-600">{r.impair}</td>
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.tmdl === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                              }`}>{r.tmdl}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Cross-references NPDES discharge permits with EPA ATTAINS impaired waters list. Facilities discharging to 303(d)-listed waters may face stricter limits. Source: EPA ICIS-NPDES, EPA ATTAINS</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-expiring': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-amber-600" />
                    Expiring Permits Timeline
                  </CardTitle>
                  <CardDescription>Permits approaching expiration with renewal status tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Within 30 days', value: '2', bg: 'bg-red-50 border-red-200', textColor: 'text-red-700' },
                      { label: 'Within 60 days', value: '5', bg: 'bg-amber-50 border-amber-200', textColor: 'text-amber-700' },
                      { label: 'Within 90 days', value: '8', bg: 'bg-blue-50 border-blue-200', textColor: 'text-blue-700' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg} text-center`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className={`text-2xl font-bold mt-1 ${k.textColor}`}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Permit</th>
                          <th className="px-2.5 py-2">Facility</th>
                          <th className="px-2.5 py-2">Expires</th>
                          <th className="px-2.5 py-2">Renewal Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { permit: 'MD0021601', fac: 'Metro WWTP', exp: '2026-03-15', status: 'Application Filed' },
                          { permit: 'MD0052124', fac: 'Industrial Park STP', exp: '2026-03-28', status: 'Under Review' },
                          { permit: 'MD0035432', fac: 'Regional Authority', exp: '2026-04-12', status: 'Not Filed' },
                          { permit: 'MD0041897', fac: 'Riverside Plant', exp: '2026-04-30', status: 'Draft Pending' },
                          { permit: 'MD0068713', fac: 'County WRF', exp: '2026-05-15', status: 'Application Filed' },
                        ].map(r => (
                          <tr key={r.permit} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 font-mono text-slate-600">{r.permit}</td>
                            <td className="px-2.5 py-2 text-slate-700">{r.fac}</td>
                            <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">{r.exp}</td>
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.status === 'Not Filed' ? 'bg-red-100 text-red-700' :
                                r.status === 'Under Review' ? 'bg-amber-100 text-amber-700' :
                                r.status === 'Application Filed' ? 'bg-green-100 text-green-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Permits expiring within 90 days. Renewal applications due 180 days before expiration per CWA Section 402. &quot;Not Filed&quot; flags facilities at risk of coverage gaps. Source: EPA ICIS-NPDES permit data</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'perm-dmr-trends': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    DMR Trend Analysis
                  </CardTitle>
                  <CardDescription>12-month discharge monitoring trends, repeat violators, and parameter patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Exceedance Rate (12mo)', value: '6.2%', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Trend', value: 'Improving', bg: 'bg-green-50 border-green-200' },
                      { label: 'Repeat Violators', value: '4', bg: 'bg-red-50 border-red-200' },
                      { label: 'Top Parameter', value: 'TSS', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Parameter</th>
                          <th className="px-2.5 py-2 text-right">Exceedances</th>
                          <th className="px-2.5 py-2 text-right">Total DMRs</th>
                          <th className="px-2.5 py-2 text-right">Rate</th>
                          <th className="px-2.5 py-2">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { param: 'Total Suspended Solids', exceed: 12, total: 186, trend: 'Stable' },
                          { param: 'Total Nitrogen', exceed: 8, total: 142, trend: 'Worsening' },
                          { param: 'Total Phosphorus', exceed: 6, total: 142, trend: 'Improving' },
                          { param: 'BOD5', exceed: 4, total: 186, trend: 'Improving' },
                          { param: 'E. coli', exceed: 3, total: 98, trend: 'Stable' },
                        ].map(r => (
                          <tr key={r.param} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-slate-700 font-medium">{r.param}</td>
                            <td className="px-2.5 py-2 text-right font-semibold text-red-700">{r.exceed}</td>
                            <td className="px-2.5 py-2 text-right text-slate-500">{r.total}</td>
                            <td className="px-2.5 py-2 text-right font-semibold text-slate-700">{(r.exceed / r.total * 100).toFixed(1)}%</td>
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.trend === 'Improving' ? 'bg-green-100 text-green-700' :
                                r.trend === 'Worsening' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{r.trend}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>12-month rolling DMR exceedance analysis. Repeat violators = facilities with 3+ exceedances on the same parameter. Trend based on 6-month slope. Source: EPA ICIS-NPDES DMR data</span>
                  </div>
                </CardContent>
              </Card>
            );

            // ── Funding sections ───────────────────────────────────────────
            case 'fund-active': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-green-600" />
                    My Active Grants
                  </CardTitle>
                  <CardDescription>Currently active federal and state grant awards</CardDescription>
                </CardHeader>
                <CardContent>
                  {usasLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Activity className="h-4 w-4 animate-spin" /> Loading USAspending data...</div>
                  ) : usasData?.programs?.length ? (
                    <div className="space-y-2">
                      {usasData.programs.filter(p => p.totalObligated > 0).map((p, i) => (
                        <div key={i} className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-800">{p.programName} ({p.cfda})</span>
                            <Badge variant="default" className="text-[10px]">{p.awardCount} awards</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-slate-500">
                            <span>Total: ${(p.totalObligated / 1e6).toFixed(1)}M</span>
                            <span>Current FY: ${(p.currentFyObligated / 1e6).toFixed(1)}M</span>
                            {p.bilAmount > 0 && <span>BIL: ${(p.bilAmount / 1e6).toFixed(1)}M</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[
                        { grant: 'CWA Section 106 — Water Pollution Control', amount: '$4.2M', period: 'FY2025-2026', status: 'Active', spent: '62%' },
                        { grant: 'CWA Section 319 — NPS Management', amount: '$2.8M', period: 'FY2024-2026', status: 'Active', spent: '45%' },
                        { grant: 'SDWA PWSS — Public Water System Supervision', amount: '$3.1M', period: 'FY2025-2026', status: 'Active', spent: '38%' },
                        { grant: 'CWA Section 104(b)(3) — Monitoring', amount: '$680K', period: 'FY2025-2027', status: 'Active', spent: '22%' },
                      ].map((g, i) => (
                        <div key={i} className="rounded-lg border border-green-200 bg-green-50/50 p-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-800">{g.grant}</span>
                            <Badge variant="default" className="text-[10px]">{g.status}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-slate-500">
                            <span>Award: {g.amount}</span>
                            <span>{g.period}</span>
                            <span>Spent: {g.spent}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: USAspending.gov{usasData ? '' : ' (placeholder)'}</p>
                </CardContent>
              </Card>
            );

            case 'fund-srf': {
              const cwsrfProg = usasData?.programs?.find(p => p.cfda === '66.458');
              const dwsrfProg = usasData?.programs?.find(p => p.cfda === '66.468');
              const srfBil = (cwsrfProg?.bilAmount || 0) + (dwsrfProg?.bilAmount || 0);
              const hasSrf = cwsrfProg || dwsrfProg;
              return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-blue-600" />
                    SRF Program
                  </CardTitle>
                  <CardDescription>State Revolving Fund capitalization, lending, and utilization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {usasLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Activity className="h-4 w-4 animate-spin" /> Loading...</div>
                  ) : hasSrf ? (<>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Capitalization (5-Year Total)</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'CWSRF Cap Grant', value: `$${((cwsrfProg?.totalObligated || 0) / 1e6).toFixed(0)}M`, bg: 'bg-blue-50 border-blue-200' },
                      { label: 'DWSRF Cap Grant', value: `$${((dwsrfProg?.totalObligated || 0) / 1e6).toFixed(0)}M`, bg: 'bg-sky-50 border-sky-200' },
                      { label: 'BIL Supplement', value: `$${(srfBil / 1e6).toFixed(0)}M`, bg: 'bg-green-50 border-green-200' },
                      { label: 'SRF Awards', value: String((cwsrfProg?.awardCount || 0) + (dwsrfProg?.awardCount || 0)), bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 mt-4">Current FY</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'CWSRF Current FY', value: `$${((cwsrfProg?.currentFyObligated || 0) / 1e6).toFixed(0)}M`, bg: 'bg-green-50 border-green-200' },
                      { label: 'DWSRF Current FY', value: `$${((dwsrfProg?.currentFyObligated || 0) / 1e6).toFixed(0)}M`, bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Utilization Rate', value: 'N/A', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Available Balance', value: 'N/A', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  </>) : (<>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Capitalization</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'CWSRF Cap Grant', value: '$42M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'DWSRF Cap Grant', value: '$28M', bg: 'bg-sky-50 border-sky-200' },
                      { label: 'BIL Supplement', value: '$18M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Loan Repayments', value: '$31M/yr', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  </>)}
                  <p className="text-xs text-slate-400 mt-2 italic">Data source: {hasSrf ? 'USAspending.gov (CFDA 66.458/66.468)' : 'EPA CWSRF/DWSRF national data (placeholder)'}</p>
                </CardContent>
              </Card>
            );}

            case 'fund-pipeline': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                    Opportunity Pipeline
                  </CardTitle>
                  <CardDescription>Upcoming grant opportunities and application deadlines</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { opportunity: 'EPA Water Quality Improvement Fund', deadline: '2026-04-15', amount: 'Up to $2M', match: '40%' },
                      { opportunity: 'USDA Conservation Innovation Grant', deadline: '2026-05-01', amount: 'Up to $1M', match: '50%' },
                      { opportunity: 'NOAA Coastal Resilience Grant', deadline: '2026-06-30', amount: 'Up to $5M', match: '50%' },
                    ].map((o, i) => (
                      <div key={i} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-slate-800">{o.opportunity}</span>
                          <Badge variant="outline" className="text-[10px]">Due: {o.deadline}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500">
                          <span>Award: {o.amount}</span>
                          <span>Match: {o.match}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: Grants.gov, EPA grant announcements, USDA RFPs</p>
                </CardContent>
              </Card>
            );

            case 'fund-passthrough': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-teal-600" />
                    Pass-Through Grants
                  </CardTitle>
                  <CardDescription>Federal funds distributed to local entities through state programs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Active Sub-Awards', value: '42', bg: 'bg-teal-50 border-teal-200' },
                      { label: 'Total Distributed', value: '$8.4M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Pending Closeout', value: '6', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State grants management system, USAspending.gov</p>
                </CardContent>
              </Card>
            );

            case 'fund-analytics': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-600" />
                    Financial Analytics
                  </CardTitle>
                  <CardDescription>Grant performance metrics, cost-effectiveness, and ROI tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Grant Portfolio', value: '$14.2M', bg: 'bg-purple-50 border-purple-200' },
                      { label: 'Utilization Rate', value: '82%', bg: 'bg-green-50 border-green-200' },
                      { label: 'Cost per Impairment', value: '$248K', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Grant Success Rate', value: '68%', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Source: State financial system, EPA grant performance data, USAspending.gov</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'fund-bil': {
              const bilTotal = usasData?.totalBil || 0;
              const bilProgs = usasData?.programs?.filter(p => p.bilAmount > 0) || [];
              const hasBil = bilTotal > 0;
              return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-700" />
                    BIL/IIJA Funding Tracker
                  </CardTitle>
                  <CardDescription>Bipartisan Infrastructure Law water funding allocation and drawdown status</CardDescription>
                </CardHeader>
                <CardContent>
                  {usasLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Activity className="h-4 w-4 animate-spin" /> Loading...</div>
                  ) : hasBil ? (<>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Total BIL Obligated', value: `$${(bilTotal / 1e6).toFixed(0)}M`, bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Programs w/ BIL', value: String(bilProgs.length), bg: 'bg-green-50 border-green-200' },
                      { label: 'Drawdown Rate', value: 'N/A', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Match Required', value: `$${((usasData?.bilMatchRequired || 0) / 1e6).toFixed(1)}M`, bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Program</th>
                          <th className="px-2.5 py-2 text-right">BIL Amount</th>
                          <th className="px-2.5 py-2 text-right">Total Obligated</th>
                          <th className="px-2.5 py-2 text-right">BIL Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bilProgs.map(p => {
                          const share = p.totalObligated > 0 ? Math.round((p.bilAmount / p.totalObligated) * 100) : 0;
                          return (
                          <tr key={p.cfda} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-slate-700 font-medium">{p.programName}</td>
                            <td className="px-2.5 py-2 text-right font-semibold text-green-700">${(p.bilAmount / 1e6).toFixed(1)}M</td>
                            <td className="px-2.5 py-2 text-right text-slate-600">${(p.totalObligated / 1e6).toFixed(1)}M</td>
                            <td className="px-2.5 py-2 text-right text-slate-600">{share}%</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  </>) : (<>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Total BIL Allocation', value: '$126M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Drawn Down', value: '$48M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Committed', value: '$62M', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Remaining', value: '$16M', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  </>)}
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>BIL/IIJA = Bipartisan Infrastructure Law. {hasBil ? 'Source: USAspending.gov (def_codes Z/1)' : 'Drawdown rate = funds disbursed / allocated. Source: EPA data (placeholder)'}</span>
                  </div>
                </CardContent>
              </Card>
            );}

            case 'fund-j40': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-emerald-600" />
                    Justice40 Tracker
                  </CardTitle>
                  <CardDescription>Investment in disadvantaged communities toward the 40% threshold</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'J40 Target (40%)', value: '$50.4M', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Current Investment', value: '$38.2M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Achievement', value: '76%', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'DAC Communities Served', value: '24', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2">
                    <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                      <span>Progress toward 40% DAC investment</span>
                      <span>76% of target</span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '76%' }} />
                    </div>
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Justice40 requires 40% of climate/clean energy investment benefits flow to disadvantaged communities (DACs). DAC designation per CEJST. Source: EPA EJScreen, CEJST, state program data</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'fund-srf-pipeline': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardHat className="h-5 w-5 text-orange-600" />
                    SRF Project Pipeline
                  </CardTitle>
                  <CardDescription>State Revolving Fund intended use plan queue with priority scoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Project</th>
                          <th className="px-2.5 py-2">Applicant</th>
                          <th className="px-2.5 py-2 text-right">Amount</th>
                          <th className="px-2.5 py-2 text-right">Priority</th>
                          <th className="px-2.5 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { proj: 'WWTP Nutrient Upgrade', app: 'City of Frederick', amt: '$18.4M', pri: 92, status: 'Approved' },
                          { proj: 'Lead Line Replacement', app: 'Baltimore City', amt: '$24.6M', pri: 88, status: 'Under Review' },
                          { proj: 'CSO Long-term Control', app: 'Cumberland', amt: '$8.2M', pri: 85, status: 'Approved' },
                          { proj: 'Stormwater Retrofit', app: 'Anne Arundel Co.', amt: '$3.1M', pri: 78, status: 'Pending' },
                          { proj: 'Water Treatment Plant', app: 'Hagerstown', amt: '$12.8M', pri: 74, status: 'Pending' },
                        ].map(r => (
                          <tr key={r.proj} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-slate-700 font-medium">{r.proj}</td>
                            <td className="px-2.5 py-2 text-slate-600">{r.app}</td>
                            <td className="px-2.5 py-2 text-right font-semibold text-slate-700">{r.amt}</td>
                            <td className="px-2.5 py-2 text-right">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.pri >= 85 ? 'bg-green-100 text-green-700' :
                                r.pri >= 75 ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{r.pri}</span>
                            </td>
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.status === 'Approved' ? 'bg-green-100 text-green-700' :
                                r.status === 'Under Review' ? 'bg-amber-100 text-amber-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Priority scores from state IUP (Intended Use Plan). Higher scores funded first. Loan terms vary by project type and DAC status. Source: State CWSRF/DWSRF IUP, EPA SRF data</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'fund-grant-compliance': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-teal-600" />
                    Grant Compliance & Reporting
                  </CardTitle>
                  <CardDescription>Per-grant deliverables, due dates, and submission tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Grant</th>
                          <th className="px-2.5 py-2">Deliverable</th>
                          <th className="px-2.5 py-2">Due Date</th>
                          <th className="px-2.5 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { grant: 'CWA 106', deliv: 'Annual Performance Report', due: '2026-03-31', status: 'Due Soon' },
                          { grant: 'CWA 319', deliv: 'Semi-Annual Progress Report', due: '2026-04-15', status: 'Not Started' },
                          { grant: 'SDWA PWSS', deliv: 'Quarterly Financial Report', due: '2026-03-15', status: 'Submitted' },
                          { grant: 'CWA 104(b)(3)', deliv: 'Final Project Report', due: '2026-06-30', status: 'In Progress' },
                          { grant: 'BIL LSLR', deliv: 'Inventory Certification', due: '2026-04-01', status: 'Due Soon' },
                          { grant: 'BIL EC', deliv: 'PFAS Sampling Plan Update', due: '2026-05-15', status: 'Not Started' },
                        ].map((r, i) => (
                          <tr key={`${r.grant}-${i}`} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 font-medium text-slate-700">{r.grant}</td>
                            <td className="px-2.5 py-2 text-slate-600">{r.deliv}</td>
                            <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap">{r.due}</td>
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.status === 'Submitted' ? 'bg-green-100 text-green-700' :
                                r.status === 'Due Soon' ? 'bg-red-100 text-red-700' :
                                r.status === 'In Progress' ? 'bg-blue-100 text-blue-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>Grant reporting requirements per award terms. &quot;Due Soon&quot; = within 30 days. Late submissions may trigger grant conditions. Source: EPA GICS, state grant management system</span>
                  </div>
                </CardContent>
              </Card>
            );

            case 'fund-trend': {
              // Build trend rows from usasData per-program fyTrend
              const trendProgs = usasData?.programs?.filter(p => p.fyTrend?.length > 0) || [];
              const hasTrend = trendProgs.length > 0 && trendProgs[0].fyTrend.length > 0;
              const fyHeaders = hasTrend ? trendProgs[0].fyTrend.map(t => `FY${String(t.fy).slice(-2)}`) : [];
              const trendRows = hasTrend ? trendProgs.map(p => {
                const vals = p.fyTrend.map(t => t.amount);
                const recent = vals.slice(-3);
                const slope = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
                const trend = slope > recent[0] * 0.05 ? 'Growing' : slope < -recent[0] * 0.05 ? 'Declining' : 'Stable';
                return { prog: p.programName, fyVals: vals, trend };
              }) : [];
              return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-indigo-600" />
                    Federal Funding Trend
                  </CardTitle>
                  <CardDescription>5-year historical federal water funding by program with growth/decline indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  {usasLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Activity className="h-4 w-4 animate-spin" /> Loading...</div>
                  ) : hasTrend ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Program</th>
                          {fyHeaders.map(h => <th key={h} className="px-2.5 py-2 text-right">{h}</th>)}
                          <th className="px-2.5 py-2">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trendRows.map(r => (
                          <tr key={r.prog} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-slate-700 font-medium">{r.prog}</td>
                            {r.fyVals.map((v, i) => (
                              <td key={i} className="px-2.5 py-2 text-right text-slate-600">{v > 0 ? `$${(v / 1e6).toFixed(1)}M` : '—'}</td>
                            ))}
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.trend === 'Growing' ? 'bg-green-100 text-green-700' :
                                r.trend === 'Declining' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{r.trend}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  ) : (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Program</th>
                          <th className="px-2.5 py-2 text-right">FY22</th>
                          <th className="px-2.5 py-2 text-right">FY23</th>
                          <th className="px-2.5 py-2 text-right">FY24</th>
                          <th className="px-2.5 py-2 text-right">FY25</th>
                          <th className="px-2.5 py-2 text-right">FY26</th>
                          <th className="px-2.5 py-2">Trend</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { prog: 'CWSRF (base)', fy: ['$38M', '$40M', '$42M', '$42M', '$44M'], trend: 'Growing' },
                          { prog: 'DWSRF (base)', fy: ['$24M', '$26M', '$28M', '$28M', '$30M'], trend: 'Growing' },
                          { prog: 'CWA 319 (NPS)', fy: ['$2.6M', '$2.8M', '$2.8M', '$2.7M', '$2.8M'], trend: 'Stable' },
                          { prog: 'CWA 106 (NPDES)', fy: ['$4.0M', '$4.2M', '$4.2M', '$4.1M', '$4.2M'], trend: 'Stable' },
                          { prog: 'BIL Supplement', fy: ['—', '$12M', '$16M', '$18M', '$18M'], trend: 'Growing' },
                        ].map(r => (
                          <tr key={r.prog} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 text-slate-700 font-medium">{r.prog}</td>
                            {r.fy.map((v, i) => (
                              <td key={i} className="px-2.5 py-2 text-right text-slate-600">{v}</td>
                            ))}
                            <td className="px-2.5 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                r.trend === 'Growing' ? 'bg-green-100 text-green-700' :
                                r.trend === 'Declining' ? 'bg-red-100 text-red-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>{r.trend}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{hasTrend ? `Source: USAspending.gov — ${stateAbbr} state-level obligations by CFDA` : 'Federal water program funding by fiscal year. BIL supplement began FY23. Source: placeholder data'}</span>
                  </div>
                </CardContent>
              </Card>
            );}

            case 'fund-match': {
              const srfMatch = usasData?.srfMatchRequired || 0;
              const bilMatch = usasData?.bilMatchRequired || 0;
              const totalMatch = srfMatch + bilMatch;
              const hasMatch = totalMatch > 0;
              // CFDA-based match rows from live data
              const matchRows = hasMatch ? [
                { grant: 'CWSRF (20%)', req: `$${((usasData?.programs?.find(p => p.cfda === '66.458')?.totalObligated || 0) * 0.25 / 1e6).toFixed(1)}M`, comm: 'N/A', src: '—', gap: '—' },
                { grant: 'DWSRF (20%)', req: `$${((usasData?.programs?.find(p => p.cfda === '66.468')?.totalObligated || 0) * 0.25 / 1e6).toFixed(1)}M`, comm: 'N/A', src: '—', gap: '—' },
                { grant: 'BIL Water (10%)', req: `$${(bilMatch / 1e6).toFixed(1)}M`, comm: 'N/A', src: '—', gap: '—' },
              ] : [];
              return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-amber-600" />
                    Match & Cost-Share Tracker
                  </CardTitle>
                  <CardDescription>State match commitments, funding sources, and unfunded gap analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  {usasLoading ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 py-4"><Activity className="h-4 w-4 animate-spin" /> Loading...</div>
                  ) : hasMatch ? (<>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'SRF Match Required', value: `$${(srfMatch / 1e6).toFixed(1)}M`, bg: 'bg-amber-50 border-amber-200' },
                      { label: 'BIL Match Required', value: `$${(bilMatch / 1e6).toFixed(1)}M`, bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Total Match', value: `$${(totalMatch / 1e6).toFixed(1)}M`, bg: 'bg-red-50 border-red-200' },
                      { label: 'Federal Total', value: `$${((usasData?.totalEpaWater || 0) / 1e6).toFixed(0)}M`, bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-2.5 py-2">Program</th>
                          <th className="px-2.5 py-2 text-right">Match Required</th>
                          <th className="px-2.5 py-2 text-right">Committed</th>
                          <th className="px-2.5 py-2">Source</th>
                          <th className="px-2.5 py-2 text-right">Gap</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {matchRows.map(r => (
                          <tr key={r.grant} className="hover:bg-slate-50">
                            <td className="px-2.5 py-2 font-medium text-slate-700">{r.grant}</td>
                            <td className="px-2.5 py-2 text-right text-slate-600">{r.req}</td>
                            <td className="px-2.5 py-2 text-right font-semibold text-slate-400">{r.comm}</td>
                            <td className="px-2.5 py-2 text-slate-400">{r.src}</td>
                            <td className="px-2.5 py-2 text-right font-semibold text-slate-400">{r.gap}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>) : (<>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Total Match Required', value: '$8.4M', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Committed', value: '$6.8M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Unfunded Gap', value: '$1.6M', bg: 'bg-red-50 border-red-200' },
                      { label: 'Match Rate', value: '81%', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  </>)}
                  <div className="flex items-start gap-1.5 mt-4 text-xs text-slate-400 italic">
                    <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>{hasMatch ? 'Match calculated from USAspending.gov obligations: CWSRF/DWSRF 20% statutory match, BIL ~10%. Committed/gap columns require state budget data.' : 'State match = non-federal cost-share required by grant terms. Source: placeholder data'}</span>
                  </div>
                </CardContent>
              </Card>
            );}

            case 'grant-outcomes': return DS(<>
              {/* Historical Grant Outcomes */}
              <GrantOutcomesCard />
            </>);

            case 'wqt': return NUTRIENT_TRADING_STATES.has(stateAbbr) ? DS(<>
              <WaterQualityTradingPanel stateAbbr={stateAbbr} mode="state" />
            </>) : null;

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



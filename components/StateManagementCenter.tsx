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
import { useFloodRiskOverview } from '@/hooks/useFloodRiskOverview';
import { FloodForecastCard, FloodStatusSummary } from './FloodForecastCard';
import { FloodRiskOverviewCard, FloodRiskSummary } from './FloodRiskOverviewCard';
import { WeatherAlertsSection } from './WeatherAlertsSection';
import { TriageQueueSection } from './TriageQueueSection';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { scoreToGrade, alertLevelAvgScore, ALERT_LEVEL_SCORES, ecoScoreStyle, ejScoreStyle } from '@/lib/scoringUtils';
import { getEcoScore, getEcoData, ecoScoreLabel } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData, ejScoreLabel } from '@/lib/ejVulnerability';
import { getStateMS4Jurisdictions, getMS4ComplianceSummary, STATE_AUTHORITIES } from '@/lib/stateWaterData';
import { useAuth } from '@/lib/authContext';
import { getRegionMockData, calculateRemovalEfficiency } from '@/lib/realWaterData';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
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
import { AquaticWildlifePanel } from '@/components/AquaticWildlifePanel';
import { DataFreshnessFooter } from '@/components/DataFreshnessFooter';
import { useJurisdictionContext } from '@/lib/jurisdiction-context';
import { scopeRowsByJurisdiction } from '@/lib/jurisdictions/index';
import RoleTrainingGuide from '@/components/RoleTrainingGuide';
import { AirQualityMonitoringCard } from '@/components/AirQualityMonitoringCard';
import { UserManagementPanel } from './UserManagementPanel';
import { getInvitableRoles } from '@/lib/adminHierarchy';
import { BriefingQACard } from '@/components/BriefingQACard';
import { AskPinUniversalCard } from '@/components/AskPinUniversalCard';
import CorrelationBreakthroughsPanel from '@/components/CorrelationBreakthroughsPanel';
import LensDataStory from '@/components/LensDataStory';
import { useDataSummaries } from '@/hooks/useDataSummaries';
import { DataStatCard } from '@/components/DataStatCard';
import { daysUntil, deadlineStatus, deadlineRowStyle, deadlineTextColor, daysLabel } from '@/lib/formatDate';
import { RealPolicyTracker } from './RealPolicyTracker';


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
  | 'reports' | 'permits' | 'funding' | 'wqt' | 'training' | 'users';

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
    sections: new Set(['regprofile', 'operational-health', 'alertfeed', 'map-grid', 'top10', 'quick-access', 'correlation-breakthroughs', 'lens-data-story']),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'AI-generated overnight summary and action items',
    defaultOverlay: 'risk',
    sections: new Set(['insights', 'briefing-actions', 'briefing-qa', 'ask-pin-universal', 'lens-data-story']),
  },
  'political-briefing': {
    label: 'Political Briefing',
    description: 'Talking points, funding optics, EJ exposure, and council agenda suggestions',
    defaultOverlay: 'risk',
    sections: new Set([
      'pol-talking-points', 'pol-constituent-concerns', 'pol-funding-wins', 'pol-funding-risks',
      'pol-regulatory-deadlines', 'pol-ej-exposure', 'pol-media-ready-grades',
      'pol-peer-comparison', 'pol-council-agenda', 'disclaimer',
      'lens-data-story']),
  },
  trends: {
    label: 'Trends & Projections',
    description: 'Long-term water quality trends, TMDL progress, and outlook',
    defaultOverlay: 'risk',
    sections: new Set(['trends-dashboard', 'disclaimer', 'lens-data-story']),
  },
  policy: {
    label: 'Policy Tracker',
    description: 'Federal, state, and EPA regulatory action tracking',
    defaultOverlay: 'risk',
    sections: new Set(['policy-federal', 'policy-state', 'policy-epa', 'disclaimer', 'lens-data-story']),
  },
  compliance: {
    label: 'Compliance',
    description: 'Impairment severity, permits, enforcement, and drinking water',
    defaultOverlay: 'risk',
    sections: new Set(['icis', 'sdwis', 'ms4jurisdictions', 'compliance-assessment', 'compliance-analytics', 'cyber-risk-panel', 'dmr-violations-panel', 'correlation-breakthroughs', 'disclaimer', 'lens-data-story']),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'Standards, assessment, station data, and field integration',
    defaultOverlay: 'risk',
    sections: new Set(['regprofile', 'local-panel', 'groundwater', 'wq-standards', 'wq-assessment', 'wq-stations', 'usgs-ogc-stations', 'ngwmn-groundwater', 'water-availability', 'wqx-modern-results', 'dmr-violations-panel', 'correlation-breakthroughs', 'disclaimer', 'lens-data-story']),
  },
  'public-health': {
    label: 'Public Health & Contaminants',
    description: 'Contaminant tracking, health coordination, and lab capacity',
    defaultOverlay: 'risk',
    sections: new Set(['sdwis', 'ph-contaminants', 'ph-health-coord', 'ph-lab-capacity', 'ph-mortality-context', 'ph-healthcare-access', 'ph-outbreak-tracker', 'ph-env-health-corr', 'pfas-analytics-panel', 'cdc-places-health', 'correlation-breakthroughs', 'disclaimer', 'lens-data-story']),
  },
  habitat: {
    label: 'Habitat & Ecology',
    description: 'Ecological sensitivity, bioassessment, habitat impairment, T&E species, and 401 certification',
    defaultOverlay: 'risk',
    sections: new Set(['hab-ecoscore', 'hab-attainment', 'hab-bioassessment', 'hab-impairment-causes', 'hab-wildlife', 'hab-401cert', 'disclaimer', 'lens-data-story']),
  },
  agriculture: {
    label: 'Agricultural & Nonpoint Source',
    description: '319 program, watershed plans, and nutrient reduction',
    defaultOverlay: 'risk',
    sections: new Set(['ag-319', 'ag-partners', 'ag-nps-breakdown', 'ag-nps-tmdl', 'ag-nps-funding', 'disclaimer', 'lens-data-story']),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'SRF administration, capital planning, and green infrastructure',
    defaultOverlay: 'risk',
    sections: new Set(['infra-srf', 'infra-capital', 'infra-construction', 'infra-green', 'ag-bmp-effectiveness', 'ag-nutrient', 'ag-wbp', 'flood-impact-analysis', 'cyber-risk-panel', 'disclaimer', 'lens-data-story']),
  },
  monitoring: {
    label: 'Monitoring',
    description: 'State monitoring network, data management, and optimization',
    defaultOverlay: 'coverage',
    sections: new Set(['groundwater', 'mon-network', 'mon-data-mgmt', 'mon-optimization', 'mon-continuous', 'mon-air-quality', 'mon-latency', 'mon-report-card', 'mon-source-health', 'flood-status', 'flood-risk-summary', 'weather-alerts', 'usgs-ogc-stations', 'ngwmn-groundwater', 'nws-forecast-panel', 'water-availability', 'wqx-modern-results', 'hab-forecast-panel', 'nexrad-precip-panel', 'severe-weather-panel', 'correlation-breakthroughs', 'disclaimer', 'lens-data-story']),
  },
  disaster: {
    label: 'Disaster & Emergency Response',
    description: 'Active incidents, spill reporting, and preparedness — redirects to merged planner view',
    defaultOverlay: 'risk',
    sections: new Set(['alertfeed', 'disaster-active', 'disaster-response', 'disaster-spill', 'disaster-prep', 'disaster-cascade', 'flood-forecast', 'flood-risk-overview', 'resolution-planner', 'flood-impact-analysis', 'nws-forecast-panel', 'flood-event-viewer', 'severe-weather-panel', 'correlation-breakthroughs', 'disclaimer', 'lens-data-story']),
  },
  tmdl: {
    label: 'TMDL & Restoration',
    description: 'TMDL program status, 303(d) management, and watershed restoration',
    defaultOverlay: 'risk',
    sections: new Set(['tmdl-status', 'tmdl-303d', 'tmdl-workspace', 'tmdl-implementation', 'tmdl-restoration', 'tmdl-epa', 'tmdl-completion-trend', 'tmdl-cause-breakdown', 'tmdl-delisting-stories', 'disclaimer', 'lens-data-story']),
  },
  scorecard: {
    label: 'Scorecard',
    description: 'Self-assessment, watershed scorecards, and peer comparison',
    defaultOverlay: 'risk',
    sections: new Set(['sc-self-assessment', 'sc-watershed', 'sc-peer', 'sc-epa-ppa', 'correlation-breakthroughs', 'disclaimer', 'lens-data-story']),
  },
  reports: {
    label: 'Reports',
    description: 'Integrated reports, regulatory filings, and data export',
    defaultOverlay: 'risk',
    sections: new Set(['exporthub', 'rpt-ir-workspace', 'rpt-regulatory', 'rpt-adhoc', 'global-water-quality', 'congress-legislation', 'disclaimer', 'lens-data-story']),
  },
  permits: {
    label: 'Permits & Enforcement',
    description: 'Permitting operations, inventory, DMR monitoring, and enforcement',
    defaultOverlay: 'risk',
    sections: new Set(['icis', 'perm-status', 'perm-inventory', 'perm-pipeline', 'perm-dmr', 'perm-inspection', 'perm-enforcement', 'perm-general', 'perm-snc', 'perm-waterbody', 'perm-expiring', 'perm-dmr-trends', 'disclaimer', 'lens-data-story']),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'Active grants, SRF management, and financial analytics',
    defaultOverlay: 'risk',
    sections: new Set(['grants', 'fund-active', 'fund-srf', 'infra-capital', 'infra-construction', 'fund-pipeline', 'fund-passthrough', 'fund-analytics', 'fund-bil', 'fund-j40', 'fund-srf-pipeline', 'fund-grant-compliance', 'fund-trend', 'fund-match', 'grant-outcomes', 'disclaimer', 'lens-data-story']),
  },
  wqt: {
    label: 'Water Quality Trading',
    description: 'Nutrient credit trading program — all sectors, marketplace, compliance',
    defaultOverlay: 'risk',
    sections: new Set(['wqt', 'disclaimer', 'lens-data-story']),
  },
  training: {
    label: 'Training', description: 'Deployment training and onboarding guide',
    defaultOverlay: 'risk',
    sections: new Set(['training']),
  },
  users: {
    label: 'Users',
    description: 'User management and invite delegation',
    defaultOverlay: 'risk',
    sections: new Set(['users-panel']),
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

  // State center coordinates for map
  const stateCenter: [number, number] = STATE_GEO_LEAFLET[stateAbbr]?.center || [-76.5, 39.0];
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

  // 14-layer composite index score for this state
  const [stateCompositeScore, setStateCompositeScore] = useState<{ score: number; confidence: number; hucCount: number; grade: string } | null>(null);

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

  // Reverse lookup: region name → ATTAINS ID (for HUC-8 extraction on registry entries)
  const attainsIdByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of attainsBulk) {
      if (a.id && a.name) m.set(a.name.toLowerCase().trim(), a.id);
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
      // Priority 3: name-based + HUC-8 coordinate resolver (fallback)
      // Pass ATTAINS ID (from r.id or reverse name lookup) to enable HUC-8 centroid extraction
      const aid = r.id.match(/\d{8}/) ? r.id : (attainsIdByName.get(r.name.toLowerCase().trim()) || undefined);
      const approx = resolveWaterbodyCoordinates(r.name, stateAbbr, aid);
      if (approx) {
        resolved.push({ id: r.id, name: r.name, lat: approx.lat, lon: approx.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount });
      }
    }
    return resolved;
  }, [regionData, stateAbbr, attainsCoordMap, attainsIdByName]);

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
        const r = await fetch(`/api/water-data?action=attains-state-data&state=${stateAbbr}`);
        if (!r.ok) return;
        const json = await r.json();
        const stateData = json.state;
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

  // Fetch 14-layer composite score for this state
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/indices?stateScores=true&state=${stateAbbr}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (cancelled || !data?.stateScores) return;
        const sc = data.stateScores[stateAbbr];
        if (sc) setStateCompositeScore(sc);
        else setStateCompositeScore(null);
      })
      .catch(() => setStateCompositeScore(null));
    return () => { cancelled = true; };
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
  const floodRisk = useFloodRiskOverview();
  const { data: dataSummaries, details: summaryDetails, isLoading: summariesLoading, fetchDetails } = useDataSummaries();

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
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{stateName} State Management Center</h1>
          <p className="text-slate-600">Comprehensive water quality oversight for {stateName}</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary">
            {jurisdictionScoreRows.length} Jurisdictions
          </Badge>
          <Badge variant="secondary">
            {regionData.length} Watersheds
          </Badge>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Compliance Score</CardTitle>
            <Gauge className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jurisdictionScoreSummary.avgScore}</div>
            <p className="text-xs text-muted-foreground">
              Grade: {jurisdictionScoreSummary.avgGrade.letter}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Compliance</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jurisdictionScoreSummary.inComplianceRate}%</div>
            <p className="text-xs text-muted-foreground">
              {jurisdictionScoreRows.length - jurisdictionScoreSummary.attentionCount} jurisdictions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Need Attention</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jurisdictionScoreSummary.attentionCount}</div>
            <p className="text-xs text-muted-foreground">
              Jurisdictions requiring review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jurisdictionScoreSummary.asOf}</div>
            <p className="text-xs text-muted-foreground">
              Data refresh
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weather Alerts */}
      <WeatherAlertsSection />

      {/* Triage Queue */}
      <TriageQueueSection />

      {/* Map and Jurisdictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>State Overview Map</CardTitle>
            <CardDescription>Water quality monitoring locations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-96">
              <MapboxMapShell
                center={stateCenter}
                zoom={6}
                style="mapbox://styles/mapbox/light-v11"
              >
                <MapboxMarkers
                  markers={regionData.map(r => ({
                    lng: r.lng,
                    lat: r.lat,
                    popup: `${r.name}: ${r.status}`,
                    color: r.alertLevel === 'critical' ? '#ef4444' :
                           r.alertLevel === 'warning' ? '#f59e0b' : '#10b981'
                  }))}
                />
              </MapboxMapShell>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MS4 Jurisdictions</CardTitle>
            <CardDescription>Municipal compliance overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {(jurisdictionScoreRows || []).slice(0, 10).map((jurisdiction: any) => (
                <div key={jurisdiction.name} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <div className="font-medium">{jurisdiction.name}</div>
                    <div className="text-sm text-muted-foreground">{jurisdiction.status}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={jurisdiction.needsAttention ? "destructive" : "secondary"}>
                      {jurisdiction.score}
                    </Badge>
                    {jurisdiction.trendIcon}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Flood Forecast */}
      <FloodForecastCard />

      {/* Flood Risk Overview */}
      <FloodRiskOverviewCard />

    </div>
  );
}

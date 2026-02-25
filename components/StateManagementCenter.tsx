'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLensParam } from '@/lib/useLensParam';
import { CircleMarker, Tooltip } from 'react-leaflet';
import HeroBanner from './HeroBanner';
import dynamic from 'next/dynamic';
import { getStatesGeoJSON, geoToAbbr, STATE_GEO_LEAFLET, FIPS_TO_ABBR as _FIPS, STATE_NAMES as _SN } from '@/lib/leafletMapUtils';

const LeafletMapShell = dynamic(
  () => import('@/components/LeafletMapShell').then(m => m.LeafletMapShell),
  { ssr: false }
);
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Shield, ChevronDown, ChevronUp, Minus, AlertTriangle, AlertCircle, CheckCircle, Search, Filter, Droplets, TrendingUp, BarChart3, Building2, Info, LogOut, Waves, Heart, TreePine, Sprout, FileCheck, Scale, Activity, Sparkles, ClipboardList, Trophy, FileText, Banknote, Zap, RadioTower, Wrench, HardHat, FlaskConical, Leaf, Landmark, ShieldCheck } from 'lucide-react';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { useRouter } from 'next/navigation';
import { getRegionById } from '@/lib/regionsConfig';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses, COST_PER_UNIT_YEAR } from '@/lib/restorationEngine';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { getEcoScore, getEcoData } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData, ejScoreLabel } from '@/lib/ejVulnerability';
import { getStateMS4Jurisdictions, getMS4ComplianceSummary, STATE_AUTHORITIES } from '@/lib/stateWaterData';
import { useAuth } from '@/lib/authContext';
import { getRegionMockData, calculateRemovalEfficiency } from '@/lib/mockData';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { useStateReport } from '@/lib/useStateReport';
import { StateDataReportCard } from '@/components/StateDataReportCard';

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

// ─── Map Overlay: what drives marker colors ──────────────────────────────────

type OverlayId = 'risk' | 'coverage' | 'bmp' | 'ej';

// ─── View Lens: controls what each view shows/hides ──────────────────────────

type ViewLens = 'overview' | 'briefing' | 'planner' | 'trends' | 'policy'
  | 'compliance' | 'water-quality' | 'public-health' | 'habitat' | 'agriculture'
  | 'infrastructure' | 'monitoring' | 'disaster' | 'tmdl' | 'scorecard'
  | 'reports' | 'permits' | 'funding';

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
    sections: new Set(['regprofile', 'datareport', 'operational-health', 'alertfeed', 'map-grid', 'detail', 'top10', 'quick-access', 'disclaimer']),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'AI-generated overnight summary and action items',
    defaultOverlay: 'risk',
    sections: new Set(['insights', 'briefing-actions', 'briefing-changes', 'briefing-pulse', 'briefing-stakeholder', 'disclaimer']),
  },
  planner: {
    label: 'Resolution Planner',
    description: 'Waterbody-level restoration planning workspace',
    defaultOverlay: 'risk',
    sections: new Set(['map-grid', 'detail', 'resolution-planner', 'disclaimer']),
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
    sections: new Set(['regprofile', 'map-grid', 'detail', 'ms4jurisdictions', 'icis', 'sdwis', 'compliance-permits', 'compliance-assessment', 'compliance-dwp', 'compliance-ms4', 'compliance-analytics', 'disclaimer']),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'Standards, assessment, station data, and field integration',
    defaultOverlay: 'risk',
    sections: new Set(['regprofile', 'map-grid', 'detail', 'top10', 'groundwater', 'wq-standards', 'wq-assessment', 'wq-aqualo', 'wq-stations', 'disclaimer']),
  },
  'public-health': {
    label: 'Public Health & Contaminants',
    description: 'Contaminant tracking, health coordination, and lab capacity',
    defaultOverlay: 'risk',
    sections: new Set(['sdwis', 'ph-contaminants', 'ph-health-coord', 'ph-lab-capacity', 'disclaimer']),
  },
  habitat: {
    label: 'Habitat & Ecology',
    description: 'Bioassessment, 401 certification, and wildlife coordination',
    defaultOverlay: 'risk',
    sections: new Set(['hab-bioassessment', 'hab-401cert', 'hab-wildlife', 'disclaimer']),
  },
  agriculture: {
    label: 'Agricultural & Nonpoint Source',
    description: '319 program, watershed plans, and nutrient reduction',
    defaultOverlay: 'risk',
    sections: new Set(['ag-319', 'ag-wbp', 'ag-nutrient', 'ag-partners', 'disclaimer']),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'SRF administration, capital planning, and green infrastructure',
    defaultOverlay: 'risk',
    sections: new Set(['infra-srf', 'infra-capital', 'infra-construction', 'infra-green', 'disclaimer']),
  },
  monitoring: {
    label: 'Monitoring',
    description: 'State monitoring network, data management, and optimization',
    defaultOverlay: 'coverage',
    sections: new Set(['map-grid', 'groundwater', 'mon-network', 'mon-data-mgmt', 'mon-optimization', 'mon-continuous', 'disclaimer']),
  },
  disaster: {
    label: 'Disaster & Emergency Response',
    description: 'Active incidents, spill reporting, and preparedness',
    defaultOverlay: 'risk',
    sections: new Set(['alertfeed', 'disaster-active', 'disaster-response', 'disaster-spill', 'disaster-prep', 'disclaimer']),
  },
  tmdl: {
    label: 'TMDL & Restoration',
    description: 'TMDL program status, 303(d) management, and watershed restoration',
    defaultOverlay: 'risk',
    sections: new Set(['tmdl-status', 'tmdl-303d', 'tmdl-workspace', 'tmdl-implementation', 'tmdl-restoration', 'tmdl-epa', 'disclaimer']),
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
    sections: new Set(['icis', 'perm-status', 'perm-inventory', 'perm-pipeline', 'perm-dmr', 'perm-inspection', 'perm-enforcement', 'perm-general', 'disclaimer']),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'Active grants, SRF management, and financial analytics',
    defaultOverlay: 'risk',
    sections: new Set(['grants', 'fund-active', 'fund-srf', 'fund-pipeline', 'fund-passthrough', 'fund-analytics', 'disclaimer']),
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
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── View Lens ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens];
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>('risk');

  // ── State Data Report Card ──
  const { report: stateReport, isLoading: stateReportLoading } = useStateReport(stateAbbr);

  // ── State-filtered region data ──
  const baseRegions = useMemo(() => generateStateRegionData(stateAbbr), [stateAbbr]);

  // ── Map: topo + projection ──
  const geoData = useMemo(() => {
    try { return getStatesGeoJSON() as any; }
    catch { return null; }
  }, []);

  const leafletGeo = STATE_GEO_LEAFLET[stateAbbr] || { center: [39.8, -98.5] as [number, number], zoom: 4 };

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

  // ── Filtering & sorting ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low' | 'impaired' | 'monitored'>('all');
  const [showMS4, setShowMS4] = useState(false);
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
  const jurisdictions = useMemo(() => getStateMS4Jurisdictions(stateAbbr), [stateAbbr]);
  const ms4Summary = useMemo(() => jurisdictions.length > 0 ? getMS4ComplianceSummary(jurisdictions) : null, [jurisdictions]);

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
        <HeroBanner role="state" onDoubleClick={() => onToggleDevMode?.()}>
            {/* View Lens Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowViewDropdown(!showViewDropdown)}
                className="inline-flex items-center h-8 px-3 text-xs font-medium rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="text-[10px] text-slate-400 mr-1.5">View:</span>
                {lens.label}
                <span className="ml-1.5 text-slate-400">▾</span>
              </button>
              {showViewDropdown && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowViewDropdown(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Switch View</span>
                  </div>
                  <div className="p-1.5 max-h-80 overflow-y-auto">
                    {(Object.keys(LENS_CONFIG) as ViewLens[]).map((key) => {
                      const cfg = LENS_CONFIG[key];
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            setViewLens(key);
                            setShowViewDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-md text-xs transition-all flex items-center justify-between ${
                            viewLens === key ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{cfg.label}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{cfg.description}</div>
                          </div>
                          {viewLens === key && <CheckCircle size={14} className="text-blue-600 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
                </>
              )}
            </div>

            {user && (
            <div className="relative">
              <button
                onClick={() => { setShowAccountPanel(!showAccountPanel); setShowViewDropdown(false); }}
                className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-md border bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                {user.name || 'State Regulator'}
                <span className="ml-1.5 text-indigo-400">▾</span>
              </button>

              {showAccountPanel && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountPanel(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-indigo-50 to-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                          <div className="text-[11px] text-slate-500">{user.email || 'state@project-pearl.org'}</div>
                        </div>
                      </div>
                      <button onClick={() => setShowAccountPanel(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Account info */}
                  <div className="px-4 py-3 space-y-2 text-xs border-b border-slate-100">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Role</span>
                      <span className="font-medium text-slate-700">{user.role || 'State'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex-shrink-0">Organization</span>
                      <span className="font-medium text-slate-700 text-right">{user.organization || `${stateName} Department of the Environment`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Access Level</span>
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-50 border-green-200 text-green-700">Full Access</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monitoring</span>
                      <span className="font-medium text-slate-700">{stateName} · {regionData.length.toLocaleString()} waterbodies</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Current View</span>
                      <span className="font-medium text-indigo-600">{lens.label}</span>
                    </div>
                  </div>

                  {/* Account actions */}
                  <div className="px-4 py-2.5 space-y-1">
                    <button
                      onClick={() => { setShowAccountPanel(false); router.push('/account'); }}
                      className="w-full text-left px-3 py-2 rounded-md text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <Shield size={13} className="text-slate-400" />
                      My Account
                    </button>
                    <button
                      onClick={() => { setShowAccountPanel(false); logout(); }}
                      className="w-full text-left px-3 py-2 rounded-md text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                    <span className="text-[10px] text-slate-400">PEARL SCC v1.0 · Session {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                </>
              )}
            </div>
            )}
        </HeroBanner>

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
                    <LeafletMapShell center={leafletGeo.center} zoom={leafletGeo.zoom} maxZoom={12} height="100%" mapKey={stateAbbr}>
                      {/* Waterbody markers — color driven by overlay */}
                      {wbMarkers.map(wb => {
                        const isActive = wb.id === activeDetailId;
                        const markerColor = getMarkerColor(overlay, wb);
                        const baseR = wbMarkers.length > 150 ? 2.5 : wbMarkers.length > 50 ? 3.5 : 4.5;
                        return (
                          <CircleMarker
                            key={wb.id}
                            center={[wb.lat, wb.lon]}
                            radius={isActive ? 8 : baseR}
                            pathOptions={{
                              fillColor: markerColor,
                              color: isActive ? '#1e40af' : '#ffffff',
                              weight: isActive ? 2.5 : wbMarkers.length > 150 ? 0.8 : 1.5,
                              fillOpacity: 0.9,
                            }}
                            eventHandlers={{ click: () => setActiveDetailId(isActive ? null : wb.id) }}
                          >
                            {isActive && <Tooltip permanent direction="top" offset={[0, -8]}>{wb.name}</Tooltip>}
                          </CircleMarker>
                        );
                      })}
                    </LeafletMapShell>
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
            );

            case 'insights': return DS(
        <AIInsightsEngine key={stateAbbr} role="State" stateAbbr={stateAbbr} regionData={regionData as any} />
            );

            case 'detail': return DS(<>
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

        {/* ── Environmental Justice — Census ACS + EPA SDWIS (statewide) + EJScreen (per-waterbody) ── */}
        {activeDetailId && displayData && regionMockData && (
            (() => {
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
                    {/* ALIA relevance */}
                    <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-2 text-cyan-900">
                      <span className="font-bold">🔬 ALIA Relevance:</span> This event demonstrates catastrophic infrastructure failure impact on receiving waters. ALIA's real-time monitoring capability would provide continuous E. coli, nutrient, and pathogen tracking during and after spill events — filling the gap that required UMD researchers and volunteer riverkeepers to manually sample. Continuous deployment at 6 DC Water monitoring sites would provide the 24/7 data regulators and the public need.
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
                  {(agency as any)?.ms4Program || 'NPDES MS4'} · {ms4Summary.inCompliance} compliant · {ms4Summary.issues} needs attention · {ms4Summary.highPearlFit} high ALIA fit
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
                    <div className="text-2xl font-bold text-blue-600">{ms4Summary.highPearlFit}</div>
                    <div className="text-xs text-blue-700">High ALIA Fit</div>
                  </div>
                </div>

                {/* Jurisdiction table */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 font-semibold text-slate-700">Jurisdiction</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-700">Phase</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-700">Compliance Status</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-700 hidden md:table-cell">Population</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-700">ALIA Fit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {jurisdictions.map((j: any, idx: number) => {
                          const statusColor: Record<string, string> = { 'In Compliance': 'bg-emerald-100 text-emerald-800 border-emerald-200', 'Under Review': 'bg-amber-100 text-amber-800 border-amber-200', 'Minor Violations': 'bg-orange-100 text-orange-800 border-orange-200', 'Consent Decree': 'bg-red-100 text-red-800 border-red-200', 'NOV Issued': 'bg-red-200 text-red-900 border-red-300', 'Pending Renewal': 'bg-blue-100 text-blue-800 border-blue-200' };
                          const statusIcon: Record<string, string> = { 'In Compliance': '✅', 'Under Review': '🔍', 'Minor Violations': '⚠️', 'Consent Decree': '⚖️', 'NOV Issued': '🚨', 'Pending Renewal': '🔄' };
                          return (
                            <tr key={idx} className={`hover:bg-slate-50/80 transition-colors ${j.status === 'Consent Decree' || j.status === 'NOV Issued' ? 'bg-red-50/30' : ''}`}>
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
                              <td className="px-3 py-2.5 text-center text-xs text-slate-600 hidden md:table-cell">{j.population > 0 ? j.population.toLocaleString() : '—'}</td>
                              <td className="px-3 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${j.pearlFit === 'high' ? 'bg-blue-100 text-blue-700 border-blue-200' : j.pearlFit === 'medium' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                  {j.pearlFit === 'high' ? '🦪 High' : j.pearlFit === 'medium' ? 'Medium' : 'Low'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ALIA opportunity */}
                {ms4Summary.highPearlFit > 0 && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm font-semibold text-blue-800">🦪 ALIA Deployment Opportunities</div>
                    <p className="text-xs text-blue-700 mt-1">
                      {ms4Summary.highPearlFit} of {ms4Summary.total} jurisdictions rated <strong>High ALIA Fit</strong>
                      {ms4Summary.consentDecrees > 0 && <> — including {ms4Summary.consentDecrees} under consent decree</>}.
                    </p>
                  </div>
                )}

                <div className="text-[10px] text-slate-400 italic">
                  Source: EPA ECHO database, state NPDES program records, consent decree public filings. Compliance status reflects most recent annual report cycle.
                </div>
              </CardContent>
            )}
          </Card>
        ) : null);

            case 'icis': return DS(
        <div id="section-icis">
          <ICISCompliancePanel
            state={stateAbbr}
            compactMode={false}
          />
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
            <CardTitle>State Water Quality Trends</CardTitle>
            <CardDescription>Long-term impairment trends, TMDL progress, and next assessment cycle outlook</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trend KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Impairment Trend', value: '↓ 3.1%', sub: 'vs. prior assessment cycle', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'TMDL Completion', value: '↑ 6.4%', sub: 'approved TMDLs this period', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Permit Renewals', value: '87%', sub: 'on-time renewal rate', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Monitoring Stations', value: '↑ 4.8%', sub: 'new stations added', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
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
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Water Quality Trend Categories</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { category: 'Impaired Waters Trajectory', trend: 'Improving', detail: 'Category 5 listings decreased 3.1% since last cycle. 12 waterbodies delisted after successful restoration.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Nutrient Loading', trend: 'Mixed', detail: 'Phosphorus declining in regulated point sources, but agricultural nonpoint nitrogen still rising in 3 watersheds.', color: 'text-amber-700', bg: 'border-amber-200' },
                  { category: 'TMDL Restoration Progress', trend: 'On Track', detail: '68% of active TMDLs showing measurable pollutant load reductions. 4 watersheds approaching delisting criteria.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'Permit Compliance Rate', trend: 'Stable', detail: '92% of NPDES permittees in compliance. Significant noncompliance actions down 8% year-over-year.', color: 'text-blue-700', bg: 'border-blue-200' },
                  { category: 'Emerging Contaminants', trend: 'Worsening', detail: 'PFAS detections up 22% as monitoring expands. 14 new sites flagged above health advisory levels.', color: 'text-red-700', bg: 'border-red-200' },
                  { category: 'Monitoring Network Growth', trend: 'Expanding', detail: '48 new continuous monitoring stations deployed. Real-time data coverage increased to 64% of priority watersheds.', color: 'text-blue-700', bg: 'border-blue-200' },
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
              Projections based on state 303(d)/305(b) assessment data, TMDL tracking, and NPDES compliance records. Actual values will populate as historical snapshots accumulate.
            </div>
          </CardContent>
        </Card>
            );

            case 'disclaimer': return DS(
              <PlatformDisclaimer />
            );

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
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Action Required
                  </CardTitle>
                  <CardDescription>Items requiring immediate attention from state program staff</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { priority: 'High', item: '3 NPDES permits expiring within 30 days — renewal packages incomplete', color: 'text-red-700 bg-red-50 border-red-200' },
                      { priority: 'High', item: 'EPA Region 3 requesting TMDL progress update by end of week', color: 'text-red-700 bg-red-50 border-red-200' },
                      { priority: 'Medium', item: '2 consent decree milestone reports due next month', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                      { priority: 'Low', item: 'Quarterly monitoring data upload window opens in 5 days', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                    ].map((a, i) => (
                      <div key={i} className={`rounded-lg border p-3 ${a.color}`}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">{a.priority}</Badge>
                          <span className="text-xs">{a.item}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: AI analysis of permit database, EPA correspondence, and program deadlines</p>
                </CardContent>
              </Card>
            );

            case 'briefing-changes': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    What Changed Overnight
                  </CardTitle>
                  <CardDescription>New data, alerts, and status changes since your last session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { time: '2:14 AM', change: 'ATTAINS data refresh: 3 new Category 5 listings added for nutrient impairment' },
                      { time: '3:45 AM', change: 'ECHO enforcement update: 1 new significant non-compliance finding in NPDES universe' },
                      { time: '5:30 AM', change: 'NWIS groundwater data: 2 monitoring wells show declining water table trend' },
                      { time: '6:00 AM', change: 'SDWIS update: MCL exceedance reported at 1 community water system' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
                        <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap mt-0.5">{c.time}</span>
                        <span className="text-xs text-slate-700">{c.change}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, ECHO, SDWIS, USGS NWIS overnight batch updates</p>
                </CardContent>
              </Card>
            );

            case 'briefing-pulse': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Program Pulse
                  </CardTitle>
                  <CardDescription>Key program metrics at a glance</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Permits', value: '342', trend: '+2', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Open Inspections', value: '28', trend: '-3', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                      { label: 'Pending TMDLs', value: '14', trend: '0', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'SRF Utilization', value: '78%', trend: '+5%', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                    ].map(m => (
                      <div key={m.label} className={`rounded-xl border p-4 ${m.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.label}</div>
                        <div className={`text-2xl font-bold ${m.color} mt-1`}>{m.value}</div>
                        <div className="text-[10px] text-slate-500 mt-1">{m.trend} this week</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State permit tracking system, EPA ICIS, SRF loan management</p>
                </CardContent>
              </Card>
            );

            case 'briefing-stakeholder': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-indigo-600" />
                    Stakeholder Watch
                  </CardTitle>
                  <CardDescription>Recent stakeholder activity, public comments, and media mentions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { type: 'Public Comment', detail: 'Draft TMDL for Bear Creek received 14 comments during public notice period', status: 'Review Needed' },
                      { type: 'Media', detail: 'Local news coverage of PFAS detection in 2 community water systems', status: 'Monitoring' },
                      { type: 'Legislative', detail: 'State legislature committee hearing on SRF funding allocation scheduled next week', status: 'Prepare Testimony' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg border border-slate-200 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-[10px]">{s.type}</Badge>
                          <Badge variant="secondary" className="text-[10px]">{s.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-700">{s.detail}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: AI analysis of public notice systems, media monitoring, legislative tracking</p>
                </CardContent>
              </Card>
            );

            // ── Resolution Planner ─────────────────────────────────────────
            case 'resolution-planner': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-cyan-600" />
                    Resolution Plan Workspace
                  </CardTitle>
                  <CardDescription>Build and track restoration plans for impaired waterbodies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Select a waterbody from the map to begin planning</p>
                    <p className="text-xs mt-1">Resolution plans integrate TMDL requirements, BMP options, cost estimates, and implementation timelines</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, state TMDL tracking system, BMP cost database</p>
                </CardContent>
              </Card>
            );

            // ── Policy Tracker sections ────────────────────────────────────
            case 'policy-federal': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-600" />
                    Federal Actions Affecting State
                  </CardTitle>
                  <CardDescription>Recent federal regulatory actions with state program implications</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { action: 'EPA Proposed Rule: PFAS NPDWR', impact: 'May require expanded monitoring at 45+ systems', status: 'Comment Period', date: '2026-03-15' },
                      { action: 'CWA Section 401 Certification Rule Update', impact: 'Changes to state certification timeline requirements', status: 'Final Rule', date: '2026-01-10' },
                      { action: 'WOTUS Definition Update', impact: 'May affect jurisdiction over 200+ state wetland sites', status: 'Proposed', date: '2026-04-01' },
                    ].map((f, i) => (
                      <div key={i} className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-blue-800">{f.action}</span>
                          <Badge variant="outline" className="text-[10px]">{f.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-600">{f.impact}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Target date: {f.date}</p>
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
                    State Regulatory Actions
                  </CardTitle>
                  <CardDescription>Pending and recent state-level regulatory changes</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { action: 'Water Quality Standards Triennial Review', stage: 'Public Comment', impact: 'Revised nutrient criteria for 3 watershed categories' },
                      { action: 'Biosolids Management Regulation Update', stage: 'Draft', impact: 'New PFAS limits for land application' },
                      { action: 'Stormwater General Permit Renewal', stage: 'Under Review', impact: 'Updated MCM requirements for Phase II MS4s' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-teal-800">{s.action}</span>
                          <Badge variant="outline" className="text-[10px]">{s.stage}</Badge>
                        </div>
                        <p className="text-xs text-slate-600">{s.impact}</p>
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
                    EPA Oversight Status
                  </CardTitle>
                  <CardDescription>State program authorization status and EPA review findings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { program: 'NPDES', status: 'Authorized', lastReview: '2024' },
                      { program: 'UIC', status: 'Authorized', lastReview: '2023' },
                      { program: 'SDWA PWS', status: 'Primacy', lastReview: '2024' },
                      { program: 'CWA §401', status: 'Authorized', lastReview: '2023' },
                      { program: 'Biosolids', status: 'Authorized', lastReview: '2022' },
                      { program: 'Wetlands §404', status: 'Federal (USACE)', lastReview: 'N/A' },
                    ].map(p => (
                      <div key={p.program} className="rounded-lg border border-slate-200 p-3 text-center">
                        <div className="text-sm font-bold text-slate-700">{p.program}</div>
                        <Badge variant={p.status === 'Authorized' || p.status === 'Primacy' ? 'default' : 'secondary'} className="text-[10px] mt-1">{p.status}</Badge>
                        <div className="text-[10px] text-slate-400 mt-1">Last review: {p.lastReview}</div>
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
                      { standard: 'PFOS/PFOA', criteria: '≤ 4 ng/L', use: 'Human Health', status: 'Proposed' },
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
                  <div className="text-center py-8 text-slate-400">
                    <Waves className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Select a waterbody to begin assessment</p>
                    <p className="text-xs mt-1">Compare monitoring data against applicable standards and generate assessment decisions</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State monitoring database, EPA ATTAINS, WQX</p>
                </CardContent>
              </Card>
            );

            case 'wq-aqualo': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-teal-600" />
                    Aqua-Lo Integration
                  </CardTitle>
                  <CardDescription>Real-time field sensor data from deployed Aqua-Lo units</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Deployed Units', value: '—', bg: 'bg-teal-50 border-teal-200' },
                      { label: 'Active Streams', value: '—', bg: 'bg-teal-50 border-teal-200' },
                      { label: 'Alerts (24h)', value: '—', bg: 'bg-teal-50 border-teal-200' },
                      { label: 'Data Points', value: '—', bg: 'bg-teal-50 border-teal-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-teal-700 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: Aqua-Lo IoT sensor network (awaiting deployment)</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: WQX, state monitoring network database, USGS NWIS</p>
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

            case 'hab-wildlife': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-emerald-600" />
                    State Wildlife Coordination
                  </CardTitle>
                  <CardDescription>Endangered species, critical habitat, and wildlife agency coordination</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Listed Aquatic Species', value: '23', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Critical Habitat Areas', value: '8', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Active Consultations', value: '5', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State wildlife agency, USFWS IPaC, NatureServe</p>
                </CardContent>
              </Card>
            );

            // ── Agriculture sections ───────────────────────────────────────
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

            // ── Infrastructure sections ────────────────────────────────────
            case 'infra-srf': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-green-600" />
                    SRF Administration
                  </CardTitle>
                  <CardDescription>Clean Water and Drinking Water State Revolving Fund status</CardDescription>
                </CardHeader>
                <CardContent>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State SRF program, EPA CWSRF/DWSRF national data</p>
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
            case 'mon-network': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <RadioTower className="h-5 w-5 text-blue-600" />
                    State Monitoring Network
                  </CardTitle>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State continuous monitoring network, USGS NWIS real-time</p>
                </CardContent>
              </Card>
            );

            // ── Disaster sections ──────────────────────────────────────────
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
                          <Badge variant={inc.severity === 'High' ? 'destructive' : 'default'} className="text-[10px]">{inc.status}</Badge>
                        </div>
                        <p className="text-[10px] text-slate-500">Since {inc.since} · Severity: {inc.severity}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State incident command system, NRC spill reports</p>
                </CardContent>
              </Card>
            );

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

            // ── TMDL sections ──────────────────────────────────────────────
            case 'tmdl-status': return DS(
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
                    {[
                      { label: 'EPA Approved', value: '94', bg: 'bg-green-50 border-green-200' },
                      { label: 'In Development', value: '14', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Backlog', value: '78', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Completion Rate', value: '55%', bg: 'bg-cyan-50 border-cyan-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS TMDL tracking, state TMDL development system</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-303d': return DS(
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
                    {[
                      { label: 'Category 5 Listed', value: '186', bg: 'bg-red-50 border-red-200' },
                      { label: 'New Listings (cycle)', value: '12', bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Delistings (cycle)', value: '8', bg: 'bg-green-50 border-green-200' },
                      { label: 'Vision Priority', value: '42', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, state 303(d) listing database</p>
                </CardContent>
              </Card>
            );

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
                  <div className="text-center py-8 text-slate-400">
                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Select a waterbody with a pending TMDL to begin</p>
                    <p className="text-xs mt-1">Track pollutant source analysis, load allocations, and implementation milestones</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State TMDL development tracker, EPA ATTAINS</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-implementation': return DS(
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
                    {[
                      { label: 'Active Impl. Plans', value: '68', bg: 'bg-green-50 border-green-200' },
                      { label: 'On Track', value: '52', bg: 'bg-green-50 border-green-200' },
                      { label: 'Behind Schedule', value: '12', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Near Delisting', value: '4', bg: 'bg-cyan-50 border-cyan-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State TMDL implementation tracker, EPA Watershed Tracking</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-restoration': return DS(
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
                    {[
                      { label: 'Active Projects', value: '24', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Delisted (5yr)', value: '12', bg: 'bg-green-50 border-green-200' },
                      { label: 'Investment', value: '$28M', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State restoration program, EPA Recovery Potential Screening</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-epa': return DS(
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
                    {[
                      { item: 'EPA-established TMDLs pending state adoption', count: '3', status: 'Action Needed' },
                      { item: 'Consent decree TMDL milestones (next 12 months)', count: '5', status: 'On Track' },
                      { item: 'EPA technical assistance requests', count: '2', status: 'In Progress' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                        <span className="text-xs text-slate-700">{e.item}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-blue-700">{e.count}</span>
                          <Badge variant="outline" className="text-[10px]">{e.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA Region coordination records, consent decree dockets</p>
                </CardContent>
              </Card>
            );

            // ── Scorecard sections ─────────────────────────────────────────
            case 'sc-self-assessment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-600" />
                    State Self-Assessment
                  </CardTitle>
                  <CardDescription>Program performance self-evaluation against state goals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Overall Score', value: 'B+', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Permit Timeliness', value: 'A-', bg: 'bg-green-50 border-green-200' },
                      { label: 'Monitoring Coverage', value: 'B', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Enforcement Resolve', value: 'B-', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-3xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State program performance metrics, EPA GPRA measures</p>
                </CardContent>
              </Card>
            );

            case 'sc-watershed': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-blue-600" />
                    Watershed Scorecards
                  </CardTitle>
                  <CardDescription>Per-watershed health grades and trend indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-400">
                    <Waves className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Watershed scorecards will populate from assessment data</p>
                    <p className="text-xs mt-1">Individual HUC-8 and HUC-12 watershed grades based on impairment, monitoring, and restoration metrics</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, state monitoring database, NHDPlus</p>
                </CardContent>
              </Card>
            );

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
                  <CardDescription>CWA 305(b)/303(d) integrated report development and submission</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Report Cycle', value: '2026', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Assessments Done', value: '78%', bg: 'bg-green-50 border-green-200' },
                      { label: 'EPA Review Status', value: 'Pending', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Public Comment', value: 'Upcoming', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-lg font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
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
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { report: 'Annual NPDES Program Report', due: '2026-03-31', status: 'In Progress' },
                      { report: 'SRF Annual Report', due: '2026-06-30', status: 'Not Started' },
                      { report: 'Drinking Water Program Report', due: '2026-07-01', status: 'Not Started' },
                      { report: 'NPS Annual Report (319)', due: '2026-10-01', status: 'Not Started' },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                        <span className="text-xs font-medium text-slate-700">{r.report}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">Due: {r.due}</span>
                          <Badge variant={r.status === 'In Progress' ? 'default' : 'secondary'} className="text-[10px]">{r.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State regulatory calendar, EPA reporting requirements</p>
                </CardContent>
              </Card>
            );

            case 'rpt-adhoc': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-slate-600" />
                    Ad-Hoc Reports
                  </CardTitle>
                  <CardDescription>Custom report builder for legislative requests and stakeholder inquiries</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Build custom reports from available data</p>
                    <p className="text-xs mt-1">Combine assessment, compliance, monitoring, and enforcement data into formatted reports</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: All integrated state and federal data sources</p>
                </CardContent>
              </Card>
            );

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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State permit tracking system, EPA ICIS-NPDES</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ICIS-NPDES, state permit database</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State permit development workflow system</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ICIS-NPDES DMR data, NetDMR submissions</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State inspection tracking system, EPA ICIS inspections</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State enforcement tracking, EPA ICIS formal actions</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State general permit registration system, EPA ICIS</p>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: USAspending.gov, EPA grant management system</p>
                </CardContent>
              </Card>
            );

            case 'fund-srf': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-blue-600" />
                    SRF Fund Management
                  </CardTitle>
                  <CardDescription>State Revolving Fund capitalization, disbursement, and repayment tracking</CardDescription>
                </CardHeader>
                <CardContent>
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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA CWSRF/DWSRF national data, state SRF program</p>
                </CardContent>
              </Card>
            );

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
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: State financial system, EPA grant performance data, USAspending.gov</p>
                </CardContent>
              </Card>
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

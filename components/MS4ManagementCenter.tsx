'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLensParam } from '@/lib/useLensParam';
import Image from 'next/image';
import { Source, Layer } from 'react-map-gl';
import HeroBanner from './HeroBanner';
import { getStatesGeoJSON, geoToAbbr, STATE_GEO_LEAFLET, FIPS_TO_ABBR as _FIPS, STATE_NAMES as _SN } from '@/lib/mapUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Shield, ChevronDown, ChevronUp, Minus, AlertTriangle, CheckCircle, Search, Filter, Droplets, TrendingUp, BarChart3, Building2, Info, LogOut, FileCheck, Lock, Database, Activity, Eye, Fingerprint, Cpu, FlaskConical, ArrowRight, DollarSign, FileText, Leaf, AlertCircle, Waves, Wrench, ClipboardList, Scale, Heart, Landmark, HardHat, Radio, Gauge, Zap, Network, Banknote, Users, BookOpen, Calendar, Target , ClipboardCheck, Download, FileSpreadsheet, GraduationCap, LayoutDashboard, PieChart, SearchX } from 'lucide-react';
import ResolutionPlanner from '@/components/ResolutionPlanner';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { useRouter } from 'next/navigation';
import { getRegionById } from '@/lib/regionsConfig';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { useTierFilter } from '@/lib/useTierFilter';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses, COST_PER_UNIT_YEAR } from '@/lib/restorationEngine';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import RestorationPlanner from '@/components/RestorationPlanner';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { getEcoScore, getEcoData } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData, ejScoreLabel } from '@/lib/ejVulnerability';
import { getStateMS4Jurisdictions, getMS4ComplianceSummary, STATE_AUTHORITIES } from '@/lib/stateWaterData';
import { useAuth } from '@/lib/authContext';
import { getRegionMockData, calculateRemovalEfficiency, calculateOverallScore } from '@/lib/mockData';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import BoundaryAlertsDashboard from '@/components/BoundaryAlertsDashboard';
import { EXAMPLE_ALERTS } from '@/lib/example-data';
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
const PeerBenchmarking = dynamic(
  () => import('@/components/PeerBenchmarking').then((mod) => mod.PeerBenchmarking),
  { ssr: false }
);
const RemovalEfficiencyGauge = dynamic(
  () => import('@/components/RemovalEfficiencyGauge').then((mod) => mod.RemovalEfficiencyGauge),
  { ssr: false }
);
const TMDLProgressAndReportGenerator = dynamic(
  () => import('@/components/TMDLProgressAndReportGenerator').then((mod) => mod.TMDLProgressAndReportGenerator),
  { ssr: false }
);
const NutrientCreditsTrading = dynamic(
  () => import('@/components/NutrientCreditsTrading').then((mod) => mod.NutrientCreditsTrading),
  { ssr: false }
);
const ComplianceEconomics = dynamic(
  () => import('@/components/ComplianceEconomics').then((mod) => mod.ComplianceEconomics),
  { ssr: false }
);
const DataExportHub = dynamic(
  () => import('@/components/DataExportHub').then((mod) => mod.DataExportHub),
  { ssr: false }
);

import { MS4FineAvoidanceCalculator } from '@/components/MS4FineAvoidanceCalculator';
import { BayImpactCounter } from '@/components/BayImpactCounter';
import { ForecastChart } from '@/components/ForecastChart';
import { TrendsChart } from '@/components/TrendsChart';
import { AIInsights } from '@/components/AIInsights';
import { RemovalSummaryCard } from '@/components/RemovalSummaryCard';
import { StormEventTable } from '@/components/StormEventTable';
import { StormDetectionBanner } from '@/components/StormDetectionBanner';
import { WaterQualityAlerts } from '@/components/WaterQualityAlerts';
import { MDEExportTool } from '@/components/MDEExportTool';
import LocationReportCard from '@/components/LocationReportCard';
import { getEpaRegionForState } from '@/lib/epa-regions';
import { WARRZones } from './WARRZones';
import type { WARRMetric } from './WARRZones';

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
  ms4Jurisdiction?: string;  // NPDES permit-based jurisdiction ID (e.g. 'anne_arundel_county') — auto-scopes view
  onSelectRegion?: (regionId: string) => void;
  onToggleDevMode?: () => void;
};

type ViewLens = 'overview' | 'briefing' | 'planner' | 'trends' | 'policy'
  | 'compliance' | 'water-quality' | 'public-health' | 'receiving-waters'
  | 'stormwater-bmps' | 'infrastructure' | 'monitoring' | 'disaster'
  | 'tmdl-compliance' | 'scorecard' | 'reports' | 'mcm-manager' | 'funding';

const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  defaultOverlay: OverlayId;
  sections: Set<string>;
}> = {
  overview: {
    label: 'Overview',
    description: 'Municipal Utility operational dashboard — morning check before the day starts',
    defaultOverlay: 'impairment',
    sections: new Set(['identity', 'operational-health', 'alertfeed', 'map-grid', 'detail', 'top10', 'quick-access', 'quickactions', 'warr-metrics', 'warr-analyze', 'warr-respond', 'warr-resolve', 'disclaimer']),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'AI-generated overnight summary and action items',
    defaultOverlay: 'impairment',
    sections: new Set(['insights', 'briefing-actions', 'briefing-changes', 'briefing-pulse', 'briefing-stakeholder', 'disclaimer']),
  },
  planner: {
    label: 'Resolution Planner',
    description: 'Waterbody-level restoration planning workspace',
    defaultOverlay: 'impairment',
    sections: new Set(['resolution-planner', 'disclaimer']),
  },
  trends: {
    label: 'Trends & Projections',
    description: 'Long-term water quality trends, TMDL progress, and outlook',
    defaultOverlay: 'impairment',
    sections: new Set(['trends-dashboard', 'disclaimer']),
  },
  policy: {
    label: 'Policy Tracker',
    description: 'Federal, state, and EPA regulatory action tracking',
    defaultOverlay: 'impairment',
    sections: new Set(['policy-federal', 'policy-state', 'policy-epa', 'disclaimer']),
  },
  compliance: {
    label: 'Compliance',
    description: 'Permit conditions, enforcement, and drinking water compliance',
    defaultOverlay: 'impairment',
    sections: new Set(['identity', 'detail', 'icis', 'sdwis', 'compliance-permits', 'compliance-assessment', 'compliance-ms4', 'compliance-analytics', 'fineavoidance', 'economics', 'disclaimer']),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'Standards, assessment, station data, and stormwater monitoring',
    defaultOverlay: 'impairment',
    sections: new Set(['detail', 'top10', 'wq-standards', 'wq-assessment', 'wq-stations', 'wq-stormwater', 'disclaimer']),
  },
  'public-health': {
    label: 'Public Health & Contaminants',
    description: 'Contaminant tracking, health coordination, and public advisories',
    defaultOverlay: 'impairment',
    sections: new Set(['sdwis', 'ph-contaminants', 'ph-health-coord', 'ph-advisories', 'disclaimer']),
  },
  'receiving-waters': {
    label: 'Receiving Waters',
    description: 'Receiving water profiles, upstream analysis, and impairment tracking',
    defaultOverlay: 'impairment',
    sections: new Set(['detail', 'rw-map', 'rw-profiles', 'rw-upstream', 'rw-monitoring', 'rw-impairment', 'boundaryalerts', 'disclaimer']),
  },
  'stormwater-bmps': {
    label: 'Stormwater BMPs',
    description: 'BMP inventory, performance analytics, and maintenance scheduling',
    defaultOverlay: 'bmp',
    sections: new Set(['bmp-inventory', 'bmp-details', 'bmp-analytics', 'bmp-maintenance', 'bmp-planning', 'nutrientcredits', 'disclaimer']),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'SRF administration, capital planning, and green infrastructure',
    defaultOverlay: 'impairment',
    sections: new Set(['infra-srf', 'infra-capital', 'infra-construction', 'infra-green', 'disclaimer']),
  },
  monitoring: {
    label: 'Monitoring',
    description: 'Monitoring network, data management, and optimization',
    defaultOverlay: 'coverage',
    sections: new Set(['mon-network', 'mon-data-mgmt', 'mon-optimization', 'mon-continuous', 'stormsim', 'provenance', 'disclaimer']),
  },
  disaster: {
    label: 'Disaster & Emergency Response',
    description: 'Active incidents, spill reporting, and preparedness',
    defaultOverlay: 'impairment',
    sections: new Set(['alertfeed', 'disaster-active', 'disaster-response', 'disaster-spill', 'disaster-prep', 'disclaimer']),
  },
  'tmdl-compliance': {
    label: 'TMDL Compliance',
    description: 'TMDL inventory, pollutant loading, and wasteload allocations',
    defaultOverlay: 'impairment',
    sections: new Set(['detail', 'tmdl-inventory', 'tmdl-loading', 'tmdl-pathways', 'tmdl-docs', 'tmdl-wla', 'disclaimer']),
  },
  scorecard: {
    label: 'Scorecard',
    description: 'Permit compliance scoring, BMP performance, and peer comparison',
    defaultOverlay: 'impairment',
    sections: new Set(['sc-permit-score', 'sc-bmp-performance', 'sc-peer', 'sc-trends', 'disclaimer']),
  },
  reports: {
    label: 'Reports',
    description: 'Annual reports, MDE export, and regulatory filings',
    defaultOverlay: 'impairment',
    sections: new Set(['exporthub', 'rpt-annual', 'rpt-mde-export', 'rpt-regulatory', 'rpt-adhoc', 'mdeexport', 'disclaimer']),
  },
  'mcm-manager': {
    label: 'MCM Program Manager',
    description: 'Minimum Control Measures 1-6 program tracking and compliance',
    defaultOverlay: 'impairment',
    sections: new Set(['mcm-dashboard', 'mcm-1', 'mcm-2', 'mcm-3', 'mcm-4', 'mcm-5', 'mcm-6', 'disclaimer']),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'Active grants, opportunity pipeline, and financial analytics',
    defaultOverlay: 'impairment',
    sections: new Set(['grants', 'fund-active', 'fund-srf', 'infra-capital', 'infra-construction', 'fund-pipeline', 'fund-stormwater', 'fund-analytics', 'disclaimer']),
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

// ─── MS4 View: all panels visible (no lens switching) ─────────────────────────

// ─── Map Overlay: what drives marker colors ──────────────────────────────────

type OverlayId = 'impairment' | 'coverage' | 'bmp' | 'ej';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'impairment', label: 'Local Impairment', description: 'EPA ATTAINS category & severity for your receiving waters', icon: Droplets },
  { id: 'coverage', label: 'Monitoring Coverage', description: 'Data source availability & real-time sensor status', icon: BarChart3 },
  { id: 'bmp', label: 'BMP Performance', description: 'Treatment removal efficiency by waterbody', icon: TrendingUp },
  { id: 'ej', label: 'EJ Vulnerability', description: 'Environmental justice burden from EPA EJScreen', icon: AlertTriangle },
];

function getMarkerColor(overlay: OverlayId, wb: { alertLevel: AlertLevel; status: string; dataSourceCount: number }): string {
  if (overlay === 'impairment') {
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
    // Proxy: high-alert waterbodies likely have poor BMP performance
    return wb.alertLevel === 'high' ? '#ef4444' :
           wb.alertLevel === 'medium' ? '#f59e0b' :
           wb.alertLevel === 'low' ? '#3b82f6' : '#22c55e';
  }
  // ej: severity as proxy for EJ burden (high-severity areas correlate with underserved communities)
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
  maryland_patapsco_lower:   { alertLevel: 'medium', activeAlerts: 2 },
  maryland_patapsco_valley:  { alertLevel: 'low',    activeAlerts: 1 },
  maryland_patapsco_south_branch: { alertLevel: 'low', activeAlerts: 1 },
  // Potomac reaches (upstream to downstream)
  maryland_potomac_williamsport:   { alertLevel: 'low',    activeAlerts: 1 },
  maryland_potomac_point_of_rocks: { alertLevel: 'low',    activeAlerts: 1 },
  maryland_potomac_great_falls:    { alertLevel: 'medium', activeAlerts: 3 },
  maryland_potomac_fort_washington: { alertLevel: 'high',  activeAlerts: 4 },
  maryland_potomac_indian_head:    { alertLevel: 'medium', activeAlerts: 2 },
  maryland_potomac_st_marys:       { alertLevel: 'medium', activeAlerts: 2 },
  virginia_potomac_arlington:      { alertLevel: 'medium', activeAlerts: 2 },
  virginia_potomac_mount_vernon:   { alertLevel: 'medium', activeAlerts: 3 },
  // Patuxent reaches (upstream to downstream)
  maryland_patuxent_savage:        { alertLevel: 'low',    activeAlerts: 1 },
  maryland_patuxent_upper_marlboro: { alertLevel: 'medium', activeAlerts: 2 },
  maryland_patuxent_riva:          { alertLevel: 'medium', activeAlerts: 2 },
  maryland_patuxent_solomons:      { alertLevel: 'low',    activeAlerts: 1 },
  maryland_patuxent_mouth:         { alertLevel: 'low',    activeAlerts: 1 },
  // Gunpowder reaches
  maryland_gunpowder_upper:        { alertLevel: 'low',    activeAlerts: 1 },
  maryland_gunpowder_lower:        { alertLevel: 'low',    activeAlerts: 1 },
  // Chester River reaches
  maryland_chester_south:          { alertLevel: 'medium', activeAlerts: 2 },
  maryland_chester_north:          { alertLevel: 'medium', activeAlerts: 2 },
  // Choptank reaches
  maryland_choptank_lower:         { alertLevel: 'medium', activeAlerts: 2 },
  maryland_choptank_upper:         { alertLevel: 'medium', activeAlerts: 2 },
  maryland_stony_creek:      { alertLevel: 'medium', activeAlerts: 2 },
  maryland_gunpowder:        { alertLevel: 'low',    activeAlerts: 1 },
  maryland_potomac:          { alertLevel: 'high',   activeAlerts: 8 },
  maryland_chester_river:    { alertLevel: 'medium', activeAlerts: 2 },
  maryland_choptank_river:   { alertLevel: 'medium', activeAlerts: 2 },
  maryland_patuxent_river:   { alertLevel: 'medium', activeAlerts: 2 },
  maryland_severn_river:     { alertLevel: 'medium', activeAlerts: 2 },
  maryland_nanticoke_river:  { alertLevel: 'low',    activeAlerts: 1 },
  // Single-jurisdiction MD waterbodies
  maryland_severn:           { alertLevel: 'medium', activeAlerts: 2 },
  maryland_magothy:          { alertLevel: 'low',    activeAlerts: 1 },
  maryland_south_river:      { alertLevel: 'medium', activeAlerts: 2 },
  maryland_middle_river:     { alertLevel: 'medium', activeAlerts: 2 },
  maryland_anacostia:        { alertLevel: 'high',   activeAlerts: 4 },
  maryland_rock_creek:       { alertLevel: 'medium', activeAlerts: 2 },
  maryland_sligo_creek:      { alertLevel: 'medium', activeAlerts: 2 },
  maryland_bush_river:       { alertLevel: 'low',    activeAlerts: 1 },
  maryland_mattawoman:       { alertLevel: 'medium', activeAlerts: 2 },
  maryland_monocacy:         { alertLevel: 'medium', activeAlerts: 2 },
  maryland_liberty_reservoir: { alertLevel: 'low',   activeAlerts: 1 },
  maryland_elk_river:        { alertLevel: 'low',    activeAlerts: 1 },
  maryland_northeast_river:  { alertLevel: 'low',    activeAlerts: 1 },
  maryland_sassafras:        { alertLevel: 'low',    activeAlerts: 1 },
  maryland_miles_river:      { alertLevel: 'medium', activeAlerts: 2 },
  maryland_wicomico_river:   { alertLevel: 'medium', activeAlerts: 2 },
  maryland_antietam:         { alertLevel: 'low',    activeAlerts: 1 },
  // Single-jurisdiction VA waterbodies
  virginia_occoquan:         { alertLevel: 'medium', activeAlerts: 2 },
  virginia_four_mile_run:    { alertLevel: 'medium', activeAlerts: 2 },
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

// ─── MS4 Jurisdiction → Waterbody Mapping ─────────────────────────────────────
// Maps each MS4 permit holder to the waterbody IDs within their stormwater jurisdiction.
// Source: MDE MS4 permit boundaries + ATTAINS waterbody assessment units (AU)
const MS4_JURISDICTION_WATERBODIES: Record<string, {
  name: string;
  permit: string;       // NPDES permit number
  phase: 'Phase I' | 'Phase II';
  waterbodies: string[];
  geo: { center: [number, number]; scale: number };  // Map zoom for jurisdiction
}> = {
  anne_arundel_county:   { name: 'Anne Arundel County', permit: 'MDR068144', phase: 'Phase I',  waterbodies: ['maryland_severn', 'maryland_magothy', 'maryland_patuxent_riva', 'maryland_south_river'], geo: { center: [-76.52, 39.0], scale: 24000 } },
  baltimore_county:      { name: 'Baltimore County',    permit: 'MDR068246', phase: 'Phase I',  waterbodies: ['maryland_back_river', 'maryland_gunpowder_lower', 'maryland_middle_river', 'maryland_patapsco_lower', 'maryland_bear_creek'], geo: { center: [-76.6, 39.4], scale: 22000 } },
  baltimore_city:        { name: 'Baltimore City',      permit: 'MDR068322', phase: 'Phase I',  waterbodies: ['maryland_inner_harbor', 'maryland_middle_branch', 'maryland_gwynns_falls', 'maryland_jones_falls'], geo: { center: [-76.62, 39.3], scale: 45000 } },
  howard_county:         { name: 'Howard County',       permit: 'MDR068365', phase: 'Phase I',  waterbodies: ['maryland_patapsco_valley', 'maryland_patuxent_savage'], geo: { center: [-76.9, 39.2], scale: 28000 } },
  montgomery_county:     { name: 'Montgomery County',   permit: 'MDR068399', phase: 'Phase I',  waterbodies: ['maryland_potomac_great_falls', 'maryland_rock_creek', 'maryland_sligo_creek'], geo: { center: [-77.2, 39.15], scale: 22000 } },
  prince_georges_county: { name: "Prince George's County", permit: 'MDR068284', phase: 'Phase I', waterbodies: ['maryland_patuxent_upper_marlboro', 'maryland_potomac_fort_washington', 'maryland_anacostia'], geo: { center: [-76.8, 38.85], scale: 22000 } },
  harford_county:        { name: 'Harford County',      permit: 'MDR068411', phase: 'Phase I',  waterbodies: ['maryland_gunpowder_upper', 'maryland_bush_river'], geo: { center: [-76.3, 39.55], scale: 22000 } },
  charles_county:        { name: 'Charles County',      permit: 'MDR068438', phase: 'Phase II', waterbodies: ['maryland_potomac_indian_head', 'maryland_mattawoman'], geo: { center: [-77.0, 38.5], scale: 22000 } },
  frederick_county:      { name: 'Frederick County',    permit: 'MDR068446', phase: 'Phase II', waterbodies: ['maryland_monocacy', 'maryland_potomac_point_of_rocks'], geo: { center: [-77.4, 39.45], scale: 18000 } },
  carroll_county:        { name: 'Carroll County',      permit: 'MDR068454', phase: 'Phase II', waterbodies: ['maryland_patapsco_south_branch', 'maryland_liberty_reservoir'], geo: { center: [-77.0, 39.55], scale: 22000 } },
  cecil_county:          { name: 'Cecil County',        permit: 'MDR068462', phase: 'Phase II', waterbodies: ['maryland_elk_river', 'maryland_northeast_river'], geo: { center: [-75.95, 39.55], scale: 22000 } },
  queen_annes_county:    { name: "Queen Anne's County", permit: 'MDR068471', phase: 'Phase II', waterbodies: ['maryland_chester_south'], geo: { center: [-76.1, 39.05], scale: 22000 } },
  kent_county:           { name: 'Kent County',         permit: 'MDR068489', phase: 'Phase II', waterbodies: ['maryland_chester_north', 'maryland_sassafras'], geo: { center: [-76.1, 39.25], scale: 25000 } },
  talbot_county:         { name: 'Talbot County',       permit: 'MDR068497', phase: 'Phase II', waterbodies: ['maryland_choptank_lower', 'maryland_miles_river'], geo: { center: [-76.0, 38.75], scale: 25000 } },
  dorchester_county:     { name: 'Dorchester County',   permit: 'MDR068501', phase: 'Phase II', waterbodies: ['maryland_choptank_upper', 'maryland_nanticoke_river'], geo: { center: [-76.0, 38.5], scale: 20000 } },
  wicomico_county:       { name: 'Wicomico County',     permit: 'MDR068519', phase: 'Phase II', waterbodies: ['maryland_wicomico_river'], geo: { center: [-75.6, 38.35], scale: 25000 } },
  washington_county:     { name: 'Washington County',   permit: 'MDR068527', phase: 'Phase II', waterbodies: ['maryland_potomac_williamsport', 'maryland_antietam'], geo: { center: [-77.7, 39.6], scale: 22000 } },
  calvert_county:        { name: 'Calvert County',      permit: 'MDR068535', phase: 'Phase II', waterbodies: ['maryland_patuxent_solomons'], geo: { center: [-76.55, 38.5], scale: 25000 } },
  st_marys_county:       { name: "St. Mary's County",   permit: 'MDR068543', phase: 'Phase II', waterbodies: ['maryland_potomac_st_marys', 'maryland_patuxent_mouth'], geo: { center: [-76.55, 38.2], scale: 22000 } },
  // Virginia
  fairfax_county:        { name: 'Fairfax County',      permit: 'VAR040057', phase: 'Phase I',  waterbodies: ['virginia_potomac_mount_vernon', 'virginia_occoquan'], geo: { center: [-77.3, 38.85], scale: 28000 } },
  arlington_county:      { name: 'Arlington County',    permit: 'VAR040036', phase: 'Phase II', waterbodies: ['virginia_potomac_arlington', 'virginia_four_mile_run'], geo: { center: [-77.1, 38.88], scale: 55000 } },
  // DC
  dc_water:              { name: 'DC Water / DOEE',     permit: 'DCR000001', phase: 'Phase I',  waterbodies: ['dc_anacostia', 'dc_rock_creek', 'dc_potomac', 'dc_oxon_run', 'dc_watts_branch'], geo: { center: [-77.02, 38.9], scale: 55000 } },
  // PA
  lancaster_city:        { name: 'City of Lancaster',   permit: 'PAI130001', phase: 'Phase II', waterbodies: ['pennsylvania_conestoga'], geo: { center: [-76.3, 40.04], scale: 45000 } },
};

// ─── Precise waterbody coordinates for MS4 jurisdiction map markers ──────────
// Each jurisdiction gets its OWN reach-specific coordinate for shared rivers.
// RULE: If a river appears in >1 jurisdiction, each jurisdiction must use a
// reach-specific ID (e.g., maryland_potomac_great_falls) with its own lat/lon.
// Legacy parent IDs (maryland_potomac, maryland_patuxent) kept for backward compat.
// Source: USGS NHD centroids + EPA ATTAINS Assessment Unit centroids
const WATERBODY_COORDS: Record<string, { lat: number; lon: number }> = {
  // ── MARYLAND ──────────────────────────────────────────────────────────────

  // Potomac River reaches (upstream → downstream, west → southeast)
  maryland_potomac:                 { lat: 39.00, lon: -77.12 },  // legacy fallback
  maryland_potomac_river:           { lat: 39.00, lon: -77.12 },
  maryland_potomac_williamsport:    { lat: 39.60, lon: -77.82 },  // Washington County — Williamsport
  maryland_potomac_point_of_rocks:  { lat: 39.27, lon: -77.54 },  // Frederick County — Point of Rocks
  maryland_potomac_great_falls:     { lat: 39.00, lon: -77.25 },  // Montgomery County — Great Falls
  maryland_potomac_fort_washington: { lat: 38.70, lon: -77.02 },  // Prince George's County — Fort Washington
  maryland_potomac_indian_head:     { lat: 38.60, lon: -77.16 },  // Charles County — Indian Head
  maryland_potomac_st_marys:        { lat: 38.25, lon: -76.50 },  // St. Mary's County — Point Lookout

  // Patuxent River reaches (upstream → downstream, northwest → southeast)
  maryland_patuxent:                { lat: 38.72, lon: -76.54 },  // legacy fallback
  maryland_patuxent_river:          { lat: 38.72, lon: -76.54 },
  maryland_patuxent_savage:         { lat: 39.14, lon: -76.82 },  // Howard County — Savage
  maryland_patuxent_upper_marlboro: { lat: 38.81, lon: -76.75 },  // Prince George's County — Upper Marlboro
  maryland_patuxent_riva:           { lat: 38.95, lon: -76.58 },  // Anne Arundel County — Riva
  maryland_patuxent_solomons:       { lat: 38.33, lon: -76.46 },  // Calvert County — Solomons
  maryland_patuxent_mouth:          { lat: 38.24, lon: -76.44 },  // St. Mary's County — mouth at bay

  // Patapsco River reaches (upstream → downstream, northwest → southeast)
  maryland_patapsco:                { lat: 39.22, lon: -76.60 },  // legacy fallback
  maryland_patapsco_river:          { lat: 39.22, lon: -76.60 },
  maryland_patapsco_south_branch:   { lat: 39.37, lon: -76.97 },  // Carroll County — Sykesville
  maryland_patapsco_valley:         { lat: 39.27, lon: -76.80 },  // Howard County — Ellicott City
  maryland_patapsco_lower:          { lat: 39.22, lon: -76.61 },  // Baltimore County — near harbor

  // Gunpowder Falls reaches
  maryland_gunpowder:               { lat: 39.35, lon: -76.35 },  // legacy fallback
  maryland_gunpowder_falls:         { lat: 39.35, lon: -76.35 },
  maryland_gunpowder_upper:         { lat: 39.48, lon: -76.40 },  // Harford County — Fallston area
  maryland_gunpowder_lower:         { lat: 39.33, lon: -76.35 },  // Baltimore County — Joppa/Chase

  // Chester River reaches
  maryland_chester:                 { lat: 39.10, lon: -76.08 },  // legacy fallback
  maryland_chester_river:           { lat: 39.10, lon: -76.08 },
  maryland_chester_north:           { lat: 39.22, lon: -76.05 },  // Kent County — Chestertown
  maryland_chester_south:           { lat: 39.02, lon: -76.12 },  // Queen Anne's County — Queenstown

  // Choptank River reaches
  maryland_choptank:                { lat: 38.68, lon: -76.08 },  // legacy fallback
  maryland_choptank_river:          { lat: 38.68, lon: -76.08 },
  maryland_choptank_lower:          { lat: 38.75, lon: -76.18 },  // Talbot County — Oxford
  maryland_choptank_upper:          { lat: 38.55, lon: -75.95 },  // Dorchester County — Cambridge

  // Single-jurisdiction MD waterbodies (no reach splitting needed)
  maryland_severn:            { lat: 39.08, lon: -76.53 },
  maryland_severn_river:      { lat: 39.08, lon: -76.53 },
  maryland_magothy:           { lat: 39.10, lon: -76.47 },
  maryland_magothy_river:     { lat: 39.10, lon: -76.47 },
  maryland_south_river:       { lat: 38.95, lon: -76.53 },
  maryland_back_river:        { lat: 39.25, lon: -76.47 },
  maryland_middle_river:      { lat: 39.30, lon: -76.43 },
  maryland_inner_harbor:      { lat: 39.2854, lon: -76.6120 },
  maryland_middle_branch:     { lat: 39.2650, lon: -76.6250 },
  maryland_gwynns_falls:      { lat: 39.28, lon: -76.67 },
  maryland_jones_falls:       { lat: 39.30, lon: -76.61 },
  maryland_bear_creek:        { lat: 39.25, lon: -76.52 },
  maryland_rock_creek:        { lat: 39.05, lon: -77.05 },
  maryland_sligo_creek:       { lat: 39.02, lon: -77.00 },
  maryland_anacostia:         { lat: 38.88, lon: -76.94 },
  maryland_anacostia_river:   { lat: 38.88, lon: -76.94 },
  maryland_bush_river:        { lat: 39.38, lon: -76.13 },
  maryland_mattawoman:        { lat: 38.58, lon: -77.02 },
  maryland_mattawoman_creek:  { lat: 38.58, lon: -77.02 },
  maryland_monocacy:          { lat: 39.40, lon: -77.35 },
  maryland_monocacy_river:    { lat: 39.40, lon: -77.35 },
  maryland_liberty_reservoir:  { lat: 39.42, lon: -76.92 },
  maryland_elk_river:         { lat: 39.52, lon: -75.98 },
  maryland_northeast_river:   { lat: 39.55, lon: -76.02 },
  maryland_sassafras:         { lat: 39.37, lon: -75.95 },
  maryland_sassafras_river:   { lat: 39.37, lon: -75.95 },
  maryland_miles_river:       { lat: 38.78, lon: -76.18 },
  maryland_nanticoke_river:   { lat: 38.45, lon: -75.88 },
  maryland_wicomico_river:    { lat: 38.35, lon: -75.65 },
  maryland_antietam:          { lat: 39.45, lon: -77.73 },
  maryland_antietam_creek:    { lat: 39.45, lon: -77.73 },
  maryland_stony_creek:       { lat: 39.22, lon: -76.58 },

  // ── VIRGINIA ──────────────────────────────────────────────────────────────

  // Potomac reaches (Virginia side)
  virginia_potomac:               { lat: 38.85, lon: -77.25 },  // legacy fallback
  virginia_potomac_arlington:     { lat: 38.88, lon: -77.06 },  // Arlington County — Key Bridge area
  virginia_potomac_mount_vernon:  { lat: 38.72, lon: -77.09 },  // Fairfax County — Mount Vernon
  // Single-jurisdiction VA waterbodies
  virginia_occoquan:          { lat: 38.68, lon: -77.35 },
  virginia_four_mile_run:     { lat: 38.85, lon: -77.10 },
  virginia_elizabeth:         { lat: 36.82, lon: -76.29 },
  virginia_james_lower:       { lat: 37.00, lon: -76.40 },
  virginia_rappahannock:      { lat: 37.60, lon: -76.35 },
  virginia_york:              { lat: 37.24, lon: -76.38 },
  virginia_lynnhaven:         { lat: 36.88, lon: -76.08 },

  // ── DISTRICT OF COLUMBIA ──────────────────────────────────────────────────
  dc_anacostia:       { lat: 38.88, lon: -76.97 },
  dc_rock_creek:      { lat: 38.95, lon: -77.05 },
  dc_potomac:         { lat: 38.90, lon: -77.05 },
  dc_oxon_run:        { lat: 38.83, lon: -76.99 },
  dc_watts_branch:    { lat: 38.89, lon: -76.93 },

  // ── PENNSYLVANIA ──────────────────────────────────────────────────────────
  pennsylvania_conestoga:     { lat: 40.04, lon: -76.30 },
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function MS4ManagementCenter({ stateAbbr, ms4Jurisdiction, onSelectRegion, onToggleDevMode }: Props) {
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const agency = STATE_AGENCIES[stateAbbr] || STATE_AUTHORITIES[stateAbbr] || null;
  const { user, logout, isAdmin } = useAuth();
  const router = useRouter();

  // ── MS4 Jurisdiction Scoping ──
  // Dev override dropdown (temporary — remove when auth is wired)
  const [devJurisdiction, setDevJurisdiction] = useState<string | null>(ms4Jurisdiction || null);
  const resolvedJurisdiction = devJurisdiction || (user as any)?.ms4Jurisdiction || null;
  const jurisdictionMeta = resolvedJurisdiction ? MS4_JURISDICTION_WATERBODIES[resolvedJurisdiction] : null;
  const jurisdictionWaterbodies = jurisdictionMeta?.waterbodies ?? null; // null = show all (state view fallback)

  // Jurisdictions available for current state (for dev dropdown)
  const stateJurisdictions = useMemo(() => {
    return Object.entries(MS4_JURISDICTION_WATERBODIES)
      .filter(([_, v]) => v.permit.startsWith(stateAbbr))
      .map(([key, v]) => ({ key, name: v.name, permit: v.permit, phase: v.phase }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [stateAbbr]);

  // ── Lens switching ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] || LENS_CONFIG.overview;

  // ── View state ──
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>('impairment');

  // ── State-filtered region data ──
  const baseRegions = useMemo(() => generateStateRegionData(stateAbbr), [stateAbbr]);

  // ── Map: GeoJSON + Mapbox ──
  const geoData = useMemo(() => {
    try { return getStatesGeoJSON() as any; }
    catch { return null; }
  }, []);

  // Filter GeoJSON to only the current state for outline rendering
  const stateOutlineGeo = useMemo(() => {
    if (!geoData) return null;
    const filtered = {
      ...geoData,
      features: geoData.features.filter((f: any) => geoToAbbr(f) === stateAbbr),
    };
    return filtered.features.length > 0 ? filtered : null;
  }, [geoData, stateAbbr]);

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

    // Add ATTAINS-only waterbodies not in registry (Cat 4 + Cat 5 — impaired waterbodies)
    const existingNames = new Set(merged.map(r => r.name.toLowerCase().replace(/,.*$/, '').trim()));
    let addedCount = 0;
    for (const a of attainsBulk) {
      const aN = a.name.toLowerCase().trim();
      const alreadyExists = [...existingNames].some(e => e.includes(aN) || aN.includes(e));
      const isImpaired = a.category.includes('5') || a.category.includes('4');
      if (!alreadyExists && isImpaired) {
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
    if (addedCount > 0) console.log(`[SCC] Added ${addedCount} ATTAINS-only Cat 4/5 waterbodies for ${stateAbbr}`);
    return merged;
  }, [baseRegions, attainsBulk, stateAbbr]);

  // ── Jurisdiction-scoped region data (MS4 permit filter) ──
  // ── Resolve coordinates for ALL region data (not just scoped) ──
  // This lets us geo-assign waterbodies to jurisdictions
  const attainsCoordMap = useMemo(() => {
    const m = new Map<string, { lat: number; lon: number }>();
    for (const a of attainsBulk) {
      if (a.lat != null && a.lon != null && a.id) m.set(a.id, { lat: a.lat, lon: a.lon });
      if (a.lat != null && a.lon != null && a.name) m.set(`name:${a.name.toLowerCase().trim()}`, { lat: a.lat, lon: a.lon });
    }
    return m;
  }, [attainsBulk]);

  const allWbCoords = useMemo(() => {
    const resolved: Array<{ id: string; name: string; lat: number; lon: number; alertLevel: AlertLevel; status: string; dataSourceCount: number; regionIdx: number }> = [];
    regionData.forEach((r, idx) => {
      // Priority 1: ATTAINS real centroid
      const byId = attainsCoordMap.get(r.id);
      const byName = !byId ? attainsCoordMap.get(`name:${r.name.toLowerCase().trim()}`) : null;
      const attainsCoord = byId || byName;
      if (attainsCoord) {
        resolved.push({ id: r.id, name: r.name, lat: attainsCoord.lat, lon: attainsCoord.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: idx });
        return;
      }
      // Priority 2: precise jurisdiction waterbody coordinates
      const precise = WATERBODY_COORDS[r.id];
      if (precise) {
        resolved.push({ id: r.id, name: r.name, lat: precise.lat, lon: precise.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: idx });
        return;
      }
      // Priority 3: regionsConfig
      const cfg = getRegionById(r.id) as any;
      if (cfg) {
        const lat = cfg.lat ?? cfg.latitude ?? null;
        const lon = cfg.lon ?? cfg.lng ?? cfg.longitude ?? null;
        if (lat != null && lon != null) {
          resolved.push({ id: r.id, name: r.name, lat, lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: idx });
          return;
        }
      }
      // Priority 4: name-based coordinate resolver
      const approx = resolveWaterbodyCoordinates(r.name, stateAbbr);
      if (approx) {
        resolved.push({ id: r.id, name: r.name, lat: approx.lat, lon: approx.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: idx });
      }
    });
    return resolved;
  }, [regionData, stateAbbr, attainsCoordMap]);

  // ── Geo-assign ALL waterbodies to nearest jurisdiction ──
  // Hand-coded waterbodies are "primary" (always assigned). All others get nearest-center matching.
  const jurisdictionGeoAssignment = useMemo(() => {
    const stateJuris = Object.entries(MS4_JURISDICTION_WATERBODIES)
      .filter(([_, v]) => {
        const prefix = v.permit.substring(0, 2);
        return prefix === stateAbbr || (stateAbbr === 'MD' && (prefix === 'DC' || prefix === 'VA' || prefix === 'PA'));
      })
      .map(([key, v]) => ({ key, center: v.geo.center, primaryIds: new Set(v.waterbodies) }));

    if (stateJuris.length === 0) return new Map<string, Set<string>>();

    // ── Shore classification (MD-specific) ──
    // Prevents cross-Bay assignment: Eastern Shore waterbodies → Eastern Shore jurisdictions only
    const EASTERN_SHORE_JURISDICTIONS = new Set([
      'queen_annes_county', 'kent_county', 'talbot_county',
      'dorchester_county', 'wicomico_county', 'caroline_county',
      'somerset_county',
    ]);
    // Cecil County straddles the head of the Bay — allow it to match either shore
    const SHORE_NEUTRAL = new Set(['cecil_county']);

    // Classify a point as Eastern Shore: east of Bay centerline (-76.42), south of C&D Canal (39.45)
    // Bay centerline varies ~-76.50 (southern) to ~-76.35 (northern) — -76.42 is a good median
    const isEasternShore = (lat: number, lon: number) =>
      stateAbbr === 'MD' && lon > -76.42 && lat < 39.45;

    const isJurisEasternShore = (key: string) => EASTERN_SHORE_JURISDICTIONS.has(key);
    const isJurisShoreNeutral = (key: string) => SHORE_NEUTRAL.has(key);

    // Initialize with hand-coded primaries
    const assignment = new Map<string, Set<string>>();
    for (const j of stateJuris) {
      const ids = new Set(j.primaryIds);
      assignment.set(j.key, ids);
    }

    // Haversine-lite: squared distance, cosine-adjusted longitude
    const dist2 = (lat1: number, lon1: number, lat2: number, lon2: number) =>
      (lat1 - lat2) ** 2 + ((lon1 - lon2) * Math.cos(lat1 * Math.PI / 180)) ** 2;

    const allPrimary = new Set<string>();
    for (const j of stateJuris) {
      for (const id of j.primaryIds) allPrimary.add(id);
    }

    for (const wb of allWbCoords) {
      if (allPrimary.has(wb.id)) continue;

      const wbIsEastern = isEasternShore(wb.lat, wb.lon);

      let nearest = '';
      let nearestDist = Infinity;
      for (const j of stateJuris) {
        // Shore guard: don't assign Eastern Shore waterbodies to Western Shore jurisdictions (and vice versa)
        if (stateAbbr === 'MD' && !isJurisShoreNeutral(j.key)) {
          const jurisIsEastern = isJurisEasternShore(j.key);
          if (wbIsEastern !== jurisIsEastern) continue; // skip cross-Bay match
        }

        const d = dist2(wb.lat, wb.lon, j.center[1], j.center[0]);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = j.key;
        }
      }
      if (nearest) {
        assignment.get(nearest)!.add(wb.id);
      }
    }

    return assignment;
  }, [allWbCoords, stateAbbr]);

  // When an MS4 jurisdiction is set, show ALL waterbodies geo-assigned to it
  const scopedRegionData = useMemo(() => {
    if (!resolvedJurisdiction) return regionData; // No jurisdiction = show all (state-level fallback)

    const assignedIds = jurisdictionGeoAssignment.get(resolvedJurisdiction);
    if (!assignedIds || assignedIds.size === 0) return regionData;

    // Collect matching regionData entries
    const result: typeof regionData = [];
    const matched = new Set<string>();
    for (const r of regionData) {
      if (assignedIds.has(r.id)) {
        result.push(r);
        matched.add(r.id);
      }
    }

    // Synthesize entries for hand-coded reach-specific IDs that aren't in regionData
    // (e.g., maryland_patapsco_south_branch when only maryland_patapsco exists in ATTAINS)
    const primaryIds = jurisdictionMeta?.waterbodies || [];
    for (const wb of primaryIds) {
      if (matched.has(wb)) continue;
      // Try to find a parent entry
      const parent = regionData.find(r => wb.startsWith(r.id + '_') || wb.includes(r.id.replace(/^maryland_|^virginia_|^dc_/, '').replace(/_river$|_creek$/, '')));
      if (parent) {
        const legacyAlert = LEGACY_ALERTS[wb];
        result.push({
          ...parent,
          id: wb,
          name: wb.replace(/^maryland_|^virginia_|^dc_|^pennsylvania_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          ...(legacyAlert ? { alertLevel: legacyAlert.alertLevel, activeAlerts: legacyAlert.activeAlerts } : {}),
        });
        matched.add(wb);
      }
    }

    return result;
  }, [regionData, resolvedJurisdiction, jurisdictionGeoAssignment, jurisdictionMeta]);

  // Waterbody marker coordinates — use pre-resolved coords, filtered to scoped set
  const wbMarkers = useMemo(() => {
    const scopedIds = new Set(scopedRegionData.map(r => r.id));
    // First use allWbCoords (already resolved)
    const fromResolved = allWbCoords.filter(w => scopedIds.has(w.id));
    const resolvedIds = new Set(fromResolved.map(w => w.id));

    // For any scoped entries not in allWbCoords (synthesized reach variants), resolve now
    const extras: typeof fromResolved = [];
    for (const r of scopedRegionData) {
      if (resolvedIds.has(r.id)) continue;
      const precise = WATERBODY_COORDS[r.id];
      if (precise) {
        extras.push({ id: r.id, name: r.name, lat: precise.lat, lon: precise.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: -1 });
      }
    }

    return [...fromResolved, ...extras].map(({ regionIdx, ...rest }) => rest);
  }, [scopedRegionData, allWbCoords]);

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

  // Auto-select first waterbody when jurisdiction is set and no waterbody is active
  useEffect(() => {
    if (jurisdictionMeta && !activeDetailId && scopedRegionData.length > 0) {
      setActiveDetailId(scopedRegionData[0].id);
    }
  }, [jurisdictionMeta, scopedRegionData, activeDetailId]);
  const [showRestorationPlan, setShowRestorationPlan] = useState(true);
  const [showRestorationCard, setShowRestorationCard] = useState(false);
  const [showCostPanel, setShowCostPanel] = useState(false);
  const [alertFeedMinimized, setAlertFeedMinimized] = useState(true);


  const { waterData: rawWaterData, isLoading: waterLoading, hasRealData } = useWaterData(activeDetailId);
  const waterData = useTierFilter(rawWaterData, 'MS4');

  // ── Mock data bridge: supplies removalEfficiencies, stormEvents, displayData to child components ──
  // getRegionMockData only has data for pre-configured demo regions — wrap defensively
  const regionMockData = useMemo(() => {
    if (!activeDetailId) return null;
    try { return getRegionMockData(activeDetailId); } catch { return null; }
  }, [activeDetailId]);
  const influentData = useMemo(() => regionMockData?.influent ?? null, [regionMockData]);
  const effluentData = useMemo(() => regionMockData?.effluent ?? null, [regionMockData]);
  const stormEvents = useMemo(() => regionMockData?.storms ?? [], [regionMockData]);
  const [selectedStormEventId, setSelectedStormEventId] = useState<string>('storm-1');
  const selectedStormEvent = useMemo(() => {
    if (stormEvents.length === 0) return null;
    return stormEvents.find((e: any) => e.id === selectedStormEventId) || stormEvents[0];
  }, [selectedStormEventId, stormEvents]);
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
  const overallScore = useMemo(() => {
    if (!displayData) return 0;
    try { return calculateOverallScore(displayData); } catch { return 0; }
  }, [displayData]);

  const [attainsCache, setAttainsCache] = useState<Record<string, {
    category: string; causes: string[]; causeCount: number; status: string; cycle: string; loading: boolean;
  }>>({});
  const [ejCache, setEjCache] = useState<Record<string, {
    ejIndex: number | null; loading: boolean; error?: string;
  }>>({});
  const [stateSummaryCache, setStateSummaryCache] = useState<Record<string, {
    loading: boolean; impairedPct: number; totalAssessed: number;
  }>>({});

  // Boundary alerts state (seeded with example data for now)
  const [boundaryAlerts, setBoundaryAlerts] = useState(() => EXAMPLE_ALERTS);
  const handleAlertStatusChange = (alertId: string, status: import('@/lib/types').AlertStatus) => {
    setBoundaryAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status } : a));
  };
  const handleAlertAddNote = (alertId: string, note: string) => {
    setBoundaryAlerts(prev => prev.map(a => a.id === alertId ? { ...a, notes: [...a.notes, note] } : a));
  };

  // Fetch per-waterbody ATTAINS when detail opens
  useEffect(() => {
    if (!activeDetailId) return;
    const nccRegion = scopedRegionData.find(r => r.id === activeDetailId);
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
  }, [activeDetailId, scopedRegionData, stateAbbr]);

  // Fetch EJ data when detail opens
  useEffect(() => {
    if (!activeDetailId) return;
    if (ejCache[activeDetailId] && !ejCache[activeDetailId].loading) return;
    setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: true } }));

    const nccRegion = scopedRegionData.find(r => r.id === activeDetailId);
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
  }, [activeDetailId, scopedRegionData]);

  // ── Filtering & sorting ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low' | 'impaired' | 'monitored' | 'primary'>('all');
  const [showMS4, setShowMS4] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [comingSoonId, setComingSoonId] = useState<string | null>(null);

  const sortedRegions = useMemo(() => {
    let filtered = scopedRegionData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(r => r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
    }
    if (filterLevel !== 'all') {
      if (filterLevel === 'impaired') {
        filtered = filtered.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium');
      } else if (filterLevel === 'monitored') {
        filtered = filtered.filter(r => r.status === 'monitored');
      } else if (filterLevel === 'primary') {
        const pSet = new Set(jurisdictionMeta?.waterbodies || []);
        filtered = filtered.filter(r => pSet.has(r.id));
      } else {
        filtered = filtered.filter(r => r.alertLevel === filterLevel);
      }
    }
    const primarySet = new Set(jurisdictionMeta?.waterbodies || []);
    return [...filtered].sort((a, b) => {
      // Primary permit sites sort first
      const aP = primarySet.has(a.id) ? 1 : 0;
      const bP = primarySet.has(b.id) ? 1 : 0;
      if (bP !== aP) return bP - aP;
      return SEVERITY_ORDER[b.alertLevel] - SEVERITY_ORDER[a.alertLevel] || a.name.localeCompare(b.name);
    });
  }, [scopedRegionData, searchQuery, filterLevel, jurisdictionMeta]);

  // ── Summary stats ──
  const stats = useMemo(() => {
    const high = scopedRegionData.filter(r => r.alertLevel === 'high').length;
    const medium = scopedRegionData.filter(r => r.alertLevel === 'medium').length;
    const low = scopedRegionData.filter(r => r.alertLevel === 'low').length;
    const monitored = scopedRegionData.filter(r => r.dataSourceCount > 0).length;
    return { total: scopedRegionData.length, high, medium, low, monitored };
  }, [scopedRegionData]);

  // ── MS4 jurisdictions ──
  const jurisdictions = useMemo(() => getStateMS4Jurisdictions(stateAbbr), [stateAbbr]);
  const ms4Summary = useMemo(() => jurisdictions.length > 0 ? getMS4ComplianceSummary(jurisdictions) : null, [jurisdictions]);

  // ── Hotspots: Top 5 worsening / improving (state-scoped) ──
  const hotspots = useMemo(() => {
    const assessed = scopedRegionData.filter(r => r.status === 'assessed');
    const worsening = [...assessed]
      .sort((a, b) => (SEVERITY_ORDER[b.alertLevel] - SEVERITY_ORDER[a.alertLevel]) || (b.activeAlerts - a.activeAlerts))
      .slice(0, 5);
    const improving = [...assessed]
      .sort((a, b) => (SEVERITY_ORDER[a.alertLevel] - SEVERITY_ORDER[b.alertLevel]) || (a.activeAlerts - b.activeAlerts))
      .slice(0, 5);
    return { worsening, improving };
  }, [scopedRegionData]);

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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ waterbodies: true, ms4: true, provenance: false, potomac: false });
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
        <HeroBanner role="ms4" onDoubleClick={() => onToggleDevMode?.()}>
            {/* DEV: Jurisdiction picker — remove when auth wired */}
            <div className="relative">
              <select
                value={devJurisdiction || ''}
                onChange={(e) => {
                  const val = e.target.value || null;
                  setDevJurisdiction(val);
                  setActiveDetailId(null); // reset waterbody selection on jurisdiction change
                }}
                className="h-8 px-2 pr-6 text-[11px] font-mono rounded-md border border-amber-300 bg-amber-50 text-amber-800 cursor-pointer appearance-none"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath fill=\'%23b45309\' d=\'M6 8L1 3h10z\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
              >
                <option value="">🔧 All {stateName} (dev)</option>
                {stateJurisdictions.map(j => (
                  <option key={j.key} value={j.key}>
                    {j.name} — {j.permit}
                  </option>
                ))}
              </select>
            </div>

            {user && (
            <div className="relative">
              <button
                onClick={() => { setShowAccountPanel(!showAccountPanel); }}
                className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-md border bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
              >
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                {user.name || (jurisdictionMeta ? jurisdictionMeta.name + ' Operator' : 'Municipal Utility')}
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
                      <span className="font-medium text-slate-700">{user.role || 'MS4'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 flex-shrink-0">Organization</span>
                      <span className="font-medium text-slate-700 text-right">{user.organization || (jurisdictionMeta ? jurisdictionMeta.name : `${stateName} MS4 Program`)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Access Level</span>
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-50 border-green-200 text-green-700">Full Access</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Monitoring</span>
                      <span className="font-medium text-slate-700">{stateName} · {scopedRegionData.length.toLocaleString()} waterbodies</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Permit</span>
                      <span className="font-medium text-indigo-600">{jurisdictionMeta?.permit || 'All Jurisdictions'}</span>
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

        <LayoutEditor ccKey="MS4">
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

            case 'identity': return DS((() => {
        if (!jurisdictionMeta) return null;
        const activeAlerts = scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium');
        const severeCount = scopedRegionData.filter(r => r.alertLevel === 'high').length;
        const assessedCount = scopedRegionData.filter(r => r.status === 'assessed').length;
        const impairedCount = scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
        const ejScore = getEJScore(stateAbbr);
        const ejLabel = ejScoreLabel(ejScore);
        const withData = scopedRegionData.filter(r => r.dataSourceCount > 0).length;
        const freshnessLabel = withData > scopedRegionData.length * 0.7 ? 'Current' : withData > scopedRegionData.length * 0.3 ? 'Moderate' : 'Stale';
        const freshnessBg = freshnessLabel === 'Current' ? 'bg-green-100 text-green-700 border-green-200' : freshnessLabel === 'Moderate' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200';
        const complianceStatus = ms4Summary ? (
          jurisdictions.find((j: any) => j.name === jurisdictionMeta.name)?.status || 'Under Review'
        ) : 'Under Review';
        const complianceBg = complianceStatus === 'In Compliance' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
          complianceStatus === 'Consent Decree' || complianceStatus === 'NOV Issued' ? 'bg-red-100 text-red-800 border-red-200' :
          'bg-amber-100 text-amber-800 border-amber-200';
        return (
            <div className="rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {jurisdictionMeta.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-base font-bold text-slate-800">{jurisdictionMeta.name}</div>
                    <div className="text-xs text-slate-500">
                      NPDES Permit: <span className="font-mono font-semibold text-blue-700">{jurisdictionMeta.permit}</span>
                      {' · '}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${jurisdictionMeta.phase === 'Phase I' ? 'bg-indigo-100 text-indigo-700' : 'bg-violet-100 text-violet-700'}`}>{jurisdictionMeta.phase}</span>
                      {' · '}{jurisdictionMeta.waterbodies.length} receiving waterbodies
                    </div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${complianceBg}`}>{complianceStatus}</span>
              </div>

              {/* Compliance snapshot strip */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Active Alerts</div>
                  <div className="text-lg font-bold text-red-600 inline-flex items-center justify-center gap-1">{activeAlerts.length}<ProvenanceIcon metricName="Active Alerts" displayValue={String(activeAlerts.length)} /></div>
                  <div className="text-[10px] text-slate-400">{severeCount > 0 ? `${severeCount} severe` : 'none severe'}</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Impaired</div>
                  <div className="text-lg font-bold text-amber-600 inline-flex items-center justify-center gap-1">{impairedCount}<ProvenanceIcon metricName="Impaired Waterbodies" displayValue={String(impairedCount)} /></div>
                  <div className="text-[10px] text-slate-400">of {scopedRegionData.length} waterbodies</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Assessed</div>
                  <div className="text-lg font-bold text-blue-600 inline-flex items-center justify-center gap-1">{assessedCount}<ProvenanceIcon metricName="Assessed Waterbodies" displayValue={String(assessedCount)} /></div>
                  <div className="text-[10px] text-slate-400">{scopedRegionData.length > 0 ? Math.round(assessedCount / scopedRegionData.length * 100) : 0}% coverage</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Data Freshness</div>
                  <div className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-xs font-bold border ${freshnessBg}`}>{freshnessLabel}</div>
                  <div className="text-[10px] text-slate-400">{withData}/{scopedRegionData.length} with sensors</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">EJ Burden</div>
                  <div className="text-lg font-bold inline-flex items-center justify-center gap-1" style={{ color: ejScore >= 70 ? '#dc2626' : ejScore >= 50 ? '#ea580c' : ejScore >= 30 ? '#d97706' : '#16a34a' }}>{ejScore}/100<ProvenanceIcon metricName="EJ Burden" displayValue={String(ejScore)} unit="/100" /></div>
                  <div className="text-[10px] text-slate-400">{ejLabel}</div>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 text-center">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Waterbodies</div>
                  <div className="text-lg font-bold text-slate-700 inline-flex items-center justify-center gap-1">{scopedRegionData.length}<ProvenanceIcon metricName="Waterbodies" displayValue={String(scopedRegionData.length)} /></div>
                  <div className="text-[10px] text-slate-400">in permit boundary</div>
                </div>
              </div>
            </div>
        );
        })());

            case 'insights': return DS(
              <AIInsightsEngine key={stateAbbr} role="MS4" stateAbbr={stateAbbr} regionData={scopedRegionData as any} />
            );

        case 'warr-metrics': {
          const warrM: WARRMetric[] = [
            { label: 'Permit Compliance', value: '—', icon: Gauge, iconColor: 'var(--status-healthy)', subtitle: 'MS4 permit status' },
            { label: 'BMP Status', value: '—', icon: Shield, iconColor: 'var(--accent-teal)', subtitle: 'Active BMPs tracked' },
            { label: 'Storm Events', value: '—', icon: AlertTriangle, iconColor: 'var(--status-warning)', subtitle: 'Recent storm activity' },
          ];
          return DS(<WARRZones zone="warr-metrics" role="MS4" stateAbbr={stateAbbr} metrics={warrM} events={[]} activeResolutionCount={0} />);
        }
        case 'warr-analyze': return DS(
          <WARRZones zone="warr-analyze" role="MS4" stateAbbr={stateAbbr} metrics={[]} events={[]} activeResolutionCount={0} />
        );
        case 'warr-respond': return DS(
          <WARRZones zone="warr-respond" role="MS4" stateAbbr={stateAbbr} metrics={[]} events={[]} activeResolutionCount={0} />
        );
        case 'warr-resolve': return DS(
          <WARRZones zone="warr-resolve" role="MS4" stateAbbr={stateAbbr} metrics={[]} events={[]} activeResolutionCount={0} onOpenPlanner={() => setViewLens('planner')} />
        );

            case 'quickactions': return DS(
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quick Actions</span>
                {!activeDetailId && <span className="text-[10px] text-slate-400 italic ml-1">Select a waterbody to enable report tools</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!activeDetailId || !displayData}
                  onClick={() => {
                    if (collapsedSections['fineavoidance']) onToggleCollapse('fineavoidance');
                    setTimeout(() => document.getElementById('section-fineavoidance')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Fine Avoidance
                </button>
                <button
                  disabled={!activeDetailId || !regionMockData}
                  onClick={() => {
                    if (collapsedSections['mdeexport']) onToggleCollapse('mdeexport');
                    setTimeout(() => document.getElementById('section-mdeexport')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-cyan-300 bg-white hover:bg-cyan-50 text-cyan-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <FileCheck className="h-3.5 w-3.5" />
                  MDE Annual Report
                </button>
                <button
                  disabled={!activeDetailId || !regionMockData}
                  onClick={() => {
                    if (collapsedSections['tmdl']) onToggleCollapse('tmdl');
                    setTimeout(() => document.getElementById('section-tmdl')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-indigo-300 bg-white hover:bg-indigo-50 text-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  TMDL Compliance
                </button>
                <button
                  disabled={!activeDetailId || !regionMockData}
                  onClick={() => {
                    if (collapsedSections['nutrientcredits']) onToggleCollapse('nutrientcredits');
                    setTimeout(() => document.getElementById('section-nutrientcredits')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-green-300 bg-white hover:bg-green-50 text-green-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  Nutrient Credits
                </button>
                <button
                  disabled={!activeDetailId || !regionMockData || stormEvents.length === 0}
                  onClick={() => {
                    if (collapsedSections['stormsim']) onToggleCollapse('stormsim');
                    setTimeout(() => document.getElementById('section-stormsim')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-amber-300 bg-white hover:bg-amber-50 text-amber-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <Droplets className="h-3.5 w-3.5" />
                  Storm Events
                </button>
                <button
                  disabled={!activeDetailId || !regionMockData}
                  onClick={() => {
                    if (collapsedSections['economics']) onToggleCollapse('economics');
                    setTimeout(() => document.getElementById('section-economics')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  Compliance Economics
                </button>
                <button
                  disabled={!activeDetailId || !displayData}
                  onClick={async () => {
                    if (!displayData) return;
                    try {
                      const pdf = new BrandedPDFGenerator('portrait');
                      await pdf.loadLogo();
                      pdf.initialize();

                      // Sanitize text for jsPDF
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

                      const wbName = activeDetailId?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Unknown';
                      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

                      // Water quality scores
                      const p = displayData.parameters;
                      const doScore = Math.min(100, Math.round((p.DO.value / 9) * 100));
                      const turbScore = Math.max(0, Math.round(100 - (p.turbidity.value / 50) * 100));
                      const tnScore = Math.max(0, Math.round(100 - (p.TN.value / 1.5) * 100));
                      const tpScore = Math.max(0, Math.round(100 - (p.TP.value / 0.15) * 100));
                      const tssScore = Math.max(0, Math.round(100 - (p.TSS.value / 100) * 100));
                      const waterQuality = Math.round((doScore * 2 + turbScore + tnScore + tpScore + tssScore) / 6);

                      // Load reduction scores
                      const tssEff = Math.min(100, Math.round(removalEfficiencies.TSS || 0));
                      const tnEff = Math.min(100, Math.round(removalEfficiencies.TN || 0));
                      const tpEff = Math.min(100, Math.round(removalEfficiencies.TP || 0));
                      const turbEff = Math.min(100, Math.round(removalEfficiencies.turbidity || 0));
                      const loadReduction = Math.round((tssEff * 1.5 + tnEff + tpEff + turbEff) / 4.5);

                      // Ecosystem health
                      const doEco = p.DO.value >= 6 ? 100 : p.DO.value >= 4 ? 60 : 20;
                      const tnEco = p.TN.value <= 0.8 ? 100 : p.TN.value <= 1.5 ? 65 : 30;
                      const tpEco = p.TP.value <= 0.05 ? 100 : p.TP.value <= 0.15 ? 65 : 25;
                      const ecosystemHealth = Math.round((doEco + tnEco + tpEco) / 3);
                      const overallESG = Math.round(waterQuality * 0.35 + loadReduction * 0.40 + ecosystemHealth * 0.25);

                      // Grade helper
                      const grade = (score: number) => score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

                      // ─── Title ───
                      pdf.addTitle('ESG Summary Report');
                      pdf.addText(clean(`${wbName}, ${stateName} -- ${ms4Jurisdiction || 'MS4 Jurisdiction'}`), { bold: true, fontSize: 12 });
                      pdf.addText(`Generated ${dateStr}`, { fontSize: 9 });
                      pdf.addSpacer(5);

                      // ─── Overall ESG Score ───
                      pdf.addSubtitle('Overall ESG Score');
                      pdf.addDivider();
                      pdf.addTable(
                        ['Pillar', 'Score', 'Grade', 'Weight'],
                        [
                          ['ENVIRONMENTAL -- Water Quality', `${waterQuality}/100`, grade(waterQuality), '35%'],
                          ['ENVIRONMENTAL -- Load Reduction', `${loadReduction}/100`, grade(loadReduction), '40%'],
                          ['ENVIRONMENTAL -- Ecosystem Health', `${ecosystemHealth}/100`, grade(ecosystemHealth), '25%'],
                          ['OVERALL ESG SCORE', `${overallESG}/100`, grade(overallESG), '100%'],
                        ]
                      );
                      pdf.addSpacer(5);

                      // ─── Environmental Pillar ───
                      pdf.addSubtitle('Environmental Pillar -- Water Quality');
                      pdf.addDivider();
                      pdf.addTable(
                        ['Parameter', 'Current Value', 'Score', 'Status'],
                        [
                          ['Dissolved Oxygen', `${p.DO.value.toFixed(1)} mg/L`, `${doScore}/100`, p.DO.value >= 5 ? 'Good' : 'Concern'],
                          ['Turbidity', `${p.turbidity.value.toFixed(1)} NTU`, `${turbScore}/100`, p.turbidity.value <= 10 ? 'Good' : 'Elevated'],
                          ['Total Nitrogen', `${p.TN.value.toFixed(2)} mg/L`, `${tnScore}/100`, p.TN.value <= 0.8 ? 'Good' : 'Elevated'],
                          ['Total Phosphorus', `${p.TP.value.toFixed(3)} mg/L`, `${tpScore}/100`, p.TP.value <= 0.05 ? 'Good' : 'Elevated'],
                          ['Total Suspended Solids', `${p.TSS.value.toFixed(1)} mg/L`, `${tssScore}/100`, p.TSS.value <= 25 ? 'Good' : 'Elevated'],
                        ]
                      );
                      pdf.addSpacer(5);

                      // ─── Environmental Pillar — Treatment Performance ───
                      pdf.addSubtitle('Environmental Pillar -- Treatment Performance');
                      pdf.addDivider();
                      pdf.addTable(
                        ['Parameter', 'Removal Efficiency', 'Score'],
                        [
                          ['TSS Removal', `${tssEff}%`, `${tssEff}/100`],
                          ['TN Removal', `${tnEff}%`, `${tnEff}/100`],
                          ['TP Removal', `${tpEff}%`, `${tpEff}/100`],
                          ['Turbidity Removal', `${turbEff}%`, `${turbEff}/100`],
                          ['Composite Load Reduction', '--', `${loadReduction}/100`],
                        ]
                      );
                      pdf.addSpacer(5);

                      // ─── Environmental Pillar — Ecosystem Health ───
                      pdf.addSubtitle('Environmental Pillar -- Ecosystem Health');
                      pdf.addDivider();
                      pdf.addTable(
                        ['Indicator', 'Threshold', 'Current', 'Score'],
                        [
                          ['Dissolved Oxygen', '>= 6.0 mg/L', `${p.DO.value.toFixed(1)} mg/L`, `${doEco}/100`],
                          ['Nitrogen Stress', '<= 0.8 mg/L', `${p.TN.value.toFixed(2)} mg/L`, `${tnEco}/100`],
                          ['Phosphorus Stress', '<= 0.05 mg/L', `${p.TP.value.toFixed(3)} mg/L`, `${tpEco}/100`],
                          ['Composite Ecosystem Health', '--', '--', `${ecosystemHealth}/100`],
                        ]
                      );
                      pdf.addSpacer(5);

                      // ─── Social Pillar ───
                      pdf.addSubtitle('Social Pillar');
                      pdf.addDivider();
                      pdf.addText('Community & Environmental Justice', { bold: true });
                      pdf.addText('- Stormwater treatment reduces pollutant exposure in downstream communities.', { indent: 5 });
                      pdf.addText('- Nature-based infrastructure (oyster biofiltration) provides ecosystem co-benefits.', { indent: 5 });
                      pdf.addText('- Real-time monitoring data supports public transparency and community engagement.', { indent: 5 });
                      pdf.addText('- EJ burden scores available per waterbody via EPA EJScreen integration.', { indent: 5 });
                      pdf.addSpacer(5);

                      // ─── Governance Pillar ───
                      pdf.addSubtitle('Governance Pillar');
                      pdf.addDivider();
                      pdf.addText('Compliance & Transparency', { bold: true });
                      pdf.addText('- Continuous monitoring (15-min intervals) exceeds traditional grab sampling requirements.', { indent: 5 });
                      pdf.addText('- NIST-traceable sensor calibration with documented chain of custody.', { indent: 5 });
                      pdf.addText('- Automated MDE annual report generation from verified field data.', { indent: 5 });
                      pdf.addText('- Audit-ready data provenance: sensor -> telemetry -> QA/QC -> archive.', { indent: 5 });
                      pdf.addSpacer(3);
                      pdf.addText('Financial Stewardship', { bold: true });
                      pdf.addText('- Compliance cost avoidance through proactive monitoring and early alert systems.', { indent: 5 });
                      pdf.addText('- Grant-eligible nature-based infrastructure reduces capital burden.', { indent: 5 });
                      pdf.addText('- Nutrient credit generation provides additional revenue pathway.', { indent: 5 });
                      pdf.addSpacer(5);

                      // ─── Framework Alignment ───
                      pdf.addSubtitle('ESG Framework Alignment');
                      pdf.addDivider();
                      pdf.addTable(
                        ['Framework', 'Relevant Standards', 'PIN Coverage'],
                        [
                          ['GRI', 'GRI 303: Water & Effluents, GRI 304: Biodiversity', 'Partial -- water quality metrics mapped'],
                          ['SASB', 'Water Management, Ecological Impacts', 'Partial -- treatment performance data'],
                          ['CDP Water', 'W1-W4: Current State, Impacts, Procedures, Risk', 'Partial -- monitoring and risk data'],
                          ['TCFD', 'Physical Risk (water stress), Metrics & Targets', 'Partial -- watershed risk scores'],
                          ['TNFD', 'Freshwater dependencies, Nature-related risk', 'Early -- ecosystem health metrics'],
                        ]
                      );
                      pdf.addSpacer(5);

                      // ─── Disclaimer ───
                      pdf.addText('DISCLAIMER', { bold: true, fontSize: 8 });
                      pdf.addText('This ESG summary is generated from PEARL platform data and publicly available EPA datasets. Scores are calculated from real-time water quality measurements and treatment performance metrics. This report is intended for informational purposes and does not constitute a formal ESG audit or rating. Framework alignment is voluntary and approximate.', { fontSize: 8 });
                      pdf.addSpacer(3);
                      pdf.addText('Contact: info@project-pearl.org | project-pearl.org', { bold: true });

                      const safeName = wbName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40);
                      pdf.download(`PEARL_ESG_Summary_${safeName}_${stateAbbr}.pdf`);
                    } catch (err) {
                      console.error('ESG PDF generation failed:', err);
                      alert('ESG PDF generation failed. Check console for details.');
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border-2 border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <Leaf className="h-3.5 w-3.5" />
                  ESG Summary
                </button>
              </div>
            </div>
        );

            case 'alertfeed': return DS((() => {
          const alertRegions = scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium');
          if (alertRegions.length === 0) return null;
          const criticalCount = alertRegions.filter(r => r.alertLevel === 'high').length;
          return (
            <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 shadow-sm overflow-hidden">
              <div className={`flex items-center justify-between px-4 py-3 ${alertFeedMinimized ? '' : 'border-b border-orange-200'} bg-orange-50`}>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                  </span>
                  <span className="text-sm font-bold text-orange-900">
                    {jurisdictionMeta ? `${jurisdictionMeta.name} Alert Feed` : `Statewide Alert Feed — ${stateName} Watershed Network`}
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
              <CardTitle>{jurisdictionMeta ? jurisdictionMeta.name : stateName} Monitoring Network</CardTitle>
              <CardDescription>
                {jurisdictionMeta
                  ? `Permit ${jurisdictionMeta.permit} · ${jurisdictionMeta.waterbodies.length} primary sites + ${Math.max(0, scopedRegionData.length - jurisdictionMeta.waterbodies.length)} ATTAINS-assessed waterbodies within boundaries`
                  : 'Real state outlines. Colors reflect data based on selected overlay.'}
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
                    <span>{jurisdictionMeta ? jurisdictionMeta.name : stateName} · {scopedRegionData.length} waterbodies monitored</span>
                    {attainsBulkLoaded && <span className="text-green-600 font-medium">● ATTAINS live</span>}
                  </div>
                  <div className="h-[480px] w-full relative">
                    <MapboxMapShell
                      center={leafletGeo.center}
                      zoom={leafletGeo.zoom}
                      height="100%"
                      mapKey={stateAbbr}
                      interactiveLayerIds={['ms4-markers']}
                      onMouseMove={onMarkerMouseMove}
                      onMouseLeave={onMarkerMouseLeave}
                    >
                      {/* State outline */}
                      {stateOutlineGeo && (
                        <Source id={`ms4-outline-${stateAbbr}`} type="geojson" data={stateOutlineGeo}>
                          <Layer
                            id={`ms4-outline-fill-${stateAbbr}`}
                            type="fill"
                            paint={{ 'fill-color': '#e2e8f0', 'fill-opacity': 0.15 }}
                          />
                          <Layer
                            id={`ms4-outline-line-${stateAbbr}`}
                            type="line"
                            paint={{ 'line-color': '#94a3b8', 'line-width': 2 }}
                          />
                        </Source>
                      )}
                      {/* Waterbody markers — color driven by overlay */}
                      <MapboxMarkers
                        data={markerData}
                        layerId="ms4-markers"
                        radius={wbMarkers.length > 150 ? 3 : wbMarkers.length > 50 ? 4 : 5}
                        hoveredFeature={hoveredFeature}
                      />
                    </MapboxMapShell>
                  </div>
                  {/* Dynamic Legend */}
                  <div className="flex flex-wrap gap-2 p-3 text-xs bg-slate-50 border-t border-slate-200">
                    {overlay === 'impairment' && (
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
                        <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Excellent ≥80%</Badge>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">Good ≥60%</Badge>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Fair ≥40%</Badge>
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
                    <span>{jurisdictionMeta ? jurisdictionMeta.name : stateName}</span>
                  </CardTitle>
                  <CardDescription>{jurisdictionMeta ? `${jurisdictionMeta.phase} MS4 permit area` : 'Waterbody monitoring summary'}</CardDescription>
                </div>
                {/* State Grade Circle */}
                {(() => {
                  const assessed = scopedRegionData.filter(r => r.status === 'assessed');
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
                  <div className="text-lg font-bold text-slate-800">{scopedRegionData.length}</div>
                  <div className="text-[10px] text-slate-500">Total</div>
                </div>
                <div className="rounded-lg bg-green-50 p-2">
                  <div className="text-lg font-bold text-green-700">{scopedRegionData.filter(r => r.status === 'assessed').length}</div>
                  <div className="text-[10px] text-slate-500">Assessed</div>
                </div>
                <div className="rounded-lg bg-blue-50 p-2">
                  <div className="text-lg font-bold text-blue-600">{scopedRegionData.filter(r => r.status === 'monitored').length}</div>
                  <div className="text-[10px] text-slate-500">Monitored</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-lg font-bold text-slate-400">{scopedRegionData.filter(r => r.status === 'unmonitored').length}</div>
                  <div className="text-[10px] text-slate-500">No Data</div>
                </div>
              </div>

              {/* Filter pills — matching NCC tabs */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(([
                  { key: 'all', label: 'All', color: 'bg-slate-100 text-slate-700 border-slate-200' },
                  ...(jurisdictionMeta ? [{ key: 'primary', label: `Permit Sites (${jurisdictionMeta.waterbodies.length})`, color: 'bg-cyan-100 text-cyan-700 border-cyan-200' }] : []),
                  { key: 'impaired', label: 'Impaired', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                  { key: 'high', label: 'Severe', color: 'bg-red-100 text-red-700 border-red-200' },
                  { key: 'monitored', label: 'Monitored', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                ] as Array<{ key: string; label: string; color: string }>)).map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setFilterLevel(f.key as any); setShowAll(false); }}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all ${
                      filterLevel === f.key
                        ? f.color + ' ring-1 ring-offset-1 shadow-sm'
                        : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                    {f.key !== 'all' && f.key !== 'primary' && (() => {
                      const count = f.key === 'impaired'
                        ? scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length
                        : f.key === 'high'
                        ? scopedRegionData.filter(r => r.alertLevel === 'high').length
                        : scopedRegionData.filter(r => r.status === 'monitored').length;
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
                  <div className="text-[10px] text-slate-400 mt-1">{sortedRegions.length} of {scopedRegionData.length} waterbodies</div>
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
                      const isPrimary = jurisdictionMeta?.waterbodies?.includes(r.id) ?? false;
                      return (
                        <div
                          key={r.id}
                          onClick={() => setActiveDetailId(isActive ? null : r.id)}
                          className={`flex items-center justify-between rounded-md border p-2 cursor-pointer transition-colors ${
                            isActive ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`truncate text-sm font-medium ${isActive ? 'text-blue-900' : ''}`}>{r.name}</span>
                              {isPrimary && <span className="flex-shrink-0 px-1 py-0.5 rounded text-[9px] font-bold bg-cyan-100 text-cyan-700 border border-cyan-200">PERMIT SITE</span>}
                            </div>
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

            case 'detail': return DS(
        <div className="space-y-4">

            {/* No selection state */}
            {!activeDetailId && (
              <Card className="border-2 border-dashed border-slate-300 bg-white/50">
                <div className="p-6">
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search municipal waterbodies..."
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
              const nccRegion = scopedRegionData.find(r => r.id === activeDetailId);
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
              const nccRegion = scopedRegionData.find(r => r.id === activeDetailId);
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
                        <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Why PIN at {regionName}</div>
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
                            const subject = encodeURIComponent(`PIN Pilot Deployment Request — ${regionName}, ${stateAbbr}`);
                            const body = encodeURIComponent(
                              `PIN Pilot Deployment Request\n` +
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
                          🚀 Deploy PIN Pilot Here
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
                                pearl: 'PIN -- Treatment Accelerator',
                                community: 'COMMUNITY ENGAGEMENT & STEWARDSHIP',
                                regulatory: 'REGULATORY & PLANNING',
                              };

                              // ─── Title ───
                              pdf.addTitle('PIN Deployment Plan');
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
                              pdf.addText(clean(`Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} unit${phase1Units > 1 ? 's' : ''}, ${phase1GPM} GPM)` : `${totalUnits} PIN unit${totalUnits > 1 ? 's' : ''}`} at ${regionName} and begin continuous monitoring within 30 days.`), { indent: 5, bold: true });
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

                              // ─── Why PIN ───
                              pdf.addSubtitle('Why PIN at This Site');
                              pdf.addDivider();
                              for (const b of whyBullets) {
                                pdf.addText(clean(`- ${b.problem}`), { indent: 5, bold: true });
                                pdf.addText(clean(`  -> ${b.solution}.`), { indent: 10 });
                              }
                              pdf.addSpacer(3);

                              // ─── PIN Configuration ───
                              pdf.addSubtitle(`PIN Configuration: ${pearlModel}`);
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
                                  ['Unit Capacity', '50 GPM per PIN unit (4 units per quad)'],
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
                                pdf.addSubtitle(`Impairment Classification -- PIN addresses ${pearlAddressable} of ${totalClassified} (${addressabilityPct}%)`);
                                pdf.addDivider();
                                pdf.addTable(
                                  ['Cause', 'Tier', 'PIN Action'],
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
                              pdf.addText(`This plan combines ${totalBMPs} conventional BMPs and nature-based solutions with PIN accelerated treatment.`);
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
                              pdf.addText(clean(`1. Deploy ${isPhasedDeployment ? `Phase 1 (${phase1Quads} quad${phase1Quads > 1 ? 's' : ''}, ${phase1Units} PIN units, ${phase1GPM} GPM) at highest-priority inflow zone${phase1Quads > 1 ? 's' : ''}` : `${totalUnits} PIN unit${totalUnits > 1 ? 's' : ''}`} within 30 days.`), { indent: 5 });
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
                            <div className="text-[10px] font-bold text-green-800 uppercase tracking-wider">PIN Economics -- {regionName}</div>

                            {/* Unit pricing */}
                            <div className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase">PIN Unit Pricing</div>
                              <div className="rounded-md bg-white border border-slate-200 overflow-hidden">
                                <div className="grid grid-cols-[1fr_auto] text-[11px]">
                                  <div className="px-2 py-1.5 bg-slate-100 font-semibold border-b border-slate-200">PIN Unit (50 GPM)</div>
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
                                <div className="text-[9px] text-green-500">of PIN cost offset by reduced spend</div>
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

            case 'icis': return DS(
        <div id="section-icis">
          <ICISCompliancePanel
            state={stateAbbr}
            permitNumber={jurisdictionMeta?.permit}
            compactMode={!!collapsedSections['icis']}
          />
        </div>
      );

            case 'sdwis': return DS(
        <div id="section-sdwis">
          <SDWISCompliancePanel
            state={stateAbbr}
            compactMode={!!collapsedSections['sdwis']}
          />
        </div>
      );

            case 'fineavoidance': return DS((() => {
        if (!activeDetailId || !regionMockData || !displayData) return null;
        return (
            <div id="section-fineavoidance" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('fineavoidance')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">🛡️ MS4 Compliance & Fine Avoidance</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('fineavoidance') && <BrandedPrintBtn sectionId="fineavoidance" title="MS4 Compliance & Fine Avoidance" />}
                  {isSectionOpen('fineavoidance') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {isSectionOpen('fineavoidance') && (
                <div className="p-4">
                  <MS4FineAvoidanceCalculator
                    data={displayData as any}
                    removalEfficiencies={removalEfficiencies as any}
                    regionId={activeDetailId}
                    stormEventsMonitored={stormEvents.length}
                  />
                </div>
              )}
            </div>
        );
        })());

            case 'boundaryalerts': return DS(
        <div id="section-boundaryalerts">
          <BoundaryAlertsDashboard
            alerts={boundaryAlerts}
            permitteeName={jurisdictionMeta?.name || 'Your Jurisdiction'}
            onStatusChange={handleAlertStatusChange}
            onAddNote={handleAlertAddNote}
          />
        </div>
      );

            case 'mdeexport': return DS((() => {
        if (!activeDetailId || !regionMockData || !displayData) return null;
        const nccRegion = scopedRegionData.find(r => r.id === activeDetailId);
        const regionConfig = getRegionById(activeDetailId);
        const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ');
        return (
            <div id="section-mdeexport" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('mdeexport')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">📄 MDE Compliance Report — {regionName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('mdeexport') && <BrandedPrintBtn sectionId="mdeexport" title={`MDE Compliance Report — ${regionName}`} />}
                  {isSectionOpen('mdeexport') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {isSectionOpen('mdeexport') && (
                <div className="p-4">
                  <MDEExportTool
                    data={displayData}
                    removalEfficiencies={removalEfficiencies}
                    regionId={activeDetailId}
                    regionName={regionName}
                    stormEvents={stormEvents}
                    overallScore={overallScore}
                  />
                </div>
              )}
            </div>
        );
        })());

            case 'tmdl': return DS((() => {
        if (!activeDetailId || !regionMockData) return null;
        const activeAlertCount = scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
        return (
            <div id="section-tmdl" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('tmdl')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">🎯 TMDL Compliance & EJ Impact — {scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('tmdl') && <BrandedPrintBtn sectionId="tmdl" title={`TMDL Compliance & EJ Impact — ${scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId}`} />}
                  {isSectionOpen('tmdl') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {isSectionOpen('tmdl') && (
                <div className="p-4">
                  <TMDLProgressAndReportGenerator
                    regionId={activeDetailId}
                    removalEfficiencies={removalEfficiencies}
                    stormEvents={stormEvents}
                    alertCount={activeAlertCount}
                    overallScore={overallScore}
                    dateRange={{ start: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), end: new Date().toISOString().slice(0, 10) }}
                  />
                </div>
              )}
            </div>
        );
        })());

            case 'nutrientcredits': return DS((() => {
        if (!activeDetailId || !regionMockData) return null;
        const wbName = scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId;
        return (
            <div id="section-nutrientcredits" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('nutrientcredits')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">💰 Nutrient Credit Trading — {wbName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('nutrientcredits') && <BrandedPrintBtn sectionId="nutrientcredits" title={`Nutrient Credit Trading — ${wbName}`} />}
                  {isSectionOpen('nutrientcredits') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {isSectionOpen('nutrientcredits') && (
                <div className="p-4">
                  <NutrientCreditsTrading
                    stormEvents={stormEvents}
                    influentData={influentData}
                    effluentData={effluentData}
                    removalEfficiencies={removalEfficiencies}
                    timeRange={{
                      start: new Date(Date.now() - 90 * 86400000),
                      end: new Date()
                    }}
                  />
                </div>
              )}
            </div>
        );
        })());

            case 'stormsim': return DS((() => {
        if (!activeDetailId || stormEvents.length === 0 || !selectedStormEvent) return null;
        const wbName = scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId;
        return (
            <div id="section-stormsim" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('stormsim')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">🌧️ Storm Event BMP Performance — {wbName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('stormsim') && <BrandedPrintBtn sectionId="stormsim" title={`Storm Event BMP Performance — ${wbName}`} />}
                  {isSectionOpen('stormsim') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {isSectionOpen('stormsim') && (
                <div className="p-4 space-y-4">
                  {/* Storm event selector */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-900">Storm Event:</span>
                    </div>
                    <select
                      value={selectedStormEventId}
                      onChange={(e) => setSelectedStormEventId(e.target.value)}
                      className="flex-1 h-9 px-3 text-sm rounded-md border border-blue-300 bg-white text-slate-800"
                    >
                      {stormEvents.map((event: any) => (
                        <option key={event.id} value={event.id}>
                          {event.name} — {event.date?.toLocaleDateString?.() || 'N/A'} ({event.rainfall})
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-2 text-xs">
                      <span className="px-2 py-1 rounded bg-white border border-blue-200 text-blue-800 font-medium">{selectedStormEvent.rainfall}</span>
                      <span className="px-2 py-1 rounded bg-white border border-blue-200 text-blue-800 font-medium">{selectedStormEvent.duration}</span>
                    </div>
                  </div>

                  {/* Compliance context */}
                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800 leading-relaxed">
                      This view supports MS4 permit requirements for BMP performance monitoring and TMDL load reduction documentation during stormwater events. Data demonstrates pollutant removal efficiency from storm runoff entering the BMP (influent) to treated discharge (effluent).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs">
                      <span className="bg-white rounded px-2.5 py-1 border border-blue-200 font-medium text-blue-800">Target: &gt;80% TSS removal</span>
                      <span className="bg-white rounded px-2.5 py-1 border border-blue-200 font-medium text-blue-800">Target: &gt;60% nutrient removal</span>
                      <span className="bg-white rounded px-2.5 py-1 border border-blue-200 font-medium text-blue-800">Compliance: NPDES/MS4 standards</span>
                    </div>
                  </div>

                  {/* Paired Sample Analysis table */}
                  <Card className="border-2 border-blue-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Paired Sample Analysis & % Removal</CardTitle>
                      <CardDescription className="text-xs">
                        Event-specific influent vs effluent comparison for MS4/TMDL reporting — {selectedStormEvent.name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <StormEventTable event={selectedStormEvent} />
                    </CardContent>
                  </Card>

                  {/* BMP Removal Efficiency gauges */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {([
                      { key: 'DO' as const, label: 'Dissolved Oxygen', unit: 'mg/L' },
                      { key: 'turbidity' as const, label: 'Turbidity', unit: 'NTU' },
                      { key: 'TN' as const, label: 'Total Nitrogen', unit: 'mg/L' },
                      { key: 'TP' as const, label: 'Total Phosphorus', unit: 'mg/L' },
                      { key: 'TSS' as const, label: 'Total Suspended Solids', unit: 'mg/L' },
                    ]).map(p => {
                      const eff = selectedStormEvent.removalEfficiencies?.[p.key] ?? 0;
                      const inf = selectedStormEvent.influent?.parameters?.[p.key]?.value ?? 0;
                      const efl = selectedStormEvent.effluent?.parameters?.[p.key]?.value ?? 0;
                      return (
                        <RemovalEfficiencyGauge
                          key={p.key}
                          parameterName={p.label}
                          parameterKey={p.key}
                          influentValue={inf}
                          effluentValue={efl}
                          efficiency={eff}
                          unit={p.unit}
                        />
                      );
                    })}
                  </div>

                  {/* Export actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => {
                        const event = selectedStormEvent;
                        const parameters = ['DO', 'turbidity', 'TN', 'TP', 'TSS'] as const;
                        const rows = [
                          ['STORM EVENT BMP PERFORMANCE REPORT'],
                          [''],
                          ['Event Name', event.name],
                          ['Event Date', event.date?.toLocaleString?.() || 'N/A'],
                          ['Duration', event.duration],
                          ['Total Rainfall', event.rainfall],
                          ['Region', wbName],
                          ['Jurisdiction', jurisdictionMeta?.name || stateName],
                          ['Permit', jurisdictionMeta?.permit || 'N/A'],
                          [''],
                          ['PARAMETER', 'INFLUENT', 'EFFLUENT', 'REDUCTION', '% REMOVAL', 'COMPLIANCE'],
                          ...parameters.map((param) => {
                            const inf = event.influent?.parameters?.[param];
                            const efl = event.effluent?.parameters?.[param];
                            if (!inf || !efl) return [param, 'N/A', 'N/A', 'N/A', 'N/A', 'N/A'];
                            const reduction = Math.abs(inf.value - efl.value);
                            const efficiency = event.removalEfficiencies?.[param] ?? 0;
                            const compliance = efficiency >= 80 ? 'MEETS TARGET (>80%)' : efficiency >= 60 ? 'MARGINAL (60-80%)' : 'BELOW TARGET (<60%)';
                            return [
                              inf.name || param,
                              `${inf.value.toFixed(2)} ${inf.unit}`,
                              `${efl.value.toFixed(2)} ${efl.unit}`,
                              `${reduction.toFixed(2)} ${inf.unit}`,
                              `${efficiency.toFixed(1)}%`,
                              compliance
                            ];
                          }),
                          [''],
                          ['SUMMARY'],
                          ['TSS Removal', `${(event.removalEfficiencies?.TSS ?? 0).toFixed(1)}%`],
                          ['Nutrient Avg (TN+TP)', `${(((event.removalEfficiencies?.TN ?? 0) + (event.removalEfficiencies?.TP ?? 0)) / 2).toFixed(1)}%`],
                          [''],
                          ['REGULATORY COMPLIANCE NOTES'],
                          ['This report supports MS4 permit requirements for BMP performance monitoring.'],
                          ['Data demonstrates stormwater load reduction for TMDL compliance documentation.'],
                          ['Target: >80% TSS removal and >60% nutrient removal per NPDES/MS4 standards.'],
                          ['Report generated', new Date().toLocaleString()],
                          ['Source: PIN Continuous Monitoring Platform | project-pearl.org']
                        ];
                        const csvContent = rows.map(row => Array.isArray(row) ? row.join(',') : row).join('\n');
                        const blob = new Blob([csvContent], { type: 'text/csv' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const safeName = event.name?.replace(/\s+/g, '-') || 'event';
                        const dateStr = event.date?.toISOString?.().split('T')[0] || new Date().toISOString().split('T')[0];
                        a.download = `PEARL_Storm_Report_${safeName}_${dateStr}.csv`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-blue-300 bg-white hover:bg-blue-50 text-blue-800 transition-colors"
                    >
                      <Database className="h-3.5 w-3.5" />
                      Export CSV
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const { BrandedPDFGenerator } = await import('@/lib/brandedPdfGenerator');
                          const pdf = new BrandedPDFGenerator('portrait');
                          await pdf.loadLogo();
                          pdf.initialize();
                          const clean = (s: string) => s.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '').replace(/[\u{FE00}-\u{FE0F}]/gu, '').replace(/[\u{200D}]/gu, '').replace(/[\u{E0020}-\u{E007F}]/gu, '').replace(/\u2014/g, '--').replace(/\u2013/g, '-').replace(/\u2019/g, "'").replace(/\u2018/g, "'").replace(/\u201C/g, '"').replace(/\u201D/g, '"').replace(/[^\x00-\x7F]/g, '').replace(/\s+/g, ' ').trim();
                          const event = selectedStormEvent;
                          pdf.addTitle('Storm Event BMP Performance Report');
                          pdf.addText(clean(`${wbName} -- ${jurisdictionMeta?.name || stateName}`), { bold: true, fontSize: 12 });
                          pdf.addText(clean(`${event.name} | ${event.date?.toLocaleDateString?.() || 'N/A'} | ${event.rainfall} | ${event.duration}`), { fontSize: 9 });
                          if (jurisdictionMeta?.permit) pdf.addText(`NPDES Permit: ${jurisdictionMeta.permit}`, { fontSize: 9 });
                          pdf.addSpacer(5);
                          pdf.addSubtitle('Paired Sample Analysis');
                          pdf.addDivider();
                          const parameters = ['DO', 'turbidity', 'TN', 'TP', 'TSS'] as const;
                          const rows = parameters.map(param => {
                            const inf = event.influent?.parameters?.[param];
                            const efl = event.effluent?.parameters?.[param];
                            if (!inf || !efl) return [param, '--', '--', '--', '--'];
                            const eff = event.removalEfficiencies?.[param] ?? 0;
                            const status = eff >= 80 ? 'PASS' : eff >= 60 ? 'MARGINAL' : 'REVIEW';
                            return [clean(inf.name || param), `${inf.value.toFixed(2)} ${inf.unit}`, `${efl.value.toFixed(2)} ${efl.unit}`, `${eff.toFixed(1)}%`, status];
                          });
                          pdf.addTable(['Parameter', 'Influent', 'Effluent', '% Removal', 'Status'], rows, [40, 30, 30, 25, 25]);
                          pdf.addSpacer(5);
                          pdf.addSubtitle('Summary');
                          pdf.addDivider();
                          const tssEff = event.removalEfficiencies?.TSS ?? 0;
                          const nutAvg = ((event.removalEfficiencies?.TN ?? 0) + (event.removalEfficiencies?.TP ?? 0)) / 2;
                          pdf.addText(`TSS Removal: ${tssEff.toFixed(1)}% ${tssEff >= 80 ? '(MEETS >80% TARGET)' : '(BELOW TARGET)'}`, { fontSize: 10 });
                          pdf.addText(`Nutrient Avg (TN+TP): ${nutAvg.toFixed(1)}% ${nutAvg >= 60 ? '(MEETS >60% TARGET)' : '(BELOW TARGET)'}`, { fontSize: 10 });
                          pdf.addSpacer(5);
                          pdf.addText('This report supports MS4 permit requirements for BMP performance monitoring and TMDL load reduction documentation.', { fontSize: 8 });
                          pdf.addText('Target: >80% TSS removal, >60% nutrient removal per NPDES/MS4 standards.', { fontSize: 8 });
                          pdf.addText('Contact: info@project-pearl.org | project-pearl.org', { bold: true });
                          const safeName = (event.name || 'event').replace(/[^a-zA-Z0-9]/g, '_');
                          pdf.download(`PEARL_Storm_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
                        } catch (err) { console.error('PDF generation failed:', err); }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-cyan-300 bg-white hover:bg-cyan-50 text-cyan-800 transition-colors"
                    >
                      <FileCheck className="h-3.5 w-3.5" />
                      Export PDF
                    </button>
                    <button
                      onClick={() => {
                        const event = selectedStormEvent;
                        const tssEff = event.removalEfficiencies?.TSS ?? 0;
                        const nutAvg = ((event.removalEfficiencies?.TN ?? 0) + (event.removalEfficiencies?.TP ?? 0)) / 2;
                        const subject = encodeURIComponent(`PIN Storm Event Report — ${wbName} — ${event.name}`);
                        const body = encodeURIComponent(
                          `PIN Storm Event BMP Performance Report\n` +
                          `${'='.repeat(45)}\n\n` +
                          `Site: ${wbName}\n` +
                          `Jurisdiction: ${jurisdictionMeta?.name || stateName}\n` +
                          `Permit: ${jurisdictionMeta?.permit || 'N/A'}\n\n` +
                          `Event: ${event.name}\n` +
                          `Date: ${event.date?.toLocaleDateString?.() || 'N/A'}\n` +
                          `Rainfall: ${event.rainfall}\n` +
                          `Duration: ${event.duration}\n\n` +
                          `Results:\n` +
                          `  TSS Removal: ${tssEff.toFixed(1)}% ${tssEff >= 80 ? '(MEETS TARGET)' : '(BELOW TARGET)'}\n` +
                          `  Nutrient Avg: ${nutAvg.toFixed(1)}% ${nutAvg >= 60 ? '(MEETS TARGET)' : '(BELOW TARGET)'}\n\n` +
                          `Full paired sample analysis available in PEARL dashboard.\n` +
                          `Contact: info@project-pearl.org\n`
                        );
                        window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Share via Email
                    </button>
                  </div>
                </div>
              )}
            </div>
        );
        })());

            case 'economics': return DS((() => {
        if (!activeDetailId || !regionMockData) return null;
        const wbName = scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId;
        const tier = jurisdictionMeta?.phase === 'Phase I' ? 'large' as const : 'medium' as const;
        return (
            <div id="section-economics" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => onToggleCollapse('economics')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">💲 Compliance Economics — {jurisdictionMeta?.name || wbName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('economics') && <BrandedPrintBtn sectionId="economics" title={`Compliance Economics — ${jurisdictionMeta?.name || wbName}`} />}
                  {isSectionOpen('economics') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {isSectionOpen('economics') && (
                <div className="p-4">
                  <ComplianceEconomics
                    regionId={activeDetailId}
                    tier={tier}
                    jurisdictionName={jurisdictionMeta?.name}
                    jurisdictionKey={resolvedJurisdiction || undefined}
                  />
                </div>
              )}
            </div>
        );
        })());

            case 'top10': return DS(
        <div id="section-top10" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('top10')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">🔥 Top 5 Worsening / Improving Waterbodies</span>
            <div className="flex items-center gap-1">
              {isSectionOpen('top10') && <BrandedPrintBtn sectionId="top10" title="Top 5 Worsening / Improving Waterbodies" />}
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
                {/* #1 — Potomac River Sewage Spill (pinned, only if jurisdiction covers Potomac) */}
                {stateAbbr === 'MD' && (!jurisdictionWaterbodies || jurisdictionWaterbodies.some(wb => wb.includes('potomac'))) && (
                <div
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
                        onClick={(e) => { e.stopPropagation(); toggleSection('potomac'); }}
                        className="p-0.5 text-red-400 hover:text-red-600 transition-colors"
                        title={expandedSections['potomac'] ? 'Collapse details' : 'Expand details'}
                      >
                        {expandedSections['potomac'] ? <Minus className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                  {expandedSections['potomac'] && (
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
                {hotspots.worsening.slice(0, (stateAbbr === 'MD' && (!jurisdictionWaterbodies || jurisdictionWaterbodies.some(wb => wb.includes('potomac')))) ? 4 : 5).map((region, idx) => (
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
                          {(stateAbbr === 'MD' && (!jurisdictionWaterbodies || jurisdictionWaterbodies.some(wb => wb.includes('potomac')))) ? idx + 2 : idx + 1}
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

            case 'exporthub': return DS(
        <div id="section-exporthub" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('exporthub')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">📦 Data Export Hub</span>
            <div className="flex items-center gap-1">
              {isSectionOpen('exporthub') && <BrandedPrintBtn sectionId="exporthub" title="Data Export Hub" />}
              {isSectionOpen('exporthub') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('exporthub') && (
            <div className="p-4">
              <DataExportHub context="ms4" />
            </div>
          )}
        </div>
        );

            case 'grants': return DS(
        <div id="section-grants" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => onToggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">💰 Grant Opportunities — {stateName}</span>
            <div className="flex items-center gap-1">
              {isSectionOpen('grants') && <BrandedPrintBtn sectionId="grants" title={`Grant Opportunities — ${stateName}`} />}
              {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('grants') && (
            <GrantOpportunityMatcher
              regionId={activeDetailId || `${stateAbbr.toLowerCase()}_statewide`}
              removalEfficiencies={removalEfficiencies as any}
              alertsCount={scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length}
              userRole="State"
              stateAbbr={stateAbbr}
            />
          )}
        </div>
        );

            case 'trends-dashboard': return DS(
        <Card>
          <CardHeader>
            <CardTitle>Stormwater & Compliance Trends</CardTitle>
            <CardDescription>BMP performance trends, inspection cadence, and next permit cycle compliance forecast</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trend KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'BMP Effectiveness', value: '↑ 5.2%', sub: 'avg removal efficiency gain', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Inspection Compliance', value: '94%', sub: 'on-schedule rate', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                { label: 'Violation Trajectory', value: '↓ 12%', sub: 'year-over-year decline', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Nutrient Credit Value', value: '$18.40', sub: 'per lb nitrogen removed', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
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
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Stormwater Management Trends</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { category: 'Stormwater Volume Trends', trend: 'Increasing', detail: 'Impervious surface growth driving 3.8% annual increase in runoff volume. Retrofit projects offsetting 60% of new development.', color: 'text-amber-700', bg: 'border-amber-200' },
                  { category: 'Sediment & Nutrient Loading', trend: 'Improving', detail: 'TSS loads down 8.2% from BMP network expansion. Phosphorus reduction targets 72% met across jurisdiction.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'BMP Performance', trend: 'Stable', detail: 'Bioretention facilities averaging 82% TSS removal. Aging infrastructure requiring maintenance at 15% of sites.', color: 'text-blue-700', bg: 'border-blue-200' },
                  { category: 'Inspection Cadence', trend: 'On Track', detail: '94% of scheduled inspections completed on time. Backlog reduced 23% with mobile inspection tool adoption.', color: 'text-green-700', bg: 'border-green-200' },
                  { category: 'MS4 Permit Cycle', trend: 'Approaching', detail: 'Next permit renewal in 18 months. Draft benchmarks expected to include enhanced nutrient targets and PFAS monitoring.', color: 'text-amber-700', bg: 'border-amber-200' },
                  { category: 'Green Infrastructure', trend: 'Expanding', detail: '42 new GI projects completed this year. Community rain garden program driving 28% of new installations.', color: 'text-green-700', bg: 'border-green-200' },
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
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Next Permit Cycle Compliance Forecast</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { scenario: 'Current Trajectory', impacts: ['BMP network will meet 80% of enhanced nutrient targets', 'Inspection compliance projected to hold above 90%', 'Green infrastructure adoption on pace for 2028 goals'] },
                  { scenario: 'Risk Factors', impacts: ['Intensifying storm events may exceed design capacity at 12% of BMPs', 'PFAS monitoring requirements could strain lab budgets', 'Aging stormwater infrastructure maintenance backlog growing'] },
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
              Projections based on MS4 permit compliance records, BMP monitoring data, and stormwater management plans. Actual values will populate as historical snapshots accumulate.
            </div>
          </CardContent>
        </Card>
            );

            case 'provenance': return DS(
          <Card className="border-2 border-slate-300 bg-gradient-to-br from-slate-50/50 to-white">
            <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection('provenance')}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-slate-700" />
                  Data Provenance & Chain of Custody
                  <Badge variant="outline" className="text-[10px] font-medium border-slate-300 text-slate-600 ml-1">Audit-Ready</Badge>
                </CardTitle>
                {expandedSections.provenance ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
              <CardDescription>
                What {(agency as any)?.division || 'your regulatory authority'} would find in an audit of PIN monitoring data across {stateName}
              </CardDescription>
            </CardHeader>
            {expandedSections.provenance && (
              <CardContent className="space-y-4">

                {/* ── REGULATORY-GRADE MONITORING ── */}
                <div className="rounded-lg border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center">
                      <Cpu className="h-3.5 w-3.5 text-amber-700" />
                    </div>
                    <div className="text-sm font-bold text-amber-900">Regulatory-Grade Monitoring</div>
                  </div>
                  <p className="text-xs text-amber-800">
                    PIN monitoring meets EPA QA/R-5 (Quality Assurance Project Plan) standards and {stateAbbr === 'MD' ? 'MDE' : stateAbbr === 'FL' ? 'FDEP' : stateAbbr === 'VA' ? 'VA DEQ' : (agency as any)?.name?.split(' ')[0] || 'state'} data quality requirements for MS4 permit compliance. All data is traceable, auditable, and defensible.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg border border-amber-200 p-3 space-y-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Data Source</div>
                      <div className="space-y-1.5">
                        {[
                          { label: 'Sensor Platform', value: 'YSI EXO2 / Hach', check: true },
                          { label: `${stateAbbr === 'MD' ? 'MDE' : 'State'} Accredited`, value: stateAbbr === 'MD' ? 'Pending QAPP review' : 'Pending state review', check: false },
                          { label: 'EPA Method', value: 'QAR-5 & ATTM methods', check: true },
                          { label: 'Deployment', value: 'Vessel-mounted continuous', check: true },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{row.label}</span>
                            <span className={`font-medium flex items-center gap-1 ${row.check ? 'text-green-700' : 'text-amber-600'}`}>
                              {row.value}
                              {row.check ? <CheckCircle className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t border-slate-100 pt-2 mt-2">
                        <div className="text-[10px] text-slate-500 font-semibold mb-1">Monitored Parameters & Methods:</div>
                        <div className="text-[10px] text-slate-500 leading-relaxed">
                          Dissolved Oxygen (ASTM D888) · Total Nitrogen (EPA 353.2) · Total Phosphorus (EPA 365.1) · TSS (EPA 160.2) · pH (ASTM D1293/EPA 9040) · Turbidity (EPA 180.1) · Conductivity (ASTM D1125) · Chlorophyll-a (EPA 445.0) · Temperature (ASTM D5386)
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border border-amber-200 p-3 space-y-2">
                      <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Sampling Frequency</div>
                      <div className="space-y-1.5">
                        {[
                          { label: 'Continuous Interval', value: '1 minute' },
                          { label: 'Data Points/Day', value: '1,440 per parameter' },
                          { label: 'Data Points/Year', value: '525,600 per parameter' },
                          { label: 'Storm Event Capture', value: '100% (continuous)' },
                        ].map((row, i) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">{row.label}</span>
                            <span className="font-medium text-slate-800">{row.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-md p-2 mt-2">
                        <div className="text-[10px] text-green-800 font-semibold">vs. Traditional Grab Sampling</div>
                        <div className="text-[10px] text-green-700">
                          MS4 permits typically require 2-4 grab samples → ~16 data points/year.
                          PIN generates <strong>32,850× more data points</strong> with no field crew deployment.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-amber-300 rounded-md p-2.5">
                    <div className="text-[10px] text-amber-900">
                      <strong>Regulatory Compliance:</strong> All sensors meet EPA QA/R-5 quality assurance requirements.
                      PIN sites align with QA GLP classification. Lab &amp; NIST/IEEE 17025 accredited.{' '}
                      <strong>QAPP Status: Submitted for {stateAbbr === 'MD' ? 'MDE Water & Science Administration' : (agency as any)?.division || 'state agency'} review.</strong>
                    </div>
                  </div>
                </div>

                {/* ── QA/QC FRAMEWORK ── */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-blue-600" />
                    <div className="text-sm font-bold text-slate-800">Quality Assurance / Quality Control (QA/QC)</div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { icon: CheckCircle, title: 'Calibration Protocol', color: 'text-blue-600', items: ['Weekly calibration using NIST-traceable standards', 'Pre-deployment verification documented', 'Calibration logs timestamped and archived', 'Automated drift detection: flags anomalies'] },
                      { icon: FlaskConical, title: 'Confirmatory Sampling', color: 'text-blue-600', items: ['Monthly grab samples: validate sensor accuracy', `Independent lab analysis (${stateAbbr === 'MD' ? 'MDE' : 'state'}-certified)`, 'Bi-directional comparison: ±5% tolerance', 'Run correction: if systematic drift > 3% flagged'] },
                      { icon: Activity, title: 'Automated Validation', color: 'text-blue-600', items: ['Range checks: flag outliers outside physical limits', 'Rate of change: detect sensor malfunction', 'Data quality flags: all suspicious data logged', 'Automated resamples: if anomaly detected'] },
                    ].map((col, ci) => (
                      <div key={ci} className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <col.icon className={`h-3 w-3 ${col.color}`} />
                          <div className="text-xs font-semibold text-blue-800">{col.title}</div>
                        </div>
                        <div className="text-[10px] text-slate-600 space-y-0.5">
                          {col.items.map((item, ii) => <div key={ii}>• {item}</div>)}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-md p-2.5">
                    <div className="text-[10px] text-blue-900">
                      <strong>EPA QAPP Compliance:</strong> All QA/QC procedures documented in Quality Assurance Project Plan submitted to {(agency as any)?.division || 'state agency'}. Precision targets: ±5% for nutrients, ±10% for turbidity, ±3% for DO/pH.
                    </div>
                  </div>
                </div>

                {/* ── CHAIN OF CUSTODY & DATA LINEAGE ── */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-violet-600" />
                    <div className="text-sm font-bold text-slate-800">Chain of Custody &amp; Data Lineage</div>
                  </div>

                  <div className="bg-gradient-to-r from-slate-50 to-violet-50 rounded-lg border border-violet-200 p-3">
                    <div className="text-[10px] font-bold text-slate-600 uppercase mb-2">Data Path (Sensor → {(agency as any)?.name?.split(' ').slice(0, 2).join(' ') || 'State Agency'} Report)</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      {[
                        { icon: Cpu, label: 'PIN Sensor', sub: 'YSI EXO2 probe' },
                        { icon: Database, label: 'Data Logger', sub: 'Timestamped + GPS tagged' },
                        { icon: Lock, label: 'Transmission', sub: 'Cellular (encrypted)' },
                        { icon: Database, label: 'Cloud Database', sub: 'AWS (SOC2 lockdown)' },
                        { icon: FileCheck, label: 'QA/QC Engine', sub: 'Validation + flagging' },
                        { icon: Shield, label: `${stateAbbr === 'MD' ? 'MDE' : stateAbbr === 'FL' ? 'FDEP' : 'State'} Dashboard`, sub: 'Regulatory access' },
                      ].map((step, idx, arr) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <div className="flex flex-col items-center bg-white rounded-md border border-violet-200 px-2.5 py-1.5 min-w-[85px]">
                            <step.icon className="h-3.5 w-3.5 text-violet-600 mb-0.5" />
                            <div className="font-semibold text-slate-700 text-center leading-tight">{step.label}</div>
                            <div className="text-[8px] text-slate-400 text-center">{step.sub}</div>
                          </div>
                          {idx < arr.length - 1 && <ArrowRight className="h-3 w-3 text-violet-400 flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Fingerprint className="h-3.5 w-3.5 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-800">Immutable Records</div>
                      </div>
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        <div>• Every data point timestamped to millisecond</div>
                        <div>• Cryptographic hashing for tamper detection</div>
                        <div>• Append-only log: no retroactive edits</div>
                        <div>• Device ID for all data streams</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 text-slate-600" />
                        <div className="text-xs font-semibold text-slate-800">Access Logging</div>
                      </div>
                      <div className="text-[10px] text-slate-600 space-y-0.5">
                        <div>• Every data access logged (who, when, what)</div>
                        <div>• Role-based permissions (MS4, State, Public)</div>
                        <div>• Viewer fingerprints: IP, session, duration</div>
                        <div>• Export logs: who downloaded what, when</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── DATA DEFENSIBILITY COMPARISON ── */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-600" />
                    <div className="text-sm font-bold text-slate-800">Data Defensibility: PIN vs Traditional Grab Sampling</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 font-semibold text-slate-700">Criteria</th>
                          <th className="text-center px-3 py-2 font-semibold text-indigo-700 bg-indigo-50/50">PIN Continuous</th>
                          <th className="text-center px-3 py-2 font-semibold text-slate-500">Traditional Grab</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          ['Data Frequency', '525,600 pts/yr per parameter', '~16 pts/yr'],
                          ['Storm Event Capture', '100% (continuous)', '~10% (depends on staff)'],
                          ['Chain of Custody', 'Automated digital, GPS-tagged', 'Manual paper forms'],
                          ['QA/QC Frequency', 'Real-time + weekly calibration', 'Per sample event (weeks delayed)'],
                          ['Data Availability', 'Immediate (real-time upload)', '1-3 weeks (lab turnaround)'],
                          ['Sensor Drift Detection', 'Automated (hourly checks)', 'Not applicable'],
                          [`${stateAbbr === 'MD' ? 'MDE' : 'State'} Audit Access`, '24/7 portal access', 'Request → wait for municipality'],
                          ['Regulatory Defensibility', '⭐ Higher (continuous, holistic QA/QC)', '✓ Established precedent'],
                        ].map(([criteria, pearl, trad], i) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="px-3 py-2 font-medium text-slate-700">{criteria}</td>
                            <td className="px-3 py-2 text-center text-indigo-700 font-medium bg-indigo-50/30">{pearl}</td>
                            <td className="px-3 py-2 text-center text-slate-500">{trad}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── PHASED REGULATORY ACCEPTANCE PATHWAY ── */}
                <div className="rounded-lg border-2 border-green-200 bg-gradient-to-br from-green-50/30 to-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-700" />
                    <div className="text-sm font-bold text-slate-800">Regulatory Acceptance Pathway: Safe Migration to Continuous Monitoring</div>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { phase: 'Phase 1: Parallel Operation', desc: `PIN runs alongside traditional grab sampling. Side-by-side validation confirms accuracy. No changes to current ${(agency as any)?.ms4Program || 'MS4 permit'} reporting.`, timeline: `Year 1`, goal: 'Prove equivalency', color: 'border-blue-300 bg-blue-50', textColor: 'text-blue-800', dotColor: 'bg-blue-500' },
                      { phase: 'Phase 2: Storm Events & Trend Reporting', desc: `Continuous data becomes primary source for storm event characterization (per 40 CFR §122.26). Traditional grab sampling continues quarterly.`, timeline: `Year 1-2`, goal: 'Primary for storms', color: 'border-emerald-300 bg-emerald-50', textColor: 'text-emerald-800', dotColor: 'bg-emerald-500' },
                      { phase: 'Phase 3: Reduce Grab Frequency', desc: `${stateAbbr === 'MD' ? 'MDE' : 'State'} may accept reduced grab frequency based on PIN's correlation record. Confirmatory sampling validates sensor consistency.`, timeline: `Year 2-3`, goal: 'Correlation proven', color: 'border-green-300 bg-green-50', textColor: 'text-green-800', dotColor: 'bg-green-500' },
                      { phase: 'Phase 4: Primary Data Stream', desc: `PIN serves as primary data with periodic validation sampling for sensor QA/QC. Traditional grab retained for parameters not measured by sensors.`, timeline: `Year 3+`, goal: 'Full continuous', color: 'border-green-400 bg-green-100', textColor: 'text-green-900', dotColor: 'bg-green-600' },
                    ].map((p, i) => (
                      <div key={i} className={`rounded-lg border ${p.color} p-3 space-y-1`}>
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${p.dotColor} flex-shrink-0`} />
                          <div className={`text-xs font-bold ${p.textColor}`}>{p.phase}</div>
                          <Badge variant="outline" className={`text-[9px] ml-auto ${p.textColor} border-current`}>{p.goal}</Badge>
                        </div>
                        <p className="text-[10px] text-slate-600 pl-[18px]">{p.desc}</p>
                        <p className="text-[9px] text-slate-500 pl-[18px] italic">Timeline: {p.timeline}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-2.5">
                    <div className="text-[10px] text-slate-700">
                      <strong>Key Principle:</strong> Each phase maintains {stateAbbr === 'MD' ? 'MDE' : 'state'} compliance through data, not promises. {(agency as any)?.name || 'State regulators'} maintain oversight authority throughout all phases.
                    </div>
                  </div>
                </div>

                {/* ── INDEPENDENT LAB CONFIRMATION ── */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-purple-600" />
                    <div className="text-sm font-bold text-slate-800">Independent Laboratory Confirmation</div>
                  </div>
                  <p className="text-xs text-slate-600">
                    {stateAbbr === 'MD' ? 'MDE requires' : `${stateName} regulations require`} that monitoring data used for permit compliance be analyzed by a {stateAbbr === 'MD' ? 'Maryland' : 'state'}-certified laboratory. PIN addresses this through a structured split-sample program.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {[
                      { value: 'Monthly', label: 'Split samples collected', sub: 'Co-located grab + sensor reading' },
                      { value: 'Certified Lab', label: `${stateAbbr === 'MD' ? 'MDE' : 'State'}-accredited facility`, sub: 'Independent analysis of split samples' },
                      { value: '±5%', label: 'Acceptable variance', sub: 'Sensor vs. lab — triggers recalibration if exceeded' },
                    ].map((tile, i) => (
                      <div key={i} className="rounded-lg border border-purple-100 bg-purple-50/50 p-3 text-center space-y-1">
                        <div className="text-lg font-bold text-purple-700">{tile.value}</div>
                        <div className="text-[10px] text-slate-600 font-medium">{tile.label}</div>
                        <div className="text-[10px] text-slate-500">{tile.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-purple-50 border border-purple-200 rounded-md p-2.5">
                    <div className="text-[10px] text-purple-900">
                      <strong>Audit Trail:</strong> Every split sample generates a paired record — sensor reading + certified lab result — stored with identical timestamps.
                      {stateAbbr === 'MD' ? ' MDE' : ' State'} auditors can query any date range to verify sensor-lab correlation across all sites in {stateName}.
                    </div>
                  </div>
                </div>

                {/* ── STATE-LEVEL FLEET SUMMARY ── */}
                <div className="rounded-lg border-2 border-indigo-200 bg-gradient-to-r from-indigo-50/30 to-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    <div className="text-sm font-bold text-slate-800">{stateName} PIN Fleet — Acceptance Status</div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Aggregate view of phased acceptance progress across all PIN deployments in {stateName}.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Sites', value: scopedRegionData.filter(r => r.status === 'assessed').length > 0 ? '1' : '0', sub: 'PIN deployments', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
                      { label: 'Phase 1 (Parallel)', value: '1', sub: 'Running validation', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Phase 2+ (Accepted)', value: '0', sub: 'Pending Phase 1 completion', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Correlation Score', value: '—', sub: 'Pending first 90-day cycle', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                    ].map((tile, i) => (
                      <div key={i} className={`rounded-lg border ${tile.bg} p-3 text-center`}>
                        <div className={`text-xl font-bold ${tile.color}`}>{tile.value}</div>
                        <div className="text-[10px] font-medium text-slate-700">{tile.label}</div>
                        <div className="text-[9px] text-slate-500">{tile.sub}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 italic">
                    Fleet data updates as PIN deployments complete validation phases. Correlation scores calculated after 90 days of parallel sensor + grab sample data.
                  </div>
                </div>

                {/* ── NUTRIENT CREDIT PATHWAY STATUS ── */}
                {['MD','VA','PA','DE','DC','WV','NY'].includes(stateAbbr) && (
                <div className="rounded-lg border-2 border-teal-200 bg-gradient-to-r from-teal-50/30 to-white p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-teal-600" />
                    <div className="text-sm font-bold text-slate-800">Nutrient Credit Certification Pathway — {stateName}</div>
                    <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-700 ml-auto">Not Yet Certified</Badge>
                  </div>
                  <p className="text-xs text-slate-600">
                    Chesapeake Bay TMDL nutrient credit trading requires state-level certification before credits can be banked, traded, or applied to Waste Load Allocations.
                    PIN's status in the {stateAbbr === 'MD' ? 'Maryland Water Quality Trading Program' : stateAbbr === 'VA' ? 'Virginia Nutrient Credit Exchange' : 'state nutrient trading framework'}:
                  </p>
                  <div className="space-y-2">
                    {[
                      { step: '1. BMP Registration', status: 'In Progress', detail: 'PIN filed as nature-based BMP with provisional patent documentation', statusColor: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🔄' },
                      { step: '2. Approved Monitoring Plan', status: 'In Progress', detail: 'QAPP submitted; continuous monitoring exceeds minimum requirements', statusColor: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🔄' },
                      { step: '3. Verified BMP Efficiency', status: 'Pending', detail: 'Requires 12+ months of validated deployment data (Milton pilot: 7 days)', statusColor: 'bg-slate-100 text-slate-600 border-slate-200', icon: '⏳' },
                      { step: '4. Third-Party Credit Verification', status: 'Pending', detail: 'Independent verifier confirms removal quantities and credit calculations', statusColor: 'bg-slate-100 text-slate-600 border-slate-200', icon: '⏳' },
                      { step: '5. State Certification', status: 'Pending', detail: `${stateAbbr === 'MD' ? 'MDE' : stateAbbr === 'VA' ? 'VA DEQ' : 'State agency'} issues certificate authorizing credit banking/trading`, statusColor: 'bg-slate-100 text-slate-600 border-slate-200', icon: '⏳' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-start gap-3 text-[11px]">
                        <span className="text-sm flex-shrink-0 mt-0.5">{row.icon}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800">{row.step}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${row.statusColor}`}>{row.status}</span>
                          </div>
                          <div className="text-slate-500 mt-0.5">{row.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-teal-50 border border-teal-300 rounded-md p-2.5">
                    <div className="text-[10px] text-teal-900">
                      <strong>Important:</strong> No PIN nutrient credits are currently certified, banked, or tradeable.
                      Credit values shown elsewhere in this dashboard are <em>projected estimates</em> for planning purposes only.
                      Actual credit generation requires completing all 5 steps above.
                    </div>
                  </div>
                </div>
                )}

                <div className="text-[10px] text-slate-400 italic">
                  Source: PIN monitoring infrastructure specifications, EPA QA/R-5 framework, {(agency as any)?.name || 'state agency'} data quality requirements.
                  QAPP documentation available upon request.
                </div>

              </CardContent>
            )}
          </Card>
            );


            // ── Overview sections ──────────────────────────────────────────────
            case 'operational-health': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Operational Health Bar
                  </CardTitle>
                  <CardDescription>Real-time system status across core MS4 program areas</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'BMP Network', status: 'Healthy', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                      { label: 'Permit Compliance', status: 'On Track', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                      { label: 'Monitoring Network', status: 'Active', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Enforcement Pipeline', status: '2 Open', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className={`text-sm font-bold ${k.color} mt-1`}>{k.status}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: MS4 permit records, BMP inspection logs, ICIS-NPDES</p>
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
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'BMP Inspection Queue', icon: '🔍' },
                      { label: 'IDDE Reports', icon: '🚰' },
                      { label: 'Annual Report Draft', icon: '📋' },
                      { label: 'Stormwater Permits', icon: '📄' },
                      { label: 'Nutrient Credits', icon: '🌿' },
                      { label: 'Construction Sites', icon: '🏗️' },
                      { label: 'Public Complaints', icon: '📞' },
                      { label: 'MCM Progress', icon: '📊' },
                    ].map(q => (
                      <button key={q.label} className="border border-slate-200 rounded-lg p-3 text-left hover:bg-slate-50 transition-colors">
                        <span className="text-lg">{q.icon}</span>
                        <div className="text-xs font-medium text-slate-700 mt-1">{q.label}</div>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ── AI Briefing sections ───────────────────────────────────────────
            case 'briefing-actions': { const jName = jurisdictionMeta?.name || 'Municipality'; return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    Action Required — {jName}
                  </CardTitle>
                  <CardDescription>Items requiring immediate attention from {jName} MS4 program staff</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { id: 'ms4-act-1', priority: 'High', item: `BMP inspection backlog in ${jName}: 12 facilities overdue by 30+ days`, detail: 'Overdue facilities include 4 commercial, 5 institutional, and 3 industrial sites. Oldest inspection gap: 67 days. Schedule field crews this week.', color: 'text-red-700 bg-red-50 border-red-200' },
                      { id: 'ms4-act-2', priority: 'High', item: `IDDE investigation #2024-087 in ${jName} — field verification needed within 48 hours`, detail: 'Illicit discharge detected at outfall OF-142. Preliminary sample shows elevated E. coli (840 CFU/100mL). Upstream trace required.', color: 'text-red-700 bg-red-50 border-red-200' },
                      { id: 'ms4-act-3', priority: 'Medium', item: `${jName} annual report data compilation deadline in 21 days`, detail: 'Required data: MCM activity logs, BMP maintenance records, monitoring results, and public education metrics. 3 of 6 MCM sections complete.', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                      { id: 'ms4-act-4', priority: 'Low', item: `MCM 1 public education materials for ${jName} due for quarterly update`, detail: 'Website content, brochure distribution logs, and social media outreach metrics need refresh for Q1 reporting.', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                    ].map((a) => (
                      <div key={a.id}>
                        <div
                          className={`flex items-center gap-2 text-xs rounded-lg border px-3 py-2 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${a.color}`}
                          onClick={() => setComingSoonId(comingSoonId === a.id ? null : a.id)}
                        >
                          <Badge variant="outline" className="text-[9px] shrink-0">{a.priority}</Badge>
                          <span className="flex-1">{a.item}</span>
                          <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform ${comingSoonId === a.id ? 'rotate-180' : ''}`} />
                        </div>
                        {comingSoonId === a.id && (
                          <div className="ml-4 mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                            <p className="text-xs text-slate-700">{a.detail}</p>
                            <p className="text-[10px] text-blue-600 mt-2 font-medium">Full detail view — Coming Soon</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">AI-generated from {jName} permit conditions, inspection schedules, and regulatory deadlines</p>
                </CardContent>
              </Card>
            ); }

            case 'briefing-changes': { const jName = jurisdictionMeta?.name || 'Municipality'; return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    What Changed Overnight — {jName}
                  </CardTitle>
                  <CardDescription>Automated detection of changes in {jName} since last session</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { id: 'ms4-chg-1', change: `New ATTAINS assessment data published for 3 ${jName} receiving waters`, type: 'Data Update', detail: 'Updated assessment units: Jones Falls (bacteria), Gwynns Falls (sediment), Stony Run (nutrients). Category changes may affect permit benchmarks.' },
                      { id: 'ms4-chg-2', change: `EPA ECHO updated enforcement status for 2 ${jName} permitted facilities`, type: 'Compliance', detail: 'Facilities: Industrial Park Outfall #3 (returned to compliance) and Retail Center BMP-7 (new maintenance violation). No formal action yet.' },
                      { id: 'ms4-chg-3', change: `Weather service issued flash flood watch for ${jName} — potential BMP overflow risk`, type: 'Weather', detail: '2-3 inches of rain forecast over 6 hours. 4 bioretention facilities and 2 wet ponds at capacity risk. Pre-storm inspection recommended.' },
                      { id: 'ms4-chg-4', change: `State regulatory bulletin: proposed nutrient limit revisions affecting ${stateAbbr} MS4 permits`, type: 'Policy', detail: 'Proposed total nitrogen benchmark reduction from 4.0 to 3.2 mg/L for urban stormwater. Comment period closes Apr 15.' },
                    ].map((c) => (
                      <div key={c.id}>
                        <div
                          className="flex items-start gap-2 text-xs border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:ring-1 hover:ring-purple-300 transition-all"
                          onClick={() => setComingSoonId(comingSoonId === c.id ? null : c.id)}
                        >
                          <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">{c.type}</Badge>
                          <span className="text-slate-700 flex-1">{c.change}</span>
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
                </CardContent>
              </Card>
            ); }

            case 'briefing-pulse': { const jName = jurisdictionMeta?.name || 'Municipality'; return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-emerald-600" />
                    Program Pulse — {jName}
                  </CardTitle>
                  <CardDescription>Overall {jName} MS4 program health and performance metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { id: 'ms4-pulse-1', label: 'Permit Compliance', value: '94%', trend: '↑ 2%', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dest: 'Compliance dashboard' },
                      { id: 'ms4-pulse-2', label: 'BMP Effectiveness', value: '82%', trend: '↑ 5%', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dest: 'BMP performance report' },
                      { id: 'ms4-pulse-3', label: 'Inspection Rate', value: '88%', trend: '— Stable', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dest: 'Inspection queue' },
                      { id: 'ms4-pulse-4', label: 'IDDE Cases Open', value: '6', trend: '↓ from 9', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dest: 'IDDE case tracker' },
                      { id: 'ms4-pulse-5', label: 'MCM Completion', value: '78%', trend: '↑ 4%', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dest: 'MCM progress tracker' },
                      { id: 'ms4-pulse-6', label: 'Public Complaints', value: '3', trend: '↓ from 7', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dest: 'Complaint log' },
                    ].map(m => (
                      <div key={m.id}>
                        <div
                          className={`rounded-xl border p-3 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${m.bg}`}
                          onClick={() => setComingSoonId(comingSoonId === m.id ? null : m.id)}
                        >
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{m.label}</div>
                          <div className={`text-xl font-bold ${m.color} mt-1`}>{m.value}</div>
                          <div className="text-[10px] text-slate-500">{m.trend}</div>
                        </div>
                        {comingSoonId === m.id && (
                          <div className="mt-1 rounded-lg border border-blue-200 bg-blue-50/60 p-2">
                            <p className="text-[10px] text-blue-600 font-medium">{m.dest} — Coming Soon</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ); }

            case 'briefing-stakeholder': { const jName = jurisdictionMeta?.name || 'Municipality'; return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Stakeholder Watch — {jName}
                  </CardTitle>
                  <CardDescription>{jName} community engagement and stakeholder activity monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { id: 'ms4-stk-1', stakeholder: 'County Council', activity: `Budget hearing for ${jName} stormwater utility fee scheduled next week`, status: 'Action Needed', detail: `Council work session on FY2027 stormwater enterprise fund. Proposed 4% rate increase. Prepare talking points on capital project ROI and BMP cost-effectiveness.` },
                      { id: 'ms4-stk-2', stakeholder: 'Watershed Association', activity: `Published water quality report highlighting ${jName} MS4 receiving waters`, status: 'Monitor', detail: 'Report covers 2025 volunteer monitoring data for 8 stream sites. Findings generally align with permit monitoring but highlight bacteria concerns in 2 tributaries.' },
                      { id: 'ms4-stk-3', stakeholder: 'Developer Coalition', activity: `Requesting meeting on ${jName} post-construction BMP requirements`, status: 'Pending', detail: 'Coalition of 6 developers seeking clarification on bioretention sizing requirements and maintenance bond amounts for new subdivisions.' },
                      { id: 'ms4-stk-4', stakeholder: 'EPA Region', activity: `Annual ${jName} MS4 permit compliance inspection window opens in 60 days`, status: 'Prepare', detail: `EPA Region ${getEpaRegionForState(stateAbbr) || '3'} inspection scheduled May 2026. Focus areas: IDDE program effectiveness, post-construction oversight, and monitoring QA/QC.` },
                    ].map((s) => (
                      <div key={s.id}>
                        <div
                          className="border border-slate-200 rounded-lg p-3 cursor-pointer hover:ring-1 hover:ring-indigo-300 transition-all"
                          onClick={() => setComingSoonId(comingSoonId === s.id ? null : s.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-800">{s.stakeholder}</span>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className="text-[9px]">{s.status}</Badge>
                              <ChevronDown size={14} className={`text-slate-400 transition-transform ${comingSoonId === s.id ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{s.activity}</p>
                        </div>
                        {comingSoonId === s.id && (
                          <div className="ml-4 mt-1 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3">
                            <p className="text-xs text-slate-700">{s.detail}</p>
                            <p className="text-[10px] text-indigo-600 mt-2 font-medium">Open full context — Coming Soon</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ); }

            // ── Resolution Planner section ─────────────────────────────────────
            case 'resolution-planner': return DS(<ResolutionPlanner userRole="ms4" scopeContext={{ scope: 'state', data: { abbr: stateAbbr, name: STATE_NAMES[stateAbbr] || stateAbbr, epaRegion: getEpaRegionForState(stateAbbr) || 0, totalWaterbodies: regionData.length, assessed: regionData.length, impaired: regionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length, score: Math.round(regionData.reduce((a, r) => a + (r.alertLevel === 'none' ? 95 : r.alertLevel === 'low' ? 75 : r.alertLevel === 'medium' ? 50 : 25), 0) / Math.max(regionData.length, 1)), grade: 'B', cat5: 0, cat4a: 0, cat4b: 0, cat4c: 0, topCauses: [] } }} />);

            // ── Policy Tracker sections ────────────────────────────────────────
            case 'policy-federal': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-blue-600" />
                    Federal Actions Affecting MS4
                  </CardTitle>
                  <CardDescription>Federal regulatory changes impacting municipal stormwater programs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { action: 'EPA proposing updated MS4 permit remand rule — comment period closes in 45 days', impact: 'High', status: 'Active' },
                      { action: 'Infrastructure Investment and Jobs Act: stormwater-eligible funding guidance released', impact: 'Medium', status: 'New' },
                      { action: 'PFAS monitoring requirements under consideration for next permit cycle', impact: 'High', status: 'Proposed' },
                    ].map((a, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[9px] ${a.impact === 'High' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'}`}>{a.impact} Impact</Badge>
                          <Badge variant="outline" className="text-[9px]">{a.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-700">{a.action}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Federal Register, EPA rulemaking tracker</p>
                </CardContent>
              </Card>
            );

            case 'policy-state': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-cyan-600" />
                    State Regulatory Actions
                  </CardTitle>
                  <CardDescription>State-level regulatory and legislative actions affecting MS4 operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { action: 'State proposing revised stormwater design manual — public hearing scheduled', status: 'Comment Period' },
                      { action: 'New nutrient trading program regulations finalized — effective next quarter', status: 'Final Rule' },
                      { action: 'Legislature considering stormwater utility fee authorization bill', status: 'In Committee' },
                    ].map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <Badge variant="outline" className="text-[9px] shrink-0 mt-0.5">{a.status}</Badge>
                        <span className="text-slate-700">{a.action}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: State regulatory bulletin, legislative tracking system</p>
                </CardContent>
              </Card>
            );

            case 'policy-epa': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-600" />
                    EPA Oversight Status
                  </CardTitle>
                  <CardDescription>EPA Region oversight activities and compliance review status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { item: 'Last EPA audit', value: '14 months ago', status: 'Satisfactory' },
                      { item: 'Next scheduled review', value: 'Q3 2026', status: 'Upcoming' },
                      { item: 'Outstanding findings', value: '1 minor', status: 'In Progress' },
                      { item: 'Technical assistance requests', value: '2 active', status: 'Open' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{e.item}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{e.value}</span>
                          <Badge variant="outline" className="text-[9px]">{e.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ── Compliance sections ────────────────────────────────────────────
            case 'compliance-permits': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="h-5 w-5 text-blue-600" />
                    Permit Compliance Management
                  </CardTitle>
                  <CardDescription>MS4 permit conditions tracking and compliance status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Permit Conditions', value: '48', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'In Compliance', value: '44', bg: 'bg-green-50 border-green-200' },
                      { label: 'At Risk', value: '3', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Non-Compliant', value: '1', bg: 'bg-red-50 border-red-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: MS4 permit tracker, ICIS-NPDES</p>
                </CardContent>
              </Card>
            );

            case 'compliance-assessment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-cyan-600" />
                    Assessment & Listing Management
                  </CardTitle>
                  <CardDescription>Receiving water assessment status and 303(d) listing tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Assessed Waters', value: String(scopedRegionData.length), bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Impaired (Cat 5)', value: String(scopedRegionData.filter(r => r.alertLevel === 'high').length), bg: 'bg-red-50 border-red-200' },
                      { label: 'Attaining', value: String(scopedRegionData.filter(r => r.alertLevel === 'none').length), bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: EPA ATTAINS, state 303(d)/305(b) reports</p>
                </CardContent>
              </Card>
            );

            case 'compliance-ms4': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-amber-600" />
                    MS4 Permit Conditions
                  </CardTitle>
                  <CardDescription>Detailed tracking of individual MS4 permit requirements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { condition: 'Stormwater Management Program (SWMP) annual update', due: '90 days', status: 'On Track' },
                      { condition: 'Impervious surface restoration — 20% target', due: 'Ongoing', status: '68% Complete' },
                      { condition: 'IDDE program: outfall screening schedule', due: '45 days', status: 'Behind' },
                      { condition: 'Good housekeeping: facility inspection program', due: 'Quarterly', status: 'Current' },
                      { condition: 'Water quality monitoring — wet weather sampling', due: 'Seasonal', status: 'On Track' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 flex-1">{c.condition}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-slate-500">{c.due}</span>
                          <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: MS4 permit conditions tracker</p>
                </CardContent>
              </Card>
            );

            case 'compliance-analytics': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Compliance Analytics
                  </CardTitle>
                  <CardDescription>Compliance trend analysis and risk prediction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Compliance Rate', value: '92%', trend: '↑ 3%', bg: 'bg-green-50 border-green-200' },
                      { label: 'Avg Resolution Time', value: '18 days', trend: '↓ 4 days', bg: 'bg-green-50 border-green-200' },
                      { label: 'Repeat Violations', value: '2', trend: '↓ from 5', bg: 'bg-green-50 border-green-200' },
                      { label: 'Risk Score', value: 'Low', trend: '— Stable', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-lg font-bold text-slate-800 mt-1">{k.value}</div>
                        <div className="text-[10px] text-slate-500">{k.trend}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: MS4 compliance records, ICIS-NPDES</p>
                </CardContent>
              </Card>
            );

            // ── Water Quality sections ─────────────────────────────────────────
            case 'wq-standards': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-blue-600" />
                    Standards Applied
                  </CardTitle>
                  <CardDescription>Water quality standards applicable to MS4 receiving waters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { standard: 'Total Suspended Solids (TSS)', limit: '80% removal', status: 'Meeting' },
                      { standard: 'Total Nitrogen (TN)', limit: '40% reduction', status: 'Progressing' },
                      { standard: 'Total Phosphorus (TP)', limit: '50% reduction', status: 'Meeting' },
                      { standard: 'Bacteria (E. coli)', limit: '126 cfu/100mL', status: 'Exceedance' },
                      { standard: 'Dissolved Oxygen', limit: '> 5.0 mg/L', status: 'Meeting' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{s.standard}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{s.limit}</span>
                          <Badge variant="outline" className={`text-[9px] ${s.status === 'Meeting' ? 'border-green-300 text-green-700' : s.status === 'Exceedance' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'}`}>{s.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: State water quality standards, MS4 permit benchmarks</p>
                </CardContent>
              </Card>
            );

            case 'wq-assessment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-cyan-600" />
                    Assessment Workspace
                  </CardTitle>
                  <CardDescription>Waterbody assessment status and data analysis tools</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-400">
                    <Droplets className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Select a receiving water to view assessment data</p>
                    <p className="text-xs mt-1">Compare monitoring results against applicable standards and TMDL targets</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: WQX monitoring data, state assessment database</p>
                </CardContent>
              </Card>
            );

            case 'wq-stations': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-green-600" />
                    Enhanced Station Data
                  </CardTitle>
                  <CardDescription>Monitoring station inventory and recent results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Stations', value: '24', bg: 'bg-green-50 border-green-200' },
                      { label: 'Parameters Tracked', value: '18', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Samples (YTD)', value: '342', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Exceedances (YTD)', value: '14', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: WQP, STORET, jurisdictional monitoring program</p>
                </CardContent>
              </Card>
            );

            case 'wq-stormwater': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-blue-600" />
                    Stormwater Quality Monitoring
                  </CardTitle>
                  <CardDescription>Wet weather monitoring results and stormwater discharge quality</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Storm Events Sampled', value: '8', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Avg TSS (mg/L)', value: '42', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Avg TN (mg/L)', value: '2.1', bg: 'bg-cyan-50 border-cyan-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: MS4 wet weather monitoring program, EPA benchmarks</p>
                </CardContent>
              </Card>
            );

            // ── Public Health sections ──────────────────────────────────────────
            case 'ph-contaminants': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-purple-600" />
                    Contaminant Tracking
                  </CardTitle>
                  <CardDescription>Emerging contaminants and priority pollutant monitoring</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { contaminant: 'PFAS (PFOA/PFOS)', level: '12 ppt', limit: '4 ppt', status: 'Exceedance' },
                      { contaminant: 'Microplastics', level: 'Detected', limit: 'No standard', status: 'Monitoring' },
                      { contaminant: 'Pharmaceuticals', level: 'Trace', limit: 'No standard', status: 'Monitoring' },
                      { contaminant: 'Legacy Pesticides', level: 'Below MDL', limit: 'Various', status: 'Meeting' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{c.contaminant}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">Level: {c.level}</span>
                          <span className="text-slate-500">Limit: {c.limit}</span>
                          <Badge variant="outline" className={`text-[9px] ${c.status === 'Meeting' ? 'border-green-300 text-green-700' : c.status === 'Exceedance' ? 'border-red-300 text-red-700' : 'border-blue-300 text-blue-700'}`}>{c.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: EPA UCMR, state lab results, SDWIS</p>
                </CardContent>
              </Card>
            );

            case 'ph-health-coord': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-600" />
                    Health Department Coordination
                  </CardTitle>
                  <CardDescription>Coordination with local and state health departments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { item: 'Beach/swimming advisory coordination protocol', status: 'Active' },
                      { item: 'Fish consumption advisory updates', status: 'Current' },
                      { item: 'Waterborne illness surveillance data sharing', status: 'Quarterly' },
                      { item: 'Private well contamination notification', status: 'As Needed' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{c.item}</span>
                        <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'ph-advisories': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    Public Advisories & Notifications
                  </CardTitle>
                  <CardDescription>Active and recent public health advisories for jurisdiction waters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { advisory: 'Bacteria advisory: Swimming not recommended at 2 outfall locations', active: true, issued: '3 days ago' },
                      { advisory: 'Algal bloom watch: Blue-green algae detected in receiving reservoir', active: true, issued: '1 week ago' },
                      { advisory: 'All-clear: Previous CSO event advisory lifted', active: false, issued: '2 weeks ago' },
                    ].map((a, i) => (
                      <div key={i} className={`text-xs border rounded-lg px-3 py-2 ${a.active ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <span className={a.active ? 'text-amber-800 font-medium' : 'text-slate-500'}>{a.advisory}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{a.issued}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ── Receiving Waters sections (MS4-exclusive) ★ ────────────────────
            case 'rw-map': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-cyan-600" />
                    Receiving Water Map
                  </CardTitle>
                  <CardDescription>Geographic view of all receiving waters within MS4 jurisdiction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Receiving Waters', value: String(scopedRegionData.length), bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Impaired', value: String(scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length), bg: 'bg-red-50 border-red-200' },
                      { label: 'Monitored', value: String(scopedRegionData.filter(r => r.dataSourceCount > 0).length), bg: 'bg-green-50 border-green-200' },
                      { label: 'TMDL Applied', value: String(Math.max(1, Math.floor(scopedRegionData.length * 0.6))), bg: 'bg-cyan-50 border-cyan-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: EPA ATTAINS, MS4 receiving water inventory</p>
                </CardContent>
              </Card>
            );

            case 'rw-profiles': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Waterbody Profiles
                  </CardTitle>
                  <CardDescription>Detailed profiles for each receiving water including use designations and impairments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-400">
                    <Database className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Select a receiving water to view its profile</p>
                    <p className="text-xs mt-1">Designated uses, impairment causes, assessment history, and TMDL applicability</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: ATTAINS assessment units, state use classifications</p>
                </CardContent>
              </Card>
            );

            case 'rw-upstream': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-indigo-600" />
                    Upstream Source Analysis
                  </CardTitle>
                  <CardDescription>Upstream pollutant sources and cross-jurisdictional loading</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { source: 'Agricultural runoff (upstream county)', contribution: '35%', pollutant: 'Nutrients', trend: 'Stable' },
                      { source: 'WWTP discharge (upstream municipality)', contribution: '25%', pollutant: 'Nitrogen', trend: 'Decreasing' },
                      { source: 'Urban stormwater (own jurisdiction)', contribution: '30%', pollutant: 'TSS/Metals', trend: 'Improving' },
                      { source: 'Atmospheric deposition', contribution: '10%', pollutant: 'Nitrogen', trend: 'Stable' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 flex-1">{s.source}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500">{s.contribution}</span>
                          <span className="text-slate-500">{s.pollutant}</span>
                          <Badge variant="outline" className="text-[9px]">{s.trend}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: SPARROW model, TMDL source assessments, NHDPlus flow routing</p>
                </CardContent>
              </Card>
            );

            case 'rw-monitoring': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-green-600" />
                    Receiving Water Monitoring
                  </CardTitle>
                  <CardDescription>Current monitoring coverage and recent results for receiving waters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Monitored Waters', value: String(scopedRegionData.filter(r => r.dataSourceCount > 0).length), bg: 'bg-green-50 border-green-200' },
                      { label: 'Unmonitored', value: String(scopedRegionData.filter(r => r.dataSourceCount === 0).length), bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Recent Samples', value: '48', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: WQP, jurisdiction monitoring program, continuous sensors</p>
                </CardContent>
              </Card>
            );

            case 'rw-impairment': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Impairment Analysis
                  </CardTitle>
                  <CardDescription>Receiving water impairment causes, sources, and TMDL status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { cause: 'Sediment/Siltation', sources: 'Urban runoff, construction', waters: 4, tmdl: 'Yes' },
                      { cause: 'Nutrients (N/P)', sources: 'Fertilizer, WWTP', waters: 3, tmdl: 'Yes' },
                      { cause: 'Bacteria', sources: 'Stormwater, pet waste, SSO', waters: 3, tmdl: 'In Development' },
                      { cause: 'Trash/Debris', sources: 'Urban litter, illegal dumping', waters: 2, tmdl: 'No' },
                      { cause: 'Metals (Zinc, Copper)', sources: 'Road runoff, rooftops', waters: 2, tmdl: 'No' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{c.cause}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500">{c.sources}</span>
                          <span className="text-slate-500">{c.waters} waters</span>
                          <Badge variant="outline" className={`text-[9px] ${c.tmdl === 'Yes' ? 'border-green-300 text-green-700' : c.tmdl === 'No' ? 'border-slate-300 text-slate-600' : 'border-amber-300 text-amber-700'}`}>TMDL: {c.tmdl}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: EPA ATTAINS, state impaired waters list</p>
                </CardContent>
              </Card>
            );
            // ── Stormwater BMPs sections (MS4-exclusive) ★ ─────────────────────
            case 'bmp-inventory': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-blue-600" />
                    BMP Inventory
                  </CardTitle>
                  <CardDescription>Complete inventory of stormwater best management practices</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total BMPs', value: '186', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Bioretention', value: '52', bg: 'bg-green-50 border-green-200' },
                      { label: 'Dry Ponds', value: '34', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Wet Ponds', value: '28', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Underground', value: '18', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Swales', value: '24', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Green Roofs', value: '8', bg: 'bg-green-50 border-green-200' },
                      { label: 'Other', value: '22', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: MS4 BMP inventory database, GIS asset management</p>
                </CardContent>
              </Card>
            );


            case 'bmp-details': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-cyan-600" />
                    BMP Detail Cards
                  </CardTitle>
                  <CardDescription>Individual BMP facility details and inspection history</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-400">
                    <Eye className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Select a BMP from the inventory or map to view details</p>
                    <p className="text-xs mt-1">Design specs, drainage area, last inspection results, and maintenance history</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Data source: BMP inspection database, as-built records</p>
                </CardContent>
              </Card>
            );

            case 'bmp-analytics': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    BMP Performance Analytics
                  </CardTitle>
                  <CardDescription>Aggregate BMP performance metrics and removal efficiency tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Avg TSS Removal', value: '82%', bg: 'bg-green-50 border-green-200' },
                      { label: 'Avg TN Removal', value: '45%', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Avg TP Removal', value: '58%', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Passing Inspection', value: '91%', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: BMP monitoring data, MS4 annual report calculations</p>
                </CardContent>
              </Card>
            );

            case 'bmp-maintenance': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-amber-600" />
                    Maintenance Schedule
                  </CardTitle>
                  <CardDescription>BMP maintenance tracking and upcoming service schedule</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { bmp: 'Bioretention #BR-042 (Oak Park)', task: 'Sediment cleanout', due: '7 days', priority: 'High' },
                      { bmp: 'Wet Pond #WP-011 (Industrial Blvd)', task: 'Forebay dredging', due: '14 days', priority: 'Medium' },
                      { bmp: 'Underground #UG-003 (Main St)', task: 'Media replacement', due: '30 days', priority: 'Medium' },
                      { bmp: 'Dry Pond #DP-018 (Elm Creek)', task: 'Vegetation maintenance', due: '45 days', priority: 'Low' },
                      { bmp: 'Swale #SW-007 (River Rd)', task: 'Regrading & seeding', due: '60 days', priority: 'Low' },
                    ].map((m, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">{m.bmp}</span>
                          <Badge variant="outline" className={`text-[9px] ${m.priority === 'High' ? 'border-red-300 text-red-700' : m.priority === 'Medium' ? 'border-amber-300 text-amber-700' : 'border-slate-300 text-slate-600'}`}>{m.priority}</Badge>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-slate-500">{m.task}</span>
                          <span className="text-[10px] text-slate-400">Due: {m.due}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: BMP maintenance tracking system</p>
                </CardContent>
              </Card>
            );

            case 'bmp-planning': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-indigo-600" />
                    BMP Planning & Siting
                  </CardTitle>
                  <CardDescription>New BMP siting analysis and restoration credit projections</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Planned New BMPs', value: '12', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Projected Credits', value: '8.4 ac', bg: 'bg-green-50 border-green-200' },
                      { label: 'Est. Investment', value: '$2.8M', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Capital improvement plan, impervious cover analysis</p>
                </CardContent>
              </Card>
            );

            // ── Infrastructure sections ────────────────────────────────────────
            case 'infra-srf': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-blue-600" />
                    SRF Program
                  </CardTitle>
                  <CardDescription>State Revolving Fund loans received, terms, and repayment status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">State Capitalization</div>
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
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 mt-4">Municipal Pass-Through</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'SRF Loans Received', value: '3', bg: 'bg-green-50 border-green-200' },
                      { label: 'Outstanding Balance', value: '$8.2M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Interest Rate', value: '1.5%', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Repayment Status', value: 'Current', bg: 'bg-emerald-50 border-emerald-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">Data source: State SRF program, municipal loan records</p>
                </CardContent>
              </Card>
            );

            case 'infra-capital': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Capital Improvement Planning
                  </CardTitle>
                  <CardDescription>Stormwater capital projects and long-term infrastructure planning</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Projects', value: '8', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'In Design', value: '4', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Total Budget', value: '$18.2M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Spent to Date', value: '$6.8M', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Capital improvement plan, procurement records</p>
                </CardContent>
              </Card>
            );

            case 'infra-construction': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardHat className="h-5 w-5 text-amber-600" />
                    Construction Project Tracker
                  </CardTitle>
                  <CardDescription>Active construction projects with milestone tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { project: 'Regional BMP retrofit — Phase 2', completion: '68%', status: 'On Schedule' },
                      { project: 'Stream restoration — Elm Creek', completion: '42%', status: 'On Schedule' },
                      { project: 'Outfall rehabilitation — Industrial Park', completion: '85%', status: 'Ahead' },
                    ].map((p, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">{p.project}</span>
                          <Badge variant="outline" className="text-[9px]">{p.status}</Badge>
                        </div>
                        <div className="mt-2 bg-slate-100 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: p.completion }} />
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1 text-right">{p.completion}</div>
                      </div>
                    ))}
                  </div>
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
                  <CardDescription>Green infrastructure inventory, performance, and expansion planning</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'GI Facilities', value: '42', bg: 'bg-green-50 border-green-200' },
                      { label: 'Drainage Treated', value: '124 ac', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Rain Gardens', value: '18', bg: 'bg-green-50 border-green-200' },
                      { label: 'Permeable Pavement', value: '8', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: GI inventory, impervious cover analysis</p>
                </CardContent>
              </Card>
            );

            // ── Monitoring sections ────────────────────────────────────────────
            case 'mon-network': return DS(
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Radio className="h-5 w-5 text-blue-600" />
                      Monitoring Network
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
                  <CardDescription>MS4 monitoring station network status and coverage</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Stations', value: '24', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Active', value: '22', bg: 'bg-green-50 border-green-200' },
                      { label: 'Continuous', value: '6', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Grab Sample', value: '16', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Monitoring program database, WQP station registry</p>
                </CardContent>
              </Card>
            );

            case 'mon-data-mgmt': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-600" />
                    Data Management Operations
                  </CardTitle>
                  <CardDescription>Data quality, submission status, and QA/QC metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Records (YTD)', value: '4,218', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'QA Pass Rate', value: '97.2%', bg: 'bg-green-50 border-green-200' },
                      { label: 'Pending Review', value: '42', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'WQX Submissions', value: '12', bg: 'bg-cyan-50 border-cyan-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: LIMS, WQX submission tracker</p>
                </CardContent>
              </Card>
            );

            case 'mon-optimization': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Network Optimization
                  </CardTitle>
                  <CardDescription>Monitoring network optimization recommendations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { recommendation: 'Add continuous DO sensor at Outfall #12 — high variability detected', priority: 'High' },
                      { recommendation: 'Consolidate grab sample stations #8 and #9 — redundant coverage', priority: 'Medium' },
                      { recommendation: 'Increase wet weather sampling frequency at BMP outlets', priority: 'Medium' },
                      { recommendation: 'Install automated sampler at stream gauge site for storm events', priority: 'Low' },
                    ].map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <Badge variant="outline" className={`text-[9px] shrink-0 mt-0.5 ${r.priority === 'High' ? 'border-red-300 text-red-700' : r.priority === 'Medium' ? 'border-amber-300 text-amber-700' : 'border-slate-300 text-slate-600'}`}>{r.priority}</Badge>
                        <span className="text-slate-700">{r.recommendation}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">AI-generated from monitoring data gaps and trend analysis</p>
                </CardContent>
              </Card>
            );

            case 'mon-continuous': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-cyan-600" />
                    Continuous Monitoring
                  </CardTitle>
                  <CardDescription>Real-time sensor data and continuous monitoring station status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { station: 'Elm Creek @ Bridge', param: 'DO: 7.2 mg/L', status: 'Normal', lastUpdate: '5 min ago' },
                      { station: 'River Rd Outfall', param: 'Flow: 2.4 cfs', status: 'Normal', lastUpdate: '5 min ago' },
                      { station: 'Industrial Park BMP', param: 'pH: 7.1', status: 'Normal', lastUpdate: '5 min ago' },
                      { station: 'Main St Gauge', param: 'Level: 1.8 ft', status: 'Elevated', lastUpdate: '5 min ago' },
                      { station: 'Oak Park Outfall', param: 'Turbidity: 42 NTU', status: 'Alert', lastUpdate: '5 min ago' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{s.station}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-600">{s.param}</span>
                          <Badge variant="outline" className={`text-[9px] ${s.status === 'Normal' ? 'border-green-300 text-green-700' : s.status === 'Alert' ? 'border-red-300 text-red-700' : 'border-amber-300 text-amber-700'}`}>{s.status}</Badge>
                          <span className="text-[10px] text-slate-400">{s.lastUpdate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: SCADA, continuous monitoring sensors</p>
                </CardContent>
              </Card>
            );

            // ── Disaster sections ──────────────────────────────────────────────
            case 'disaster-active': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    Active Incidents
                  </CardTitle>
                  <CardDescription>Current stormwater-related incidents and emergency events</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {scopedRegionData.filter(r => r.alertLevel === 'high').length > 0 ? (
                      scopedRegionData.filter(r => r.alertLevel === 'high').slice(0, 3).map((r, i) => (
                        <div key={i} className="border border-red-200 bg-red-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-red-800">{r.name}</span>
                            <Badge variant="outline" className="text-[9px] border-red-300 text-red-700">Severe</Badge>
                          </div>
                          <p className="text-xs text-red-600 mt-1">{r.activeAlerts} active alerts — monitoring elevated</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-slate-400">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-400" />
                        <p className="text-sm font-medium text-green-700">No active incidents</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );

            case 'disaster-response': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    MS4 Response Operations
                  </CardTitle>
                  <CardDescription>Emergency response protocols and resource deployment status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { resource: 'Emergency response team', status: 'Standby', availability: 'Available' },
                      { resource: 'Portable sampling equipment', status: '4 units ready', availability: 'Available' },
                      { resource: 'Spill containment kits', status: '12 deployed', availability: '8 Available' },
                      { resource: 'Mutual aid agreements', status: '3 active MOUs', availability: 'Current' },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{r.resource}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{r.status}</span>
                          <Badge variant="outline" className="text-[9px]">{r.availability}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  <CardDescription>Spill incident tracking and regulatory notification status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Open Reports', value: '2', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'YTD Total', value: '14', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Avg Response', value: '2.4 hrs', bg: 'bg-green-50 border-green-200' },
                      { label: 'Closed (YTD)', value: '12', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Spill incident management system, NRC notifications</p>
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
                  <CardDescription>Emergency preparedness status and exercise schedule</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { item: 'Stormwater Emergency Response Plan', status: 'Current', updated: 'Updated 6 months ago' },
                      { item: 'Spill response equipment inspection', status: 'Current', updated: 'Last quarter' },
                      { item: 'Tabletop exercise — chemical spill scenario', status: 'Scheduled', updated: 'Next month' },
                      { item: 'Mutual aid agreement renewal', status: 'Current', updated: 'Renewed this year' },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{p.item}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{p.updated}</span>
                          <Badge variant="outline" className={`text-[9px] ${p.status === 'Current' ? 'border-green-300 text-green-700' : 'border-blue-300 text-blue-700'}`}>{p.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ── TMDL Compliance sections (MS4-exclusive) ★ ─────────────────────
            case 'tmdl-inventory': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Waves className="h-5 w-5 text-cyan-600" />
                    TMDL Inventory
                  </CardTitle>
                  <CardDescription>TMDLs applicable to MS4 jurisdiction receiving waters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Applicable TMDLs', value: '8', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Pollutants Covered', value: '5', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'On Track', value: '5', bg: 'bg-green-50 border-green-200' },
                      { label: 'Behind Schedule', value: '2', bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: EPA ATTAINS, state TMDL implementation database</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-loading': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-red-600" />
                    Pollutant Loading Analysis
                  </CardTitle>
                  <CardDescription>MS4 pollutant loading vs. TMDL wasteload allocation targets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { pollutant: 'Total Nitrogen', current: '12,400 lbs/yr', target: '9,800 lbs/yr', pct: '79%', status: 'Over' },
                      { pollutant: 'Total Phosphorus', current: '1,840 lbs/yr', target: '2,100 lbs/yr', pct: '88%', status: 'Meeting' },
                      { pollutant: 'Total Suspended Solids', current: '286 tons/yr', target: '320 tons/yr', pct: '89%', status: 'Meeting' },
                      { pollutant: 'Bacteria (E. coli)', current: 'Pending', target: 'TBD', pct: '—', status: 'New TMDL' },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{p.pollutant}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-slate-500">Current: {p.current}</span>
                          <span className="text-slate-500">Target: {p.target}</span>
                          <Badge variant="outline" className={`text-[9px] ${p.status === 'Meeting' ? 'border-green-300 text-green-700' : p.status === 'Over' ? 'border-red-300 text-red-700' : 'border-blue-300 text-blue-700'}`}>{p.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: TMDL implementation plans, annual loading calculations</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-pathways': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Compliance Pathways
                  </CardTitle>
                  <CardDescription>Strategies and timelines for meeting TMDL targets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { strategy: 'BMP retrofit program — new bioretention and media filters', reduction: '2,400 lbs N/yr', timeline: '3 years', status: 'In Progress' },
                      { strategy: 'Stream restoration — natural channel design', reduction: '800 lbs N/yr', timeline: '2 years', status: 'Planned' },
                      { strategy: 'Nutrient credit purchase — offset remaining gap', reduction: '1,200 lbs N/yr', timeline: 'Annual', status: 'Active' },
                    ].map((s, i) => (
                      <div key={i} className="border border-slate-200 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">{s.strategy}</span>
                          <Badge variant="outline" className="text-[9px]">{s.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <span className="text-xs text-slate-500">Reduction: {s.reduction}</span>
                          <span className="text-xs text-slate-500">Timeline: {s.timeline}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: TMDL implementation plan, MS4 annual report</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-docs': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    TMDL Documentation
                  </CardTitle>
                  <CardDescription>TMDL implementation plans and supporting documentation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { doc: 'Sediment TMDL Implementation Plan', status: 'Approved', year: '2019' },
                      { doc: 'Nutrient TMDL Compliance Strategy', status: 'Approved', year: '2021' },
                      { doc: 'Bacteria TMDL Feasibility Study', status: 'Draft', year: '2024' },
                      { doc: 'Trash TMDL Monitoring Plan', status: 'In Review', year: '2025' },
                    ].map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{d.doc}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{d.year}</span>
                          <Badge variant="outline" className={`text-[9px] ${d.status === 'Approved' ? 'border-green-300 text-green-700' : d.status === 'Draft' ? 'border-amber-300 text-amber-700' : 'border-blue-300 text-blue-700'}`}>{d.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: TMDL tracking system, state program files</p>
                </CardContent>
              </Card>
            );

            case 'tmdl-wla': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-purple-600" />
                    Wasteload Allocations
                  </CardTitle>
                  <CardDescription>MS4 wasteload allocations and current loading vs. targets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { parameter: 'Total Suspended Solids', allocation: '450 tons/yr', current: '380 tons/yr', pct: 84, meeting: true },
                      { parameter: 'Total Nitrogen', allocation: '28 tons/yr', current: '32 tons/yr', pct: 114, meeting: false },
                      { parameter: 'Total Phosphorus', allocation: '3.2 tons/yr', current: '2.8 tons/yr', pct: 88, meeting: true },
                      { parameter: 'Bacteria (E. coli)', allocation: '1.2E+12 MPN/yr', current: '1.8E+12 MPN/yr', pct: 150, meeting: false },
                    ].map((w, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{w.parameter}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">WLA: {w.allocation}</span>
                          <span className="text-slate-500">Current: {w.current}</span>
                          <Badge variant="outline" className={`text-[9px] ${w.meeting ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'}`}>{w.pct}%</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: TMDL permits, MS4 annual loading estimates</p>
                </CardContent>
              </Card>
            );

            // ── Scorecard sections ───────────────────────────────────────────────
            case 'sc-permit-score': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-blue-600" />
                    Permit Compliance Score
                  </CardTitle>
                  <CardDescription>Overall MS4 permit compliance rating and component scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Overall Score', value: '82%', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Monitoring', value: '91%', bg: 'bg-green-50 border-green-200' },
                      { label: 'BMP Maintenance', value: '78%', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Reporting', value: '95%', bg: 'bg-green-50 border-green-200' },
                      { label: 'MCM Implementation', value: '76%', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'TMDL Progress', value: '68%', bg: 'bg-red-50 border-red-200' },
                      { label: 'IDDE Response', value: '88%', bg: 'bg-green-50 border-green-200' },
                      { label: 'Public Education', value: '85%', bg: 'bg-blue-50 border-blue-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Permit compliance tracking system, self-assessment</p>
                </CardContent>
              </Card>
            );

            case 'sc-bmp-performance': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                    BMP Performance Scorecard
                  </CardTitle>
                  <CardDescription>Performance metrics for stormwater BMP categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { type: 'Bioretention', efficiency: '85%', maintenance: 'Good', condition: 'A' },
                      { type: 'Detention Basins', efficiency: '72%', maintenance: 'Fair', condition: 'B' },
                      { type: 'Permeable Pavement', efficiency: '68%', maintenance: 'Fair', condition: 'B-' },
                      { type: 'Green Roofs', efficiency: '78%', maintenance: 'Good', condition: 'A-' },
                      { type: 'Swales/Channels', efficiency: '65%', maintenance: 'Poor', condition: 'C' },
                    ].map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{b.type}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">Eff: {b.efficiency}</span>
                          <span className="text-slate-500">Maint: {b.maintenance}</span>
                          <Badge variant="outline" className="text-[9px]">Grade: {b.condition}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: BMP inspection records, pollutant removal monitoring</p>
                </CardContent>
              </Card>
            );

            case 'sc-peer': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    Peer Comparison
                  </CardTitle>
                  <CardDescription>Performance benchmarking against comparable MS4 programs</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { metric: 'BMP density (per sq mi)', yours: '12.4', median: '8.2', percentile: '78th' },
                      { metric: 'Monitoring frequency', yours: 'Monthly', median: 'Quarterly', percentile: '90th' },
                      { metric: 'IDDE investigations/yr', yours: '34', median: '18', percentile: '85th' },
                      { metric: 'Permit compliance rate', yours: '82%', median: '79%', percentile: '62nd' },
                      { metric: 'Public engagement events', yours: '12', median: '6', percentile: '88th' },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{p.metric}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">You: {p.yours}</span>
                          <span className="text-slate-500">Median: {p.median}</span>
                          <Badge variant="outline" className="text-[9px]">{p.percentile}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: EPA MS4 program survey, peer exchange network</p>
                </CardContent>
              </Card>
            );

            case 'sc-trends': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    Performance Trends
                  </CardTitle>
                  <CardDescription>Multi-year trends in key MS4 program performance indicators</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { indicator: 'Overall compliance score', direction: 'up', change: '+4%', period: 'YoY' },
                      { indicator: 'BMP pollutant removal', direction: 'up', change: '+8%', period: '3-yr' },
                      { indicator: 'Impaired waters count', direction: 'down', change: '-1', period: 'YoY' },
                      { indicator: 'IDDE response time', direction: 'down', change: '-12 hrs', period: 'YoY' },
                      { indicator: 'Monitoring coverage', direction: 'up', change: '+15%', period: '5-yr' },
                    ].map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{t.indicator}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${t.indicator.includes('Impaired') || t.indicator.includes('response') ? (t.direction === 'down' ? 'text-green-600' : 'text-red-600') : (t.direction === 'up' ? 'text-green-600' : 'text-red-600')}`}>{t.change}</span>
                          <Badge variant="outline" className="text-[9px]">{t.period}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Annual report data, program metrics database</p>
                </CardContent>
              </Card>
            );

            // ── Reports sections ─────────────────────────────────────────────────
            case 'rpt-annual': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Annual Report Builder
                  </CardTitle>
                  <CardDescription>Generate and manage MS4 annual compliance reports</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { report: 'FY2025 MS4 Annual Report', status: 'In Progress', due: 'Oct 1, 2025', pct: 65 },
                      { report: 'FY2024 MS4 Annual Report', status: 'Submitted', due: 'Oct 1, 2024', pct: 100 },
                      { report: 'FY2023 MS4 Annual Report', status: 'Accepted', due: 'Oct 1, 2023', pct: 100 },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700 font-medium">{r.report}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">Due: {r.due}</span>
                          <Badge variant="outline" className={`text-[9px] ${r.status === 'Accepted' ? 'border-green-300 text-green-700' : r.status === 'Submitted' ? 'border-blue-300 text-blue-700' : 'border-amber-300 text-amber-700'}`}>{r.status} ({r.pct}%)</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Report tracking system, regulatory calendar</p>
                </CardContent>
              </Card>
            );

            case 'rpt-mde-export': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-green-600" />
                    MDE/State Export
                  </CardTitle>
                  <CardDescription>Export data in state-required formats for regulatory submissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { format: 'MDE eDMR Discharge Monitoring Report', lastExport: '2 weeks ago', status: 'Ready' },
                      { format: 'State BMP Inventory Upload', lastExport: '1 month ago', status: 'Ready' },
                      { format: 'TMDL Progress Report (state template)', lastExport: '3 months ago', status: 'Update Available' },
                      { format: 'Impaired Waters Response Submission', lastExport: 'Never', status: 'Not Started' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{e.format}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">Last: {e.lastExport}</span>
                          <Badge variant="outline" className={`text-[9px] ${e.status === 'Ready' ? 'border-green-300 text-green-700' : e.status === 'Not Started' ? 'border-slate-300 text-slate-600' : 'border-amber-300 text-amber-700'}`}>{e.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'rpt-regulatory': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                    Regulatory Submissions
                  </CardTitle>
                  <CardDescription>Track all regulatory submission deadlines and statuses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { submission: 'MS4 Annual Report', agency: 'State DEQ', due: 'Oct 1, 2025', status: 'In Progress' },
                      { submission: 'SWMP Update', agency: 'State DEQ', due: 'Dec 15, 2025', status: 'Not Started' },
                      { submission: 'eDMR Submission (Q1)', agency: 'EPA/State', due: 'Apr 28, 2025', status: 'Submitted' },
                      { submission: 'TMDL Milestone Report', agency: 'State DEQ', due: 'Jun 30, 2025', status: 'In Progress' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{s.submission}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">{s.agency}</span>
                          <span className="text-slate-400">Due: {s.due}</span>
                          <Badge variant="outline" className={`text-[9px] ${s.status === 'Submitted' ? 'border-green-300 text-green-700' : s.status === 'In Progress' ? 'border-amber-300 text-amber-700' : 'border-slate-300 text-slate-600'}`}>{s.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'rpt-adhoc': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-teal-600" />
                    Ad-Hoc Reports
                  </CardTitle>
                  <CardDescription>Generate custom reports from MS4 program data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-slate-400">
                    <FileSpreadsheet className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">Custom Report Generator</p>
                    <p className="text-xs mt-1">Select data sources, parameters, date ranges, and output format to build custom reports</p>
                    <div className="flex flex-wrap gap-2 justify-center mt-4">
                      {['Water Quality', 'BMP Performance', 'Compliance', 'Monitoring', 'Financial'].map(t => (
                        <Badge key={t} variant="outline" className="text-[10px] cursor-pointer hover:bg-slate-50">{t}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            // ── MCM Program sections ─────────────────────────────────────────────
            case 'mcm-dashboard': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LayoutDashboard className="h-5 w-5 text-blue-600" />
                    MCM Program Dashboard
                  </CardTitle>
                  <CardDescription>Overview of all six Minimum Control Measures implementation status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'MCM 1: Public Education', value: '85%', bg: 'bg-green-50 border-green-200' },
                      { label: 'MCM 2: Public Participation', value: '78%', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'MCM 3: Illicit Discharge', value: '92%', bg: 'bg-green-50 border-green-200' },
                      { label: 'MCM 4: Construction', value: '74%', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'MCM 5: Post-Construction', value: '81%', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'MCM 6: Good Housekeeping', value: '88%', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: SWMP tracking system, permit compliance database</p>
                </CardContent>
              </Card>
            );

            case 'mcm-1': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-blue-600" />
                    MCM 1: Public Education & Outreach
                  </CardTitle>
                  <CardDescription>Public education programs on stormwater impacts and pollution prevention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { activity: 'School stormwater curriculum (K-12)', reach: '4,200 students', status: 'Active' },
                      { activity: 'Community workshops (rain gardens)', reach: '320 attendees', status: 'Active' },
                      { activity: 'Social media campaign (#ProtectOurWaters)', reach: '18,500 impressions', status: 'Active' },
                      { activity: 'Door-to-door flyers (target watersheds)', reach: '6,000 households', status: 'Completed' },
                      { activity: 'Business pollution prevention guides', reach: '450 businesses', status: 'In Progress' },
                    ].map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{a.activity}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{a.reach}</span>
                          <Badge variant="outline" className={`text-[9px] ${a.status === 'Active' ? 'border-green-300 text-green-700' : a.status === 'Completed' ? 'border-blue-300 text-blue-700' : 'border-amber-300 text-amber-700'}`}>{a.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'mcm-2': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    MCM 2: Public Involvement & Participation
                  </CardTitle>
                  <CardDescription>Public involvement opportunities in stormwater management program</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { event: 'Annual stream cleanup day', participation: '280 volunteers', date: 'Apr 2025' },
                      { event: 'Stormwater advisory committee meetings', participation: '12 members', date: 'Quarterly' },
                      { event: 'Storm drain marking program', participation: '45 volunteers', date: 'Ongoing' },
                      { event: 'Rain barrel distribution event', participation: '150 barrels', date: 'May 2025' },
                      { event: 'Public comment period (SWMP update)', participation: '34 comments', date: 'Open' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{e.event}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{e.participation}</span>
                          <Badge variant="outline" className="text-[9px]">{e.date}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'mcm-3': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <SearchX className="h-5 w-5 text-red-600" />
                    MCM 3: Illicit Discharge Detection & Elimination
                  </CardTitle>
                  <CardDescription>IDDE program tracking, outfall screening, and investigation results</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: 'Outfalls Mapped', value: '342', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Screened (FY)', value: '128', bg: 'bg-green-50 border-green-200' },
                      { label: 'Illicit Discharges Found', value: '8', bg: 'bg-red-50 border-red-200' },
                      { label: 'Resolved', value: '6', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[
                      { investigation: 'Sanitary cross-connection - Oak St outfall', status: 'Resolved', days: 14 },
                      { investigation: 'Wash water discharge - Industrial Park', status: 'In Progress', days: 7 },
                    ].map((inv, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{inv.investigation}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{inv.days} days</span>
                          <Badge variant="outline" className={`text-[9px] ${inv.status === 'Resolved' ? 'border-green-300 text-green-700' : 'border-amber-300 text-amber-700'}`}>{inv.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'mcm-4': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardHat className="h-5 w-5 text-amber-600" />
                    MCM 4: Construction Site Runoff Control
                  </CardTitle>
                  <CardDescription>Construction site stormwater management and erosion/sediment control</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: 'Active Sites', value: '47', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Inspected (FY)', value: '312', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Violations', value: '18', bg: 'bg-red-50 border-red-200' },
                      { label: 'Resolved', value: '14', bg: 'bg-green-50 border-green-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[
                      { site: 'Riverside Commons Development', acres: 24, status: 'Compliant', lastInspection: '3 days ago' },
                      { site: 'Highway 9 Widening Project', acres: 18, status: 'Violation', lastInspection: '1 week ago' },
                      { site: 'Parkview Subdivision Ph. 3', acres: 12, status: 'Compliant', lastInspection: '5 days ago' },
                    ].map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{s.site} ({s.acres} ac)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">{s.lastInspection}</span>
                          <Badge variant="outline" className={`text-[9px] ${s.status === 'Compliant' ? 'border-green-300 text-green-700' : 'border-red-300 text-red-700'}`}>{s.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'mcm-5': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    MCM 5: Post-Construction Stormwater Management
                  </CardTitle>
                  <CardDescription>Long-term stormwater management for new and redevelopment projects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { item: 'Stormwater management ordinance', status: 'Adopted', detail: 'Updated 2023' },
                      { item: 'Site plan review process', status: 'Active', detail: '32 reviews FY25' },
                      { item: 'Post-construction BMP inspections', status: 'Active', detail: '186 BMPs tracked' },
                      { item: 'Long-term maintenance agreements', status: 'Active', detail: '142 agreements' },
                      { item: 'As-built certification tracking', status: 'Active', detail: '95% compliance' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{item.item}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{item.detail}</span>
                          <Badge variant="outline" className="text-[9px] border-green-300 text-green-700">{item.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'mcm-6': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-green-600" />
                    MCM 6: Pollution Prevention & Good Housekeeping
                  </CardTitle>
                  <CardDescription>Municipal operations pollution prevention and facility management</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { practice: 'Street sweeping program', metric: '2,400 miles/yr', frequency: 'Bi-weekly' },
                      { practice: 'Catch basin cleaning', metric: '1,800 basins', frequency: 'Annual' },
                      { practice: 'Fleet maintenance facility SWPPP', metric: '3 facilities', frequency: 'Annual audit' },
                      { practice: 'Pesticide/herbicide management', metric: 'IPM certified', frequency: 'Ongoing' },
                      { practice: 'Snow/ice management (chloride reduction)', metric: '15% reduction', frequency: 'Seasonal' },
                      { practice: 'Municipal staff training', metric: '94% completed', frequency: 'Annual' },
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{p.practice}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{p.metric}</span>
                          <Badge variant="outline" className="text-[9px]">{p.frequency}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ── Funding sections ─────────────────────────────────────────────────
            case 'fund-srf': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-blue-600" />
                    SRF Program
                  </CardTitle>
                  <CardDescription>State Revolving Fund loans received, terms, and repayment status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Capitalization (State Level)</div>
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
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 mt-4">Municipal Pass-Through</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'SRF Loans Received', value: '3', bg: 'bg-green-50 border-green-200' },
                      { label: 'Outstanding Balance', value: '$8.2M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Interest Rate', value: '1.5%', bg: 'bg-slate-50 border-slate-200' },
                      { label: 'Repayment Status', value: 'Current', bg: 'bg-emerald-50 border-emerald-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-2 italic">Data source: State SRF program, municipal loan records</p>
                </CardContent>
              </Card>
            );

            case 'fund-active': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-green-600" />
                    Active Grants & Funding
                  </CardTitle>
                  <CardDescription>Currently active grants and funding sources for MS4 program</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { grant: 'EPA 319(h) NPS Grant', amount: '$450,000', period: '2023-2026', remaining: '$180,000', status: 'Active' },
                      { grant: 'State SRF Green Infrastructure Loan', amount: '$2.1M', period: '2024-2029', remaining: '$1.8M', status: 'Active' },
                      { grant: 'FEMA BRIC Stormwater Resilience', amount: '$800,000', period: '2024-2027', remaining: '$650,000', status: 'Active' },
                      { grant: 'State Chesapeake Bay Trust', amount: '$125,000', period: '2025-2026', remaining: '$125,000', status: 'New' },
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
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Grants management system, SAM.gov, state funding portals</p>
                </CardContent>
              </Card>
            );

            case 'fund-pipeline': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Funding Pipeline
                  </CardTitle>
                  <CardDescription>Upcoming funding opportunities and application status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { opportunity: 'EPA Water Infrastructure Finance (WIFIA)', amount: 'Up to $5M', deadline: 'Jun 2025', status: 'Preparing' },
                      { opportunity: 'State Stormwater Retrofit Grant', amount: '$250,000', deadline: 'Aug 2025', status: 'Eligible' },
                      { opportunity: 'USDA Rural Water Grant', amount: '$500,000', deadline: 'Sep 2025', status: 'Researching' },
                      { opportunity: 'BIL Emerging Contaminants Fund', amount: '$1M', deadline: 'Nov 2025', status: 'Pre-Application' },
                    ].map((o, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{o.opportunity}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500">{o.amount}</span>
                          <span className="text-slate-400">Due: {o.deadline}</span>
                          <Badge variant="outline" className={`text-[9px] ${o.status === 'Preparing' ? 'border-amber-300 text-amber-700' : o.status === 'Pre-Application' ? 'border-blue-300 text-blue-700' : 'border-slate-300 text-slate-600'}`}>{o.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'fund-stormwater': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-purple-600" />
                    Stormwater Utility Fee
                  </CardTitle>
                  <CardDescription>Stormwater utility fee revenue and expenditure tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: 'Annual Revenue', value: '$3.2M', bg: 'bg-green-50 border-green-200' },
                      { label: 'Expenditures', value: '$2.8M', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Fund Balance', value: '$1.4M', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Rate per ERU', value: '$8.50/mo', bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-3 ${k.bg}`}>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[
                      { category: 'Capital Projects', amount: '$1.2M', pct: '43%' },
                      { category: 'Operations & Maintenance', amount: '$850K', pct: '30%' },
                      { category: 'Monitoring & Compliance', amount: '$420K', pct: '15%' },
                      { category: 'Administration & Education', amount: '$330K', pct: '12%' },
                    ].map((c, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{c.category}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{c.amount}</span>
                          <Badge variant="outline" className="text-[9px]">{c.pct}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            case 'fund-analytics': return DS(
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-teal-600" />
                    Funding Analytics
                  </CardTitle>
                  <CardDescription>Financial analysis and ROI metrics for stormwater investments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { metric: 'Cost per pound pollutant removed (TSS)', value: '$12.40/lb', trend: 'Decreasing' },
                      { metric: 'Cost per impervious acre managed', value: '$2,800/ac', trend: 'Stable' },
                      { metric: 'Grant funding leverage ratio', value: '3.2:1', trend: 'Improving' },
                      { metric: 'Capital project delivery rate', value: '87%', trend: 'Improving' },
                      { metric: 'O&M cost per BMP', value: '$1,450/yr', trend: 'Increasing' },
                    ].map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-xs border border-slate-200 rounded-lg px-3 py-2">
                        <span className="text-slate-700">{m.metric}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-medium">{m.value}</span>
                          <Badge variant="outline" className={`text-[9px] ${m.trend === 'Improving' || m.trend === 'Decreasing' ? 'border-green-300 text-green-700' : m.trend === 'Increasing' ? 'border-amber-300 text-amber-700' : 'border-slate-300 text-slate-600'}`}>{m.trend}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3 italic">Data source: Financial tracking system, program cost-benefit analysis</p>
                </CardContent>
              </Card>
            );

            case 'location-report': return DS(<LocationReportCard />);

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

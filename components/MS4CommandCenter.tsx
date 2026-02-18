'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { feature } from 'topojson-client';
import statesTopo from 'us-atlas/states-10m.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MapPin, Shield, ChevronDown, ChevronUp, Minus, AlertTriangle, CheckCircle, Search, Filter, Droplets, TrendingUp, BarChart3, Building2, Info, LogOut, FileCheck, Lock, Database, Activity, Eye, Fingerprint, Cpu, FlaskConical, ArrowRight, DollarSign, Printer, FileText, Leaf, AlertCircle } from 'lucide-react';
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
import { getRegionMockData, calculateRemovalEfficiency, calculateOverallScore } from '@/lib/mockData';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import dynamic from 'next/dynamic';

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
  maryland_bush_river:        { lat: 39.47, lon: -76.28 },
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

export function MS4CommandCenter({ stateAbbr, ms4Jurisdiction, onSelectRegion, onToggleDevMode }: Props) {
  const stateName = STATE_NAMES[stateAbbr] || stateAbbr;
  const agency = STATE_AGENCIES[stateAbbr] || STATE_AUTHORITIES[stateAbbr] || null;
  const { user, logout } = useAuth();

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

  // ── View (all panels visible — no lens switching for MS4) ──
  const [showAccountPanel, setShowAccountPanel] = useState(false);
  const [overlay, setOverlay] = useState<OverlayId>('impairment');
  const [mapZoom, setMapZoom] = useState(1);
  const [mapCenter, setMapCenter] = useState<[number, number]>(STATE_GEO[stateAbbr]?.center || [-98.5, 39.8]);

  // ── State-filtered region data ──
  const baseRegions = useMemo(() => generateStateRegionData(stateAbbr), [stateAbbr]);

  // ── Map: topo + projection ──
  const topo = useMemo(() => {
    try { return feature(statesTopo as any, (statesTopo as any).objects.states) as any; }
    catch { return null; }
  }, []);

  const stateGeo = jurisdictionMeta?.geo || STATE_GEO[stateAbbr] || { center: [-98.5, 39.8] as [number, number], scale: 1200 };

  // ── ATTAINS bulk for this state ──
  const [attainsBulk, setAttainsBulk] = useState<Array<{ id: string; name: string; category: string; alertLevel: AlertLevel; causes: string[]; cycle: string }>>([]);
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
    if (addedCount > 0) console.log(`[SCC] Added ${addedCount} ATTAINS-only Cat 4/5 waterbodies for ${stateAbbr}`);
    return merged;
  }, [baseRegions, attainsBulk, stateAbbr]);

  // ── Jurisdiction-scoped region data (MS4 permit filter) ──
  // ── Resolve coordinates for ALL region data (not just scoped) ──
  // This lets us geo-assign waterbodies to jurisdictions
  const allWbCoords = useMemo(() => {
    const resolved: Array<{ id: string; name: string; lat: number; lon: number; alertLevel: AlertLevel; status: string; dataSourceCount: number; regionIdx: number }> = [];
    regionData.forEach((r, idx) => {
      // Priority 1: precise jurisdiction waterbody coordinates
      const precise = WATERBODY_COORDS[r.id];
      if (precise) {
        resolved.push({ id: r.id, name: r.name, lat: precise.lat, lon: precise.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: idx });
        return;
      }
      // Priority 2: regionsConfig
      const cfg = getRegionById(r.id) as any;
      if (cfg) {
        const lat = cfg.lat ?? cfg.latitude ?? null;
        const lon = cfg.lon ?? cfg.lng ?? cfg.longitude ?? null;
        if (lat != null && lon != null) {
          resolved.push({ id: r.id, name: r.name, lat, lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: idx });
          return;
        }
      }
      // Priority 3: name-based coordinate resolver
      const approx = resolveWaterbodyCoordinates(r.name, stateAbbr);
      if (approx) {
        resolved.push({ id: r.id, name: r.name, lat: approx.lat, lon: approx.lon, alertLevel: r.alertLevel, status: r.status, dataSourceCount: r.dataSourceCount, regionIdx: idx });
      }
    });
    return resolved;
  }, [regionData, stateAbbr]);

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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({ top10: true, potomac: true, storms: true, mdeexport: true, tmdl: true, nutrientcredits: true, stormsim: true, economics: true });
  const toggleCollapse = (id: string) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isSectionOpen = (id: string) => !collapsedSections[id];


  const printSection = (sectionId: string, title: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    // Grab all stylesheets from the current page
    const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(s => s.outerHTML).join('\n');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title} — PEARL MS4 Compliance Center</title>${styleSheets}
      <style>
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { padding: 24px; background: white; font-family: system-ui, -apple-system, sans-serif; }
        .print-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0891b2; padding-bottom: 12px; margin-bottom: 20px; }
        .print-header h1 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
        .print-header .meta { font-size: 11px; color: #64748b; text-align: right; }
        .print-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head><body>
      <div class="print-header">
        <h1>${title}</h1>
        <div class="meta">PEARL MS4 Compliance Center<br/>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br/>project-pearl.org</div>
      </div>
      ${el.innerHTML}
      <div class="print-footer">Generated by PEARL MS4 Compliance Center &bull; project-pearl.org &bull; ${new Date().toLocaleString()}</div>
    </body></html>`);
    printWindow.document.close();
    // Wait for styles to load then print
    setTimeout(() => { printWindow.print(); }, 600);
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
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ waterbodies: true, ms4: true, provenance: false });
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

        {/* ── HEADER ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="relative h-12 w-40 cursor-default select-none"
              onDoubleClick={() => onToggleDevMode?.()}
            >
              <Image src="/Logo_Pearl_as_Headline.JPG" alt="Project Pearl Logo" fill className="object-contain object-left" priority />
            </div>
            <div>
              <div className="text-xl font-semibold text-slate-800">MS4 Compliance Center</div>
              <div className="text-sm text-slate-600">
                Real-time BMP verification, automated MDE reporting &amp; TMDL credit tracking — tailored for your jurisdiction
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
                {user.name || (jurisdictionMeta ? jurisdictionMeta.name + ' Operator' : 'MS4 Operator')}
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
                      onClick={() => { /* TODO: wire to password change route */ }}
                      className="w-full text-left px-3 py-2 rounded-md text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors"
                    >
                      <Shield size={13} className="text-slate-400" />
                      Change Password
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
          </div>
        </div>

        {/* ── AI INSIGHTS ── */}
        <AIInsightsEngine key={stateAbbr} role="MS4" stateAbbr={stateAbbr} regionData={scopedRegionData as any} />

        {/* ── MS4 JURISDICTION SNAPSHOT — compliance-at-a-glance strip ── */}
        {jurisdictionMeta && (() => {
          const activeAlerts = scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium');
          const severeCount = scopedRegionData.filter(r => r.alertLevel === 'high').length;
          const assessedCount = scopedRegionData.filter(r => r.status === 'assessed').length;
          const impairedCount = scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
          const ejScore = getEJScore(stateAbbr);
          const ejLabel = ejScoreLabel(ejScore);

          // Data freshness: mock based on data source count
          const withData = scopedRegionData.filter(r => r.dataSourceCount > 0).length;
          const freshnessLabel = withData > scopedRegionData.length * 0.7 ? 'Current' : withData > scopedRegionData.length * 0.3 ? 'Moderate' : 'Stale';
          const freshnessBg = freshnessLabel === 'Current' ? 'bg-green-100 text-green-700 border-green-200' : freshnessLabel === 'Moderate' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200';

          // Compliance status from ms4Summary
          const complianceStatus = ms4Summary ? (
            jurisdictions.find((j: any) => j.name === jurisdictionMeta.name)?.status || 'Under Review'
          ) : 'Under Review';
          const complianceBg = complianceStatus === 'In Compliance' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
            complianceStatus === 'Consent Decree' || complianceStatus === 'NOV Issued' ? 'bg-red-100 text-red-800 border-red-200' :
            'bg-amber-100 text-amber-800 border-amber-200';

          return (
          <div className="space-y-3">
            {/* Identity row */}
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

            {/* Quick Compliance Actions — scroll to + expand sections */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-3">
              <div className="flex items-center gap-2 mb-2">
                <FileCheck className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Quick Actions</span>
                {!activeDetailId && <span className="text-[10px] text-slate-400 italic ml-1">Select a waterbody to enable report tools</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={!activeDetailId || !regionMockData}
                  onClick={() => {
                    setCollapsedSections(prev => ({ ...prev, mdeexport: false }));
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
                    setCollapsedSections(prev => ({ ...prev, tmdl: false }));
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
                    setCollapsedSections(prev => ({ ...prev, nutrientcredits: false }));
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
                    setCollapsedSections(prev => ({ ...prev, stormsim: false }));
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
                    setCollapsedSections(prev => ({ ...prev, economics: false }));
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
                        ['Framework', 'Relevant Standards', 'PEARL Coverage'],
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
          </div>
          );
        })()}


        {/* ── STATEWIDE ALERT FEED — above map ── */}
        {(() => {
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
        })()}

        {/* ── MAIN CONTENT: Map (2/3) + Waterbody List (1/3) ── */}
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

              {!topo ? (
                <div className="p-8 text-sm text-slate-500 text-center">
                  Map data unavailable. Install react-simple-maps, us-atlas, and topojson-client.
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="p-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span>{jurisdictionMeta ? jurisdictionMeta.name : stateName} · {scopedRegionData.length} waterbodies monitored</span>
                    {attainsBulkLoaded && <span className="text-green-600 font-medium">● ATTAINS live</span>}
                  </div>
                  <div className="h-[480px] w-full relative">
                    <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                      <button onClick={() => setMapZoom(z => Math.min(z * 1.5, 12))} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold">+</button>
                      <button onClick={() => setMapZoom(z => Math.max(z / 1.5, 1))} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold">{'\u2212'}</button>
                      <button onClick={() => { setMapZoom(1); setMapCenter(stateGeo.center); }} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 text-[10px] font-medium">{'\u2302'}</button>
                    </div>
                    <ComposableMap
                      projection="geoMercator"
                      projectionConfig={{ center: stateGeo.center, scale: stateGeo.scale }}
                      width={800}
                      height={500}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <ZoomableGroup zoom={mapZoom} center={mapCenter} onMoveEnd={({ coordinates, zoom }) => { setMapCenter(coordinates as [number, number]); setMapZoom(zoom); }} minZoom={1} maxZoom={12}>
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
                                    strokeWidth: (isSelected ? 1.5 : 0.3) / mapZoom,
                                  },
                                  hover: {
                                    fill: isSelected ? '#c7d2fe' : '#f1f5f9',
                                    outline: 'none',
                                    stroke: isSelected ? '#4338ca' : '#cbd5e1',
                                    strokeWidth: (isSelected ? 1.5 : 0.3) / mapZoom,
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
                        const baseR = wbMarkers.length > 150 ? 2.5 : wbMarkers.length > 50 ? 3.5 : 4.5;
                        return (
                          <Marker key={wb.id} coordinates={[wb.lon, wb.lat]}>
                            <circle
                              r={(isActive ? 7 : baseR) / mapZoom}
                              fill={markerColor}
                              stroke={isActive ? '#1e40af' : '#ffffff'}
                              strokeWidth={(isActive ? 2.5 : wbMarkers.length > 150 ? 0.8 : 1.5) / mapZoom}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setActiveDetailId(isActive ? null : wb.id)}
                            />
                            {isActive && (
                              <text
                                textAnchor="middle"
                                y={-12 / mapZoom}
                                style={{ fontSize: `${10 / mapZoom}px`, fontWeight: 700, fill: '#1e3a5f', pointerEvents: 'none' }}
                              >
                                {wb.name}
                              </text>
                            )}
                          </Marker>
                        );
                      })}
                      </ZoomableGroup>
                    </ComposableMap>
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

        {/* ── DETAIL + RESTORATION (full width below map grid) — lens controlled ── */}
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

            {/* Waterbody Detail Card */}
            {activeDetailId && (() => {
              const nccRegion = scopedRegionData.find(r => r.id === activeDetailId);
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



        {/* ── MDE COMPLIANCE REPORT — waterbody-level, requires mock data ── */}
        {activeDetailId && regionMockData && (() => {
          const nccRegion = scopedRegionData.find(r => r.id === activeDetailId);
          const regionConfig = getRegionById(activeDetailId);
          const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ');
          return (
            <div id="section-mdeexport" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapse('mdeexport')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">📄 MDE Compliance Report — {regionName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('mdeexport') && <span onClick={(e) => { e.stopPropagation(); printSection('section-mdeexport', `MDE Compliance Report — ${regionName}`); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
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
        })()}

        {/* ── TMDL COMPLIANCE & REPORT GENERATOR — waterbody-level, requires mock data ── */}
        {activeDetailId && regionMockData && (() => {
          const activeAlertCount = scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
          return (
            <div id="section-tmdl" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapse('tmdl')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">🎯 TMDL Compliance & EJ Impact — {scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('tmdl') && <span onClick={(e) => { e.stopPropagation(); printSection('section-tmdl', `TMDL Compliance & EJ Impact — ${scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId}`); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
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
        })()}

        {/* ── NUTRIENT CREDITS TRADING — waterbody-level, requires mock data ── */}
        {activeDetailId && regionMockData && (() => {
          const wbName = scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId;
          return (
            <div id="section-nutrientcredits" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapse('nutrientcredits')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">💰 Nutrient Credit Trading — {wbName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('nutrientcredits') && <span onClick={(e) => { e.stopPropagation(); printSection('section-nutrientcredits', `Nutrient Credit Trading — ${wbName}`); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
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
        })()}

        {/* ── STORM EVENT BMP PERFORMANCE — waterbody-level, requires storm data ── */}
        {activeDetailId && stormEvents.length > 0 && selectedStormEvent && (() => {
          const wbName = scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId;
          return (
            <div id="section-stormsim" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapse('stormsim')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">🌧️ Storm Event BMP Performance — {wbName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('stormsim') && <span onClick={(e) => { e.stopPropagation(); printSection('section-stormsim', `Storm Event BMP Performance — ${wbName}`); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
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
                    {[
                      { key: 'DO', label: 'Dissolved Oxygen', unit: 'mg/L' },
                      { key: 'turbidity', label: 'Turbidity', unit: 'NTU' },
                      { key: 'TN', label: 'Total Nitrogen', unit: 'mg/L' },
                      { key: 'TP', label: 'Total Phosphorus', unit: 'mg/L' },
                      { key: 'TSS', label: 'Total Suspended Solids', unit: 'mg/L' },
                    ].map(p => {
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
                          ['Source: PEARL Continuous Monitoring Platform | project-pearl.org']
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
                        const subject = encodeURIComponent(`PEARL Storm Event Report — ${wbName} — ${event.name}`);
                        const body = encodeURIComponent(
                          `PEARL Storm Event BMP Performance Report\n` +
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
        })()}

        {/* ── COMPLIANCE ECONOMICS — waterbody-level, requires mock data ── */}
        {activeDetailId && regionMockData && (() => {
          const wbName = scopedRegionData.find(r => r.id === activeDetailId)?.name || activeDetailId;
          // Infer tier from jurisdiction phase
          const tier = jurisdictionMeta?.phase === 'Phase I' ? 'large' as const : 'medium' as const;
          return (
            <div id="section-economics" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <button onClick={() => toggleCollapse('economics')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                <span className="text-sm font-bold text-slate-800">💲 Compliance Economics — {jurisdictionMeta?.name || wbName}</span>
                <div className="flex items-center gap-1">
                  {isSectionOpen('economics') && <span onClick={(e) => { e.stopPropagation(); printSection('section-economics', `Compliance Economics — ${jurisdictionMeta?.name || wbName}`); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
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
        })()}

        {/* ── TOP 10 WORSENING / IMPROVING — full + programs view ── */}
        {(
        <div id="section-top10" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('top10')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">🔥 Top 5 Worsening / Improving Waterbodies</span>
            <div className="flex items-center gap-1">
              {isSectionOpen('top10') && <span onClick={(e) => { e.stopPropagation(); printSection('section-top10', 'Top 5 Worsening / Improving Waterbodies'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
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
        )}

        {/* ── DATA PROVENANCE & CHAIN OF CUSTODY — regulator audit view ── */}
        {(
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
                What {(agency as any)?.division || 'your regulatory authority'} would find in an audit of PEARL monitoring data across {stateName}
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
                    PEARL monitoring meets EPA QA/R-5 (Quality Assurance Project Plan) standards and {stateAbbr === 'MD' ? 'MDE' : stateAbbr === 'FL' ? 'FDEP' : stateAbbr === 'VA' ? 'VA DEQ' : (agency as any)?.name?.split(' ')[0] || 'state'} data quality requirements for MS4 permit compliance. All data is traceable, auditable, and defensible.
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
                          PEARL generates <strong>32,850× more data points</strong> with no field crew deployment.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-amber-300 rounded-md p-2.5">
                    <div className="text-[10px] text-amber-900">
                      <strong>Regulatory Compliance:</strong> All sensors meet EPA QA/R-5 quality assurance requirements.
                      PEARL sites align with QA GLP classification. Lab &amp; NIST/IEEE 17025 accredited.{' '}
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
                        { icon: Cpu, label: 'PEARL Sensor', sub: 'YSI EXO2 probe' },
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
                    <div className="text-sm font-bold text-slate-800">Data Defensibility: PEARL vs Traditional Grab Sampling</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="text-left px-3 py-2 font-semibold text-slate-700">Criteria</th>
                          <th className="text-center px-3 py-2 font-semibold text-indigo-700 bg-indigo-50/50">PEARL Continuous</th>
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
                      { phase: 'Phase 1: Parallel Operation', desc: `PEARL runs alongside traditional grab sampling. Side-by-side validation confirms accuracy. No changes to current ${(agency as any)?.ms4Program || 'MS4 permit'} reporting.`, timeline: `Year 1`, goal: 'Prove equivalency', color: 'border-blue-300 bg-blue-50', textColor: 'text-blue-800', dotColor: 'bg-blue-500' },
                      { phase: 'Phase 2: Storm Events & Trend Reporting', desc: `Continuous data becomes primary source for storm event characterization (per 40 CFR §122.26). Traditional grab sampling continues quarterly.`, timeline: `Year 1-2`, goal: 'Primary for storms', color: 'border-emerald-300 bg-emerald-50', textColor: 'text-emerald-800', dotColor: 'bg-emerald-500' },
                      { phase: 'Phase 3: Reduce Grab Frequency', desc: `${stateAbbr === 'MD' ? 'MDE' : 'State'} may accept reduced grab frequency based on PEARL's correlation record. Confirmatory sampling validates sensor consistency.`, timeline: `Year 2-3`, goal: 'Correlation proven', color: 'border-green-300 bg-green-50', textColor: 'text-green-800', dotColor: 'bg-green-500' },
                      { phase: 'Phase 4: Primary Data Stream', desc: `PEARL serves as primary data with periodic validation sampling for sensor QA/QC. Traditional grab retained for parameters not measured by sensors.`, timeline: `Year 3+`, goal: 'Full continuous', color: 'border-green-400 bg-green-100', textColor: 'text-green-900', dotColor: 'bg-green-600' },
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
                    {stateAbbr === 'MD' ? 'MDE requires' : `${stateName} regulations require`} that monitoring data used for permit compliance be analyzed by a {stateAbbr === 'MD' ? 'Maryland' : 'state'}-certified laboratory. PEARL addresses this through a structured split-sample program.
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
                    <div className="text-sm font-bold text-slate-800">{stateName} PEARL Fleet — Acceptance Status</div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Aggregate view of phased acceptance progress across all PEARL deployments in {stateName}.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Sites', value: scopedRegionData.filter(r => r.status === 'assessed').length > 0 ? '1' : '0', sub: 'PEARL deployments', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
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
                    Fleet data updates as PEARL deployments complete validation phases. Correlation scores calculated after 90 days of parallel sensor + grab sample data.
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
                    PEARL's status in the {stateAbbr === 'MD' ? 'Maryland Water Quality Trading Program' : stateAbbr === 'VA' ? 'Virginia Nutrient Credit Exchange' : 'state nutrient trading framework'}:
                  </p>
                  <div className="space-y-2">
                    {[
                      { step: '1. BMP Registration', status: 'In Progress', detail: 'PEARL filed as nature-based BMP with provisional patent documentation', statusColor: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🔄' },
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
                      <strong>Important:</strong> No PEARL nutrient credits are currently certified, banked, or tradeable.
                      Credit values shown elsewhere in this dashboard are <em>projected estimates</em> for planning purposes only.
                      Actual credit generation requires completing all 5 steps above.
                    </div>
                  </div>
                </div>
                )}

                <div className="text-[10px] text-slate-400 italic">
                  Source: PEARL monitoring infrastructure specifications, EPA QA/R-5 framework, {(agency as any)?.name || 'state agency'} data quality requirements.
                  QAPP documentation available upon request.
                </div>

              </CardContent>
            )}
          </Card>
        )}

        {/* ── DATA EXPORT HUB ── */}
        <div id="section-exporthub" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('exporthub')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">📦 Data Export Hub</span>
            <div className="flex items-center gap-1">
              {isSectionOpen('exporthub') && <span onClick={(e) => { e.stopPropagation(); printSection('section-exporthub', 'Data Export Hub'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
              {isSectionOpen('exporthub') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('exporthub') && (
            <div className="p-4">
              <DataExportHub context="ms4" />
            </div>
          )}
        </div>


        {/* ── GRANT OPPORTUNITIES — always visible at state level ── */}
        <div id="section-grants" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">💰 Grant Opportunities — {stateName}</span>
            <div className="flex items-center gap-1">
              {isSectionOpen('grants') && <span onClick={(e) => { e.stopPropagation(); printSection('section-grants', `Grant Opportunities — ${stateName}`); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
              {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {isSectionOpen('grants') && (
            <GrantOpportunityMatcher
              regionId={activeDetailId || `${stateAbbr.toLowerCase()}_statewide`}
              removalEfficiencies={removalEfficiencies as any}
              alertsCount={scopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length}
              userRole="State"
            />
          )}
        </div>

        {/* ── DISCLAIMER FOOTER ── */}
        <PlatformDisclaimer />

      </div>
    </div>
  );
}

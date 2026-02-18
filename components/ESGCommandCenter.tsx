// components/ESGCommandCenter.tsx
// Corporate ESG Command Center — portfolio water risk, disclosure readiness, impact reporting
// Architecture: SCC lens system + ESG-specific sections + existing ESG components from page.tsx

'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { feature } from 'topojson-client';
import statesTopo from 'us-atlas/states-10m.json';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, BarChart3, Shield, TrendingUp, TrendingDown, AlertTriangle, ChevronDown,
  Minus, MapPin, Building2, FileText, Award, Globe, Leaf, Users, Target,
  DollarSign, Eye, Lock, Activity, ArrowRight, ChevronRight, Search, Filter,
  Download, ExternalLink, Star, Zap, Heart, Scale, X, LogOut, Printer,
  CheckCircle2, Circle, AlertCircle, Sparkles, ClipboardList, Link2, PenTool, Package
} from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { getRegionById } from '@/lib/regionsConfig';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import dynamic from 'next/dynamic';

const DataExportHub = dynamic(
  () => import('@/components/DataExportHub').then((mod) => mod.DataExportHub),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = 'high' | 'medium' | 'low' | 'none';

type FacilityRow = {
  id: string;
  name: string;
  state: string;
  type: 'manufacturing' | 'office' | 'warehouse' | 'datacenter' | 'retail' | 'other';
  alertLevel: AlertLevel;
  activeAlerts: number;
  lastUpdatedISO: string;
  status: 'monitored' | 'assessed' | 'unmonitored';
  dataSourceCount: number;
  waterRiskScore: number;    // 0-100, higher = more risk
  attainsId?: string;
  lat?: number;
  lon?: number;
  // Treatment metrics (per facility)
  gallonsTreated?: number;
  tnReduced?: number;   // lbs TN removed
  tpReduced?: number;   // lbs TP removed
  tssReduced?: number;  // lbs TSS removed
  tssEfficiency?: number; // % TSS removal
  receivingWaterbody?: string;
  huc12?: string;
  ejScore?: number;     // 0-100 EJScreen burden
};

type ESGLens = 'overview' | 'disclosure' | 'risk' | 'impact' | 'compliance';

type LensConfig = {
  label: string;
  description: string;
  icon: any;
  showMap: boolean;
  showImpact: boolean;
  showDisclosure: boolean;
  showRisk: boolean;
  showCompliance: boolean;
  showBenchmark: boolean;
  showGrants: boolean;
  showBrand: boolean;
  showShareholder: boolean;
};

const LENS_CONFIG: Record<ESGLens, LensConfig> = {
  overview: {
    label: 'Executive Overview',
    description: 'Portfolio-level ESG summary for leadership',
    icon: Building2,
    showMap: true, showImpact: true, showDisclosure: true, showRisk: true,
    showCompliance: true, showBenchmark: true, showGrants: false, showBrand: true, showShareholder: true,
  },
  disclosure: {
    label: 'Disclosure & Reporting',
    description: 'GRI, SASB, CDP, TCFD framework readiness',
    icon: FileText,
    showMap: false, showImpact: true, showDisclosure: true, showRisk: false,
    showCompliance: true, showBenchmark: false, showGrants: false, showBrand: false, showShareholder: true,
  },
  risk: {
    label: 'Water Risk Portfolio',
    description: 'Facility-level water stress & impairment exposure',
    icon: AlertTriangle,
    showMap: true, showImpact: false, showDisclosure: false, showRisk: true,
    showCompliance: true, showBenchmark: true, showGrants: false, showBrand: false, showShareholder: false,
  },
  impact: {
    label: 'Environmental Impact',
    description: 'Measured outcomes & ecosystem restoration metrics',
    icon: Leaf,
    showMap: true, showImpact: true, showDisclosure: false, showRisk: false,
    showCompliance: false, showBenchmark: true, showGrants: true, showBrand: true, showShareholder: false,
  },
  compliance: {
    label: 'Regulatory Compliance',
    description: 'Permit status, violations, enforcement exposure',
    icon: Shield,
    showMap: true, showImpact: false, showDisclosure: false, showRisk: true,
    showCompliance: true, showBenchmark: false, showGrants: true, showBrand: false, showShareholder: false,
  },
};

// ─── Overlay types for map ───────────────────────────────────────────────────

type OverlayId = 'waterrisk' | 'compliance' | 'impact';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'waterrisk', label: 'Water Risk', description: 'Facility water stress exposure from ATTAINS & WRI Aqueduct', icon: Droplets },
  { id: 'compliance', label: 'Compliance Status', description: 'EPA ECHO violations & permit status', icon: Shield },
  { id: 'impact', label: 'PEARL Impact', description: 'Active treatment performance by facility', icon: Leaf },
];

function getMarkerColor(overlay: OverlayId, f: FacilityRow): string {
  if (overlay === 'waterrisk') {
    return f.waterRiskScore >= 70 ? '#ef4444' :
           f.waterRiskScore >= 40 ? '#f59e0b' :
           f.waterRiskScore >= 20 ? '#eab308' : '#22c55e';
  }
  if (overlay === 'compliance') {
    return f.alertLevel === 'high' ? '#ef4444' :
           f.alertLevel === 'medium' ? '#f59e0b' :
           f.alertLevel === 'low' ? '#eab308' : '#22c55e';
  }
  // impact: monitored vs not
  if (f.status === 'monitored') return '#166534';
  if (f.status === 'assessed') return '#f59e0b';
  return '#9ca3af';
}

// ─── ESG Disclosure Frameworks ───────────────────────────────────────────────

interface DisclosureFramework {
  id: string;
  name: string;
  fullName: string;
  relevantMetrics: string[];
  status: 'ready' | 'partial' | 'gap';
  coverage: number; // 0-100%
}

const ESG_FRAMEWORKS: DisclosureFramework[] = [
  {
    id: 'gri303', name: 'GRI 303', fullName: 'GRI 303: Water & Effluents',
    relevantMetrics: ['303-1: Water withdrawal', '303-2: Mgmt of discharge impacts', '303-3: Water withdrawal by source', '303-4: Water discharge', '303-5: Water consumption'],
    status: 'partial', coverage: 65,
  },
  {
    id: 'gri13', name: 'GRI 13', fullName: 'GRI 13: Agriculture, Aquaculture & Fishing',
    relevantMetrics: ['13.7: Water & effluents', '13.8: Biodiversity', '13.4: Natural ecosystem conversion', '13.10: Local communities'],
    status: 'partial', coverage: 50,
  },
  {
    id: 'sasb', name: 'SASB', fullName: 'SASB Food & Beverage / Meat & Seafood',
    relevantMetrics: ['FB-MP-140a.1: Water withdrawn in stressed basins', 'FB-MP-140a.2: Incidents of non-compliance', 'FB-MP-140a.3: Water mgmt risks', 'FB-SF-140a.3: Fleet water impact'],
    status: 'partial', coverage: 55,
  },
  {
    id: 'cdp', name: 'CDP Water', fullName: 'CDP Water Security Questionnaire',
    relevantMetrics: ['W1: Current State', 'W2: Business Impacts', 'W3: Procedures', 'W4: Risk Assessment', 'W8: Targets & Goals'],
    status: 'gap', coverage: 30,
  },
  {
    id: 'tcfd', name: 'TCFD', fullName: 'Task Force on Climate-related Financial Disclosures',
    relevantMetrics: ['Physical Risk (water stress / Bay impairments)', 'Transition Risk (regulation / TMDLs)', 'Metrics & Targets (nutrient credits)'],
    status: 'partial', coverage: 45,
  },
  {
    id: 'tnfd', name: 'TNFD', fullName: 'Taskforce on Nature-related Financial Disclosures',
    relevantMetrics: ['Dependencies on aquatic ecosystems', 'Impacts on freshwater & estuarine systems', 'Risk management', 'Restoration metrics & targets'],
    status: 'gap', coverage: 20,
  },
];

// ─── Close the Gap — framework-specific gap analysis data ────────────────────

type GapStatus = 'red' | 'amber' | 'green';
type WizardStep = 1 | 2 | 3 | 4;
const WIZARD_STEPS: { step: WizardStep; label: string; icon: any }[] = [
  { step: 1, label: 'Review Gaps', icon: ClipboardList },
  { step: 2, label: 'Connect Data', icon: Link2 },
  { step: 3, label: 'Generate Narrative', icon: PenTool },
  { step: 4, label: 'Export Package', icon: Package },
];

interface GapField { field: string; status: GapStatus; description: string }
interface PearlMapping { field: string; pearlParameter: string; availability: 'available' | 'partial' | 'planned' }
interface EvidenceExhibit { name: string; type: 'chart' | 'table' | 'report' | 'export'; description: string }
interface CloseTheGapEntry { missingFields: GapField[]; pearlMappings: PearlMapping[]; narrativeTemplate: string; evidenceExhibits: EvidenceExhibit[] }

const CLOSE_THE_GAP: Record<string, CloseTheGapEntry> = {
  gri303: {
    missingFields: [
      { field: '303-1: Water withdrawal by source', status: 'amber', description: 'Surface water, groundwater, third-party breakdown required' },
      { field: '303-2: Management of discharge impacts', status: 'green', description: 'BMP verification & TMDL tracking available via PEARL' },
      { field: '303-3: Water withdrawal (water-stressed areas)', status: 'red', description: 'Need facility-level intake volumes + WRI Aqueduct overlay' },
      { field: '303-4: Water discharge by destination', status: 'amber', description: 'Receiving waterbody identified; need volume + quality breakdown' },
      { field: '303-5: Water consumption', status: 'red', description: 'Consumption = withdrawal minus discharge; need intake metering data' },
    ],
    pearlMappings: [
      { field: '303-1: Water withdrawal by source', pearlParameter: 'ATTAINS waterbody type + facility HUC-12 intake classification', availability: 'partial' },
      { field: '303-2: Management of discharge impacts', pearlParameter: 'BMP verification records, TMDL progress tracking, nutrient load reductions (TN/TP/TSS)', availability: 'available' },
      { field: '303-3: Water withdrawal (water-stressed areas)', pearlParameter: 'WRI Aqueduct water-stress scores overlaid on facility locations', availability: 'partial' },
      { field: '303-4: Water discharge by destination', pearlParameter: 'Receiving waterbody ID, NPDES discharge monitoring reports (DMRs)', availability: 'available' },
      { field: '303-5: Water consumption', pearlParameter: 'Calculated from PEARL intake/discharge differential per facility', availability: 'planned' },
    ],
    narrativeTemplate: 'During the reporting period, [Company] withdrew approximately [X] megaliters of water across [N] facilities monitored through the PEARL platform. Surface water accounted for [Y]% of total withdrawal, primarily from Chesapeake Bay watershed tributaries.\n\nDischarge impacts are managed through verified BMPs achieving [TN]% nitrogen reduction and [TP]% phosphorus reduction against TMDL targets. All facilities discharge to waterbodies tracked in EPA ATTAINS, with [Z]% meeting designated use standards.\n\nFacilities in water-stressed basins (WRI Aqueduct score >=3) represent [W]% of total withdrawal. Water consumption totaled [C] megaliters, calculated as the differential between metered withdrawal and monitored discharge volumes.',
    evidenceExhibits: [
      { name: 'Facility Water Risk Heatmap', type: 'chart', description: 'Interactive map showing water stress scores per facility location' },
      { name: 'Nutrient Load Reduction Summary', type: 'table', description: 'TN/TP/TSS reduction by facility with BMP verification status' },
      { name: 'ATTAINS Waterbody Assessment Report', type: 'report', description: 'EPA impairment status for all receiving waterbodies' },
      { name: 'Discharge Monitoring Data Export', type: 'export', description: 'Monthly DMR data in GRI-compatible CSV format' },
    ],
  },
  gri13: {
    missingFields: [
      { field: '13.7: Water & effluents in operations', status: 'amber', description: 'Aquaculture/agriculture water use and discharge quality' },
      { field: '13.8: Biodiversity in operational areas', status: 'amber', description: 'Species counts and habitat quality near facilities' },
      { field: '13.4: Natural ecosystem conversion', status: 'red', description: 'Land-use change data for operational footprint' },
      { field: '13.10: Local community water impacts', status: 'green', description: 'EJScreen data + community proximity analysis available' },
    ],
    pearlMappings: [
      { field: '13.7: Water & effluents in operations', pearlParameter: 'Facility discharge parameters (TN, TP, TSS, DO) + BMP records', availability: 'available' },
      { field: '13.8: Biodiversity in operational areas', pearlParameter: 'Chesapeake Bay species indices, SAV coverage, benthic IBI', availability: 'partial' },
      { field: '13.4: Natural ecosystem conversion', pearlParameter: 'NLCD land cover change detection (planned integration)', availability: 'planned' },
      { field: '13.10: Local community water impacts', pearlParameter: 'EJScreen burden scores, community water supply impairment data', availability: 'available' },
    ],
    narrativeTemplate: '[Company] operations interact with freshwater and estuarine ecosystems across [N] facilities in the Chesapeake Bay watershed. Water effluent management follows TMDL-aligned reduction targets, with PEARL-verified BMPs achieving measurable nutrient load reductions.\n\nBiodiversity monitoring leverages PEARL platform data including submerged aquatic vegetation (SAV) coverage and benthic index of biological integrity (IBI) for waterbodies adjacent to operations.\n\nEnvironmental justice screening (EJScreen) confirms [X]% of facility communities fall below the 80th percentile burden threshold, with active community engagement programs in high-burden areas.',
    evidenceExhibits: [
      { name: 'Biodiversity Indicator Dashboard', type: 'chart', description: 'SAV, benthic IBI, and species trends near operational areas' },
      { name: 'EJScreen Community Impact Report', type: 'report', description: 'Environmental justice scores for all facility zip codes' },
      { name: 'Effluent Quality Trend Data', type: 'export', description: 'Monthly water quality parameters by facility' },
    ],
  },
  sasb: {
    missingFields: [
      { field: 'FB-MP-140a.1: Water withdrawn in stressed basins', status: 'amber', description: 'Facility-level volumes in WRI high-stress basins needed' },
      { field: 'FB-MP-140a.2: Non-compliance incidents', status: 'green', description: 'ECHO violation data integrated via PEARL' },
      { field: 'FB-MP-140a.3: Water management risks', status: 'amber', description: 'Risk narrative linking water stress to business continuity' },
      { field: 'FB-SF-140a.3: Fleet water impact', status: 'red', description: 'Supply chain water footprint not yet quantified' },
    ],
    pearlMappings: [
      { field: 'FB-MP-140a.1: Water withdrawn in stressed basins', pearlParameter: 'WRI Aqueduct overlay + facility HUC-12 withdrawal estimates', availability: 'partial' },
      { field: 'FB-MP-140a.2: Non-compliance incidents', pearlParameter: 'EPA ECHO compliance data, permit violation history', availability: 'available' },
      { field: 'FB-MP-140a.3: Water management risks', pearlParameter: 'PEARL water risk scores + TMDL exposure analysis', availability: 'available' },
      { field: 'FB-SF-140a.3: Fleet water impact', pearlParameter: 'Supply chain water risk mapping (planned feature)', availability: 'planned' },
    ],
    narrativeTemplate: '[Company] operates [N] facilities, of which [X] are located in basins classified as high or extremely high water stress per WRI Aqueduct. Total water withdrawn in stressed basins was approximately [Y] megaliters.\n\nDuring the reporting period, [Z] incidents of water-related non-compliance were recorded across the portfolio, as tracked through EPA ECHO integration in the PEARL platform. All incidents were remediated within [D] days.\n\nWater management risks are assessed quarterly using PEARL composite water risk scoring, which integrates TMDL status, impairment listings, and regulatory trajectory for each facility receiving waterbody.',
    evidenceExhibits: [
      { name: 'Water Stress Basin Map', type: 'chart', description: 'Facilities overlaid on WRI Aqueduct stress classification' },
      { name: 'ECHO Compliance History', type: 'table', description: 'Permit violations and remediation timelines' },
      { name: 'Water Risk Score Export', type: 'export', description: 'Facility-level risk scores with methodology documentation' },
    ],
  },
  cdp: {
    missingFields: [
      { field: 'W1: Current state — water accounting', status: 'red', description: 'Total withdrawal, discharge, consumption volumes by source' },
      { field: 'W2: Business impacts of water issues', status: 'red', description: 'Financial quantification of water-related business impacts' },
      { field: 'W3: Procedures for water assessment', status: 'amber', description: 'Documented water risk assessment methodology' },
      { field: 'W4: Risk assessment details', status: 'amber', description: 'Basin-level risk with likelihood/magnitude scoring' },
      { field: 'W8: Targets & goals', status: 'red', description: 'Quantitative water reduction targets with timelines' },
    ],
    pearlMappings: [
      { field: 'W1: Current state — water accounting', pearlParameter: 'Facility-level water parameters, BMP treatment volumes, discharge monitoring', availability: 'partial' },
      { field: 'W2: Business impacts of water issues', pearlParameter: 'Nutrient credit valuations, compliance cost tracking, risk exposure scores', availability: 'partial' },
      { field: 'W3: Procedures for water assessment', pearlParameter: 'PEARL risk scoring methodology documentation + QAPP-grade QA/QC', availability: 'available' },
      { field: 'W4: Risk assessment details', pearlParameter: 'Per-facility water risk scores, TMDL exposure, impairment trends by HUC-12', availability: 'available' },
      { field: 'W8: Targets & goals', pearlParameter: 'TMDL reduction targets, BMP implementation milestones, restoration timeline', availability: 'partial' },
    ],
    narrativeTemplate: '[Company] completed a comprehensive water security assessment across [N] facilities using the PEARL water intelligence platform. The assessment identified [X] facilities in basins with substantive water risk (PEARL risk score >=60/100).\n\nKey water-related risks include regulatory tightening under Clean Water Act TMDL programs, with [Y] facilities subject to nutrient reduction mandates. Physical risks include projected increases in precipitation intensity affecting stormwater management at [Z] locations.\n\nPEARL QAPP-grade quality assurance protocol ensures data integrity across all monitoring points. Risk assessments incorporate EPA ATTAINS impairment data, ECHO compliance records, and real-time BMP performance metrics.\n\nThe company targets a [T]% reduction in nutrient loading by [Year], tracked through PEARL TMDL credit accounting system. Progress to date: [P]% of target achieved across the portfolio.',
    evidenceExhibits: [
      { name: 'CDP Water Response Data Tables', type: 'table', description: 'Pre-formatted W1 accounting tables from PEARL data' },
      { name: 'Basin Risk Assessment Map', type: 'chart', description: 'Facility risk scores with basin-level context' },
      { name: 'TMDL Progress Tracker', type: 'report', description: 'Nutrient reduction targets vs. actuals by facility' },
      { name: 'Water Quality Trend Analysis', type: 'chart', description: '3-year parameter trends for all monitored waterbodies' },
      { name: 'Full CDP Data Package', type: 'export', description: 'CDP-formatted Excel workbook with all quantitative responses' },
    ],
  },
  tcfd: {
    missingFields: [
      { field: 'Physical Risk: Acute (flooding, drought)', status: 'amber', description: 'Facility-level exposure to extreme water events' },
      { field: 'Physical Risk: Chronic (water stress trends)', status: 'green', description: 'PEARL tracks long-term impairment and stress trends' },
      { field: 'Transition Risk: Regulatory (TMDLs, permits)', status: 'green', description: 'TMDL compliance trajectory and regulatory pipeline tracked' },
      { field: 'Transition Risk: Market (water pricing)', status: 'red', description: 'Water pricing and market shift data not yet integrated' },
      { field: 'Metrics & Targets: Nutrient credits', status: 'amber', description: 'Credit generation tracked; financial valuation methodology needed' },
    ],
    pearlMappings: [
      { field: 'Physical Risk: Acute (flooding, drought)', pearlParameter: 'NOAA precipitation data + facility stormwater capacity analysis', availability: 'partial' },
      { field: 'Physical Risk: Chronic (water stress trends)', pearlParameter: 'ATTAINS impairment trend data, 5-year water quality trajectories', availability: 'available' },
      { field: 'Transition Risk: Regulatory (TMDLs, permits)', pearlParameter: 'TMDL status by HUC-12, permit expiration timeline, ECHO enforcement actions', availability: 'available' },
      { field: 'Transition Risk: Market (water pricing)', pearlParameter: 'Nutrient credit market pricing (planned integration)', availability: 'planned' },
      { field: 'Metrics & Targets: Nutrient credits', pearlParameter: 'BMP-verified nutrient reductions convertible to tradeable credits', availability: 'available' },
    ],
    narrativeTemplate: '[Company] has assessed climate-related water risks across its [N]-facility portfolio using the PEARL platform integrated risk scoring framework.\n\nPhysical Risks: [X] facilities face elevated acute water risk from projected increases in extreme precipitation events, based on NOAA climate projections. Chronic water stress affects [Y] facilities in basins showing declining water quality trends over the past 5 years (EPA ATTAINS data).\n\nTransition Risks: [Z] facilities operate under active TMDL mandates requiring measurable nutrient load reductions. Regulatory trajectory analysis indicates [W] additional facilities likely subject to new TMDLs within 3 years. Compliance costs are estimated at $[C] annually.\n\nMetrics & Targets: The portfolio has generated [M] lbs of verified nutrient credits through BMP implementation, representing [P]% progress toward the [Year] reduction target. Credit valuation at current market rates: $[V].',
    evidenceExhibits: [
      { name: 'Physical Risk Heatmap', type: 'chart', description: 'Facility locations with acute/chronic water risk overlay' },
      { name: 'TMDL Regulatory Exposure Report', type: 'report', description: 'Current and projected TMDL mandates by facility' },
      { name: 'Nutrient Credit Ledger', type: 'table', description: 'Verified credits generated, banked, and retired by facility' },
      { name: 'Climate Scenario Analysis', type: 'report', description: 'Water risk under RCP 4.5 and 8.5 scenarios' },
    ],
  },
  tnfd: {
    missingFields: [
      { field: 'Dependencies on freshwater ecosystems', status: 'amber', description: 'Ecosystem services valuation for operational water use' },
      { field: 'Impacts on freshwater biodiversity', status: 'amber', description: 'Species and habitat impact assessment per facility' },
      { field: 'Risk management: Nature-related risks', status: 'red', description: 'Formal nature-risk governance framework not documented' },
      { field: 'Restoration metrics & targets', status: 'green', description: 'BMP restoration data and SAV/habitat metrics available via PEARL' },
      { field: 'LEAP assessment (Locate, Evaluate, Assess, Prepare)', status: 'red', description: 'Full LEAP methodology assessment not yet completed' },
    ],
    pearlMappings: [
      { field: 'Dependencies on freshwater ecosystems', pearlParameter: 'Waterbody designated-use classifications, ecosystem service indicators', availability: 'partial' },
      { field: 'Impacts on freshwater biodiversity', pearlParameter: 'SAV coverage, benthic IBI, fish passage data, species-of-concern proximity', availability: 'available' },
      { field: 'Risk management: Nature-related risks', pearlParameter: 'PEARL risk framework documentation + board reporting templates', availability: 'partial' },
      { field: 'Restoration metrics & targets', pearlParameter: 'BMP restoration acres, riparian buffer miles, SAV recovery trends', availability: 'available' },
      { field: 'LEAP assessment (Locate, Evaluate, Assess, Prepare)', pearlParameter: 'PEARL facility-waterbody mapping + impact scoring (partial LEAP coverage)', availability: 'partial' },
    ],
    narrativeTemplate: '[Company] recognizes its dependencies and impacts on freshwater and estuarine ecosystems across the Chesapeake Bay watershed and beyond. This disclosure follows the TNFD LEAP framework.\n\nLocate: [N] facilities have been mapped to their receiving waterbodies and associated ecosystems using PEARL HUC-12 delineation. [X] facilities are adjacent to priority biodiversity areas.\n\nEvaluate: Dependencies include water supply for operations, effluent assimilation capacity, and ecosystem services (flood attenuation, water purification). PEARL data quantifies these at $[V] annual ecosystem service value.\n\nAssess: Key nature-related risks include biodiversity loss in impaired waterbodies ([Y] facilities), regulatory restrictions on water use in stressed basins, and reputational risk from proximity to degraded ecosystems.\n\nPrepare: The company has invested in [Z] verified BMPs through the PEARL platform, restoring [A] acres of riparian habitat and contributing to [B]% improvement in submerged aquatic vegetation coverage in target watersheds.',
    evidenceExhibits: [
      { name: 'LEAP Location Map', type: 'chart', description: 'Facilities mapped to priority biodiversity areas and sensitive ecosystems' },
      { name: 'Biodiversity Impact Dashboard', type: 'chart', description: 'SAV, benthic IBI, and species trends near operations' },
      { name: 'Ecosystem Service Valuation', type: 'table', description: 'Monetary valuation of freshwater ecosystem dependencies' },
      { name: 'Restoration Impact Report', type: 'report', description: 'BMP implementation, habitat acres restored, water quality improvements' },
      { name: 'TNFD LEAP Data Package', type: 'export', description: 'Full TNFD-aligned data export with methodology notes' },
    ],
  },
};

// ─── State GEO (reuse from SCC) ─────────────────────────────────────────────

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

const STATE_GEO: Record<string, { center: [number, number]; scale: number }> = {
  US: { center: [-98.5, 39.8], scale: 1000 },
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

// Chesapeake Bay watershed: 6 states + DC
const CB_WATERSHED_STATES = new Set(['MD', 'VA', 'DC', 'PA', 'DE', 'WV', 'NY']);
const CB_CENTER: [number, number] = [-76.4, 38.6]; // Mid-Bay (roughly Annapolis)
const CB_ZOOM = 3.5;

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  companyName?: string;
  facilities?: FacilityRow[];
  onBack?: () => void;
  onToggleDevMode?: () => void;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function ESGCommandCenter({ companyName = 'PEARL Portfolio', facilities: propFacilities, onBack, onToggleDevMode }: Props) {
  const { user, logout } = useAuth();

  // ── View Lens ──
  const [viewLens, setViewLens] = useState<ESGLens>('overview');
  const lens = LENS_CONFIG[viewLens];
  const [showLensDropdown, setShowLensDropdown] = useState(false);
  const [showAccountPanel, setShowAccountPanel] = useState(false);

  // ── Map state ──
  // Auto-detect: if majority of facilities are in CB watershed, start zoomed to Bay
  // Use propFacilities (or assume CB for demo data) to avoid referencing facilitiesData before init
  const isCBPortfolio = propFacilities
    ? propFacilities.filter(f => CB_WATERSHED_STATES.has(f.state)).length > propFacilities.length / 2
    : true; // demo data is all Chesapeake
  const [overlay, setOverlay] = useState<OverlayId>('waterrisk');
  const [mapZoom, setMapZoom] = useState(isCBPortfolio ? CB_ZOOM : 1);
  const [mapCenter, setMapCenter] = useState<[number, number]>(isCBPortfolio ? CB_CENTER : STATE_GEO['US'].center);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [hoveredFacility, setHoveredFacility] = useState<string | null>(null);
  const [focusedState, setFocusedState] = useState<string>('US');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // ── Collapse state ──
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const toggleCollapse = (id: string) => setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isSectionOpen = (id: string) => !collapsedSections[id];

  // ── Expanded section state (for cards) ──
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  const isSectionExpanded = (id: string) => expandedSections[id] ?? false;

  // ── Close the Gap wizard state ──
  const [gapWizardFramework, setGapWizardFramework] = useState<string | null>(null);
  const [gapWizardStep, setGapWizardStep] = useState<WizardStep>(1);
  const openGapWizard = (fwId: string) => { setGapWizardFramework(fwId); setGapWizardStep(1); };
  const closeGapWizard = () => { setGapWizardFramework(null); setGapWizardStep(1); };

  // ── Topo data ──
  const topo = useMemo(() => {
    try { return feature(statesTopo as any, (statesTopo as any).objects.states) as any; }
    catch { return null; }
  }, []);

  // ── Demo facilities (replace with real data when available) ──
  const facilitiesData: FacilityRow[] = useMemo(() => {
    if (propFacilities && propFacilities.length > 0) return propFacilities;
    // Demo: Chesapeake-region seafood/food processing portfolio
    return [
      { id: 'fac_annapolis_hq', name: 'Annapolis HQ', state: 'MD', type: 'office' as const, alertLevel: 'low' as AlertLevel, activeAlerts: 1, lastUpdatedISO: new Date().toISOString(), status: 'monitored' as const, dataSourceCount: 3, waterRiskScore: 35, lat: 38.978, lon: -76.492, gallonsTreated: 420000, tnReduced: 48.2, tpReduced: 9.8, tssReduced: 1240, tssEfficiency: 91, receivingWaterbody: 'Spa Creek', ejScore: 28 },
      { id: 'fac_baltimore_plant', name: 'Baltimore Processing', state: 'MD', type: 'manufacturing' as const, alertLevel: 'high' as AlertLevel, activeAlerts: 4, lastUpdatedISO: new Date().toISOString(), status: 'monitored' as const, dataSourceCount: 5, waterRiskScore: 78, lat: 39.268, lon: -76.610, gallonsTreated: 1200000, tnReduced: 186.4, tpReduced: 38.1, tssReduced: 4820, tssEfficiency: 88, receivingWaterbody: 'Inner Harbor / Back River', huc12: '020600020501', ejScore: 72 },
      { id: 'fac_norfolk_dist', name: 'Norfolk Distribution', state: 'VA', type: 'warehouse' as const, alertLevel: 'medium' as AlertLevel, activeAlerts: 2, lastUpdatedISO: new Date().toISOString(), status: 'assessed' as const, dataSourceCount: 1, waterRiskScore: 55, lat: 36.850, lon: -76.285, gallonsTreated: 0, tnReduced: 0, tpReduced: 0, tssReduced: 0, tssEfficiency: 0, receivingWaterbody: 'Elizabeth River', ejScore: 61 },
      { id: 'fac_cambridge_plant', name: 'Cambridge Seafood Plant', state: 'MD', type: 'manufacturing' as const, alertLevel: 'medium' as AlertLevel, activeAlerts: 3, lastUpdatedISO: new Date().toISOString(), status: 'monitored' as const, dataSourceCount: 4, waterRiskScore: 62, lat: 38.563, lon: -76.079, gallonsTreated: 680000, tnReduced: 94.6, tpReduced: 18.7, tssReduced: 2340, tssEfficiency: 92, receivingWaterbody: 'Choptank River', huc12: '020600060101', ejScore: 45 },
      { id: 'fac_dc_office', name: 'DC Government Affairs', state: 'DC', type: 'office' as const, alertLevel: 'none' as AlertLevel, activeAlerts: 0, lastUpdatedISO: new Date().toISOString(), status: 'unmonitored' as const, dataSourceCount: 0, waterRiskScore: 15, lat: 38.905, lon: -77.035, gallonsTreated: 0, tnReduced: 0, tpReduced: 0, tssReduced: 0, tssEfficiency: 0, receivingWaterbody: 'Anacostia River', ejScore: 54 },
    ];
  }, [propFacilities]);

  // ── Waterbody markers for focused state (from REGION_META, same as other CCs) ──
  const stateWaterbodies = useMemo(() => {
    if (focusedState === 'US') return [];
    const markers: { id: string; name: string; lat: number; lon: number; alertLevel: AlertLevel; status: string; dataSourceCount: number }[] = [];
    for (const [id, meta] of Object.entries(REGION_META)) {
      const fips = (meta as any).stateCode?.replace('US:', '') || '';
      const abbr = FIPS_TO_ABBR[fips] || fips;
      if (abbr !== focusedState) continue;
      const cfg = getRegionById(id) as any;
      if (!cfg) continue;
      const lat = cfg.lat ?? cfg.latitude ?? null;
      const lon = cfg.lon ?? cfg.lng ?? cfg.longitude ?? null;
      if (lat == null || lon == null) continue;
      const sources = getWaterbodyDataSources(id);
      // Derive alert level from sources
      const alertLevel: AlertLevel = sources.length >= 3 ? 'high' : sources.length >= 2 ? 'medium' : sources.length >= 1 ? 'low' : 'none';
      markers.push({ id, name: (meta as any).name || id, lat, lon, alertLevel, status: sources.length > 0 ? 'assessed' : 'unmonitored', dataSourceCount: sources.length });
    }
    return markers;
  }, [focusedState]);

  // ── Filtered list ──
  const filteredFacilities = useMemo(() => {
    let filtered = facilitiesData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(f => f.name.toLowerCase().includes(q) || f.state.toLowerCase().includes(q));
    }
    if (filterLevel !== 'all') {
      filtered = filtered.filter(f => f.alertLevel === filterLevel);
    }
    return filtered.sort((a, b) => b.waterRiskScore - a.waterRiskScore);
  }, [facilitiesData, searchQuery, filterLevel]);

  // ── Aggregate scores ──
  const portfolioScores = useMemo(() => {
    const total = facilitiesData.length;
    const highRisk = facilitiesData.filter(f => f.waterRiskScore >= 70).length;
    const medRisk = facilitiesData.filter(f => f.waterRiskScore >= 40 && f.waterRiskScore < 70).length;
    const lowRisk = facilitiesData.filter(f => f.waterRiskScore < 40).length;
    const monitored = facilitiesData.filter(f => f.status === 'monitored').length;
    const avgRisk = total > 0 ? Math.round(facilitiesData.reduce((s, f) => s + f.waterRiskScore, 0) / total) : 0;
    const avgESG = Math.max(0, 100 - avgRisk);
    // Treatment aggregates
    const totalGallons = facilitiesData.reduce((s, f) => s + (f.gallonsTreated || 0), 0);
    const totalTN = facilitiesData.reduce((s, f) => s + (f.tnReduced || 0), 0);
    const totalTP = facilitiesData.reduce((s, f) => s + (f.tpReduced || 0), 0);
    const totalTSS = facilitiesData.reduce((s, f) => s + (f.tssReduced || 0), 0);
    const monitoredWithEff = facilitiesData.filter(f => f.tssEfficiency && f.tssEfficiency > 0);
    const avgTSSEff = monitoredWithEff.length > 0 ? Math.round(monitoredWithEff.reduce((s, f) => s + (f.tssEfficiency || 0), 0) / monitoredWithEff.length) : 0;
    const ejHighCount = facilitiesData.filter(f => (f.ejScore || 0) >= 60).length;
    // Chesapeake Bay watershed aggregates
    const cbFacs = facilitiesData.filter(f => CB_WATERSHED_STATES.has(f.state));
    const cbGallons = cbFacs.reduce((s, f) => s + (f.gallonsTreated || 0), 0);
    const cbTN = cbFacs.reduce((s, f) => s + (f.tnReduced || 0), 0);
    const cbTP = cbFacs.reduce((s, f) => s + (f.tpReduced || 0), 0);
    const cbTSS = cbFacs.reduce((s, f) => s + (f.tssReduced || 0), 0);
    const cbMonitored = cbFacs.filter(f => f.status === 'monitored').length;
    return { total, highRisk, medRisk, lowRisk, monitored, avgRisk, avgESG, totalGallons, totalTN, totalTP, totalTSS, avgTSSEff, ejHighCount, cbFacs: cbFacs.length, cbGallons, cbTN, cbTP, cbTSS, cbMonitored };
  }, [facilitiesData]);

  // ── Selected facility detail ──
  const selectedFac = facilitiesData.find(f => f.id === selectedFacility) || null;

  // ── Print section (browser print dialog for any section) ──
  const printSection = (sectionId: string, title: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    const styleSheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(s => s.outerHTML).join('\n');
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title} — PEARL Corporate E/S/G Command Center</title>${styleSheets}
      <style>
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        body { padding: 24px; background: white; font-family: system-ui, -apple-system, sans-serif; }
        .print-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 20px; }
        .print-header h1 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; }
        .print-header .meta { font-size: 11px; color: #64748b; text-align: right; }
        .print-footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head><body>
      <div class="print-header">
        <h1>${title}</h1>
        <div class="meta">${companyName}<br/>PEARL Corporate E/S/G Command Center<br/>${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}<br/>project-pearl.org</div>
      </div>
      ${el.innerHTML}
      <div class="print-footer">Generated by PEARL Corporate E/S/G Command Center &bull; ${companyName} &bull; project-pearl.org &bull; ${new Date().toLocaleString()}</div>
    </body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 600);
  };

  // ── Text sanitizer for PDF (no emoji, no extended unicode) ──
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

  // ── Full branded ESG Report PDF export ──
  const exportFullESGReport = async () => {
    try {
      const pdf = new BrandedPDFGenerator('portrait');
      await pdf.loadLogo();
      pdf.initialize();

      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      // Title
      pdf.addTitle('Corporate E/S/G Report');
      pdf.addText(clean(companyName), { bold: true, fontSize: 14 });
      pdf.addText(clean(`Generated ${dateStr}`), { fontSize: 9 });
      pdf.addSpacer(5);

      // Executive Summary
      pdf.addSubtitle('Executive Summary');
      pdf.addDivider();
      pdf.addText(clean(`Overall ESG Score: ${portfolioScores.avgESG}/100 (${portfolioScores.avgESG >= 80 ? 'A - Leader' : portfolioScores.avgESG >= 60 ? 'B - Above Average' : portfolioScores.avgESG >= 40 ? 'C - Average' : 'D - Below Average'})`), { bold: true });
      pdf.addText(clean(`Portfolio: ${portfolioScores.total} facilities | ${portfolioScores.monitored} PEARL-verified | ${portfolioScores.highRisk} high-risk | ${portfolioScores.medRisk} medium-risk | ${portfolioScores.lowRisk} low-risk`), { indent: 5 });
      pdf.addSpacer(3);
      pdf.addText('KEY STRENGTHS', { bold: true });
      if (portfolioScores.avgTSSEff > 0) pdf.addText(clean(`- ${portfolioScores.avgTSSEff}% avg TSS removal efficiency vs. industry ~45%`), { indent: 5 });
      pdf.addText('- 92% wastewater treatment rate vs. industry 67%', { indent: 5 });
      pdf.addText(clean(`- ${portfolioScores.totalTSS.toLocaleString()} lbs pollutants removed across ${portfolioScores.monitored} active sites`), { indent: 5 });
      pdf.addSpacer(2);
      pdf.addText('RISK FLAGS', { bold: true });
      if (portfolioScores.highRisk > 0) pdf.addText(clean(`- ${portfolioScores.highRisk} high-risk facility(ies) in impaired watersheds`), { indent: 5 });
      if (portfolioScores.ejHighCount > 0) pdf.addText(clean(`- ${portfolioScores.ejHighCount} facility(ies) in environmental justice communities`), { indent: 5 });
      pdf.addText(clean(`- ${portfolioScores.total - portfolioScores.monitored} facility(ies) without PEARL monitoring`), { indent: 5 });
      pdf.addSpacer(5);

      // Environmental Impact
      pdf.addSubtitle('Environmental Impact');
      pdf.addDivider();
      pdf.addTable(
        ['Metric', 'Value'],
        [
          ['Total Gallons Treated', clean(`${(portfolioScores.totalGallons / 1_000_000).toFixed(1)}M`)],
          ['Total TSS Removed', clean(`${portfolioScores.totalTSS.toLocaleString()} lbs`)],
          ['Total TN Reduced (Bay TMDL)', clean(`${portfolioScores.totalTN.toFixed(1)} lbs`)],
          ['Total TP Reduced (Bay TMDL)', clean(`${portfolioScores.totalTP.toFixed(1)} lbs`)],
          ['Avg TSS Efficiency', clean(`${portfolioScores.avgTSSEff}%`)],
          ['PEARL Active Sites', `${portfolioScores.monitored} of ${portfolioScores.total}`],
        ]
      );
      pdf.addSpacer(3);

      // Facility Breakdown
      pdf.addSubtitle('Facility Treatment Breakdown');
      pdf.addDivider();
      pdf.addTable(
        ['Facility', 'State', 'Gallons', 'TN (lbs)', 'TP (lbs)', 'TSS (lbs)', 'TSS Eff.', 'Status'],
        facilitiesData.map(f => [
          clean(f.name),
          f.state,
          f.gallonsTreated ? `${(f.gallonsTreated / 1000).toFixed(0)}K` : '--',
          f.tnReduced ? f.tnReduced.toFixed(1) : '--',
          f.tpReduced ? f.tpReduced.toFixed(1) : '--',
          f.tssReduced ? f.tssReduced.toLocaleString() : '--',
          f.tssEfficiency ? `${f.tssEfficiency}%` : '--',
          f.status === 'monitored' ? 'Verified' : f.status === 'assessed' ? 'Assessed' : 'Pending',
        ])
      );
      pdf.addSpacer(3);

      // Chesapeake Bay Contribution
      if (portfolioScores.cbFacs > 0) {
        pdf.addSubtitle('Chesapeake Bay Watershed Contribution');
        pdf.addDivider();
        pdf.addTable(
          ['Metric', 'Value'],
          [
            ['Bay Watershed Facilities', `${portfolioScores.cbFacs}`],
            ['PEARL Active (Bay)', `${portfolioScores.cbMonitored}`],
            ['Gallons Treated (Bay)', clean(`${(portfolioScores.cbGallons / 1_000_000).toFixed(1)}M`)],
            ['TN Reduced (TMDL-eligible)', clean(`${portfolioScores.cbTN.toFixed(1)} lbs`)],
            ['TP Reduced (TMDL-eligible)', clean(`${portfolioScores.cbTP.toFixed(1)} lbs`)],
            ['TSS Removed (Bay tributaries)', clean(`${portfolioScores.cbTSS.toLocaleString()} lbs`)],
            ['Est. Credit Value (TN+TP)', clean(`$${(portfolioScores.cbTN * 10 + portfolioScores.cbTP * 85).toLocaleString()}`)],
          ]
        );
        pdf.addSpacer(3);
      }

      // Disclosure Readiness
      pdf.addSubtitle('ESG Disclosure Readiness');
      pdf.addDivider();
      pdf.addTable(
        ['Framework', 'Coverage', 'Status'],
        ESG_FRAMEWORKS.map(fw => [
          clean(`${fw.name} -- ${fw.fullName}`),
          `${fw.coverage}%`,
          fw.status === 'ready' ? 'Ready' : fw.status === 'partial' ? 'Partial' : 'Gap',
        ])
      );
      pdf.addSpacer(3);

      // Economic Co-Benefits
      pdf.addSubtitle('Economic Co-Benefits');
      pdf.addDivider();
      pdf.addText('NUTRIENT CREDIT VALUE', { bold: true });
      pdf.addText(clean(`TN credits: ${portfolioScores.totalTN.toFixed(1)} lbs (market value: $${(portfolioScores.totalTN * 10).toLocaleString()} at $8-12/lb)`), { indent: 5 });
      pdf.addText(clean(`TP credits: ${portfolioScores.totalTP.toFixed(1)} lbs (market value: $${(portfolioScores.totalTP * 85).toLocaleString()} at $50-120/lb)`), { indent: 5 });
      pdf.addSpacer(2);
      pdf.addText('CHESAPEAKE BAY ECONOMY', { bold: true });
      pdf.addText('MD blue crab harvest: ~$89M/yr | MD oyster harvest: ~$32M/yr | Total Bay seafood economy: $600M+/yr', { indent: 5 });
      pdf.addText('Cleaner Bay water directly supports commercial harvest viability and market premium.', { indent: 5, fontSize: 9 });
      pdf.addSpacer(5);

      // Disclaimer
      pdf.addDivider();
      pdf.addText('DISCLAIMER', { bold: true, fontSize: 8 });
      pdf.addText(clean('This report is generated for informational and voluntary ESG disclosure purposes only. It does not constitute a formal ESG audit. Baseline projections derived from Milton, FL pilot (Jan 2025: 88-95% TSS removal, 50K GPD). PEARL-monitored facilities reflect verified continuous data. Non-monitored facilities show modeled estimates only.'), { fontSize: 8 });
      pdf.addSpacer(2);
      pdf.addText(clean('Data Sources: PEARL continuous monitoring | EPA ATTAINS | EPA ECHO | USGS NWIS | NOAA CO-OPS | WRI Aqueduct | EJScreen'), { fontSize: 8 });
      pdf.addText(clean(`Contact: info@project-pearl.org | ${dateStr}`), { fontSize: 8 });

      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      pdf.download(`PEARL_ESG_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('ESG PDF export failed:', err);
      alert('PDF export failed. Please try again.');
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50/30">
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

        {/* ── HEADER ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="relative h-12 w-40 cursor-default select-none"
                onDoubleClick={() => onToggleDevMode?.()}
              >
                <Image src="/Logo_Pearl_as_Headline.JPG" alt="Project Pearl Logo" fill className="object-contain object-left" priority />
              </div>
              <div>
                <div className="text-xl font-semibold text-slate-800">Corporate E/S/G Command Center</div>
                <div className="text-sm text-slate-600">
                  Portfolio water risk, ESG disclosure readiness &amp; environmental impact verification
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
            {/* Lens selector */}
            <div className="relative">
              <button
                onClick={() => setShowLensDropdown(!showLensDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm font-medium text-emerald-800 hover:bg-emerald-50 transition-colors shadow-sm"
              >
                <lens.icon className="h-3.5 w-3.5" />
                {lens.label}
                <ChevronDown className="h-3 w-3" />
              </button>
              {showLensDropdown && (
                <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                  {(Object.entries(LENS_CONFIG) as [ESGLens, LensConfig][]).map(([id, cfg]) => (
                    <button
                      key={id}
                      onClick={() => { setViewLens(id); setShowLensDropdown(false); }}
                      className={`w-full text-left px-3 py-2 hover:bg-slate-50 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2 ${viewLens === id ? 'bg-emerald-50' : ''}`}
                    >
                      <cfg.icon className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-slate-800">{cfg.label}</div>
                        <div className="text-[10px] text-slate-500">{cfg.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Export ESG Report */}
            <button
              onClick={exportFullESGReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </button>

            {/* Account */}
            {user && (
            <div className="relative">
              <button
                onClick={() => setShowAccountPanel(!showAccountPanel)}
                className="inline-flex items-center h-8 px-3 text-xs font-semibold rounded-md border bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
              >
                <Leaf className="h-3.5 w-3.5 mr-1.5" />
                {user.name || 'ESG Officer'}
                <span className="ml-1.5 text-emerald-400">▾</span>
              </button>

              {showAccountPanel && (
                <>
                <div className="fixed inset-0 z-40" onClick={() => setShowAccountPanel(false)} />
                <div
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-lg border border-slate-200 shadow-xl z-50 overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-slate-50 border-b border-slate-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                          {user.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'ES'}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-800">{user.name || 'ESG Officer'}</div>
                          <div className="text-[11px] text-slate-500">{user.email || 'esg@project-pearl.org'}</div>
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
                      <span className="font-medium text-slate-700">Corporate / ESG</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Organization</span>
                      <span className="font-medium text-slate-700 text-right">{user.organization || companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Access Level</span>
                      <Badge variant="outline" className="text-[10px] h-5 bg-green-50 border-green-200 text-green-700">Full Access</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Facilities</span>
                      <span className="font-medium text-slate-700">{facilitiesData.length} monitored</span>
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
                    <span className="text-[10px] text-slate-400">PEARL ESGCC v1.0 · {companyName} · Session {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
                </>
              )}
            </div>
            )}
            </div>
        </div>
          <div className="text-2xl font-bold text-emerald-700 text-center pt-3">{companyName}</div>
        </div>

        {/* ── EXECUTIVE SUMMARY BANNER ── */}
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Award className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-bold text-slate-800">Executive Summary</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Key wins */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-emerald-700">Key Strengths</div>
              <div className="text-[11px] text-slate-700 space-y-1">
                {portfolioScores.avgTSSEff > 0 && (
                  <div className="flex items-start gap-1.5">
                    <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                    <span><span className="font-semibold">{portfolioScores.avgTSSEff}% avg TSS removal</span> vs. industry ~45%</span>
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><span className="font-semibold">92% wastewater treatment rate</span> vs. industry 67%</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                  <span><span className="font-semibold">{portfolioScores.totalTSS.toLocaleString()} lbs pollutants removed</span> across {portfolioScores.monitored} active sites</span>
                </div>
              </div>
            </div>
            {/* Risk flags */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-amber-700">Risk Flags</div>
              <div className="text-[11px] text-slate-700 space-y-1">
                {portfolioScores.highRisk > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <span><span className="font-semibold">{portfolioScores.highRisk} high-risk</span> facilit{portfolioScores.highRisk === 1 ? 'y' : 'ies'} in impaired watersheds</span>
                  </div>
                )}
                {portfolioScores.ejHighCount > 0 && (
                  <div className="flex items-start gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span><span className="font-semibold">{portfolioScores.ejHighCount} facilit{portfolioScores.ejHighCount === 1 ? 'y' : 'ies'}</span> in environmental justice communities</span>
                  </div>
                )}
                <div className="flex items-start gap-1.5">
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <span><span className="font-semibold">{portfolioScores.total - portfolioScores.monitored} facilit{(portfolioScores.total - portfolioScores.monitored) === 1 ? 'y' : 'ies'}</span> without PEARL monitoring</span>
                </div>
              </div>
            </div>
            {/* ESG score + grade */}
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className={`text-4xl font-black ${portfolioScores.avgESG >= 70 ? 'text-green-600' : portfolioScores.avgESG >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                  {portfolioScores.avgESG}
                </div>
                <div className="text-xs text-slate-500 font-medium">Overall ESG Score</div>
                <div className={`mt-1 inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  portfolioScores.avgESG >= 80 ? 'bg-green-100 text-green-700' :
                  portfolioScores.avgESG >= 60 ? 'bg-emerald-100 text-emerald-700' :
                  portfolioScores.avgESG >= 40 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {portfolioScores.avgESG >= 80 ? 'A — Leader' : portfolioScores.avgESG >= 60 ? 'B — Above Average' : portfolioScores.avgESG >= 40 ? 'C — Average' : 'D — Below Average'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── PORTFOLIO SCORECARD ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Card className="border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-emerald-700 inline-flex items-center gap-1">{portfolioScores.avgESG}<ProvenanceIcon metricName="ESG Score" displayValue={String(portfolioScores.avgESG)} /></div>
              <div className="text-[10px] text-emerald-600 font-medium">ESG Score</div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-slate-800">{portfolioScores.total}</div>
              <div className="text-[10px] text-slate-500">Facilities</div>
            </CardContent>
          </Card>
          <Card className="border border-red-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-red-600 inline-flex items-center gap-1">{portfolioScores.highRisk}<ProvenanceIcon metricName="High Risk Facilities" displayValue={String(portfolioScores.highRisk)} /></div>
              <div className="text-[10px] text-red-500">High Risk</div>
            </CardContent>
          </Card>
          <Card className="border border-amber-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{portfolioScores.medRisk}</div>
              <div className="text-[10px] text-amber-500">Medium Risk</div>
            </CardContent>
          </Card>
          <Card className="border border-green-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{portfolioScores.lowRisk}</div>
              <div className="text-[10px] text-green-500">Low Risk</div>
            </CardContent>
          </Card>
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50/50 to-white">
            <CardContent className="p-3 text-center">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Shield className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div className="text-2xl font-bold text-green-600 inline-flex items-center gap-1">{portfolioScores.monitored}<ProvenanceIcon metricName="Verified Impact" displayValue={String(portfolioScores.monitored)} /></div>
              <div className="text-[10px] text-green-600 font-medium">Verified Impact</div>
            </CardContent>
          </Card>
          <Card className="border border-slate-200">
            <CardContent className="p-3 text-center">
              <div className="text-2xl font-bold text-slate-600 inline-flex items-center gap-1">{portfolioScores.avgRisk}<ProvenanceIcon metricName="Avg Risk Score" displayValue={String(portfolioScores.avgRisk)} /></div>
              <div className="text-[10px] text-slate-500">Avg Risk Score</div>
            </CardContent>
          </Card>
        </div>

        {/* ── MAP + FACILITY LIST ── */}
        {lens.showMap && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* LEFT: Map (2/3) */}
            <Card className="lg:col-span-2 border-2 border-slate-200">
              <CardContent className="p-0">
                {/* Overlay toggle */}
                <div className="flex items-center gap-2 p-2 bg-slate-50 border-b border-slate-200">
                  {OVERLAYS.map(o => (
                    <button
                      key={o.id}
                      onClick={() => setOverlay(o.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        overlay === o.id
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <o.icon className="h-3 w-3" />
                      {o.label}
                    </button>
                  ))}
                </div>

                <div className="p-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span>{companyName} · {facilitiesData.length} facilities{focusedState !== 'US' ? ` · ${STATE_NAMES[focusedState] || focusedState} waterbodies` : ''}</span>
                  <div className="flex items-center gap-2">
                    {mapZoom > 1.1 && <span className="text-slate-400">{mapZoom.toFixed(1)}×</span>}
                    <select
                      value={focusedState}
                      onChange={(e) => {
                        const st = e.target.value;
                        setFocusedState(st);
                        setSelectedFacility(null);
                        const geo = STATE_GEO[st] || STATE_GEO['US'];
                        setMapCenter(geo.center);
                        setMapZoom(st === 'US' ? (isCBPortfolio ? CB_ZOOM : 1) : geo.scale > 10000 ? 1.5 : 1);
                      }}
                      className="h-7 px-2 text-xs font-semibold rounded-md border bg-white border-emerald-300 text-emerald-800 hover:border-emerald-400 focus:ring-2 focus:ring-emerald-400/50 focus:outline-none transition-colors cursor-pointer"
                    >
                      <option value="US">All States (Portfolio)</option>
                      {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                        <option key={abbr} value={abbr}>{abbr} — {name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="h-[450px] w-full relative">
                  {/* Zoom controls */}
                  <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                    <button onClick={() => setMapZoom(z => Math.min(z * 1.5, 12))} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold">+</button>
                    <button onClick={() => setMapZoom(z => Math.max(z / 1.5, 1))} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-600 hover:bg-slate-50 text-sm font-bold">−</button>
                    <button onClick={() => { setMapZoom(isCBPortfolio ? CB_ZOOM : 1); setMapCenter(isCBPortfolio ? CB_CENTER : STATE_GEO['US'].center); }} className="w-7 h-7 rounded bg-white border border-slate-300 shadow-sm flex items-center justify-center text-slate-500 hover:bg-slate-50 text-[10px] font-medium">⌂</button>
                  </div>

                  {topo && (
                    <ComposableMap
                      projection="geoMercator"
                      projectionConfig={{ center: STATE_GEO['US'].center, scale: STATE_GEO['US'].scale }}
                      width={800}
                      height={470}
                      style={{ width: '100%', height: '100%' }}
                    >
                      <ZoomableGroup
                        zoom={mapZoom}
                        center={mapCenter}
                        onMoveEnd={({ coordinates, zoom }) => { setMapCenter(coordinates as [number, number]); setMapZoom(zoom); }}
                        minZoom={1}
                        maxZoom={12}
                      >
                        <Geographies geography={topo}>
                          {({ geographies }: { geographies: any[] }) =>
                            geographies.map((g: any) => {
                              const gFips = String(g.id).padStart(2, '0');
                              const gAbbr = FIPS_TO_ABBR[gFips] || g.properties?.name;
                              const isFocused = focusedState !== 'US' && gAbbr === focusedState;
                              return (
                                <Geography
                                  key={g.rsmKey ?? g.id}
                                  geography={g}
                                  style={{
                                    default: { fill: isFocused ? '#d1fae5' : '#f1f5f9', outline: 'none', stroke: isFocused ? '#059669' : '#cbd5e1', strokeWidth: (isFocused ? 1.5 : 0.3) / mapZoom },
                                    hover: { fill: isFocused ? '#a7f3d0' : '#e2e8f0', outline: 'none', stroke: isFocused ? '#059669' : '#cbd5e1', strokeWidth: (isFocused ? 1.5 : 0.3) / mapZoom },
                                    pressed: { fill: isFocused ? '#a7f3d0' : '#e2e8f0', outline: 'none' },
                                  }}
                                />
                              );
                            })
                          }
                        </Geographies>

                        {/* Waterbody dots for focused state */}
                        {stateWaterbodies.map(wb => {
                          const wbColor = wb.alertLevel === 'high' ? '#ef4444' : wb.alertLevel === 'medium' ? '#f59e0b' : wb.alertLevel === 'low' ? '#eab308' : '#22c55e';
                          return (
                            <Marker key={`wb-${wb.id}`} coordinates={[wb.lon, wb.lat]}>
                              <circle
                                r={3.5 / mapZoom}
                                fill={wbColor}
                                stroke="#ffffff"
                                strokeWidth={0.8 / mapZoom}
                                opacity={0.7}
                                style={{ cursor: 'default' }}
                              />
                            </Marker>
                          );
                        })}

                        {/* Facility markers */}
                        {facilitiesData.filter(f => f.lat && f.lon).map(f => {
                          const isActive = f.id === selectedFacility;
                          const isHovered = f.id === hoveredFacility;
                          const color = getMarkerColor(overlay, f);
                          return (
                            <Marker key={f.id} coordinates={[f.lon!, f.lat!]}>
                              <circle
                                r={(isActive ? 8 : isHovered ? 6.5 : 5) / mapZoom}
                                fill={color}
                                stroke={isActive ? '#1e40af' : isHovered ? '#334155' : '#ffffff'}
                                strokeWidth={(isActive ? 2.5 : isHovered ? 2 : 1.5) / mapZoom}
                                style={{ cursor: 'pointer', transition: 'r 0.15s, stroke 0.15s' }}
                                onClick={() => setSelectedFacility(isActive ? null : f.id)}
                                onMouseEnter={() => setHoveredFacility(f.id)}
                                onMouseLeave={() => setHoveredFacility(null)}
                              />
                              {f.type === 'manufacturing' && (
                                <rect
                                  x={-2 / mapZoom} y={-2 / mapZoom}
                                  width={4 / mapZoom} height={4 / mapZoom}
                                  fill="white" opacity={0.8}
                                  style={{ pointerEvents: 'none' }}
                                />
                              )}
                              {/* Verified Impact ring for PEARL-monitored facilities */}
                              {f.status === 'monitored' && (
                                <circle
                                  r={(isActive ? 11 : 8) / mapZoom}
                                  fill="none"
                                  stroke="#16a34a"
                                  strokeWidth={1.5 / mapZoom}
                                  strokeDasharray={`${3 / mapZoom} ${1.5 / mapZoom}`}
                                  opacity={0.7}
                                  style={{ pointerEvents: 'none' }}
                                />
                              )}
                              {(isActive || isHovered) && (
                                <g style={{ pointerEvents: 'none' }}>
                                  <rect
                                    x={-60 / mapZoom} y={(-48) / mapZoom}
                                    width={120 / mapZoom} height={34 / mapZoom}
                                    rx={3 / mapZoom}
                                    fill="white" stroke="#cbd5e1" strokeWidth={0.5 / mapZoom}
                                    opacity={0.95}
                                  />
                                  <text textAnchor="middle" y={-32 / mapZoom} style={{ fontSize: `${9 / mapZoom}px`, fontWeight: 700, fill: '#1e3a5f' }}>
                                    {f.name}
                                  </text>
                                  <text textAnchor="middle" y={-22 / mapZoom} style={{ fontSize: `${7.5 / mapZoom}px`, fill: '#64748b' }}>
                                    Risk: {f.waterRiskScore} | {f.tssEfficiency ? `TSS: ${f.tssEfficiency}%` : f.status}
                                  </text>
                                </g>
                              )}
                            </Marker>
                          );
                        })}
                      </ZoomableGroup>
                    </ComposableMap>
                  )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-2 p-3 text-xs bg-slate-50 border-t border-slate-200">
                  {overlay === 'waterrisk' && (
                    <>
                      <span className="text-slate-500 font-medium self-center mr-1">Water Risk:</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Low (&lt;20)</Badge>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Moderate (20-40)</Badge>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Elevated (40-70)</Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">High (70+)</Badge>
                    </>
                  )}
                  {overlay === 'compliance' && (
                    <>
                      <span className="text-slate-500 font-medium self-center mr-1">Compliance:</span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Clean</Badge>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Watch</Badge>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Violations</Badge>
                      <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Enforcement</Badge>
                    </>
                  )}
                  {overlay === 'impact' && (
                    <>
                      <span className="text-slate-500 font-medium self-center mr-1">PEARL Status:</span>
                      <Badge variant="secondary" className="bg-gray-200 text-gray-700">No System</Badge>
                      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Assessed Only</Badge>
                      <Badge variant="secondary" className="bg-green-800 text-white">Active PEARL</Badge>
                    </>
                  )}
                  <span className="mx-1 text-slate-300">|</span>
                  <span className="flex items-center gap-1 text-slate-500">
                    <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="none" stroke="#16a34a" strokeWidth="1.5" strokeDasharray="3 1.5" /></svg>
                    Verified Impact
                  </span>
                  {focusedState !== 'US' && stateWaterbodies.length > 0 && (
                    <>
                      <span className="mx-1 text-slate-300">|</span>
                      <span className="text-slate-500">
                        <svg width="8" height="8" viewBox="0 0 8 8" className="inline mr-1"><circle cx="4" cy="4" r="3.5" fill="#f59e0b" stroke="#fff" strokeWidth="0.8" opacity="0.7" /></svg>
                        {stateWaterbodies.length} waterbodies
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* RIGHT: Facility List (1/3) */}
            <Card className="lg:col-span-1 border-2 border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Building2 size={16} />
                      Facilities
                    </CardTitle>
                    <CardDescription>{filteredFacilities.length} of {facilitiesData.length}</CardDescription>
                  </div>
                </div>
                {/* Search */}
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search facilities..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0 max-h-[400px] overflow-y-auto">
                {filteredFacilities.map(f => (
                  <div
                    key={f.id}
                    onClick={() => setSelectedFacility(f.id === selectedFacility ? null : f.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 cursor-pointer hover:bg-slate-50 transition-colors ${
                      f.id === selectedFacility ? 'bg-emerald-50 border-l-2 border-l-emerald-500' : ''
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      f.waterRiskScore >= 70 ? 'bg-red-500' :
                      f.waterRiskScore >= 40 ? 'bg-amber-500' :
                      f.waterRiskScore >= 20 ? 'bg-yellow-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-800 truncate">{f.name}</div>
                      <div className="text-[10px] text-slate-500">{f.state} · {f.type} · Risk: {f.waterRiskScore}</div>
                      {f.receivingWaterbody && <div className="text-[9px] text-slate-400 truncate">{f.receivingWaterbody}</div>}
                    </div>
                    {f.status === 'monitored' && (
                      <Badge variant="secondary" className="text-[8px] h-4 px-1.5 bg-green-100 text-green-700 border-green-200 flex-shrink-0 gap-0.5">
                        <Shield className="h-2.5 w-2.5" />
                        Verified
                      </Badge>
                    )}
                    {f.status === 'assessed' && (
                      <Badge variant="secondary" className="text-[8px] h-4 px-1.5 bg-amber-50 text-amber-600 border-amber-200 flex-shrink-0">
                        Assessed
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── AI INSIGHTS ── */}
        <AIInsightsEngine role="Corporate" stateAbbr="US" regionData={facilitiesData as any} />

        {/* ── ENVIRONMENTAL IMPACT SUMMARY ── */}
        {lens.showImpact && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('impact')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Environmental Impact Summary</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('impact') && <span onClick={(e) => { e.stopPropagation(); printSection('section-impact', 'Environmental Impact Summary'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('impact') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('impact') && (
              <div id="section-impact" className="p-4 space-y-4">
                {/* Primary metrics — aggregated from all facilities */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                    <Droplets className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-emerald-700">{(portfolioScores.totalGallons / 1_000_000).toFixed(1)}M</div>
                    <div className="text-[10px] text-emerald-600">Gallons Treated</div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
                    <TrendingDown className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-blue-700">{portfolioScores.totalTSS.toLocaleString()}</div>
                    <div className="text-[10px] text-blue-600">lbs TSS Removed</div>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-center">
                    <Activity className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-indigo-700">{portfolioScores.totalTN.toFixed(1)}</div>
                    <div className="text-[10px] text-indigo-600">lbs TN Reduced (Bay TMDL)</div>
                  </div>
                  <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-center">
                    <Activity className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-purple-700">{portfolioScores.totalTP.toFixed(1)}</div>
                    <div className="text-[10px] text-purple-600">lbs TP Reduced (Bay TMDL)</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
                    <Target className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-amber-700">{portfolioScores.avgTSSEff > 0 ? `${portfolioScores.avgTSSEff}%` : '--'}</div>
                    <div className="text-[10px] text-amber-600">Avg TSS Efficiency</div>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 text-center">
                    <Heart className="h-5 w-5 text-cyan-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-cyan-700">{portfolioScores.monitored}</div>
                    <div className="text-[10px] text-cyan-600">Active PEARL Sites</div>
                  </div>
                </div>

                {/* Per-facility breakdown */}
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700">Facility Treatment Breakdown</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500">
                          <th className="text-left px-3 py-1.5 font-medium">Facility</th>
                          <th className="text-right px-3 py-1.5 font-medium">Gallons</th>
                          <th className="text-right px-3 py-1.5 font-medium">TN (lbs)</th>
                          <th className="text-right px-3 py-1.5 font-medium">TP (lbs)</th>
                          <th className="text-right px-3 py-1.5 font-medium">TSS (lbs)</th>
                          <th className="text-right px-3 py-1.5 font-medium">TSS Eff.</th>
                          <th className="text-left px-3 py-1.5 font-medium">Receiving Water</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facilitiesData.map(f => (
                          <tr key={f.id} className="border-b border-slate-50 hover:bg-slate-50">
                            <td className="px-3 py-1.5 font-medium text-slate-800">{f.name}</td>
                            <td className="text-right px-3 py-1.5 text-slate-600">{f.gallonsTreated ? (f.gallonsTreated / 1000).toFixed(0) + 'K' : '--'}</td>
                            <td className="text-right px-3 py-1.5 text-slate-600">{f.tnReduced ? f.tnReduced.toFixed(1) : '--'}</td>
                            <td className="text-right px-3 py-1.5 text-slate-600">{f.tpReduced ? f.tpReduced.toFixed(1) : '--'}</td>
                            <td className="text-right px-3 py-1.5 text-slate-600">{f.tssReduced ? f.tssReduced.toLocaleString() : '--'}</td>
                            <td className="text-right px-3 py-1.5">
                              {f.tssEfficiency ? (
                                <span className={`font-semibold ${f.tssEfficiency >= 80 ? 'text-green-600' : f.tssEfficiency >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>{f.tssEfficiency}%</span>
                              ) : <span className="text-slate-400">--</span>}
                            </td>
                            <td className="px-3 py-1.5 text-slate-500">{f.receivingWaterbody || '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Projected vs Actual banner */}
                <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-3 w-3 text-amber-600 flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-amber-800">Projected vs. Verified Data</span>
                  </div>
                  <span className="text-[10px] text-amber-700 block">Baseline projections derived from Milton, FL pilot (Jan 2025: 88-95% TSS removal, 50K GPD throughput). PEARL-monitored facilities reflect verified continuous data. Non-monitored facilities show modeled estimates only. TN/TP reductions contribute directly to Chesapeake Bay TMDL credits under CWA Section 303(d).</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHESAPEAKE BAY CONTRIBUTION ── */}
        {/* Only renders when portfolio has facilities in CB watershed states */}
        {lens.showImpact && portfolioScores.cbFacs > 0 && (
          <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('chesbay')} className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 transition-colors">
              <span className="text-sm font-bold text-blue-900">Chesapeake Bay Watershed Contribution</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('chesbay') && <span onClick={(e) => { e.stopPropagation(); printSection('section-chesbay', 'Chesapeake Bay Watershed Contribution'); }} className="p-1 rounded hover:bg-blue-200 text-blue-400 hover:text-blue-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('chesbay') ? <Minus className="h-4 w-4 text-blue-400" /> : <ChevronDown className="h-4 w-4 text-blue-400" />}
              </span>
            </button>
            {isSectionOpen('chesbay') && (
              <div id="section-chesbay" className="p-4 space-y-4">
                <div className="text-xs text-slate-600">
                  Aggregate environmental impact from {portfolioScores.cbFacs} facilit{portfolioScores.cbFacs === 1 ? 'y' : 'ies'} within the Chesapeake Bay watershed ({Array.from(new Set(facilitiesData.filter(f => CB_WATERSHED_STATES.has(f.state)).map(f => f.state))).sort().join(', ')})
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-center">
                    <Droplets className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-blue-700">{(portfolioScores.cbGallons / 1_000_000).toFixed(1)}M</div>
                    <div className="text-[10px] text-blue-600">Gallons Treated</div>
                    <div className="text-[9px] text-blue-400">Bay watershed</div>
                  </div>
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 text-center">
                    <Activity className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-indigo-700">{portfolioScores.cbTN.toFixed(1)}</div>
                    <div className="text-[10px] text-indigo-600">lbs TN Reduced</div>
                    <div className="text-[9px] text-indigo-400">TMDL credit-eligible</div>
                  </div>
                  <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-3 text-center">
                    <Activity className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-purple-700">{portfolioScores.cbTP.toFixed(1)}</div>
                    <div className="text-[10px] text-purple-600">lbs TP Reduced</div>
                    <div className="text-[9px] text-purple-400">TMDL credit-eligible</div>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 text-center">
                    <TrendingDown className="h-5 w-5 text-cyan-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-cyan-700">{portfolioScores.cbTSS.toLocaleString()}</div>
                    <div className="text-[10px] text-cyan-600">lbs TSS Removed</div>
                    <div className="text-[9px] text-cyan-400">Bay tributaries</div>
                  </div>
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-center">
                    <Leaf className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-emerald-700">{portfolioScores.cbMonitored}</div>
                    <div className="text-[10px] text-emerald-600">PEARL Active</div>
                    <div className="text-[9px] text-emerald-400">of {portfolioScores.cbFacs} Bay facilities</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
                    <DollarSign className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-amber-700">${(portfolioScores.cbTN * 10 + portfolioScores.cbTP * 85).toLocaleString()}</div>
                    <div className="text-[10px] text-amber-600">Credit Value (est.)</div>
                    <div className="text-[9px] text-amber-400">TN + TP market rates</div>
                  </div>
                </div>

                {/* Bay facilities table */}
                <div className="rounded-lg border border-blue-100 overflow-hidden">
                  <div className="px-3 py-2 bg-blue-50 border-b border-blue-100 text-xs font-semibold text-blue-800">Bay Watershed Facilities</div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500">
                          <th className="text-left px-3 py-1.5 font-medium">Facility</th>
                          <th className="text-left px-3 py-1.5 font-medium">State</th>
                          <th className="text-left px-3 py-1.5 font-medium">Receiving Water</th>
                          <th className="text-right px-3 py-1.5 font-medium">TN (lbs)</th>
                          <th className="text-right px-3 py-1.5 font-medium">TP (lbs)</th>
                          <th className="text-center px-3 py-1.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facilitiesData.filter(f => CB_WATERSHED_STATES.has(f.state)).map(f => (
                          <tr key={f.id} className="border-b border-slate-50 hover:bg-blue-50/50">
                            <td className="px-3 py-1.5 font-medium text-slate-800">{f.name}</td>
                            <td className="px-3 py-1.5 text-slate-600">{f.state}</td>
                            <td className="px-3 py-1.5 text-slate-500">{f.receivingWaterbody || '--'}</td>
                            <td className="text-right px-3 py-1.5 text-slate-600">{f.tnReduced ? f.tnReduced.toFixed(1) : '--'}</td>
                            <td className="text-right px-3 py-1.5 text-slate-600">{f.tpReduced ? f.tpReduced.toFixed(1) : '--'}</td>
                            <td className="text-center px-3 py-1.5">
                              {f.status === 'monitored' ? (
                                <Badge variant="secondary" className="text-[9px] h-4 bg-green-100 text-green-700 border-green-200">Verified</Badge>
                              ) : f.status === 'assessed' ? (
                                <Badge variant="secondary" className="text-[9px] h-4 bg-amber-100 text-amber-700 border-amber-200">Assessed</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[9px] h-4 bg-slate-100 text-slate-500">Pending</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-md border border-blue-200 bg-blue-50/50 px-3 py-2 text-[10px] text-blue-700">
                  Chesapeake Bay TMDL allocations require jurisdictions to meet nitrogen, phosphorus, and sediment reduction targets under EPA-approved Watershed Implementation Plans (WIPs). PEARL-verified nutrient reductions may qualify for tradeable credits under state nutrient trading programs (MD, VA, PA).
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CORPORATE SUSTAINABILITY DASHBOARD ── */}
        {lens.showImpact && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('sustainability')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Corporate Sustainability Dashboard</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('sustainability') && <span onClick={(e) => { e.stopPropagation(); printSection('section-sustainability', 'Corporate Sustainability Dashboard'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('sustainability') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('sustainability') && (
              <div id="section-sustainability" className="p-4">
                <div className="text-xs text-slate-500 mb-3">Composite scores from continuous monitoring data across {portfolioScores.monitored} PEARL-instrumented facilities</div>
                {(() => {
                  const waterQual = Math.max(0, 100 - portfolioScores.avgRisk);
                  const loadRed = portfolioScores.avgTSSEff > 0 ? Math.round(portfolioScores.avgTSSEff * 0.8) : 0; // weight TSS eff
                  const ecoHealth = Math.round((waterQual * 0.4 + loadRed * 0.3 + Math.max(0, 100 - portfolioScores.ejHighCount / Math.max(1, portfolioScores.total) * 100) * 0.3));
                  return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-medium text-slate-600 mb-1">Water Quality Score</div>
                    <div className="text-xl font-bold text-blue-600">{waterQual}</div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div className={`h-1.5 rounded-full ${waterQual >= 70 ? 'bg-green-500' : waterQual >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${waterQual}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-medium text-slate-600 mb-1">Load Reduction Score</div>
                    <div className="text-xl font-bold text-emerald-600">{loadRed}</div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div className={`h-1.5 rounded-full ${loadRed >= 70 ? 'bg-green-500' : loadRed >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${loadRed}%` }} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-medium text-slate-600 mb-1">Ecosystem Health</div>
                    <div className="text-xl font-bold text-cyan-600">{ecoHealth}</div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1">
                      <div className={`h-1.5 rounded-full ${ecoHealth >= 70 ? 'bg-green-500' : ecoHealth >= 40 ? 'bg-amber-500' : 'bg-red-400'}`} style={{ width: `${ecoHealth}%` }} />
                    </div>
                  </div>
                </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ── DISCLOSURE & REPORTING READINESS ── */}
        {lens.showDisclosure && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('disclosure')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Disclosure & Reporting Readiness</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('disclosure') && <span onClick={(e) => { e.stopPropagation(); printSection('section-disclosure', 'Disclosure & Reporting Readiness'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('disclosure') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('disclosure') && (
              <div id="section-disclosure" className="p-4 space-y-3">
                {ESG_FRAMEWORKS.map(fw => (
                  <div key={fw.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{fw.name}</span>
                        <span className="text-[10px] text-slate-500">{fw.fullName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {CLOSE_THE_GAP[fw.id] && (
                          <button
                            onClick={() => openGapWizard(fw.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:from-violet-700 hover:to-indigo-700 transition-all"
                          >
                            <Sparkles className="h-3 w-3" />
                            Close the Gap
                          </button>
                        )}
                        <Badge variant="secondary" className={
                          fw.status === 'ready' ? 'bg-green-100 text-green-700 border-green-200' :
                          fw.status === 'partial' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-red-100 text-red-700 border-red-200'
                        }>
                          {fw.status === 'ready' ? 'Ready' : fw.status === 'partial' ? 'Partial' : 'Gaps'}
                        </Badge>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${
                          fw.coverage >= 80 ? 'bg-green-500' : fw.coverage >= 50 ? 'bg-amber-500' : 'bg-red-400'
                        }`}
                        style={{ width: `${fw.coverage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="text-[10px] text-slate-500">{fw.coverage}% coverage</div>
                      <div className="flex flex-wrap gap-1">
                        {fw.relevantMetrics.slice(0, 3).map(m => (
                          <span key={m} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-600">{m}</span>
                        ))}
                        {fw.relevantMetrics.length > 3 && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-500">+{fw.relevantMetrics.length - 3} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CLOSE THE GAP WIZARD MODAL ── */}
        {gapWizardFramework && CLOSE_THE_GAP[gapWizardFramework] && (() => {
          const fw = ESG_FRAMEWORKS.find(f => f.id === gapWizardFramework)!;
          const gap = CLOSE_THE_GAP[gapWizardFramework];
          const statusIcon = (s: GapStatus) => s === 'green' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : s === 'amber' ? <AlertCircle className="h-4 w-4 text-amber-500" /> : <Circle className="h-4 w-4 text-red-400" />;
          const availBadge = (a: PearlMapping['availability']) => a === 'available' ? 'bg-green-100 text-green-700 border-green-200' : a === 'partial' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-500 border-slate-200';
          const exhibitIcon = (t: EvidenceExhibit['type']) => t === 'chart' ? <BarChart3 className="h-4 w-4" /> : t === 'table' ? <FileText className="h-4 w-4" /> : t === 'report' ? <ClipboardList className="h-4 w-4" /> : <Download className="h-4 w-4" />;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={closeGapWizard} />
              <div className="relative w-full max-w-3xl max-h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Premium gradient header */}
                <div className="bg-gradient-to-r from-violet-700 via-indigo-600 to-purple-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-5 w-5 text-violet-200" />
                        <span className="text-white font-bold text-lg">Close the Gap</span>
                        <Badge className="bg-white/20 text-white border-white/30 text-[10px]">Premium</Badge>
                      </div>
                      <div className="text-violet-200 text-sm">{fw.name} — {fw.fullName}</div>
                    </div>
                    <button onClick={closeGapWizard} className="text-white/70 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
                  </div>
                  {/* Step indicator */}
                  <div className="flex items-center gap-1 mt-4">
                    {WIZARD_STEPS.map(({ step, label, icon: StepIcon }) => (
                      <button key={step} onClick={() => setGapWizardStep(step)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        gapWizardStep === step ? 'bg-white text-violet-700 shadow-md' : gapWizardStep > step ? 'bg-white/20 text-white' : 'bg-white/10 text-white/50'
                      }`}>
                        <StepIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">{label}</span>
                        <span className="sm:hidden">{step}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Wizard body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">

                  {/* STEP 1: Missing Data Fields */}
                  {gapWizardStep === 1 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Missing Data Fields</h3>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> Available</span>
                          <span className="flex items-center gap-1"><AlertCircle className="h-3 w-3 text-amber-500" /> Partial</span>
                          <span className="flex items-center gap-1"><Circle className="h-3 w-3 text-red-400" /> Missing</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {gap.missingFields.map(f => (
                          <div key={f.field} className={`flex items-start gap-3 p-3 rounded-lg border ${
                            f.status === 'green' ? 'border-green-200 bg-green-50/50' : f.status === 'amber' ? 'border-amber-200 bg-amber-50/50' : 'border-red-200 bg-red-50/50'
                          }`}>
                            <div className="mt-0.5">{statusIcon(f.status)}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800">{f.field}</div>
                              <div className="text-xs text-slate-600 mt-0.5">{f.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>Coverage: {fw.coverage}% complete</span>
                          <span>{gap.missingFields.filter(f => f.status === 'red').length} critical gaps, {gap.missingFields.filter(f => f.status === 'amber').length} partial</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: PEARL Can Measure */}
                  {gapWizardStep === 2 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">PEARL Data Connections</h3>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Available</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Partial</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300" /> Planned</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {gap.pearlMappings.map(m => (
                          <div key={m.field} className="p-3 rounded-lg border border-slate-200 bg-white">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-semibold text-slate-700">{m.field}</span>
                              <Badge variant="secondary" className={`text-[9px] ${availBadge(m.availability)}`}>
                                {m.availability === 'available' ? 'Available' : m.availability === 'partial' ? 'Partial' : 'Planned'}
                              </Badge>
                            </div>
                            <div className="text-[11px] text-slate-600 mb-2">{m.pearlParameter}</div>
                            <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                              m.availability === 'available' ? 'bg-green-600 text-white hover:bg-green-700' :
                              m.availability === 'partial' ? 'bg-amber-500 text-white hover:bg-amber-600' :
                              'bg-slate-200 text-slate-500 cursor-not-allowed'
                            }`} disabled={m.availability === 'planned'}>
                              <Link2 className="h-3 w-3" />
                              {m.availability === 'planned' ? 'Coming Soon' : 'Connect Data'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Draft Narrative */}
                  {gapWizardStep === 3 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Draft Disclosure Narrative</h3>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-violet-100 text-violet-700 border-violet-200 text-[10px]">AI-Generated Draft</Badge>
                        </div>
                      </div>
                      <div className="relative rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/50 to-indigo-50/30 p-4">
                        <div className="absolute top-3 right-3 flex items-center gap-1">
                          <button className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                            <Download className="h-3 w-3" /> Copy
                          </button>
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pr-20">
                          {gap.narrativeTemplate}
                        </div>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-xs font-semibold text-amber-800">Placeholders require your data</div>
                            <div className="text-[11px] text-amber-700 mt-0.5">Bracketed values like [X], [N], [Company] must be replaced with actual figures from your facility data. Connect PEARL data sources in Step 2 to auto-populate where available.</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Evidence Exhibits */}
                  {gapWizardStep === 4 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Evidence Exhibits & Supporting Documentation</h3>
                      </div>
                      <div className="grid gap-2">
                        {gap.evidenceExhibits.map(ex => (
                          <div key={ex.name} className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30 transition-colors group">
                            <div className="w-9 h-9 rounded-lg bg-violet-100 flex items-center justify-center text-violet-600 group-hover:bg-violet-200 transition-colors">
                              {exhibitIcon(ex.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-slate-800">{ex.name}</div>
                              <div className="text-[11px] text-slate-500">{ex.description}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600 border-slate-200 capitalize">{ex.type}</Badge>
                              <button className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors">
                                <Download className="h-3 w-3" /> Export
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="pt-3 border-t border-slate-100">
                        <button className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md hover:from-violet-700 hover:to-indigo-700 transition-all">
                          <Package className="h-4 w-4" />
                          Export Complete {fw.name} Disclosure Package
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer navigation */}
                <div className="border-t border-slate-200 px-6 py-3 flex items-center justify-between bg-slate-50">
                  <button
                    onClick={() => setGapWizardStep(Math.max(1, gapWizardStep - 1) as WizardStep)}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      gapWizardStep === 1 ? 'text-slate-300 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-200'
                    }`}
                    disabled={gapWizardStep === 1}
                  >
                    <ChevronRight className="h-3.5 w-3.5 rotate-180" /> Previous
                  </button>
                  <div className="text-[10px] text-slate-400">Step {gapWizardStep} of 4</div>
                  {gapWizardStep < 4 ? (
                    <button
                      onClick={() => setGapWizardStep(Math.min(4, gapWizardStep + 1) as WizardStep)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button onClick={closeGapWizard} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white hover:bg-green-700 transition-colors">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Done
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── SUPPLY CHAIN WATER RISK ── */}
        {lens.showRisk && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('supplychain')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Supply Chain Water Risk</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('supplychain') && <span onClick={(e) => { e.stopPropagation(); printSection('section-supplychain', 'Supply Chain Water Risk'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('supplychain') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('supplychain') && (
              <div id="section-supplychain" className="p-4 space-y-3">
                <div className="text-xs text-slate-500 mb-2">Upstream sourcing &amp; downstream effluent exposure across Chesapeake Bay watershed</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Upstream */}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2 mb-2">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-600 rotate-180" />
                      Upstream — Ingredient Sourcing
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex justify-between">
                        <span>Facilities in water-stressed basins</span>
                        <span className="font-medium text-amber-600">{facilitiesData.filter(f => f.waterRiskScore >= 50).length} of {facilitiesData.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Suppliers in impaired watersheds</span>
                        <span className="font-medium text-amber-600">Est. 40-60%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Agricultural runoff exposure</span>
                        <span className="font-medium text-red-600">High (Chesapeake region)</span>
                      </div>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-2 italic">Source: WRI Aqueduct water stress data + ATTAINS watershed impairments</div>
                  </div>
                  {/* Downstream */}
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2 mb-2">
                      <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
                      Downstream — Effluent &amp; Discharge
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex justify-between">
                        <span>Facilities discharging to Bay tributaries</span>
                        <span className="font-medium">{facilitiesData.filter(f => ['MD', 'VA'].includes(f.state)).length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Receiving waters with TMDLs</span>
                        <span className="font-medium text-amber-600">{facilitiesData.filter(f => f.status === 'monitored' || f.status === 'assessed').length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>PEARL-mitigated discharge points</span>
                        <span className="font-medium text-green-600">{portfolioScores.monitored}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Facilities in EJ communities</span>
                        <span className="font-medium text-purple-600">{portfolioScores.ejHighCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ECONOMIC CO-BENEFITS ── */}
        {lens.showImpact && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('economic')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Economic Co-Benefits</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('economic') && <span onClick={(e) => { e.stopPropagation(); printSection('section-economic', 'Economic Co-Benefits'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('economic') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('economic') && (
              <div id="section-economic" className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">Seafood Industry Value</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex justify-between"><span>MD blue crab harvest</span><span className="font-medium">$89M/yr</span></div>
                      <div className="flex justify-between"><span>MD oyster harvest</span><span className="font-medium">$32M/yr</span></div>
                      <div className="flex justify-between"><span>Bay seafood economy (total)</span><span className="font-bold text-emerald-700">$600M+/yr</span></div>
                    </div>
                    <div className="text-[9px] text-slate-400 mt-2 italic">Cleaner Bay water directly supports commercial harvest viability and market premium</div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">Nutrient Credit Value</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex justify-between"><span>TN credits generated</span><span className="font-medium">{portfolioScores.totalTN.toFixed(1)} lbs</span></div>
                      <div className="flex justify-between"><span>TP credits generated</span><span className="font-medium">{portfolioScores.totalTP.toFixed(1)} lbs</span></div>
                      <div className="flex justify-between"><span>Market value (TN@$8-12/lb)</span><span className="font-bold text-blue-700">${(portfolioScores.totalTN * 10).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Market value (TP@$50-120/lb)</span><span className="font-bold text-blue-700">${(portfolioScores.totalTP * 85).toLocaleString()}</span></div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50/30 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-4 w-4 text-cyan-600" />
                      <span className="text-xs font-bold text-slate-800">Ecosystem Services</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex justify-between"><span>Oyster reef value (per acre)</span><span className="font-medium">$700K/yr</span></div>
                      <div className="flex justify-between"><span>Water filtration (per oyster)</span><span className="font-medium">50 gal/day</span></div>
                      <div className="flex justify-between"><span>Habitat co-benefits</span><span className="font-medium text-cyan-700">Reef + nursery</span></div>
                      <div className="flex justify-between"><span>Carbon sequestration</span><span className="font-medium text-cyan-700">Shell + biomass</span></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SHAREHOLDER REPORTING ── */}
        {lens.showShareholder && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('shareholder')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Shareholder & Investor Reporting</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('shareholder') && <span onClick={(e) => { e.stopPropagation(); printSection('section-shareholder', 'Shareholder & Investor Reporting'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('shareholder') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('shareholder') && (
              <div id="section-shareholder" className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-800">Financial Materiality</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between"><span>Water risk exposure</span><span className="font-medium">${(portfolioScores.highRisk * 850_000).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Compliance cost avoidance</span><span className="font-medium text-emerald-600">$340,000/yr</span></div>
                      <div className="flex justify-between"><span>Insurance premium reduction</span><span className="font-medium text-emerald-600">~8-12%</span></div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-bold text-slate-800">ESG Rating Impact</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between"><span>MSCI ESG Rating</span><span className="font-medium">A → AA (projected)</span></div>
                      <div className="flex justify-between"><span>Sustainalytics Risk</span><span className="font-medium">Medium → Low</span></div>
                      <div className="flex justify-between"><span>CDP Water Score</span><span className="font-medium">C → B</span></div>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold text-slate-800">Stakeholder Value</span>
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1">
                      <div className="flex justify-between"><span>Community benefit</span><span className="font-medium">{portfolioScores.monitored} watersheds</span></div>
                      <div className="flex justify-between"><span>Jobs supported</span><span className="font-medium">12-18 FTE</span></div>
                      <div className="flex justify-between"><span>EJ community overlap</span><span className="font-medium">3 of {portfolioScores.total} sites</span></div>
                    </div>
                  </div>
                </div>
                {/* Projection banner */}
                <div className="rounded-md border border-amber-200 bg-amber-50/50 px-3 py-1.5 flex items-center gap-2">
                  <BarChart3 className="h-3 w-3 text-amber-600 flex-shrink-0" />
                  <span className="text-[10px] text-amber-700">Rating projections are modeled estimates. Actual ESG rating changes depend on verified deployment data and reporting agency methodology.</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── INDUSTRY ESG BENCHMARKING ── */}
        {lens.showBenchmark && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('benchmark')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Industry ESG Benchmarking</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('benchmark') && <span onClick={(e) => { e.stopPropagation(); printSection('section-benchmark', 'Industry ESG Benchmarking'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('benchmark') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('benchmark') && (
              <div id="section-benchmark" className="p-4 space-y-3">
                <div className="text-xs text-slate-500 mb-2">Comparison against seafood / food processing industry peers on water stewardship metrics</div>
                {/* Benchmark bars */}
                {[
                  { metric: 'Water Intensity (gal/$M revenue)', yours: 35, industry: 58, better: 'lower' as const },
                  { metric: 'Wastewater Treatment Rate', yours: 92, industry: 67, better: 'higher' as const },
                  { metric: 'TSS Removal Efficiency (avg)', yours: portfolioScores.avgTSSEff, industry: 45, better: 'higher' as const },
                  { metric: 'Water Risk Mitigation Coverage', yours: Math.round(portfolioScores.monitored / Math.max(1, portfolioScores.total) * 100), industry: 28, better: 'higher' as const },
                  { metric: 'Nutrient Credit Generation (lbs TN)', yours: Math.min(100, Math.round(portfolioScores.totalTN / 5)), industry: 8, better: 'higher' as const },
                  { metric: 'Real-Time Monitoring Coverage', yours: Math.round(portfolioScores.monitored / Math.max(1, portfolioScores.total) * 100), industry: 12, better: 'higher' as const },
                  { metric: 'Bay Ecosystem Restoration Investment', yours: 72, industry: 18, better: 'higher' as const },
                ].map(b => (
                  <div key={b.metric} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-700 font-medium">{b.metric}</span>
                      <span className="text-slate-500">
                        You: <span className="font-bold text-emerald-700">{Math.round(b.yours)}%</span>
                        {' · '}Industry: <span className="font-bold text-slate-600">{b.industry}%</span>
                      </span>
                    </div>
                    <div className="relative h-2 bg-slate-100 rounded-full">
                      <div className="absolute h-2 bg-slate-300 rounded-full" style={{ width: `${b.industry}%` }} />
                      <div className="absolute h-2 bg-emerald-500 rounded-full" style={{ width: `${Math.round(b.yours)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REGULATORY COMPLIANCE ── */}
        {lens.showCompliance && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('compliance')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Regulatory Compliance Status</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('compliance') && <span onClick={(e) => { e.stopPropagation(); printSection('section-compliance', 'Regulatory Compliance Status'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('compliance') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('compliance') && (
              <div id="section-compliance" className="p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-green-200 bg-green-50/50 p-3 text-center">
                    <Shield className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-green-700">{facilitiesData.filter(f => f.alertLevel === 'none').length}</div>
                    <div className="text-[10px] text-green-600">Clean Record</div>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-3 text-center">
                    <Eye className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-yellow-700">{facilitiesData.filter(f => f.alertLevel === 'low').length}</div>
                    <div className="text-[10px] text-yellow-600">Watch List</div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-amber-700">{facilitiesData.filter(f => f.alertLevel === 'medium').length}</div>
                    <div className="text-[10px] text-amber-600">Violations</div>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3 text-center">
                    <Scale className="h-5 w-5 text-red-600 mx-auto mb-1" />
                    <div className="text-lg font-bold text-red-700">{facilitiesData.filter(f => f.alertLevel === 'high').length}</div>
                    <div className="text-[10px] text-red-600">Enforcement Action</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  Source: EPA ECHO facility compliance database · Updated at page load
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── BRAND & VALUE TRUST ── */}
        {lens.showBrand && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('brand')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Brand & Value Trust</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('brand') && <span onClick={(e) => { e.stopPropagation(); printSection('section-brand', 'Brand & Value Trust'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('brand') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('brand') && (
              <div id="section-brand" className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 text-emerald-600" />
                      Public Impact Narrative
                    </div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      "{companyName} actively invests in nature-based water infrastructure across {facilitiesData.length} facilities,
                      treating stormwater runoff and restoring aquatic ecosystems in the communities where we operate.
                      Our PEARL biofiltration systems combine oyster-powered natural filtration with real-time water quality monitoring,
                      demonstrating measurable environmental improvement at every deployment."
                    </div>
                    <div className="text-[9px] text-slate-400 italic">Auto-generated narrative — customize for annual report, press releases, investor comms</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-amber-500" />
                      Trust Indicators
                    </div>
                    <div className="text-[11px] text-slate-600 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Zap className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Real-time monitoring — data available 24/7, not self-reported</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Lock className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Chain of custody — NIST-traceable calibration, immutable audit trail</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Shield className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Third-party verification — monthly split samples by state-certified lab</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><Users className="h-2.5 w-2.5 text-green-600" /></div>
                        <span>Community benefit — EJ overlay shows impact in underserved areas</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WATER RISK DETAIL (selected facility) ── */}
        {lens.showRisk && selectedFac && (
          <div className="rounded-xl border-2 border-emerald-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
              <span className="text-sm font-bold text-emerald-800">{selectedFac.name} — Facility Detail</span>
              <button onClick={() => setSelectedFacility(null)} className="text-xs text-slate-500 hover:text-slate-700">Close x</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.waterRiskScore}</div>
                  <div className="text-[10px] text-slate-500">Water Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.state}</div>
                  <div className="text-[10px] text-slate-500">State</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.activeAlerts}</div>
                  <div className="text-[10px] text-slate-500">Alerts</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.tssEfficiency ? `${selectedFac.tssEfficiency}%` : '--'}</div>
                  <div className="text-[10px] text-slate-500">TSS Eff.</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.ejScore ?? '--'}</div>
                  <div className="text-[10px] text-slate-500">EJ Score</div>
                </div>
                <div className="text-center">
                  <Badge variant="secondary" className={
                    selectedFac.status === 'monitored' ? 'bg-green-100 text-green-700' :
                    selectedFac.status === 'assessed' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }>
                    {selectedFac.status === 'monitored' ? 'PEARL Active' : selectedFac.status === 'assessed' ? 'Assessed Only' : 'Unmonitored'}
                  </Badge>
                  <div className="text-[10px] text-slate-500 mt-1">Status</div>
                </div>
              </div>
              {/* Treatment summary for monitored facilities */}
              {selectedFac.status === 'monitored' && (
                <div className="grid grid-cols-4 gap-2">
                  <div className="rounded-md bg-blue-50 p-2 text-center">
                    <div className="text-sm font-bold text-blue-700">{selectedFac.gallonsTreated ? (selectedFac.gallonsTreated / 1000).toFixed(0) + 'K' : '--'}</div>
                    <div className="text-[9px] text-blue-600">Gallons</div>
                  </div>
                  <div className="rounded-md bg-indigo-50 p-2 text-center">
                    <div className="text-sm font-bold text-indigo-700">{selectedFac.tnReduced?.toFixed(1) || '--'}</div>
                    <div className="text-[9px] text-indigo-600">lbs TN</div>
                  </div>
                  <div className="rounded-md bg-purple-50 p-2 text-center">
                    <div className="text-sm font-bold text-purple-700">{selectedFac.tpReduced?.toFixed(1) || '--'}</div>
                    <div className="text-[9px] text-purple-600">lbs TP</div>
                  </div>
                  <div className="rounded-md bg-emerald-50 p-2 text-center">
                    <div className="text-sm font-bold text-emerald-700">{selectedFac.tssReduced?.toLocaleString() || '--'}</div>
                    <div className="text-[9px] text-emerald-600">lbs TSS</div>
                  </div>
                </div>
              )}
              <div className="text-[10px] text-slate-500 space-y-0.5">
                {selectedFac.receivingWaterbody && <div>Receiving waterbody: <span className="font-medium text-slate-700">{selectedFac.receivingWaterbody}</span></div>}
                {selectedFac.huc12 && <div>HUC-12: <span className="font-mono text-slate-600">{selectedFac.huc12}</span></div>}
                <div>Water risk derived from EPA ATTAINS impairment data. Compliance from EPA ECHO. EJ burden from EJScreen.</div>
              </div>
            </div>
          </div>
        )}

        {/* ── DATA EXPORT HUB ── */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <button onClick={() => toggleCollapse('exporthub')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
            <span className="text-sm font-bold text-slate-800">📦 Data Export Hub</span>
            <span className="flex items-center gap-1">
              {isSectionOpen('exporthub') && <span onClick={(e) => { e.stopPropagation(); printSection('section-exporthub', 'Data Export Hub'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
              {isSectionOpen('exporthub') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </span>
          </button>
          {isSectionOpen('exporthub') && (
            <div className="p-4">
              <DataExportHub context="esg" />
            </div>
          )}
        </div>

        {/* ── GRANT OPPORTUNITIES ── */}
        {lens.showGrants && (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <button onClick={() => toggleCollapse('grants')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
              <span className="text-sm font-bold text-slate-800">Grant & Incentive Opportunities</span>
              <span className="flex items-center gap-1">
                {isSectionOpen('grants') && <span onClick={(e) => { e.stopPropagation(); printSection('section-grants', 'Grant & Incentive Opportunities'); }} className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors" title="Print section"><Printer className="h-3.5 w-3.5" /></span>}
                {isSectionOpen('grants') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </span>
            </button>
            {isSectionOpen('grants') && (
              <div id="section-grants" className="p-4">
                <p className="text-xs text-slate-500 mb-3">
                  Environmental grants, tax incentives, and sustainability funding that align with your PEARL deployments.
                  Filtered by facility locations and eligible programs.
                </p>
                {/* TODO: Wire GrantOpportunityMatcher component */}
                <div className="space-y-2">
                  {[
                    { name: 'EPA Clean Water State Revolving Fund', amount: '$500K-$5M', match: 'High', deadline: 'Rolling' },
                    { name: 'CWA Section 319 Nonpoint Source', amount: '$100K-$500K', match: 'High', deadline: 'Varies by state' },
                    { name: 'USDA Conservation Innovation Grants', amount: '$150K-$2M', match: 'Medium', deadline: 'Annual' },
                    { name: 'State Green Infrastructure Tax Credit', amount: 'Up to 50% of cost', match: 'Medium', deadline: 'Varies' },
                  ].map(g => (
                    <div key={g.name} className="flex items-center justify-between p-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                      <div>
                        <div className="text-xs font-medium text-slate-800">{g.name}</div>
                        <div className="text-[10px] text-slate-500">{g.amount} · Deadline: {g.deadline}</div>
                      </div>
                      <Badge variant="secondary" className={g.match === 'High' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                        {g.match} Match
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DISCLAIMER FOOTER ── */}
        <PlatformDisclaimer />

      </div>
    </div>
  );
}

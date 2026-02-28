'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useLensParam } from '@/lib/useLensParam';
import { feature } from 'topojson-client';
import statesTopo from 'us-atlas/states-10m.json';
import type { MapRef } from 'react-map-gl';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, AlertTriangle, AlertCircle, CheckCircle, MapPin, Droplets, Leaf, DollarSign, Users, TrendingUp, BarChart3, Gauge, Shield, LogOut, Building2, Info, ChevronDown, Minus, Clock, Target, ArrowRight, Eye, Sparkles, Scale, Activity } from 'lucide-react';
import { brandedPrintSection, BrandedPrintBtn } from '@/lib/brandedPrint';
import { useRouter } from 'next/navigation';
import { getRegionById } from '@/lib/regionsConfig';
import HeroBanner from './HeroBanner';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { computeRestorationPlan, resolveAttainsCategory, mergeAttainsCauses, COST_PER_UNIT_YEAR, type RestorationResult } from '@/lib/restorationEngine';
import { WaterbodyDetailCard } from '@/components/WaterbodyDetailCard';
import { getEcoScore, getEcoData } from '@/lib/ecologicalSensitivity';
import { getEJScore, getEJData } from '@/lib/ejVulnerability';
import { getExposureScore } from '@/lib/waterfrontExposure';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import { useAuth } from '@/lib/authContext';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { useTierFilter } from '@/lib/useTierFilter';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import StateWaterbodyCard from '@/components/StateWaterbodyCard';
import ResolutionPlanner, { type ScopeContext, type DataReliabilityReport } from '@/components/ResolutionPlanner';
import RestorationPlanner from '@/components/RestorationPlanner';
import type { NationalSummary } from '@/lib/national-summary';
import NationalStatusCard from '@/components/NationalStatusCard';
import { EPA_REGIONS, getEpaRegionForState } from '@/lib/epa-regions';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { useTheme } from '@/lib/useTheme';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import LocationReportCard from '@/components/LocationReportCard';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { GrantOpportunityMatcher } from './GrantOpportunityMatcher';
import { GrantOutcomesCard } from './GrantOutcomesCard';
import { EmergingContaminantsTracker } from './EmergingContaminantsTracker';
import { PolicyTracker } from './PolicyTracker';
import { DataLatencyTracker } from './DataLatencyTracker';
import { useAdminState, STATE_ABBR_TO_NAME } from '@/lib/adminStateContext';

import { HabitatEcologyPanel } from './HabitatEcologyPanel';
import { AgriculturalNPSPanel } from './AgriculturalNPSPanel';
import { DisasterEmergencyPanel } from './DisasterEmergencyPanel';
import { MilitaryInstallationsPanel } from './MilitaryInstallationsPanel';
import WaterfrontExposurePanel from './WaterfrontExposurePanel';
import { INDEX_WEIGHTS } from '@/lib/indices/config';
import { useSentinelAlerts } from '@/hooks/useSentinelAlerts';
import { useSentinelHealth } from '@/hooks/useSentinelHealth';
import { useSentinelAudio } from '@/hooks/useSentinelAudio';
import { SentinelStatusBadge } from './SentinelStatusBadge';
import { SentinelBriefingCard } from './SentinelBriefingCard';
import AMSAlertMonitor from '@/ams/components/AMSAlertMonitor';
import { useAlertSummary } from '@/ams/hooks/useAlertSummary';
import { MOCK_ALERT_SUMMARY } from '@/ams/data/mock-alerts';
import hucNamesData from '@/data/huc8-names.json';
import centroidsData from '@/data/huc8-centroids.json';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false }
);
const MapboxChoropleth = dynamic(
  () => import('@/components/MapboxChoropleth').then(m => m.MapboxChoropleth),
  { ssr: false }
);
const SentinelAlertLayer = dynamic(
  () => import('@/components/SentinelAlertLayer').then(m => m.SentinelAlertLayer),
  { ssr: false }
);
const SentinelAlertPanel = dynamic(
  () => import('@/components/SentinelAlertPanel').then(m => m.SentinelAlertPanel),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = 'none' | 'low' | 'medium' | 'high';
type OverlayId = 'hotspots' | 'ms4' | 'ej' | 'economy' | 'wildlife' | 'trend' | 'coverage' | 'indices';
type ViewLens = 'overview' | 'briefing' | 'planner' | 'trends' | 'policy' | 'compliance' |
  'water-quality' | 'public-health' | 'habitat-ecology' | 'agricultural-nps' |
  'infrastructure' | 'monitoring' | 'disaster-emergency' | 'military-installations' |
  'scorecard' | 'reports' | 'interagency' | 'funding';

// ─── Lens Configuration: what each view shows/hides ────────────────────────────
const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  defaultOverlay: OverlayId;
  showTopStrip: boolean;       // Federal-style 6-tile numbers
  showPriorityQueue: boolean;  // Intervention/funding queue
  showCoverageGaps: boolean;   // State coverage gap panel
  showNetworkHealth: boolean;  // Big grade banner
  showNationalImpact: boolean; // Gallons treated counter
  showAIInsights: boolean;     // AI narrative cards
  showHotspots: boolean;       // Top 10 worsening/improving
  showSituationSummary: boolean; // 7-tile national summary
  showTimeRange: boolean;      // Time range + treatment impact toggle
  showSLA: boolean;            // SLA compliance tracking
  showRestorationPlan: boolean; // Restoration plan card
  collapseStateTable: boolean; // Collapse behind button vs full
  /** LayoutEditor section IDs to show for this lens (null = show all) */
  sections: Set<string> | null;
}> = {
  overview: {
    label: 'The WARR Room',
    description: 'Role landing — KPI strip, map, and national situation',
    defaultOverlay: 'hotspots',
    showTopStrip: true, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['usmap', 'warr-metrics', 'warr-analyze', 'warr-respond', 'warr-resolve', 'disclaimer']),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'AI-generated summary of all federal data sources',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: true,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['ai-water-intelligence', 'sentinel-briefing', 'national-briefing', 'waterfront-exposure', 'briefing-actions', 'briefing-changes', 'briefing-pulse', 'briefing-stakeholder', 'disclaimer']),
  },
  compliance: {
    label: 'Compliance',
    description: 'NPDES enforcement + drinking water violations',
    defaultOverlay: 'hotspots',
    showTopStrip: true, showPriorityQueue: true, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: true, collapseStateTable: true,
    sections: new Set(['networkhealth', 'icis', 'sdwis', 'priorityqueue', 'sentinel-alerts-placeholder', 'disclaimer']),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'ATTAINS assessments, impaired waterbodies, WQP trends',
    defaultOverlay: 'hotspots',
    showTopStrip: true, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: true, showSituationSummary: true, showTimeRange: true,
    showSLA: false, showRestorationPlan: false, collapseStateTable: false,
    sections: new Set(['networkhealth', 'impairmentprofile', 'coveragegaps', 'situation', 'statebystatesummary', 'top10', 'disclaimer']),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'Facility map, PFAS, groundwater, and compliance status',
    defaultOverlay: 'ej',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: true, showNationalImpact: true, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['networkhealth', 'nationalimpact', 'groundwater', 'waterfront-exposure', 'disclaimer']),
  },
  monitoring: {
    label: 'Monitoring',
    description: 'Coverage gaps, network health, data freshness',
    defaultOverlay: 'coverage',
    showTopStrip: true, showPriorityQueue: false, showCoverageGaps: true,
    showNetworkHealth: true, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: true, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['networkhealth', 'coveragegaps', 'sla', 'sentinel-briefing', 'disclaimer']),
  },
  trends: {
    label: 'Trends & Projections',
    description: 'Long-term trends, watershed forecasts, and climate overlays',
    defaultOverlay: 'trend',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: true,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['trends-dashboard', 'disclaimer']),
  },
  policy: {
    label: 'Policy Tracker',
    description: 'Proposed rules, comment periods, and regulatory impacts',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['policy-tracker', 'disclaimer']),
  },
  'public-health': {
    label: 'Public Health & Contaminants',
    description: 'PFAS, microplastics, and unregulated contaminant tracking',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['contaminants-tracker', 'disclaimer']),
  },
  'habitat-ecology': {
    label: 'Habitat & Ecology',
    description: 'Aquatic life use attainment, habitat impairments, T&E species',
    defaultOverlay: 'wildlife',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['habitat-ecology', 'disclaimer']),
  },
  'agricultural-nps': {
    label: 'Agricultural & NPS',
    description: 'Agriculture-related impairments, nutrient loading, nonpoint sources',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['agricultural-nps', 'disclaimer']),
  },
  'disaster-emergency': {
    label: 'Disaster & Emergency',
    description: 'Groundwater monitoring, emergency watch zones, incident readiness',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['disaster-emergency', 'disclaimer']),
  },
  'military-installations': {
    label: 'Military Installations',
    description: 'Federal facility permits, DOD compliance, PFAS proximity analysis',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['military-installations', 'disclaimer']),
  },
  scorecard: {
    label: 'Scorecard',
    description: 'Graded performance metrics across all states',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['scorecard-kpis', 'scorecard-grades', 'scorecard-choropleth', 'scorecard-rankings', 'scorecard-trends', 'disclaimer']),
  },
  reports: {
    label: 'Reports',
    description: 'Export data in role-specific formats',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['reports-hub', 'disclaimer']),
  },
  interagency: {
    label: 'Cross-Agency',
    description: 'Inter-agency coordination, shared data, and joint initiatives',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['interagency-hub', 'data-latency', 'disclaimer']),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'Available funding, eligibility, deadlines, and grant matching',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['funding-deadlines', 'grant-outcomes', 'funding-gap', 'disclaimer']),
  },
  planner: {
    label: 'Response Planner',
    description: 'Federal-scope response planning with data reliability assessment and before/after impact maps',
    defaultOverlay: 'hotspots',
    showTopStrip: false, showPriorityQueue: false, showCoverageGaps: false,
    showNetworkHealth: false, showNationalImpact: false, showAIInsights: false,
    showHotspots: false, showSituationSummary: false, showTimeRange: false,
    showSLA: false, showRestorationPlan: false, collapseStateTable: true,
    sections: new Set(['resolution-planner', 'disclaimer']),
  },
};

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
  onClose: () => void;
  onToggleDevMode?: () => void;
  onSelectRegion: (regionId: string) => void;
  federalMode?: boolean;
};

interface GeoFeature {
  id: string;
  type?: string;
  geometry?: any;
  properties?: { name?: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Letter grade scale (0-100 → A+ through F)
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

const NAME_TO_ABBR: Record<string, string> = Object.entries(STATE_ABBR_TO_NAME).reduce(
  (acc, [abbr, name]) => {
    acc[name] = abbr;
    return acc;
  },
  {} as Record<string, string>
);

// FIPS code → abbreviation (us-atlas uses FIPS as geometry.id)
const FIPS_TO_ABBR: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY',
};

// ─── Leaflet Map Constants ────────────────────────────────────────────────────
const US_CENTER: [number, number] = [39.8, -98.5];
const US_ZOOM = 4;
const CARTO_TILES = 'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const CARTO_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

/** Resolve a GeoJSON feature to a 2-letter state abbreviation */
function geoToAbbr(g: GeoFeature): string | undefined {
  if (g.id) {
    const fips = String(g.id).padStart(2, '0');
    if (FIPS_TO_ABBR[fips]) return FIPS_TO_ABBR[fips];
  }
  if (g.properties?.name && NAME_TO_ABBR[g.properties.name]) return NAME_TO_ABBR[g.properties.name];
  return undefined;
}

// ─── State Water Quality Agency Directory ─────────────────────────────────────
// Real agency names, water quality program URLs, and CWA regulatory contacts
interface StateAgency {
  name: string;           // Agency name
  division: string;       // Water quality division/bureau
  url: string;            // Direct link to water quality program page
  ms4Program: string;     // MS4/stormwater permit program name
  cwaSec: string;         // Primary CWA section (303d, 319, 402)
  phone?: string;
}

const STATE_AGENCIES: Record<string, StateAgency> = {
  AL: { name: 'Alabama Dept. of Environmental Management', division: 'Water Division', url: 'https://adem.alabama.gov/programs/water/', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  AK: { name: 'Alaska Dept. of Environmental Conservation', division: 'Division of Water', url: 'https://dec.alaska.gov/water/', ms4Program: 'APDES MS4', cwaSec: '§303(d)/§402' },
  AZ: { name: 'Arizona Dept. of Environmental Quality', division: 'Water Quality Division', url: 'https://www.azdeq.gov/WQD', ms4Program: 'AZPDES MS4', cwaSec: '§303(d)/§402' },
  AR: { name: 'Arkansas Dept. of Energy & Environment', division: 'Office of Water Quality', url: 'https://www.adeq.state.ar.us/water/', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  CA: { name: 'California State Water Resources Control Board', division: 'Division of Water Quality', url: 'https://www.waterboards.ca.gov/water_issues/programs/', ms4Program: 'NPDES MS4 Phase I/II', cwaSec: '§303(d)/§402' },
  CO: { name: 'Colorado Dept. of Public Health & Environment', division: 'Water Quality Control Division', url: 'https://cdphe.colorado.gov/wqcd', ms4Program: 'CDPS MS4', cwaSec: '§303(d)/§402' },
  CT: { name: 'Connecticut DEEP', division: 'Bureau of Water Protection & Land Reuse', url: 'https://portal.ct.gov/deep/water', ms4Program: 'General Permit MS4', cwaSec: '§303(d)/§402' },
  DE: { name: 'Delaware DNREC', division: 'Division of Water', url: 'https://dnrec.alpha.delaware.gov/water/', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  DC: { name: 'DC Dept. of Energy & Environment', division: 'Water Quality Division', url: 'https://doee.dc.gov/service/water-quality', ms4Program: 'DC MS4 Permit', cwaSec: '§303(d)/§402' },
  FL: { name: 'Florida Dept. of Environmental Protection', division: 'Division of Water Resource Management', url: 'https://floridadep.gov/water', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  GA: { name: 'Georgia Environmental Protection Division', division: 'Watershed Protection Branch', url: 'https://epd.georgia.gov/watershed-protection-branch', ms4Program: 'NPDES MS4 Phase I/II', cwaSec: '§303(d)/§402' },
  HI: { name: 'Hawaii Dept. of Health', division: 'Clean Water Branch', url: 'https://health.hawaii.gov/cwb/', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  ID: { name: 'Idaho Dept. of Environmental Quality', division: 'Water Quality Division', url: 'https://www.deq.idaho.gov/water-quality/', ms4Program: 'IPDES MS4', cwaSec: '§303(d)/§402' },
  IL: { name: 'Illinois EPA', division: 'Bureau of Water', url: 'https://epa.illinois.gov/topics/water-quality.html', ms4Program: 'ILR40 MS4', cwaSec: '§303(d)/§402' },
  IN: { name: 'Indiana Dept. of Environmental Management', division: 'Office of Water Quality', url: 'https://www.in.gov/idem/water/', ms4Program: 'Rule 13 MS4', cwaSec: '§303(d)/§402' },
  IA: { name: 'Iowa Dept. of Natural Resources', division: 'Water Quality Bureau', url: 'https://www.iowadnr.gov/Environmental-Protection/Water-Quality', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  KS: { name: 'Kansas Dept. of Health & Environment', division: 'Bureau of Water', url: 'https://www.kdhe.ks.gov/149/Water', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  KY: { name: 'Kentucky Energy & Environment Cabinet', division: 'Division of Water', url: 'https://eec.ky.gov/Environmental-Protection/Water', ms4Program: 'KPDES MS4', cwaSec: '§303(d)/§402' },
  LA: { name: 'Louisiana DEQ', division: 'Water Permits Division', url: 'https://www.deq.louisiana.gov/page/water', ms4Program: 'LPDES MS4', cwaSec: '§303(d)/§402' },
  ME: { name: 'Maine DEP', division: 'Bureau of Water Quality', url: 'https://www.maine.gov/dep/water/', ms4Program: 'MEPDES MS4', cwaSec: '§303(d)/§402' },
  MD: { name: 'Maryland Dept. of the Environment', division: 'Water & Science Administration', url: 'https://mde.maryland.gov/programs/water/Pages/index.aspx', ms4Program: 'MD MS4/NPDES', cwaSec: '§303(d)/§402', phone: '(410) 537-3000' },
  MA: { name: 'Massachusetts DEP', division: 'Bureau of Water Resources', url: 'https://www.mass.gov/orgs/massdep-bureau-of-water-resources', ms4Program: 'NPDES MS4 General Permit', cwaSec: '§303(d)/§402' },
  MI: { name: 'Michigan EGLE', division: 'Water Resources Division', url: 'https://www.michigan.gov/egle/about/organization/water-resources', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  MN: { name: 'Minnesota Pollution Control Agency', division: 'Water Quality Division', url: 'https://www.pca.state.mn.us/water', ms4Program: 'NPDES/SDS MS4', cwaSec: '§303(d)/§402' },
  MS: { name: 'Mississippi DEQ', division: 'Office of Pollution Control', url: 'https://www.mdeq.ms.gov/water/', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  MO: { name: 'Missouri DNR', division: 'Water Protection Program', url: 'https://dnr.mo.gov/water', ms4Program: 'NPDES MS4 Phase I/II', cwaSec: '§303(d)/§402' },
  MT: { name: 'Montana DEQ', division: 'Water Quality Division', url: 'https://deq.mt.gov/water', ms4Program: 'MPDES MS4', cwaSec: '§303(d)/§402' },
  NE: { name: 'Nebraska DEE', division: 'Water Quality Division', url: 'https://dee.ne.gov/NDEQProg.nsf/WaterHome.xsp', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  NV: { name: 'Nevada Division of Environmental Protection', division: 'Bureau of Water Quality Planning', url: 'https://ndep.nv.gov/water', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  NH: { name: 'New Hampshire DES', division: 'Water Division', url: 'https://www.des.nh.gov/water', ms4Program: 'EPA Region 1 MS4', cwaSec: '§303(d)/§402' },
  NJ: { name: 'New Jersey DEP', division: 'Division of Water Quality', url: 'https://www.nj.gov/dep/dwq/', ms4Program: 'NJ Tier A MS4', cwaSec: '§303(d)/§402' },
  NM: { name: 'New Mexico Environment Dept.', division: 'Surface Water Quality Bureau', url: 'https://www.env.nm.gov/surface-water-quality/', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  NY: { name: 'New York DEC', division: 'Division of Water', url: 'https://www.dec.ny.gov/chemical/water.html', ms4Program: 'SPDES MS4 GP-0-24-001', cwaSec: '§303(d)/§402' },
  NC: { name: 'North Carolina DEQ', division: 'Division of Water Resources', url: 'https://www.deq.nc.gov/about/divisions/water-resources', ms4Program: 'NPDES MS4 Phase I/II', cwaSec: '§303(d)/§402' },
  ND: { name: 'North Dakota DEQ', division: 'Division of Water Quality', url: 'https://deq.nd.gov/wq/', ms4Program: 'NDPDES MS4', cwaSec: '§303(d)/§402' },
  OH: { name: 'Ohio EPA', division: 'Division of Surface Water', url: 'https://epa.ohio.gov/divisions-and-offices/surface-water', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  OK: { name: 'Oklahoma DEQ', division: 'Water Quality Division', url: 'https://www.deq.ok.gov/water-quality-division/', ms4Program: 'OPDES MS4', cwaSec: '§303(d)/§402' },
  OR: { name: 'Oregon DEQ', division: 'Water Quality Division', url: 'https://www.oregon.gov/deq/wq/Pages/default.aspx', ms4Program: 'NPDES MS4 Phase I', cwaSec: '§303(d)/§402' },
  PA: { name: 'Pennsylvania DEP', division: 'Bureau of Clean Water', url: 'https://www.dep.pa.gov/Business/Water/CleanWater/Pages/default.aspx', ms4Program: 'PAG-13 MS4', cwaSec: '§303(d)/§402' },
  RI: { name: 'Rhode Island DEM', division: 'Office of Water Resources', url: 'https://dem.ri.gov/programs/water', ms4Program: 'RIPDES MS4', cwaSec: '§303(d)/§402' },
  SC: { name: 'South Carolina DHEC', division: 'Bureau of Water', url: 'https://scdhec.gov/environment/water-quality', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  SD: { name: 'South Dakota DANR', division: 'Water Quality Program', url: 'https://danr.sd.gov/Environment/WaterQuality/', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  TN: { name: 'Tennessee Dept. of Environment & Conservation', division: 'Division of Water Resources', url: 'https://www.tn.gov/environment/program-areas/wr-water-resources.html', ms4Program: 'NPDES MS4 Phase I/II', cwaSec: '§303(d)/§402' },
  TX: { name: 'Texas Commission on Environmental Quality', division: 'Water Quality Division', url: 'https://www.tceq.texas.gov/waterquality', ms4Program: 'TPDES MS4 Phase I/II', cwaSec: '§303(d)/§402' },
  UT: { name: 'Utah DEQ', division: 'Division of Water Quality', url: 'https://deq.utah.gov/division-water-quality', ms4Program: 'UPDES MS4', cwaSec: '§303(d)/§402' },
  VT: { name: 'Vermont DEC', division: 'Watershed Management Division', url: 'https://dec.vermont.gov/watershed', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  VA: { name: 'Virginia DEQ', division: 'Water Division', url: 'https://www.deq.virginia.gov/water', ms4Program: 'VPDES MS4', cwaSec: '§303(d)/§402' },
  WA: { name: 'Washington Dept. of Ecology', division: 'Water Quality Program', url: 'https://ecology.wa.gov/water-shorelines/water-quality', ms4Program: 'NPDES WA MS4 Phase I/II', cwaSec: '§303(d)/§402' },
  WV: { name: 'West Virginia DEP', division: 'Division of Water & Waste Management', url: 'https://dep.wv.gov/WWE/Programs/wqmonitoring/Pages/default.aspx', ms4Program: 'NPDES MS4', cwaSec: '§303(d)/§402' },
  WI: { name: 'Wisconsin DNR', division: 'Water Quality Bureau', url: 'https://dnr.wisconsin.gov/topic/Water', ms4Program: 'WPDES MS4', cwaSec: '§303(d)/§402' },
  WY: { name: 'Wyoming DEQ', division: 'Water Quality Division', url: 'https://deq.wyoming.gov/water-quality/', ms4Program: 'WYPDES MS4', cwaSec: '§303(d)/§402' },
};

// ─── Waterbody Coordinates for Story Modal Map Imagery ────────────────────────
const REGION_COORDS: Record<string, [number, number]> = {
  'maryland_middle_branch': [39.2644, -76.6264], 'maryland_back_river': [39.25, -76.49],
  'maryland_gwynns_falls': [39.28, -76.68], 'maryland_bear_creek': [39.24, -76.5],
  'maryland_rock_creek_aa': [39.07, -76.63], 'virginia_elizabeth': [36.82, -76.29],
  'virginia_lynnhaven': [36.88, -76.08], 'virginia_james_lower': [37.52, -77.45],
  'virginia_rappahannock_tidal': [37.58, -76.7], 'virginia_back_bay': [36.65, -75.99],
  'pennsylvania_conestoga': [40.04, -76.3], 'pennsylvania_swatara': [40.34, -76.45],
  'pennsylvania_codorus': [39.96, -76.73], 'pennsylvania_pequea': [39.97, -76.25],
  'pennsylvania_susquehanna_lower': [40.03, -76.5], 'dc_anacostia': [38.88, -76.97],
  'dc_potomac_tidal': [38.87, -77.05], 'dc_rock_creek': [38.95, -77.05],
  'delaware_christina': [39.73, -75.57], 'delaware_broadkill': [38.8, -75.25],
  'westvirginia_kanawha': [38.35, -81.63], 'westvirginia_coal': [38.1, -81.8],
  'westvirginia_elk': [38.39, -80.85], 'westvirginia_monongahela': [39.63, -79.95],
  'westvirginia_potomac_south': [39.28, -78.76], 'florida_escambia': [30.41, -87.21],
  'florida_blackwater': [30.66, -86.95], 'florida_pensacola_bay': [30.38, -87.12],
  'florida_tampa_hillsborough': [27.94, -82.46], 'florida_caloosahatchee': [26.71, -81.87],
  'louisiana_pontchartrain': [30.1, -90.07], 'louisiana_barataria': [29.5, -90.0],
  'louisiana_calcasieu': [30.21, -93.25], 'louisiana_atchafalaya': [29.88, -91.3],
  'louisiana_vermilion': [29.74, -92.12], 'texas_galveston': [29.28, -94.88],
  'texas_houston_ship': [29.75, -95.07], 'texas_san_jacinto': [29.8, -95.08],
  'texas_trinity': [30.05, -94.75], 'texas_corpus_christi': [27.8, -97.39],
  'mississippi_back_biloxi': [30.4, -88.9], 'mississippi_pascagoula': [30.36, -88.56],
  'mississippi_pearl_lower': [30.31, -89.64], 'mississippi_ross_barnett': [32.43, -90.0],
  'mississippi_yazoo': [32.67, -90.44], 'alabama_mobile_river': [30.69, -88.04],
  'alabama_dog_river': [30.58, -88.1], 'alabama_fowl_river': [30.4, -88.14],
  'alabama_three_mile': [30.62, -88.06], 'alabama_cahaba': [33.13, -87.0],
  'northcarolina_neuse': [35.11, -77.04], 'northcarolina_cape_fear': [34.18, -77.95],
  'northcarolina_haw': [35.7, -79.18], 'northcarolina_tar_pamlico': [35.55, -77.58],
  'northcarolina_catawba': [35.4, -81.0], 'southcarolina_ashley': [32.77, -80.0],
  'southcarolina_waccamaw': [33.67, -79.05], 'southcarolina_congaree': [33.98, -81.05],
  'southcarolina_broad': [34.36, -81.5], 'southcarolina_catawba_sc': [34.85, -80.85],
  'georgia_savannah': [32.08, -81.09], 'georgia_ogeechee': [32.1, -81.28],
  'georgia_altamaha': [31.33, -81.49], 'georgia_chattahoochee_atlanta': [33.77, -84.42],
  'georgia_ocmulgee': [32.84, -83.63], 'newyork_gowanus': [40.67, -73.98],
  'newyork_newtown': [40.73, -73.94], 'newyork_flushing_bay': [40.77, -73.85],
  'newyork_jamaica_bay': [40.61, -73.84], 'newyork_onondaga': [43.06, -76.21],
  'newjersey_passaic': [40.74, -74.18], 'newjersey_hackensack': [40.88, -74.05],
  'newjersey_raritan': [40.51, -74.33], 'newjersey_barnegat': [39.78, -74.12],
  'newjersey_delaware_estuary': [39.83, -75.35], 'connecticut_harbor': [41.27, -72.91],
  'connecticut_quinnipiac': [41.35, -72.87], 'connecticut_housatonic': [41.18, -73.2],
  'connecticut_thames': [41.35, -72.09], 'connecticut_park': [41.17, -73.22],
  'massachusetts_charles': [42.36, -71.08], 'massachusetts_merrimack': [42.78, -71.09],
  'massachusetts_mystic': [42.39, -71.1], 'massachusetts_taunton': [41.9, -71.09],
  'massachusetts_buzzards': [41.58, -70.8], 'california_sf_bay': [37.6, -122.15],
  'california_la_river': [33.94, -118.24], 'california_santa_ana': [33.64, -117.87],
  'california_san_diego': [32.71, -117.24], 'california_sacramento': [38.56, -121.5],
  'oregon_tualatin': [45.39, -122.77], 'oregon_willamette': [45.46, -122.67],
  'oregon_johnson': [45.35, -122.62], 'oregon_klamath': [42.22, -121.77],
  'oregon_rogue': [42.43, -123.33], 'washington_duwamish': [47.54, -122.34],
  'washington_green_river': [47.32, -122.34], 'washington_puyallup': [47.2, -122.42],
  'washington_spokane': [47.66, -117.43], 'washington_yakima': [46.6, -120.51],
  'michigan_rouge': [42.27, -83.28], 'michigan_clinton': [42.61, -82.94],
  'michigan_kalamazoo': [42.3, -86.26], 'michigan_grand': [43.06, -86.24],
  'michigan_saginaw': [43.42, -83.95], 'ohio_cuyahoga': [41.49, -81.7],
  'ohio_great_miami': [39.75, -84.2], 'ohio_scioto': [39.96, -83.0],
  'ohio_maumee': [41.68, -83.52], 'ohio_mahoning': [41.08, -80.67],
  'indiana_white_river': [39.77, -86.17], 'indiana_wabash': [40.42, -86.89],
  'indiana_st_joseph': [41.67, -86.25], 'indiana_eagle_creek': [39.84, -86.27],
  'indiana_fall_creek': [39.81, -86.11], 'illinois_chicago_river': [41.89, -87.62],
  'illinois_des_plaines': [41.82, -87.85], 'illinois_fox': [41.85, -88.35],
  'illinois_sangamon': [39.76, -89.69], 'illinois_kaskaskia': [38.59, -89.9],
  'wisconsin_milwaukee': [43.03, -87.91], 'wisconsin_menomonee': [43.04, -88.03],
  'wisconsin_kinnickinnic': [43.0, -87.9], 'wisconsin_fox': [44.26, -88.4],
  'wisconsin_wisconsin_river': [43.44, -89.76], 'minnesota_minnesota': [44.74, -93.52],
  'minnesota_mississippi_twin': [44.95, -93.26], 'minnesota_st_louis': [46.75, -92.11],
  'minnesota_bassett_creek': [44.98, -93.3], 'minnesota_rum': [45.58, -93.56],
  'iowa_des_moines': [41.59, -93.62], 'iowa_cedar': [41.65, -91.53],
  'iowa_raccoon': [41.6, -94.05], 'iowa_floyd': [42.53, -92.34],
  'iowa_south_skunk': [41.45, -92.53], 'missouri_meramec': [38.51, -90.55],
  'missouri_grand': [39.11, -93.38], 'missouri_james': [37.21, -93.29],
  'missouri_osage': [38.64, -92.08], 'missouri_river_des_peres': [38.58, -90.33],
  'colorado_south_platte': [39.75, -104.99], 'colorado_cherry_creek': [39.65, -104.87],
  'colorado_clear_creek': [39.76, -105.02], 'colorado_bear_creek': [39.65, -105.13],
  'colorado_sand_creek': [39.79, -104.86], 'arizona_salt': [33.44, -111.94],
  'arizona_gila': [32.85, -112.72], 'arizona_santa_cruz': [32.22, -110.97],
  'arizona_verde': [34.56, -111.86], 'arizona_rillito': [32.27, -110.97],
  'nevada_truckee': [39.53, -119.81], 'nevada_las_vegas_wash': [36.09, -114.94],
  'nevada_carson': [39.16, -119.76], 'nevada_walker': [38.7, -118.73],
  'nevada_humboldt': [40.84, -117.82], 'utah_jordan': [40.76, -111.93],
  'utah_provo': [40.25, -111.65], 'utah_weber': [41.23, -111.98],
  'utah_ogden': [41.22, -111.97], 'utah_spanish_fork': [40.11, -111.65],
  'idaho_boise': [43.62, -116.24], 'idaho_snake': [42.58, -114.46],
  'idaho_coeur_dalene': [47.68, -116.78], 'idaho_portneuf': [42.86, -112.45],
  'idaho_clearwater': [46.42, -116.98], 'montana_clark_fork': [46.87, -113.99],
  'montana_yellowstone': [45.78, -108.5], 'montana_flathead': [48.06, -114.31],
  'montana_gallatin': [45.68, -111.05], 'montana_missouri_headwaters': [45.93, -111.51],
  'wyoming_north_platte': [42.83, -106.33], 'wyoming_bighorn': [44.79, -108.38],
  'wyoming_wind': [43.24, -109.67], 'wyoming_green': [41.77, -109.23],
  'wyoming_laramie': [41.31, -105.59], 'newmexico_rio_grande_abq': [35.08, -106.65],
  'newmexico_pecos': [34.45, -104.58], 'newmexico_san_juan': [36.77, -108.68],
  'newmexico_gila_nm': [33.06, -108.54], 'newmexico_canadian': [35.48, -105.0],
  'oklahoma_arkansas': [35.4, -94.62], 'oklahoma_cimarron': [36.11, -96.92],
  'oklahoma_illinois': [36.0, -94.8], 'oklahoma_north_canadian': [35.47, -97.52],
  'oklahoma_washita': [34.76, -97.94], 'kansas_missouri_kc': [39.12, -94.63],
  'kansas_arkansas_wichita': [37.69, -97.34], 'kansas_smoky_hill': [38.76, -99.32],
  'kansas_republican': [39.83, -97.61], 'kansas_verdigris': [37.17, -95.6],
  'nebraska_platte': [41.01, -96.47], 'nebraska_elkhorn': [41.32, -96.24],
  'nebraska_missouri_omaha': [41.26, -95.94], 'nebraska_big_blue': [40.35, -96.74],
  'nebraska_loup': [41.38, -98.27], 'southdakota_big_sioux': [43.55, -96.73],
  'southdakota_james': [43.72, -98.35], 'southdakota_cheyenne': [44.06, -101.35],
  'southdakota_white': [43.57, -100.75], 'southdakota_vermillion': [42.78, -97.04],
  'northdakota_red': [47.92, -97.06], 'northdakota_missouri_bismarck': [46.81, -100.78],
  'northdakota_sheyenne': [47.06, -97.51], 'northdakota_souris': [48.23, -101.3],
  'northdakota_heart': [46.81, -100.84], 'tennessee_wolf': [35.05, -89.98],
  'tennessee_stones': [36.16, -86.78], 'tennessee_harpeth': [35.98, -87.05],
  'tennessee_south_fork_holston': [36.54, -82.56], 'tennessee_cumberland': [36.17, -86.78],
  'kentucky_ohio_louisville': [38.26, -85.75], 'kentucky_beargrass': [38.25, -85.68],
  'kentucky_licking': [38.63, -84.6], 'kentucky_kentucky_river': [38.05, -84.5],
  'kentucky_green': [37.32, -86.88], 'arkansas_buffalo': [35.99, -92.74],
  'arkansas_illinois_ar': [36.12, -94.14], 'arkansas_ouachita': [34.47, -93.06],
  'arkansas_strawberry': [36.06, -91.54], 'arkansas_caddo': [34.18, -93.51],
  'maine_androscoggin': [44.1, -70.21], 'maine_kennebec': [44.31, -69.78],
  'maine_penobscot': [44.8, -68.77], 'maine_presumpscot': [43.7, -70.3],
  'maine_saco': [43.48, -70.45], 'newhampshire_merrimack': [43.21, -71.54],
  'newhampshire_piscataquog': [43.0, -71.64], 'newhampshire_suncook': [43.22, -71.44],
  'vermont_lake_champlain': [44.53, -73.28], 'vermont_winooski': [44.48, -72.81],
  'vermont_otter_creek': [43.86, -73.21], 'rhodeisland_narragansett': [41.57, -71.38],
  'rhodeisland_blackstone': [41.88, -71.38], 'rhodeisland_woonasquatucket': [41.84, -71.44],
  'hawaii_ala_wai': [21.28, -157.83], 'hawaii_manoa': [21.3, -157.8],
  'hawaii_pearl_harbor': [21.35, -157.95],
};

// State center fallback for waterbodies not in REGION_COORDS
const STATE_CENTERS: Record<string, [number, number]> = {
  AL: [32.8, -86.8], AK: [64.2, -152.5], AZ: [34.3, -111.7], AR: [34.8, -92.2],
  CA: [36.8, -119.4], CO: [39.1, -105.4], CT: [41.6, -72.7], DE: [39.0, -75.5],
  DC: [38.9, -77.0], FL: [28.6, -82.5], GA: [32.7, -83.5], HI: [21.3, -157.8],
  ID: [44.1, -114.7], IL: [40.0, -89.2], IN: [39.8, -86.3], IA: [42.0, -93.5],
  KS: [38.5, -98.3], KY: [37.8, -85.3], LA: [30.5, -91.9], ME: [45.3, -69.4],
  MD: [39.0, -76.6], MA: [42.2, -71.5], MI: [44.3, -85.6], MN: [46.3, -94.2],
  MS: [32.7, -89.7], MO: [38.5, -92.3], MT: [47.0, -110.0], NE: [41.5, -99.8],
  NV: [39.9, -116.4], NH: [43.5, -71.6], NJ: [40.3, -74.5], NM: [34.5, -106.0],
  NY: [42.8, -75.5], NC: [35.5, -79.4], ND: [47.5, -100.5], OH: [40.4, -82.8],
  OK: [35.5, -97.5], OR: [43.8, -120.6], PA: [40.9, -77.8], RI: [41.7, -71.5],
  SC: [34.0, -81.0], SD: [44.4, -100.2], TN: [35.7, -86.7], TX: [31.0, -97.5],
  UT: [39.3, -111.7], VT: [44.0, -72.7], VA: [37.4, -79.5], WA: [47.4, -120.7],
  WV: [38.6, -80.6], WI: [44.5, -89.5], WY: [43.0, -107.6],
};

function getRegionCoords(id: string, state: string): [number, number] {
  return REGION_COORDS[id] || STATE_CENTERS[state] || [39.0, -98.0];
}

const SEVERITY_SCORE: Record<AlertLevel, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

const DEPLOYMENT_START = new Date('2025-01-09'); // Milton FL pilot launch

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'hotspots', label: 'Water Quality Risk', description: 'Impairment severity from EPA 303(d) and state assessments', icon: Droplets },
  { id: 'ms4', label: 'MS4 Jurisdictions', description: 'Municipal Separate Storm Sewer System permit holders under NPDES stormwater permits', icon: Building2 },
  { id: 'ej', label: 'EJ Vulnerability', description: 'Census ACS demographics + EPA drinking water violations — community environmental burden', icon: Users },
  { id: 'economy', label: 'Economic Exposure', description: 'Waterfront property value at risk from water quality degradation (hedonic model)', icon: DollarSign },
  { id: 'wildlife', label: 'Ecological Sensitivity', description: 'USFWS ESA-listed threatened & endangered species density (aquatic-weighted)', icon: Leaf },
  { id: 'trend', label: 'Trends', description: 'Water quality change vs prior assessment period', icon: TrendingUp },
  { id: 'coverage', label: 'Monitoring Coverage', description: 'Real-time sensor coverage and monitoring network gaps', icon: BarChart3 },
  { id: 'indices', label: 'Watershed Indices', description: 'Composite HUC-8 risk score from PEARL, Infrastructure, Recovery, and Permit indices', icon: Gauge },
];

// ─── MS4 Jurisdiction Data (EPA NPDES universe, est. 2024) ──────────────────
// Phase I = large/medium cities (pop ≥100k), Phase II = small urbanized (pop ≥50k UA)
// Source: EPA NPDES permit program, state stormwater program data, Census UA designations
const MS4_JURISDICTIONS: Record<string, { phase1: number; phase2: number; notes?: string }> = {
  AL: { phase1: 6, phase2: 55, notes: 'Birmingham, Mobile, Huntsville metro areas' },
  AK: { phase1: 1, phase2: 8 },
  AZ: { phase1: 8, phase2: 45, notes: 'Phoenix-Mesa-Tucson metro complex' },
  AR: { phase1: 3, phase2: 30 },
  CA: { phase1: 120, phase2: 450, notes: 'Largest MS4 program nationally; LA, Bay Area, SD individual permits' },
  CO: { phase1: 8, phase2: 65, notes: 'Front Range corridor Denver-Colorado Springs' },
  CT: { phase1: 4, phase2: 120, notes: 'Dense municipal structure; EPA Region 1 general permit' },
  DE: { phase1: 2, phase2: 15 },
  DC: { phase1: 1, phase2: 0, notes: 'Single DC MS4 permit covers entire district' },
  FL: { phase1: 18, phase2: 180, notes: 'Extensive Phase II; coastal nutrient TMDLs driving compliance' },
  GA: { phase1: 10, phase2: 85, notes: 'Metro Atlanta Phase I cluster' },
  HI: { phase1: 2, phase2: 8 },
  ID: { phase1: 2, phase2: 15 },
  IL: { phase1: 12, phase2: 200, notes: 'Chicagoland + downstate urbanized areas' },
  IN: { phase1: 8, phase2: 100, notes: 'Rule 13 MS4 program; Indianapolis metro' },
  IA: { phase1: 3, phase2: 40 },
  KS: { phase1: 4, phase2: 35, notes: 'KC metro, Wichita' },
  KY: { phase1: 4, phase2: 45, notes: 'Louisville, Lexington Phase I' },
  LA: { phase1: 5, phase2: 35 },
  ME: { phase1: 1, phase2: 30, notes: 'EPA Region 1 general permit' },
  MD: { phase1: 10, phase2: 75, notes: 'County-based Phase I (AA, Baltimore Co, PG, Montgomery); aggressive nutrient TMDLs' },
  MA: { phase1: 4, phase2: 260, notes: 'Highest density Phase II nationally; Charles River/nutrient TMDLs' },
  MI: { phase1: 10, phase2: 130, notes: 'SE Michigan, Grand Rapids metro' },
  MN: { phase1: 5, phase2: 80, notes: 'Twin Cities metro + MS4/SDS program' },
  MS: { phase1: 3, phase2: 20 },
  MO: { phase1: 6, phase2: 55, notes: 'KC, St. Louis Phase I; Phase II expanding' },
  MT: { phase1: 1, phase2: 8 },
  NE: { phase1: 2, phase2: 25 },
  NV: { phase1: 4, phase2: 15, notes: 'Las Vegas metro dominates; Reno/Sparks' },
  NH: { phase1: 1, phase2: 40, notes: 'EPA Region 1 general permit' },
  NJ: { phase1: 15, phase2: 350, notes: 'Tier A MS4 — nearly every municipality; very high density' },
  NM: { phase1: 3, phase2: 15 },
  NY: { phase1: 20, phase2: 450, notes: 'NYC watershed + upstate Phase II; SPDES MS4 GP' },
  NC: { phase1: 10, phase2: 140, notes: 'Charlotte, Raleigh-Durham, Triad metros' },
  ND: { phase1: 1, phase2: 8 },
  OH: { phase1: 15, phase2: 200, notes: 'Major metro areas; OEPA Phase II general permit' },
  OK: { phase1: 4, phase2: 30, notes: 'OKC, Tulsa Phase I' },
  OR: { phase1: 5, phase2: 40, notes: 'Portland metro Phase I consortium' },
  PA: { phase1: 10, phase2: 250, notes: 'PAG-13 general permit; Philly + Pittsburgh Phase I; Chesapeake Bay TMDL pressure' },
  RI: { phase1: 2, phase2: 35, notes: 'EPA Region 1; Narragansett Bay TMDLs' },
  SC: { phase1: 5, phase2: 50, notes: 'Charleston, Greenville, Columbia metros' },
  SD: { phase1: 1, phase2: 10 },
  TN: { phase1: 6, phase2: 60, notes: 'Nashville, Memphis, Knoxville Phase I' },
  TX: { phase1: 25, phase2: 400, notes: 'Second largest MS4 program; TCEQ 4-level system' },
  UT: { phase1: 3, phase2: 40, notes: 'Wasatch Front urbanized area' },
  VT: { phase1: 1, phase2: 12 },
  VA: { phase1: 10, phase2: 100, notes: 'NoVA, Hampton Roads Phase I; Chesapeake Bay TMDL' },
  WA: { phase1: 8, phase2: 95, notes: 'Puget Sound Phase I consortium; Ecology MS4 permits' },
  WV: { phase1: 2, phase2: 20 },
  WI: { phase1: 5, phase2: 90, notes: 'Milwaukee metro + WDNR MS4 general permit' },
  WY: { phase1: 1, phase2: 6 },
};

// ─── Helper Functions ─────────────────────────────────────────────────────────

function scoreToBadgeVariant(score: number): 'default' | 'secondary' | 'destructive' {
  if (score >= 3) return 'destructive';
  if (score === 2) return 'default';
  return 'secondary';
}

function levelToIcon(level: AlertLevel) {
  if (level === 'high') return <AlertTriangle size={16} />;
  if (level === 'medium') return <AlertCircle size={16} />;
  if (level === 'low') return <AlertCircle size={16} />;
  return <CheckCircle size={16} />;
}

function levelToLabel(level: AlertLevel) {
  if (level === 'high') return 'Severe';
  if (level === 'medium') return 'Impaired';
  if (level === 'low') return 'Watch';
  return 'Healthy';
}

function generateRegionData(): RegionRow[] {
  const now = new Date();
  const iso = now.toISOString();

  // Legacy alert seeds — hand-verified waterbodies with known conditions
  const LEGACY_ALERTS: Record<string, { alertLevel: AlertLevel; activeAlerts: number }> = {
    // Maryland
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
    maryland_potomac:          { alertLevel: 'medium', activeAlerts: 2 },
    maryland_chester_river:    { alertLevel: 'medium', activeAlerts: 2 },
    maryland_choptank_river:   { alertLevel: 'medium', activeAlerts: 2 },
    maryland_patuxent_river:   { alertLevel: 'medium', activeAlerts: 2 },
    maryland_severn_river:     { alertLevel: 'medium', activeAlerts: 2 },
    maryland_nanticoke_river:  { alertLevel: 'low',    activeAlerts: 1 },
    // Virginia
    virginia_elizabeth:        { alertLevel: 'high',   activeAlerts: 6 },
    virginia_james_lower:      { alertLevel: 'high',   activeAlerts: 4 },
    virginia_rappahannock:     { alertLevel: 'medium', activeAlerts: 3 },
    virginia_york:             { alertLevel: 'medium', activeAlerts: 2 },
    virginia_lynnhaven:        { alertLevel: 'high',   activeAlerts: 4 },
    // DC
    dc_anacostia:              { alertLevel: 'high',   activeAlerts: 6 },
    dc_rock_creek:             { alertLevel: 'high',   activeAlerts: 4 },
    dc_potomac:                { alertLevel: 'medium', activeAlerts: 3 },
    dc_oxon_run:               { alertLevel: 'medium', activeAlerts: 3 },
    dc_watts_branch:           { alertLevel: 'medium', activeAlerts: 2 },
    // Pennsylvania
    pennsylvania_conestoga:    { alertLevel: 'high',   activeAlerts: 5 },
    pennsylvania_swatara:      { alertLevel: 'high',   activeAlerts: 4 },
    pennsylvania_codorus:      { alertLevel: 'medium', activeAlerts: 3 },
    pennsylvania_susquehanna:  { alertLevel: 'medium', activeAlerts: 2 },
    // Delaware
    delaware_christina:        { alertLevel: 'high',   activeAlerts: 4 },
    delaware_brandywine:       { alertLevel: 'medium', activeAlerts: 3 },
    // Florida — ALIA pilot
    florida_escambia:          { alertLevel: 'high',   activeAlerts: 4 },
    florida_tampa_bay:         { alertLevel: 'high',   activeAlerts: 5 },
    florida_charlotte_harbor:  { alertLevel: 'high',   activeAlerts: 4 },
    florida_pensacola_bay:     { alertLevel: 'medium', activeAlerts: 2 },
    // West Virginia
    westvirginia_shenandoah:   { alertLevel: 'high',   activeAlerts: 5 },
    westvirginia_opequon:      { alertLevel: 'high',   activeAlerts: 4 },
    westvirginia_potomac_sb:   { alertLevel: 'medium', activeAlerts: 3 },
  };

  // Convert stateCode (US:24) → abbreviation (MD) using FIPS
  function stateCodeToAbbr(stateCode: string): string {
    const fips = stateCode.replace('US:', '');
    return FIPS_TO_ABBR[fips] || fips;
  }

  // Build from registry — every entry has confirmed data
  const rows: RegionRow[] = [];
  const seen = new Set<string>();

  for (const [id, meta] of Object.entries(REGION_META)) {
    if (seen.has(id)) continue;
    seen.add(id);

    const legacy = LEGACY_ALERTS[id];
    const abbr = stateCodeToAbbr(meta.stateCode);
    const sources = getWaterbodyDataSources(id);
    const hasLegacyAssessment = !!legacy;

    rows.push({
      id,
      name: meta.name,
      state: abbr,
      alertLevel: legacy?.alertLevel ?? 'none',
      activeAlerts: legacy?.activeAlerts ?? 0,
      lastUpdatedISO: iso,
      status: hasLegacyAssessment ? 'assessed' : sources.length > 0 ? 'monitored' : 'unmonitored',
      dataSourceCount: sources.length,
    });
  }

  return rows;
}


// ─── Animated Counter Hook ───────────────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const step = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration]);
  return value;
}

// ─── Live Tick Hook (increments a value over time) ──────────────────────────

function useLiveTick(baseValue: number, ratePerSecond: number) {
  const [value, setValue] = useState(baseValue);
  useEffect(() => {
    setValue(baseValue);
    const interval = setInterval(() => {
      setValue(v => v + ratePerSecond);
    }, 1000);
    return () => clearInterval(interval);
  }, [baseValue, ratePerSecond]);
  return value;
}

// ─── State Fill Color (pure function for Leaflet GeoJSON style callback) ─────

function getStateFill(
  abbr: string | undefined,
  overlay: OverlayId,
  overlayByState: Map<string, { ej: number; economy: number; wildlife: number; trend: number; coverage: number; ms4Total: number; indices: number }>,
  stateRollup: Array<{ abbr: string; canGradeState: boolean; score: number; assessed: number; monitored: number; waterbodies: number }>,
  showImpact: boolean,
): string {
  if (!abbr) return '#e5e7eb';

  const o = overlayByState.get(abbr);
  const hasPEARLDeployment = abbr === 'MD' || abbr === 'FL';

  if (overlay === 'hotspots') {
    const stateRow = stateRollup.find(s => s.abbr === abbr);
    const gradeScore = stateRow?.canGradeState ? stateRow.score : -1;
    const adjustedScore = (showImpact && hasPEARLDeployment && gradeScore >= 0) ? Math.min(100, gradeScore + 20) : gradeScore;
    if (gradeScore < 0) return '#e5e7eb';
    if (adjustedScore >= 90) return '#22c55e';
    if (adjustedScore >= 80) return '#86efac';
    if (adjustedScore >= 70) return '#fde68a';
    if (adjustedScore >= 60) return '#f59e0b';
    return '#ef4444';
  }

  if (overlay === 'ms4') {
    const total = o?.ms4Total ?? 0;
    if (total >= 300) return '#7c2d12';
    if (total >= 150) return '#c2410c';
    if (total >= 75) return '#ea580c';
    if (total >= 30) return '#fb923c';
    if (total >= 10) return '#fed7aa';
    if (total > 0) return '#fff7ed';
    return '#e5e7eb';
  }

  if (overlay === 'ej') {
    const v = o?.ej ?? 0;
    return v >= 80 ? '#7f1d1d' : v >= 60 ? '#dc2626' : v >= 40 ? '#f59e0b' : v >= 20 ? '#fde68a' : '#e5e7eb';
  }

  if (overlay === 'economy') {
    const v = o?.economy ?? 0;
    return v >= 70 ? '#7f1d1d' : v >= 50 ? '#dc2626' : v >= 35 ? '#f59e0b' : v >= 20 ? '#fde68a' : '#d1fae5';
  }

  if (overlay === 'wildlife') {
    const v = o?.wildlife ?? 0;
    return v >= 80 ? '#064e3b' : v >= 60 ? '#059669' : v >= 40 ? '#10b981' : v >= 20 ? '#6ee7b7' : '#e5e7eb';
  }

  if (overlay === 'trend') {
    const v = o?.trend ?? 0;
    return v >= 20 ? '#16a34a' : v >= 5 ? '#86efac' : v <= -20 ? '#dc2626' : v <= -5 ? '#fecaca' : '#e5e7eb';
  }

  if (overlay === 'coverage') {
    const stateRow = stateRollup.find(s => s.abbr === abbr);
    if (!stateRow || stateRow.waterbodies === 0) return '#e5e7eb';
    const covPct = Math.round(((stateRow.assessed + stateRow.monitored) / stateRow.waterbodies) * 100);
    if (covPct >= 80) return '#166534';
    if (covPct >= 60) return '#16a34a';
    if (covPct >= 40) return '#fbbf24';
    if (covPct >= 20) return '#f59e0b';
    return '#d1d5db';
  }

  if (overlay === 'indices') {
    const v = o?.indices ?? -1;
    if (v < 0) return '#e5e7eb';
    if (v >= 67) return '#dc2626';  // red — high risk
    if (v >= 50) return '#f59e0b';  // amber
    if (v >= 34) return '#fbbf24';  // yellow
    return '#22c55e';               // green — low risk
  }

  return '#e5e7eb';
}

// ─── (MapController removed — Mapbox uses onMapRef callback) ─────────────────

// ─── Main Component ───────────────────────────────────────────────────────────

export function FederalManagementCenter(props: Props) {
  const { onClose, onSelectRegion, federalMode = false } = props;
  const { logout, user } = useAuth();
  const router = useRouter();

  // ── View Lens: controls layout composition ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>(federalMode ? 'overview' : 'overview');
  const lens = LENS_CONFIG[viewLens];

  // ── ATTAINS Bulk State Assessment Data ──
  // Keyed by state abbreviation → array of matched waterbody assessments
  const [attainsBulk, setAttainsBulk] = useState<Record<string, Array<{
    name: string; category: string; alertLevel: AlertLevel; causes: string[]; cycle: string;
    waterType?: string;
  }>>>({});
  const [attainsBulkLoading, setAttainsBulkLoading] = useState<Set<string>>(new Set());
  const [attainsBulkLoaded, setAttainsBulkLoaded] = useState<Set<string>>(new Set());

  // Base region data from registry + legacy seeds (static)
  const baseRegionData = useMemo(() => generateRegionData(), []);

  // Normalized name index for fuzzy matching ATTAINS → registry
  const nameIndex = useMemo(() => {
    const idx = new Map<string, string[]>(); // normalized → regionId[]
    for (const r of baseRegionData) {
      // Multiple normalized variants for matching
      const variants = [
        r.name.toLowerCase().trim(),
        r.name.toLowerCase().replace(/,.*$/, '').trim(), // strip after comma
        r.id.replace(/^[a-z]+_/, '').replace(/_/g, ' '), // strip state prefix, underscores to spaces
      ];
      for (const v of variants) {
        if (!idx.has(v)) idx.set(v, []);
        idx.get(v)!.push(r.id);
      }
    }
    return idx;
  }, [baseRegionData]);

  // Build a lookup of regionId → state abbreviation for fast filtering
  const regionStateMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of baseRegionData) map.set(r.id, r.state);
    return map;
  }, [baseRegionData]);

  // Match an ATTAINS waterbody name to registry IDs
  function matchAttainsToRegistry(attainsName: string, stateAbbr: string): string[] {
    const norm = attainsName.toLowerCase().trim();
    if (!norm) return [];
    // Direct match — filter by state abbreviation using regionStateMap (not ID prefix)
    if (nameIndex.has(norm)) {
      return nameIndex.get(norm)!.filter(id => regionStateMap.get(id) === stateAbbr);
    }
    // Strip common suffixes and retry
    const stripped = norm.replace(/ (river|creek|bay|harbor|inlet|lake|pond|branch|run|falls|fork|stream|reservoir)\b/g, '').trim();
    if (stripped && nameIndex.has(stripped)) {
      return nameIndex.get(stripped)!.filter(id => regionStateMap.get(id) === stateAbbr);
    }
    // Partial match: check if ATTAINS name is contained in any registry name for this state
    const matches: string[] = [];
    for (const r of baseRegionData) {
      if (r.state !== stateAbbr) continue;
      const rNorm = r.name.toLowerCase();
      const rBase = rNorm.replace(/,.*$/, '').trim();
      if (rNorm.includes(norm) || norm.includes(rBase)) {
        matches.push(r.id);
      }
    }
    return matches;
  }

  // Merge base data with ATTAINS bulk assessments → reactive regionData
  // Two-phase: (1) upgrade existing registry entries, (2) ADD new ATTAINS-only waterbodies
  const regionData = useMemo(() => {
    if (Object.keys(attainsBulk).length === 0) return baseRegionData;

    try {
    const SEVERITY: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
    const stateKeys = Object.keys(attainsBulk);
    const totalEntries = Object.values(attainsBulk).reduce((s, a) => s + a.length, 0);
    console.log(`[ATTAINS Merge] Starting merge: ${stateKeys.length} states, ${totalEntries} total ATTAINS entries, ${baseRegionData.length} base regions`);

    // Phase 1: Build lookup for registry matches (same as before)
    const attainsLookup = new Map<string, { alertLevel: AlertLevel; category: string; causes: string[]; cycle: string }>();
    const matchedAttainsNames = new Set<string>(); // track which ATTAINS entries matched

    for (const [stateAbbr, assessments] of Object.entries(attainsBulk)) {
      for (const a of assessments) {
        const matchedIds = matchAttainsToRegistry(a.name, stateAbbr);
        if (matchedIds.length > 0) {
          matchedAttainsNames.add(`${stateAbbr}:${a.name}`);
          for (const id of matchedIds) {
            const existing = attainsLookup.get(id);
            if (!existing || (SEVERITY[a.alertLevel] ?? 0) > (SEVERITY[existing.alertLevel] ?? 0)) {
              attainsLookup.set(id, { alertLevel: a.alertLevel as AlertLevel, category: a.category, causes: a.causes, cycle: a.cycle });
            }
          }
        }
      }
    }

    // Phase 1b: Merge registry entries with ATTAINS upgrades
    const merged = baseRegionData.map(r => {
      const attains = attainsLookup.get(r.id);
      if (!attains) return r;
      if (r.status === 'assessed') return r; // Legacy seed — keep
      return {
        ...r,
        status: 'assessed' as const,
        alertLevel: attains.alertLevel,
        activeAlerts: (SEVERITY[attains.alertLevel] ?? 0) > 0 ? attains.causes.length || 1 : 0,
      };
    });

    // Phase 2: ADD unmatched ATTAINS waterbodies as new RegionRow entries
    // Cap per state to prevent memory issues — prioritize impaired waterbodies
    const MAX_NEW_PER_STATE = 1500;
    const existingIdsByState = new Map<string, Set<string>>();
    for (const r of merged) {
      const set = existingIdsByState.get(r.state) ?? new Set();
      set.add(r.id);
      existingIdsByState.set(r.state, set);
    }

    const newRows: RegionRow[] = [];
    let totalAdded = 0;

    for (const [stateAbbr, assessments] of Object.entries(attainsBulk)) {
      // Debug: check data quality
      const withName = assessments.filter(a => a.name && a.name.trim().length > 0);
      const withoutName = assessments.length - withName.length;
      if (withoutName > 0) {
        console.log(`[ATTAINS Merge] ${stateAbbr}: ${withoutName}/${assessments.length} entries have empty names`);
      }

      // Filter to unmatched only, sort impaired first
      const unmatched = assessments
        .filter(a => {
          const name = (a.name || '').trim();
          if (name.length === 0) return false;
          return !matchedAttainsNames.has(`${stateAbbr}:${a.name}`);
        })
        .sort((a, b) => (SEVERITY[b.alertLevel] ?? 0) - (SEVERITY[a.alertLevel] ?? 0));

      let added = 0;
      const seenNames = new Set<string>();
      for (const a of unmatched) {
        if (added >= MAX_NEW_PER_STATE) break;
        // Deduplicate by name within state
        const normName = (a.name || '').trim().toLowerCase();
        if (!normName || seenNames.has(normName)) continue;
        seenNames.add(normName);

        const syntheticId = `attains-${stateAbbr}-${normName.replace(/[^a-z0-9]/g, '-').slice(0, 60)}`;
        // Skip if somehow collides with existing
        if (existingIdsByState.get(stateAbbr)?.has(syntheticId)) continue;

        newRows.push({
          id: syntheticId,
          name: a.name.trim(),
          state: stateAbbr,
          alertLevel: a.alertLevel as AlertLevel,
          activeAlerts: (SEVERITY[a.alertLevel] ?? 0) > 0 ? a.causes.length || 1 : 0,
          lastUpdatedISO: new Date().toISOString(),
          status: 'assessed',
          dataSourceCount: 1, // EPA ATTAINS
        });
        added++;
      }
      if (added > 0 || assessments.length > 0) {
        console.log(`[ATTAINS Merge] ${stateAbbr}: ${added} new waterbodies added (${assessments.length} total ATTAINS, ${unmatched.length} unmatched, ${matchedAttainsNames.size} matched globally)`);
      }
      totalAdded += added;
    }

    console.log(`[ATTAINS Merge] Phase 2 complete: ${totalAdded} new waterbodies across ${Object.keys(attainsBulk).length} states. Total regionData: ${merged.length + newRows.length}`);

    return [...merged, ...newRows];
    } catch (err) {
      console.error('[ATTAINS Merge] ERROR in merge — falling back to baseRegionData:', err);
      return baseRegionData;
    }
  }, [baseRegionData, attainsBulk]);

  // ── ATTAINS National Cache Loader ──
  // Reads from server cache if available. Does NOT trigger a build.
  // To build cache: run `npx ts-node scripts/build-attains-cache.ts` in a separate terminal
  // Or hit: /api/water-data?action=attains-build (one-time trigger)
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    async function loadFromCache() {
      try {
        // Use status endpoint first (lightweight, no build trigger)
        const statusRes = await fetch('/api/water-data?action=attains-national-status');
        if (!statusRes.ok) return;
        const { status: cacheStatus, loadedStates: loadedCount } = await statusRes.json();

        // If cache has no data yet, just wait — don't trigger a build from the browser
        if (loadedCount === 0) {
          console.log('[ATTAINS] No cache data yet. Run build script or hit /api/water-data?action=attains-build');
          if (!cancelled) pollTimer = setTimeout(loadFromCache, 30_000);
          return;
        }

        // Cache has data — fetch it
        console.log(`[ATTAINS] Cache ${cacheStatus}, ${loadedCount} states — fetching...`);
        const r = await fetch('/api/water-data?action=attains-national-cache');
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        const { states } = json;

        if (states && Object.keys(states).length > 0) {
          const bulk: Record<string, Array<{ name: string; category: string; alertLevel: AlertLevel; causes: string[]; cycle: string }>> = {};
          const loaded = new Set<string>();

          for (const [st, summary] of Object.entries(states) as [string, any][]) {
            const waterbodies = (summary.waterbodies || []).map((wb: any) => ({
              id: wb.id || '',
              name: wb.name || wb.id || '',
              category: wb.category || '',
              alertLevel: (wb.alertLevel || 'none') as AlertLevel,
              causes: wb.causes || [],
              cycle: '',
              waterType: wb.waterType || undefined,
            }));
            if (waterbodies.length > 0) {
              bulk[st] = waterbodies;
              loaded.add(st);
            }
          }

          if (!cancelled) {
            setAttainsBulk(bulk);
            setAttainsBulkLoaded(loaded);
            const allStates = [...new Set(baseRegionData.map(r => r.state))];
            setAttainsBulkLoading(new Set(allStates.filter(s => !loaded.has(s))));
            console.log(`[ATTAINS] Loaded ${loaded.size} states into UI`);
          }
        }

        // Keep polling if cache is still building
        if (!cancelled && (cacheStatus === 'building' || cacheStatus === 'cold')) {
          pollTimer = setTimeout(loadFromCache, 15_000);
        } else if (!cancelled) {
          setAttainsBulkLoading(new Set());
        }
      } catch (e: any) {
        console.warn('[ATTAINS] Cache fetch failed:', e.message);
        if (!cancelled) pollTimer = setTimeout(loadFromCache, 30_000);
      }
    }

    // Delay initial check so page renders first
    pollTimer = setTimeout(loadFromCache, 3_000);
    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { isDark } = useTheme();

  // ── Sentinel Alert System ──
  const sentinel = useSentinelAlerts();
  const sentinelHealth = useSentinelHealth();
  const amsSummary = useAlertSummary();
  const { audioEnabled, toggleAudio, playChime } = useSentinelAudio({ userRole: user?.role });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selectedAlertHuc, setSelectedAlertHuc] = useState<string | null>(null);
  const [selectedAlertLevel, setSelectedAlertLevel] = useState<string>('CRITICAL');

  // Play chime when new CRITICAL HUCs appear
  useEffect(() => {
    if (sentinel.newCriticalHucs.length > 0) playChime();
  }, [sentinel.newCriticalHucs, playChime]);

  const hucNames = hucNamesData as Record<string, string>;
  const centroids = centroidsData as Record<string, { lat: number; lng: number }>;

  const [adminState] = useAdminState();
  const [selectedState, setSelectedState] = useState<string>(adminState);
  // Sync from sidebar admin state selector
  useEffect(() => { setSelectedState(adminState); }, [adminState]);

  const [waterbodySearch, setWaterbodySearch] = useState<string>('');
  const [waterbodyFilter, setWaterbodyFilter] = useState<'all' | 'impaired' | 'severe' | 'monitored'>('all');
  const [overlay, setOverlay] = useState<OverlayId>(lens.defaultOverlay);
  const mapRef = useRef<MapRef | null>(null);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'custom'>('24h');
  const [showImpact, setShowImpact] = useState(false);
  const [alertWorkflow, setAlertWorkflow] = useState<Record<string, { status: 'new' | 'acknowledged' | 'assigned' | 'resolved'; owner?: string; }>>({});
  
  // HUC-8 indices for overlay + detail card
  const [hucIndicesByState, setHucIndicesByState] = useState<Record<string, { composite: number }[]>>({});
  const [selectedHucIndices, setSelectedHucIndices] = useState<any>(null);

  // Fetch indices for selected HUC (for WaterbodyDetailCard pass-through)
  useEffect(() => {
    if (!selectedAlertHuc) { setSelectedHucIndices(null); return; }
    fetch(`/api/indices?huc8=${selectedAlertHuc}`)
      .then(r => r.json())
      .then(data => { setSelectedHucIndices(data?.hucIndices?.[0] ?? null); })
      .catch(() => setSelectedHucIndices(null));
  }, [selectedAlertHuc]);

  // Fetch indices for overlay when overlay = 'indices' and state changes
  useEffect(() => {
    if (overlay !== 'indices') return;
    // Fetch for all states to color the map
    fetch('/api/indices')
      .then(r => r.json())
      .then(data => {
        if (!data?.hucIndices) return;
        const byState: Record<string, { composite: number }[]> = {};
        for (const h of data.hucIndices) {
          if (!byState[h.stateAbbr]) byState[h.stateAbbr] = [];
          byState[h.stateAbbr].push({ composite: h.composite });
        }
        setHucIndicesByState(byState);
      })
      .catch(() => {});
  }, [overlay]);

  // Inline detail panel — works for ALL roles
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);

  // Fetch real water quality data for the active waterbody
  const { waterData: rawWaterData, isLoading: waterLoading, hasRealData, primarySource } = useWaterData(activeDetailId);
  const waterData = useTierFilter(rawWaterData, 'Federal');

  // ── ATTAINS: Real 303(d) data per waterbody ──
  const [attainsCache, setAttainsCache] = useState<Record<string, {
    category: string; causes: string[]; causeCount: number; status: string; cycle: string; loading: boolean;
  }>>({});

  // ── EJScreen: Real EJ index per waterbody ──
  const [ejCache, setEjCache] = useState<Record<string, {
    ejIndex: number | null; loading: boolean; error?: string;
  }>>({});

  // ── ATTAINS state summaries (replaces mock overlay scores) ──
  const [stateSummaryCache, setStateSummaryCache] = useState<Record<string, {
    totalAssessed: number; totalImpaired: number; impairedPct: number; loading: boolean;
  }>>({});

  // Fetch ATTAINS when detail panel opens
  useEffect(() => {
    if (!activeDetailId) return;
    const nccRegion = regionData.find(r => r.id === activeDetailId);
    if (!nccRegion) return;

    // Skip if already cached
    if (attainsCache[activeDetailId] && !attainsCache[activeDetailId].loading) return;

    // Mark loading
    setAttainsCache(prev => ({ ...prev, [activeDetailId]: { category: '', causes: [], causeCount: 0, status: '', cycle: '', loading: true } }));

    // Build search name variants (ATTAINS uses specific assessment unit names that may differ)
    const baseName = nccRegion.name.split(',')[0].split('/')[0].split('–')[0].trim();
    // Try multiple name variants: full name, then shorter keywords
    const nameVariants = [
      baseName,
      baseName.split(' ').slice(0, 2).join(' '), // First two words: "San Francisco", "Los Angeles"
    ].filter(n => n.length > 2);

    const tryFetch = async (nameIdx: number): Promise<void> => {
      if (nameIdx >= nameVariants.length) {
        // All variants exhausted — try state impaired list as last resort
        try {
          const r = await fetch(`/api/water-data?action=attains-impaired&statecode=${nccRegion.state}&limit=20`);
          const json = await r.json();
          const waterbodies = json?.waterbodies || [];
          // Fuzzy match: find waterbody whose name contains our base name
          const match = waterbodies.find((wb: any) =>
            wb.name?.toLowerCase().includes(baseName.toLowerCase().split(' ')[0])
          );
          if (match) {
            setAttainsCache(prev => ({
              ...prev,
              [activeDetailId]: {
                category: match.category || '', causes: match.causes || [],
                causeCount: match.causeCount || 0, status: match.status || '',
                cycle: match.cycle || '', loading: false,
              }
            }));
          } else {
            setAttainsCache(prev => ({
              ...prev,
              [activeDetailId]: { category: 'No ATTAINS match', causes: [], causeCount: 0, status: '', cycle: '', loading: false }
            }));
          }
        } catch {
          setAttainsCache(prev => ({
            ...prev,
            [activeDetailId]: { category: 'API error', causes: [], causeCount: 0, status: '', cycle: '', loading: false }
          }));
        }
        return;
      }

      try {
        const searchName = nameVariants[nameIdx];
        const r = await fetch(`/api/water-data?action=attains-assessments&statecode=${nccRegion.state}&assessmentUnitName=${encodeURIComponent(searchName)}&limit=5`);
        const json = await r.json();
        const items = json?.data?.items || [];
        if (items.length > 0) {
          const best = items[0];

          // Extract causes from ALL paths — ATTAINS responses vary
          const causesSet = new Set<string>();

          // Path 1: parameters[].parameterName (most common — matches bulk parser)
          for (const p of (best?.parameters || [])) {
            const pName = (p?.parameterName || '').trim();
            if (pName && pName !== 'CAUSE UNKNOWN' && pName !== 'CAUSE UNKNOWN - IMPAIRED BIOTA') {
              causesSet.add(pName);
            }
            // Also check nested associatedCauses within each parameter
            for (const c of (p?.associatedCauses || [])) {
              if (c?.causeName) causesSet.add(c.causeName.trim());
            }
          }

          // Path 2: useAttainments[].threatenedActivities/impairedActivities[].associatedCauses
          if (causesSet.size === 0) {
            for (const u of (best?.useAttainments || [])) {
              for (const a of (u?.threatenedActivities || []).concat(u?.impairedActivities || [])) {
                for (const c of (a?.associatedCauses || [])) {
                  if (c?.causeName) causesSet.add(c.causeName.trim());
                }
              }
            }
          }

          // Path 3: probableSources (bonus context, not causes, but useful metadata)
          // Not adding to causes — just noting it's available

          const uniqueCauses = [...causesSet];
          setAttainsCache(prev => ({
            ...prev,
            [activeDetailId]: {
              category: best?.epaIRCategory || '',
              causes: uniqueCauses, causeCount: uniqueCauses.length,
              status: best?.overallStatus || '',
              cycle: best?.reportingCycle || '', loading: false,
            }
          }));
        } else {
          // Try next variant
          await tryFetch(nameIdx + 1);
        }
      } catch {
        // Try next variant on error too
        await tryFetch(nameIdx + 1);
      }
    };

    tryFetch(0);
  }, [activeDetailId, regionData]);

  // Fetch EJScreen when detail panel opens
  useEffect(() => {
    if (!activeDetailId) return;
    const nccRegion = regionData.find(r => r.id === activeDetailId);
    if (!nccRegion) return;

    if (ejCache[activeDetailId] && !ejCache[activeDetailId].loading) return;

    const coords = getRegionCoords(activeDetailId, nccRegion.state);
    setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: true } }));

    fetch(`/api/water-data?action=ejscreen&lat=${coords[0]}&lng=${coords[1]}`)
      .then(r => r.json())
      .then(json => {
        // EJScreen returns various indicators — extract the EJ index
        const data = json?.data;
        let ejIndex: number | null = null;
        if (data && !data.error) {
          // The REST broker returns demographic + environmental indicators
          // Try to find the EJ index percentage
          const raw = data?.RAW_E_PM25 || data?.RAW_EJ_SCORE || data?.P_LDPNT_D2 || null;
          // Fallback: use the overall percentile if available
          ejIndex = typeof raw === 'number' ? Math.round(raw) : null;
          // If we got block-group level data, try the supplemental index
          if (ejIndex === null && data?.S_P_LDPNT_D2) {
            ejIndex = Math.round(data.S_P_LDPNT_D2);
          }
        }
        setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex, loading: false } }));
      })
      .catch(() => {
        setEjCache(prev => ({ ...prev, [activeDetailId]: { ejIndex: null, loading: false, error: 'unavailable' } }));
      });
  }, [activeDetailId, regionData]);

  // Handle region click — Federal stays in NCC with detail panel, others navigate out
  const handleRegionClick = (regionId: string) => {
    // Always show inline detail panel — works for all roles
    setActiveDetailId(regionId);
  };
  
  // Feature 7: Program/Jurisdiction Filters
  const [watershedFilter, setWatershedFilter] = useState<string>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [comingSoonId, setComingSoonId] = useState<string | null>(null);
  
  // Feature 10: Public vs Private Toggle
  
  // Feature 11: SLA Tracking
  const [showSLAMetrics, setShowSLAMetrics] = useState(false);

  // Watershed classification for filtering
  const WATERSHED_MAP: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of regionData) {
      const prefix = r.id.split('_')[0];
      // Chesapeake Bay watershed states
      if (['maryland', 'virginia', 'pennsylvania', 'delaware', 'dc', 'newyork', 'westvirginia'].includes(prefix) || r.id.includes('chesapeake')) {
        map[r.id] = 'chesapeake';
      }
      // Gulf of Mexico
      else if (['florida', 'texas', 'louisiana', 'mississippi', 'alabama'].includes(prefix)) {
        map[r.id] = 'gulf';
      }
      // Great Lakes
      else if (['michigan', 'wisconsin', 'illinois', 'indiana', 'ohio', 'minnesota'].includes(prefix)) {
        map[r.id] = 'great_lakes';
      }
      // Pacific Coast
      else if (['california', 'oregon', 'washington', 'alaska', 'hawaii'].includes(prefix)) {
        map[r.id] = 'pacific';
      }
      // South Atlantic
      else if (['northcarolina', 'southcarolina', 'georgia'].includes(prefix)) {
        map[r.id] = 'south_atlantic';
      }
      // Everything else
      else {
        map[r.id] = 'other';
      }
    }
    return map;
  }, [regionData]);

  // Apply watershed filter
  const filteredRegionData = useMemo(() => {
    if (watershedFilter === 'all') return regionData;
    return regionData.filter(r => WATERSHED_MAP[r.id] === watershedFilter);
  }, [regionData, watershedFilter, WATERSHED_MAP]);

  const derived = useMemo(() => {
    const regionsByState = new Map<string, RegionRow[]>();
    const severityByState = new Map<string, number>();
    const activeAlertsByState = new Map<string, number>();

    for (const r of filteredRegionData) {
      const abbr = r.state;
      if (!abbr) continue;

      const list = regionsByState.get(abbr) ?? [];
      list.push(r);
      regionsByState.set(abbr, list);

      const score = SEVERITY_SCORE[(r.alertLevel || 'none').toLowerCase() as AlertLevel] ?? 0;
      const prevScore = severityByState.get(abbr) ?? 0;
      if (score > prevScore) severityByState.set(abbr, score);

      const prevAlerts = activeAlertsByState.get(abbr) ?? 0;
      activeAlertsByState.set(abbr, prevAlerts + (Number.isFinite(r.activeAlerts) ? r.activeAlerts : 0));
    }

    for (const [abbr, list] of regionsByState.entries()) {
      list.sort((a, b) => {
        const sa = SEVERITY_SCORE[a.alertLevel] ?? 0;
        const sb = SEVERITY_SCORE[b.alertLevel] ?? 0;
        if (sb !== sa) return sb - sa;
        return (b.activeAlerts ?? 0) - (a.activeAlerts ?? 0);
      });
      regionsByState.set(abbr, list);
    }

    return { regionsByState, severityByState, activeAlertsByState };
  }, [filteredRegionData]);

  // Generate stable overlay scores per state
  const overlayByState = useMemo(() => {
    const states = Array.from(derived.regionsByState.keys());

    const stableHash01 = (s: string) => {
      let h = 2166136261;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0) / 4294967295;
    };

    const pick01 = (abbr: string, salt: string) => stableHash01(abbr + '|' + salt);

    const result = new Map<string, { ej: number; economy: number; wildlife: number; trend: number; coverage: number; ms4Total: number; ms4Phase1: number; ms4Phase2: number; indices: number }>();

    for (const abbr of states) {
      const ej = getEJScore(abbr); // Census ACS + EPA SDWIS — real EJ vulnerability data
      const economy = getExposureScore(abbr);
      const wildlife = getEcoScore(abbr); // USFWS ECOS — real T&E species data
      const coverage = Math.round(pick01(abbr, 'coverage') * 100);

      const t01 = pick01(abbr, 'trend');
      const trend = Math.round((t01 * 100 - 50) * 10) / 10;

      const ms4 = MS4_JURISDICTIONS[abbr];
      const ms4Phase1 = ms4?.phase1 ?? 0;
      const ms4Phase2 = ms4?.phase2 ?? 0;
      const ms4Total = ms4Phase1 + ms4Phase2;

      // Indices: average composite from HUC-8 data if available
      const stateHucs = hucIndicesByState[abbr];
      const indices = stateHucs && stateHucs.length > 0
        ? Math.round(stateHucs.reduce((s, h) => s + h.composite, 0) / stateHucs.length)
        : -1;

      result.set(abbr, { ej, economy, wildlife, trend, coverage, ms4Total, ms4Phase1, ms4Phase2, indices });
    }

    return result;
  }, [derived.regionsByState, hucIndicesByState]);

  const selectedStateRegions = derived.regionsByState.get(selectedState) ?? [];
  const selectedStateTopRegion = selectedStateRegions[0]?.id;

  // Filter and sort waterbodies: alerts first, then alphabetical, with search
  const filteredStateRegions = useMemo(() => {
    let regions = [...selectedStateRegions];
    // Apply category filter
    if (waterbodyFilter === 'impaired') {
      regions = regions.filter(r => r.status === 'assessed' && (r.alertLevel === 'high' || r.alertLevel === 'medium'));
    } else if (waterbodyFilter === 'severe') {
      regions = regions.filter(r => r.status === 'assessed' && r.alertLevel === 'high');
    } else if (waterbodyFilter === 'monitored') {
      regions = regions.filter(r => r.status === 'monitored');
    }
    // Apply search filter
    if (waterbodySearch.trim()) {
      const q = waterbodySearch.toLowerCase();
      regions = regions.filter(r => r.name.toLowerCase().includes(q));
    }
    // Sort: assessed first (by alert severity), then monitored, then unmonitored
    const STATUS_ORDER: Record<string, number> = { assessed: 0, monitored: 1, unmonitored: 2 };
    const SORT_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
    regions.sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2);
      if (statusDiff !== 0) return statusDiff;
      if (a.status === 'assessed' && b.status === 'assessed') {
        const levelDiff = (SORT_ORDER[a.alertLevel] ?? 3) - (SORT_ORDER[b.alertLevel] ?? 3);
        if (levelDiff !== 0) return levelDiff;
      }
      return a.name.localeCompare(b.name);
    });
    return regions;
  }, [selectedStateRegions, waterbodySearch, waterbodyFilter]);
  const DISPLAY_LIMIT = 100;
  const [showAllWaterbodies, setShowAllWaterbodies] = useState(false);
  const [showMethodology, setShowMethodology] = useState(false);
  // showAccountPanel and showViewDropdown removed — account is in DashboardHeader, lens is in sidebar
  const [showRestorationCard, setShowRestorationCard] = useState(false);
  const [showCostPanel, setShowCostPanel] = useState(false);
  const [showGrantMatcher, setShowGrantMatcher] = useState(false);
  const displayedRegions = showAllWaterbodies ? filteredStateRegions : filteredStateRegions.slice(0, DISPLAY_LIMIT);

  // Auto-select top priority waterbody when state changes
  useEffect(() => {
    if (selectedStateTopRegion) {
      setActiveDetailId(selectedStateTopRegion);
    } else {
      setActiveDetailId(null);
    }
  }, [selectedState, selectedStateTopRegion]);

  const topo = useMemo(() => {
    try {
      const geo = feature(statesTopo as any, (statesTopo as any).objects.states) as any;
      // Bake in abbreviation for Mapbox expressions
      return {
        ...geo,
        features: geo.features.map((f: any) => {
          const fips = String(f.id).padStart(2, '0');
          const FIPS_MAP: Record<string, string> = {
            '01':'AL','02':'AK','04':'AZ','05':'AR','06':'CA','08':'CO','09':'CT','10':'DE','11':'DC',
            '12':'FL','13':'GA','15':'HI','16':'ID','17':'IL','18':'IN','19':'IA','20':'KS','21':'KY',
            '22':'LA','23':'ME','24':'MD','25':'MA','26':'MI','27':'MN','28':'MS','29':'MO','30':'MT',
            '31':'NE','32':'NV','33':'NH','34':'NJ','35':'NM','36':'NY','37':'NC','38':'ND','39':'OH',
            '40':'OK','41':'OR','42':'PA','44':'RI','45':'SC','46':'SD','47':'TN','48':'TX','49':'UT',
            '50':'VT','51':'VA','53':'WA','54':'WV','55':'WI','56':'WY',
          };
          return { ...f, properties: { ...f.properties, abbr: FIPS_MAP[fips] || '' } };
        }),
      };
    } catch {
      return null;
    }
  }, []);

  const handleMapRef = useCallback((ref: MapRef) => {
    mapRef.current = ref;
  }, []);

  const handleStateClick = useCallback((e: any) => {
    if (!e.features?.length) return;
    const abbr = e.features[0].properties?.abbr;
    if (!abbr) return;
    setSelectedState(abbr);
    setWaterbodySearch('');
    setWaterbodyFilter('all');
    setShowAllWaterbodies(false);
    // Zoom to clicked state
    const map = mapRef.current;
    if (map) {
      // Zoom to state center
      const stateGeo: Record<string, { center: [number, number]; zoom: number }> = {
        AL:{center:[32.8,-86.8],zoom:7},AK:{center:[64.0,-153.0],zoom:4},AZ:{center:[34.2,-111.7],zoom:7},
        AR:{center:[34.8,-92.4],zoom:7},CA:{center:[37.5,-119.5],zoom:6},CO:{center:[39.0,-105.5],zoom:7},
        CT:{center:[41.6,-72.7],zoom:9},DE:{center:[39.0,-75.5],zoom:9},DC:{center:[38.9,-77.02],zoom:12},
        FL:{center:[28.5,-82.5],zoom:7},GA:{center:[32.7,-83.5],zoom:7},HI:{center:[20.5,-157.0],zoom:7},
        ID:{center:[44.5,-114.5],zoom:6},IL:{center:[40.0,-89.2],zoom:7},IN:{center:[39.8,-86.3],zoom:7},
        IA:{center:[42.0,-93.5],zoom:7},KS:{center:[38.5,-98.5],zoom:7},KY:{center:[37.8,-85.3],zoom:7},
        LA:{center:[31.0,-92.0],zoom:7},ME:{center:[45.5,-69.0],zoom:7},MD:{center:[39.0,-77.0],zoom:8},
        MA:{center:[42.3,-71.8],zoom:8},MI:{center:[44.0,-85.5],zoom:7},MN:{center:[46.3,-94.5],zoom:6},
        MS:{center:[32.7,-89.7],zoom:7},MO:{center:[38.5,-92.5],zoom:7},MT:{center:[47.0,-109.6],zoom:6},
        NE:{center:[41.5,-99.8],zoom:7},NV:{center:[39.5,-117.0],zoom:6},NH:{center:[43.8,-71.6],zoom:8},
        NJ:{center:[40.1,-74.7],zoom:8},NM:{center:[34.5,-106.0],zoom:7},NY:{center:[42.5,-75.5],zoom:7},
        NC:{center:[35.5,-79.5],zoom:7},ND:{center:[47.5,-100.5],zoom:7},OH:{center:[40.2,-82.8],zoom:7},
        OK:{center:[35.5,-97.5],zoom:7},OR:{center:[44.0,-120.5],zoom:7},PA:{center:[41.0,-77.6],zoom:7},
        RI:{center:[41.7,-71.5],zoom:10},SC:{center:[33.8,-80.9],zoom:8},SD:{center:[44.5,-100.2],zoom:7},
        TN:{center:[35.8,-86.3],zoom:7},TX:{center:[31.5,-99.5],zoom:6},UT:{center:[39.5,-111.7],zoom:7},
        VT:{center:[44.0,-72.6],zoom:8},VA:{center:[37.8,-79.5],zoom:7},WA:{center:[47.5,-120.5],zoom:7},
        WV:{center:[38.6,-80.6],zoom:8},WI:{center:[44.5,-89.8],zoom:7},WY:{center:[43.0,-107.5],zoom:7},
      };
      const s = stateGeo[abbr];
      if (s) {
        map.flyTo({ center: [s.center[1], s.center[0]], zoom: s.zoom, duration: 800 });
      }
    }
  }, []);

  const allActiveAlerts = useMemo(() => {
    const rows = regionData
      .filter((r) => (r.activeAlerts ?? 0) > 0)
      .slice()
      .sort((a, b) => {
        const sa = SEVERITY_SCORE[a.alertLevel] ?? 0;
        const sb = SEVERITY_SCORE[b.alertLevel] ?? 0;
        if (sb !== sa) return sb - sa;
        return (b.activeAlerts ?? 0) - (a.activeAlerts ?? 0);
      });

    return rows;
  }, [regionData]);

  // ── National Summary (single source of truth for planner) ──
  // Declared early so stateRollup can blend flow scores from the server response
  const [nationalSummary, setNationalSummary] = useState<NationalSummary | null>(null);

  // Feature 1: National Summary Stats — three-tier awareness + ATTAINS
  // Feature 2: State Rollup Data — three-tier system + ATTAINS fallback
  const stateRollup = useMemo(() => {
    // Tier 1: ASSESSED waterbodies (legacy alerts or per-waterbody matches) → direct grading
    // Tier 2: ATTAINS bulk data (EPA 303(d) state counts) → grade from federal data
    // Tier 3: No data → N/A
    const LEVEL_SCORE: Record<string, number> = { none: 100, low: 85, medium: 65, high: 40 };
    const rows = Array.from(derived.regionsByState.entries()).map(([abbr, regions]) => {
      const assessed = regions.filter(r => r.status === 'assessed');
      const monitored = regions.filter(r => r.status === 'monitored');
      const unmonitored = regions.filter(r => r.status === 'unmonitored');

      // Check for ATTAINS bulk data for this state
      const attainsState = attainsBulk[abbr];
      const hasAttains = !!attainsState && attainsState.length > 0;

      // Compute alert counts from per-waterbody assessed OR ATTAINS bulk
      let high: number, medium: number, low: number, none: number, totalAlerts: number;
      let assessedCount: number;
      let canGradeState: boolean;
      let score: number;
      let dataSource: 'per-waterbody' | 'attains' | 'none';

      if (assessed.length > 0) {
        // Tier 1: We have per-waterbody assessments (legacy + matched ATTAINS)
        high = assessed.filter(r => r.alertLevel === 'high').length;
        medium = assessed.filter(r => r.alertLevel === 'medium').length;
        low = assessed.filter(r => r.alertLevel === 'low').length;
        none = assessed.filter(r => r.alertLevel === 'none').length;
        totalAlerts = assessed.reduce((sum, r) => sum + (r.activeAlerts || 0), 0);
        assessedCount = assessed.length;
        canGradeState = true;
        score = Math.round(assessed.reduce((s, r) => s + (LEVEL_SCORE[r.alertLevel] ?? 65), 0) / assessed.length);
        dataSource = 'per-waterbody';
      } else if (hasAttains) {
        // Tier 2: No per-waterbody matches, but ATTAINS bulk data exists
        // Use EPA assessment category counts directly for state grading
        high = attainsState.filter(a => a.alertLevel === 'high').length;
        medium = attainsState.filter(a => a.alertLevel === 'medium').length;
        low = attainsState.filter(a => a.alertLevel === 'low').length;
        none = attainsState.filter(a => a.alertLevel === 'none').length;
        totalAlerts = high + medium; // Cat 5 + Cat 4 = impaired
        assessedCount = attainsState.length;
        canGradeState = true;
        // Score from ATTAINS category distribution
        const attainsTotal = high + medium + low + none;
        score = attainsTotal > 0
          ? Math.round((high * 40 + medium * 65 + low * 85 + none * 100) / attainsTotal)
          : -1;
        dataSource = 'attains';
      } else {
        // Tier 3: No data at all
        high = 0; medium = 0; low = 0; none = 0; totalAlerts = 0;
        assessedCount = 0;
        canGradeState = false;
        score = -1;
        dataSource = 'none';
      }

      const grade = canGradeState ? scoreToGrade(score) : { letter: 'N/A', color: 'text-slate-400', bg: 'bg-slate-100 border-slate-300' };

      // Aggregate ATTAINS categories + causes for this state
      const stateAttains = attainsBulk[abbr] || [];
      let cat5 = 0, cat4a = 0, cat4b = 0, cat4c = 0;
      const stateCauses: Record<string, number> = {};
      for (const a of stateAttains) {
        const rawCat = (a.category || '').trim().toUpperCase();
        if (rawCat.startsWith('5')) cat5++;
        else if (rawCat.startsWith('4A')) cat4a++;
        else if (rawCat.startsWith('4B')) cat4b++;
        else if (rawCat.startsWith('4C')) cat4c++;
        if (rawCat.startsWith('5') || rawCat.startsWith('4')) {
          for (const cause of (a.causes || [])) {
            const n = cause.trim();
            if (n && n !== 'CAUSE UNKNOWN') stateCauses[n] = (stateCauses[n] || 0) + 1;
          }
        }
      }
      const stateTopCauses = Object.entries(stateCauses)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cause, count]) => ({ cause, count }));

      // Real waterbody universe = max of our registry vs ATTAINS total for honest coverage
      const attainsTotal = stateAttains.length;
      const realWaterbodyCount = Math.max(regions.length, attainsTotal);

      // Blend USGS flow vulnerability into composite score (15% weight)
      const flowData = nationalSummary?.flowScores?.[abbr];
      const finalScore = (canGradeState && score >= 0 && flowData)
        ? Math.round(score * 0.85 + flowData.score * 0.15)
        : score;
      const finalGrade = canGradeState ? scoreToGrade(finalScore) : grade;

      return {
        abbr, name: STATE_ABBR_TO_NAME[abbr],
        high, medium, low, none, total: totalAlerts,
        waterbodies: realWaterbodyCount,
        assessed: assessedCount,
        monitored: monitored.length,
        unmonitored: unmonitored.length,
        canGradeState,
        score: finalScore, grade: finalGrade, dataSource,
        flowScore: flowData?.score, flowSites: flowData?.sites,
        cat5, cat4a, cat4b, cat4c,
        totalImpaired: cat5 + cat4a + cat4b + cat4c,
        topCauses: stateTopCauses,
      };
    });
    // Graded states first (worst scores first), then ungraded states alphabetically
    return rows.sort((a, b) => {
      if (a.canGradeState && !b.canGradeState) return -1;
      if (!a.canGradeState && b.canGradeState) return 1;
      if (a.canGradeState && b.canGradeState) return a.score - b.score;
      return a.name.localeCompare(b.name);
    });
  }, [derived.regionsByState, attainsBulk, nationalSummary?.flowScores]);

  // Build Mapbox fill-color match expression from state colors
  const fillColorExpr = useMemo(() => {
    if (!topo) return '#e5e7eb';
    const entries: (string)[] = [];
    for (const f of topo.features) {
      const abbr = f.properties?.abbr;
      if (abbr) {
        entries.push(abbr, getStateFill(abbr, overlay, overlayByState, stateRollup, showImpact));
      }
    }
    return ['match', ['get', 'abbr'], ...entries, '#e5e7eb'] as any;
  }, [topo, overlay, overlayByState, stateRollup, showImpact]);

  // Feature 1: National Summary Stats — three-tier awareness + ATTAINS
  const nationalStats = useMemo(() => {
    const statesCovered = derived.regionsByState.size;
    const totalWaterbodies = filteredRegionData.length;
    const perWaterbodyAssessed = filteredRegionData.filter(r => r.status === 'assessed').length;
    const monitored = filteredRegionData.filter(r => r.status === 'monitored').length;
    const unmonitored = filteredRegionData.filter(r => r.status === 'unmonitored').length;

    // Assessed count includes ATTAINS-only states
    const attainsOnlyAssessed = stateRollup
      .filter(s => s.dataSource === 'attains')
      .reduce((sum, s) => sum + s.assessed, 0);
    const assessed = perWaterbodyAssessed + attainsOnlyAssessed;

    // Alert counts from stateRollup (which includes ATTAINS)
    const highAlerts = stateRollup.reduce((s, r) => s + r.high, 0);
    const mediumAlerts = stateRollup.reduce((s, r) => s + r.medium, 0);
    const lowAlerts = stateRollup.reduce((s, r) => s + r.low, 0);
    const totalAlerts = stateRollup.reduce((s, r) => s + r.total, 0);
    const systemsOnline = filteredRegionData.filter(r => r.dataSourceCount > 0).length;
    const gradedStates = stateRollup.filter(s => s.canGradeState).length;
    
    return { statesCovered, totalWaterbodies, assessed, monitored, unmonitored, totalAlerts, highAlerts, mediumAlerts, lowAlerts, systemsOnline, gradedStates,
      waterbodiesMonitored: totalWaterbodies,
    };
  }, [filteredRegionData, derived.regionsByState, stateRollup]);

  // ── Federal Priority Score: composite waterbody ranking for federal action queue ──
  const federalPriorities = useMemo(() => {
    if (!lens.showPriorityQueue) return [];
    // Score each waterbody: Cat 5 (+40), no TMDL (+20), EJ ≥60 (+20), no recent data (+15), high population (+5)
    return regionData
      .map(r => {
        let score = 0;
        const reasons: string[] = [];
        if (r.alertLevel === 'high') { score += 40; reasons.push('Cat 5'); }
        else if (r.alertLevel === 'medium') { score += 25; reasons.push('Cat 4'); }
        if (r.alertLevel === 'high') { score += 20; reasons.push('No TMDL'); } // Cat 5 = no approved TMDL
        const ov = r.state ? overlayByState.get(r.state) : undefined;
        if (ov && ov.ej >= 60) { score += 20; reasons.push(`EJ ${ov.ej}`); }
        if (r.status === 'unmonitored' || r.dataSourceCount === 0) { score += 15; reasons.push('No data'); }
        else if (r.status === 'monitored' && r.activeAlerts === 0) { score += 5; reasons.push('Monitor only'); }
        return { ...r, priorityScore: score, reasons };
      })
      .filter(r => r.priorityScore > 0)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 20);
  }, [viewLens, regionData, overlayByState]);

  // ── Federal Coverage Gaps: states ranked by worst coverage ──
  const federalCoverageGaps = useMemo(() => {
    if (!lens.showCoverageGaps) return { worstCoverage: [], mostSevere: [] };
    const worstCoverage = [...stateRollup]
      .map(s => ({
        ...s,
        coveragePct: s.waterbodies > 0 ? Math.round(((s.assessed + s.monitored) / s.waterbodies) * 100) : 0,
        blindSpots: s.unmonitored,
      }))
      .sort((a, b) => a.coveragePct - b.coveragePct)
      .slice(0, 10);
    const mostSevere = [...stateRollup]
      .filter(s => s.high > 0 || s.medium > 0)
      .sort((a, b) => (b.high * 3 + b.medium) - (a.high * 3 + a.medium))
      .slice(0, 10);
    return { worstCoverage, mostSevere };
  }, [viewLens, stateRollup]);

  // ── National ATTAINS aggregation: category + cause breakdown from bulk data ──
  const attainsAggregation = useMemo(() => {
    const catCounts: Record<string, number> = { '5': 0, '4A': 0, '4B': 0, '4C': 0, '3': 0, '2': 0, '1': 0, unknown: 0 };
    const causeCounts: Record<string, number> = {};
    let totalAssessed = 0;
    let totalImpaired = 0; // Cat 4 + Cat 5

    for (const assessments of Object.values(attainsBulk)) {
      for (const a of assessments) {
        totalAssessed++;
        // Normalize category: "5", "4a", "4A", "4b", etc.
        const rawCat = (a.category || '').trim().toUpperCase();
        if (rawCat.startsWith('5')) { catCounts['5']++; totalImpaired++; }
        else if (rawCat.startsWith('4A')) { catCounts['4A']++; totalImpaired++; }
        else if (rawCat.startsWith('4B')) { catCounts['4B']++; totalImpaired++; }
        else if (rawCat.startsWith('4C')) { catCounts['4C']++; totalImpaired++; }
        else if (rawCat.startsWith('3')) { catCounts['3']++; }
        else if (rawCat.startsWith('2')) { catCounts['2']++; }
        else if (rawCat.startsWith('1')) { catCounts['1']++; }
        else { catCounts['unknown']++; }

        // Aggregate causes (only for impaired waterbodies)
        if (rawCat.startsWith('5') || rawCat.startsWith('4')) {
          for (const cause of (a.causes || [])) {
            const normalized = cause.trim();
            if (normalized && normalized !== 'CAUSE UNKNOWN' && normalized !== 'CAUSE UNKNOWN - IMPAIRED BIOTA') {
              causeCounts[normalized] = (causeCounts[normalized] || 0) + 1;
            }
          }
        }
      }
    }

    // Sort causes by frequency
    const topCauses = Object.entries(causeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([cause, count]) => ({ cause, count }));

    // ALIA-addressable causes (sediment, nutrients, bacteria, turbidity, DO, metals from stormwater)
    const PEARL_ADDRESSABLE = ['sediment', 'silt', 'tss', 'suspended solid', 'turbidity',
      'nutrient', 'nitrogen', 'phosphor', 'ammonia', 'nitrate', 'nitrite',
      'bacteria', 'e. coli', 'e.coli', 'enterococ', 'fecal', 'coliform', 'pathogen',
      'dissolved oxygen', 'oxygen, dissolved', 'organic enrichment',
      'iron', 'manganese', 'copper', 'zinc', 'lead', 'aluminum', 'stormwater'];
    let addressableCount = 0;
    for (const [cause, count] of Object.entries(causeCounts)) {
      const lower = cause.toLowerCase();
      if (PEARL_ADDRESSABLE.some(p => lower.includes(p))) {
        addressableCount += count;
      }
    }

    // TMDL gap: Cat 5 / total impaired
    const tmdlGapPct = totalImpaired > 0 ? Math.round((catCounts['5'] / totalImpaired) * 100) : 0;

    // Water type breakdown — normalize codes to display labels
    const rawWaterTypeCounts: Record<string, number> = {};
    for (const assessments of Object.values(attainsBulk)) {
      for (const a of assessments) {
        if (a.waterType) {
          rawWaterTypeCounts[a.waterType] = (rawWaterTypeCounts[a.waterType] || 0) + 1;
        }
      }
    }
    const WATER_TYPE_LABELS: Record<string, string> = {
      'RIVER': 'Rivers & Streams', 'STREAM': 'Rivers & Streams', 'STREAM/CREEK': 'Rivers & Streams',
      'LAKE, RESERVOIR AND POND': 'Lakes & Reservoirs', 'FRESHWATER POND': 'Lakes & Reservoirs',
      'LAKE': 'Lakes & Reservoirs', 'RESERVOIR': 'Lakes & Reservoirs',
      'ESTUARY': 'Estuaries',
      'OCEAN': 'Coastal/Ocean', 'COASTAL': 'Coastal/Ocean', 'GREAT LAKES SHORELINE': 'Coastal/Ocean',
      'WETLAND': 'Wetlands', 'WETLANDS, TIDAL': 'Wetlands', 'WETLANDS, FRESHWATER': 'Wetlands',
      'WETLANDS': 'Wetlands',
    };
    const waterTypeCounts: Record<string, number> = {};
    for (const [code, count] of Object.entries(rawWaterTypeCounts)) {
      const label = WATER_TYPE_LABELS[code.toUpperCase()] || 'Other';
      waterTypeCounts[label] = (waterTypeCounts[label] || 0) + count;
    }

    return {
      catCounts,
      totalAssessed,
      totalImpaired,
      cat5: catCounts['5'],        // No TMDL
      cat4a: catCounts['4A'],      // Has approved TMDL
      cat4b: catCounts['4B'],      // Alternative controls
      cat4c: catCounts['4C'],      // Not pollutant-caused
      tmdlGapPct,
      topCauses,
      addressableCount,
      totalCauseInstances: Object.values(causeCounts).reduce((s, c) => s + c, 0),
      addressablePct: Object.values(causeCounts).reduce((s, c) => s + c, 0) > 0
        ? Math.round((addressableCount / Object.values(causeCounts).reduce((s, c) => s + c, 0)) * 100) : 0,
      waterTypeCounts,
    };
  }, [attainsBulk]);

  // ── Federal top strip stats ──
  const topStrip = useMemo(() => {
    if (!lens.showTopStrip) return null;
    const statesWithData = stateRollup.filter(s => s.assessed > 0 || s.monitored > 0).length;
    const worstAge = 45; // days — will be real when last_updated tracked
    const pctWithData = nationalStats.totalWaterbodies > 0
      ? Math.round(((nationalStats.assessed + nationalStats.monitored) / nationalStats.totalWaterbodies) * 100) : 0;
    const highEJStates = stateRollup.filter(s => {
      const ov = overlayByState.get(s.abbr);
      return ov && ov.ej >= 60;
    }).length;

    // Use ATTAINS category aggregation when available, fall back to alertLevel counts
    const hasAttainsCategories = attainsAggregation.totalAssessed > 0;

    return {
      statesReporting: statesWithData,
      totalStates: stateRollup.length,
      withData: nationalStats.assessed + nationalStats.monitored,
      noData: nationalStats.unmonitored,
      severeCount: nationalStats.highAlerts,
      // Proper distinct counts from ATTAINS categories
      cat5Count: hasAttainsCategories ? attainsAggregation.cat5 : stateRollup.reduce((s, r) => s + r.high, 0),
      noTmdlCount: hasAttainsCategories ? attainsAggregation.cat5 : stateRollup.reduce((s, r) => s + r.high, 0),
      hasTmdlCount: hasAttainsCategories ? attainsAggregation.cat4a : 0,
      altControlsCount: hasAttainsCategories ? attainsAggregation.cat4b : 0,
      totalImpaired: hasAttainsCategories ? attainsAggregation.totalImpaired : stateRollup.reduce((s, r) => s + r.high + r.medium, 0),
      tmdlGapPct: attainsAggregation.tmdlGapPct,
      worstAge,
      pctWithData,
      highEJStates,
      sitesOnline: nationalStats.systemsOnline,
    };
  }, [viewLens, stateRollup, nationalStats, overlayByState, attainsAggregation]);

  // ── National AI data prop for AIInsightsEngine ──
  const nationalAIData = useMemo(() => {
    if (attainsAggregation.totalAssessed === 0) return undefined;
    const worstStates = [...stateRollup]
      .filter(s => s.cat5 > 0)
      .sort((a, b) => b.cat5 - a.cat5)
      .slice(0, 8)
      .map(s => ({ abbr: s.abbr, name: s.name, cat5: s.cat5, totalImpaired: s.totalImpaired, topCauses: s.topCauses }));
    return { ...attainsAggregation, worstStates };
  }, [attainsAggregation, stateRollup]);

  // ── Response Planner scope context (national default) ──
  const resolutionPlannerScope = useMemo((): ScopeContext => {
    // Prefer server-computed national summary (single source of truth)
    if (nationalSummary) {
      return {
        scope: 'national',
        data: {
          totalStates: nationalSummary.statesReporting,
          totalWaterbodies: nationalSummary.totalWaterbodies,
          totalImpaired: nationalSummary.totalImpaired,
          averageScore: nationalSummary.averageScore,
          highAlertStates: nationalSummary.highAlertStates,
          topCauses: nationalSummary.topCauses,
          worstStates: nationalSummary.worstStates,
          tmdlGap: nationalSummary.tmdlGap,
          tmdlCompleted: nationalSummary.tmdlCompleted,
          realtimeSites: nationalSummary.realtimeSites,
          activeAlerts: nationalSummary.activeAlerts,
          criticalAlerts: nationalSummary.criticalAlerts,
        },
      };
    }

    // Fallback to client-side stateRollup computation
    const gradedStates = stateRollup.filter(s => s.canGradeState);
    const avgScore = gradedStates.length > 0
      ? Math.round(gradedStates.reduce((s, r) => s + r.score, 0) / gradedStates.length)
      : -1;
    const highAlertStates = stateRollup.filter(s => s.high > 0).length;
    const totalImpaired = stateRollup.reduce((s, r) => s + r.totalImpaired, 0);
    const totalWaterbodies = stateRollup.reduce((s, r) => s + r.waterbodies, 0);

    const worstStates = [...stateRollup]
      .filter(s => s.canGradeState)
      .sort((a, b) => a.score - b.score)
      .slice(0, 10)
      .map(s => ({ abbr: s.abbr, score: s.score, impaired: s.totalImpaired }));

    return {
      scope: 'national',
      data: {
        totalStates: stateRollup.length,
        totalWaterbodies,
        totalImpaired,
        averageScore: avgScore,
        highAlertStates,
        topCauses: attainsAggregation.topCauses.slice(0, 15),
        worstStates,
      },
    };
  }, [nationalSummary, stateRollup, attainsAggregation]);

  // ── Data Reliability Report (computed from /api/cache-status) ──
  //
  // Per-source refresh config derived from vercel.json cron schedules.
  // staleAfterHours = 2× the scheduled interval so normal cycles don't trip the alarm.
  // deployed=false for crons registered in vercel.json but not yet live on Vercel.
  //
  const CACHE_REFRESH_CONFIG: Record<string, { label: string; staleAfterHours: number; deployed: boolean }> = {
    // ── 30-min sources (*/30 or per-hour) ──
    nwisIv:       { label: 'NWIS-IV',       staleAfterHours: 1,      deployed: true },   // */30 * * * *
    usgsAlerts:   { label: 'USGS Alerts',   staleAfterHours: 1,      deployed: true },   // rebuilt with NWIS-IV
    nwsAlerts:    { label: 'NWS Alerts',    staleAfterHours: 1,      deployed: true },   // */30 * * * *
    // ── Hourly incremental (full cycle spans days) ──
    attains:      { label: 'ATTAINS',       staleAfterHours: 144,    deployed: true },   // 30 * * * * — full 51-state cycle ~3 days
    // ── 6-hourly sources ──
    insights:     { label: 'AI Insights',   staleAfterHours: 12,     deployed: true },   // 0 */6 * * *
    // ── Daily sources ──
    ceden:        { label: 'CEDEN',         staleAfterHours: 48,     deployed: true },   // 0 4 * * *
    wqp:          { label: 'WQP',           staleAfterHours: 48,     deployed: true },   // 0 5 * * *
    stateReports: { label: 'State Reports', staleAfterHours: 48,     deployed: true },   // 30 5 * * *
    icis:         { label: 'ICIS',          staleAfterHours: 48,     deployed: true },   // 0 6 * * *
    sdwis:        { label: 'SDWIS',         staleAfterHours: 48,     deployed: true },   // 0 7 * * *
    nwisGw:       { label: 'NWIS-GW',       staleAfterHours: 48,     deployed: true },   // 0 8 * * *
    echo:         { label: 'ECHO',          staleAfterHours: 48,     deployed: true },   // 0 9 * * *
    frs:          { label: 'FRS',           staleAfterHours: 48,     deployed: true },   // 0 10 * * *
    pfas:         { label: 'PFAS',          staleAfterHours: 48,     deployed: true },   // 0 11 * * *
    bwb:          { label: 'BWB',           staleAfterHours: 48,     deployed: true },   // 0 12 * * *
    cdcNwss:      { label: 'CDC-NWSS',      staleAfterHours: 48,     deployed: true },   // 0 13 * * *
    ndbc:         { label: 'NDBC',          staleAfterHours: 48,     deployed: true },   // 0 14 * * *
    nasaCmr:      { label: 'NASA-CMR',      staleAfterHours: 48,     deployed: true },   // 0 15 * * *
    usace:        { label: 'USACE',         staleAfterHours: 48,     deployed: true },   // 0 16 * * *
    // ── Weekly sources (Sunday) ──
    nars:         { label: 'NARS',          staleAfterHours: 336,    deployed: true },   // 0 16 * * 0 — 14 days
    dataGov:      { label: 'Data.gov',      staleAfterHours: 336,    deployed: true },   // 0 17 * * 0 — 14 days
    // ── Static / biennial ──
    stateIR:      { label: 'State IR',      staleAfterHours: 17520,  deployed: true },   // static file, ~biennial
    // ── Additional deployed sources ──
    nwps:         { label: 'NWPS',          staleAfterHours: 1,      deployed: true },    // */30 * * * *
    coops:        { label: 'CO-OPS',        staleAfterHours: 12,     deployed: true },    // 0 */6 * * *
    snotel:       { label: 'SNOTEL',        staleAfterHours: 48,     deployed: true },    // 0 18 * * *
    tri:          { label: 'TRI',           staleAfterHours: 48,     deployed: true },     // 0 19 * * *
  };

  const [dataReliability, setDataReliability] = useState<DataReliabilityReport | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;

    const fetchReliability = async () => {
      try {
        const [res, summaryRes] = await Promise.all([
          fetch('/api/cache-status'),
          fetch('/api/national-summary'),
        ]);
        if (summaryRes.ok && !cancelled) {
          setNationalSummary(await summaryRes.json());
        }
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const caches = json.caches as Record<string, any>;
        const staleCaches: string[] = [];
        const missingCaches: string[] = [];
        const pendingCaches: string[] = [];
        const healthyCaches: string[] = [];
        let staleStateCount = 0;
        let deployedTotal = 0;
        let deployedLoaded = 0;

        for (const [key, c] of Object.entries(caches)) {
          const cfg = CACHE_REFRESH_CONFIG[key];
          if (!cfg || !cfg.deployed) continue;              // skip unknown / undeployed
          deployedTotal++;

          const loaded = c.loaded !== false && c.status !== 'cold' && c.status !== 'idle';
          if (!loaded) {
            // Distinguish "never built" (pending first cron run) from "was built but lost"
            const hasEverBuilt = c.built || c.ageHours != null;
            if (hasEverBuilt) {
              missingCaches.push(cfg.label);                // had data but failed to reload
            } else {
              pendingCaches.push(cfg.label);                // awaiting first cron run
            }
            continue;
          }
          deployedLoaded++;

          const age = c.ageHours as number | null;
          if (age != null && age > cfg.staleAfterHours) {
            staleCaches.push(`${cfg.label} (${Math.round(age)}h old)`);
          } else {
            const ageStr = age != null ? ` (${Math.round(age)}h)` : '';
            healthyCaches.push(`${cfg.label}${ageStr}`);
          }
        }

        // Count ATTAINS states with missing data
        if (caches.attains) {
          staleStateCount = caches.attains.statesMissing || 0;
        }

        // Pending caches don't count as problems — they just haven't had their first run
        const problemCount = staleCaches.length + missingCaches.length;
        const overallReliable = problemCount <= Math.floor(deployedTotal * 0.25);
        const recommendation = overallReliable
          ? 'Data sufficient for reliable analysis'
          : 'Repair data pipeline first — too many stale or failed sources for reliable recommendations';

        if (!cancelled) {
          setDataReliability({
            overallReliable,
            staleCaches,
            missingCaches,
            pendingCaches,
            healthyCaches,
            staleStateCount,
            totalCacheCount: deployedTotal,
            loadedCacheCount: deployedLoaded,
            recommendation,
          });
        }
      } catch {
        // Silently fail — plan will generate without reliability banner
      }
    };

    // Fetch immediately
    fetchReliability();

    // Re-poll every 60s while the planner lens is active so new sources show up
    const plannerActive = viewLens === 'planner';
    const interval = plannerActive ? setInterval(fetchReliability, 60_000) : undefined;

    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [viewLens]);

  const [showStateTable, setShowStateTable] = useState(false);
  const [showHotspotsSection, setShowHotspotsSection] = useState(false);

  // Feature 3: Hotspots Rankings
  const hotspots = useMemo(() => {
    const worsening = [...regionData]
      .filter(r => r.activeAlerts > 0)
      .sort((a, b) => {
        const scoreA = SEVERITY_SCORE[a.alertLevel] * 10 + a.activeAlerts;
        const scoreB = SEVERITY_SCORE[b.alertLevel] * 10 + b.activeAlerts;
        return scoreB - scoreA;
      })
      .slice(0, 10);
    
    const improving = [...regionData]
      .filter(r => r.alertLevel === 'none' || r.alertLevel === 'low')
      .sort((a, b) => SEVERITY_SCORE[a.alertLevel] - SEVERITY_SCORE[b.alertLevel])
      .slice(0, 10);
    
    return { worsening, improving };
  }, [regionData]);

  // Feature 11: SLA/Compliance Tracking
  const slaMetrics = useMemo(() => {
    const alerts = Object.entries(alertWorkflow);
    const now = Date.now();
    
    const metrics = alerts.map(([regionId, workflow]) => {
      const region = regionData.find(r => r.id === regionId);
      if (!region) return null;
      
      // Mock: simulate alert created time (12-72 hours ago)
      const createdHoursAgo = Math.floor(Math.random() * 60) + 12;
      const createdAt = now - (createdHoursAgo * 60 * 60 * 1000);
      const ageHours = Math.floor((now - createdAt) / (60 * 60 * 1000));
      
      // SLA thresholds
      const acknowledgeTargetHours = 4;
      const resolveTargetHours = 48;
      
      const acknowledgedLate = workflow.status === 'new' && ageHours > acknowledgeTargetHours;
      const resolveLate = workflow.status !== 'resolved' && ageHours > resolveTargetHours;
      
      return {
        regionId,
        regionName: region.name,
        state: region.state,
        status: workflow.status,
        ageHours,
        acknowledgedLate,
        resolveLate,
        severity: region.alertLevel
      };
    }).filter(Boolean);
    
    const overdueCount = metrics.filter(m => m && (m.acknowledgedLate || m.resolveLate)).length;
    const withinSLA = metrics.filter(m => m && !m.acknowledgedLate && !m.resolveLate).length;
    const avgResolutionTime = metrics.filter(m => m && m.status === 'resolved').length > 0
      ? Math.round(metrics.filter(m => m && m.status === 'resolved').reduce((sum, m) => sum + (m?.ageHours || 0), 0) / metrics.filter(m => m && m.status === 'resolved').length)
      : 0;
    
    return { metrics, overdueCount, withinSLA, avgResolutionTime, total: alerts.length };
  }, [alertWorkflow, regionData]);

  // ── Scorecard derived data — compiled from stateRollup + nationalStats ──
  const scorecardData = useMemo(() => {
    const gradedStates = stateRollup.filter(s => s.canGradeState);
    const nationalAvgScore = gradedStates.length > 0
      ? Math.round(gradedStates.reduce((sum, s) => sum + s.score, 0) / gradedStates.length)
      : 0;
    const nationalGrade = scoreToGrade(nationalAvgScore);
    const totalImpaired = stateRollup.reduce((s, r) => s + r.high + r.medium, 0);
    const totalAssessed = stateRollup.reduce((s, r) => s + r.assessed, 0);
    const impairmentPct = totalAssessed > 0 ? Math.round((totalImpaired / totalAssessed) * 100) : 0;
    const coveragePct = nationalStats.totalWaterbodies > 0
      ? Math.round(((nationalStats.assessed + nationalStats.monitored) / nationalStats.totalWaterbodies) * 100) : 0;
    const sortedByScore = [...gradedStates].sort((a, b) => a.score - b.score);
    const bottom5 = sortedByScore.slice(0, 5);
    const top5 = [...sortedByScore].reverse().slice(0, 5);
    const allStatesAlpha = [...stateRollup].sort((a, b) => a.abbr.localeCompare(b.abbr));
    return { gradedStates, nationalGrade, totalImpaired, totalAssessed, impairmentPct, coveragePct, bottom5, top5, allStatesAlpha };
  }, [stateRollup, nationalStats]);

  // Feature 12: AI-Powered Insights — national-scale, data-driven
  const aiInsights = useMemo(() => {
    const insights: Array<{ type: 'warning' | 'success' | 'info' | 'urgent'; title: string; detail: string; action?: string }> = [];
    const agg = attainsAggregation;
    const totalWB = nationalStats.totalWaterbodies;
    const assessed = nationalStats.assessed;
    const unmonitored = nationalStats.unmonitored;
    const gradedStates = stateRollup.filter(s => s.canGradeState).length;
    const ungradedStates = stateRollup.filter(s => !s.canGradeState).length;

    // ── INSIGHT 1: Potomac — the #1 national water quality crisis ──
    // The Potomac/Chesapeake system is the most impaired watershed in US history by regulatory volume
    const mdRow = stateRollup.find(s => s.abbr === 'MD');
    const vaRow = stateRollup.find(s => s.abbr === 'VA');
    const dcRow = stateRollup.find(s => s.abbr === 'DC');
    const chesapeakeStates = [mdRow, vaRow, dcRow].filter(Boolean);
    const chesapeakeCat5 = chesapeakeStates.reduce((s, r) => s + (r?.cat5 || 0), 0);
    const chesapeakeImpaired = chesapeakeStates.reduce((s, r) => s + (r?.totalImpaired || 0), 0);
    if (chesapeakeCat5 > 0 || chesapeakeImpaired > 0) {
      insights.push({
        type: 'urgent',
        title: 'Potomac–Chesapeake: Largest water quality crisis in U.S. regulatory history',
        detail: `The Chesapeake Bay TMDL — the largest and most complex ever issued by EPA — covers MD, VA, DC, and 4 other states. ${chesapeakeCat5.toLocaleString()} waterbodies in MD/VA/DC alone are Cat 5 (no approved TMDL). The Potomac River basin carries the heaviest nutrient and sediment loads feeding the Bay's dead zones. Decades of nitrogen, phosphorus, and sediment from agriculture, urban runoff, and wastewater have driven chronic hypoxia, SAV loss, and fisheries collapse.`,
        action: 'View Chesapeake TMDL status'
      });
    }

    // ── INSIGHT 2: National TMDL gap — from real ATTAINS categories ──
    if (agg.cat5 > 0) {
      insights.push({
        type: 'warning',
        title: `${agg.cat5.toLocaleString()} waterbodies on 303(d) list — no approved TMDL`,
        detail: `Of ${agg.totalImpaired.toLocaleString()} impaired waterbodies nationwide, ${agg.tmdlGapPct}% are Category 5 — impaired with NO approved Total Maximum Daily Load plan. Only ${agg.cat4a.toLocaleString()} have approved TMDLs (Cat 4a). ${agg.cat4b.toLocaleString()} rely on alternative controls (Cat 4b). States face increasing EPA enforcement pressure to close this gap.`,
        action: 'View TMDL gap by state'
      });
    }

    // ── INSIGHT 3: Pollutant cause breakdown — national impairment profile ──
    if (agg.topCauses.length > 0) {
      insights.push({
        type: 'info',
        title: `${agg.totalCauseInstances.toLocaleString()} pollutant cause-instances across impaired waterbodies`,
        detail: `Of ${agg.totalCauseInstances.toLocaleString()} cause-instances nationwide, the dominant pollutants are sediment, nutrients, bacteria, dissolved oxygen, and stormwater metals. Mercury, PCBs, PFAS, and legacy contaminants account for the remainder. ${agg.topCauses.length > 0 ? `Top national causes: ${agg.topCauses.slice(0, 5).map(c => c.cause).join(', ')}.` : ''}`,
        action: 'View cause breakdown'
      });
    }

    // ── INSIGHT 4: Top impairment causes — what's actually polluting America's water ──
    if (agg.topCauses.length >= 3) {
      const top3 = agg.topCauses.slice(0, 3);
      insights.push({
        type: 'info',
        title: `Top impairment causes: ${top3.map(c => c.cause).join(', ')}`,
        detail: `Across ${agg.totalImpaired.toLocaleString()} impaired waterbodies, ${top3[0].cause} appears ${top3[0].count.toLocaleString()} times, followed by ${top3[1].cause} (${top3[1].count.toLocaleString()}) and ${top3[2].cause} (${top3[2].count.toLocaleString()}). These patterns indicate where restoration and monitoring resources should be concentrated — nutrient-dominated watersheds require different intervention strategies than sediment- or bacteria-driven impairments.`,
      });
    }

    // ── INSIGHT 5: Worst states by TMDL gap ──
    const worstStates = [...stateRollup]
      .filter(s => s.cat5 > 0)
      .sort((a, b) => b.cat5 - a.cat5)
      .slice(0, 5);
    if (worstStates.length > 0) {
      insights.push({
        type: 'warning',
        title: `Highest Cat 5 concentrations: ${worstStates.map(s => `${s.name} (${s.cat5})`).join(', ')}`,
        detail: `These states carry the greatest density of impaired waterbodies without approved TMDLs and face the most regulatory pressure to develop restoration plans. Maryland's Chesapeake Bay TMDL obligations are especially significant — the state must demonstrate pollution reduction to meet EPA milestones or face federal backstop measures.`,
        action: 'View state breakdown'
      });
    }

    // ── INSIGHT 6: Monitoring coverage gap ──
    if (unmonitored > 0) {
      insights.push({
        type: 'info',
        title: `${unmonitored.toLocaleString()} waterbodies lack monitoring data`,
        detail: `Of ${totalWB.toLocaleString()} tracked waterbodies, ${unmonitored.toLocaleString()} have no mapped data sources. ${ungradedStates} states cannot be graded. Expanding real-time sensor coverage in data-blind freshwater systems — where USGS gauges are sparse and ATTAINS listings are stale — is critical for accurate national water quality assessment.`,
        action: 'View data gaps'
      });
    }

    // ── INSIGHT 7: MS4 market (if overlay active) ──
    if (overlay === 'ms4') {
      const totalMS4 = Object.values(MS4_JURISDICTIONS).reduce((s, m) => s + m.phase1 + m.phase2, 0);
      const topMS4States = Object.entries(MS4_JURISDICTIONS)
        .map(([abbr, m]) => ({ abbr, total: m.phase1 + m.phase2 }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      insights.push({
        type: 'info',
        title: `${totalMS4.toLocaleString()} MS4 jurisdictions nationwide under NPDES stormwater permits`,
        detail: `Top jurisdictions: ${topMS4States.map(s => `${STATE_ABBR_TO_NAME[s.abbr]} (${s.total})`).join(', ')}. Every MS4 must meet NPDES stormwater discharge requirements and demonstrate measurable TSS, nutrient, and bacteria reduction for permit compliance documentation.`,
        action: 'View MS4 breakdown'
      });
    }

    // ── INSIGHT 8: SLA compliance ──
    if (slaMetrics.overdueCount > 0) {
      insights.push({
        type: 'urgent',
        title: `${slaMetrics.overdueCount} alerts overdue for response`,
        detail: `${slaMetrics.overdueCount} alerts exceed SLA thresholds. Average resolution time: ${slaMetrics.avgResolutionTime}h (target: <48h).`,
        action: 'Review assignments'
      });
    }

    // ── INSIGHT 9: EJ overlap (if overlay active) ──
    if (overlay === 'ej') {
      const ejHighRisk = Array.from(derived.regionsByState.entries())
        .filter(([abbr]) => overlayByState.get(abbr)?.ej && overlayByState.get(abbr)!.ej > 70)
        .slice(0, 3);
      if (ejHighRisk.length > 0) {
        insights.push({
          type: 'warning',
          title: 'Environmental justice communities with elevated pollution burden',
          detail: `Communities in ${ejHighRisk.map(([abbr]) => STATE_ABBR_TO_NAME[abbr]).join(', ')} face disproportionate water quality impacts. Federal infrastructure funding (BIL, SRF) increasingly requires EJ targeting — restoration and monitoring projects in these areas qualify for priority funding.`,
          action: 'Generate EJ report'
        });
      }
    }

    return insights;
  }, [nationalStats, stateRollup, derived.regionsByState, overlay, overlayByState, slaMetrics, attainsAggregation]);

  // ─── Network Health Score (derived from state grades) ────────────────────────
  const [showHealthDetails, setShowHealthDetails] = useState(false);
  const [scorecardRegionFilter, setScorecardRegionFilter] = useState<number | 'all'>('all');
  const [selectedWatershed, setSelectedWatershed] = useState<string | null>(null);

  const mapSectionRef = useRef<HTMLDivElement>(null);

  const networkHealth = useMemo(() => {
    const gradedStates = stateRollup.filter(s => s.canGradeState);
    const ungradedStates = stateRollup.filter(s => !s.canGradeState);
    const totalAssessed = stateRollup.reduce((s, r) => s + r.assessed, 0);
    const totalMonitored = stateRollup.reduce((s, r) => s + r.monitored, 0);
    const totalUnmonitored = stateRollup.reduce((s, r) => s + r.unmonitored, 0);

    if (gradedStates.length === 0) return {
      percentage: -1, status: 'unknown' as const, color: 'slate' as const,
      grade: { letter: 'N/A', color: 'text-slate-400', bg: 'bg-slate-100 border-slate-300' },
      sitesNeedingAttention: 0, worstStates: [] as typeof stateRollup,
      drivers: ['No assessed waterbodies yet — data collection in progress'],
      stateCount: stateRollup.length,
      gradedStateCount: 0, ungradedStateCount: ungradedStates.length,
      totalAssessed, totalMonitored, totalUnmonitored,
    };

    // Network score = average of GRADED state scores only
    const avgScore = Math.round(gradedStates.reduce((s, r) => s + r.score, 0) / gradedStates.length);
    const grade = scoreToGrade(avgScore);

    const sitesNeedingAttention = gradedStates.filter(s => s.score < 70).length;
    const worstStates = [...gradedStates].sort((a, b) => a.score - b.score).slice(0, 10);

    // Drivers: based on assessed waterbodies only
    const drivers: string[] = [];
    const totalHigh = stateRollup.reduce((s, r) => s + r.high, 0);
    const totalMed = stateRollup.reduce((s, r) => s + r.medium, 0);
    const totalLow = stateRollup.reduce((s, r) => s + r.low, 0);

    if (totalHigh > 0) drivers.push(`${totalHigh} severe waterbodies across ${stateRollup.filter(s => s.high > 0).length} states`);
    if (totalMed > 0) drivers.push(`${totalMed} impaired waterbodies across ${stateRollup.filter(s => s.medium > 0).length} states`);
    if (totalLow > 0) drivers.push(`${totalLow} watch-level sites`);
    if (totalUnmonitored > 0) drivers.push(`${totalUnmonitored.toLocaleString()} waterbodies awaiting sensor deployment`);
    if (drivers.length === 0) drivers.push('All assessed waterbodies within acceptable ranges');
    drivers.splice(4);

    const status = avgScore >= 90 ? 'healthy' as const : avgScore >= 75 ? 'caution' as const : 'critical' as const;
    const color = avgScore >= 90 ? 'green' as const : avgScore >= 75 ? 'yellow' as const : 'red' as const;

    return {
      percentage: avgScore, status, color, grade,
      sitesNeedingAttention, worstStates, drivers,
      stateCount: stateRollup.length,
      gradedStateCount: gradedStates.length, ungradedStateCount: ungradedStates.length,
      totalAssessed, totalMonitored, totalUnmonitored,
      severeCount: totalHigh, severeStates: stateRollup.filter(s => s.high > 0).length,
      impairedCount: totalMed, impairedStates: stateRollup.filter(s => s.medium > 0).length,
      monitoredCount: totalMonitored, totalCount: stateRollup.reduce((s, r) => s + r.waterbodies, 0),
    };
  }, [stateRollup]);

  // ─── National Impact Counter ──────────────────────────────────────────────
  const [impactPeriod, setImpactPeriod] = useState<'all' | string>('all');

  // Build dynamic year list from deployment start to current year
  const impactYears = useMemo(() => {
    const startYear = 2025;
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = startYear; y <= currentYear; y++) years.push(y);
    return years;
  }, []);

  const nationalImpact = useMemo(() => {
    const deployedSites = regionData.filter(r => r.state === 'MD' || r.state === 'FL');
    const activeSiteCount = deployedSites.length;
    const now = new Date();

    // Determine window start/end based on selected period
    let windowStart: Date;
    let windowEnd: Date;

    if (impactPeriod === 'all') {
      windowStart = DEPLOYMENT_START;
      windowEnd = now;
    } else {
      const year = parseInt(impactPeriod, 10);
      windowStart = new Date(Math.max(DEPLOYMENT_START.getTime(), new Date(`${year}-01-01`).getTime()));
      windowEnd = year === now.getFullYear() ? now : new Date(`${year}-12-31T23:59:59`);
    }

    const daysInWindow = Math.max(1, Math.floor((windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24)));
    const daysSinceDeployment = Math.max(1, Math.floor((now.getTime() - DEPLOYMENT_START.getTime()) / (1000 * 60 * 60 * 24)));

    // Per-site daily rates based on pilot data
    const gallonsPerSitePerDay = 50_000;
    const tssLbsPerSitePerDay = 12.5;
    const nutrientLbsPerSitePerDay = 2.8;
    const bacteriaColoniesPerDay = 850_000;

    const totalGallons = activeSiteCount * gallonsPerSitePerDay * daysInWindow;
    const totalTSSLbs = activeSiteCount * tssLbsPerSitePerDay * daysInWindow;
    const totalNutrientLbs = activeSiteCount * nutrientLbsPerSitePerDay * daysInWindow;
    const totalBacteria = activeSiteCount * bacteriaColoniesPerDay * daysInWindow;

    // Only tick live if window includes "now"
    const isLive = impactPeriod === 'all' || parseInt(impactPeriod, 10) === now.getFullYear();
    const gallonsPerSecond = isLive ? (activeSiteCount * gallonsPerSitePerDay) / 86400 : 0;
    const tssPerSecond = isLive ? (activeSiteCount * tssLbsPerSitePerDay) / 86400 : 0;

    // Period label
    let periodLabel: string;
    if (impactPeriod === 'all') {
      periodLabel = `All time · Day ${daysSinceDeployment.toLocaleString()} since first deployment`;
    } else {
      const year = parseInt(impactPeriod, 10);
      periodLabel = year === now.getFullYear()
        ? `${year} year-to-date · ${daysInWindow} days`
        : `${year} · ${daysInWindow} days`;
    }

    return {
      activeSiteCount,
      daysInWindow,
      daysSinceDeployment,
      totalGallons,
      totalTSSLbs,
      totalNutrientLbs,
      totalBacteria,
      gallonsPerSecond,
      tssPerSecond,
      isLive,
      periodLabel,
    };
  }, [regionData, impactPeriod]);

  // Live ticking values (gallons and TSS tick every second)
  const liveGallons = useLiveTick(nationalImpact.totalGallons, nationalImpact.gallonsPerSecond);
  const liveTSS = useLiveTick(nationalImpact.totalTSSLbs, nationalImpact.tssPerSecond);

  // Format large numbers cleanly
  const formatImpactNum = (n: number, decimals = 1) => {
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(decimals)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
    return n.toLocaleString();
  };

  return (
    <div className="min-h-screen w-full relative" style={{ background: isDark
      ? 'linear-gradient(135deg, #0B0F1A 0%, #0D1526 50%, #0B1420 100%)'
      : 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 50%, #ECFDF5 100%)' }}>
      {/* Dark mode atmospheric glow */}
      {isDark && (
        <>
          <div className="pointer-events-none fixed inset-0 z-0" style={{
            background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(26,154,142,0.07) 0%, transparent 60%)',
          }} />
          <div className="pointer-events-none fixed inset-0 z-0" style={{
            background: 'radial-gradient(ellipse 60% 40% at 80% 100%, rgba(184,115,51,0.04) 0%, transparent 50%)',
          }} />
        </>
      )}
      <div className="relative z-10 mx-auto max-w-7xl p-4 space-y-6">

        {/* Toast notification */}
        {toastMsg && (
          <div className="fixed top-4 right-4 z-50 max-w-sm animate-in fade-in slide-in-from-top-2">
            <div className="rounded-xl shadow-lg p-4 flex items-start gap-3" style={{ background: 'var(--bg-card)', border: '2px solid var(--accent-teal)', color: 'var(--text-primary)' }}>
              <div style={{ color: 'var(--accent-teal)' }} className="mt-0.5">ℹ️</div>
              <div className="flex-1">
                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{toastMsg}</div>
              </div>
              <button onClick={() => setToastMsg(null)} className="text-lg leading-none" style={{ color: 'var(--text-dim)' }}>×</button>
            </div>
          </div>
        )}
        {/* ── HERO BANNER — purely informational (lens selection via sidebar) ── */}
        <HeroBanner role="national" onDoubleClick={() => props.onToggleDevMode?.()}>
            {!federalMode && (
              <Button variant="outline" onClick={onClose}>
                <X size={16} />
                <span className="ml-2">Close</span>
              </Button>
            )}
        </HeroBanner>


        {/* ── LAYOUT EDITOR WRAPPER ── */}
        <LayoutEditor ccKey="FMC">
        {({ sections, isEditMode, onToggleVisibility, onToggleCollapse, collapsedSections }) => {
          const isSectionOpen = (id: string) => !collapsedSections[id];
          return (<>
          <div className={`space-y-10 ${isEditMode ? 'pl-12' : ''}`}>

        {/* Compact impairment summary for lenses where impairmentprofile was removed */}
        {(viewLens === 'overview' || viewLens === 'compliance' || viewLens === 'monitoring') && !isEditMode && (
          <div className="flex items-center gap-2 text-xs text-slate-500 px-4 py-2 bg-slate-50 rounded-lg border border-slate-200">
            <span>National Impairment: {attainsAggregation.totalImpaired?.toLocaleString() ?? '69K'} waterbodies, {attainsAggregation.totalAssessed > 0 ? Math.round((attainsAggregation.totalImpaired / attainsAggregation.totalAssessed) * 100) : 69}% impaired</span>
            <button onClick={() => setViewLens('water-quality')} className="text-blue-600 hover:underline ml-1">
              View Details &rarr;
            </button>
          </div>
        )}

        {sections.filter(s => {
          // In edit mode, show all sections for drag-and-drop
          if (isEditMode) return true;
          // Must be visible per LayoutEditor config
          if (!s.visible) return false;
          // For lens-controlled sections, only show if the active lens includes them
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

        case 'usmap': return DS(<div className="space-y-6">
        {/* ── MONITORING NETWORK MAP ──────────────────────────────── */}

        <div ref={mapSectionRef} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Map Card */}
          <Card id="section-usmap" className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle style={{ color: 'var(--text-bright)' }}>United States Monitoring Network</CardTitle>
                <BrandedPrintBtn sectionId="usmap" title="United States Monitoring Network" />
              </div>
              <CardDescription style={{ color: 'var(--text-secondary)' }}>
                Real state outlines. Colors reflect data based on selected overlay.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Overlay Selector */}
              <div className="flex flex-wrap gap-2 pb-3">
                {OVERLAYS.filter(o => {
                  // MS4 overlay only on compliance lens
                  if (o.id === 'ms4' && viewLens !== 'compliance') return false;
                  return true;
                }).map((o) => {
                  const Icon = o.icon;
                  const isActive = overlay === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setOverlay(o.id)}
                      title={o.description}
                      className="inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
                      style={{
                        background: isActive ? 'var(--pill-bg-active)' : 'var(--pill-bg)',
                        color: isActive ? 'var(--pill-text-active)' : 'var(--pill-text)',
                        border: `1px solid ${isActive ? 'var(--pill-border-active)' : 'var(--pill-border)'}`,
                      }}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1.5" />
                      {o.label}
                    </button>
                  );
                })}
              </div>

              {!topo ? (
                <div className="text-sm text-slate-500">
                  Map data unavailable. Ensure us-atlas and topojson-client are installed.
                </div>
              ) : (
                <div className="w-full overflow-hidden rounded-lg" style={{ border: '1px solid var(--border-subtle)' }}>
                  <div className="px-3 py-2 text-[10px] flex items-center justify-between" style={{ color: 'var(--text-dim)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2">
                      <span>Click a state to select</span>
                      <SentinelStatusBadge
                        systemStatus={sentinel.systemStatus}
                        lastFetched={sentinel.lastFetched}
                        sources={sentinel.sources}
                        criticalCount={sentinel.criticalHucs.length}
                        watchCount={sentinel.watchHucs.length}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Accessibility controls */}
                      <button
                        onClick={() => setReducedMotion(m => !m)}
                        className="text-[10px] hover:underline"
                        style={{ color: 'var(--text-dim)' }}
                        title={reducedMotion ? 'Enable animations' : 'Reduce motion'}
                      >
                        {reducedMotion ? 'Motion: Off' : 'Motion: On'}
                      </button>
                      <button
                        onClick={toggleAudio}
                        className="text-[10px] hover:underline"
                        style={{ color: 'var(--text-dim)' }}
                        title={audioEnabled ? 'Disable alert audio' : 'Enable alert audio'}
                      >
                        {audioEnabled ? 'Audio: On' : 'Audio: Off'}
                      </button>
                      <button onClick={() => mapRef.current?.flyTo({ center: [US_CENTER[1], US_CENTER[0]], zoom: US_ZOOM, duration: 800 })}
                        className="text-[10px] hover:underline" style={{ color: 'var(--accent-teal)' }}>
                        Reset View
                      </button>
                    </div>
                  </div>
                  <div className={`h-[560px] w-full relative${reducedMotion ? ' sentinel-motion-off' : ''}`}>
                    <MapboxMapShell
                      center={US_CENTER}
                      zoom={US_ZOOM}
                      height="100%"
                      onMapRef={handleMapRef}
                      interactiveLayerIds={['states-choropleth-fill']}
                      onClick={handleStateClick}
                    >
                      <MapboxChoropleth
                        geoData={topo}
                        fillColorExpression={fillColorExpr}
                        selectedState={selectedState}
                        fillOpacity={0.65}
                      />
                      <SentinelAlertLayer
                        criticalHucs={sentinel.criticalHucs}
                        watchHucs={sentinel.watchHucs}
                        advisoryHucs={sentinel.advisoryHucs}
                        centroids={centroids}
                        hucNames={hucNames}
                        onHucClick={(huc8, level) => {
                          setSelectedAlertHuc(huc8);
                          setSelectedAlertLevel(level);
                        }}
                        reducedMotion={reducedMotion}
                      />
                    </MapboxMapShell>
                    {/* Sentinel alert detail panel (overlays map) */}
                    {selectedAlertHuc && (
                      <SentinelAlertPanel
                        huc8={selectedAlertHuc}
                        level={selectedAlertLevel as any}
                        hucName={hucNames[selectedAlertHuc] ?? selectedAlertHuc}
                        scoredHuc={
                          [...sentinel.criticalHucs, ...sentinel.watchHucs, ...sentinel.advisoryHucs]
                            .find(h => h.huc8 === selectedAlertHuc)
                        }
                        onClose={() => setSelectedAlertHuc(null)}
                      />
                    )}
                    {/* Screen reader announcement for new CRITICAL events */}
                    <div aria-live="assertive" className="sr-only">
                      {sentinel.newCriticalHucs.length > 0 &&
                        `Critical alert: ${sentinel.newCriticalHucs.length} new watershed${sentinel.newCriticalHucs.length > 1 ? 's' : ''} at critical level`
                      }
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {overlay === 'hotspots' && (
                      <>
                        <span className="pin-label mr-1">Risk:</span>
                        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--status-healthy)' }} /> Healthy</span>
                        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--status-warning)' }} /> Watch</span>
                        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--status-warning)' }} /> Impaired</span>
                        <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: 'var(--status-severe)' }} /> Severe</span>
                      </>
                    )}
                    {overlay === 'ms4' && (
                      <>
                        <span className="pin-label mr-1">MS4 Permits:</span>
                        {[{ label: '<10', bg: '#fed7aa' }, { label: '10–29', bg: '#fdba74' }, { label: '30–74', bg: '#fb923c' }, { label: '75–149', bg: '#f97316' }, { label: '150–299', bg: '#ea580c' }, { label: '300+', bg: '#c2410c' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'ej' && (
                      <>
                        <span className="pin-label mr-1">EJScreen:</span>
                        {[{ label: 'Low', bg: '#d1d5db' }, { label: 'Moderate', bg: '#fde68a' }, { label: 'High', bg: '#f97316' }, { label: 'Very High', bg: '#dc2626' }, { label: 'Critical', bg: '#7f1d1d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'economy' && (
                      <>
                        <span className="pin-label mr-1">Economic Exposure:</span>
                        {[{ label: 'Minimal', bg: '#d1fae5' }, { label: 'Low', bg: '#fde68a' }, { label: 'Moderate', bg: '#f59e0b' }, { label: 'Elevated', bg: '#dc2626' }, { label: 'High', bg: '#7f1d1d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'wildlife' && (
                      <>
                        <span className="pin-label mr-1">T&E Species:</span>
                        {[{ label: 'Minimal', bg: '#d1d5db' }, { label: 'Low', bg: '#bbf7d0' }, { label: 'Moderate', bg: '#22c55e' }, { label: 'High', bg: '#16a34a' }, { label: 'Very High', bg: '#14532d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'trend' && (
                      <>
                        <span className="pin-label mr-1">Trend:</span>
                        {[{ label: 'Worsening', bg: 'var(--status-severe)' }, { label: 'Stable', bg: '#9ca3af' }, { label: 'Improving', bg: 'var(--status-healthy)' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'coverage' && (
                      <>
                        <span className="pin-label mr-1">Coverage:</span>
                        {[{ label: 'None', bg: '#d1d5db' }, { label: 'Ambient', bg: '#fde68a' }, { label: 'Treatment', bg: '#22c55e' }, { label: 'Full', bg: '#14532d' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                    {overlay === 'indices' && (
                      <>
                        <span className="pin-label mr-1">Composite Risk:</span>
                        {[{ label: 'Low (0-33)', bg: '#22c55e' }, { label: 'Moderate (34-49)', bg: '#fbbf24' }, { label: 'Elevated (50-66)', bg: '#f59e0b' }, { label: 'High (67-100)', bg: '#dc2626' }].map(s => (
                          <span key={s.label} className="inline-flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-dim)' }}><span className="w-2 h-2 rounded-sm" style={{ background: s.bg }} /> {s.label}</span>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* State Detail Panel */}
          <Card style={{ background: 'var(--bg-card)' }}>
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin size={15} className="flex-shrink-0" style={{ color: 'var(--text-dim)' }} />
                <select
                  value={selectedState}
                  onChange={(e) => { setSelectedState(e.target.value); setWaterbodySearch(''); setWaterbodyFilter('all'); setShowAllWaterbodies(false); }}
                  className="px-2 py-1 rounded-md text-sm font-semibold cursor-pointer focus:outline-none"
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-teal-glow)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                    <option key={abbr} value={abbr}>{name} ({abbr})</option>
                  ))}
                </select>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 px-5 pb-5">
              {/* Quick stats — compact, subordinate to national summary */}
              {(() => {
                const assessedCount = selectedStateRegions.filter(r => r.status === 'assessed').length;
                const monitoredCount = selectedStateRegions.filter(r => r.status === 'monitored').length;
                const unmonitoredCount = selectedStateRegions.filter(r => r.status === 'unmonitored').length;
                const severeCount = selectedStateRegions.filter(r => r.status === 'assessed' && r.alertLevel === 'high').length;
                return (
                  <div className="flex items-baseline justify-between gap-3 py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div className="text-center">
                      <div className="pin-stat-value text-base">{selectedStateRegions.length}</div>
                      <div className="pin-label mt-0.5">Total</div>
                    </div>
                    <div className="text-center">
                      <div className="pin-stat-secondary text-sm">{assessedCount}</div>
                      <div className="pin-label mt-0.5">Assessed</div>
                    </div>
                    <div className="text-center">
                      <div className="pin-stat-secondary text-sm">{monitoredCount}</div>
                      <div className="pin-label mt-0.5">Monitored</div>
                    </div>
                    <div className="text-center">
                      <div className="pin-stat-secondary text-sm" style={{ color: 'var(--text-dim)' }}>{unmonitoredCount}</div>
                      <div className="pin-label mt-0.5">No Data</div>
                    </div>
                  </div>
                );
              })()}

              {/* Waterbody Filters */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  { key: 'all' as const, label: 'All' },
                  { key: 'impaired' as const, label: 'Impaired' },
                  { key: 'severe' as const, label: 'Severe' },
                  { key: 'monitored' as const, label: 'Monitored' },
                ].map((f) => {
                  const isActive = waterbodyFilter === f.key;
                  return (
                  <button
                    key={f.key}
                    onClick={() => { setWaterbodyFilter(f.key); setShowAllWaterbodies(false); }}
                    className="pin-label rounded-full transition-all"
                    style={{
                      padding: '3px 10px',
                      background: isActive ? 'var(--pill-bg-active)' : 'var(--pill-bg)',
                      color: isActive ? 'var(--pill-text-active)' : 'var(--pill-text)',
                      border: `1px solid ${isActive ? 'var(--pill-border-active)' : 'var(--pill-border)'}`,
                    }}
                  >
                    {f.label}
                    {f.key !== 'all' && (() => {
                      const count = f.key === 'impaired'
                        ? selectedStateRegions.filter(r => r.status === 'assessed' && (r.alertLevel === 'high' || r.alertLevel === 'medium')).length
                        : f.key === 'severe'
                        ? selectedStateRegions.filter(r => r.status === 'assessed' && r.alertLevel === 'high').length
                        : selectedStateRegions.filter(r => r.status === 'monitored').length;
                      return count > 0 ? ` (${count})` : '';
                    })()}
                  </button>
                  );
                })}
              </div>

              {/* Waterbody list — height matched to US map (560px) */}
              <div className="space-y-1.5 max-h-[560px] overflow-y-auto">
                {selectedStateRegions.length === 0 ? (
                  <div className="text-sm py-4 text-center" style={{ color: 'var(--text-secondary)' }}>
                    No monitored waterbodies in this state yet.
                    <div className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>Click a colored state on the map to explore.</div>
                  </div>
                ) : (
                  <>
                    {selectedStateRegions.length > 10 && (
                      <div className="mb-2">
                        <input
                          type="text"
                          placeholder="Search waterbodies..."
                          value={waterbodySearch}
                          onChange={(e) => { setWaterbodySearch(e.target.value); setShowAllWaterbodies(false); }}
                          className="w-full px-2 py-1.5 text-sm rounded-md focus:outline-none"
                          style={{ background: 'var(--bg-input)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', boxShadow: 'none' }}
                          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; e.currentTarget.style.boxShadow = '0 0 0 2px var(--accent-teal-glow)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <div className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
                          {filteredStateRegions.length} of {selectedStateRegions.length} waterbodies
                        </div>
                      </div>
                    )}
                    {displayedRegions.map((r) => {
                    const isActive = r.id === activeDetailId;
                    return (
                    <div key={r.id} className="flex items-center justify-between p-2 cursor-pointer transition-colors"
                      style={{
                        borderRadius: '10px',
                        border: `1px solid ${isActive ? 'var(--accent-teal)' : 'var(--border-subtle)'}`,
                        background: isActive ? 'var(--accent-teal-glow)' : 'transparent',
                        boxShadow: isActive ? '0 0 0 1px var(--accent-teal)' : 'none',
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => handleRegionClick(r.id)}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium" style={{ color: isActive ? 'var(--accent-teal)' : 'var(--text-primary)' }}>{r.name}</div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)' }}>
                          {r.status === 'assessed' ? (
                            <span className="inline-flex items-center gap-1 rounded-full" style={{
                              padding: '2px 8px',
                              fontSize: '10px',
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                              background: r.alertLevel === 'high' ? 'var(--status-severe-bg)' : r.alertLevel === 'medium' ? 'var(--status-impaired-bg)' : r.alertLevel === 'low' ? 'var(--status-watch-bg)' : 'var(--status-healthy-bg)',
                              color: r.alertLevel === 'high' ? 'var(--status-severe)' : r.alertLevel === 'medium' ? 'var(--status-impaired)' : r.alertLevel === 'low' ? 'var(--status-watch)' : 'var(--status-healthy)',
                            }}>
                              {r.alertLevel === 'high' ? 'Severe' : r.alertLevel === 'medium' ? 'Impaired' : r.alertLevel === 'low' ? 'Watch' : 'Healthy'}
                            </span>
                          ) : r.status === 'monitored' ? (
                            <span className="inline-flex items-center gap-1 rounded-full" style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', background: 'var(--accent-teal-glow)', color: 'var(--accent-teal)' }}>
                              ◐ {r.dataSourceCount} source{r.dataSourceCount !== 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full" style={{ padding: '2px 8px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', background: 'var(--bg-hover)', color: 'var(--text-dim)' }}>
                              — Unmonitored
                            </span>
                          )}
                          {r.activeAlerts > 0 && <span style={{ color: 'var(--text-dim)' }}>{r.activeAlerts} alert{r.activeAlerts !== 1 ? 's' : ''}</span>}
                          {r.status === 'assessed' && (
                            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>EPA ATTAINS</span>
                          )}
                          {r.status === 'monitored' && r.dataSourceCount > 0 && (
                            <span style={{ fontSize: '9px', color: 'var(--text-dim)' }}>USGS/WQP</span>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0 mr-1" />
                      )}
                    </div>
                    );
                  })}
                  {filteredStateRegions.length > DISPLAY_LIMIT && !showAllWaterbodies && (
                    <button
                      onClick={() => setShowAllWaterbodies(true)}
                      className="w-full py-2 text-xs rounded-md transition-colors"
                      style={{ color: 'var(--accent-teal)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Show all {filteredStateRegions.length} waterbodies
                    </button>
                  )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

        </div>

        {/* ── AI INSIGHTS — hidden in overview & monitoring lenses ── */}
        {viewLens !== 'monitoring' && viewLens !== 'overview' && (
          <AIInsightsEngine key={selectedState} role="Federal" stateAbbr={selectedState} regionData={selectedStateRegions as any} />
        )}

        {/* ── MS4 & REGULATORY — Compact vertical card ────── */}
        {viewLens !== 'monitoring' && viewLens !== 'overview' && (() => {
          const ms4 = MS4_JURISDICTIONS[selectedState];
          const ov = overlayByState.get(selectedState);
          if (!ms4 && !ov) return null;
          const total = ms4 ? ms4.phase1 + ms4.phase2 : 0;
          const trendVal = ov?.trend ?? 0;
          const trendLabel = trendVal > 5 ? 'Improving' : trendVal < -5 ? 'Worsening' : 'Stable';
          const trendIsWorsening = trendVal < -5;
          return (
            <Card className="lg:max-w-[280px]">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Building2 size={13} style={{ color: 'var(--text-dim)' }} />
                  <span className="pin-section-label" style={{ fontSize: '10px' }}>MS4 & Regulatory</span>
                </div>
                <div className="space-y-1.5">
                  {ms4 && (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">Permits</span>
                        <span className="pin-stat-secondary text-sm">{total}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">Phase I / II</span>
                        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{ms4.phase1} / {ms4.phase2}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="pin-label">Program</span>
                    <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{STATE_AGENCIES[selectedState]?.ms4Program || 'NPDES MS4'}</span>
                  </div>
                  {ov && (
                    <>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">EJ Index</span>
                        <span className="pin-stat-secondary text-sm">{ov.ej}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="pin-label">WQ Trend</span>
                        <span className="text-xs font-semibold" style={{ color: trendIsWorsening ? 'var(--status-severe)' : 'var(--text-dim)' }}>{trendLabel}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}

        {/* ── STATE WATERBODY INSPECTOR + NATIONAL IMPAIRMENT PROFILE ────── */}
        {viewLens !== 'monitoring' && (() => {
          const wbRow = stateRollup.find(r => r.abbr === selectedState);
          const wbRegion = getEpaRegionForState(selectedState);
          const showNationalProfile = viewLens === 'overview' && attainsAggregation.totalAssessed > 0;
          return (
            <div className={showNationalProfile ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : undefined}>
            <Card>
              <CardContent className="px-5 pt-4">
                {!wbRow || !wbRow.canGradeState ? (
                  <p className="text-sm italic" style={{ color: 'var(--text-dim)' }}>
                    {wbRow ? `Insufficient data for ${wbRow.name}.` : 'Select a state from the map above.'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {/* Title line: state name + grade + info + print */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold border ${wbRow.grade.bg} ${wbRow.grade.color}`}>
                          {wbRow.grade.letter}
                        </span>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-bright)' }}>{wbRow.name}</p>
                          <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>{wbRow.score}/100 · {wbRow.dataSource === 'per-waterbody' ? 'Per-Waterbody' : 'ATTAINS Bulk'} · EPA Region {wbRegion}</p>
                        </div>
                        <div className="relative">
                          <button
                            onClick={(e) => { e.stopPropagation(); setShowMethodology(!showMethodology); }}
                            className="p-0.5 rounded-full transition-colors"
                            style={{ color: 'var(--text-dim)' }}
                            title="Grading methodology"
                          >
                            <Info size={13} />
                          </button>
                          {showMethodology && (
                            <div className="absolute left-0 top-full mt-2 w-72 z-50 rounded-lg p-3 text-xs space-y-1.5"
                              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', boxShadow: 'var(--shadow-elevated)', color: 'var(--text-secondary)' }}
                              onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-xs" style={{ color: 'var(--text-bright)' }}>Grading Methodology</span>
                                <button onClick={() => setShowMethodology(false)} className="p-0.5 rounded" style={{ color: 'var(--text-dim)' }}><X size={12} /></button>
                              </div>
                              <p><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Base score</span> from parameter readings vs. regulatory targets.</p>
                              <p><span className="font-medium" style={{ color: 'var(--text-primary)' }}>Adjustments</span> for data freshness, active alerts, and ATTAINS status.</p>
                              <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Scale: A+ (97+) · A (93) · B (83) · C (73) · D (63) · F (&lt;60)</p>
                              <p className="text-[9px] italic pt-1" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>Informational only — not an official EPA/state assessment.</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <BrandedPrintBtn sectionId="waterbody-inspector-inline" title="Waterbody Assessment" />
                    </div>

                    {/* Top 4 numbers — hero is Total Impaired, Cat 5 gets red if nonzero */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="pin-stat-tile">
                        <div className="pin-stat-secondary text-base">{wbRow.waterbodies.toLocaleString()}</div>
                        <div className="pin-label mt-0.5">Total</div>
                      </div>
                      <div className="pin-stat-tile">
                        <div className="pin-stat-secondary text-base">{wbRow.assessed.toLocaleString()}</div>
                        <div className="pin-label mt-0.5">Assessed</div>
                      </div>
                      <div className="pin-stat-tile">
                        <div className="pin-stat-hero text-xl">{wbRow.totalImpaired.toLocaleString()}</div>
                        <div className="pin-label mt-0.5">Impaired</div>
                      </div>
                      <div className="pin-stat-tile">
                        <div className="pin-stat-value text-base" style={{ color: wbRow.cat5 > 0 ? 'var(--status-severe)' : 'var(--text-bright)' }}>{wbRow.cat5.toLocaleString()}</div>
                        <div className="pin-label mt-0.5">Cat 5</div>
                      </div>
                    </div>

                    {/* Impairment categories — quiet, report-row feel */}
                    <div>
                      <h4 className="pin-section-label mb-2">Impairment Categories</h4>
                      <div className="space-y-1">
                        {[
                          { label: 'Cat 5 — Needs TMDL', value: wbRow.cat5 },
                          { label: 'Cat 4A — TMDL Complete', value: wbRow.cat4a },
                          { label: 'Cat 4B — Other Control', value: wbRow.cat4b },
                          { label: 'Cat 4C — Not Pollutant', value: wbRow.cat4c },
                        ].map(c => (
                          <div key={c.label} className="flex items-center justify-between py-1" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
                            <span className="pin-stat-secondary text-xs">{c.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top causes — report-table feel */}
                    {wbRow.topCauses.length > 0 && (
                      <div>
                        <h4 className="pin-section-label mb-2">Top Impairment Causes</h4>
                        <div className="space-y-0.5">
                          {wbRow.topCauses.slice(0, 8).map((tc, i) => (
                            <div key={tc.cause} className="flex items-center gap-2 text-xs py-0.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <span className="w-4 text-right" style={{ color: 'var(--text-dim)' }}>{i + 1}.</span>
                              <span className="flex-1" style={{ color: 'var(--text-secondary)' }}>{tc.cause}</span>
                              <span className="pin-stat-secondary text-xs">{tc.count.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Monitoring coverage — muted bars, neutral tiles */}
                    <div>
                      <h4 className="pin-section-label mb-2">Monitoring Coverage</h4>
                      <div className="flex items-baseline gap-4 mb-2">
                        <div className="text-center">
                          <span className="pin-stat-secondary text-sm">{wbRow.monitored.toLocaleString()}</span>
                          <span className="pin-label ml-1">monitored</span>
                        </div>
                        <div className="text-center">
                          <span className="pin-stat-secondary text-sm">{wbRow.assessed.toLocaleString()}</span>
                          <span className="pin-label ml-1">assessed</span>
                        </div>
                        <div className="text-center">
                          <span className="pin-stat-secondary text-sm">{wbRow.unmonitored.toLocaleString()}</span>
                          <span className="pin-label ml-1">unmonitored</span>
                        </div>
                      </div>
                      {wbRow.waterbodies > 0 && (
                        <div className="h-1.5 rounded-full overflow-hidden flex" style={{ background: 'var(--border-subtle)' }}>
                          <div style={{ width: `${(wbRow.monitored / wbRow.waterbodies * 100).toFixed(1)}%`, background: 'var(--status-healthy)', opacity: 0.5 }} />
                          <div style={{ width: `${(wbRow.assessed / wbRow.waterbodies * 100).toFixed(1)}%`, background: 'var(--text-dim)', opacity: 0.3 }} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

              {/* ── NATIONAL IMPAIRMENT PROFILE (overview only, beside inspector) ── */}
              {showNationalProfile && (
                <Card>
                  <CardContent className="px-5 pt-4">
                    <div className="space-y-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>National Impairment Profile</p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-dim)' }}>{attainsAggregation.totalAssessed.toLocaleString()} waterbodies from EPA ATTAINS</p>
                        </div>
                        <BrandedPrintBtn sectionId="impairmentprofile" title="Impairment Profile" />
                      </div>

                      {/* Top Impairment Causes */}
                      <div>
                        <div className="pin-section-label mb-2">Top Impairment Causes</div>
                        <div className="space-y-1">
                          {attainsAggregation.topCauses.slice(0, 7).map((c, i) => {
                            const maxCount = attainsAggregation.topCauses[0]?.count || 1;
                            const pct = (c.count / maxCount) * 100;
                            return (
                              <div key={i} className="flex items-center gap-2">
                                <div className="w-[110px] text-[10px] truncate" style={{ color: 'var(--text-dim)' }} title={c.cause}>{c.cause}</div>
                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--text-dim)', opacity: 0.35 }} />
                                </div>
                                <div className="text-[10px] w-[48px] text-right pin-stat-secondary">{c.count.toLocaleString()}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* EPA Assessment Categories */}
                      <div>
                        <div className="pin-section-label mb-2">EPA Assessment Categories</div>
                        <div className="space-y-1">
                          {[
                            { cat: '5', label: 'Cat 5 — No TMDL', count: attainsAggregation.cat5, color: 'var(--status-severe)', opacity: 0.5 },
                            { cat: '4A', label: 'Cat 4a — TMDL', count: attainsAggregation.cat4a, color: 'var(--status-warning)', opacity: 0.4 },
                            { cat: '4B', label: 'Cat 4b — Alt. Ctrl', count: attainsAggregation.cat4b, color: 'var(--status-warning)', opacity: 0.3 },
                            { cat: '4C', label: 'Cat 4c — Non-pollut.', count: attainsAggregation.cat4c, color: 'var(--text-dim)', opacity: 0.4 },
                            { cat: '3', label: 'Cat 3 — No Data', count: attainsAggregation.catCounts['3'], color: 'var(--text-dim)', opacity: 0.3 },
                            { cat: '2', label: 'Cat 2 — Concerns', count: attainsAggregation.catCounts['2'], color: 'var(--status-healthy)', opacity: 0.3 },
                            { cat: '1', label: 'Cat 1 — Good', count: attainsAggregation.catCounts['1'], color: 'var(--status-healthy)', opacity: 0.4 },
                          ].filter(r => r.count > 0).map(r => {
                            const pct = attainsAggregation.totalAssessed > 0 ? (r.count / attainsAggregation.totalAssessed) * 100 : 0;
                            return (
                              <div key={r.cat} className="flex items-center gap-2">
                                <div className="w-[110px] text-[10px] truncate" style={{ color: 'var(--text-dim)' }}>{r.label}</div>
                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                                  <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: r.color, opacity: r.opacity }} />
                                </div>
                                <div className="text-[10px] w-[48px] text-right pin-stat-secondary">{r.count.toLocaleString()}</div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-2 pt-2 text-[10px]" style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>
                          TMDL Gap: <span className="pin-stat-secondary" style={attainsAggregation.tmdlGapPct > 50 ? { color: 'var(--status-severe)' } : undefined}>{attainsAggregation.tmdlGapPct}%</span> of impaired lack approved TMDL
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          );
        })()}

        {/* ── RESTORATION PLAN — Standalone collapsible card ────── */}
        {lens.showRestorationPlan && activeDetailId && (() => {
          const nccRegion = regionData.find(r => r.id === activeDetailId);
          const regionConfig = getRegionById(activeDetailId);
          const regionName = regionConfig?.name || nccRegion?.name || activeDetailId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const stateAbbr = nccRegion?.state || '';
          const level = nccRegion?.alertLevel || 'none';

          // ── Water data params ──
          const params = waterData?.parameters ?? {};

          // ── ATTAINS data (per-waterbody AND bulk — always resolve both for worst-case comparison) ──
          const attainsData = attainsCache[activeDetailId];
          const bulkAttains = (() => {
            const stateData = attainsBulk[stateAbbr];
            if (!stateData) return null;
            const normName = regionName.toLowerCase().replace(/,.*$/, '').trim();
            return stateData.find(a => {
              const aN = a.name.toLowerCase().trim();
              return aN.includes(normName) || normName.includes(aN);
            }) || null;
          })();
          // ── Resolve ATTAINS category & causes using shared helpers ──
          const attainsCategory = resolveAttainsCategory(
            attainsData?.category || '',
            bulkAttains?.category || '',
            level as any,
          );
          const attainsCauses = mergeAttainsCauses(
            attainsData?.causes || [],
            bulkAttains?.causes || [],
          );
          const attainsCycle = attainsData?.cycle || bulkAttains?.cycle || '';

          // ── Compute full restoration plan via engine ──
          const plan = computeRestorationPlan({
            regionName,
            stateAbbr,
            alertLevel: level as any,
            params,
            attainsCategory,
            attainsCauses,
            attainsCycle,
            attainsAcres: (attainsData as any)?.acres ?? (bulkAttains as any)?.acres ?? null,
          });

          // Destructure everything the JSX needs
          const {
            waterType, isCat5, isImpaired, tmdlStatus,
            impairmentClassification, tier1Count, tier2Count, tier3Count,
            totalClassified, pearlAddressable, addressabilityPct,
            hasNutrients, hasBacteria, hasSediment, hasMetals, hasStormwaterMetals,
            hasMercury, hasPFAS, hasPCBs, hasTemperature, hasHabitat, hasTrash,
            hasOrganic, hasDOImpairment,
            doSeverity, bloomSeverity, turbiditySeverity, nutrientSeverity,
            nutrientExceedsBiofilt, bacteriaElevated,
            isMD, thresholdSource, thresholdSourceShort,
            doCritical, doStressed, chlBloom, chlSignificant, chlSevere,
            turbElevated, turbImpaired,
            doVal, chlVal, turbVal, tnVal, tpVal,
            siteSeverityScore, siteSeverityLabel, siteSeverityColor,
            doScore, bloomScore, turbScore, impairScore, monitoringGapScore,
            treatmentPriorities, categories,
            pearlModel, totalBMPs, compliancePathway,
            totalQuads, totalUnits, phase1Quads, phase1Units, isPhasedDeployment,
            phase1AnnualCost, fullAnnualCost, phase1GPM, fullGPM,
            sizingBasis, estimatedAcres, acresSource,
            dataAgeDays, dataConfidence,
            threats, whyBullets, isHealthy,
          } = plan;
          const prelimSeverity = siteSeverityScore; // compat alias
          const severityMultiplier = siteSeverityScore; // compat alias

          if (isHealthy) {
            return (
              <Card className="border-2 border-green-300 shadow-md">
                <div className="px-4 py-4 flex items-center gap-3">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="text-sm font-semibold text-green-800">
                      {regionName} — No Restoration Action Indicated
                    </div>
                    <div className="text-xs text-green-600 mt-0.5">
                      This waterbody is currently attaining designated uses with no Category 4/5 impairments or parameter exceedances detected.
                      ALIA monitoring recommended for early warning and baseline documentation.
                    </div>
                  </div>
                </div>
              </Card>
            );
          }

          return (
            <Card className="border-2 border-cyan-300 shadow-md">
              {/* Collapsed summary header — always visible */}
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
                      {pearlModel} × {totalUnits} unit{totalUnits > 1 ? 's' : ''} ({totalQuads} quad{totalQuads > 1 ? 's' : ''}, {fullGPM} GPM) + {totalBMPs} BMPs · {waterType === 'brackish' ? '🦪 Oyster' : '🐚 Mussel'} Biofilt · {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr
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
                  {(() => {
                    return (
                      <div className="rounded-lg border-2 border-slate-300 bg-white p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">Executive Summary</div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${siteSeverityColor}`}>
                            Site Severity: {siteSeverityLabel} ({siteSeverityScore}/100)
                          </span>
                        </div>

                        {/* Severity score breakdown bar */}
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
                          {/* Severity bar */}
                          <div className="w-full bg-slate-200 rounded-full h-2 mt-1">
                            <div className={`h-2 rounded-full transition-all ${siteSeverityScore >= 75 ? 'bg-red-500' : siteSeverityScore >= 50 ? 'bg-amber-500' : siteSeverityScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, siteSeverityScore)}%` }} />
                          </div>
                          <div className="text-[9px] text-slate-400">Composite: DO (25%) + Bloom/Nutrients (25%) + Turbidity (15%) + Impairment (20%) + Monitoring Gap (15%) | Thresholds: {thresholdSource}</div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Situation */}
                          <div className="rounded-md bg-slate-50 border border-slate-200 p-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Situation</div>
                            <div className="space-y-1 text-xs text-slate-700 leading-relaxed">
                              <div><span className="font-semibold">{regionName}</span> is {isCat5 ? 'Category 5 impaired' : attainsCategory.includes('4') ? 'Category 4 impaired' : isImpaired ? 'impaired' : 'under monitoring'}{attainsCauses.length > 0 ? ` for ${attainsCauses.join(', ').toLowerCase()}` : ''}.</div>
                              {dataAgeDays !== null && <div>Most recent data is <span className="font-semibold">{dataAgeDays} days old</span>. Confidence is <span className={`font-semibold ${dataConfidence === 'low' ? 'text-red-600' : dataConfidence === 'moderate' ? 'text-amber-600' : 'text-green-600'}`}>{dataConfidence}</span>.</div>}
                              <div>{tmdlStatus === 'needed' ? 'No approved TMDL is in place.' : tmdlStatus === 'completed' ? 'An approved TMDL exists.' : tmdlStatus === 'alternative' ? 'Alternative controls are in place.' : 'TMDL status is not applicable.'}</div>
                            </div>
                          </div>

                          {/* Treatment Priorities */}
                          <div className="rounded-md bg-red-50 border border-red-200 p-3">
                            <div className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1.5">Treatment Priorities</div>
                            <div className="space-y-1 text-xs text-red-800 leading-relaxed">
                              {treatmentPriorities.length > 0 ? treatmentPriorities.slice(0, 3).map((tp, i) => (
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

                          {/* Plan */}
                          <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                            <div className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1.5">Plan</div>
                            <div className="space-y-1 text-xs text-blue-800 leading-relaxed">
                              <div>Layered approach:</div>
                              <div className="pl-2 space-y-0.5 text-[11px]">
                                <div>→ Upstream BMPs and source control</div>
                                <div>→ Nature-based restoration for long-term recovery</div>
                                <div>→ Community programs for compliance and stewardship</div>
                                <div>→ <span className="font-semibold">ALIA for immediate treatment and real-time verification</span></div>
                              </div>
                            </div>
                          </div>

                          {/* Why ALIA First */}
                          <div className="rounded-md bg-cyan-50 border-2 border-cyan-300 p-3">
                            <div className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider mb-1.5">Why ALIA First</div>
                            <div className="space-y-1.5 text-xs text-cyan-900 leading-relaxed">
                              {dataAgeDays !== null && dataAgeDays > 30 && (
                                <div><span className="font-semibold text-red-700">Data is {dataAgeDays} days old.</span> ALIA restores continuous, compliance-grade monitoring.</div>
                              )}
                              {treatmentPriorities.length > 0 && treatmentPriorities[0].urgency === 'immediate' && (
                                <div><span className="font-semibold text-red-700">{treatmentPriorities[0].driver.charAt(0).toUpperCase() + treatmentPriorities[0].driver.slice(1).split('(')[0].trim()}.</span> ALIA provides immediate treatment.</div>
                              )}
                              {treatmentPriorities.length > 0 && treatmentPriorities[0].urgency !== 'immediate' && (
                                <div><span className="font-semibold">{hasBacteria ? 'Pathogen risk is elevated' : hasNutrients ? 'Nutrient loading is degrading habitat' : hasSediment ? 'Sediment is impairing aquatic life' : 'Conditions are deteriorating'}.</span> ALIA begins treatment immediately.</div>
                              )}
                              <div><span className="font-semibold">Long-term restoration takes years.</span> ALIA delivers measurable results in weeks.</div>
                            </div>
                          </div>
                        </div>

                        {/* Action line */}
                        <div className="rounded-md bg-cyan-700 text-white px-4 py-2.5">
                          <div className="text-xs font-semibold">
                            Recommended next step: Deploy {isPhasedDeployment ? `Phase 1 (${phase1Units} unit${phase1Units > 1 ? 's' : ''}, ${phase1GPM} GPM)` : `${totalUnits} ALIA unit${totalUnits > 1 ? 's' : ''}`} at {regionName} and begin continuous monitoring within 30 days.
                          </div>
                          <div className="text-[10px] text-cyan-200 mt-1">
                            Typical deployment: 30-60 days. Pilot generates continuous data and measurable reductions within the first operating cycle.
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* ═══ IMPAIRMENT CLASSIFICATION — What ALIA Can/Can't Address ═══ */}
                  {impairmentClassification.length > 0 && (
                    <div className="rounded-lg border-2 border-slate-300 bg-white p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                          Impairment Classification
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className={`font-bold px-2 py-0.5 rounded-full ${
                            addressabilityPct >= 80 ? 'bg-green-200 text-green-800' :
                            addressabilityPct >= 50 ? 'bg-amber-200 text-amber-800' :
                            'bg-red-200 text-red-800'
                          }`}>
                            ALIA addresses {pearlAddressable} of {totalClassified} impairment{totalClassified !== 1 ? 's' : ''} ({addressabilityPct}%)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {/* Tier 1 */}
                        {impairmentClassification.filter(i => i.tier === 1).length > 0 && (
                          <div className="text-[10px] font-bold text-green-700 uppercase tracking-wider mt-1">Tier 1 — ALIA Primary Target</div>
                        )}
                        {impairmentClassification.filter(i => i.tier === 1).map((item, i) => (
                          <div key={`t1-${i}`} className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-green-50 border border-green-100">
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-green-900">{item.cause}</span>
                              <span className="text-green-700 ml-1">— {item.pearlAction}</span>
                            </div>
                          </div>
                        ))}

                        {/* Tier 2 */}
                        {impairmentClassification.filter(i => i.tier === 2).length > 0 && (
                          <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mt-2">Tier 2 — ALIA Contributes / Planned</div>
                        )}
                        {impairmentClassification.filter(i => i.tier === 2).map((item, i) => (
                          <div key={`t2-${i}`} className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-amber-50 border border-amber-100">
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-amber-900">{item.cause}</span>
                              <span className="text-amber-700 ml-1">— {item.pearlAction}</span>
                            </div>
                          </div>
                        ))}

                        {/* Tier 3 */}
                        {impairmentClassification.filter(i => i.tier === 3).length > 0 && (
                          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-2">Tier 3 — Outside ALIA Scope</div>
                        )}
                        {impairmentClassification.filter(i => i.tier === 3).map((item, i) => (
                          <div key={`t3-${i}`} className="flex items-start gap-2 text-xs py-1 px-2 rounded bg-slate-50 border border-slate-200">
                            <span className="flex-shrink-0">{item.icon}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-semibold text-slate-700">{item.cause}</span>
                              <span className="text-slate-500 ml-1">— {item.pearlAction}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-100">
                        Classification based on EPA ATTAINS impairment causes and ALIA treatment train capabilities. Tier 1: directly treated. Tier 2: indirect benefit or planned module. Tier 3: requires different intervention.
                      </div>
                    </div>
                  )}

                  {/* ═══ ALIA — IMMEDIATE IMPACT LAYER (elevated, shown first) ═══ */}
                  {(() => {
                    const pearlCat = categories.find(c => c.id === 'pearl');
                    if (!pearlCat) return null;
                    const warranted = pearlCat.modules.filter(m => m.status === 'warranted');
                    const accelerators = pearlCat.modules.filter(m => m.status === 'accelerator');
                    const coBenefits = pearlCat.modules.filter(m => m.status === 'co-benefit');

                    return (
                      <div className="rounded-lg border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-blue-50 p-3 space-y-3 shadow-md">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold text-cyan-900 uppercase tracking-wide flex items-center gap-2">
                            ⚡ Fastest Path to Measurable Results
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px]">
                            {warranted.length > 0 && <span className="bg-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded-full">{warranted.length} warranted</span>}
                            <span className="bg-cyan-200 text-cyan-800 font-bold px-1.5 py-0.5 rounded-full">{totalQuads}Q / {totalUnits} units / {fullGPM} GPM</span>
                          </div>
                        </div>

                        {/* Why ALIA here — dynamic evidence box */}
                        <div className="rounded-md border border-cyan-300 bg-white p-3 space-y-2">
                          <div className="text-[10px] font-bold text-cyan-800 uppercase tracking-wider">Why ALIA at this site</div>
                          <div className="space-y-1.5">
                            {whyBullets.map((b, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="text-sm flex-shrink-0 mt-0.5">{b.icon}</span>
                                <div className="text-[11px] leading-relaxed">
                                  <span className="text-red-700 font-medium">{b.problem}.</span>{' '}
                                  <span className="text-cyan-800">→ {b.solution}.</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* ALIA modules */}
                        <div className="space-y-1">
                          {[...warranted, ...accelerators].map((t) => (
                            <div key={t.id} className={`rounded-md border p-2 ${t.color}`}>
                              <div className="flex items-start gap-2">
                                <span className="text-sm flex-shrink-0">{t.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">{t.label}</span>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                      t.status === 'warranted' ? 'bg-red-200 text-red-800' : 'bg-cyan-200 text-cyan-800'
                                    }`}>{t.status === 'warranted' ? 'WARRANTED' : 'ALIA'}</span>
                                  </div>
                                  <div className="text-[10px] mt-0.5 leading-relaxed opacity-90">{t.detail}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {coBenefits.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {coBenefits.map((t) => (
                                <span key={t.id} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-white/70 border border-slate-200 rounded px-2 py-1" title={t.detail}>
                                  {t.icon} {t.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* System config + sizing */}
                        <div className="rounded-md bg-white border border-cyan-200 p-3 space-y-2">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase">Configuration</div>
                              <div className="text-sm font-bold text-cyan-800">{pearlModel}</div>
                              <div className="text-[10px] text-slate-500">{waterType === 'brackish' ? 'Oyster' : 'Mussel'} Biofilt{categories.find(c => c.id === 'pearl')?.modules.some(t => t.id.startsWith('pearl-resin')) ? ' + Resin' : ''}{categories.find(c => c.id === 'pearl')?.modules.some(t => t.id === 'pearl-uv') ? ' + UV' : ''}{categories.find(c => c.id === 'pearl')?.modules.some(t => t.id === 'pearl-gac') ? ' + GAC' : ''}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase">Full Build Target</div>
                              <div className="text-sm font-bold text-cyan-800">{totalQuads} quad{totalQuads > 1 ? 's' : ''} ({totalUnits} units)</div>
                              <div className="text-[10px] text-slate-500">{fullGPM} GPM total capacity</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase">Full Build Annual</div>
                              <div className="text-sm font-bold text-cyan-800">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr</div>
                              <div className="text-[10px] text-slate-500">$200K/unit/yr</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase">Sizing Basis</div>
                              <div className={`text-xs font-semibold ${siteSeverityScore >= 75 ? 'text-red-700' : siteSeverityScore >= 50 ? 'text-amber-700' : 'text-slate-700'}`}>Severity {prelimSeverity}/100</div>
                              <div className="text-[10px] text-slate-500">{sizingBasis}</div>
                            </div>
                          </div>
                        </div>

                        {/* ═══ DEPLOYMENT ROADMAP ═══ */}
                        {isPhasedDeployment && (() => {
                          // Each quad targets a ranked critical zone. Every ALIA unit treats AND monitors.
                          // Monitoring continuity & verification is universal -- not unique to any single phase.
                          type PhaseInfo = { phase: string; quads: number; units: number; gpm: number; cost: number; mission: string; placement: string; why: string; trigger: string; color: string; bgColor: string };
                          const phases: PhaseInfo[] = [];
                          const hasMonitoringGap = dataAgeDays === null || dataAgeDays > 365;
                          const monitoringNote = hasMonitoringGap
                            ? `+ Monitoring continuity & verification (restores data record lost for ${dataAgeDays !== null ? Math.round(dataAgeDays / 365) + '+ year' + (Math.round(dataAgeDays / 365) > 1 ? 's' : '') : 'an extended period'})`
                            : '+ Continuous monitoring, compliance-grade data & treatment verification';

                          // ── PHASE 1: #1 most critical zone ──
                          const p1Mission = (hasNutrients || bloomSeverity !== 'normal')
                            ? 'Primary Nutrient Interception'
                            : hasBacteria ? 'Primary Pathogen Treatment'
                            : hasSediment ? 'Primary Sediment Capture'
                            : 'Primary Treatment & Monitoring';

                          const p1Placement = (hasNutrients || bloomSeverity !== 'normal')
                            ? '#1 critical zone: Highest-load tributary confluence -- intercept nutrient and sediment loading at the dominant inflow before it reaches the receiving waterbody'
                            : hasBacteria ? '#1 critical zone: Highest-volume discharge point -- treat pathogen loading at the primary outfall or CSO'
                            : hasSediment ? '#1 critical zone: Primary tributary mouth -- capture suspended solids at the highest-load inflow'
                            : '#1 critical zone: Highest-priority inflow -- treat and monitor at the most impacted location';

                          const p1Why = bloomSeverity !== 'normal' && bloomSeverity !== 'unknown'
                            ? `Chlorophyll at ${chlVal} ug/L confirms active bloom cycle. #1 priority -- intercept nutrients at the dominant source before they drive downstream eutrophication. ${monitoringNote}.`
                            : hasNutrients ? `ATTAINS lists nutrient impairment. #1 priority: treat the primary urban watershed inflow. ${monitoringNote}.`
                            : hasBacteria ? `Bacteria exceeds recreational standards. #1 priority: treat at highest-volume discharge. ${monitoringNote}.`
                            : hasSediment ? `Turbidity at ${turbVal?.toFixed(1) ?? '?'} FNU. #1 priority: capture sediment at the dominant tributary. ${monitoringNote}.`
                            : `#1 priority treatment zone. ${monitoringNote}.`;

                          phases.push({
                            phase: 'Phase 1', quads: phase1Quads, units: phase1Units, gpm: phase1GPM,
                            cost: phase1AnnualCost,
                            mission: p1Mission, placement: p1Placement, why: p1Why,
                            trigger: 'Immediate -- deploy within 30 days of site assessment',
                            color: 'border-cyan-400 text-cyan-900', bgColor: 'bg-cyan-50',
                          });

                          // ── PHASE 2: #2 most critical zone ──
                          if (totalQuads >= 2) {
                            const p2Quads = totalQuads === 2 ? (totalQuads - phase1Quads) : 1;
                            const p2Units = p2Quads * 4;

                            const p2Mission = (hasSediment || turbiditySeverity !== 'clear')
                              ? 'Secondary Outfall Treatment'
                              : (hasNutrients || bloomSeverity !== 'normal') ? 'Secondary Nutrient Treatment'
                              : hasBacteria ? 'Secondary Source Treatment'
                              : 'Secondary Zone Treatment';

                            const p2Placement = waterType === 'brackish'
                              ? (hasSediment || turbiditySeverity !== 'clear'
                                ? '#2 critical zone: MS4 outfall cluster along shoreline -- treat stormwater discharge from adjacent subwatersheds where multiple outfalls concentrate pollutant loading'
                                : '#2 critical zone: Embayment or low-circulation area -- treat where longest water residence time allows bloom development and DO depletion')
                              : (hasSediment || turbiditySeverity !== 'clear'
                                ? '#2 critical zone: Secondary tributary or stormwater outfall cluster -- capture additional loading from adjacent drainage area'
                                : '#2 critical zone: Secondary inflow or pooling area -- treat where nutrient accumulation drives worst conditions');

                            const p2Why = turbiditySeverity !== 'clear' && turbiditySeverity !== 'unknown'
                              ? `Turbidity at ${turbVal?.toFixed(1)} FNU indicates sediment loading from multiple sources. Phase 1 intercepts the primary tributary; Phase 2 treats the next-highest loading zone. ${monitoringNote}.`
                              : hasNutrients && (bloomSeverity !== 'normal')
                              ? `Bloom conditions persist beyond the primary inflow. Phase 2 treats the #2 nutrient loading zone. ${monitoringNote}.`
                              : attainsCauses.length >= 3
                              ? `${attainsCauses.length} impairment causes indicate multiple pollution sources. Phase 2 addresses the #2 priority loading pathway. ${monitoringNote}.`
                              : `Phase 1 data identifies the second-highest treatment priority. ${monitoringNote}.`;

                            phases.push({
                              phase: 'Phase 2', quads: p2Quads, units: p2Units, gpm: p2Units * 50,
                              cost: p2Units * COST_PER_UNIT_YEAR,
                              mission: p2Mission, placement: p2Placement, why: p2Why,
                              trigger: 'After 90 days -- Phase 1 data confirms #2 priority zone and optimal placement',
                              color: 'border-blue-300 text-blue-900', bgColor: 'bg-blue-50',
                            });
                          }

                          // ── PHASE 3: #3 most critical zone ──
                          if (totalQuads >= 3) {
                            const remainQuads = totalQuads - phase1Quads - (totalQuads === 2 ? totalQuads - phase1Quads : 1);
                            const remainUnits = remainQuads * 4;
                            if (remainQuads > 0) {
                              const p3Mission = waterType === 'brackish'
                                ? (hasBacteria ? 'Tertiary Outfall Treatment' : 'Tertiary Zone Treatment')
                                : 'Tertiary Zone Treatment';

                              const p3Placement = waterType === 'brackish'
                                ? (hasBacteria
                                  ? '#3 critical zone: Remaining outfall cluster or CSO discharge -- treat pathogen and nutrient loading from the third-highest contributing subwatershed along the tidal corridor'
                                  : hasNutrients || bloomSeverity !== 'normal'
                                  ? '#3 critical zone: Remaining tributary or embayment -- treat nutrient loading from the third-highest contributing inflow, capturing pollutants that Phases 1+2 cannot reach'
                                  : '#3 critical zone: Third-highest loading area along the shoreline -- extend treatment coverage to remaining untreated outfall discharge')
                                : (hasNutrients
                                  ? '#3 critical zone: Tertiary inflow or accumulation point -- treat remaining nutrient loading from the third-highest contributing drainage area'
                                  : '#3 critical zone: Remaining untreated inflow -- extend treatment coverage to the third-highest loading area in the watershed');

                              const p3Why = attainsCauses.length >= 3
                                ? `${attainsCauses.length} documented impairment causes require treatment across multiple zones. Phases 1+2 address the two highest-load sources. Phase 3 extends to the #3 priority zone -- ${totalUnits} total units providing ${fullGPM} GPM treatment capacity across all major loading points. ${monitoringNote}.`
                                : `Phase 3 extends treatment to the third-highest loading zone identified by Phases 1+2 data. Full ${totalQuads}-quad deployment ensures coverage across all major pollution sources -- ${totalUnits} units, ${fullGPM} GPM total capacity. ${monitoringNote}.`;

                              phases.push({
                                phase: totalQuads > 3 ? `Phase 3 (${remainQuads}Q)` : 'Phase 3', quads: remainQuads, units: remainUnits, gpm: remainUnits * 50,
                                cost: remainUnits * COST_PER_UNIT_YEAR,
                                mission: p3Mission, placement: p3Placement, why: p3Why,
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
                                      <span className="text-xs font-bold">{p.quads} quad{p.quads > 1 ? 's' : ''} ({p.units}U, {p.gpm} GPM) -- {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(p.cost)}/yr</span>
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

                              {/* Running total bar */}
                              <div className="flex items-center gap-2 pt-1">
                                {phases.map((p, i) => (
                                  <div key={i} className={`flex-1 h-2 rounded-full ${i === 0 ? 'bg-cyan-500' : i === 1 ? 'bg-blue-500' : 'bg-indigo-500'}`} title={`${p.phase}: ${p.units} units`} />
                                ))}
                              </div>
                              <div className="flex justify-between text-[9px] text-slate-400">
                                <span>Day 1</span>
                                <span>90 days</span>
                                {phases.length > 2 && <span>180 days</span>}
                                <span>Full build: {totalUnits} units, {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr</span>
                              </div>
                            </div>
                          );
                        })()}

                        {/* CTAs */}
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => {
                              const subject = encodeURIComponent(`ALIA Pilot Deployment Request — ${regionName}, ${stateAbbr}`);
                              const body = encodeURIComponent(
                                `ALIA Pilot Deployment Request\n` +
                                `${'='.repeat(40)}\n\n` +
                                `Site: ${regionName}\n` +
                                `State: ${STATE_ABBR_TO_NAME[stateAbbr] || stateAbbr}\n` +
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
                                  .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')  // emoji block 1
                                  .replace(/[\u{2600}-\u{27BF}]/gu, '')    // misc symbols
                                  .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // variation selectors
                                  .replace(/[\u{200D}]/gu, '')             // zero-width joiner
                                  .replace(/[\u{E0020}-\u{E007F}]/gu, '')  // tags
                                  .replace(/\u00B5/g, 'u')                 // micro sign
                                  .replace(/\u03BC/g, 'u')                 // greek mu
                                  .replace(/\u2192/g, '->')                // right arrow
                                  .replace(/\u2190/g, '<-')                // left arrow
                                  .replace(/\u2014/g, '--')                // em dash
                                  .replace(/\u2013/g, '-')                 // en dash
                                  .replace(/\u00A7/g, 'Section ')          // section sign
                                  .replace(/\u2022/g, '-')                 // bullet
                                  .replace(/\u00B0/g, ' deg')              // degree
                                  .replace(/\u2019/g, "'")                 // right single quote
                                  .replace(/\u2018/g, "'")                 // left single quote
                                  .replace(/\u201C/g, '"')                 // left double quote
                                  .replace(/\u201D/g, '"')                 // right double quote
                                  .replace(/[^\x00-\x7F]/g, '')           // strip any remaining non-ASCII
                                  .replace(/\s+/g, ' ')                    // collapse whitespace
                                  .trim();

                                // Category title map (emoji-free)
                                const catTitleMap: Record<string, string> = {
                                  source: 'SOURCE CONTROL -- Upstream BMPs',
                                  nature: 'NATURE-BASED SOLUTIONS',
                                  pearl: 'ALIA -- Treatment Accelerator',
                                  community: 'COMMUNITY ENGAGEMENT & STEWARDSHIP',
                                  regulatory: 'REGULATORY & PLANNING',
                                };

                                // Title
                                pdf.addTitle('ALIA Deployment Plan');
                                pdf.addText(clean(`${regionName}, ${STATE_ABBR_TO_NAME[stateAbbr] || stateAbbr}`), { bold: true, fontSize: 12 });
                                pdf.addText(`Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, { fontSize: 9 });
                                pdf.addSpacer(5);

                                // Executive Summary
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
                                    pdf.addText(clean(`- [${tp.urgency.toUpperCase()}] ${tp.driver}`), { indent: 5 });
                                    pdf.addText(clean(`  -> ${tp.action}`), { indent: 10, fontSize: 9 });
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

                                // Site Profile
                                pdf.addSubtitle('Site Profile');
                                pdf.addDivider();
                                pdf.addTable(
                                  ['Attribute', 'Value'],
                                  [
                                    ['Waterbody', clean(regionName)],
                                    ['State', STATE_ABBR_TO_NAME[stateAbbr] || stateAbbr],
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

                                // Live Parameters
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

                                // Why ALIA at this site
                                pdf.addSubtitle('Why ALIA at This Site');
                                pdf.addDivider();
                                for (const b of whyBullets) {
                                  pdf.addText(clean(`- ${b.problem}`), { indent: 5, bold: true });
                                  pdf.addText(clean(`  -> ${b.solution}.`), { indent: 10 });
                                }
                                pdf.addSpacer(3);

                                // ALIA Configuration
                                pdf.addSubtitle(`ALIA Configuration: ${pearlModel}`);
                                pdf.addDivider();
                                pdf.addText(`System Type: ${waterType === 'brackish' ? 'Oyster (C. virginica)' : 'Freshwater Mussel'} Biofiltration`, { indent: 5 });
                                const pearlCatMods = categories.find(c => c.id === 'pearl');
                                if (pearlCatMods) {
                                  const modRows = pearlCatMods.modules
                                    .filter(m => m.status !== 'co-benefit')
                                    .map(m => [clean(m.label), m.status.toUpperCase(), clean(m.detail)]);
                                  pdf.addTable(['Module', 'Status', 'Detail'], modRows, [50, 25, 95]);
                                }
                                pdf.addSpacer(3);

                                // Deployment Sizing & Cost
                                pdf.addSubtitle('Deployment Sizing & Cost Estimate');
                                pdf.addDivider();
                                pdf.addTable(
                                  ['Metric', 'Value'],
                                  [
                                    ['Sizing Method', 'Severity-driven treatment need assessment'],
                                    ['Site Severity Score', `${prelimSeverity}/100 (${siteSeverityLabel})`],
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

                                // Phased Deployment Roadmap (matches card detail)
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

                                // Impairment Classification
                                if (impairmentClassification.length > 0) {
                                  pdf.addSubtitle(`Impairment Classification — ALIA addresses ${pearlAddressable} of ${totalClassified} (${addressabilityPct}%)`);
                                  pdf.addDivider();
                                  pdf.addTable(
                                    ['Cause', 'Tier', 'ALIA Action'],
                                    impairmentClassification.map(item => [
                                      clean(item.cause),
                                      item.tier === 1 ? 'T1 — Primary Target' : item.tier === 2 ? 'T2 — Contributes/Planned' : 'T3 — Outside Scope',
                                      clean(item.pearlAction)
                                    ]),
                                    [45, 40, 85]
                                  );
                                  pdf.addSpacer(3);
                                }

                                // Threat Assessment
                                pdf.addSubtitle('Threat Assessment');
                                pdf.addDivider();
                                pdf.addTable(
                                  ['Threat', 'Level', 'Detail'],
                                  threats.map(t => [t.label, t.level, clean(t.detail)]),
                                  [35, 25, 110]
                                );
                                pdf.addSpacer(3);

                                // Full Restoration Plan
                                pdf.addSubtitle('Full Restoration Plan');
                                pdf.addDivider();
                                pdf.addText(`This plan combines ${totalBMPs} conventional BMPs and nature-based solutions with ALIA accelerated treatment.`);
                                pdf.addSpacer(3);

                                for (const cat of categories.filter(c => c.id !== 'pearl')) {
                                  pdf.addText(catTitleMap[cat.id] || clean(cat.title), { bold: true });
                                  const activeItems = cat.modules.filter(m => m.status === 'warranted' || m.status === 'recommended');
                                  const coItems = cat.modules.filter(m => m.status === 'co-benefit');
                                  for (const m of activeItems) {
                                    pdf.addText(clean(`- [${m.status.toUpperCase()}] ${m.label} -- ${m.detail}`), { indent: 5, fontSize: 9 });
                                  }
                                  if (coItems.length > 0) {
                                    pdf.addText(clean(`Co-benefits: ${coItems.map(m => m.label).join(', ')}`), { indent: 5, fontSize: 8 });
                                  }
                                  pdf.addSpacer(3);
                                }

                                // Next Steps
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

                        {/* ═══ ECONOMICS PANEL (toggles open) ═══ */}
                        {showCostPanel && (() => {
                          const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

                          // ═══ COMPLIANCE SAVINGS MODEL ═══
                          // Framed as: "How much existing compliance cost can ALIA replace or compress?"
                          // NOT fines avoided. This is reduced spend on monitoring, reporting, and BMP execution.
                          // Partial displacement assumptions — conservative, defensible for city procurement.

                          const unitCost = COST_PER_UNIT_YEAR; // $200,000
                          const p1Annual = phase1Units * unitCost;
                          const fullAnnual = totalUnits * unitCost;

                          // ── Traditional compliance costs (per zone, annual) ──
                          const tradMonitoringLow = 100000;   // Continuous station install amortized + ops + lab QA + data management
                          const tradMonitoringHigh = 200000;
                          const tradBMPLow = 150000;          // Constructed wetland or engineered BMP, amortized over 20yr + maintenance
                          const tradBMPHigh = 400000;         // Urban sites: land, permitting, space constraints
                          const tradConsultingLow = 75000;    // MS4 program management, lab analysis, quarterly sampling, permit reporting
                          const tradConsultingHigh = 175000;  // Cat 5: TMDL participation, enhanced documentation, regulatory coordination
                          const tradTotalLow = (tradMonitoringLow + tradBMPLow + tradConsultingLow) * totalQuads;
                          const tradTotalHigh = (tradMonitoringHigh + tradBMPHigh + tradConsultingHigh) * totalQuads;

                          // ── Bucket 1: Monitoring & Reporting Efficiency ──
                          // ALIA replaces 50-75% of fixed monitoring station cost
                          const monStationSavingsLow = Math.round(0.50 * tradMonitoringLow * totalQuads);
                          const monStationSavingsHigh = Math.round(0.75 * tradMonitoringHigh * totalQuads);
                          // ALIA replaces 40-60% of consulting, lab, and reporting
                          const consultSavingsLow = Math.round(0.40 * tradConsultingLow * totalQuads);
                          const consultSavingsHigh = Math.round(0.60 * tradConsultingHigh * totalQuads);
                          const bucket1Low = monStationSavingsLow + consultSavingsLow;
                          const bucket1High = monStationSavingsHigh + consultSavingsHigh;

                          // ── Bucket 2: BMP Execution Efficiency ──
                          // ALIA data improves targeting, reduces rework and mis-targeted spend
                          // Conservative: 5-10% of amortized BMP program
                          const bucket2Low = Math.round(0.05 * tradBMPLow * totalQuads);
                          const bucket2High = Math.round(0.10 * tradBMPHigh * totalQuads);

                          // ── Total compliance savings ──
                          const compSavingsLow = bucket1Low + bucket2Low;
                          const compSavingsHigh = bucket1High + bucket2High;
                          // Round for clean presentation
                          const compSavingsLowRound = Math.round(compSavingsLow / 10000) * 10000;
                          const compSavingsHighRound = Math.round(compSavingsHigh / 10000) * 10000;

                          // ── What this means relative to ALIA cost ──
                          const offsetPctLow = Math.round((compSavingsLowRound / fullAnnual) * 100);
                          const offsetPctHigh = Math.round((compSavingsHighRound / fullAnnual) * 100);

                          // ── Grant offset potential ──
                          const grantOffsetLow = Math.round(fullAnnual * 0.40);
                          const grantOffsetHigh = Math.round(fullAnnual * 0.75);

                          // ── Combined: compliance savings + grants ──
                          const combinedOffsetLow = compSavingsLowRound + grantOffsetLow;
                          const combinedOffsetHigh = compSavingsHighRound + grantOffsetHigh;
                          const effectiveCostLow = Math.max(0, fullAnnual - combinedOffsetHigh);
                          const effectiveCostHigh = Math.max(0, fullAnnual - combinedOffsetLow);

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

                              {/* Deployment costs by phase */}
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

                                        {totalQuads >= 2 && (() => {
                                          const p2q = totalQuads === 2 ? totalQuads - phase1Quads : 1;
                                          const p2u = p2q * 4;
                                          return (
                                            <>
                                              <div className="px-2 py-1.5 bg-slate-50 font-semibold border-b border-slate-100">+ Phase 2 ({p2q}Q)</div>
                                              <div className="px-2 py-1.5 bg-slate-50 text-right border-b border-slate-100">+{p2u}</div>
                                              <div className="px-2 py-1.5 bg-slate-50 text-right border-b border-slate-100">+{p2u * 50}</div>
                                              <div className="px-2 py-1.5 bg-slate-50 font-bold text-right border-b border-slate-100">+{fmt(p2u * unitCost)}/yr</div>
                                            </>
                                          );
                                        })()}

                                        {totalQuads >= 3 && (() => {
                                          const p3q = totalQuads - phase1Quads - (totalQuads === 2 ? totalQuads - phase1Quads : 1);
                                          const p3u = p3q * 4;
                                          return p3q > 0 ? (
                                            <>
                                              <div className="px-2 py-1.5 font-semibold border-b border-slate-100">+ Phase 3 ({p3q}Q)</div>
                                              <div className="px-2 py-1.5 text-right border-b border-slate-100">+{p3u}</div>
                                              <div className="px-2 py-1.5 text-right border-b border-slate-100">+{p3u * 50}</div>
                                              <div className="px-2 py-1.5 font-bold text-right border-b border-slate-100">+{fmt(p3u * unitCost)}/yr</div>
                                            </>
                                          ) : null;
                                        })()}
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
                                <div className="text-[9px] text-slate-500 px-1">These are costs Baltimore already pays or would pay to achieve equivalent compliance coverage. ALIA does not eliminate all of these -- it partially displaces and compresses them.</div>
                              </div>

                              {/* Compliance cost savings */}
                              <div className="space-y-1">
                                <div className="text-[10px] font-bold text-green-700 uppercase">Compliance Cost Savings From Meeting Permit Requirements</div>
                                <div className="rounded-md bg-white border border-green-200 overflow-hidden">
                                  <div className="grid grid-cols-[1fr_auto] text-[11px]">
                                    <div className="px-2 py-1.5 border-b border-green-100">
                                      <div className="font-semibold">Monitoring & reporting efficiency</div>
                                      <div className="text-[9px] text-slate-500">Replaces 50-75% of fixed stations, 40-60% of consulting & lab work</div>
                                    </div>
                                    <div className="px-2 py-1.5 font-bold text-green-700 text-right border-b border-green-100">{fmt(bucket1Low)} -- {fmt(bucket1High)}/yr</div>
                                    <div className="px-2 py-1.5 bg-green-50/50 border-b border-green-100">
                                      <div className="font-semibold">BMP execution efficiency</div>
                                      <div className="text-[9px] text-slate-500">Better targeting reduces rework, redesign & mis-targeted spend (5-10% of BMP program)</div>
                                    </div>
                                    <div className="px-2 py-1.5 bg-green-50/50 font-bold text-green-700 text-right border-b border-green-100">{fmt(bucket2Low)} -- {fmt(bucket2High)}/yr</div>
                                    <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900">Total Compliance Savings</div>
                                    <div className="px-2 py-1.5 bg-green-200 font-bold text-green-900 text-right">{fmt(compSavingsLowRound)} -- {fmt(compSavingsHighRound)}/yr</div>
                                  </div>
                                </div>
                                <div className="text-[9px] text-slate-500 px-1">This is not avoided fines. This is reduced spend on monitoring, reporting, and inefficient BMP execution -- tied directly to Baltimore's existing cost categories.</div>
                              </div>

                              {/* What this means */}
                              <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-md bg-green-100 border border-green-200 text-center py-2">
                                  <div className="text-[9px] text-green-600">Compliance Savings Offset</div>
                                  <div className="text-lg font-bold text-green-700">{offsetPctLow}% -- {offsetPctHigh}%</div>
                                  <div className="text-[9px] text-green-500">of ALIA cost offset by reduced compliance spend</div>
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
                                <div className="text-[9px] text-slate-500 px-1">Effective net cost = ALIA annual cost minus grant funding minus compliance savings. This is the incremental budget impact for capabilities that would otherwise require {totalQuads} separate monitoring, treatment, and consulting contracts.</div>
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
                      </div>
                    );
                  })()}

                  {/* ═══ SUPPORTING LAYERS (source, nature, community, regulatory) ═══ */}
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold px-1 pt-1">Supporting Restoration Layers</div>
                  <div className="text-[11px] text-slate-500 px-1 -mt-2">
                    ALIA accelerates results. These layers provide the long-term foundation.
                  </div>

                  {categories.filter(cat => cat.id !== 'pearl').map((cat) => {
                    const warranted = cat.modules.filter(m => m.status === 'warranted');
                    const recommended = cat.modules.filter(m => m.status === 'recommended' || m.status === 'accelerator');
                    const coBenefits = cat.modules.filter(m => m.status === 'co-benefit');
                    return (
                      <div key={cat.id} className={`rounded-lg border ${cat.color} p-2.5 space-y-1.5`}>
                        <div className="flex items-center justify-between">
                          <div className="text-[11px] font-semibold uppercase tracking-wide flex items-center gap-1.5">
                            <span>{cat.icon}</span> {cat.title}
                          </div>
                          <div className="flex items-center gap-1.5 text-[9px]">
                            {warranted.length > 0 && <span className="bg-red-200 text-red-800 font-bold px-1.5 py-0.5 rounded-full">{warranted.length} warranted</span>}
                            {recommended.length > 0 && <span className="bg-blue-200 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">{recommended.length} recommended</span>}
                            {coBenefits.length > 0 && <span className="bg-slate-200 text-slate-600 font-bold px-1.5 py-0.5 rounded-full">{coBenefits.length} co-benefit</span>}
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500 -mt-0.5">{cat.subtitle}</div>
                        <div className="space-y-1">
                          {[...warranted, ...recommended].map((t) => (
                            <div key={t.id} className={`rounded-md border p-2 ${t.color}`}>
                              <div className="flex items-start gap-2">
                                <span className="text-sm flex-shrink-0">{t.icon}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold">{t.label}</span>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase ${
                                      t.status === 'warranted' ? 'bg-red-200 text-red-800' : 'bg-blue-200 text-blue-800'
                                    }`}>{t.status}</span>
                                  </div>
                                  <div className="text-[10px] mt-0.5 leading-relaxed opacity-90">{t.detail}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                          {coBenefits.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {coBenefits.map((t) => (
                                <span key={t.id} className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-white/70 border border-slate-200 rounded px-2 py-1" title={t.detail}>
                                  {t.icon} {t.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Threat Assessment */}
                  <div className="grid grid-cols-3 gap-2">
                    {threats.map((t) => (
                      <div key={t.label} className="bg-white rounded-md border border-cyan-100 p-2 text-center">
                        <div className="text-[10px] text-slate-500 uppercase">{t.label}</div>
                        <div className={`text-sm font-bold ${t.color}`}>{t.level}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{t.detail}</div>
                      </div>
                    ))}
                  </div>

                  {/* Full Plan Summary */}
                  <div className="rounded-md bg-white border border-slate-200 p-2.5">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Full Plan</div>
                        <div className="text-sm font-bold text-slate-700">{totalBMPs} BMPs + {pearlModel}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Deployment</div>
                        <div className="text-sm font-bold text-slate-700">{totalQuads} quad{totalQuads > 1 ? 's' : ''} ({totalUnits} units)</div>
                        <div className="text-[9px] text-slate-400">{isPhasedDeployment ? `Phase 1: ${phase1Quads}Q / ${phase1Units}U` : `${fullGPM} GPM`}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Annual Cost</div>
                        <div className="text-sm font-bold text-slate-700">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(fullAnnualCost)}/yr</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Severity</div>
                        <div className={`text-sm font-bold ${siteSeverityScore >= 75 ? 'text-red-700' : siteSeverityScore >= 50 ? 'text-amber-700' : siteSeverityScore >= 25 ? 'text-yellow-700' : 'text-green-700'}`}>{siteSeverityLabel}</div>
                        <div className="text-[9px] text-slate-400">{siteSeverityScore}/100</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500 uppercase">Pathway</div>
                        <div className="text-xs font-semibold text-slate-700">{compliancePathway}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 pt-1.5">
                      Sizing derived from {isMD ? 'MD DNR Shallow Water Monitoring thresholds: DO (5.0/3.2 mg/L), chlorophyll (15/50/100 ug/L), turbidity (7 FNU)' : 'EPA National Recommended Water Quality Criteria: DO (5.0/4.0 mg/L), chlorophyll (20/40/60 ug/L), turbidity (10/25 FNU)'}, EPA ATTAINS category. ALIA is the data backbone -- it measures, verifies, and optimizes every restoration layer from day one.
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })()}

        </div>); {/* end usmap */}

        case 'impairmentprofile': return DS(<>
        {/* ── National Impairment Profile (overview renders this in usmap; other lenses get it here) ── */}
        {viewLens !== 'overview' && lens.showTopStrip && attainsAggregation.totalAssessed > 0 && (
            <Card id="section-impairmentprofile">
              <CardHeader className="pb-2 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>National Impairment Profile</CardTitle>
                    <CardDescription className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>{attainsAggregation.totalAssessed.toLocaleString()} waterbodies from EPA ATTAINS</CardDescription>
                  </div>
                  <BrandedPrintBtn sectionId="impairmentprofile" title="Impairment Profile" />
                </div>
              </CardHeader>
              <CardContent className="px-5">
                <div className="space-y-6">

                  {/* TMDL Gap Summary (top) */}
                  <div>
                    <div className="pin-section-label mb-2">TMDL Status</div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="pin-stat-hero text-2xl" style={attainsAggregation.tmdlGapPct > 50 ? { color: 'var(--status-severe)' } : undefined}>
                            {attainsAggregation.tmdlGapPct}%
                          </span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>of impaired lack approved TMDL</span>
                        </div>
                        <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                          <div className="h-full rounded-full" style={{
                            width: `${attainsAggregation.tmdlGapPct}%`,
                            background: attainsAggregation.tmdlGapPct > 50 ? 'var(--status-severe)' : 'var(--status-warning)',
                            opacity: 0.6,
                          }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'var(--text-dim)' }}>
                          <span>Cat 5 (no TMDL): {attainsAggregation.cat5.toLocaleString()}</span>
                          <span>Cat 4a (has TMDL): {attainsAggregation.cat4a.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* EPA Category Distribution */}
                  <div>
                    <div className="pin-section-label mb-2">EPA Assessment Categories</div>
                    <div className="space-y-1">
                      {[
                        { cat: '5', label: 'Cat 5 — No TMDL', count: attainsAggregation.cat5, color: 'var(--status-severe)', opacity: 0.5 },
                        { cat: '4A', label: 'Cat 4a — TMDL', count: attainsAggregation.cat4a, color: 'var(--status-warning)', opacity: 0.4 },
                        { cat: '4B', label: 'Cat 4b — Alt. Ctrl', count: attainsAggregation.cat4b, color: 'var(--status-warning)', opacity: 0.3 },
                        { cat: '4C', label: 'Cat 4c — Non-pollut.', count: attainsAggregation.cat4c, color: 'var(--text-dim)', opacity: 0.4 },
                        { cat: '3', label: 'Cat 3 — No Data', count: attainsAggregation.catCounts['3'], color: 'var(--text-dim)', opacity: 0.3 },
                        { cat: '2', label: 'Cat 2 — Concerns', count: attainsAggregation.catCounts['2'], color: 'var(--status-healthy)', opacity: 0.3 },
                        { cat: '1', label: 'Cat 1 — Good', count: attainsAggregation.catCounts['1'], color: 'var(--status-healthy)', opacity: 0.4 },
                      ].filter(r => r.count > 0).map(r => {
                        const pct = attainsAggregation.totalAssessed > 0 ? (r.count / attainsAggregation.totalAssessed) * 100 : 0;
                        return (
                          <div key={r.cat} className="flex items-center gap-2">
                            <div className="w-[110px] text-[10px] truncate" style={{ color: 'var(--text-dim)' }}>{r.label}</div>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                              <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: r.color, opacity: r.opacity }} />
                            </div>
                            <div className="text-[10px] w-[48px] text-right pin-stat-secondary">{r.count.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Top Impairment Causes */}
                  <div>
                    <div className="pin-section-label mb-2">Top Impairment Causes</div>
                    <div className="space-y-1">
                      {attainsAggregation.topCauses.slice(0, 7).map((c, i) => {
                        const maxCount = attainsAggregation.topCauses[0]?.count || 1;
                        const pct = (c.count / maxCount) * 100;
                        return (
                          <div key={i} className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => console.log('Filter by cause:', c.cause)}>
                            <div className="w-[110px] text-[10px] truncate" style={{ color: 'var(--text-dim)' }} title={c.cause}>{c.cause}</div>
                            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--text-dim)', opacity: 0.35 }} />
                            </div>
                            <div className="text-[10px] w-[48px] text-right pin-stat-secondary">{c.count.toLocaleString()}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Methodology + Export */}
                  <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <a
                      href="https://www.epa.gov/waterdata/attains"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] flex items-center gap-1 hover:underline"
                      style={{ color: 'var(--text-dim)' }}
                    >
                      <Info className="w-3 h-3" />
                      How is this calculated?
                    </a>
                    <button
                      onClick={() => {
                        const text = `National Impairment Summary\n${attainsAggregation.totalAssessed.toLocaleString()} waterbodies assessed\nTMDL Gap: ${attainsAggregation.tmdlGapPct}%\n\nTop Causes:\n${attainsAggregation.topCauses.slice(0, 7).map(c => `  ${c.cause}: ${c.count.toLocaleString()}`).join('\n')}`;
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'national-impairment-summary.txt'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="text-[10px] flex items-center gap-1 px-2 py-1 rounded transition-colors"
                      style={{ color: 'var(--text-dim)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                    >
                      <ArrowRight className="w-3 h-3" />
                      Download Summary
                    </button>
                  </div>

                </div>
              </CardContent>
            </Card>
          )}

        </>); {/* end impairmentprofile */}

        case 'ai-water-intelligence': return DS(<>
        {/* ── AI Water Intelligence — Claude-powered, ATTAINS-fed ── */}
        {lens.showAIInsights && (
          <AIInsightsEngine
            key={`national-${attainsAggregation.totalAssessed}`}
            role="Federal"
            stateAbbr="US"
            regionData={regionData as any}
            nationalData={nationalAIData}
          />
        )}
        </>); {/* end ai-water-intelligence */}

        case 'national-briefing': return DS(<>
        {/* ── National Intelligence Briefing — Sentinel-powered 3-layer view ── */}
          <Card id="section-national-briefing">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-bright)' }}>
                    National Intelligence Briefing
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    Real-time sentinel monitoring + {aiInsights.length} AI findings from {attainsAggregation.totalAssessed.toLocaleString()} ATTAINS records
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-default)' }}
                  onClick={async () => {
                    const pdf = new BrandedPDFGenerator();
                    await pdf.loadLogo();
                    pdf.initialize();
                    pdf.addTitle('National Intelligence Briefing');
                    pdf.addMetadata('Active Alerts', `${sentinel.criticalHucs.length} critical, ${sentinel.watchHucs.length} watch`);
                    pdf.addMetadata('AI Findings', `${aiInsights.length}`);
                    pdf.addMetadata('ATTAINS Records', attainsAggregation.totalAssessed.toLocaleString());
                    pdf.addMetadata('Generated', new Date().toLocaleString());
                    pdf.addSpacer(5);
                    if (sentinel.criticalHucs.length > 0) {
                      pdf.addSubtitle('Active Sentinel Events');
                      for (const h of [...sentinel.criticalHucs, ...sentinel.watchHucs]) {
                        pdf.addText(`[${h.level}] ${hucNames[h.huc8] ?? h.huc8} — Score: ${h.score}, ${h.eventCount} signals`);
                      }
                      pdf.addSpacer(3);
                    }
                    for (const insight of aiInsights) {
                      const label = insight.type === 'urgent' ? 'URGENT' : insight.type === 'warning' ? 'WARNING' : insight.type === 'success' ? 'SUCCESS' : 'INFO';
                      pdf.addSubtitle(`[${label}] ${insight.title}`);
                      pdf.addText(insight.detail);
                      pdf.addSpacer(3);
                    }
                    const dateStr = new Date().toISOString().slice(0, 10);
                    pdf.download(`PEARL_National_Intel_Briefing_${dateStr}.pdf`);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <SentinelBriefingCard
                criticalHucs={sentinel.criticalHucs}
                watchHucs={sentinel.watchHucs}
                recentResolutions={sentinel.recentResolutions}
                hucNames={hucNames}
                sources={sentinel.sources}
                systemStatus={sentinel.systemStatus}
                lastFetched={sentinel.lastFetched}
              >
                {/* Layer 3: Structural context — existing AI insights */}
                {aiInsights.length > 0 && (
                  <div className="space-y-2">
                    {aiInsights.map((insight, idx) => {
                      const sevColor = insight.type === 'urgent' ? 'var(--status-severe)' :
                                       insight.type === 'warning' ? 'var(--status-warning)' :
                                       insight.type === 'success' ? 'var(--status-healthy)' :
                                       'var(--text-dim)';
                      return (
                        <div key={idx} className="py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sevColor }} />
                            <span className="text-xs font-semibold" style={{ color: 'var(--text-bright)' }}>{insight.title}</span>
                            <span className="pin-label ml-auto">{insight.type}</span>
                          </div>
                          <div className="text-xs leading-relaxed pl-4" style={{ color: 'var(--text-secondary)' }}>{insight.detail}</div>
                          {insight.action && (
                            <Button size="sm" variant="outline" className="mt-2 ml-4 h-6 text-[10px]">{insight.action}</Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </SentinelBriefingCard>
            </CardContent>
          </Card>

        </>); {/* end national-briefing */}

        case 'aiinsights': return DS(<>
        {/* ── Combined AI Insights (legacy — used by non-briefing lenses) ── */}
        {lens.showAIInsights && (
          <AIInsightsEngine
            key={`national-${attainsAggregation.totalAssessed}`}
            role="Federal"
            stateAbbr="US"
            regionData={regionData as any}
            nationalData={nationalAIData}
          />
        )}
        {lens.showAIInsights && aiInsights.length > 0 && (
          <Card id="section-aiinsights">
            <CardHeader className="pb-2 pt-5 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-bright)' }}>
                    National Intelligence Briefing
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                    {aiInsights.length} findings from {attainsAggregation.totalAssessed.toLocaleString()} ATTAINS records
                  </CardDescription>
                </div>
                <BrandedPrintBtn sectionId="aiinsights" title="National Intelligence Briefing" />
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <div className="space-y-2">
                {aiInsights.map((insight, idx) => {
                  const sevColor = insight.type === 'urgent' ? 'var(--status-severe)' :
                                   insight.type === 'warning' ? 'var(--status-warning)' :
                                   insight.type === 'success' ? 'var(--status-healthy)' :
                                   'var(--text-dim)';
                  return (
                    <div key={idx} className="py-2.5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sevColor }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--text-bright)' }}>{insight.title}</span>
                        <span className="pin-label ml-auto">{insight.type}</span>
                      </div>
                      <div className="text-xs leading-relaxed pl-4" style={{ color: 'var(--text-secondary)' }}>{insight.detail}</div>
                      {insight.action && (
                        <Button size="sm" variant="outline" className="mt-2 ml-4 h-6 text-[10px]">{insight.action}</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        </>); {/* end aiinsights */}

        case 'networkhealth': return DS(<>
        {/* Network Health Score — lens controlled */}
        {lens.showNetworkHealth && (
        <Card id="section-networkhealth" className={`border-2 ${
          networkHealth.color === 'green' ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50' :
          networkHealth.color === 'yellow' ? 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50' :
          'border-red-300 bg-gradient-to-r from-red-50 to-rose-50'
        }`}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>{networkHealth.color === 'green' ? '🟢' : networkHealth.color === 'yellow' ? '🟡' : networkHealth.color === 'red' ? '🔴' : '⚪'}</span>
                Network Health Score
                <span className="text-xs font-normal text-slate-500 ml-1">
                  ({networkHealth.gradedStateCount ?? 0} of {networkHealth.stateCount} states graded)
                </span>
              </CardTitle>
              <BrandedPrintBtn sectionId="networkhealth" title="Network Health Score" />
            </div>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-end gap-3">
                  <div className={`text-5xl font-bold ${
                    networkHealth.percentage < 0 ? 'text-slate-400' :
                    networkHealth.color === 'green' ? 'text-green-700' :
                    networkHealth.color === 'yellow' ? 'text-yellow-700' :
                    'text-red-700'
                  }`}>
                    {networkHealth.percentage >= 0 ? `${networkHealth.percentage}%` : '—'}
                  </div>
                  <div className={`text-3xl font-black mb-1 px-3 py-0.5 rounded-lg border-2 ${networkHealth.grade.bg} ${networkHealth.grade.color}`}>
                    {networkHealth.grade.letter}
                  </div>
                  {networkHealth.percentage >= 0 && (
                    <div className="mb-1.5 text-sm text-slate-500 flex items-center gap-1">
                      <span className="text-[10px] uppercase tracking-wide">Prev:</span>
                      <span className="font-semibold">58%</span>
                      <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                    </div>
                  )}
                </div>
                <div className={`text-sm font-semibold mt-1 flex items-center gap-1.5 ${
                  networkHealth.color === 'green' ? 'text-green-700' :
                  networkHealth.color === 'yellow' ? 'text-yellow-700' :
                  networkHealth.color === 'red' ? 'text-red-700' :
                  'text-slate-500'
                }`}>
                  {networkHealth.status === 'healthy' && <><CheckCircle size={16} /> NETWORK HEALTHY</>}
                  {networkHealth.status === 'caution' && <><AlertCircle size={16} /> CAUTION</>}
                  {networkHealth.status === 'critical' && <><AlertTriangle size={16} /> ATTENTION REQUIRED</>}
                  {networkHealth.status === 'unknown' && <><AlertCircle size={16} /> INSUFFICIENT DATA</>}
                </div>
                <div className="text-sm text-slate-600 mt-2">
                  {networkHealth.sitesNeedingAttention > 0
                    ? `${networkHealth.sitesNeedingAttention} state${networkHealth.sitesNeedingAttention !== 1 ? 's' : ''} below C- grade`
                    : networkHealth.percentage >= 0 ? 'All graded states scoring C- or above' : 'Awaiting assessment data'}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowHealthDetails(!showHealthDetails)}
                  className={`${
                    networkHealth.color === 'green' ? 'text-green-700 border-green-300 hover:bg-green-100' :
                    networkHealth.color === 'yellow' ? 'text-yellow-700 border-yellow-300 hover:bg-yellow-100' :
                    networkHealth.color === 'red' ? 'text-red-700 border-red-300 hover:bg-red-100' :
                    'text-slate-500 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {showHealthDetails ? 'Hide Details ↑' : 'View Details →'}
                </Button>
                <div className="text-xs text-slate-500">
                  {nationalStats.assessed} assessed · {nationalStats.monitored.toLocaleString()} monitored · {nationalStats.totalWaterbodies.toLocaleString()} total
                </div>
                {attainsBulkLoading.size > 0 && (
                  <div className="text-[10px] text-blue-500 animate-pulse">
                    ⏳ Loading EPA ATTAINS data ({attainsBulkLoaded.size}/{[...new Set(baseRegionData.map(r => r.state))].length} states)...
                  </div>
                )}
              </div>
            </div>

            {/* Driver stat tiles */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-rose-50 rounded-lg p-4 border border-rose-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-rose-600 font-semibold">Severe</div>
                </div>
                <div className="text-2xl font-bold text-rose-700">{networkHealth.severeCount?.toLocaleString()}</div>
                <div className="text-xs text-rose-500">waterbodies across {networkHealth.severeStates} states</div>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-amber-600 font-semibold">Impaired</div>
                </div>
                <div className="text-2xl font-bold text-amber-700">{networkHealth.impairedCount?.toLocaleString()}</div>
                <div className="text-xs text-amber-500">waterbodies across {networkHealth.impairedStates} states</div>
              </div>
              <div className="bg-amber-50/50 rounded-lg p-4 border-2 border-amber-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Gauge className="w-4 h-4 text-amber-700" />
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold">Monitored</div>
                </div>
                <div className="text-2xl font-bold text-slate-700">{networkHealth.monitoredCount?.toLocaleString()}</div>
                <div className="text-xs text-amber-600 font-medium">of {networkHealth.totalCount?.toLocaleString()} total waterbodies</div>
              </div>
            </div>

            {/* Index Weight Breakdown */}
            {showHealthDetails && (
              <div className="mt-4 pt-4 border-t border-slate-200/60">
                <div className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  Composite Score Breakdown
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(INDEX_WEIGHTS).map(([id, weight]) => {
                    const label = id.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim();
                    return (
                      <div key={id} className="flex items-center gap-2 text-[11px]">
                        <div className="w-full bg-slate-100 rounded-full h-1.5 flex-1">
                          <div className="h-full rounded-full bg-blue-400" style={{ width: `${weight * 100}%` }} />
                        </div>
                        <span className="text-slate-500 whitespace-nowrap">{label} ({Math.round(weight * 100)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Inline Details — worst states by grade */}
            {showHealthDetails && networkHealth.worstStates.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200/60">
                <div className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                  Lowest-Graded States
                </div>
                <div className="space-y-1.5">
                  {networkHealth.worstStates.map((st, idx) => (
                    <div
                      key={st.abbr}
                      onClick={() => {
                        setSelectedState(st.abbr);
                        setWaterbodyFilter('all');
                        mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-white/80 border border-slate-200 hover:bg-white hover:shadow-sm cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${st.grade.bg} ${st.grade.color}`}>
                          {st.grade.letter}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-800 truncate">{st.name}</div>
                          <div className="text-xs text-slate-500">
                            {st.assessed} assessed · {st.monitored} monitored · {st.high > 0 ? `${st.high} severe` : `${st.waterbodies} total`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`text-sm font-bold ${st.grade.color}`}>
                          {st.canGradeState ? `${st.score}%` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showHealthDetails && networkHealth.worstStates.length === 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200/60">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle size={16} />
                  All states operating within normal parameters. No action required.
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}

        </>); {/* end networkhealth */}

        case 'nationalimpact': return DS(<>
        {/* National Impact Counter — lens controlled */}
        {lens.showNationalImpact && (
        <Card id="section-nationalimpact" className="border-2 border-cyan-200 bg-gradient-to-r from-cyan-50 via-white to-blue-50 overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Droplets className="h-5 w-5 text-cyan-600" />
                National Treatment Impact — PIN-Tracked Deployments
              </CardTitle>
              <div className="flex items-center gap-1">
                <BrandedPrintBtn sectionId="nationalimpact" title="National Treatment Impact — PIN-Tracked Deployments" />
                <Button
                  size="sm"
                  variant={impactPeriod === 'all' ? 'default' : 'outline'}
                  onClick={() => setImpactPeriod('all')}
                  className="h-7 text-xs"
                >
                  All Time
                </Button>
                {impactYears.map((year) => (
                  <Button
                    key={year}
                    size="sm"
                    variant={impactPeriod === String(year) ? 'default' : 'outline'}
                    onClick={() => setImpactPeriod(String(year))}
                    className="h-7 text-xs"
                  >
                    {year}
                  </Button>
                ))}
              </div>
            </div>
            <CardDescription>
              {nationalImpact.periodLabel} · {nationalImpact.activeSiteCount} active site{nationalImpact.activeSiteCount !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {/* Gallons Treated */}
              <div className="text-center">
                <div className="text-3xl font-bold text-cyan-700 tabular-nums">
                  {formatImpactNum(Math.round(liveGallons))}
                </div>
                <div className="text-xs text-slate-600 mt-1 font-medium">Gallons Treated</div>
                {nationalImpact.isLive && (
                  <div className="text-[10px] text-cyan-600 mt-0.5 tabular-nums">
                    +{Math.round(nationalImpact.gallonsPerSecond * 60).toLocaleString()}/min
                  </div>
                )}
              </div>

              {/* TSS Removed */}
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-700 tabular-nums">
                  {formatImpactNum(Math.round(liveTSS))}
                </div>
                <div className="text-xs text-slate-600 mt-1 font-medium">lbs TSS Removed</div>
                <div className="text-[10px] text-amber-600 mt-0.5">
                  88–95% removal rate
                </div>
              </div>

              {/* Nutrients Removed */}
              <div className="text-center">
                <div className="text-3xl font-bold text-green-700 tabular-nums">
                  {formatImpactNum(nationalImpact.totalNutrientLbs)}
                </div>
                <div className="text-xs text-slate-600 mt-1 font-medium">lbs Nutrients Removed</div>
                <div className="text-[10px] text-green-600 mt-0.5">
                  Nitrogen + Phosphorus
                </div>
              </div>

              {/* Bacteria Reduced */}
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-700 tabular-nums">
                  {formatImpactNum(nationalImpact.totalBacteria)}
                </div>
                <div className="text-xs text-slate-600 mt-1 font-medium">Bacteria Colonies Prevented</div>
                <div className="text-[10px] text-purple-600 mt-0.5">
                  CFU reduction
                </div>
              </div>
            </div>

            {/* Live pulse indicator — only when viewing current period */}
            <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-slate-200/60">
              {nationalImpact.isLive ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                  </span>
                  <span className="text-xs text-slate-500">Updating live from PIN-tracked treatment systems</span>
                </>
              ) : (
                <>
                  <span className="inline-flex rounded-full h-2.5 w-2.5 bg-slate-300" />
                  <span className="text-xs text-slate-400">Historical period — final totals</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        </>); {/* end nationalimpact */}

        case 'priorityqueue': return DS(<>
        {/* Panel A: Priority Action Queue */}
            {lens.showPriorityQueue && (
            <Card id="section-priorityqueue" className="border-2 border-red-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle size={16} className="text-red-600" />
                    Priority Queue
                  </CardTitle>
                  <BrandedPrintBtn sectionId="priorityqueue" title="Priority Queue" />
                </div>
                <CardDescription className="text-xs">Top waterbodies by composite priority score (Cat 5 + No TMDL + EJ + data gaps)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[calc(100vh-400px)] min-h-[250px] overflow-y-auto">
                  {federalPriorities.length === 0 ? (
                    <div className="text-sm text-slate-400 py-4 text-center">No priority items — all waterbodies nominal</div>
                  ) : federalPriorities.map((r, i) => (
                    <div
                      key={r.id}
                      onClick={() => { handleRegionClick(r.id); if (r.state) setSelectedState(r.state); }}
                      className="flex items-center gap-2 p-2 rounded-md border border-slate-200 hover:bg-red-50 hover:border-red-200 cursor-pointer transition-all"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-[10px] font-bold text-red-700">
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800 truncate">{r.name}</div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          {r.state && <span className="font-medium">{r.state}</span>}
                          <span>·</span>
                          {r.reasons.map((reason, j) => (
                            <span key={j} className={`px-1 py-0.5 rounded text-[9px] font-medium ${
                              reason === 'Cat 5' ? 'bg-red-100 text-red-700' :
                              reason === 'Cat 4' ? 'bg-orange-100 text-orange-700' :
                              reason === 'No TMDL' ? 'bg-purple-100 text-purple-700' :
                              reason.startsWith('EJ') ? 'bg-amber-100 text-amber-700' :
                              reason === 'No data' ? 'bg-slate-100 text-slate-600' :
                              'bg-blue-100 text-blue-700'
                            }`}>{reason}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-black text-red-700 tabular-nums">{r.priorityScore}</div>
                        <div className="text-[9px] text-slate-400">score</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )}

        </>); {/* end priorityqueue */}

        case 'coveragegaps': return DS(<>
            {/* Panel B: State Coverage Gaps */}
            {lens.showCoverageGaps && (
            <Card id="section-coveragegaps" className="border-2 border-amber-200">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BarChart3 size={16} className="text-amber-600" />
                      State Coverage Gaps
                    </CardTitle>
                    <CardDescription className="text-xs">States ranked by monitoring gaps and severity burden</CardDescription>
                  </div>
                  <div className="flex items-center gap-1">
                    <select
                      value={selectedState}
                      onChange={(e) => { setSelectedState(e.target.value); setWaterbodyFilter('all'); }}
                      className="px-2 py-1 rounded-md border border-slate-300 text-[10px] bg-white cursor-pointer hover:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-300 mr-1"
                    >
                      {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                        <option key={abbr} value={abbr}>{abbr} — {name}</option>
                      ))}
                    </select>
                    <BrandedPrintBtn sectionId="coveragegaps" title="State Coverage Gaps" />
                    <Button size="sm" variant={!showImpact ? 'default' : 'outline'} onClick={() => setShowImpact(false)} className="h-6 text-[10px] px-2">By Coverage</Button>
                    <Button size="sm" variant={showImpact ? 'default' : 'outline'} onClick={() => setShowImpact(true)} className="h-6 text-[10px] px-2">By Severity</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 max-h-[calc(100vh-400px)] min-h-[250px] overflow-y-auto">
                  {(showImpact ? federalCoverageGaps.mostSevere : federalCoverageGaps.worstCoverage).map((s, i) => (
                    <div
                      key={s.abbr}
                      onClick={() => {
                        setSelectedState(s.abbr);
                        setWaterbodyFilter('all');
                        setViewLens('water-quality');
                      }}
                      className="flex items-center gap-2 p-2 rounded-md border border-slate-200 hover:bg-amber-50 hover:border-amber-200 cursor-pointer transition-all"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700">
                        {i + 1}
                      </div>
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold border ${s.grade.bg} ${s.grade.color}`}>
                        {s.grade.letter}
                        <span className="text-[8px] font-normal ml-0.5">({s.score})</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-800">{s.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {showImpact
                            ? `${(s.high + s.medium).toLocaleString()} impaired (${s.high} severe, ${s.medium} moderate) · ${s.waterbodies} total`
                            : `${s.unmonitored} blind spots · ${('coveragePct' in s ? (s as any).coveragePct : 0)}% coverage`
                          }
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {showImpact ? (
                          <>
                            <div className="text-lg font-black text-red-700 tabular-nums">{s.high + s.medium}</div>
                            <div className="text-[9px] text-slate-400">impaired</div>
                          </>
                        ) : (
                          <>
                            <div className="text-lg font-black text-amber-700 tabular-nums">{s.unmonitored}</div>
                            <div className="text-[9px] text-slate-400">no data</div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            )}
        </>); {/* end coveragegaps */}

        case 'situation': return DS(<>
        {/* Time Range + Treatment Impact Toggle — lens controlled */}
        {lens.showTimeRange && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Time Range:</span>
            <div className="flex gap-1">
              {(['24h', '7d', '30d'] as const).map((range) => (
                <Button
                  key={range}
                  size="sm"
                  variant={timeRange === range ? 'default' : 'outline'}
                  onClick={() => setTimeRange(range)}
                  className="h-8 text-xs"
                >
                  {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="h-6 w-px bg-slate-300" />
          
          <Button
            size="sm"
            variant={showImpact ? 'default' : 'outline'}
            onClick={() => setShowImpact(!showImpact)}
            className={`h-8 ${showImpact ? 'bg-green-600 hover:bg-green-700' : ''}`}
          >
            {showImpact ? '✓ Showing Treatment Impact' : 'Show Treatment Impact'}
          </Button>

          {showImpact && (
            <div className="flex-1 text-xs text-green-700 font-medium">
              Map shows improvement in treatment-deployed states (MD, FL) vs ambient baseline
            </div>
          )}
        </div>
        )}


        {/* National Water Quality Status — three-layer story card */}
        {lens.showSituationSummary && (
          <NationalStatusCard summary={nationalSummary} />
        )}

        </>); {/* end situation */}

        case 'top10': return DS(<>
        {/* Feature 3: Hotspots Rankings — lens controlled, starts collapsed */}
        {lens.showHotspots && (
        <div id="section-top10" className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
          <button onClick={() => setShowHotspotsSection(prev => !prev)} className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50" style={{ color: 'var(--text-primary)' }}>
            <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>🔥 Top 10 Worsening / Improving Waterbodies</span>
            <div className="flex items-center gap-1.5">
              {showHotspotsSection ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </div>
          </button>
          {showHotspotsSection && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 p-4">
          <Card id="section-worsening" className="border-2 border-red-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Top 10 Worsening
                </CardTitle>
                <BrandedPrintBtn sectionId="worsening" title="Top 10 Worsening" />
              </div>
              <CardDescription>Highest priority intervention areas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {hotspots.worsening.map((region, idx) => (
                    <div
                      key={region.id}
                      onClick={() => handleRegionClick(region.id)}
                      className="cursor-pointer transition-colors"
                      style={{ borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                    >
                      <div className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--status-severe-bg)', color: 'var(--status-severe)' }}>
                            {idx + 1}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                              {region.state} · {region.name}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--text-dim)' }}>{region.activeAlerts} active alert{region.activeAlerts !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5" style={{
                          background: region.alertLevel === 'high' ? 'var(--status-severe-bg)' : region.alertLevel === 'medium' ? 'var(--status-impaired-bg)' : region.alertLevel === 'low' ? 'var(--status-watch-bg)' : 'var(--status-healthy-bg)',
                          color: region.alertLevel === 'high' ? 'var(--status-severe)' : region.alertLevel === 'medium' ? 'var(--status-impaired)' : region.alertLevel === 'low' ? 'var(--status-watch)' : 'var(--status-healthy)',
                        }}>
                          {levelToLabel(region.alertLevel)}
                        </span>
                      </div>
                    </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card id="section-improving" className="border-2 border-green-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  {'Top 10 Improving'}
                </CardTitle>
                <BrandedPrintBtn sectionId="improving" title="Top 10 Improving" />
              </div>
              <CardDescription>
                {'Success stories and best performers'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {hotspots.improving.map((region, idx) => (
                  <div
                    key={region.id}
                    onClick={() => handleRegionClick(region.id)}
                    className="flex items-center justify-between p-2 cursor-pointer transition-colors"
                    style={{ borderRadius: '10px', border: '1px solid var(--border-subtle)', background: 'var(--bg-card)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; }}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--status-healthy-bg)', color: 'var(--status-healthy)' }}>
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {region.state} · {region.name}
                        </div>
                        <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                          {region.alertLevel === 'none' ? 'No alerts' : `${region.activeAlerts} minor alerts`}
                        </div>
                      </div>
                    </div>
                    <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5" style={{
                      background: 'var(--status-healthy-bg)',
                      color: 'var(--status-healthy)',
                    }}>
                      Healthy
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          </div>
          )}
        </div>
        )}

        </>); {/* end top10 */}

        case 'statebystatesummary': return DS(<>
        {/* Feature 2: State Rollup Table — collapsible when lens says so */}
        <>
        {lens.collapseStateTable && (
          <button
            onClick={() => setShowStateTable(!showStateTable)}
            className="w-full py-2.5 px-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-between transition-colors"
          >
            <span className="text-sm font-medium text-slate-700">State-by-State Coverage & Grading Detail</span>
            <span className="text-xs text-slate-400">{showStateTable ? '▲ Collapse' : '▼ Expand full table'}</span>
          </button>
        )}
        {(!lens.collapseStateTable || showStateTable) && (
        <Card id="section-statebystatesummary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>State-by-State Summary</CardTitle>
              <BrandedPrintBtn sectionId="statebystatesummary" title="State-by-State Summary" />
            </div>
            <CardDescription>Click any state to view its waterbodies on the map above</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Watershed filter + export controls */}
            <div className="flex flex-wrap items-center gap-3 p-3 mb-3 rounded-lg border border-blue-200 bg-blue-50">
              <span className="text-xs font-semibold text-slate-600">Watershed:</span>
              <select
                value={watershedFilter}
                onChange={(e) => setWatershedFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-md border border-slate-300 text-xs bg-white"
              >
                <option value="all">All Watersheds</option>
                <option value="chesapeake">Chesapeake Bay</option>
                <option value="gulf">Gulf of Mexico</option>
                <option value="great_lakes">Great Lakes</option>
                <option value="south_atlantic">South Atlantic</option>
                <option value="pacific">Pacific Coast</option>
              </select>
              {watershedFilter !== 'all' && (
                <Button size="sm" variant="outline" onClick={() => setWatershedFilter('all')} className="h-7 text-xs">
                  Clear
                </Button>
              )}
              {watershedFilter !== 'all' && (
                <span className="text-xs text-blue-700 font-medium">
                  Showing {filteredRegionData.length} of {regionData.length} waterbodies
                </span>
              )}
              <div className="ml-auto flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const reportData = {
                      title: 'National Water Quality Report',
                      timeRange,
                      stats: nationalStats,
                      stateRollup,
                      hotspots,
                      filters: { watershedFilter },
                      generated: new Date().toISOString()
                    };
                    console.log('PDF Report Data:', reportData);
                    setToastMsg('PDF report generation coming in the next release. CSV export is available now.');
                    setTimeout(() => setToastMsg(null), 4000);
                  }}
                  className="h-7 text-xs"
                >
                  📄 PDF Report
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const csv = [
                      ['State', 'Grade', 'Score', 'Assessed', 'Monitored', 'Unmonitored', 'Severe', 'Impaired', 'Total Waterbodies'],
                      ...stateRollup.map(r => [r.name, r.grade.letter, r.canGradeState ? r.score : 'N/A', r.assessed, r.monitored, r.unmonitored, r.high, r.medium, r.waterbodies])
                    ].map(row => row.join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `pin-national-summary-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}
                  className="h-7 text-xs"
                >
                  📊 Export CSV
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const ejSummary = stateRollup.map(s => {
                      const ejScore = getEJScore(s.abbr);
                      const ejData = getEJData(s.abbr);
                      return `${s.name}: EJ Score ${ejScore}${ejData ? `, Poverty ${ejData.povertyPct}%, Minority ${ejData.minorityPct}%, DW Violations ${ejData.drinkingWaterViol}/100k` : ''}`;
                    }).join('\n');
                    const blob = new Blob([`Environmental Justice Impact Report\nGenerated: ${new Date().toISOString()}\n\n${ejSummary}`], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `ej-impact-report-${new Date().toISOString().split('T')[0]}.txt`; a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="h-7 text-xs"
                >
                  🎯 EJ Report
                </Button>
              </div>
            </div>
            {/* Grading methodology */}
            <div className="mb-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Grading Scale: </span>
              Grades are based on the average condition of monitored priority waterbodies in each state. 
              Each waterbody is scored by its current alert level (Healthy = 100, Watch = 85, Impaired = 65, Severe = 40) 
              and averaged across all monitored sites. States with more severe impairments will score lower. 
              <span className="text-slate-500 ml-1">A+ (97+) · A (93) · A- (90) · B+ (87) · B (83) · B- (80) · C+ (77) · C (73) · C- (70) · D+ (67) · D (63) · D- (60) · F (&lt;60)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-semibold text-slate-700">State</th>
                    <th className="text-center py-2 px-3 font-semibold text-slate-700">Grade</th>
                    <th className="text-center py-2 px-3 font-semibold text-green-700">Assessed</th>
                    <th className="text-center py-2 px-3 font-semibold text-red-700">Cat 5</th>
                    <th className="text-center py-2 px-3 font-semibold text-amber-700">Has TMDL</th>
                    <th className="text-center py-2 px-3 font-semibold text-orange-700">Impaired</th>
                    <th className="text-center py-2 px-3 font-semibold text-slate-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {stateRollup.map(row => (
                    <tr 
                      key={row.abbr}
                      onClick={() => {
                        setSelectedState(row.abbr);
                        setWaterbodyFilter('all');
                        mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className={`border-b border-slate-100 cursor-pointer hover:bg-blue-50 transition-colors ${
                        selectedState === row.abbr ? 'bg-blue-100' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-medium text-slate-700">{row.name}</td>
                      <td className="py-2 px-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md border text-xs font-bold ${row.grade.bg} ${row.grade.color}`}>
                          {row.grade.letter}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center text-green-700 font-medium">
                        {row.assessed || '—'}
                        {row.dataSource === 'attains' && <span className="text-[9px] text-blue-500 ml-0.5">EPA</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {row.cat5 > 0 && <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5" style={{ background: 'var(--status-severe-bg)', color: 'var(--status-severe)' }}>{row.cat5}</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {row.cat4a > 0 && <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5" style={{ background: 'var(--status-watch-bg)', color: 'var(--status-watch)' }}>{row.cat4a}</span>}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {row.totalImpaired > 0 && <span className="pin-label inline-flex items-center rounded-full px-2 py-0.5" style={{ background: 'var(--status-impaired-bg)', color: 'var(--status-impaired)' }}>{row.totalImpaired}</span>}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600">{row.waterbodies}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        )}
        </>

        </>); {/* end statebystatesummary */}

        case 'icis': return DS(
        <div id="section-icis">
          {!lens.sections?.has('usmap') && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-xs font-medium text-slate-500">State:</span>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-300 text-xs bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                  <option key={abbr} value={abbr}>{name} ({abbr})</option>
                ))}
              </select>
            </div>
          )}
          <ICISCompliancePanel
            state={selectedState}
            compactMode={false}
          />
        </div>
      );

        case 'sdwis': return DS(
        <div id="section-sdwis">
          {!lens.sections?.has('usmap') && (
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-xs font-medium text-slate-500">State:</span>
              <select
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                className="px-2 py-1 rounded-md border border-slate-300 text-xs bg-white cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-300"
              >
                {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                  <option key={abbr} value={abbr}>{name} ({abbr})</option>
                ))}
              </select>
            </div>
          )}
          <SDWISCompliancePanel
            state={selectedState}
            compactMode={false}
          />
        </div>
      );

        case 'groundwater': return DS(
        <div id="section-groundwater">
          <NwisGwPanel
            state={selectedState}
            compactMode={false}
            federalMode={true}
          />
        </div>
      );

        case 'sla': return DS(<>
        {/* Feature 11: SLA/Compliance Tracking — lens controlled */}
        {lens.showSLA && slaMetrics.total > 0 && (
          <Card id="section-sla" className="border-2 border-purple-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  ⏰ SLA Compliance Tracking
                </CardTitle>
                <div className="flex items-center gap-2">
                  <BrandedPrintBtn sectionId="sla" title="SLA Compliance Tracking" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowSLAMetrics(!showSLAMetrics)}
                    className="h-7 text-xs"
                  >
                    {showSLAMetrics ? 'Hide Details' : 'Show Details'}
                </Button>
                </div>
              </div>
              <CardDescription>Alert response time performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {/* SLA Summary Stats */}
              <div className="grid grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-slate-700">{slaMetrics.total}</div>
                  <div className="text-xs text-slate-600">Total Alerts</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${slaMetrics.overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {slaMetrics.overdueCount}
                  </div>
                  <div className="text-xs text-slate-600">Overdue</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{slaMetrics.withinSLA}</div>
                  <div className="text-xs text-slate-600">Within SLA</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{slaMetrics.avgResolutionTime}h</div>
                  <div className="text-xs text-slate-600">Avg Resolution</div>
                </div>
              </div>

              {/* Detailed SLA Table */}
              {showSLAMetrics && slaMetrics.metrics.length > 0 && (
                <div className="border-t border-slate-200 pt-3">
                  <div className="text-xs font-semibold text-slate-700 mb-2">Alert Details (Target: Acknowledge &lt;4h, Resolve &lt;48h)</div>
                  <div className="space-y-1">
                    {slaMetrics.metrics.slice(0, 10).map((metric: any) => (
                      <div
                        key={metric.regionId}
                        className={`flex items-center justify-between p-2 rounded text-xs ${
                          metric.resolveLate ? 'bg-red-50 border border-red-200' : 
                          metric.acknowledgedLate ? 'bg-orange-50 border border-orange-200' : 
                          'bg-green-50 border border-green-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Badge variant={metric.severity === 'high' ? 'destructive' : 'secondary'} className="text-xs">
                            {metric.severity}
                          </Badge>
                          <span className="truncate font-medium">{metric.state} · {metric.regionName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-600">{metric.status}</span>
                          <span className={`font-bold ${metric.ageHours > 48 ? 'text-red-600' : 'text-slate-700'}`}>
                            {metric.ageHours}h old
                          </span>
                          {metric.resolveLate && <span className="text-red-600 font-bold">⚠️ OVERDUE</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}


        </>); {/* end sla */}

        case 'scorecard-kpis': return DS(<>
        {/* ── SCORECARD: EPA Region Filter ── */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">EPA Region:</span>
          <select
            value={scorecardRegionFilter === 'all' ? 'all' : scorecardRegionFilter}
            onChange={(e) => setScorecardRegionFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-2.5 py-1 rounded text-xs font-medium bg-white text-slate-700 border border-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
          >
            <option value="all">All Regions</option>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(r => (
              <option key={r} value={r}>Region {r}</option>
            ))}
          </select>
          {scorecardRegionFilter !== 'all' && (
            <button onClick={() => setScorecardRegionFilter('all')} className="text-xs text-blue-600 hover:underline">Clear filter</button>
          )}
        </div>
        {/* ── SCORECARD: KPI Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className={`rounded-xl border-2 p-4 text-center ${scorecardData.nationalGrade.bg}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">National Grade</div>
            <div className={`text-4xl font-black ${scorecardData.nationalGrade.color}`}>{scorecardData.nationalGrade.letter}</div>
            <div className="text-[10px] text-slate-400 mt-1">{scorecardData.gradedStates.length} states graded</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">States Monitored</div>
            <div className="text-3xl font-bold text-slate-800">{nationalStats.statesCovered}</div>
            <div className="text-[10px] text-slate-400 mt-1">{nationalStats.totalWaterbodies.toLocaleString()} waterbodies</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Violations</div>
            <div className={`text-3xl font-bold ${nationalStats.highAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>{nationalStats.totalAlerts.toLocaleString()}</div>
            <div className="text-[10px] text-slate-400 mt-1">{nationalStats.highAlerts} severe</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Impairment Rate</div>
            <div className={`text-3xl font-bold ${scorecardData.impairmentPct > 30 ? 'text-red-600' : scorecardData.impairmentPct > 15 ? 'text-amber-600' : 'text-green-600'}`}>{scorecardData.impairmentPct}%</div>
            <div className="text-[10px] text-slate-400 mt-1">{scorecardData.totalImpaired.toLocaleString()} impaired</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Coverage Rate</div>
            <div className={`text-3xl font-bold ${scorecardData.coveragePct > 70 ? 'text-green-600' : scorecardData.coveragePct > 40 ? 'text-amber-600' : 'text-red-600'}`}>{scorecardData.coveragePct}%</div>
            <div className="text-[10px] text-slate-400 mt-1">{nationalStats.assessed + nationalStats.monitored} with data</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">SLA Compliance</div>
            <div className={`text-3xl font-bold ${slaMetrics.overdueCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{slaMetrics.total > 0 ? Math.round((slaMetrics.withinSLA / slaMetrics.total) * 100) : 100}%</div>
            <div className="text-[10px] text-slate-400 mt-1">{slaMetrics.overdueCount} overdue</div>
          </div>
        </div>
        </>);

        case 'scorecard-grades': return DS(
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">State Grades</CardTitle>
            <CardDescription>Water quality grades for all {scorecardData.allStatesAlpha.length} states based on ATTAINS assessments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-13 gap-1.5">
              {scorecardData.allStatesAlpha.map(s => {
                const g = s.canGradeState ? scoreToGrade(s.score) : { letter: 'N/A', color: 'text-slate-400', bg: 'bg-slate-50 border-slate-200' };
                return (
                  <button
                    key={s.abbr}
                    onClick={() => { setSelectedState(s.abbr); setViewLens('overview' as ViewLens); }}
                    className={`rounded-lg border p-1.5 text-center transition-all hover:shadow-md hover:scale-105 ${g.bg}`}
                    title={`${STATE_ABBR_TO_NAME[s.abbr] || s.abbr}: ${g.letter} (${s.score >= 0 ? s.score : '?'})`}
                  >
                    <div className="text-[10px] font-bold text-slate-600">{s.abbr}</div>
                    <div className={`text-sm font-black ${g.color}`}>{g.letter}</div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
        );

        case 'scorecard-rankings': return DS(<>
        {/* ── Bottom 5 / Top 5 ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-red-700">Needs Attention</CardTitle>
              <CardDescription>5 lowest-scoring states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scorecardData.bottom5.map((s, i) => {
                  const g = scoreToGrade(s.score);
                  return (
                    <div key={s.abbr} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                        <span className="text-sm font-semibold text-slate-800">{STATE_ABBR_TO_NAME[s.abbr] || s.abbr}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{s.high} severe · {s.medium} moderate</span>
                        <span className={`text-sm font-black px-2 py-0.5 rounded ${g.bg} ${g.color}`}>{g.letter}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-green-700">Top Performers</CardTitle>
              <CardDescription>5 highest-scoring states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {scorecardData.top5.map((s, i) => {
                  const g = scoreToGrade(s.score);
                  return (
                    <div key={s.abbr} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                        <span className="text-sm font-semibold text-slate-800">{STATE_ABBR_TO_NAME[s.abbr] || s.abbr}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500">{s.assessed} assessed · {s.monitored} monitored</span>
                        <span className={`text-sm font-black px-2 py-0.5 rounded ${g.bg} ${g.color}`}>{g.letter}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        </>);

        case 'scorecard-choropleth': return DS(
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              National Grade Choropleth
            </CardTitle>
            <CardDescription>Geographic distribution of state water quality grades</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50/50">
              <div className="text-center">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <div className="text-sm font-medium text-slate-500">Choropleth Map</div>
                <div className="text-xs text-slate-400 mt-1">Connect to state grade data for interactive geographic view</div>
              </div>
            </div>
          </CardContent>
        </Card>
        );

        case 'scorecard-trends': return DS(<>
        {/* ── Trend Cards (placeholder — needs historical data) ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Violations', value: nationalStats.totalAlerts, color: 'text-red-600' },
            { label: 'Assessments', value: scorecardData.totalAssessed, color: 'text-blue-600' },
            { label: 'Coverage', value: `${scorecardData.coveragePct}%`, color: 'text-emerald-600' },
            { label: 'Graded States', value: scorecardData.gradedStates.length, color: 'text-violet-600' },
          ].map(t => (
            <div key={t.label} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.label}</div>
              <div className={`text-2xl font-bold ${t.color} mt-1`}>{typeof t.value === 'number' ? t.value.toLocaleString() : t.value}</div>
              <div className="text-[10px] text-slate-400 mt-2 italic">Trend data available after 30 days</div>
            </div>
          ))}
        </div>
        </>);

        case 'reports-hub': return DS(
        <Card>
          <CardHeader>
            <CardTitle>Federal Reports</CardTitle>
            <CardDescription>Generate and export data in role-specific formats</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: 'National Compliance Summary', desc: 'NPDES + SDWIS violation trends across all states with enforcement actions', formats: ['PDF', 'CSV'] },
                { title: 'Impairment Report', desc: 'ATTAINS Category 5 listings, impairment causes, and restoration status by state', formats: ['PDF', 'Excel'] },
                { title: 'TMDL Progress Report', desc: 'Total Maximum Daily Load development status and pollutant reduction targets', formats: ['PDF', 'CSV'] },
                { title: 'Coverage Analysis', desc: 'Monitoring network gaps, data freshness, and state-by-state coverage metrics', formats: ['PDF', 'Excel'] },
                { title: 'Drinking Water Quality', desc: 'SDWIS system violations, enforcement timeline, and compliance rates', formats: ['PDF', 'CSV'] },
                { title: 'Groundwater Status', desc: 'WDFN groundwater levels, aquifer trends, and monitoring well inventory', formats: ['PDF', 'Excel'] },
              ].map((report) => (
                <div key={report.title} className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all">
                  <h3 className="text-sm font-semibold text-slate-800">{report.title}</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{report.desc}</p>
                  <div className="flex items-center gap-2 mt-3">
                    {report.formats.map((fmt) => (
                      <Button key={fmt} variant="outline" size="sm" className="text-xs h-7">
                        {fmt}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        );

        case 'trends-dashboard': return DS(<>
        {/* ── NATIONAL TRENDS & PROJECTIONS ── */}
        <Card>
          <CardHeader>
            <CardTitle>National Trends & Projections</CardTitle>
            <CardDescription>Long-term water quality trends, watershed forecasts, and climate scenario modeling</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Trend KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Impairment Trend', value: '↓ 2.3%', sub: 'vs. prior assessment cycle', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                { label: 'Nutrient Loading', value: '↑ 4.1%', sub: 'nitrogen + phosphorus', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                { label: 'PFAS Detections', value: '↑ 18%', sub: 'new sites reporting', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                { label: 'Monitoring Expansion', value: '↑ 7.2%', sub: 'new stations online', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
              ].map(t => (
                <div key={t.label} className={`rounded-xl border p-4 ${t.bg}`}>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t.label}</div>
                  <div className={`text-2xl font-bold ${t.color} mt-1`}>{t.value}</div>
                  <div className="text-[10px] text-slate-500 mt-1">{t.sub}</div>
                </div>
              ))}
            </div>

            {/* Watershed Trend Cards */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Watershed-Level Trends</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { watershed: 'Chesapeake Bay', trend: 'Improving', detail: 'Nitrogen loads down 12% since 2020. Dissolved oxygen improving in main stem.', color: 'text-green-700', bg: 'border-green-200' },
                  { watershed: 'Mississippi River Basin', trend: 'Worsening', detail: 'Gulf hypoxic zone expanded 8%. Agricultural runoff continues to increase.', color: 'text-red-700', bg: 'border-red-200' },
                  { watershed: 'Great Lakes', trend: 'Mixed', detail: 'Erie algal blooms decreasing, but Superior microplastic levels rising.', color: 'text-amber-700', bg: 'border-amber-200' },
                  { watershed: 'Colorado River', trend: 'Critical', detail: 'Salinity increasing with drought. Reservoir levels at historic lows.', color: 'text-red-700', bg: 'border-red-300' },
                  { watershed: 'Puget Sound', trend: 'Stable', detail: 'Shellfish area closures steady. Stormwater BMPs showing results.', color: 'text-blue-700', bg: 'border-blue-200' },
                  { watershed: 'Everglades', trend: 'Improving', detail: 'Phosphorus reductions on track. CERP projects advancing.', color: 'text-green-700', bg: 'border-green-200' },
                ].map(w => (
                  <div key={w.watershed}>
                    <div
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${w.bg} ${selectedWatershed === w.watershed ? 'ring-2 ring-blue-400' : ''}`}
                      onClick={() => setSelectedWatershed(selectedWatershed === w.watershed ? null : w.watershed)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-slate-800">{w.watershed}</h4>
                        <Badge variant="outline" className={`text-[10px] ${w.color}`}>{w.trend}</Badge>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{w.detail}</p>
                    </div>
                    {selectedWatershed === w.watershed && (
                      <div className="mt-2 p-3 rounded-lg border border-blue-200 bg-blue-50/50 text-xs space-y-2">
                        <div className="font-semibold text-slate-700">{w.watershed} — Detailed Trend Data</div>
                        <p className="text-slate-500">{w.detail}</p>
                        <div className="flex items-center gap-4 pt-1">
                          <span className={`font-semibold ${w.color}`}>Status: {w.trend}</span>
                          <span className="text-slate-400">Data from EPA ATTAINS + USGS WaterWatch</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Climate Projections */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Climate Scenario Projections (2030–2050)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { scenario: 'RCP 4.5 — If emissions decline moderately', impacts: ['12% increase in Category 5 listings', 'Expanded harmful algal bloom zones', '8 additional states below monitoring coverage thresholds'] },
                  { scenario: 'RCP 8.5 — If current emission trends continue', impacts: ['23% increase in Category 5 listings', 'Critical water scarcity in 6+ Western states', 'Coastal drinking water systems at salinity risk'] },
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
              Projections based on EPA Climate Change Indicators, USGS WaterWatch, and NOAA climate models. Actual values will populate as historical snapshots accumulate.
            </div>
          </CardContent>
        </Card>
        </>);

        case 'policy-tracker': return DS(<>
        {/* ── POLICY & REGULATORY TRACKER ── */}
        <PolicyTracker />
        </>);

        case 'contaminants-tracker': return DS(<>
        {/* ── EMERGING CONTAMINANTS TRACKER ── */}
        <EmergingContaminantsTracker role="federal" selectedState={selectedState} />
        </>);

        case 'interagency-hub': return DS(<>
        {/* ── CROSS-AGENCY COORDINATION ── */}
        <Card>
          <CardHeader>
            <CardTitle>Cross-Agency Coordination</CardTitle>
            <CardDescription>Federal inter-agency data sharing, joint initiatives, and monitoring overlap</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Agency Coverage Grid */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Federal Agency Monitoring Coverage</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { agency: 'EPA', sites: '~4,700', focus: 'Compliance & NPDES', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                  { agency: 'USGS', sites: '~12,000', focus: 'Streamflow & WQ', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200' },
                  { agency: 'NOAA', sites: '~800', focus: 'Coastal & estuarine', color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
                  { agency: 'USFS', sites: '~1,200', focus: 'Watershed forestry', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                  { agency: 'DoD', sites: '~450', focus: 'Installation cleanup', color: 'text-slate-700', bg: 'bg-slate-100 border-slate-300' },
                  { agency: 'USDA/NRCS', sites: '~3,100', focus: 'Agricultural BMPs', color: 'text-lime-700', bg: 'bg-lime-50 border-lime-200' },
                ].map(a => (
                  <div key={a.agency} className={`rounded-lg border p-3 text-center ${a.bg}`}>
                    <div className={`text-lg font-bold ${a.color}`}>{a.agency}</div>
                    <div className="text-sm font-semibold text-slate-700 mt-1">{a.sites}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{a.focus}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Joint Initiatives */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Active Joint Initiatives</h3>
              <div className="space-y-3">
                {[
                  { name: 'National Water Quality Portal (WQX)', agencies: 'EPA + USGS + USDA', status: 'Active', desc: 'Unified data exchange for 400M+ water quality records. PIN integrates as a consumer.' },
                  { name: 'Chesapeake Bay TMDL Partnership', agencies: 'EPA + 6 states + DC', status: 'Active', desc: 'Nutrient and sediment reduction targets. 2025 milestones approaching.' },
                  { name: 'Great Lakes Restoration Initiative', agencies: 'EPA + NOAA + USFS + USFWS', status: 'Active', desc: '$3.2B invested since 2010. HAB reduction, invasive species, habitat restoration.' },
                  { name: 'PFAS Strategic Roadmap', agencies: 'EPA + DoD + USGS', status: 'Active', desc: 'Coordinated PFAS research, monitoring, and remediation across federal sites.' },
                  { name: 'National Integrated Drought Information System', agencies: 'NOAA + USGS + USDA', status: 'Active', desc: 'Early warning and monitoring for drought impacts on water supply and quality.' },
                ].map(init => (
                  <div key={init.name} className="border border-slate-200 rounded-lg p-4 hover:border-blue-200 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-slate-800">{init.name}</h4>
                      <Badge variant="outline" className="text-[10px] text-green-700 border-green-200 bg-green-50">{init.status}</Badge>
                    </div>
                    <div className="text-[10px] text-blue-600 font-medium mb-1.5">{init.agencies}</div>
                    <p className="text-xs text-slate-500 leading-relaxed">{init.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Gaps */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Inter-Agency Data Gaps</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { gap: 'Groundwater–Surface Water Linkage', detail: 'USGS groundwater and EPA surface water data rarely cross-referenced at the site level.' },
                  { gap: 'DoD Installation Monitoring', detail: '38% of DoD cleanup sites lack public-facing water quality data in WQX.' },
                  { gap: 'Agricultural Nonpoint Source', detail: 'USDA BMP effectiveness data not linked to downstream impairment reductions.' },
                  { gap: 'Tribal Water Data', detail: 'Only 23% of tribal nations have water quality data in federal databases.' },
                ].map(g => (
                  <div key={g.gap} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <h4 className="text-sm font-semibold text-amber-800">{g.gap}</h4>
                    <p className="text-xs text-amber-700 mt-1 leading-relaxed">{g.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        </>);

        case 'funding-landscape': return DS(<>
        {/* ── FUNDING & GRANT LANDSCAPE ── */}
        <Card>
          <CardHeader>
            <CardTitle>Funding & Grant Landscape</CardTitle>
            <CardDescription>Federal water infrastructure funding, grant opportunities, and deadline tracking</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Funding KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'BIL Water Funding', value: '$55B', sub: 'Bipartisan Infrastructure Law', color: 'text-green-600' },
                { label: 'SRF Available', value: '$12.7B', sub: 'Clean Water + Drinking Water SRF', color: 'text-blue-600' },
                { label: 'Active Grants', value: '847', sub: 'open federal opportunities', color: 'text-violet-600' },
                { label: 'Closing This Quarter', value: '23', sub: 'deadlines in next 90 days', color: 'text-amber-600' },
              ].map(k => (
                <div key={k.label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                  <div className={`text-2xl font-bold ${k.color} mt-1`}>{k.value}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Major Funding Programs */}
            <div>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Major Federal Funding Programs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { program: 'Clean Water State Revolving Fund (CWSRF)', amount: '$7.4B', agency: 'EPA', eligible: 'States, municipalities', desc: 'Low-interest loans for wastewater, stormwater, and nonpoint source projects.' },
                  { program: 'Drinking Water State Revolving Fund (DWSRF)', amount: '$5.3B', agency: 'EPA', eligible: 'Public water systems', desc: 'Infrastructure improvements, lead service line replacement, PFAS treatment.' },
                  { program: 'EPA 319(h) Nonpoint Source Grants', amount: '$170M', agency: 'EPA', eligible: 'States, tribes', desc: 'Watershed-based plans and BMP implementation for nonpoint source pollution.' },
                  { program: 'WIFIA Loans', amount: '$13B capacity', agency: 'EPA', eligible: 'Large utilities', desc: 'Low-cost supplemental loans for projects ≥$20M. Leverages private investment.' },
                  { program: 'USDA Water & Waste Disposal', amount: '$1.8B', agency: 'USDA', eligible: 'Rural communities', desc: 'Grants and loans for rural water/wastewater systems serving ≤10,000 people.' },
                  { program: 'FEMA BRIC (Building Resilient Infrastructure)', amount: '$2.3B', agency: 'FEMA', eligible: 'State/local/tribal', desc: 'Pre-disaster mitigation including flood control and stormwater infrastructure.' },
                ].map(p => (
                  <div key={p.program} className="border border-slate-200 rounded-lg p-4 hover:border-green-300 hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm font-semibold text-slate-800">{p.program}</h4>
                      <span className="text-sm font-bold text-green-600">{p.amount}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-[10px]">{p.agency}</Badge>
                      <span className="text-[10px] text-slate-500">{p.eligible}</span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Impairment → Grant Matching */}
            <div className="border border-blue-200 bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">Impairment-to-Grant Matching</h3>
              <p className="text-xs text-blue-700 leading-relaxed mb-3">
                Match your state&apos;s top impairments to eligible federal funding programs. Connect Category 5 waterbodies to 319(h) grants, PFAS detections to DWSRF emerging contaminant set-asides, and infrastructure needs to WIFIA/BIL funding.
              </p>
              <Button
                variant={showGrantMatcher ? 'default' : 'outline'}
                size="sm"
                className="text-xs border-blue-300 text-blue-700 hover:bg-blue-100"
                onClick={() => setShowGrantMatcher(prev => !prev)}
              >
                {showGrantMatcher ? 'Hide Grant Analysis' : 'View Grant Performance Dashboard'}
              </Button>
            </div>

            {/* Grant Matching Results */}
            {showGrantMatcher && (
              <GrantOpportunityMatcher
                regionId={selectedState.toLowerCase()}
                removalEfficiencies={{ TSS: 90, TN: 45, TP: 55, bacteria: 85, DO: 30 }}
                alertsCount={nationalStats.totalAlerts}
                userRole="Federal"
                stateAbbr={selectedState}
              />
            )}
          </CardContent>
        </Card>
        </>);

        case 'funding-deadlines': return DS(<>
        {/* ── Upcoming Funding Deadlines ── */}
        <Card id="section-funding-deadlines" className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Upcoming Funding Deadlines
                <span className="text-[10px] font-normal text-slate-400 ml-1">
                  {(() => { const now = new Date(); return [
                    { deadline: '2026-03-28' }, { deadline: '2026-04-01' }, { deadline: '2026-05-15' },
                    { deadline: '2026-06-15' }, { deadline: '2026-07-31' }, { deadline: '2026-08-30' },
                    { deadline: '2026-09-30' },
                  ].filter(d => new Date(d.deadline) > now && new Date(d.deadline) <= new Date(now.getTime() + 90 * 86400000)).length; })()}{' '}closing in 90 days
                </span>
              </CardTitle>
              <BrandedPrintBtn sectionId="funding-deadlines" title="Funding Deadlines" />
            </div>
            <CardDescription>Active program windows across federal water funding</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-2 pr-3 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Program</th>
                    <th className="text-left py-2 pr-3 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Deadline</th>
                    <th className="text-left py-2 pr-3 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Eligible</th>
                    <th className="text-right py-2 pr-3 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Available</th>
                    <th className="text-center py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { program: 'FEMA BRIC — Sub-applications', deadline: '2026-03-28', entity: 'State/local/tribal', amount: '$2.3B', urgency: 'closing' },
                    { program: 'EPA 319(h) Work Plans', deadline: '2026-04-01', entity: 'States, Tribes', amount: '$170M', urgency: 'closing' },
                    { program: 'BIL Emerging Contaminants', deadline: '2026-05-15', entity: 'Public water systems', amount: '$5B', urgency: 'open' },
                    { program: 'DWSRF — Lead Service Line', deadline: '2026-06-15', entity: 'Water systems', amount: '$3.2B', urgency: 'open' },
                    { program: 'WIFIA Letter of Interest', deadline: '2026-07-31', entity: 'Large utilities (≥$20M)', amount: '$13B capacity', urgency: 'open' },
                    { program: 'DWSRF EC Set-Aside (PFAS)', deadline: '2026-08-30', entity: 'States', amount: '$4B', urgency: 'open' },
                    { program: 'CWSRF Intended Use Plans', deadline: '2026-09-30', entity: 'States, municipalities', amount: '$7.4B', urgency: 'open' },
                    { program: 'USDA RD Water & Waste', deadline: 'Rolling', entity: 'Rural communities (<10K)', amount: '$1.8B', urgency: 'always' },
                  ].sort((a, b) => {
                    if (a.deadline === 'Rolling') return 1;
                    if (b.deadline === 'Rolling') return -1;
                    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                  }).map((d, i) => {
                    const isClosing = d.urgency === 'closing';
                    const daysLeft = d.deadline !== 'Rolling'
                      ? Math.ceil((new Date(d.deadline).getTime() - Date.now()) / 86400000)
                      : null;
                    return (
                      <tr key={i} className={`border-b border-slate-100 ${isClosing ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-slate-800">{d.program}</div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className={`font-medium ${isClosing ? 'text-amber-700' : 'text-slate-700'}`}>
                            {d.deadline === 'Rolling' ? 'Rolling' : new Date(d.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          {daysLeft !== null && daysLeft > 0 && (
                            <div className={`text-[10px] ${daysLeft <= 45 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                              {daysLeft} days left
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600">{d.entity}</td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-green-700">{d.amount}</td>
                        <td className="py-2.5 text-center">
                          <Badge variant="outline" className={`text-[10px] ${
                            d.urgency === 'closing' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            d.urgency === 'always' ? 'bg-green-100 text-green-800 border-green-300' :
                            'bg-blue-100 text-blue-800 border-blue-300'
                          }`}>
                            {d.urgency === 'closing' ? 'Closing Soon' : d.urgency === 'always' ? 'Always Open' : 'Open'}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        </>);

        case 'funding-state': {
          const fundingRow = stateRollup.find(r => r.abbr === selectedState);
          const fundingStateName = STATE_ABBR_TO_NAME[selectedState] || selectedState;
          // Derive estimated SRF share based on proportion of national impairments
          const nationalImpaired = stateRollup.reduce((s, r) => s + r.totalImpaired, 0);
          const stateShare = fundingRow && nationalImpaired > 0
            ? (fundingRow.totalImpaired / nationalImpaired)
            : 0;
          const estimatedSrf = Math.round(stateShare * 12_700_000_000);
          // Map top causes to eligible programs
          const causeToPrograms: Record<string, string[]> = {
            'Nutrients': ['CWSRF', '319(h)'],
            'Pathogens': ['319(h)', 'CWSRF'],
            'Sediment': ['319(h)', 'USDA'],
            'Organic Enrichment/Oxygen Depletion': ['CWSRF', '319(h)'],
            'Temperature': ['319(h)'],
            'Metals (other than Mercury)': ['CWSRF', 'Superfund'],
            'Mercury': ['Superfund', 'CWSRF'],
            'pH/Acidity/Caustic Conditions': ['CWSRF'],
            'Cause Unknown': [],
            'Polychlorinated Biphenyls (PCBs)': ['Superfund'],
            'Turbidity': ['319(h)', 'USDA'],
            'Algal Growth': ['CWSRF', '319(h)'],
            'Total Toxics': ['CWSRF', 'Superfund'],
            'Salinity/Total Dissolved Solids/Chlorides/Sulfates': ['CWSRF'],
          };
          const topProgramsForState = new Map<string, number>();
          for (const c of (fundingRow?.topCauses || []).slice(0, 5)) {
            // Find matching programs by partial key match
            for (const [causeKey, progs] of Object.entries(causeToPrograms)) {
              if (c.cause.toLowerCase().includes(causeKey.toLowerCase().slice(0, 8))) {
                for (const p of progs) topProgramsForState.set(p, (topProgramsForState.get(p) || 0) + c.count);
              }
            }
          }

          return DS(<>
        <Card id="section-funding-state" className="border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-sky-600" />
                  Your State Funding Snapshot
                </CardTitle>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="px-2 py-1 rounded-md border border-slate-300 text-xs bg-white cursor-pointer hover:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-300"
                >
                  {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                    <option key={abbr} value={abbr}>{name} ({abbr})</option>
                  ))}
                </select>
              </div>
              <BrandedPrintBtn sectionId="funding-state" title={`${fundingStateName} Funding Snapshot`} />
            </div>
            <CardDescription>State-level funding allocation, impairment categories, and eligible programs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* State KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Est. SRF Allocation</div>
                <div className="text-xl font-bold text-green-600 mt-1">
                  {estimatedSrf >= 1e9 ? `$${(estimatedSrf / 1e9).toFixed(1)}B` : estimatedSrf >= 1e6 ? `$${(estimatedSrf / 1e6).toFixed(0)}M` : `$${(estimatedSrf / 1e3).toFixed(0)}K`}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">CWSRF + DWSRF combined</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Impaired Waterbodies</div>
                <div className="text-xl font-bold text-red-600 mt-1">{(fundingRow?.totalImpaired || 0).toLocaleString()}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Cat 4 + Cat 5</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cat 5 (303(d))</div>
                <div className="text-xl font-bold text-amber-600 mt-1">{(fundingRow?.cat5 || 0).toLocaleString()}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Requiring TMDL</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Assessed</div>
                <div className="text-xl font-bold text-blue-600 mt-1">{(fundingRow?.assessed || 0).toLocaleString()}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">EPA ATTAINS</div>
              </div>
            </div>

            {/* Top impairment causes → eligible programs */}
            {fundingRow && fundingRow.topCauses.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">Top Impairment Causes & Eligible Programs</h4>
                <div className="space-y-2">
                  {fundingRow.topCauses.slice(0, 5).map((c, i) => {
                    const matchedPrograms: string[] = [];
                    for (const [causeKey, progs] of Object.entries(causeToPrograms)) {
                      if (c.cause.toLowerCase().includes(causeKey.toLowerCase().slice(0, 8))) {
                        matchedPrograms.push(...progs);
                      }
                    }
                    const uniquePrograms = [...new Set(matchedPrograms)];
                    return (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-bold text-slate-400 w-5">{i + 1}</span>
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-slate-800 truncate">{c.cause}</div>
                            <div className="text-[10px] text-slate-500">{c.count.toLocaleString()} waterbodies affected</div>
                          </div>
                        </div>
                        <div className="flex gap-1 flex-wrap justify-end shrink-0 ml-2">
                          {uniquePrograms.length > 0 ? uniquePrograms.map(p => (
                            <Badge key={p} variant="outline" className="text-[10px] py-0 px-1.5 h-5 bg-green-50 text-green-700 border-green-200">{p}</Badge>
                          )) : (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5 text-slate-400">—</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* State-specific insight */}
            <div className="bg-sky-50 border-l-2 border-sky-400 rounded-lg p-3">
              <div className="text-xs text-sky-800 leading-relaxed">
                <span className="font-semibold">{fundingStateName}</span> has{' '}
                {(fundingRow?.totalImpaired || 0).toLocaleString()} impaired waterbodies eligible for federal remediation funding.
                {fundingRow && fundingRow.cat5 > 0 && (
                  <> Of these, <span className="font-semibold">{fundingRow.cat5.toLocaleString()}</span> are Category 5 (303(d) listed), requiring TMDLs and eligible for 319(h) grants.</>
                )}
                {' '}Use Grant Matching below to find specific programs for your jurisdiction.
              </div>
            </div>
          </CardContent>
        </Card>
        </>);
        }

        case 'funding-matrix': return DS(<>
        {/* ── Impairment-to-Program Reference Matrix ── */}
        <Card id="section-funding-matrix" className="border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-slate-600" />
                Impairment-to-Program Matrix
              </CardTitle>
              <BrandedPrintBtn sectionId="funding-matrix" title="Impairment-to-Program Matrix" />
            </div>
            <CardDescription>Quick reference: which federal programs fund which impairment types</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-200">
                    <th className="text-left py-2 pr-3 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Impairment Type</th>
                    <th className="text-left py-2 pr-3 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Primary Programs</th>
                    <th className="text-left py-2 pr-3 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Funding Type</th>
                    <th className="text-left py-2 font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Typical Use</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { icon: '🌿', impairment: 'Nutrients (N/P)', programs: ['CWSRF', '319(h)'], type: 'Loans + Grants', use: 'WWTP upgrades, ag BMPs, buffer strips' },
                    { icon: '⚗️', impairment: 'PFAS / Emerging Contaminants', programs: ['DWSRF EC Set-Aside', 'BIL EC'], type: 'Grants', use: 'Treatment systems, source investigation' },
                    { icon: '🦠', impairment: 'Bacteria / Pathogens', programs: ['319(h)', 'CWSRF'], type: 'Grants + Loans', use: 'Septic repair, WWTP upgrades, CSO control' },
                    { icon: '🌧️', impairment: 'Stormwater / Flooding', programs: ['FEMA BRIC', 'BIL', 'CWSRF'], type: 'Grants', use: 'Green infrastructure, retention, flood control' },
                    { icon: '🔩', impairment: 'Lead / Copper (LCRR)', programs: ['DWSRF'], type: 'Loans + Grants', use: 'Lead service line replacement' },
                    { icon: '🏔️', impairment: 'Sediment / Erosion', programs: ['319(h)', 'USDA'], type: 'Grants', use: 'Erosion control, streambank stabilization' },
                    { icon: '☣️', impairment: 'Mercury / PCBs', programs: ['Superfund', 'CWSRF'], type: 'Various', use: 'Source control, fish tissue monitoring' },
                    { icon: '🏗️', impairment: 'Aging Infrastructure', programs: ['WIFIA', 'CWSRF', 'BIL'], type: 'Loans', use: 'Pipe replacement, capacity upgrades' },
                  ].map((row, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{row.icon}</span>
                          <span className="font-medium text-slate-800">{row.impairment}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex gap-1 flex-wrap">
                          {row.programs.map(p => (
                            <Badge key={p} variant="outline" className="text-[10px] py-0 px-1.5 h-5 bg-green-50 text-green-700 border-green-200">{p}</Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{row.type}</td>
                      <td className="py-2.5 text-slate-500">{row.use}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
              <ArrowRight className="h-3 w-3" />
              Use the Grant Matching Analysis above for AI-powered program recommendations based on your specific impairments.
            </div>
          </CardContent>
        </Card>
        </>);

        case 'grant-outcomes': return DS(<>
        {/* ── Historical Grant Outcomes ── */}
        <GrantOutcomesCard onRunAnalysis={() => setShowGrantMatcher(true)} />
        </>);

        case 'funding-gap': {
          const gapRow = stateRollup.find(r => r.abbr === selectedState);
          const gapStateName = STATE_ABBR_TO_NAME[selectedState] || selectedState;
          const gapNationalImpaired = stateRollup.reduce((s, r) => s + r.totalImpaired, 0);
          // Cost estimates per impaired waterbody (EPA TMDL implementation averages)
          const avgCostPerWaterbody = 2_500_000; // $2.5M average remediation
          const stateImpairedCount = gapRow?.totalImpaired || 0;
          const estimatedCost = stateImpairedCount * avgCostPerWaterbody;
          // Estimated available funding (proportional SRF share)
          const gapStateShare = gapRow && gapNationalImpaired > 0 ? (gapRow.totalImpaired / gapNationalImpaired) : 0;
          const estimatedFunding = Math.round(gapStateShare * 12_700_000_000);
          const fundingGap = Math.max(0, estimatedCost - estimatedFunding);
          const coveragePct = estimatedCost > 0 ? Math.min(100, Math.round((estimatedFunding / estimatedCost) * 100)) : 0;

          // National totals
          const natCost = gapNationalImpaired * avgCostPerWaterbody;
          const natFunding = 12_700_000_000;
          const natGap = Math.max(0, natCost - natFunding);
          const natCoveragePct = natCost > 0 ? Math.min(100, Math.round((natFunding / natCost) * 100)) : 0;

          const fmtDollars = (n: number) => n >= 1e12 ? `$${(n / 1e12).toFixed(1)}T` : n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(0)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n}`;

          return DS(<>
        <Card id="section-funding-gap" className="border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-rose-600" />
                Funding Gap Analysis
              </CardTitle>
              <BrandedPrintBtn sectionId="funding-gap" title="National Funding Gap" />
            </div>
            <CardDescription>Estimated compliance cost vs. available federal funding for impaired waterbodies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* National Summary Tiles */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="rounded-xl border-2 border-slate-200 bg-slate-50 p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Need</div>
                <div className="text-xl font-bold text-slate-800 mt-1">{fmtDollars(natCost)}</div>
              </div>
              <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-green-500">Available</div>
                <div className="text-xl font-bold text-green-700 mt-1">{fmtDollars(natFunding)}</div>
              </div>
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Coverage</div>
                <div className="text-xl font-bold text-amber-700 mt-1">{natCoveragePct}%</div>
              </div>
              <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Gap</div>
                <div className="text-xl font-bold text-rose-700 mt-1">{fmtDollars(natGap)}</div>
              </div>
            </div>

            {/* Drill Down by State — collapsible */}
            <details className="border border-slate-200 rounded-lg">
              <summary className="px-4 py-2.5 cursor-pointer text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 select-none">
                Drill Down by State
              </summary>
              <div className="px-4 pb-4 pt-2">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="px-2 py-1 rounded-md border border-slate-300 text-xs bg-white cursor-pointer hover:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-300 mb-3"
                >
                  {Object.entries(STATE_ABBR_TO_NAME).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
                    <option key={abbr} value={abbr}>{name} ({abbr})</option>
                  ))}
                </select>

            {/* State Gap Visualization */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-red-500">Estimated Compliance Cost</div>
                <div className="text-2xl font-bold text-red-700 mt-1">{fmtDollars(estimatedCost)}</div>
                <div className="text-[10px] text-red-400 mt-1">{stateImpairedCount.toLocaleString()} impaired waterbodies × $2.5M avg</div>
              </div>
              <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-green-500">Available Federal Funding</div>
                <div className="text-2xl font-bold text-green-700 mt-1">{fmtDollars(estimatedFunding)}</div>
                <div className="text-[10px] text-green-400 mt-1">Est. SRF allocation (CWSRF + DWSRF)</div>
              </div>
              <div className="rounded-xl border-2 border-rose-300 bg-rose-100 p-4 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-rose-600">Funding Gap</div>
                <div className="text-2xl font-bold text-rose-700 mt-1">{fmtDollars(fundingGap)}</div>
                <div className="text-[10px] text-rose-500 mt-1">
                  {coveragePct}% of estimated need covered
                </div>
              </div>
            </div>

            {/* Coverage Bar */}
            <div>
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>{gapStateName} Federal Funding Coverage</span>
                <span className="font-semibold">{coveragePct}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${coveragePct}%`,
                    backgroundColor: coveragePct >= 50 ? '#16a34a' : coveragePct >= 25 ? '#d97706' : '#dc2626',
                  }}
                />
              </div>
            </div>
              </div>
            </details>

            {/* National Context */}
            <div className="border border-slate-200 rounded-lg p-4 bg-white">
              <h4 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">National Context</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-lg font-bold text-slate-700">{gapNationalImpaired.toLocaleString()}</div>
                  <div className="text-[10px] text-slate-500">Impaired Waterbodies</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">{fmtDollars(natCost)}</div>
                  <div className="text-[10px] text-slate-500">Est. National Cost</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">{fmtDollars(natFunding)}</div>
                  <div className="text-[10px] text-slate-500">Available SRF</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-rose-600">{fmtDollars(natGap)}</div>
                  <div className="text-[10px] text-slate-500">National Gap ({natCoveragePct}% covered)</div>
                </div>
              </div>
            </div>

            {/* Urgency callout */}
            <div className="bg-rose-50 border-l-2 border-rose-400 rounded-lg p-3">
              <div className="text-xs text-rose-800 leading-relaxed">
                <span className="font-bold">The gap drives urgency.</span>{' '}
                {gapStateName} needs an estimated <span className="font-semibold">{fmtDollars(estimatedCost)}</span> to address all impaired waterbodies,
                but current federal SRF allocations cover approximately <span className="font-semibold">{coveragePct}%</span> of that need.
                {fundingGap > 0 && <> The remaining <span className="font-semibold">{fmtDollars(fundingGap)}</span> gap requires state matching funds, competitive grants, and strategic prioritization.</>}
              </div>
            </div>

            {/* CTA */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-rose-300 text-rose-700 hover:bg-rose-100"
                onClick={() => setShowGrantMatcher(true)}
              >
                Compare State Allocations
              </Button>
              <span className="text-[10px] text-slate-400">Methodology: $2.5M avg per impaired waterbody based on EPA TMDL implementation cost studies</span>
            </div>
          </CardContent>
        </Card>
        </>);
        }

        case 'waterbody-card': return DS(<>{/* now rendered inside impairmentprofile */}</>);

        case 'resolution-planner': return DS(<>
        {/* ── Response Planner — AI-powered action planning ── */}
        <div id="section-resolution-planner">
          <ResolutionPlanner
            scopeContext={resolutionPlannerScope}
            userRole="federal"
            dataReliability={dataReliability}
            dataReady={nationalSummary !== null || attainsBulkLoaded.size > 0}
          />
        </div>
        </>);

        case 'habitat-ecology': return DS(<>
        {/* ── HABITAT & ECOLOGY ── */}
        <HabitatEcologyPanel stateRollup={stateRollup} selectedState={selectedState} attainsData={attainsBulk} />
        </>);

        case 'agricultural-nps': return DS(<>
        {/* ── AGRICULTURAL & NONPOINT SOURCE ── */}
        <AgriculturalNPSPanel stateRollup={stateRollup} selectedState={selectedState} attainsBulk={attainsBulk} />
        </>);

        case 'disaster-emergency': return DS(<>
        {/* ── DISASTER & EMERGENCY RESPONSE ── */}
        <AMSAlertMonitor
          summary={amsSummary ?? MOCK_ALERT_SUMMARY}
          role="FEDERAL_OVERSIGHT"
        />
        <DisasterEmergencyPanel selectedState={selectedState} stateRollup={stateRollup} />
        </>);

        case 'military-installations': return DS(<>
        {/* ── MILITARY INSTALLATIONS ── */}
        <MilitaryInstallationsPanel selectedState={selectedState} />
        </>);

        case 'sentinel-briefing': return DS(<>
        {/* ── SENTINEL SYSTEM HEALTH ── */}
        <div className="space-y-4">
          {sentinelHealth.isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-white/10 rounded w-48" />
              <div className="h-20 bg-white/5 rounded" />
            </div>
          ) : !sentinelHealth.enabled ? (
            <p className="text-sm text-white/40">Sentinel system is disabled.</p>
          ) : (
            <>
              {/* Overall health badge + uptime */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  sentinelHealth.overallHealth === 'healthy'  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  sentinelHealth.overallHealth === 'degraded' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  sentinelHealth.overallHealth === 'critical' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                                                'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    sentinelHealth.overallHealth === 'healthy'  ? 'bg-emerald-400' :
                    sentinelHealth.overallHealth === 'degraded' ? 'bg-amber-400' :
                    sentinelHealth.overallHealth === 'critical' ? 'bg-red-400' :
                                                                  'bg-zinc-400'
                  }`} />
                  {sentinelHealth.overallHealth.toUpperCase()}
                </span>
                <span className="text-xs text-white/50">
                  Uptime {sentinelHealth.uptimePct.toFixed(0)}%
                </span>
                <span className="text-xs text-white/40">
                  {sentinelHealth.healthyCt} healthy · {sentinelHealth.degradedCt} degraded · {sentinelHealth.offlineCt} offline
                </span>
                {sentinelHealth.trend !== 'stable' && (
                  <span className={`text-xs ${sentinelHealth.trend === 'improving' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {sentinelHealth.trend === 'improving' ? '↑ Improving' : '↓ Degrading'}
                  </span>
                )}
              </div>

              {/* Per-source status rows */}
              <div className="grid gap-1.5">
                {sentinelHealth.sources.map(s => (
                  <div key={s.source} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded bg-white/[0.03]">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      s.status === 'HEALTHY'  ? 'bg-emerald-400' :
                      s.status === 'DEGRADED' ? 'bg-amber-400' :
                                                 'bg-red-400'
                    }`} />
                    <span className="text-white/70 w-24 truncate font-mono">{s.source}</span>
                    <span className="text-white/40 flex-1">
                      {s.lastPollAt ? `Last poll ${new Date(s.lastPollAt).toLocaleTimeString()}` : 'Never polled'}
                    </span>
                    {s.overdue && (
                      <span className="text-red-400 font-medium">OVERDUE</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Queue depth */}
              {sentinelHealth.queue && (
                <div className="flex items-center gap-3 text-xs text-white/50">
                  <span>Queue total: <span className="text-white/70 font-medium">{sentinelHealth.queue.total}</span></span>
                  <span>Last 1h: <span className="text-white/70 font-medium">{sentinelHealth.queue.last1h}</span></span>
                  <span>Last 24h: <span className="text-white/70 font-medium">{sentinelHealth.queue.last24h}</span></span>
                </div>
              )}

              {/* Overdue sources callout */}
              {sentinelHealth.overdueSources.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-red-300">
                    <span className="font-semibold">{sentinelHealth.overdueSources.length} overdue source{sentinelHealth.overdueSources.length > 1 ? 's' : ''}:</span>{' '}
                    {sentinelHealth.overdueSources.join(', ')}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        </>);

        case 'waterfront-exposure': return DS(
          <WaterfrontExposurePanel selectedState={selectedState} stateRollup={stateRollup} />
        );

        case 'location-report': return DS(<LocationReportCard />);

        case 'sentinel-alerts-placeholder': return DS(
        <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid #F9A82540', borderLeft: '3px solid #F9A825' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: '#F9A82520' }}>
              <Shield className="w-5 h-5" style={{ color: '#F9A825' }} />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                Coming Soon — Sentinel Alerts
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ background: '#F9A82520', color: '#F9A825', border: '1px solid #F9A82540' }}>PLANNED</span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                {viewLens === 'compliance'
                  ? 'Automated alerts for SNC status changes, enforcement actions, DMR exceedances, and permit expiration warnings.'
                  : 'Real-time Sentinel monitoring alerts for water quality events, threshold exceedances, and emerging issues.'}
              </p>
            </div>
          </div>
        </div>
        );

        case 'data-latency': return DS(
          <DataLatencyTracker />
        );

        case 'warr-metrics': return DS(<>
        {/* ── WATCH ZONE: Key National Metrics Strip ── */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-teal)' }} />
            WATCH
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Gauge className="w-4 h-4" style={{ color: networkHealth.color === 'green' ? 'var(--status-healthy)' : networkHealth.color === 'yellow' ? 'var(--status-warning)' : 'var(--status-severe)' }} />
                <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-dim)' }}>Network Health</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-bright)' }}>
                {networkHealth.percentage >= 0 ? `${networkHealth.percentage}%` : '—'}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                {networkHealth.grade.letter} grade · {networkHealth.gradedStateCount ?? 0} states
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" style={{ color: 'var(--status-warning)' }} />
                <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-dim)' }}>Impairment Rate</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-bright)' }}>
                {scorecardData.impairmentPct}%
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                {scorecardData.totalImpaired.toLocaleString()} of {scorecardData.totalAssessed.toLocaleString()} waterbodies
              </div>
            </div>
            <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4" style={{ color: 'var(--accent-teal)' }} />
                <span className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: 'var(--text-dim)' }}>Sentinel Events</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--text-bright)' }}>
                {sentinel.criticalHucs.length + sentinel.watchHucs.length}
              </div>
              <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                {sentinel.criticalHucs.length} critical · {sentinel.watchHucs.length} watch
              </div>
            </div>
          </div>
        </div>
        </>);

        case 'warr-analyze': return DS(<>
        {/* ── ANALYZE ZONE: PIN Insights ── */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            ANALYZE
          </div>
          <AIInsightsEngine
            role="Federal"
            stateAbbr={selectedState || 'US'}
            nationalData={nationalAIData}
          />
        </div>
        </>);

        case 'warr-respond': return DS(<>
        {/* ── RESPOND ZONE: Top 3 Sentinel Events ── */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            RESPOND
          </div>
          {[...sentinel.criticalHucs, ...sentinel.watchHucs].sort((a, b) => b.score - a.score).slice(0, 3).length > 0 ? (
            <div className="space-y-2">
              {[...sentinel.criticalHucs, ...sentinel.watchHucs].sort((a, b) => b.score - a.score).slice(0, 3).map(h => {
                const stateAbbr = FIPS_TO_ABBR[h.huc8.slice(0, 2)] || '';
                const hucName = hucNames[h.huc8] ?? h.huc8;
                const severity = h.score >= 400 ? 'Critical' : h.score >= 300 ? 'Severe' : h.score >= 200 ? 'Elevated' : 'Watch';
                return (
                  <div
                    key={h.huc8}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${h.level === 'CRITICAL' ? '#D32F2F40' : 'var(--border-subtle)'}`,
                      borderLeft: `3px solid ${h.level === 'CRITICAL' ? '#D32F2F' : '#F9A825'}`,
                    }}
                  >
                    {h.level === 'CRITICAL' ? (
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <Eye className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" style={{ color: 'var(--text-bright)' }}>
                        {hucName}{stateAbbr ? `, ${stateAbbr}` : ''}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--text-dim)' }}>
                        {h.eventCount} signal{h.eventCount !== 1 ? 's' : ''} · {h.patternNames.map(p => p.replace(/-/g, ' ')).join(' + ')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className="sentinel-score-badge text-[10px]"
                        data-level={h.level}
                        style={{ width: '24px', height: '24px', fontSize: '10px' }}
                      >
                        {Math.round(h.score)}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-dim)' }}>/500</span>
                      <span className="text-[9px] font-medium" style={{ color: h.score >= 400 ? '#D32F2F' : h.score >= 300 ? '#E65100' : '#F9A825' }}>{severity}</span>
                    </div>
                  </div>
                );
              })}
              <button
                onClick={() => setViewLens('briefing' as ViewLens)}
                className="w-full text-center py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ color: 'var(--text-secondary)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                View all events in AI Briefing →
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-lg text-center text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <CheckCircle className="w-4 h-4 mx-auto mb-1" style={{ color: 'var(--status-healthy)' }} />
              No active Sentinel events. All monitored watersheds within normal parameters.
            </div>
          )}
        </div>
        </>);

        case 'warr-resolve': return DS(<>
        {/* ── RESOLVE ZONE: Active Response Tracking ── */}
        <div>
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2 flex items-center gap-2" style={{ color: 'var(--text-dim)' }}>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            RESOLVE
          </div>
          <div className="rounded-lg p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Active Response Plans</div>
              <button
                onClick={() => setViewLens('planner' as ViewLens)}
                className="text-[10px] font-medium px-2 py-1 rounded transition-colors"
                style={{ color: 'var(--accent-teal)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
              >
                Open Resolution Planner →
              </button>
            </div>
            <div className="space-y-2">
              {sentinel.criticalHucs.length > 0 ? (
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {sentinel.criticalHucs.length} critical watershed{sentinel.criticalHucs.length !== 1 ? 's' : ''} pending response plan generation.
                  Use the Resolution Planner to create targeted action plans.
                </div>
              ) : (
                <div className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  No watersheds currently require response plans. Sentinel is actively monitoring.
                </div>
              )}
            </div>
          </div>
        </div>
        </>);

        // ── AI Briefing: National Scope Cards ──────────────────────────────
        case 'briefing-actions': return DS(
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Action Required — National
              </CardTitle>
              <CardDescription>Federal-level items requiring immediate attention across all states</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { id: 'fed-act-1', priority: 'High', item: '47 NPDES permits expiring within 30 days across 12 states — renewal packages incomplete', detail: 'States most affected: TX (8), CA (7), PA (6), OH (5). 14 are major facilities. EPA regional offices notified.', color: 'text-red-700 bg-red-50 border-red-200' },
                  { id: 'fed-act-2', priority: 'High', item: 'EPA Administrator requesting consolidated TMDL progress briefing for congressional testimony', detail: 'Testimony scheduled Mar 18 before House T&I Committee. Need 50-state rollup of TMDL completion rates and restoration success stories.', color: 'text-red-700 bg-red-50 border-red-200' },
                  { id: 'fed-act-3', priority: 'Medium', item: '8 consent decree milestone reports due across 5 EPA regions next month', detail: 'Regions 1, 3, 4, 5, 9. Covers CSO long-term control plans (3), nutrient reduction (3), and stormwater management (2).', color: 'text-amber-700 bg-amber-50 border-amber-200' },
                  { id: 'fed-act-4', priority: 'Low', item: 'Quarterly WQX data submission window opens in 5 days — 23 states pending upload', detail: 'States with >1000 pending records: FL, NY, IL, MI, WI. Automated reminders sent. Compliance rate last quarter: 94%.', color: 'text-blue-700 bg-blue-50 border-blue-200' },
                ].map((a) => (
                  <div key={a.id}>
                    <div
                      className={`rounded-lg border p-3 cursor-pointer hover:ring-1 hover:ring-blue-300 transition-all ${a.color}`}
                      onClick={() => setComingSoonId(comingSoonId === a.id ? null : a.id)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{a.priority}</Badge>
                        <span className="text-xs flex-1">{a.item}</span>
                        <ChevronDown size={14} className={`flex-shrink-0 text-slate-400 transition-transform ${comingSoonId === a.id ? 'rotate-180' : ''}`} />
                      </div>
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
              <p className="text-xs text-slate-400 mt-4 italic">Data source: AI analysis of national permit database, EPA regional correspondence, and program deadlines</p>
            </CardContent>
          </Card>
        );

        case 'briefing-changes': return DS(
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                What Changed Overnight — National
              </CardTitle>
              <CardDescription>New data, alerts, and status changes across all 50 states since your last session</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { id: 'fed-chg-1', time: '2:14 AM', change: 'ATTAINS data refresh: 47 new Category 5 listings across 12 states for nutrient and bacteria impairment', detail: 'Largest increases: FL (+9), TX (+7), OH (+6), PA (+5). Primary causes: nutrients (28), bacteria (12), sediment (7). Net change after delistings: +31.' },
                  { id: 'fed-chg-2', time: '3:45 AM', change: 'ECHO enforcement update: 14 new significant non-compliance findings across 8 states', detail: 'Major facilities: 6, Minor: 8. Regions affected: R3 (4), R4 (3), R5 (3), R6 (2), R9 (2). 3 facilities already under consent decree.' },
                  { id: 'fed-chg-3', time: '5:30 AM', change: 'WDFN groundwater data: 23 monitoring wells in 9 states show declining water table trends', detail: 'States: AZ (5), CA (4), KS (3), NE (3), TX (3), OK (2), NM (1), CO (1), UT (1). Drought conditions contributing in western states.' },
                  { id: 'fed-chg-4', time: '6:00 AM', change: 'SDWIS update: MCL exceedances reported at 6 community water systems across 4 states', detail: 'PFAS: 3 systems (MA, NJ, MI). Lead: 2 systems (OH, IL). Nitrate: 1 system (IA). All have initiated public notification.' },
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
              <p className="text-xs text-slate-400 mt-4 italic">Data source: EPA ATTAINS, ECHO, SDWIS, USGS WDFN overnight batch updates — all 50 states</p>
            </CardContent>
          </Card>
        );

        case 'briefing-pulse': return DS(
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Program Pulse — National
              </CardTitle>
              <CardDescription>Key national program metrics at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { id: 'fed-pulse-permits', label: 'Active Permits', value: '74,200', trend: '+142', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dest: 'National permit registry' },
                  { id: 'fed-pulse-inspections', label: 'Open Inspections', value: '2,841', trend: '-87', color: 'text-green-700', bg: 'bg-green-50 border-green-200', dest: 'National inspection queue' },
                  { id: 'fed-pulse-tmdl', label: 'Pending TMDLs', value: '1,247', trend: '-23', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dest: 'National TMDL tracker' },
                  { id: 'fed-pulse-srf', label: 'SRF Utilization', value: '72%', trend: '+3%', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', dest: 'National SRF dashboard' },
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
              <p className="text-xs text-slate-400 mt-4 italic">Data source: National permit tracking, EPA ICIS, SRF loan management — all 50 states</p>
            </CardContent>
          </Card>
        );

        case 'briefing-stakeholder': return DS(
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-indigo-600" />
                Stakeholder Watch — National
              </CardTitle>
              <CardDescription>National stakeholder activity, congressional actions, and media coverage</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  { id: 'fed-stk-1', type: 'Congressional', detail: 'House T&I Committee hearing on CWA reauthorization — 3 water quality provisions under debate', status: 'Prepare Testimony', expandDetail: 'Hearing scheduled Mar 18. Key provisions: PFAS discharge limits, infrastructure funding formula, and tribal water rights. EPA testimony requested by Mar 12.' },
                  { id: 'fed-stk-2', type: 'Media', detail: 'National coverage of PFAS contamination at 14 military installations across 6 states', status: 'Active Response', expandDetail: 'AP, Reuters, and NYT coverage. DOD coordination ongoing. 6 states affected: NC, MI, CO, NM, AK, HI. Congressional inquiry from 8 members.' },
                  { id: 'fed-stk-3', type: 'NGO Coalition', detail: 'Environmental groups filed petition for accelerated TMDL development in 4 states', status: 'Legal Review', expandDetail: 'Petition targets FL, TX, OH, PA for alleged delays in TMDL development. Claims 200+ waterbodies awaiting TMDLs beyond statutory deadlines.' },
                  { id: 'fed-stk-4', type: 'Interagency', detail: 'USDA-EPA coordination meeting on agricultural nonpoint source funding — $2.1B allocation', status: 'Upcoming', expandDetail: 'Joint meeting Mar 22 at USDA. Topics: 319 grant alignment with NRCS EQIP, Conservation Reserve Enhancement Program, and nutrient trading pilots.' },
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
              <p className="text-xs text-slate-400 mt-4 italic">Data source: AI analysis of congressional tracking, national media monitoring, interagency coordination logs</p>
            </CardContent>
          </Card>
        );

        case 'disclaimer': return DS(
              <PlatformDisclaimer />
            );

        default: return null;
        } {/* end switch */}
      })} {/* end sections.map */}

      </div> {/* end space-y-6 isEditMode wrapper */}
      </>);
      }}

      </LayoutEditor>

      </div>

    </div>
  );
}

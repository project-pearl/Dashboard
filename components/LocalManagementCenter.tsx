'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLensParam } from '@/lib/useLensParam';
import HeroBanner from './HeroBanner';
import dynamic from 'next/dynamic';
import { STATE_GEO_LEAFLET, FIPS_TO_ABBR } from '@/lib/mapUtils';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { resolveWaterbodyCoordinates } from '@/lib/waterbodyCentroids';
import { useAuth } from '@/lib/authContext';
import { UserManagementPanel } from './UserManagementPanel';
import { getInvitableRoles } from '@/lib/adminHierarchy';
import RoleTrainingGuide from '@/components/RoleTrainingGuide';
import { useAdminState } from '@/lib/adminStateContext';
import { getStateMS4Jurisdictions } from '@/lib/stateWaterData';
import { getRegionMockData, calculateRemovalEfficiency, calculateOverallScore } from '@/lib/mockData';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);
const MapboxMarkers = dynamic(
  () => import('@/components/MapboxMarkers').then(m => m.MapboxMarkers),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);
const MS4FineAvoidanceCalculator = dynamic(
  () => import('@/components/MS4FineAvoidanceCalculator').then(m => m.MS4FineAvoidanceCalculator),
  { ssr: false }
);
const TMDLProgressAndReportGenerator = dynamic(
  () => import('@/components/TMDLProgressAndReportGenerator').then(m => m.TMDLProgressAndReportGenerator),
  { ssr: false }
);
const NutrientCreditsTrading = dynamic(
  () => import('@/components/NutrientCreditsTrading').then(m => m.NutrientCreditsTrading),
  { ssr: false }
);
const MDEExportTool = dynamic(
  () => import('@/components/MDEExportTool').then(m => m.MDEExportTool),
  { ssr: false }
);
const WaterQualityTradingPanel = dynamic(
  () => import('@/components/WaterQualityTradingPanel').then(m => m.WaterQualityTradingPanel),
  { ssr: false }
);

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Building2, Shield, AlertTriangle, CheckCircle, Droplets, TrendingUp,
  BarChart3, Info, Waves, Sparkles, Trophy, FileText, Banknote, DollarSign, Target, PieChart,
  Megaphone, CloudRain, Users, Activity, MapPin, Wrench, Clock,
  ShieldCheck, Heart, Scale, Gauge, Zap, AlertCircle, ChevronDown, HardHat, Leaf,
  Minus, Fish, ShieldAlert, Bug,
} from 'lucide-react';
import { DashboardSection } from './DashboardSection';
import { StatusCard } from './StatusCard';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { DataFreshnessFooter } from '@/components/DataFreshnessFooter';

import { NwisGwPanel } from '@/components/NwisGwPanel';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { GrantOpportunityMatcher } from '@/components/GrantOpportunityMatcher';
import { EmergingContaminantsTracker } from '@/components/EmergingContaminantsTracker';
import { RoleBriefingActionsCard } from '@/components/RoleBriefingCards';
import { getEcoData, getEcoScore, ecoScoreLabel } from '@/lib/ecologicalSensitivity';
import { ecoScoreStyle } from '@/lib/scoringUtils';
import { NUTRIENT_TRADING_STATES } from '@/lib/constants';
import { AskPinUniversalCard } from '@/components/AskPinUniversalCard';
import { TriageQueueSection } from './TriageQueueSection';
import CorrelationBreakthroughsPanel from '@/components/CorrelationBreakthroughsPanel';
import LensDataStory from '@/components/LensDataStory';
import { daysUntil, deadlineStatus, daysLabel } from '@/lib/formatDate';

// --- Types -------------------------------------------------------------------

type AlertLevel = 'none' | 'low' | 'medium' | 'high';

type ViewLens = 'overview' | 'briefing' | 'political-briefing' | 'water-quality'
  | 'infrastructure' | 'compliance' | 'stormwater' | 'public-health' | 'habitat'
  | 'funding' | 'ej-equity' | 'emergency' | 'scorecard' | 'reports'
  | 'trends' | 'policy' | 'wqt' | 'training' | 'users';

type Props = {
  jurisdictionId: string;
  stateAbbr: string;
  onSelectRegion?: (regionId: string) => void;
  onToggleDevMode?: () => void;
};

// --- Marker Color -------------------------------------------------------------

function getMarkerColor(wb: { alertLevel: AlertLevel }): string {
  return wb.alertLevel === 'high' ? '#ef4444' :
         wb.alertLevel === 'medium' ? '#f59e0b' :
         wb.alertLevel === 'low' ? '#eab308' : '#22c55e';
}

function cleanMojibake(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Lens Config -------------------------------------------------------------

const LENS_CONFIG: Record<ViewLens, {
  label: string;
  description: string;
  sections: Set<string>;
}> = {
  overview: {
    label: 'Overview',
    description: 'Jurisdiction dashboard - morning check for elected officials',
    sections: new Set([
      'local-identity', 'map-grid', 'local-kpi-strip', 'local-situation', 'local-quick-actions', 'ask-pin-universal', 'correlation-breakthroughs', 'disclaimer',
      'lens-data-story']),
  },
  briefing: {
    label: 'AI Briefing',
    description: 'AI-generated overnight summary and action items',
    sections: new Set([
      'briefing-actions', 'triage-queue', 'local-constituent-tldr', 'ask-pin-universal', 'correlation-breakthroughs', 'disclaimer',
      'lens-data-story']),
  },
  'political-briefing': {
    label: 'Political Briefing',
    description: 'Talking points, funding optics, EJ exposure, and council agenda suggestions',
    sections: new Set([
      'pol-talking-points', 'pol-constituent-concerns', 'pol-funding-wins', 'pol-funding-risks',
      'pol-regulatory-deadlines', 'pol-ej-exposure', 'pol-media-ready-grades',
      'pol-peer-comparison', 'pol-council-agenda', 'disclaimer',
      'lens-data-story']),
  },
  'water-quality': {
    label: 'Water Quality',
    description: 'Local water quality grades, impairments, and trends',
    sections: new Set([
      'local-wq-grade', 'detail', 'local-impairment-summary',
      'local-wq-trends', 'groundwater', 'contaminants-tracker', 'correlation-breakthroughs', 'disclaimer',
      'lens-data-story']),
  },
  infrastructure: {
    label: 'Infrastructure',
    description: 'Asset condition, CSO/SSO events, and capital planning',
    sections: new Set([
      'local-infra-condition', 'local-cso-sso', 'infra-capital', 'infra-construction',
      'infra-green', 'local-asset-age', 'disclaimer',
      'lens-data-story']),
  },
  compliance: {
    label: 'Compliance',
    description: 'Permits, violations, and enforcement actions',
    sections: new Set([
      'icis', 'sdwis', 'local-permit-status', 'local-violation-timeline',
      'local-enforcement-actions', 'fineavoidance', 'correlation-breakthroughs', 'disclaimer',
      'lens-data-story']),
  },
  stormwater: {
    label: 'Stormwater / MS4',
    description: 'MS4 permit management, BMPs, MCMs, and receiving waters',
    sections: new Set([
      'local-ms4-identity', 'bmp-inventory', 'bmp-analytics', 'bmp-maintenance',
      'mcm-dashboard', 'rw-profiles', 'rw-impairment',
      'nutrientcredits', 'tmdl', 'fineavoidance', 'mdeexport', 'disclaimer',
      'lens-data-story']),
  },
  'public-health': {
    label: 'Public Health',
    description: 'Drinking water systems, contaminants, and advisories',
    sections: new Set([
      'sdwis', 'ph-contaminants', 'local-dw-systems', 'local-pfas-proximity',
      'ph-advisories', 'correlation-breakthroughs', 'disclaimer',
      'lens-data-story']),
  },
  funding: {
    label: 'Funding & Grants',
    description: 'Currently open grants, best-fit funding, USASpending, and deadline tracking',
    sections: new Set([
      'grants', 'local-usaspending', 'fund-active', 'fund-srf',
      'local-match-requirements', 'grant-outcomes', 'local-funding-timeline', 'disclaimer',
      'lens-data-story']),
  },
  'ej-equity': {
    label: 'EJ & Equity',
    description: 'Environmental justice demographics, disparities, and Justice40',
    sections: new Set([
      'local-ej-summary', 'local-ej-demographics', 'local-ej-burden-map',
      'local-ej-water-disparities', 'local-j40-tracker', 'local-ej-recommendations', 'correlation-breakthroughs', 'disclaimer',
      'lens-data-story']),
  },
  emergency: {
    label: 'Emergency',
    description: 'Active incidents, weather alerts, and response planning',
    sections: new Set([
      'disaster-active', 'local-nws-alerts', 'local-sentinel-events',
      'disaster-response', 'disaster-prep', 'resolution-planner', 'correlation-breakthroughs', 'disclaimer',
      'lens-data-story']),
  },
  scorecard: {
    label: 'Scorecard',
    description: 'Overall score, category breakdown, and peer comparison',
    sections: new Set([
      'local-sc-overall', 'local-sc-categories', 'local-sc-trends',
      'local-sc-peer', 'local-sc-sla', 'disclaimer',
      'lens-data-story']),
  },
  reports: {
    label: 'Reports',
    description: 'Council reports, state filings, and public disclosures',
    sections: new Set([
      'exporthub', 'local-rpt-council', 'local-rpt-state-filing',
      'local-rpt-public-disclosure', 'local-rpt-annual', 'disclaimer',
      'lens-data-story']),
  },
  habitat: {
    label: 'Habitat & Ecology',
    description: 'Protected species and habitat sensitivity - relevant for development review',
    sections: new Set(['hab-ecoscore', 'hab-wildlife', 'disclaimer', 'lens-data-story']),
  },
  trends: {
    label: 'Trends & Forecasting',
    description: 'Long-term water quality trends, projections, and emerging contaminants',
    sections: new Set([
      'trends-dashboard', 'disclaimer',
      'lens-data-story']),
  },
  policy: {
    label: 'Policy & Regulatory',
    description: 'Federal and state regulatory actions, rule tracking, and compliance outlook',
    sections: new Set([
      'policy-tracker', 'disclaimer',
      'lens-data-story']),
  },
  wqt: {
    label: 'Water Quality Trading',
    description: 'Nutrient credit marketplace, sector breakdown, and program details',
    sections: new Set(['wqt', 'nutrientcredits', 'disclaimer', 'lens-data-story']),
  },
  training: {
    label: 'Training', description: 'Deployment training and onboarding guide',
    sections: new Set(['training']),
  },
  users: {
    label: 'Users',
    description: 'User management and role administration',
    sections: new Set(['users-panel']),
  },
};

// --- Placeholder Card --------------------------------------------------------
// Reusable mock-data section wrapper for scaffold

function PlaceholderSection({ title, subtitle, icon, accent = 'purple', children }: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <DashboardSection title={title} subtitle={subtitle} icon={icon} accent={accent}>
      <div className="space-y-3 pt-3">
        {children}
      </div>
    </DashboardSection>
  );
}

// --- Main Component ----------------------------------------------------------

export function LocalManagementCenter({ jurisdictionId, stateAbbr, onSelectRegion, onToggleDevMode }: Props) {
  const { user, isAdmin } = useAuth();
  const [adminState] = useAdminState();
  const effectiveState = (isAdmin || user?.role === 'Pearl') ? adminState : stateAbbr;

  // -- Jurisdiction / MS4 selection --
  const ms4Jurisdictions = useMemo(() => getStateMS4Jurisdictions(effectiveState), [effectiveState]);
  const [selectedJurisdictionId, setSelectedJurisdictionId] = useState(jurisdictionId);
  const [selectedMS4, setSelectedMS4] = useState<string | null>(null);
  const [waterbodySearch, setWaterbodySearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium'>('all');

  useEffect(() => {
    setSelectedJurisdictionId('default');
    setSelectedMS4(null);
  }, [effectiveState]);

  const jurisdictionLabel = selectedJurisdictionId === 'default'
    ? `${effectiveState} Local Government`
    : selectedJurisdictionId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  // -- View Lens --
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] ?? LENS_CONFIG['overview'];

  // -- Map: waterbody markers --
  const leafletGeo = STATE_GEO_LEAFLET[effectiveState] || { center: [39.8, -98.5] as [number, number], zoom: 4 };
  const localLeafletGeo = useMemo(() => ({
    center: leafletGeo.center,
    zoom: (leafletGeo.zoom || 7) + 1,
  }), [leafletGeo]);

  const regionData = useMemo(() => {
    const rows: { id: string; name: string; alertLevel: AlertLevel; status: string; dataSourceCount: number }[] = [];
    for (const [id, meta] of Object.entries(REGION_META)) {
      const fips = meta.stateCode.replace('US:', '');
      const abbr = FIPS_TO_ABBR[fips] || fips;
      if (abbr !== effectiveState) continue;
      const sources = getWaterbodyDataSources(id);
      rows.push({
        id,
        name: meta.name,
        alertLevel: (sources.length > 2 ? 'high' : sources.length > 0 ? 'medium' : 'low') as AlertLevel,
        status: sources.length > 0 ? 'monitored' : 'unmonitored',
        dataSourceCount: sources.length,
      });
    }
    return rows;
  }, [effectiveState]);

  const wbMarkers = useMemo(() => {
    const resolved: { id: string; name: string; lat: number; lon: number; alertLevel: AlertLevel; status: string; dataSourceCount: number }[] = [];
    for (const r of regionData) {
      const approx = resolveWaterbodyCoordinates(r.name, effectiveState);
      if (approx) {
        resolved.push({ ...r, lat: approx.lat, lon: approx.lon });
      }
    }
    return resolved;
  }, [regionData, effectiveState]);

  const jurisdictionFocus = useMemo(() => {
    if (selectedJurisdictionId === 'default') return null;
    const selected = selectedMS4 ? ms4Jurisdictions.find(j => j.permitId === selectedMS4) : null;
    const raw = selected?.name || jurisdictionLabel;
    const tokens = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t && !['county', 'city', 'town', 'of', 'the', 'state', 'department', 'administration'].includes(t));
    if (tokens.length === 0) return null;
    const matched = wbMarkers.filter(wb => {
      const n = wb.name.toLowerCase();
      return tokens.some(t => n.includes(t));
    });
    if (matched.length === 0) return null;
    const lats = matched.map(w => w.lat);
    const lons = matched.map(w => w.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const center: [number, number] = [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
    const spread = Math.max(maxLat - minLat, maxLon - minLon);
    const zoom = spread < 0.06 ? 12 : spread < 0.12 ? 11 : spread < 0.25 ? 10 : spread < 0.5 ? 9 : 8;
    return { center, zoom };
  }, [selectedJurisdictionId, selectedMS4, ms4Jurisdictions, jurisdictionLabel, wbMarkers]);

  const selectedJurisdiction = useMemo(
    () => (selectedMS4 ? ms4Jurisdictions.find(j => j.permitId === selectedMS4) ?? null : null),
    [selectedMS4, ms4Jurisdictions]
  );

  const jurisdictionScopedWbMarkers = useMemo(() => {
    if (selectedJurisdictionId === 'default') return wbMarkers;
    const raw = selectedJurisdiction?.name || jurisdictionLabel;
    const tokens = raw
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t && !['county', 'city', 'town', 'of', 'the', 'state', 'department', 'administration'].includes(t));
    if (tokens.length === 0) return wbMarkers;
    const matched = wbMarkers.filter(wb => {
      const n = wb.name.toLowerCase();
      return tokens.some(t => n.includes(t));
    });
    return matched.length > 0 ? matched : wbMarkers;
  }, [selectedJurisdictionId, selectedJurisdiction, jurisdictionLabel, wbMarkers]);

  const jurisdictionScopedRegionData = useMemo(() => {
    const scopedIds = new Set(jurisdictionScopedWbMarkers.map(wb => wb.id));
    return regionData.filter(region => scopedIds.has(region.id));
  }, [regionData, jurisdictionScopedWbMarkers]);
  const complianceScope = useMemo(() => {
    if (selectedJurisdictionId === 'default') return null;
    if (!jurisdictionFocus?.center) return null;
    return {
      lat: jurisdictionFocus.center[0],
      lng: jurisdictionFocus.center[1],
    };
  }, [selectedJurisdictionId, jurisdictionFocus]);

  const localKpi = useMemo(() => {
    const scope = jurisdictionScopedWbMarkers;
    const total = scope.length;
    const severe = scope.filter(w => w.alertLevel === 'high').length;
    const impaired = scope.filter(w => w.alertLevel === 'medium').length;
    const watch = scope.filter(w => w.alertLevel === 'low').length;

    const rawScore = total > 0
      ? Math.round(100 - ((severe * 18 + impaired * 9 + watch * 3) / total))
      : 82;
    const score = Math.max(55, Math.min(98, rawScore));
    const grade = score >= 93 ? 'A' : score >= 89 ? 'A-' : score >= 85 ? 'B+' : score >= 80 ? 'B' : score >= 75 ? 'B-' : score >= 70 ? 'C+' : 'C';

    const complianceByStatus: Record<string, number> = {
      'In Compliance': 95,
      'Pending Renewal': 88,
      'Under Review': 82,
      'Minor Violations': 76,
      'Consent Decree': 64,
      'NOV Issued': 61,
    };
    const complianceRate = selectedJurisdiction
      ? (complianceByStatus[selectedJurisdiction.status] ?? 84)
      : Math.max(72, Math.min(97, 96 - severe * 5 - impaired * 2));

    const statusViolations: Record<string, number> = {
      'In Compliance': 0,
      'Pending Renewal': 1,
      'Under Review': 2,
      'Minor Violations': 3,
      'Consent Decree': 6,
      'NOV Issued': 4,
    };
    const activeViolations = selectedJurisdiction
      ? (statusViolations[selectedJurisdiction.status] ?? 2)
      : Math.max(0, severe + Math.round(impaired * 0.5));

    const pop = selectedJurisdiction?.population ?? 0;
    const grantFundingM = selectedJurisdiction
      ? Math.max(0.8, Math.min(9.8, Math.round((0.8 + pop / 200000 + Math.max(0, 3 - activeViolations) * 0.4) * 10) / 10))
      : Math.max(1.2, Math.min(6.5, Math.round((2.0 + (total / 40)) * 10) / 10));

    const ejTracts = selectedJurisdiction
      ? Math.max(1, Math.min(9, Math.round(pop / 160000) + (severe > 0 ? 1 : 0)))
      : Math.max(1, Math.min(8, Math.round((severe + impaired) / 2) + 2));

    return {
      total,
      score,
      grade,
      complianceRate,
      activeViolations,
      grantFundingM,
      ejTracts,
    };
  }, [jurisdictionScopedWbMarkers, selectedJurisdiction]);

  const filteredWbMarkers = useMemo(() => {
    const q = waterbodySearch.trim().toLowerCase();
    return jurisdictionScopedWbMarkers.filter(wb => {
      if (severityFilter === 'high' && wb.alertLevel !== 'high') return false;
      if (severityFilter === 'medium' && wb.alertLevel !== 'medium') return false;
      if (q && !wb.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [jurisdictionScopedWbMarkers, waterbodySearch, severityFilter]);

  const markerData = useMemo(() =>
    filteredWbMarkers.map(wb => ({
      id: wb.id,
      lat: wb.lat,
      lon: wb.lon,
      color: getMarkerColor(wb),
      name: wb.name,
    })),
    [filteredWbMarkers]
  );

  const [hoveredFeature, setHoveredFeature] = useState<any>(null);
  const onMarkerMouseMove = useCallback((e: any) => {
    if (e.features && e.features.length > 0) setHoveredFeature(e.features[0]);
  }, []);
  const onMarkerMouseLeave = useCallback(() => setHoveredFeature(null), []);

  // -- Mock data bridge for MS4 cards --
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [policyExpanded, setPolicyExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (jurisdictionScopedWbMarkers.length === 0) {
      setActiveDetailId(null);
      return;
    }
    const hasActiveInScope = activeDetailId
      ? jurisdictionScopedWbMarkers.some(wb => wb.id === activeDetailId)
      : false;
    if (!hasActiveInScope) {
      setActiveDetailId(jurisdictionScopedWbMarkers[0].id);
    }
  }, [jurisdictionScopedWbMarkers, activeDetailId]);

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
  const overallScore = useMemo(() => {
    if (!displayData) return 0;
    try { return calculateOverallScore(displayData); } catch { return 0; }
  }, [displayData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

      {/* -- HERO BANNER -- */}
      <HeroBanner role="local" onDoubleClick={() => onToggleDevMode?.()} />

      {/* -- ADMIN JURISDICTION / MS4 SWITCHER -- */}
      {(isAdmin || user?.role === 'Pearl') && (
        <div className="bg-white border border-purple-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-purple-800">
            <Building2 size={15} />
            Admin: Jurisdiction & MS4 Selector
          </div>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[280px]">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Jurisdiction &amp; MS4 Permit</label>
              <select
                value={selectedMS4 ?? 'default'}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'default') {
                    setSelectedJurisdictionId('default');
                    setSelectedMS4(null);
                  } else {
                    const j = ms4Jurisdictions.find(j => j.permitId === val);
                    if (j) {
                      setSelectedJurisdictionId(j.name.toLowerCase().replace(/\s+/g, '_'));
                      setSelectedMS4(j.permitId);
                    }
                  }
                }}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
              >
                <option value="default">All Jurisdictions</option>
                {ms4Jurisdictions.map(j => (
                  <option key={j.permitId} value={j.permitId}>
                    {cleanMojibake(j.name)} - {j.permitId} ({j.phase})
                  </option>
                ))}
              </select>
            </div>
          </div>
          {selectedMS4 && (() => {
            const selected = ms4Jurisdictions.find(j => j.permitId === selectedMS4);
            if (!selected) return null;
            return (
              <div className="flex items-center gap-2 text-xs">
                <Badge className={
                  selected.status === 'In Compliance' ? 'bg-emerald-100 text-emerald-800' :
                  selected.status === 'Consent Decree' || selected.status === 'NOV Issued' ? 'bg-red-100 text-red-800' :
                  'bg-amber-100 text-amber-800'
                }>
                  {selected.status}
                </Badge>
                <span className="text-slate-500">Pop: {selected.population.toLocaleString()}</span>
                {selected.keyIssues?.map(k => (
                  <Badge key={k} variant="outline" className="text-2xs">{k}</Badge>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <LayoutEditor ccKey="Local">
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
            isEditMode={isEditMode} isVisible={section.visible} onToggleVisibility={onToggleVisibility} userRole="State">
            {children}
          </DraggableSection>
        );
        switch (section.id) {

          // ===================================================================
          // OVERVIEW SECTIONS
          // ===================================================================

          case 'local-identity': return DS(
            <PlaceholderSection title={`${jurisdictionLabel} - Jurisdiction Profile`} icon={<Building2 size={15} />} accent="purple">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <StatusCard title="Population" description="~185,000 residents" status="good" />
                <StatusCard title="Water Systems" description="3 public water systems" status="good" />
                <StatusCard title="MS4 Permit" description="Phase II - Active" status="good" />
                <StatusCard title="State Agency" description={`${effectiveState} DEP/DEQ`} status="good" />
              </div>
            </PlaceholderSection>
          );

          case 'local-kpi-strip': return DS(
            <PlaceholderSection title="Key Performance Indicators" icon={<BarChart3 size={15} />} accent="purple">
              {/* Hero KPI */}
              <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50 p-4 mb-3">
                <div className="flex items-center gap-3">
                  <div className="text-4xl font-extrabold text-emerald-700">{localKpi.grade}</div>
                  <div>
                    <div className="text-sm font-semibold text-emerald-700">Water Quality Grade</div>
                    <div className="text-2xs text-emerald-500">
                      Composite score {localKpi.score}/100 across {localKpi.total} monitored waterbodies in {jurisdictionLabel}
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Compliance Rate', value: `${localKpi.complianceRate}%`, color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', pct: localKpi.complianceRate },
                  { label: 'Active Violations', value: String(localKpi.activeViolations), color: 'text-amber-700', bgColor: 'bg-amber-50 border-amber-200' },
                  { label: 'Grant Funding', value: `$${localKpi.grantFundingM.toFixed(1)}M`, color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
                  { label: 'EJ Communities', value: `${localKpi.ejTracts} tracts`, color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
                ].map(kpi => (
                  <div key={kpi.label} className={`rounded-lg border p-3 ${kpi.bgColor}`}>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
                    {kpi.pct !== undefined && (
                      <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${kpi.pct}%` }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-situation': return DS(
            <PlaceholderSection title="Situation Summary" subtitle="What you need to know today" icon={<Info size={15} />} accent="purple">
              <StatusCard title="No Active Emergencies" description="All systems operating normally. Last incident resolved 12 days ago." status="good" />
              <StatusCard title="Permit Renewal Due" description="MS4 Phase II permit renewal due in 45 days - draft submitted to state." status="warning" />
              <StatusCard title="Boil Water Advisory" description="Lifted 3 days ago for Elm Street corridor. System cleared all tests." status="good" />
            </PlaceholderSection>
          );

          case 'local-quick-actions': return DS(
            <PlaceholderSection title="Quick Actions" icon={<Zap size={15} />} accent="purple">
              <div className="flex flex-wrap gap-2">
                {['Generate Council Briefing', 'Export Compliance Report', 'View Grant Deadlines', 'Check EJ Exposure', 'Run Scorecard'].map(action => (
                  <Badge key={action} variant="outline" className="px-3 py-1.5 cursor-pointer hover:bg-purple-50 hover:border-purple-300 transition-colors">
                    {action}
                  </Badge>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ===================================================================
          // BRIEFING SECTIONS
          // ===================================================================

          case 'local-constituent-tldr': return DS(
            <PlaceholderSection title="Constituent TL;DR" subtitle="What residents are asking about" icon={<Users size={15} />} accent="purple">
              <StatusCard title="Lead Pipe Replacement" description="12 calls this week about lead service line inventory. EPA deadline is Oct 2027." status="warning" />
              <StatusCard title="Taste & Odor" description="Seasonal algal bloom reports from Lake district. Treatment plant adjusting activated carbon dose." status="warning" />
              <StatusCard title="Billing Questions" description="Rate increase FAQ published. 87% of callers satisfied after explanation." status="good" />
            </PlaceholderSection>
          );

          // ===================================================================
          // POLITICAL BRIEFING SECTIONS (the killer feature)
          // ===================================================================

          case 'pol-talking-points': return DS(
            <PlaceholderSection title="Talking Points" subtitle="Auto-generated for council meetings" icon={<Megaphone size={15} />} accent="purple">
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">Lead</Badge>
                    <p>&ldquo;Our jurisdiction has replaced 340 of 1,200 identified lead service lines - 28% complete, ahead of the national average of 18%.&rdquo;</p>
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
            </PlaceholderSection>
          );

          case 'pol-constituent-concerns': return DS(
            <PlaceholderSection title="Constituent Concerns" subtitle="Top issues by volume" icon={<Users size={15} />} accent="purple">
              <div className="space-y-2">
                {[
                  { issue: 'Lead service line replacement timeline', calls: 47, trend: 'up  23%' },
                  { issue: 'Water rate increase explanation', calls: 31, trend: 'down  8%' },
                  { issue: 'Stormwater flooding on Oak Ave', calls: 18, trend: 'up  45%' },
                  { issue: 'PFAS in drinking water', calls: 12, trend: '- stable' },
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
            </PlaceholderSection>
          );

          case 'pol-funding-wins': return DS(
            <PlaceholderSection title="Funding Wins" subtitle="Recent awards and approvals" icon={<Banknote size={15} />} accent="emerald">
              <StatusCard title="$2.1M DWSRF Award" description="Drinking Water State Revolving Fund - water main rehabilitation project approved Jan 2026." status="good" />
              <StatusCard title="$850K EPA WIIN Grant" description="Water Infrastructure Improvements for the Nation - lead service line inventory and replacement." status="good" />
              <StatusCard title="$340K State 319 Grant" description="Nonpoint source pollution control for Deer Creek watershed - BMP installation." status="good" />
            </PlaceholderSection>
          );

          case 'pol-funding-risks': return DS(
            <PlaceholderSection title="Funding Risks" subtitle="Expiring or at-risk funding" icon={<AlertTriangle size={15} />} accent="amber">
              <StatusCard title="ARPA Funds Expiring" description="$1.2M remaining ARPA allocation must be obligated by Dec 2026. Currently $480K unobligated." status="warning" />
              <StatusCard title="SRF Match Shortfall" description="FY2027 SRF application requires $600K local match. Current reserve: $410K - $190K gap." status="critical" />
            </PlaceholderSection>
          );

          case 'pol-regulatory-deadlines': return DS(
            <PlaceholderSection title="Regulatory Deadlines" subtitle="Upcoming compliance milestones" icon={<Clock size={15} />} accent="amber">
              <div className="space-y-2">
                {[
                  { deadline: 'Mar 15, 2026', date: '2026-03-15', item: 'MS4 Annual Report due to state' },
                  { deadline: 'Jun 30, 2026', date: '2026-06-30', item: 'Lead Service Line Inventory submission' },
                  { deadline: 'Oct 1, 2026', date: '2026-10-01', item: 'PFAS monitoring results due to EPA' },
                  { deadline: 'Dec 31, 2026', date: '2026-12-31', item: 'ARPA fund obligation deadline' },
                ].map(d => {
                  const days = daysUntil(d.date);
                  const status = days < 0 ? 'critical' as const : days <= 90 ? 'warning' as const : 'good' as const;
                  return <StatusCard key={d.item} title={`${d.deadline} — ${daysLabel(days)}`} description={d.item} status={status} />;
                })}
              </div>
            </PlaceholderSection>
          );

          case 'pol-ej-exposure': return DS(
            <PlaceholderSection title="Environmental Justice Exposure" subtitle="Politically sensitive EJ indicators" icon={<Heart size={15} />} accent="purple">
              <StatusCard title="3 EJ Census Tracts" description="Tracts 240101, 240105, 240112 exceed 80th percentile on EJScreen composite index. Combined population: 14,200." status="warning" />
              <StatusCard title="Disproportionate Impact" description="Lead service lines are 3.2x more concentrated in EJ tracts vs. non-EJ areas. Prioritize replacement schedule." status="critical" />
              <StatusCard title="Justice40 Eligible" description="2 of 3 EJ tracts qualify for Justice40 benefits. $1.8M in additional funding potentially available." status="good" />
            </PlaceholderSection>
          );

          case 'pol-media-ready-grades': return DS(
            <PlaceholderSection title="Media-Ready Grades" subtitle="Simplified report card for press releases" icon={<Trophy size={15} />} accent="purple">
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
            </PlaceholderSection>
          );

          case 'pol-peer-comparison': return DS(
            <PlaceholderSection title="Peer Comparison" subtitle="How you compare to similar jurisdictions" icon={<BarChart3 size={15} />} accent="purple">
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
            </PlaceholderSection>
          );

          case 'pol-council-agenda': return DS(
            <PlaceholderSection title="Council Agenda Suggestions" subtitle="Data-driven items for next meeting" icon={<Scale size={15} />} accent="purple">
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4 space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge className="bg-red-100 text-red-800 shrink-0">Urgent</Badge>
                    <p><strong>ARPA Fund Reallocation:</strong> $480K unobligated - propose allocation to lead service line replacement before Dec 2026 deadline.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-amber-100 text-amber-800 shrink-0">Action</Badge>
                    <p><strong>SRF Match Funding:</strong> Authorize $190K from capital reserve to close FY2027 SRF local match gap.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-blue-100 text-blue-800 shrink-0">Info</Badge>
                    <p><strong>Quarterly Water Quality Update:</strong> 8th consecutive quarter with zero MCL exceedances - recognition opportunity.</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge className="bg-purple-100 text-purple-800 shrink-0">Equity</Badge>
                    <p><strong>EJ Tract Prioritization:</strong> Present updated lead line replacement schedule prioritizing 3 EJ census tracts.</p>
                  </div>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          // ===================================================================
          // WATER QUALITY SECTIONS
          // ===================================================================

          case 'local-wq-grade': return DS(
            <PlaceholderSection title="Water Quality Grade" icon={<Waves size={15} />} accent="blue">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center">
                    <span className="text-3xl font-bold text-emerald-700">B+</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Overall Grade</p>
                </div>
                <div className="space-y-2 flex-1">
                  <StatusCard title="Surface Water" description="14 of 18 assessed waterbodies meeting standards (78%)" status="good" />
                  <StatusCard title="Groundwater" description="All 3 aquifer monitoring wells within normal parameters" status="good" />
                  <StatusCard title="Impairments" description="4 waterbodies on 303(d) list - bacteria (2), nutrients (1), sediment (1)" status="warning" />
                </div>
              </div>
            </PlaceholderSection>
          );

          case 'local-impairment-summary': return DS(
            <PlaceholderSection title="Impairment Summary" icon={<AlertCircle size={15} />} accent="amber">
              <div className="space-y-2">
                {[
                  { waterbody: 'Deer Creek', cause: 'E. coli bacteria', source: 'Agricultural runoff', status: 'TMDL in development' },
                  { waterbody: 'Mill Run', cause: 'E. coli bacteria', source: 'Aging sewer infrastructure', status: 'TMDL approved 2024' },
                  { waterbody: 'Lake Pleasant', cause: 'Total phosphorus', source: 'Urban stormwater', status: 'Under assessment' },
                  { waterbody: 'Elm Branch', cause: 'Total suspended solids', source: 'Construction activity', status: 'BMP installed 2025' },
                ].map(w => (
                  <div key={w.waterbody} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800">{w.waterbody}</span>
                      <Badge variant="outline">{w.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{w.cause} - {w.source}</p>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-wq-trends': return DS(
            <PlaceholderSection title="Water Quality Trends" subtitle="5-year trajectory" icon={<TrendingUp size={15} />} accent="blue">
              <StatusCard title="Improving" description="Overall water quality index improved 4.2 points over 5 years (74.8 -> 79.0). Bacteria levels declining in 3 of 4 impaired waterbodies." status="good" />
              <StatusCard title="Watch: Nutrients" description="Total phosphorus trending upward in Lake Pleasant (+0.8 mg/L/yr). Stormwater BMP effectiveness may need reassessment." status="warning" />
            </PlaceholderSection>
          );

          // ===================================================================
          // INFRASTRUCTURE SECTIONS
          // ===================================================================

          case 'local-infra-condition': return DS(
            <PlaceholderSection title="Infrastructure Condition" icon={<Wrench size={15} />} accent="slate">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatusCard title="Water Mains" description="142 mi - 23% beyond useful life" status="warning" />
                <StatusCard title="Sewer Lines" description="98 mi - 15% needing rehab" status="warning" />
                <StatusCard title="Treatment Plant" description="12 MGD capacity - operating at 74%" status="good" />
                <StatusCard title="Storage Tanks" description="3 tanks - all inspected 2025" status="good" />
              </div>
            </PlaceholderSection>
          );

          case 'local-cso-sso': return DS(
            <PlaceholderSection title="CSO / SSO Events" subtitle="Combined & sanitary sewer overflows" icon={<AlertTriangle size={15} />} accent="amber">
              <StatusCard title="2 SSO Events (YTD)" description="Jan 15: 12,000 gal at Pump Station #7 (power failure). Feb 3: 800 gal at manhole MH-2201 (grease blockage)." status="warning" />
              <StatusCard title="0 CSO Events (YTD)" description="No combined sewer overflow events this year. Separation project 68% complete." status="good" />
            </PlaceholderSection>
          );

          case 'local-asset-age': return DS(
            <PlaceholderSection title="Asset Age Distribution" icon={<Clock size={15} />} accent="slate">
              <div className="space-y-2">
                {[
                  { range: '0-20 years', pct: 22, color: 'bg-emerald-500' },
                  { range: '20-40 years', pct: 35, color: 'bg-blue-500' },
                  { range: '40-60 years', pct: 28, color: 'bg-amber-500' },
                  { range: '60+ years', pct: 15, color: 'bg-red-500' },
                ].map(a => (
                  <div key={a.range} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-24">{a.range}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div className={`h-full ${a.color} rounded-full`} style={{ width: `${a.pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-10 text-right">{a.pct}%</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ===================================================================
          // COMPLIANCE SECTIONS
          // ===================================================================

          case 'local-permit-status': return DS(
            <PlaceholderSection title={`Permit Status - ${cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel)}`} icon={<ShieldCheck size={15} />} accent="blue">
              <div className="space-y-2">
                {(() => {
                  const scopeName = cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel);
                  const primaryStatus = selectedJurisdiction?.status || (localKpi.complianceRate >= 90 ? 'In Compliance' : 'Under Review');
                  const renewalStatus = primaryStatus === 'In Compliance' ? 'Active' : 'Renewal Pending';
                  const jurisdictionPermitId = selectedJurisdiction?.permitId || `${effectiveState}R100000`;
                  const npdesId = `${effectiveState}${String(Math.abs(scopeName.length * 137)).padStart(7, '0').slice(0, 7)}`;
                  const permitRows = [
                    { permit: `NPDES - Wastewater Discharge (${scopeName})`, id: npdesId, status: primaryStatus.includes('Compliance') ? 'Active' : 'Under Review', expiry: localKpi.complianceRate >= 90 ? 'Sep 2027' : 'Apr 2026' },
                    { permit: selectedJurisdiction?.phase ? `MS4 ${selectedJurisdiction.phase}` : 'MS4 Program Permit', id: jurisdictionPermitId, status: renewalStatus, expiry: renewalStatus === 'Active' ? 'Dec 2027' : 'Apr 2026' },
                    { permit: 'Stormwater Construction General', id: `${effectiveState}R10-GP`, status: 'Active', expiry: 'Dec 2027' },
                  ];
                  return permitRows.map(p => (
                  <div key={p.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{p.permit}</p>
                      <p className="text-xs text-slate-500">{p.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === 'Active' ? 'default' : 'outline'} className={p.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                        {p.status}
                      </Badge>
                      <span className="text-xs text-slate-500">Exp: {p.expiry}</span>
                    </div>
                  </div>
                  ));
                })()}
              </div>
            </PlaceholderSection>
          );

          case 'local-violation-timeline': return DS(
            <PlaceholderSection title={`Violation Timeline - ${cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel)}`} icon={<AlertTriangle size={15} />} accent="amber">
              <div className="space-y-2">
                {(() => {
                  const scopeName = cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel);
                  const items = localKpi.activeViolations > 0
                    ? [
                      { date: 'Feb 2026', type: 'Monitoring', desc: `Late DMR follow-up in ${scopeName}; ${Math.max(1, localKpi.activeViolations - 1)} record(s) still open for corrective confirmation.`, severity: 'Minor' },
                      { date: 'Nov 2025', type: 'Effluent', desc: `${Math.max(1, Math.round(localKpi.activeViolations * 0.6))} outfall exceedance event(s) in scoped waters; remediation verification remains active.`, severity: localKpi.activeViolations >= 4 ? 'Moderate' : 'Minor' },
                    ]
                    : [
                      { date: 'Feb 2026', type: 'Monitoring', desc: `No unresolved violations currently flagged for ${scopeName}.`, severity: 'Minor' },
                    ];
                  return items.map(v => (
                    <StatusCard key={v.date + v.type} title={`${v.date} - ${v.type} (${v.severity})`} description={v.desc} status={v.severity === 'Minor' ? 'warning' : 'critical'} />
                  ));
                })()}
              </div>
            </PlaceholderSection>
          );

          case 'local-enforcement-actions': return DS(
            <PlaceholderSection title={`Enforcement Actions - ${cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel)}`} icon={<Shield size={15} />} accent="red">
              {(() => {
                const scopedName = cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel);
                const highRisk = ['Consent Decree', 'NOV Issued'].includes(selectedJurisdiction?.status || '');
                if (highRisk || localKpi.activeViolations >= 4) {
                  return (
                    <StatusCard
                      title="Active Enforcement Watch"
                      description={`${scopedName} has elevated compliance exposure tied to current status (${selectedJurisdiction?.status || 'Under Review'}). Prioritize closure milestones and legal follow-up.`}
                      status="critical"
                    />
                  );
                }
                return (
                  <StatusCard
                    title="No Active Enforcement"
                    description={`No formal consent orders or penalty actions currently active in ${scopedName}. Continue routine compliance monitoring.`}
                    status="good"
                  />
                );
              })()}
            </PlaceholderSection>
          );

          // ===================================================================
          // STORMWATER / MS4 SECTIONS
          // ===================================================================

          case 'local-ms4-identity': return DS(
            <PlaceholderSection title="MS4 Permit Identity" icon={<CloudRain size={15} />} accent="amber">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatusCard title="Permit Type" description="Phase II Small MS4" status="good" />
                <StatusCard title="Urbanized Area" description="42.3 sq mi" status="good" />
                <StatusCard title="Outfalls" description="187 mapped outfalls" status="good" />
                <StatusCard title="MCM Status" description="6/6 programs active" status="good" />
              </div>
            </PlaceholderSection>
          );

          // ===================================================================
          // PUBLIC HEALTH SECTIONS
          // ===================================================================

          case 'local-dw-systems': return DS(
            <PlaceholderSection title={`Drinking Water Systems - ${cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel)}`} icon={<Droplets size={15} />} accent="blue">
              <div className="space-y-2">
                {(() => {
                  const scopeName = cleanMojibake(selectedJurisdiction?.name || jurisdictionLabel);
                  const population = selectedJurisdiction?.population ?? 185000;
                  const baseViolations = Math.max(0, Math.min(3, localKpi.activeViolations));
                  const systems = [
                    { name: `${scopeName} Main Water`, pop: Math.round(population * 0.72).toLocaleString(), source: 'Surface water', violations: baseViolations > 1 ? 1 : 0 },
                    { name: `${scopeName} Regional Water`, pop: Math.round(population * 0.2).toLocaleString(), source: 'Groundwater', violations: baseViolations > 2 ? 1 : 0 },
                    { name: `${scopeName} Industrial Supply`, pop: Math.round(population * 0.08).toLocaleString(), source: 'Purchased surface', violations: baseViolations > 0 ? 1 : 0 },
                  ];
                  return systems.map(s => (
                  <div key={s.name} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.source} - Pop: {s.pop}</p>
                    </div>
                    <Badge className={s.violations === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                      {s.violations === 0 ? 'No violations' : `${s.violations} violation`}
                    </Badge>
                  </div>
                  ));
                })()}
              </div>
            </PlaceholderSection>
          );

          case 'local-pfas-proximity': return DS(
            <PlaceholderSection title="PFAS Proximity" subtitle="Known or suspected PFAS sources near water supply" icon={<AlertCircle size={15} />} accent="red">
              <StatusCard title="2 Known Sources Within 3 mi" description="Former fire training facility (1.2 mi from Well #3) and industrial discharge site (2.8 mi from intake)." status="warning" />
              <StatusCard title="Monitoring Status" description="Quarterly PFAS sampling active since Q1 2025. All results below EPA MCLs (4 ppt PFOS, 4 ppt PFOA)." status="good" />
            </PlaceholderSection>
          );

          // ===================================================================
          // FUNDING SECTIONS
          // ===================================================================

          case 'local-usaspending': return DS(
            <PlaceholderSection title="USASpending Awards" subtitle="Federal awards to jurisdiction" icon={<Banknote size={15} />} accent="emerald">
              <div className="space-y-2">
                {[
                  { program: 'DWSRF', amount: '$2.1M', year: '2026', agency: 'EPA' },
                  { program: 'WIIN Act', amount: '$850K', year: '2025', agency: 'EPA' },
                  { program: 'ARPA - Water', amount: '$3.4M', year: '2022', agency: 'Treasury' },
                  { program: 'FEMA BRIC', amount: '$420K', year: '2025', agency: 'FEMA' },
                ].map(a => (
                  <div key={a.program} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.program}</p>
                      <p className="text-xs text-slate-500">{a.agency} - {a.year}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-700">{a.amount}</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-match-requirements': return DS(
            <PlaceholderSection title="Match Requirements" subtitle="Local cost-share obligations" icon={<Banknote size={15} />} accent="amber">
              <StatusCard title="Total Match Required: $840K" description="DWSRF ($420K at 20%), WIIN ($170K at 20%), 319 Grant ($68K at 20%), FEMA BRIC ($182K at 25%)." status="warning" />
              <StatusCard title="Capital Reserve: $650K" description="Current reserve covers 77% of total match obligation. $190K gap for FY2027." status="warning" />
            </PlaceholderSection>
          );

          case 'grant-outcomes': return DS(
            <PlaceholderSection title="Grant Outcomes" subtitle="Performance on active grants" icon={<CheckCircle size={15} />} accent="emerald">
              <StatusCard title="On Track" description="DWSRF project: 340 of 1,200 lead lines replaced (28%). Milestone 2 complete. Expenditure rate: 62%." status="good" />
              <StatusCard title="Behind Schedule" description="319 Grant: BMP installation 45% complete vs 65% target. Contractor delay - revised timeline submitted." status="warning" />
            </PlaceholderSection>
          );

          case 'local-funding-timeline': return DS(
            <PlaceholderSection title="Funding Timeline" subtitle="Key dates for grants and budgets" icon={<Clock size={15} />} accent="blue">
              <div className="space-y-2">
                {[
                  { date: 'Mar 2026', event: 'DWSRF reimbursement request #4 due' },
                  { date: 'May 2026', event: 'FY2027 CWSRF application window opens' },
                  { date: 'Jul 2026', event: '319 Grant mid-term progress report' },
                  { date: 'Sep 2026', event: 'FEMA BRIC project closeout deadline' },
                  { date: 'Dec 2026', event: 'ARPA fund obligation deadline' },
                ].map(t => (
                  <div key={t.date} className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                    <Badge variant="outline" className="shrink-0">{t.date}</Badge>
                    <span className="text-sm text-slate-700">{t.event}</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ===================================================================
          // EJ & EQUITY SECTIONS
          // ===================================================================

          case 'local-ej-summary': return DS(
            <PlaceholderSection title="Environmental Justice Summary" icon={<Heart size={15} />} accent="purple">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatusCard title="EJ Tracts" description="3 of 28 census tracts (11%)" status="warning" />
                <StatusCard title="Affected Population" description="14,200 residents in EJ areas" status="warning" />
                <StatusCard title="Justice40 Eligible" description="2 tracts qualify for J40" status="good" />
              </div>
            </PlaceholderSection>
          );

          case 'local-ej-demographics': return DS(
            <PlaceholderSection title="EJ Demographics" subtitle="Demographic breakdown of EJ census tracts" icon={<Users size={15} />} accent="purple">
              <div className="space-y-2">
                {[
                  { tract: '240101', pop: '5,200', minority: '72%', poverty: '28%', linguistic: '15%' },
                  { tract: '240105', pop: '4,800', minority: '65%', poverty: '24%', linguistic: '12%' },
                  { tract: '240112', pop: '4,200', minority: '58%', poverty: '31%', linguistic: '8%' },
                ].map(t => (
                  <div key={t.tract} className="bg-white border border-slate-200 rounded-lg px-4 py-3">
                    <p className="text-sm font-semibold text-slate-800">Tract {t.tract} - Pop: {t.pop}</p>
                    <div className="flex gap-4 mt-1">
                      <span className="text-xs text-slate-500">Minority: {t.minority}</span>
                      <span className="text-xs text-slate-500">Poverty: {t.poverty}</span>
                      <span className="text-xs text-slate-500">Linguistic isolation: {t.linguistic}</span>
                    </div>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-ej-burden-map': return DS(
            <PlaceholderSection title="Environmental Burden Map" icon={<MapPin size={15} />} accent="purple">
              <div className="bg-slate-100 border border-slate-200 rounded-xl h-48 flex items-center justify-center">
                <p className="text-sm text-slate-500">EJScreen burden map - placeholder for interactive map integration</p>
              </div>
            </PlaceholderSection>
          );

          case 'local-ej-water-disparities': return DS(
            <PlaceholderSection title="Water Quality Disparities" subtitle="EJ tracts vs jurisdiction average" icon={<Waves size={15} />} accent="purple">
              <StatusCard title="Lead Service Lines" description="EJ tracts have 3.2x higher concentration of lead service lines than non-EJ areas." status="critical" />
              <StatusCard title="Water Main Breaks" description="1.8x more frequent in EJ tracts due to older infrastructure (avg age: 62 years vs 38 years)." status="warning" />
              <StatusCard title="Response Time" description="Average emergency response 12 min in EJ tracts vs 8 min jurisdiction-wide." status="warning" />
            </PlaceholderSection>
          );

          case 'local-j40-tracker': return DS(
            <PlaceholderSection title="Justice40 Tracker" subtitle="Covered federal programs" icon={<Scale size={15} />} accent="purple">
              <StatusCard title="$1.8M Potentially Available" description="2 qualifying tracts eligible under DWSRF, CWSRF, and weatherization programs. Application status: 1 submitted, 1 in draft." status="good" />
            </PlaceholderSection>
          );

          case 'local-ej-recommendations': return DS(
            <PlaceholderSection title="EJ Recommendations" icon={<Sparkles size={15} />} accent="purple">
              <Card className="border-purple-200 bg-purple-50/50">
                <CardContent className="pt-4 space-y-2 text-sm">
                  <p><strong>1.</strong> Prioritize lead service line replacement in tracts 240101 and 240105 (highest burden scores).</p>
                  <p><strong>2.</strong> Apply for Justice40-designated DWSRF supplemental funding for tract 240112.</p>
                  <p><strong>3.</strong> Establish community advisory board with EJ tract representation for capital project prioritization.</p>
                  <p><strong>4.</strong> Publish bilingual water quality reports (Spanish/English) for tracts with &gt;10% linguistic isolation.</p>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          // ===================================================================
          // EMERGENCY SECTIONS
          // ===================================================================

          case 'local-nws-alerts': return DS(
            <PlaceholderSection title="NWS Weather Alerts" icon={<CloudRain size={15} />} accent="amber">
              <StatusCard title="No Active Alerts" description="No NWS weather warnings, watches, or advisories for jurisdiction area." status="good" />
            </PlaceholderSection>
          );

          case 'local-sentinel-events': return DS(
            <PlaceholderSection title="Sentinel Events" subtitle="Early warning indicators" icon={<Activity size={15} />} accent="amber">
              <StatusCard title="Turbidity Spike" description="Intake monitor detected 8.2 NTU spike at 03:00 AM - returned to 1.4 NTU by 05:30. Auto-logged, no action required." status="warning" />
              <StatusCard title="Pressure Drop" description="Zone 3 pressure dropped below 30 PSI for 4 minutes during peak demand (6:45 PM). Normal range restored." status="warning" />
            </PlaceholderSection>
          );

          // ===================================================================
          // SCORECARD SECTIONS
          // ===================================================================

          case 'local-sc-overall': return DS(
            <PlaceholderSection title="Overall Score" icon={<Trophy size={15} />} accent="purple">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-300 flex items-center justify-center">
                    <span className="text-3xl font-bold text-emerald-700">82</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">out of 100</p>
                </div>
                <div className="text-sm text-slate-600 space-y-1">
                  <p>Ranking: <strong className="text-purple-700">14th of 62</strong> similar jurisdictions</p>
                  <p>Trend: <strong className="text-emerald-700">up  3.5 pts</strong> over 12 months</p>
                  <p>National percentile: <strong>77th</strong></p>
                </div>
              </div>
            </PlaceholderSection>
          );

          case 'local-sc-categories': return DS(
            <PlaceholderSection title="Category Breakdown" icon={<BarChart3 size={15} />} accent="purple">
              <div className="space-y-2">
                {[
                  { cat: 'Water Quality', score: 87, max: 100, color: 'bg-emerald-500' },
                  { cat: 'Compliance', score: 91, max: 100, color: 'bg-green-500' },
                  { cat: 'Infrastructure', score: 72, max: 100, color: 'bg-amber-500' },
                  { cat: 'Public Health', score: 88, max: 100, color: 'bg-blue-500' },
                  { cat: 'Environmental Justice', score: 68, max: 100, color: 'bg-purple-500' },
                  { cat: 'Emergency Preparedness', score: 85, max: 100, color: 'bg-teal-500' },
                ].map(c => (
                  <div key={c.cat} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-40">{c.cat}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-4 overflow-hidden">
                      <div className={`h-full ${c.color} rounded-full`} style={{ width: `${c.score}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-slate-700 w-10 text-right">{c.score}</span>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          case 'local-sc-trends': return DS(
            <PlaceholderSection title="Scorecard Trends" subtitle="12-month trajectory" icon={<TrendingUp size={15} />} accent="purple">
              <StatusCard title="Improving Categories" description="Water Quality (+4.2), Compliance (+2.8), Public Health (+1.5)" status="good" />
              <StatusCard title="Declining Categories" description="Infrastructure (-1.2) - driven by aging asset backlog" status="warning" />
            </PlaceholderSection>
          );

          case 'local-sc-peer': return DS(
            <PlaceholderSection title="Peer Comparison" icon={<BarChart3 size={15} />} accent="purple">
              <StatusCard title="Above Peer Average" description="Your score (82) exceeds the peer group average (76) by 6 points. Strengths: compliance and public health." status="good" />
              <StatusCard title="Gap Area" description="Infrastructure score (72) is 5 points below peer average (77). Leading peer: Greenfield County (89)." status="warning" />
            </PlaceholderSection>
          );

          case 'local-sc-sla': return DS(
            <PlaceholderSection title="SLA Metrics" subtitle="Service level agreement performance" icon={<Gauge size={15} />} accent="purple">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { metric: 'Boil water advisory response', target: '<2 hrs', actual: '1.4 hrs', met: true },
                  { metric: 'Complaint resolution', target: '<48 hrs', actual: '36 hrs', met: true },
                  { metric: 'DMR submission', target: 'By 15th', actual: 'Avg: 12th', met: true },
                  { metric: 'Emergency notification', target: '<1 hr', actual: '0.8 hrs', met: true },
                  { metric: 'Permit renewal filing', target: '90 days early', actual: '45 days', met: false },
                  { metric: 'EJ community outreach', target: 'Quarterly', actual: 'Semi-annual', met: false },
                ].map(s => (
                  <div key={s.metric} className={`border rounded-lg p-3 ${s.met ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                    <p className="text-xs font-medium text-slate-700">{s.metric}</p>
                    <p className="text-sm font-bold mt-1">{s.actual} <span className="text-xs text-slate-500">/ {s.target}</span></p>
                    <Badge className={`mt-1 ${s.met ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {s.met ? 'Met' : 'Not Met'}
                    </Badge>
                  </div>
                ))}
              </div>
            </PlaceholderSection>
          );

          // ===================================================================
          // REPORTS SECTIONS
          // ===================================================================

          case 'local-rpt-council': return DS(
            <PlaceholderSection title="Council Report" subtitle="Auto-generated briefing for elected officials" icon={<FileText size={15} />} accent="purple">
              <Card className="border-purple-200">
                <CardContent className="pt-4 text-sm text-slate-600">
                  <p>One-page summary combining water quality grades, compliance status, funding wins, and EJ exposure for council presentation. Includes media-ready grades and recommended agenda items.</p>
                  <Badge variant="outline" className="mt-3 cursor-pointer hover:bg-purple-50">Generate Council Briefing PDF</Badge>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          case 'local-rpt-state-filing': return DS(
            <PlaceholderSection title="State Filing Report" icon={<FileText size={15} />} accent="blue">
              <StatusCard title="MS4 Annual Report" description="Due Mar 15, 2026. Draft 85% complete - MCM narratives need final review." status="warning" />
              <StatusCard title="CCR" description="Consumer Confidence Report due Jul 1, 2026. Data compilation in progress." status="good" />
            </PlaceholderSection>
          );

          case 'local-rpt-public-disclosure': return DS(
            <PlaceholderSection title="Public Disclosure Report" icon={<FileText size={15} />} accent="blue">
              <StatusCard title="Water Quality Data" description="Public dashboard updated weekly. Last update: Feb 26, 2026." status="good" />
              <StatusCard title="Annual Performance" description="FY2025 annual report published Jan 15, 2026. 342 downloads." status="good" />
            </PlaceholderSection>
          );

          case 'local-rpt-annual': return DS(
            <PlaceholderSection title="Annual Report" icon={<FileText size={15} />} accent="blue">
              <Card className="border-slate-200">
                <CardContent className="pt-4 text-sm text-slate-600">
                  <p>Comprehensive annual report combining all lenses - water quality, compliance, infrastructure, funding, and equity - into a single document for public distribution and state filing.</p>
                  <Badge variant="outline" className="mt-3 cursor-pointer hover:bg-blue-50">Generate Annual Report</Badge>
                </CardContent>
              </Card>
            </PlaceholderSection>
          );

          // ===================================================================
          // SHARED / REUSED SECTIONS (rendered as placeholders for scaffold)
          // ===================================================================
          case 'warr-metrics':
          case 'warr-analyze':
          case 'warr-respond':
          case 'warr-resolve':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} - WARR zone placeholder (shared component)
              </div>
            );

          case 'map-grid': return DS(
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Map (2/3) */}
              <div className="lg:col-span-2">
                <div className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <div className="p-2 text-xs text-slate-500 bg-slate-50 border-b border-slate-200">
                    {jurisdictionLabel} &middot; {filteredWbMarkers.length} of {jurisdictionScopedWbMarkers.length} waterbodies
                  </div>
                  <div className="h-[400px] w-full relative">
                    <MapboxMapShell
                      center={jurisdictionFocus?.center || localLeafletGeo.center}
                      zoom={jurisdictionFocus?.zoom || localLeafletGeo.zoom}
                      height="100%"
                      mapKey={`${effectiveState}-${selectedJurisdictionId}-${severityFilter}-${waterbodySearch}`}
                      interactiveLayerIds={['local-markers']}
                      onMouseMove={onMarkerMouseMove}
                      onMouseLeave={onMarkerMouseLeave}
                    >
                      <MapboxMarkers
                        data={markerData}
                        layerId="local-markers"
                        radius={filteredWbMarkers.length > 100 ? 3 : filteredWbMarkers.length > 30 ? 4 : 5}
                        hoveredFeature={hoveredFeature}
                      />
                    </MapboxMapShell>
                  </div>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-2 p-3 text-xs bg-slate-50 border-t border-slate-200">
                    <span className="text-slate-500 font-medium self-center mr-1">Impairment:</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">Healthy</Badge>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">Watch</Badge>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">Impaired</Badge>
                    <Badge variant="secondary" className="bg-red-100 text-red-800 border-red-200">Severe</Badge>
                  </div>
                </div>
              </div>
              {/* Right: Waterbody list (1/3) */}
              <div className="lg:col-span-1">
                <div className="border border-slate-200 rounded-lg bg-white h-[400px] flex flex-col">
                  <div className="p-2 text-xs font-medium text-slate-600 bg-slate-50 border-b border-slate-200 space-y-2">
                    <div>Waterbodies ({filteredWbMarkers.length})</div>
                    <input
                      value={waterbodySearch}
                      onChange={(e) => setWaterbodySearch(e.target.value)}
                      placeholder="Search waterbodies..."
                      className="w-full border border-slate-300 rounded-md px-2 py-1 text-xs bg-white focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none"
                    />
                    <div className="flex gap-1.5">
                      {[
                        { id: 'all' as const, label: 'All' },
                        { id: 'high' as const, label: 'Severe' },
                        { id: 'medium' as const, label: 'Impaired' },
                      ].map(tag => (
                        <button
                          key={tag.id}
                          onClick={() => setSeverityFilter(tag.id)}
                          className={`px-2 py-0.5 rounded text-2xs border transition-colors ${
                            severityFilter === tag.id
                              ? 'bg-purple-100 border-purple-300 text-purple-800'
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {tag.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredWbMarkers.map(wb => (
                      <button
                        key={wb.id}
                        onClick={() => { setActiveDetailId(wb.id); onSelectRegion?.(wb.id); }}
                        className={`w-full text-left px-3 py-2 hover:bg-purple-50 transition-colors flex items-center gap-2 ${activeDetailId === wb.id ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: getMarkerColor(wb) }} />
                        <span className="text-xs text-slate-700 truncate">{wb.name}</span>
                      </button>
                    ))}
                    {filteredWbMarkers.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        {waterbodySearch || severityFilter !== 'all'
                          ? 'No waterbodies match current filters.'
                          : `No waterbodies found for ${effectiveState}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );

          case 'briefing-actions': {
            const elevatedAlerts = jurisdictionScopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
            const severeAlerts = jurisdictionScopedRegionData.filter(r => r.alertLevel === 'high').length;
            const utilization = jurisdictionScopedWbMarkers.length > 0
              ? Math.round((jurisdictionScopedRegionData.filter(r => r.status === 'active').length / jurisdictionScopedWbMarkers.length) * 100)
              : 0;
            return DS(
              <RoleBriefingActionsCard
                title={`AI Briefing - Local | ${jurisdictionId}`}
                description="Local Government Center"
                dataAsOf={`PIN Intelligence Network | ${new Date().toLocaleDateString()} | ${effectiveState}`}
                summary={[
                  { label: 'Jurisdiction PIN Composite', value: `${overallScore}/100`, style: 'bg-amber-50 border-amber-200 text-amber-700' },
                  { label: 'Monitoring Utilization', value: `${utilization}% active data coverage`, style: 'bg-blue-50 border-blue-200 text-blue-700' },
                ]}
                spotlightTitle="Local Operations Spotlight"
                spotlightBody={`${elevatedAlerts} elevated local alerts currently tracked${severeAlerts > 0 ? `, including ${severeAlerts} high-severity sites` : ''}. Prioritize inspection routing and permit follow-up in the next 24 hours.`}
                spotlightBadge={severeAlerts > 0 ? 'High Urgency' : 'Monitor'}
                actions={[
                  {
                    id: 'loc-act-1',
                    priority: 'High',
                    item: `${severeAlerts || 1} high-severity waterbody alerts requiring field verification`,
                    detail: `Dispatch inspection team and confirm recent exceedance drivers. Jurisdiction: ${jurisdictionId}, state: ${effectiveState}.`,
                    color: 'text-red-700 bg-red-50 border-red-200',
                  },
                  {
                    id: 'loc-act-2',
                    priority: 'High',
                    item: `Review NPDES/ICIS compliance queue for ${effectiveState} facilities linked to local waters`,
                    detail: 'Focus on open SNC findings, pending DMR submissions, and permits expiring within the next 30 days.',
                    color: 'text-red-700 bg-red-50 border-red-200',
                  },
                  {
                    id: 'loc-act-3',
                    priority: 'Medium',
                    item: `Update council briefing packet with ${elevatedAlerts} active alert signals`,
                    detail: 'Include incident status, expected regulatory exposure, and immediate mitigation steps for public works and council staff.',
                    color: 'text-amber-700 bg-amber-50 border-amber-200',
                  },
                  {
                    id: 'loc-act-4',
                    priority: 'Low',
                    item: 'Confirm next weekly data QA/QC cycle across monitored local stations',
                    detail: 'Validate station uptime, sampling integrity, and timestamp freshness before publication/export.',
                    color: 'text-blue-700 bg-blue-50 border-blue-200',
                  },
                ]}
                sourceNote="Source: PIN local monitoring, ATTAINS/ICIS overlays, and jurisdiction operations queue"
              />
            );
          }

          case 'triage-queue': return DS(
            <TriageQueueSection scope="state" stateFilter={effectiveState} user={user} />
          );

          case 'detail': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Waterbody Detail - placeholder (shared component)
            </div>
          );

          case 'top10': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Top 5 Worsening / Improving - placeholder (shared component)
            </div>
          );

          case 'groundwater': return DS(
            <div id="section-groundwater">
              <NwisGwPanel
                state={effectiveState}
                compactMode={false}
              />
            </div>
          );

          case 'icis': return DS(
            <div id="section-icis" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="text-sm font-bold text-slate-800">NPDES / ICIS Compliance</div>
                <div className="text-xs text-slate-500">
                  {complianceScope
                    ? `Jurisdiction-scoped view for ${jurisdictionLabel}`
                    : `${effectiveState} local program view`}
                </div>
              </div>
              <div className="p-4">
                <ICISCompliancePanel
                  state={effectiveState}
                  lat={complianceScope?.lat}
                  lng={complianceScope?.lng}
                  compactMode={false}
                />
              </div>
            </div>
          );

          case 'sdwis': return DS(
            <div id="section-sdwis" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="text-sm font-bold text-slate-800">Drinking Water (SDWIS)</div>
                <div className="text-xs text-slate-500">
                  {complianceScope
                    ? `Jurisdiction-scoped systems and violations for ${jurisdictionLabel}`
                    : `${effectiveState} local program view`}
                </div>
              </div>
              <div className="p-4">
                <SDWISCompliancePanel
                  state={effectiveState}
                  lat={complianceScope?.lat}
                  lng={complianceScope?.lng}
                  compactMode={false}
                />
              </div>
            </div>
          );

          case 'fineavoidance': return DS((() => {
            if (!activeDetailId || !regionMockData || !displayData) return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                Select a waterbody from the map to view Fine Avoidance Calculator
              </div>
            );
            return (
              <div id="section-fineavoidance" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => onToggleCollapse('fineavoidance')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-bold text-slate-800">MS4 Compliance & Fine Avoidance</span>
                  <span>{isSectionOpen('fineavoidance') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}</span>
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

          case 'infra-capital': return DS((() => {
            const scopeName = selectedJurisdiction?.name || jurisdictionLabel;
            const scopedCount = jurisdictionScopedWbMarkers.length;
            const elevated = jurisdictionScopedWbMarkers.filter(wb => wb.alertLevel === 'high' || wb.alertLevel === 'medium').length;
            const priorityProjects = Math.max(3, Math.round(scopedCount * 0.45) + Math.max(1, elevated));
            const fundedProjects = Math.max(1, Math.round(priorityProjects * (localKpi.complianceRate >= 90 ? 0.64 : 0.5)));
            const awaitingFunding = Math.max(0, priorityProjects - fundedProjects);
            const totalInvestmentM = Math.max(6, Math.round(priorityProjects * 2.4 + localKpi.grantFundingM * 1.8));
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <HardHat className="h-5 w-5 text-orange-600" />
                    Capital Improvement Planning
                  </CardTitle>
                  <CardDescription>{scopeName} capital pipeline and investment priorities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Priority Projects', value: String(priorityProjects), bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Total Investment Need', value: `$${totalInvestmentM}M`, bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Funded', value: String(fundedProjects), bg: 'bg-green-50 border-green-200' },
                      { label: 'Awaiting Funding', value: String(awaitingFunding), bg: 'bg-amber-50 border-amber-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Local context: derived from scoped waterbody risk, compliance posture, and municipal funding profile</p>
                </CardContent>
              </Card>
            );
          })());

          case 'infra-construction': return DS((() => {
            const scopeName = selectedJurisdiction?.name || jurisdictionLabel;
            const scopedCount = jurisdictionScopedWbMarkers.length;
            const highAlerts = jurisdictionScopedWbMarkers.filter(wb => wb.alertLevel === 'high').length;
            const activeProjects = Math.max(2, Math.round(scopedCount * 0.28) + Math.max(0, highAlerts));
            const onSchedule = Math.max(1, Math.round(activeProjects * (highAlerts > 0 ? 0.68 : 0.8)));
            const behindSchedule = Math.max(0, activeProjects - onSchedule);
            const completedYtd = Math.max(1, Math.round(activeProjects * 0.42));
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-slate-600" />
                    Construction Project Tracker
                  </CardTitle>
                  <CardDescription>Active construction work and milestone pressure for {scopeName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Active Projects', value: String(activeProjects), bg: 'bg-blue-50 border-blue-200' },
                      { label: 'On Schedule', value: String(onSchedule), bg: 'bg-green-50 border-green-200' },
                      { label: 'Behind Schedule', value: String(behindSchedule), bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Completed (YTD)', value: String(completedYtd), bg: 'bg-slate-50 border-slate-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Local context: modeled from current alert distribution and scoped infrastructure workload</p>
                </CardContent>
              </Card>
            );
          })());

          case 'infra-green': return DS((() => {
            const scopeName = selectedJurisdiction?.name || jurisdictionLabel;
            const scopedCount = jurisdictionScopedWbMarkers.length;
            const giProjects = Math.max(4, Math.round(scopedCount * 1.35));
            const acresManaged = Math.max(40, Math.round(giProjects * 7.8));
            const capturedGallonsM = Math.max(1.1, Math.round((giProjects * 0.21 + localKpi.grantFundingM * 0.18) * 10) / 10);
            const coBenefit = localKpi.ejTracts >= 6 ? 'High' : localKpi.ejTracts >= 3 ? 'Moderate' : 'Targeted';
            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-600" />
                    Green Infrastructure
                  </CardTitle>
                  <CardDescription>Nature-based stormwater assets and co-benefits for {scopeName}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'GI Projects', value: String(giProjects), bg: 'bg-green-50 border-green-200' },
                      { label: 'Acres Managed', value: acresManaged.toLocaleString(), bg: 'bg-green-50 border-green-200' },
                      { label: 'Runoff Captured', value: `${capturedGallonsM}M gal/yr`, bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Co-Benefits', value: coBenefit, bg: 'bg-emerald-50 border-emerald-200' },
                    ].map(k => (
                      <div key={k.label} className={`rounded-xl border p-4 ${k.bg}`}>
                        <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                        <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-4 italic">Local context: GI inventory and modeled runoff capture tied to jurisdiction-scale project density</p>
                </CardContent>
              </Card>
            );
          })());

          case 'bmp-inventory':
          case 'bmp-analytics':
          case 'bmp-maintenance':
          case 'mcm-dashboard':
          case 'rw-profiles':
          case 'rw-impairment':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} - stormwater placeholder (shared with MS4)
              </div>
            );

          case 'nutrientcredits': return DS((() => {
            if (!activeDetailId || !regionMockData) return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                Select a waterbody from the map to view Nutrient Credit Trading
              </div>
            );
            return (
              <div id="section-nutrientcredits" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => onToggleCollapse('nutrientcredits')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-bold text-slate-800">Nutrient Credit Trading - {jurisdictionScopedWbMarkers.find(w => w.id === activeDetailId)?.name || activeDetailId}</span>
                  <span>{isSectionOpen('nutrientcredits') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}</span>
                </button>
                {isSectionOpen('nutrientcredits') && (
                  <div className="p-4">
                    <NutrientCreditsTrading
                      stormEvents={stormEvents}
                      influentData={influentData}
                      effluentData={effluentData}
                      removalEfficiencies={removalEfficiencies}
                      timeRange={{ start: new Date(Date.now() - 90 * 86400000), end: new Date() }}
                    />
                  </div>
                )}
              </div>
            );
          })());

          case 'tmdl': return DS((() => {
            if (!activeDetailId || !regionMockData) return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                Select a waterbody from the map to view TMDL Reporter
              </div>
            );
            const activeAlertCount = jurisdictionScopedRegionData.filter(r => r.alertLevel === 'high' || r.alertLevel === 'medium').length;
            return (
              <div id="section-tmdl" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => onToggleCollapse('tmdl')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-bold text-slate-800">TMDL Compliance & EJ Impact - {jurisdictionScopedWbMarkers.find(w => w.id === activeDetailId)?.name || activeDetailId}</span>
                  <span>{isSectionOpen('tmdl') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}</span>
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

          case 'mdeexport': return DS((() => {
            if (!activeDetailId || !regionMockData || !displayData) return (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                Select a waterbody from the map to view MS4 Report Generator
              </div>
            );
            const regionName = jurisdictionScopedWbMarkers.find(w => w.id === activeDetailId)?.name || activeDetailId.replace(/_/g, ' ');
            return (
              <div id="section-mdeexport" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <button onClick={() => onToggleCollapse('mdeexport')} className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors">
                  <span className="text-sm font-bold text-slate-800">MDE Compliance Report - {regionName}</span>
                  <span>{isSectionOpen('mdeexport') ? <Minus className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}</span>
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

          case 'ph-contaminants':
          case 'ph-advisories':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} - public health placeholder (shared component)
              </div>
            );

          case 'grants': return DS(
            <GrantOpportunityMatcher
              regionId={`${effectiveState.toLowerCase()}_${selectedJurisdictionId}`}
              removalEfficiencies={{ TSS: 85, TN: 40, TP: 50, bacteria: 80, DO: 25 }}
              alertsCount={0}
              userRole="Local"
              stateAbbr={effectiveState}
            />
          );

          case 'fund-active': return DS(
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Active Grants & Funding
                </CardTitle>
                <CardDescription>Currently active grants and funding sources for municipal programs</CardDescription>
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
                        <Badge variant="outline" className={`text-2xs ${g.status === 'New' ? 'border-blue-300 text-blue-700' : 'border-green-300 text-green-700'}`}>{g.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3 italic">Data source: Grants management system, SAM.gov, state funding portals</p>
              </CardContent>
            </Card>
          );

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
                      <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
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
                      <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">{k.label}</div>
                      <div className="text-2xl font-bold text-slate-800 mt-1">{k.value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 italic">Data source: State SRF program, municipal loan records</p>
              </CardContent>
            </Card>
          );

          case 'disaster-active':
          case 'disaster-response':
          case 'disaster-prep':
            return DS(
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
                {section.label} - emergency placeholder (shared component)
              </div>
            );

          case 'resolution-planner': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Resolution Plan Workspace - placeholder (shared component)
            </div>
          );

          case 'exporthub': return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              Data Export Hub - placeholder (shared component)
            </div>
          );

          // -- Habitat & Ecology --
          case 'hab-ecoscore': {
            const ecoData = getEcoData(effectiveState);
            const ecoScore = getEcoScore(effectiveState);
            const label = ecoScoreLabel(ecoScore);
            const scoreBg = ecoScoreStyle(ecoScore).bg;
            return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Fish className="h-5 w-5 text-emerald-600" />
                    Ecological Sensitivity — {effectiveState}
                  </CardTitle>
                  <CardDescription>T&amp;E species in your jurisdiction</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`rounded-xl border p-4 flex items-center justify-between ${scoreBg}`}>
                    <div>
                      <div className="text-2xs font-bold uppercase tracking-wider opacity-70">Eco Score</div>
                      <div className="text-xs opacity-80 mt-1">
                        {ecoData ? `${ecoData.totalTE} T&E species · ${ecoData.aquaticTE} aquatic · ${ecoData.criticalHabitat} critical habitat` : 'No T&E data available'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">{ecoScore}</div>
                      <Badge variant="outline" className="text-2xs mt-1">{label}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          case 'hab-wildlife': {
            const teData = getEcoData(effectiveState);
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
                    Threatened & Endangered Species - {effectiveState}
                    <Badge variant="secondary" className="ml-1 text-2xs">USFWS ECOS</Badge>
                  </CardTitle>
                  <CardDescription>Protected species near local development areas - informs planning and zoning decisions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-xl border p-4 bg-slate-50 border-slate-200">
                      <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">Total T&E</div>
                      <div className="text-2xl font-bold text-slate-800 mt-1">{federalTotal}</div>
                      <div className="text-2xs text-slate-400">Federal ESA</div>
                    </div>
                    <div className="rounded-xl border p-4 bg-blue-50 border-blue-200">
                      <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">Aquatic T&E</div>
                      <div className="text-2xl font-bold text-blue-700 mt-1">{federalAquatic}</div>
                      <div className="text-2xs text-slate-400">Freshwater / marine</div>
                    </div>
                    <div className="rounded-xl border p-4 bg-rose-50 border-rose-200">
                      <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">Critical Habitat</div>
                      <div className="text-2xl font-bold text-rose-700 mt-1">{critHab}</div>
                      <div className="text-2xs text-slate-400">Designated areas</div>
                    </div>
                    <div className="rounded-xl border p-4 bg-amber-50 border-amber-200">
                      <div className="text-2xs font-bold uppercase tracking-wider text-slate-500">Eco Score</div>
                      <div className="text-2xl font-bold text-amber-700 mt-1">{getEcoScore(effectiveState)}</div>
                      <div className="text-2xs text-slate-400">{ecoScoreLabel(getEcoScore(effectiveState))}</div>
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
                  <p className="text-xs text-slate-400 italic">Source: USFWS ECOS - ESA-listed species by state (2024-2025)</p>
                </CardContent>
              </Card>
            );
          }

          // -- Water Quality Trading --
          case 'wqt': return NUTRIENT_TRADING_STATES.has(effectiveState) ? DS(
            <WaterQualityTradingPanel
              stateAbbr={effectiveState}
              mode="local"
              jurisdictionName={selectedJurisdiction?.name || jurisdictionLabel}
              permitNumber={selectedJurisdiction?.permitId}
              permitType={selectedJurisdiction?.phase}
              watersheds={jurisdictionScopedWbMarkers.slice(0, 4).map((w) => w.name)}
            />
          ) : null;

          case 'ask-pin-universal': return DS(
            <AskPinUniversalCard role="Local" state={effectiveState} />
          );

          // -- Disclaimer --
          case 'disclaimer': return null;

          // ===================================================================
          // SHARED PANELS - TRENDS, POLICY, CONTAMINANTS
          // ===================================================================

          case 'trends-dashboard': return DS((() => {
            const scopedWaterbodies = jurisdictionScopedWbMarkers;
            const scopedElevated = scopedWaterbodies.filter(wb => wb.alertLevel === 'high' || wb.alertLevel === 'medium').length;
            const scopedHigh = scopedWaterbodies.filter(wb => wb.alertLevel === 'high').length;
            const monitoredCoverage = scopedWaterbodies.length > 0
              ? Math.round((scopedWaterbodies.filter(wb => wb.dataSourceCount > 0).length / scopedWaterbodies.length) * 100)
              : 0;
            const impairmentDelta = scopedWaterbodies.length > 0
              ? Math.max(1.2, Math.min(8.8, (scopedElevated / scopedWaterbodies.length) * 11))
              : 2.4;
            const scopeLabel = selectedJurisdictionId === 'default'
              ? `${effectiveState} local jurisdictions`
              : jurisdictionLabel;

            return (
              <Card>
                <CardHeader>
                  <CardTitle>Local Trends & Projections - {scopeLabel}</CardTitle>
                  <CardDescription>
                    Same trend model used in state/federal dashboards, scoped to the selected jurisdiction profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Impairment Trend',
                        value: `down  ${impairmentDelta.toFixed(1)}%`,
                        sub: 'vs. recent local baseline',
                        color: 'text-green-600',
                        bg: 'bg-green-50 border-green-200',
                        tooltip: `Modeled from currently selected scope (${scopeLabel}).`,
                      },
                      {
                        label: 'Elevated Alerts',
                        value: `${scopedElevated}`,
                        sub: `${scopedHigh} high severity`,
                        color: scopedHigh > 0 ? 'text-amber-700' : 'text-blue-600',
                        bg: scopedHigh > 0 ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200',
                        tooltip: 'Waterbodies in medium/high alert status in selected jurisdiction.',
                      },
                      {
                        label: 'Monitoring Coverage',
                        value: `${monitoredCoverage}%`,
                        sub: `${scopedWaterbodies.length} tracked sites`,
                        color: 'text-blue-600',
                        bg: 'bg-blue-50 border-blue-200',
                        tooltip: 'Share of scoped waterbodies with active data sources.',
                      },
                      {
                        label: 'Forecast Pressure',
                        value: scopedHigh > 0 ? 'Elevated' : 'Stable',
                        sub: 'next 90-day outlook',
                        color: scopedHigh > 0 ? 'text-red-600' : 'text-green-600',
                        bg: scopedHigh > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200',
                        tooltip: 'Composite risk signal based on alerts, coverage, and recent local trends.',
                      },
                    ].map(t => (
                      <div key={t.label} className={`rounded-xl border p-4 ${t.bg}`} title={t.tooltip}>
                        <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                          <span>{t.label}</span>
                          <Info className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className={`text-2xl font-bold ${t.color} mt-1`}>{t.value}</div>
                        <div className="text-2xs text-slate-500 mt-1">{t.sub}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Jurisdiction Trend Categories</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        {
                          category: 'Impaired Waters Trajectory',
                          trend: scopedElevated > 2 ? 'Watch' : 'Improving',
                          detail: `${scopeLabel} currently has ${scopedElevated} elevated waterbody alerts across ${scopedWaterbodies.length} tracked locations.`,
                          color: scopedElevated > 2 ? 'text-amber-700' : 'text-green-700',
                          bg: scopedElevated > 2 ? 'border-amber-200' : 'border-green-200',
                        },
                        {
                          category: 'Permit & Program Pressure',
                          trend: scopedHigh > 0 ? 'Rising' : 'Stable',
                          detail: scopedHigh > 0
                            ? `${scopedHigh} high-severity locations indicate increased compliance and inspection load.`
                            : 'No high-severity locations currently flagged in this jurisdiction scope.',
                          color: scopedHigh > 0 ? 'text-red-700' : 'text-blue-700',
                          bg: scopedHigh > 0 ? 'border-red-200' : 'border-blue-200',
                        },
                        {
                          category: 'Monitoring Network Quality',
                          trend: monitoredCoverage >= 70 ? 'Strong' : 'Expanding',
                          detail: `Coverage is ${monitoredCoverage}% for selected scope, with additional value from continuous station expansion.`,
                          color: monitoredCoverage >= 70 ? 'text-green-700' : 'text-blue-700',
                          bg: monitoredCoverage >= 70 ? 'border-green-200' : 'border-blue-200',
                        },
                      ].map(c => (
                        <div key={c.category} className={`border rounded-lg p-4 ${c.bg}`}>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-slate-800">{c.category}</h4>
                            <Badge variant="outline" className={`text-2xs ${c.color}`}>{c.trend}</Badge>
                          </div>
                          <p className="text-xs text-slate-500 leading-relaxed">{c.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 mb-3">Next 6-12 Month Projection</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        {
                          scenario: 'Improvement Scenario',
                          impacts: [
                            `Reduce elevated alerts from ${scopedElevated} to ${Math.max(0, scopedElevated - 2)} with targeted follow-up.`,
                            'Prioritize hotspot inspection routing and permit closure actions.',
                            'Improve monitored coverage through supplemental local station deployment.',
                          ],
                        },
                        {
                          scenario: 'Stress Scenario',
                          impacts: [
                            'Storm-driven runoff events could amplify nutrient and bacteria spikes in known hotspots.',
                            'Low-coverage areas may lag in early detection and intervention response time.',
                            `Program workload may increase if high-severity sites remain above ${Math.max(1, scopedHigh)} over multiple cycles.`,
                          ],
                        },
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

                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-2xs text-slate-600 space-y-1">
                    <div className="italic">
                      Local projections use the same trend/projection model framework as state and federal views, filtered to the selected jurisdiction.
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Scope: {scopeLabel}</span>
                      <span className="font-semibold">{scopedWaterbodies.length} local waterbodies</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })());

          case 'policy-tracker': return DS((() => {
            const scopeName = selectedJurisdiction?.name || jurisdictionLabel;
            const federalRows = [
              {
                id: 'fed-0',
                action: 'EPA PFAS Drinking Water Rule',
                impact: `May trigger additional monitoring and treatment planning for systems serving ${scopeName}`,
                status: 'Comment Period',
                date: '2026-03-15',
                detail: `Federal PFAS rulemaking can increase local sampling, communication, and capital planning workload. Scope currently mapped to ${scopeName}, ${effectiveState}.`,
              },
              {
                id: 'fed-1',
                action: 'CWA Section 401 Certification Update',
                impact: `Affects permit timing and interagency review for projects in ${effectiveState}`,
                status: 'Final Rule',
                date: '2026-01-10',
                detail: 'Revised certification timeline and documentation standards can shift local project sequencing and legal review checkpoints.',
              },
            ];
            const stateRows = [
              {
                id: 'state-0',
                action: `${effectiveState} Stormwater / MS4 Guidance Refresh`,
                impact: `Operational updates for permit reporting and BMP verification in ${scopeName}`,
                status: 'In Effect',
                date: '2026-02-01',
                detail: 'State program guidance update emphasizes inspection traceability, digital evidence retention, and targeted follow-up for elevated outfalls.',
              },
              {
                id: 'state-1',
                action: `${effectiveState} Nutrient Reduction Implementation Schedule`,
                impact: `Potential milestone pressure on local implementation plans`,
                status: 'Proposed',
                date: '2026-04-30',
                detail: 'Draft schedule includes updated milestone checkpoints and state-level performance reporting cadence for local jurisdictions.',
              },
            ];
            const localRows = [
              {
                id: 'local-0',
                action: `${scopeName} ordinance and capital alignment`,
                impact: 'Local code, CIP timing, and permitting sequence should be aligned to current state/federal requirements',
                status: 'Action Needed',
                date: 'Next 30 Days',
                detail: 'Prioritize ordinance crosswalk, project phasing dependencies, and legal review for high-urgency regulatory changes.',
              },
              {
                id: 'local-1',
                action: `${scopeName} council/board briefing package`,
                impact: 'Improve executive clarity on compliance exposure, timeline, and budget implications',
                status: 'Prepare',
                date: 'Next Meeting',
                detail: 'Provide concise talking points, exposure summary, deadline calendar, and funding strategy options specific to current jurisdiction scope.',
              },
            ];

            const renderPolicyGroup = (title: string, description: string, rows: Array<{ id: string; action: string; impact: string; status: string; date: string; detail: string }>, accent: string) => (
              <div className={`rounded-xl border p-4 ${accent}`}>
                <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
                <p className="text-xs text-slate-500 mt-1">{description}</p>
                <div className="mt-3 space-y-2">
                  {rows.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                      <button
                        onClick={() => setPolicyExpanded((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
                        className="w-full text-left p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-slate-800">{r.action}</span>
                          <Badge variant="outline" className="text-2xs">{r.status}</Badge>
                        </div>
                        <p className="text-xs text-slate-600">{r.impact}</p>
                        <p className="text-2xs text-slate-400 mt-1">{r.date}</p>
                      </button>
                      {policyExpanded[r.id] && (
                        <div className="px-3 pb-3">
                          <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                            <p className="text-xs text-slate-700">{r.detail}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );

            return (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5 text-purple-600" />
                    Policy & Regulatory Tracker - {scopeName}
                  </CardTitle>
                  <CardDescription>
                    Federal, state, and local policy context for {scopeName} ({effectiveState})
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {renderPolicyGroup(
                    'Federal Actions',
                    'National rulemaking and oversight likely to affect local compliance and funding posture.',
                    federalRows,
                    'bg-blue-50/40 border-blue-200'
                  )}
                  {renderPolicyGroup(
                    `${effectiveState} State Actions`,
                    'State program direction and implementation updates relevant to this jurisdiction.',
                    stateRows,
                    'bg-violet-50/40 border-violet-200'
                  )}
                  {renderPolicyGroup(
                    'Local Jurisdiction Impacts',
                    'Near-term execution focus for elected officials and program managers.',
                    localRows,
                    'bg-emerald-50/40 border-emerald-200'
                  )}
                  <p className="text-xs text-slate-400 italic">
                    Context scope: {scopeName}. State context follows {effectiveState} and admin jurisdiction selection.
                  </p>
                </CardContent>
              </Card>
            );
          })());

          case 'contaminants-tracker': return DS((() => {
            const hasJurisdictionScope = selectedJurisdictionId !== 'default';
            const trackerRole = hasJurisdictionScope
              ? ((isAdmin || user?.role === 'Pearl') ? 'ms4_admin' : 'ms4')
              : 'state';
            const scopeLabel = hasJurisdictionScope ? jurisdictionLabel : `${effectiveState} statewide`;
            return (
              <EmergingContaminantsTracker
                key={`${effectiveState}-${selectedJurisdictionId}-${trackerRole}`}
                role={trackerRole}
                selectedState={`${effectiveState} - ${scopeLabel}`}
              />
            );
          })());

          case 'training': return DS(
            <RoleTrainingGuide rolePath="/dashboard/local" />
          );

        case 'users-panel': {
          if (user?.adminLevel === 'none') return null;
          return DS(
            <UserManagementPanel scopeFilter={{
              allowedRoles: getInvitableRoles(user?.adminLevel || 'none', user?.role || 'Local'),
              lockedState: user?.adminLevel === 'super_admin' ? undefined : user?.state,
              lockedJurisdiction: user?.adminLevel === 'super_admin' ? undefined : user?.ms4Jurisdiction,
            }} />
          );
        }

        case 'correlation-breakthroughs': return DS(
          <CorrelationBreakthroughsPanel state={effectiveState} />
        );

        case 'lens-data-story': return DS(
          <LensDataStory lens={viewLens} role="Local" state={effectiveState} />
        );

          default: return DS(
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-sm text-slate-500">
              {section.label} - section placeholder
            </div>
          );
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





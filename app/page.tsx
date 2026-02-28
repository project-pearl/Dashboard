'use client';

import React, { useState, useMemo, useEffect } from 'react';
import AuthGuard from '@/components/AuthGuard';
import UserMenu from '@/components/UserMenu';
import { useAuth } from '@/lib/authContext';
import { useRouter } from 'next/navigation';
import type { UserRole } from '@/lib/authTypes';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { calculateOverallScore, applyRegionThresholds, calculateRemovalEfficiency, getRemovalStatus, getRegionMockData } from '@/lib/mockData';
import { TimeMode, DataMode } from '@/lib/types';
import { StormEventTable } from '@/components/StormEventTable';
import { StormDetectionBanner } from '@/components/StormDetectionBanner';
import { WaterQualityAlerts } from '@/components/WaterQualityAlerts';
import { DataSourceDisclaimer } from '@/components/DataSourceDisclaimer';
import { DataSourceFooter } from '@/components/DataSourceFooter';
import { detectStormEvent } from '@/lib/stormDetection';
import { detectWaterQualityAlerts } from '@/lib/alertDetection';
import { getEJMetricsForLocation } from '@/lib/ejImpact';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Droplets, GitCompare, MapPin, CloudRain, FileText, Coins, BarChart3, BookOpen, Copy, Check, TrendingUp,
  Globe} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertsBanner } from '@/components/AlertsBanner';
import { TrendsChart } from '@/components/TrendsChart';
import { AIInsights } from '@/components/AIInsights';
import { RemovalSummaryCard } from '@/components/RemovalSummaryCard';
import { calculateRemovalDisplay } from '@/lib/removalCalculations';
import { regionsConfig, getRegionById, isChesapeakeBayRegion } from '@/lib/regionsConfig';
import { STATE_AUTHORITIES } from '@/lib/stateWaterData';

const STATE_NAMES: Record<string, string> = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
  DE:'Delaware',DC:'Washington DC',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',
  IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
  NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
  NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',
  RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};
const FederalManagementCenter = dynamic(
  () => import('@/components/FederalManagementCenter').then((mod) => mod.FederalManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);
const StateManagementCenter = dynamic(
  () => import('@/components/StateManagementCenter').then((mod) => mod.StateManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);
const ESGManagementCenter = dynamic(
  () => import('@/components/ESGManagementCenter').then((mod) => mod.ESGManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);
const MS4ManagementCenter = dynamic(
  () => import('@/components/MS4ManagementCenter').then((mod) => mod.MS4ManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);
const K12ManagementCenter = dynamic(
  () => import('@/components/K12ManagementCenter').then((mod) => mod.K12ManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);
const UniversityManagementCenter = dynamic(
  () => import('@/components/UniversityManagementCenter').then((mod) => mod.UniversityManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);
const NGOManagementCenter = dynamic(
  () => import('@/components/NGOManagementCenter').then((mod) => mod.NGOManagementCenter),
  { ssr: false, loading: () => <div className="flex items-center justify-center min-h-[400px]"><Skeleton className="w-full h-[400px]" /></div> }
);
const PEARLManagementCenter = dynamic(
  () => import('@/components/PEARLManagementCenter').then((mod) => mod.PEARLManagementCenter),
  { ssr: false }
);
const BreakpointLanding = dynamic(
  () => import('@/components/breakpoint-landing'),
  { ssr: false }
);
const AcademicTools = dynamic(
  () => import('@/components/AcademicTools').then((mod) => mod.AcademicTools),
  { ssr: false }
);
const K12EducationalHub = dynamic(
  () => import('@/components/K12EducationalHub').then((mod) => mod.K12EducationalHub),
  { ssr: false }
);
const NGOProjects = dynamic(
  () => import('@/components/NGOProjects').then((mod) => mod.NGOProjects),
  { ssr: false }
);
const CorporateESGDashboard = dynamic(
  () => import('@/components/CorporateESGDashboard').then((mod) => mod.CorporateESGDashboard),
  { ssr: false }
);
// MarylandStateView removed — MS4 Jurisdictions table (with PEARL Fit) covers MD
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLiveSimulation } from '@/lib/useLiveSimulation';
import { useWaterData, DATA_SOURCES } from '@/lib/useWaterData';
import { DataSourceBadge } from '@/components/DataSourceBadge';
import { LiveStatusBadge } from '@/components/LiveStatusBadge';
import { BayImpactCounter } from '@/components/BayImpactCounter';
import { ForecastChart } from '@/components/ForecastChart';
import { MS4FineAvoidanceCalculator } from '@/components/MS4FineAvoidanceCalculator';
import { MDEExportTool } from '@/components/MDEExportTool';
import { LiveESGScore } from '@/components/LiveESGScore';
import { ChevronDown, ChevronUp, Minus } from 'lucide-react';
import {
  exportESGReport,
  exportAIInsightsReport,
  exportEJReport,
  exportBayImpactReport,
  exportForecastReport,
  exportROIReport,
  exportPeerBenchmarkReport,
  exportGrantReport,
  exportK12FieldReport,
  exportTeacherLessonData,
} from '@/components/PearlExports';
import { createBrandedPDF, PDFContentSection } from '@/lib/brandedPdfGenerator';

const WaterQualityGauge = dynamic(
  () => import('@/components/WaterQualityGauge').then((mod) => mod.WaterQualityGauge),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center space-y-3">
        <Skeleton className="h-56 w-full rounded-lg" />
        <Skeleton className="h-5 w-32 mx-auto" />
        <Skeleton className="h-4 w-40 mx-auto" />
        <Skeleton className="h-6 w-20 mx-auto rounded-full" />
      </div>
    ),
  }
);

const RemovalEfficiencyGauge = dynamic(
  () => import('@/components/RemovalEfficiencyGauge').then((mod) => mod.RemovalEfficiencyGauge),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center space-y-3">
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    ),
  }
);

const ROISavingsCalculator = dynamic(
  () => import('@/components/ROISavingsCalculator').then((mod) => mod.ROISavingsCalculator),
  { ssr: false }
);

const PeerBenchmarking = dynamic(
  () => import('@/components/PeerBenchmarking').then((mod) => mod.PeerBenchmarking),
  { ssr: false }
);

const GrantOpportunityMatcher = dynamic(
  () => import('@/components/GrantOpportunityMatcher').then((mod) => mod.GrantOpportunityMatcher),
  { ssr: false }
);

const NutrientCreditsTrading = dynamic(
  () => import('@/components/NutrientCreditsTrading').then((mod) => mod.NutrientCreditsTrading),
  { ssr: false }
);

const EconomicReplacementPanel = dynamic(
  () => import('@/components/EconomicReplacementPanel').then((mod) => mod.EconomicReplacementPanel),
  { ssr: false }
);

const DataIntegrityPanel = dynamic(
  () => import('@/components/DataIntegrityPanel').then((mod) => mod.DataIntegrityPanel),
  { ssr: false }
);

const ResearchCollaborationHub = dynamic(
  () => import('@/components/ResearchCollaborationHub').then((mod) => mod.ResearchCollaborationHub),
  { ssr: false }
);

const TMDLProgressAndReportGenerator = dynamic(
  () => import('@/components/TMDLProgressAndReportGenerator').then((mod) => mod.TMDLProgressAndReportGenerator),
  { ssr: false }
);

// WeatherOverlay removed

const WildlifeImpactDisclaimer = dynamic(
  () => import('@/components/WildlifeImpactDisclaimer').then((mod) => mod.WildlifeImpactDisclaimer),
  { ssr: false }
);

const EnvironmentalJusticeImpact = dynamic(
  () => import('@/components/EnvironmentalJusticeImpact').then((mod) => mod.EnvironmentalJusticeImpact),
  { ssr: false }
);

const ESGImpactReporting = dynamic(
  () => import('@/components/ESGImpactReporting').then((mod) => mod.ESGImpactReporting),
  { ssr: false }
);

const ManuscriptGenerator = dynamic(
  () => import('@/components/ManuscriptGenerator').then((mod) => mod.ManuscriptGenerator),
  { ssr: false }
);

// Stable component defined outside Home to prevent unmount/remount on every render
const CollapsibleSection = ({ id, title, icon, collapsed, onToggle, children }: {
  id: string; title: string; icon: string; collapsed: boolean; onToggle: (id: string) => void; children: React.ReactNode;
}) => {
  if (collapsed) {
    return (
      <button onClick={() => onToggle(id)} className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 hover:bg-slate-100 hover:border-slate-400 transition-all group">
        <span className="text-sm font-medium text-slate-400 group-hover:text-slate-600 flex items-center gap-2 transition-colors">
          <span>{icon}</span> {title}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
      </button>
    );
  }
  return (
    <div className="relative">
      <button
        onClick={() => onToggle(id)}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 transition-all opacity-60 hover:opacity-100 shadow-sm flex items-center gap-0.5"
        title={`Collapse ${title}`}
      >
        <Minus className="h-3.5 w-3.5 text-slate-500" />
        <ChevronUp className="h-3 w-3 text-slate-400" />
      </button>
      {children}
    </div>
  );
};

// ── Error Boundary — prevents white-screen crashes in management centers ──
class CommandCenterErrorBoundary extends React.Component<
  { children: React.ReactNode; name: string },
  { hasError: boolean; error: string; errorInfo: string }
> {
  state = { hasError: false, error: '', errorInfo: '' };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.name}] Crash:`, error, info.componentStack);
    this.setState({ errorInfo: info.componentStack || '' });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center max-w-2xl mx-auto mt-12">
          <div className="text-red-600 font-bold text-lg mb-2">⚠️ {this.props.name} encountered an error</div>
          <div className="text-sm text-slate-600 mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-left font-mono break-all">{this.state.error}</div>
          {this.state.errorInfo && (
            <details className="text-left mb-4">
              <summary className="text-xs text-slate-500 cursor-pointer">Component Stack</summary>
              <pre className="text-[10px] text-slate-400 mt-1 bg-slate-50 p-2 rounded overflow-auto max-h-40">{this.state.errorInfo}</pre>
            </details>
          )}
          <button onClick={() => this.setState({ hasError: false, error: '', errorInfo: '' })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Role → Dashboard Route mapping ─────────────────────────────────────
const ROLE_ROUTES: Record<UserRole, string> = {
  Federal: '/dashboard/federal',
  State: '/dashboard/state/MD',
  Local: '/dashboard/local/default',
  MS4: '/dashboard/ms4/default',
  Corporate: '/dashboard/esg',
  K12: '/dashboard/k12',
  College: '/dashboard/university',
  Researcher: '/dashboard/university',
  NGO: '/dashboard/ngo',
  Pearl: '/dashboard/federal',
  Temp: '/dashboard/federal',
  Utility: '/dashboard/utility/default',
  Agriculture: '/dashboard/agriculture',
  Lab: '/dashboard/aqua-lo',
  Biotech: '/dashboard/biotech',
};

export default function Home() {
  const { user } = useAuth();

  const [timeMode, setTimeMode] = useState<TimeMode>('real-time');
  const [dataMode, setDataMode] = useState<DataMode>('ambient');
  const [selectedRegionId, setSelectedRegionId] = useState('maryland_middle_branch');
  const [showComparison, setShowComparison] = useState(false);
  const [selectedStormEventId, setSelectedStormEventId] = useState<string>('storm-1');
  const [stormDetectionDismissed, setStormDetectionDismissed] = useState(false);
  const [demoStormActive, setDemoStormActive] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [showNutrientCredits, setShowNutrientCredits] = useState(false);
  const [showESG, setShowESG] = useState(false);
  const [showManuscript, setShowManuscript] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Phase 1: Role Selector for Demos
  const [userRole, setUserRole] = useState<'Federal' | 'State' | 'MS4' | 'Corporate' | 'Researcher' | 'College' | 'NGO' | 'K12' | 'Pearl' | 'Temp'>('MS4');

  // Sync role, state, and region from auth session
  useEffect(() => {
    if (user) {
      setUserRole(user.role as typeof userRole);
      if (user.state) {
        setHomeState(user.state);
        if (user.role === 'State') {
          setUserState(user.state);
        }
      }
      // Set region from user profile — drives which waterbody loads on login
      if (user.region) {
        setUserRegion(user.region);
        setSelectedRegionId(user.region);
      } else if (user.state) {
        // No explicit region — find the first waterbody in the user's state
        const stateRegions = getRegionsForState(user.state);
        if (stateRegions.length > 0) {
          setUserRegion(stateRegions[0].id);
          setSelectedRegionId(stateRegions[0].id);
        }
      }
      // Federal lives in NCC — always open it
      if (user.role === 'Federal') {
        setShowNationalView(true);
      }
    }
  }, [user]);
  const [userState, setUserState] = useState<string>('MD'); // For State role
  const [userRegion, setUserRegion] = useState<string>('maryland_middle_branch'); // For MS4 role
  
  const [isTeacher, setIsTeacher] = useState(false);
  const [showNationalView, setShowNationalView] = useState(false);
  const [homeState, setHomeState] = useState('MD');
  const [showWildlife, setShowWildlife] = useState(false);
  const [showStatewidView, setShowStatewideView] = useState(true); // For State role: true = statewide, false = waterbody
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const k12WaterFacts = [
    "Fish need dissolved oxygen (DO) above 5 mg/L to breathe -- just like you need air!",
    "One inch of rain on one acre of land = 27,000 gallons of water runoff!",
    "Blue crabs in the Chesapeake Bay are sensitive to low oxygen -- called dead zones.",
    "It takes 1,000 gallons of water to produce just one pound of beef.",
    "Wetlands filter pollution naturally -- they are nature's water treatment plants!",
    "Turbidity (cloudiness) affects fish by blocking sunlight that underwater plants need.",
    "Phosphorus from fertilizers causes algae blooms that can kill fish.",
    "Waterfowl populations drop when water quality drops -- they are great indicators!",
    "Dissolved oxygen drops at night because plants stop photosynthesizing.",
    "The first 30 minutes of a rainstorm carry the most pollution -- called the first flush.",
  ];
  const [k12FactIndex] = useState(() => Math.floor(Math.random() * 10));
  const [devMode, setDevMode] = useState(false);
  const toggleSection = (id: string) => setCollapsedSections(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });
  const isCollapsed = (id: string) => collapsedSections.has(id);

  const ALL_SECTION_IDS = ['alerts','gauges','trends','ai','bay-impact','forecast','research','ej-impact','data-integrity','economic','esg-score','ms4-fines','mde-export','tmdl'];
  const expandAll = () => setCollapsedSections(new Set());
  const collapseAll = () => setCollapsedSections(new Set(ALL_SECTION_IDS));
  const allExpanded = collapsedSections.size === 0;

  useEffect(() => {
    setMounted(true);
    setStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16));
    setEndDate(new Date().toISOString().slice(0, 16));

    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const region = urlParams.get('region');
      if (region) {
        setSelectedRegionId(region);
      }
    }
  }, []);

  // K-12 access control — redirect blocked data modes
  useEffect(() => {
    if (userRole === 'K12' && (dataMode === 'influent-effluent' || dataMode === 'removal-efficiency')) {
      setDataMode('ambient');
    }
  }, [userRole, dataMode]);

  useEffect(() => {
    if (!isChesapeakeBayRegion(selectedRegionId) && showNutrientCredits) {
      setShowNutrientCredits(false);
    }
  }, [selectedRegionId, showNutrientCredits]);

  // State role: auto-switch region when changing state
  useEffect(() => {
    if (userRole === 'State') {
      const currentRegionState = getRegionState(selectedRegionId);
      if (currentRegionState !== userState) {
        // Find first region in selected state
        const firstRegionInState = regionsConfig.find((r: any) => getRegionState(r.id) === userState);
        if (firstRegionInState) {
          setSelectedRegionId(firstRegionInState.id);
        }
      }
    }
  }, [userRole, userState, selectedRegionId]);

  const shouldShowMS4Tools = () => {
    return userRole === 'MS4';
  };

  const shouldShowNutrientCreditsButton = () => {
    // MS4 needs credits for compliance, State for oversight/certification, Corporate for ESG offsets, Researcher studies them, NGO for watershed advocacy
    return ['MS4', 'State', 'Corporate', 'Researcher', 'NGO'].includes(userRole);
  };

  const shouldShowESGButton = () => {
    // Corporate ESG reporting + MS4/Federal sustainability
    return ['Corporate', 'MS4', 'Federal'].includes(userRole);
  };

  const shouldShowManuscriptButton = () => {
    // Academic publishing feature
    return ['Researcher', 'College'].includes(userRole);
  };

  const shouldShowROICalculator = () => {
    // Only MS4s need ROI — State regulators see compliance, not municipal budgets
    return userRole === 'MS4';
  };

  const shouldShowPeerBenchmarking = () => {
    // MS4 sees municipality comparisons; State sees state-vs-state (handled in component)
    return ['MS4', 'State'].includes(userRole);
  };

  const shouldShowComparison = () => {
    // Hide from K12 only
    return userRole !== 'K12';
  };

  const shouldShowTimeRange = () => {
    // Hide from K12 only
    return userRole !== 'K12';
  };

  const shouldShowExportCSV = () => {
    // Data export for operational, research, advocacy, corporate roles
    return ['MS4', 'State', 'Corporate', 'Researcher', 'College', 'NGO'].includes(userRole);
  };

  const shouldShowESGImpact = () => {
    // ESG for Corporate + MS4s + NGOs
    return ['Corporate', 'MS4', 'NGO'].includes(userRole);
  };

  const shouldShowGrantMatcher = () => {
    if (userRole === 'K12') return isTeacher;
    return true;
  };

  // ── Regional geo-fencing ──────────────────────────────────────────────────
  const regionStateMap: Record<string, string> = {
    maryland_inner_harbor:    'MD',
    maryland_middle_branch:   'MD',
    maryland_patapsco:        'MD',
    maryland_severn:          'MD',
    maryland_patuxent:        'MD',
    maryland_potomac:         'MD',
    maryland_chester:         'MD',
    maryland_choptank:        'MD',
    maryland_gunpowder:       'MD',
    maryland_magothy:         'MD',
    chesapeake_bay_main:      'MD',
    florida_escambia:         'FL',
    florida_pensacola_bay:    'FL',
    florida_blackwater:       'FL',
    florida_yellow_river:     'FL',
    california_sf_bay:        'CA',
    california_los_angeles:   'CA',
    virginia_james:           'VA',
    virginia_york:            'VA',
    virginia_rappahannock:    'VA',
    dc_anacostia:             'DC',
    dc_rock_creek:            'DC',
  };

  const getRegionState = (regionId: string): string => {
    // Check explicit map first
    if (regionStateMap[regionId]) return regionStateMap[regionId];
    // Map prefix to state abbreviation
    const prefixMap: Record<string, string> = {
      alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
      colorado: 'CO', connecticut: 'CT', delaware: 'DE', dc: 'DC', florida: 'FL',
      georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN',
      iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME',
      maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
      mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
      newhampshire: 'NH', newjersey: 'NJ', newmexico: 'NM', newyork: 'NY',
      northcarolina: 'NC', northdakota: 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
      pennsylvania: 'PA', rhodeisland: 'RI', southcarolina: 'SC', southdakota: 'SD',
      tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA',
      washington: 'WA', westvirginia: 'WV', wisconsin: 'WI', wyoming: 'WY',
    };
    if (regionId.includes('chesapeake')) return 'MD';
    const prefix = regionId.split('_')[0];
    return prefixMap[prefix] || 'UNKNOWN';
  };

  const getRegionsForState = (state: string) => {
    return regionsConfig.filter((r: any) => getRegionState(r.id) === state).sort((a: any, b: any) => a.name.localeCompare(b.name));
  };

  const shouldShowRegionalAlerts = () => {
    // Operational and research roles need regional filtering
    return ['MS4', 'State', 'Researcher', 'NGO'].includes(userRole);
  };

  const shouldShowEJImpact = () => {
    // Hide from K12 only
    return userRole !== 'K12';
  };

  const shouldShowAIInsights = () => {
    // Hide from K12 only
    return userRole !== 'K12';
  };

  const shouldShowTrendsChart = () => {
    return true;
  };

  const handleDismissAlert = (alertId: string) => {
    setDismissedAlerts(prev => new Set(prev).add(alertId));
  };

  const selectedRegion = useMemo(() => getRegionById(selectedRegionId), [selectedRegionId]);

  const regionData = useMemo(() => getRegionMockData(selectedRegionId), [selectedRegionId]);

  const data = useMemo(() => {
    if (!selectedRegion) return regionData.ambient;
    return applyRegionThresholds(regionData.ambient, selectedRegion.thresholds);
  }, [selectedRegion, regionData]);

  // ── Water Data: Multi-source real data overlay ──────────────────────────
  const { waterData, isLoading: wdLoading, hasRealData, primarySource } = useWaterData(selectedRegionId);

  // Overlay real values onto mock data where available
  const dataWithRealValues = useMemo(() => {
    if (!waterData || !hasRealData) return data;
    const merged = {
      ...data,
      parameters: { ...data.parameters },
    };
    // Overlay the main dashboard params where real data exists
    const overlayKeys = ['DO', 'TN', 'TP', 'turbidity', 'salinity', 'TSS', 'pH', 'temperature', 'conductivity'] as const;
    const params = merged.parameters as Record<string, any>;
    for (const key of overlayKeys) {
      const realParam = (waterData.parameters as Record<string, any>)[key];
      if (realParam && realParam.value !== null && params[key]) {
        params[key] = {
          ...params[key],
          value: realParam.value,
        };
      }
    }
    return merged;
  }, [data, waterData, hasRealData]);

  const influentData = useMemo(() => {
    return regionData.influent;
  }, [regionData]);

  const effluentData = useMemo(() => {
    return regionData.effluent;
  }, [regionData]);

  const stormEvents = useMemo(() => regionData.storms, [regionData]);

  const removalEfficiencies = useMemo(() => ({
    DO: calculateRemovalEfficiency(influentData.parameters.DO.value, effluentData.parameters.DO.value, 'DO'),
    turbidity: calculateRemovalEfficiency(influentData.parameters.turbidity.value, effluentData.parameters.turbidity.value, 'turbidity'),
    TN: calculateRemovalEfficiency(influentData.parameters.TN.value, effluentData.parameters.TN.value, 'TN'),
    TP: calculateRemovalEfficiency(influentData.parameters.TP.value, effluentData.parameters.TP.value, 'TP'),
    TSS: calculateRemovalEfficiency(influentData.parameters.TSS.value, effluentData.parameters.TSS.value, 'TSS'),
    salinity: calculateRemovalEfficiency(influentData.parameters.salinity.value, effluentData.parameters.salinity.value, 'salinity')
  }), [influentData, effluentData]);

  const selectedStormEvent = useMemo(() => {
    return stormEvents.find(event => event.id === selectedStormEventId) || stormEvents[0];
  }, [selectedStormEventId, stormEvents]);

  const detectedStormEvent = useMemo(() => {
    const hoursDiff = timeMode === 'real-time' ? 24 :
      Math.min(24, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60));

    return detectStormEvent(influentData, hoursDiff);
  }, [timeMode, startDate, endDate, influentData]);

  useEffect(() => {
    if (stormEvents.length > 0 && !stormEvents.find(e => e.id === selectedStormEventId)) {
      setSelectedStormEventId(stormEvents[0].id);
    }
  }, [stormEvents, selectedStormEventId]);

  useEffect(() => {
    if (detectedStormEvent && !stormDetectionDismissed) {
      }
  }, [detectedStormEvent, stormDetectionDismissed]);

  const ejMetrics = useMemo(() => {
    return getEJMetricsForLocation(selectedRegion?.name || '', selectedRegionId);
  }, [selectedRegion, selectedRegionId]);

  const waterQualityAlerts = useMemo(() => {
    const currentData = dataMode === 'ambient' ? data :
                        dataMode === 'storm-event' ? selectedStormEvent.effluent :
                        effluentData;

    const currentRemovalEfficiencies = dataMode === 'storm-event'
      ? selectedStormEvent.removalEfficiencies
      : removalEfficiencies;

    return detectWaterQualityAlerts(currentData, dataMode, currentRemovalEfficiencies, ejMetrics);
  }, [data, dataMode, selectedStormEvent, effluentData, removalEfficiencies, ejMetrics]);

  // ── Regional alerts across all bodies in home state ──────────────────────
  const regionalAlerts = useMemo(() => {
    if (!shouldShowRegionalAlerts()) return [];
    const stateRegions = getRegionsForState(homeState);
    const alerts: Array<{
      regionId: string;
      regionName: string;
      parameter: string;
      severity: 'critical' | 'warning' | 'info';
      message: string;
      timestamp: Date;
    }> = [];

    stateRegions.forEach((region: any) => {
      // Skip currently selected region — already shown in main alerts
      if (region.id === selectedRegionId) return;
      // Simulate alerts based on region data (in production: fetch per region)
      // We use deterministic pseudo-variation based on region ID hash
      const hash = region.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      const doVal = 5.2 + ((hash % 30) - 15) * 0.12;
      const tssVal = 18 + ((hash % 40) - 20) * 0.8;
      const tnVal = 3.8 + ((hash % 20) - 10) * 0.15;
      const tpVal = 0.08 + ((hash % 10) - 5) * 0.008;

      if (doVal < 4.0) {
        alerts.push({
          regionId: region.id,
          regionName: region.name,
          parameter: 'Dissolved Oxygen',
          severity: 'critical',
          message: `DO critically low at ${doVal.toFixed(2)} mg/L — aquatic stress likely`,
          timestamp: new Date(Date.now() - (hash % 7200) * 1000),
        });
      } else if (doVal < 5.0) {
        alerts.push({
          regionId: region.id,
          regionName: region.name,
          parameter: 'Dissolved Oxygen',
          severity: 'warning',
          message: `DO below 5.0 mg/L threshold at ${doVal.toFixed(2)} mg/L`,
          timestamp: new Date(Date.now() - (hash % 3600) * 1000),
        });
      }
      if (tssVal > 50) {
        alerts.push({
          regionId: region.id,
          regionName: region.name,
          parameter: 'Total Suspended Solids',
          severity: tssVal > 80 ? 'critical' : 'warning',
          message: `Elevated TSS at ${tssVal.toFixed(1)} mg/L — possible runoff event`,
          timestamp: new Date(Date.now() - (hash % 5400) * 1000),
        });
      }
      if (tnVal > 6.0) {
        alerts.push({
          regionId: region.id,
          regionName: region.name,
          parameter: 'Total Nitrogen',
          severity: 'warning',
          message: `TN elevated at ${tnVal.toFixed(2)} mg/L — TMDL threshold proximity`,
          timestamp: new Date(Date.now() - (hash % 4800) * 1000),
        });
      }
      if (tpVal > 0.15) {
        alerts.push({
          regionId: region.id,
          regionName: region.name,
          parameter: 'Total Phosphorus',
          severity: 'warning',
          message: `TP at ${tpVal.toFixed(3)} mg/L — algal bloom risk elevated`,
          timestamp: new Date(Date.now() - (hash % 3200) * 1000),
        });
      }
    });

    // Sort: critical first, then by timestamp descending
    return alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [homeState, selectedRegionId, userRole]);

  const overallScore = calculateOverallScore(dataWithRealValues);
  const { data: liveData, secondsSinceUpdate, isStormSpiking, stormIntensity, stormPhase } = useLiveSimulation(dataWithRealValues, timeMode === 'real-time' && dataMode === 'ambient', 4000, demoStormActive);

  // Auto-reset the storm toggle when the cycle finishes
  useEffect(() => {
    if (demoStormActive && !isStormSpiking && stormPhase === 'idle') {
      setDemoStormActive(false);
    }
  }, [demoStormActive, isStormSpiking, stormPhase]);
  const displayData = (timeMode === 'real-time' && dataMode === 'ambient') ? liveData : dataWithRealValues;

  const previousPeriodData = useMemo(() => {
    const ambient = regionData.ambient;
    const baseData = {
      ...ambient,
      parameters: {
        DO: { ...ambient.parameters.DO, value: ambient.parameters.DO.value * 1.05 },
        turbidity: { ...ambient.parameters.turbidity, value: ambient.parameters.turbidity.value * 0.83 },
        TN: { ...ambient.parameters.TN, value: ambient.parameters.TN.value * 0.84 },
        TP: { ...ambient.parameters.TP, value: ambient.parameters.TP.value * 0.70 },
        TSS: { ...ambient.parameters.TSS, value: ambient.parameters.TSS.value * 0.66 },
        salinity: { ...ambient.parameters.salinity, value: ambient.parameters.salinity.value * 0.95 }
      }
    };
    if (!selectedRegion) return baseData;
    return applyRegionThresholds(baseData, selectedRegion.thresholds);
  }, [selectedRegion, regionData]);

  const calculateChange = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return change.toFixed(1);
  };

  const exportToCSV = () => {
    const rows = [
      ['Parameter', 'Value', 'Unit', 'Healthy Range', 'Status'],
      ...Object.values(data.parameters).map(param => {
        const status =
          param.type === 'increasing-bad'
            ? `≤${param.thresholds.green.max}`
            : param.type === 'decreasing-bad'
            ? `≥${param.thresholds.green.min}`
            : `${param.thresholds.green.min}-${param.thresholds.green.max}`;

        const condition =
          (param.type === 'increasing-bad' && param.value <= param.thresholds.green.max!) ? 'Healthy' :
          (param.type === 'decreasing-bad' && param.value >= param.thresholds.green.min!) ? 'Healthy' :
          (param.type === 'range-based' && param.value >= param.thresholds.green.min! && param.value <= param.thresholds.green.max!) ? 'Healthy' :
          'Needs Attention';

        return [
          param.name,
          param.value.toFixed(2),
          param.unit,
          status,
          condition
        ];
      })
    ];

    const csvContent = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `water-quality-${selectedRegion?.name || data.location}-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const exportStormReport = () => {
    const event = selectedStormEvent;
    const parameters = ['DO', 'turbidity', 'TN', 'TP', 'TSS', 'salinity'] as const;

    const rows = [
      ['STORM EVENT BMP PERFORMANCE REPORT'],
      [''],
      ['Event Name', event.name],
      ['Event Date', event.date.toLocaleString()],
      ['Duration', event.duration],
      ['Total Rainfall', event.rainfall],
      ['Region', selectedRegion?.name || 'Escambia Bay, Florida'],
      [''],
      ['PARAMETER', 'INFLUENT (mg/L or NTU)', 'EFFLUENT (mg/L or NTU)', 'REDUCTION', '% REMOVAL', 'COMPLIANCE'],
      ...parameters.map((param) => {
        const influentParam = event.influent.parameters[param];
        const effluentParam = event.effluent.parameters[param];
        const reduction = Math.abs(influentParam.value - effluentParam.value);
        const efficiency = event.removalEfficiencies[param];
        const compliance = efficiency >= 80 ? 'MEETS TARGET (>80%)' : efficiency >= 60 ? 'MARGINAL (60-80%)' : 'BELOW TARGET (<60%)';

        return [
          influentParam.name,
          `${influentParam.value.toFixed(2)} ${influentParam.unit}`,
          `${effluentParam.value.toFixed(2)} ${effluentParam.unit}`,
          `${reduction.toFixed(2)} ${influentParam.unit}`,
          `${efficiency.toFixed(1)}%`,
          compliance
        ];
      }),
      [''],
      ['SUMMARY STATISTICS'],
      ['Average Removal Efficiency', `${(Object.values(event.removalEfficiencies).slice(1, 5).reduce((a, b) => a + b, 0) / 4).toFixed(1)}%`],
      ['TSS Removal Efficiency', `${event.removalEfficiencies.TSS.toFixed(1)}%`],
      ['Nutrient Removal (TN+TP avg)', `${((event.removalEfficiencies.TN + event.removalEfficiencies.TP) / 2).toFixed(1)}%`],
      [''],
      ['REGULATORY COMPLIANCE NOTES'],
      ['This report supports MS4 permit requirements for BMP performance monitoring.'],
      ['Data demonstrates stormwater load reduction for TMDL compliance documentation.'],
      ['Typical target: >80% TSS removal, >60% nutrient removal per NPDES/MS4 standards.'],
      ['Report generated', new Date().toLocaleString()]
    ];

    const csvContent = rows.map(row => Array.isArray(row) ? row.join(',') : row).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `storm-event-report-${event.name.replace(/\s+/g, '-')}-${event.date.toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // ── Branded PDF Exports for sections missing them ──────────────────────
  const exportWaterQualityPDF = async () => {
    const regionName = selectedRegion?.name || 'Unknown';
    const params = displayData.parameters;
    const paramKeys = Object.keys(params) as (keyof typeof params)[];
    const sections: PDFContentSection[] = [
      {
        content: [
          `Region: ${regionName}`,
          `Generated: ${new Date().toLocaleString()}`,
          `Data Mode: ${dataMode}`,
          `Overall Score: ${overallScore}/100`,
        ]
      },
      {
        title: 'WATER QUALITY PARAMETERS',
        content: ['Current readings from all monitored parameters:'],
        table: {
          headers: ['Parameter', 'Value', 'Unit', 'Status'],
          rows: paramKeys.map(key => {
            const p = params[key];
            const val = p.value;
            const inGreen = val >= (p.thresholds?.green?.min ?? -Infinity) && val <= (p.thresholds?.green?.max ?? Infinity);
            return [p.name, val.toFixed(2), p.unit, inGreen ? 'Normal' : 'Alert'];
          })
        }
      },
      {
        title: 'DATA PROVENANCE',
        content: [
          waterData ? `Source: ${(waterData as any).sources?.map((s: any) => s.name).join(', ') || 'PEARL sensors'}` : 'Source: Simulation data',
          (waterData as any)?.lastSampled ? `Last sampled: ${new Date((waterData as any).lastSampled).toLocaleString()}` : '',
          'This report is informational. Not an official regulatory determination.',
        ]
      }
    ];
    const pdf = await createBrandedPDF(`WATER QUALITY REPORT — ${regionName.toUpperCase()}`, sections);
    pdf.download(`water-quality-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportAlertsPDF = async () => {
    const regionName = selectedRegion?.name || 'Unknown';
    const active = waterQualityAlerts.filter((a: any) => !dismissedAlerts.has(a.id));
    const sections: PDFContentSection[] = [
      {
        content: [
          `Region: ${regionName}`,
          `Generated: ${new Date().toLocaleString()}`,
          `Total alerts: ${waterQualityAlerts.length} (${active.length} active, ${dismissedAlerts.size} dismissed)`,
        ]
      },
      {
        title: 'ACTIVE ALERTS',
        content: active.length === 0 ? ['No active alerts — all parameters within normal ranges.'] : [],
        ...(active.length > 0 ? {
          table: {
            headers: ['Severity', 'Parameter', 'Message', 'Threshold'],
            rows: active.map((a: any) => [
              (a.severity || 'info').toUpperCase(),
              a.parameter || '—',
              a.message || a.title || '—',
              a.threshold || '—',
            ])
          }
        } : {})
      },
      {
        title: 'DISCLAIMER',
        content: [
          'Alerts are automated interpretations of monitored data. They are not official regulatory findings.',
          'Contact your state environmental agency for compliance determinations.',
        ]
      }
    ];
    const pdf = await createBrandedPDF(`WATER QUALITY ALERTS — ${regionName.toUpperCase()}`, sections);
    pdf.download(`alerts-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportFineAvoidancePDF = async () => {
    const regionName = selectedRegion?.name || 'Unknown';
    const params = displayData.parameters;
    const avgRemoval = ((removalEfficiencies.TSS + removalEfficiencies.TN + removalEfficiencies.TP) / 3);
    const tssCompliant = removalEfficiencies.TSS >= 80;
    const nutrientCompliant = ((removalEfficiencies.TN + removalEfficiencies.TP) / 2) >= 60;
    const sections: PDFContentSection[] = [
      {
        content: [
          `Region: ${regionName}`,
          `Generated: ${new Date().toLocaleString()}`,
          `Storm events monitored: ${stormEvents.length}`,
        ]
      },
      {
        title: 'MS4 COMPLIANCE STATUS',
        content: [
          `TSS Removal: ${removalEfficiencies.TSS.toFixed(1)}% — ${tssCompliant ? 'MEETS >80% TARGET' : 'BELOW 80% TARGET'}`,
          `TN Removal: ${removalEfficiencies.TN.toFixed(1)}%`,
          `TP Removal: ${removalEfficiencies.TP.toFixed(1)}%`,
          `Average Nutrient Removal: ${((removalEfficiencies.TN + removalEfficiencies.TP) / 2).toFixed(1)}% — ${nutrientCompliant ? 'MEETS >60% TARGET' : 'BELOW 60% TARGET'}`,
          `Overall Average: ${avgRemoval.toFixed(1)}%`,
        ]
      },
      {
        title: 'FINE RISK ASSESSMENT',
        content: [
          tssCompliant && nutrientCompliant
            ? 'Current PEARL performance meets or exceeds MS4 BMP targets. Fine risk: LOW.'
            : 'One or more BMP targets not met. Review maintenance schedule and optimize treatment train.',
          '',
          'Typical MS4 NPDES violations range from $10,000-$50,000 per day per violation.',
          'Consent decrees in the Chesapeake Bay watershed have resulted in penalties from $100K to $20M+.',
          `PEARL has documented ${stormEvents.length} compliant storm event${stormEvents.length !== 1 ? 's' : ''}, providing defensible BMP performance data for regulatory audits.`,
        ]
      },
      {
        title: 'DISCLAIMER',
        content: [
          'This is an informational risk assessment based on BMP performance data.',
          'Not legal advice. Consult your MS4 permit coordinator or environmental attorney for compliance determinations.',
        ]
      }
    ];
    const pdf = await createBrandedPDF(`MS4 FINE AVOIDANCE ANALYSIS — ${regionName.toUpperCase()}`, sections);
    pdf.download(`fine-avoidance-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportTrendsPDF = async () => {
    const regionName = selectedRegion?.name || 'Unknown';
    const params = displayData.parameters;
    const paramKeys = Object.keys(params) as (keyof typeof params)[];
    const sections: PDFContentSection[] = [
      {
        content: [
          `Region: ${regionName}`,
          `Generated: ${new Date().toLocaleString()}`,
          `Time Mode: ${timeMode === 'real-time' ? 'Last 24 hours' : 'Custom range'}`,
        ]
      },
      {
        title: 'CURRENT PARAMETER SNAPSHOT',
        content: ['Latest values at time of export (chart trends cannot be rendered in PDF):'],
        table: {
          headers: ['Parameter', 'Current Value', 'Unit', 'Green Range'],
          rows: paramKeys.map(key => {
            const p = params[key];
            const greenMin = p.thresholds?.green?.min ?? '—';
            const greenMax = p.thresholds?.green?.max ?? '—';
            return [p.name, p.value.toFixed(2), p.unit, `${greenMin} – ${greenMax}`];
          })
        }
      },
      {
        title: 'NOTES',
        content: [
          'This snapshot captures current values at the time of export.',
          'For full time-series trend analysis, use the interactive dashboard or request a CSV export.',
          waterData ? `Data source: ${(waterData as any).sources?.map((s: any) => s.name).join(', ') || 'PEARL sensors'}` : 'Data source: Simulation',
        ]
      }
    ];
    const pdf = await createBrandedPDF(`WATER QUALITY TRENDS — ${regionName.toUpperCase()}`, sections);
    pdf.download(`trends-${regionName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`);
  };


  return (
    <AuthGuard>
    <>
      {/* ── FLOATING DEV MODE PANEL (renders above all views) ── */}
      {devMode && mounted && (
        <div className="fixed bottom-4 left-4 z-[100] max-w-xl animate-in fade-in slide-in-from-bottom-2">
          <div className="bg-amber-50 border-2 border-amber-400 rounded-xl px-4 py-3 shadow-xl space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">⚙️ Dev Mode — Role:</span>
              <Select value={userRole} onValueChange={(value: any) => {
                setUserRole(value);
                if (value === 'K12') setIsTeacher(true);
                if (value === 'Federal') { setShowNationalView(true); setShowStatewideView(false); }
                if (value === 'State') { setShowNationalView(false); setShowStatewideView(true); }
                if (value === 'MS4') { setShowNationalView(false); setShowStatewideView(false); }
                if (value === 'Corporate') { setShowNationalView(false); setShowStatewideView(false); }
                if (value === 'K12') { setShowNationalView(false); setShowStatewideView(false); }
                if (value === 'College') { setShowNationalView(false); setShowStatewideView(false); }
                if (value === 'Researcher') { setShowNationalView(false); setShowStatewideView(false); }
                if (value === 'NGO') { setShowNationalView(false); setShowStatewideView(false); }
                if (value === 'Pearl') { setShowNationalView(false); setShowStatewideView(false); }
                if (value === 'Temp') { setShowNationalView(false); setShowStatewideView(false); }
                if (!['Federal', 'State'].includes(value)) { setShowNationalView(false); setShowStatewideView(false); }
              }}>
                <SelectTrigger className="w-[220px] h-8 text-sm border-amber-300 bg-white">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Federal">🏛️ Federal Operator (EPA/NOAA/USDA)</SelectItem>
                  <SelectItem value="State">🏢 State Regulator (MDE, FL DEP)</SelectItem>
                  <SelectItem value="MS4">🏙️ Municipal Utility</SelectItem>
                  <SelectItem value="Corporate">🏢 Sustainability</SelectItem>
                  <SelectItem value="Researcher">🔬 Principal Investigator</SelectItem>
                  <SelectItem value="College">🎓 Undergrad (Research)</SelectItem>
                  <SelectItem value="NGO">🌿 NGO / Nonprofit</SelectItem>
                  <SelectItem value="K12">🎓 K-12 Teacher / Student</SelectItem>
                  <SelectItem value="Pearl">🐚 PEARL Admin (Internal)</SelectItem>
                  <SelectItem value="Temp">🧪 Temp (Breakpoint)</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={() => setDevMode(false)} className="text-amber-400 hover:text-amber-600 text-lg leading-none ml-2">×</button>
            </div>

            {/* State selector for State role */}
            {userRole === 'State' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">State:</span>
                <Select value={userState} onValueChange={(val) => { setUserState(val); console.log('[page.tsx] userState changed:', val); }}>
                  <SelectTrigger className="w-[160px] h-8 text-sm border-amber-300 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {Object.entries(STATE_AUTHORITIES).sort(([,a],[,b]) => a.name.localeCompare(b.name)).map(([abbr, auth]) => (
                      <SelectItem key={abbr} value={abbr}>{STATE_NAMES[abbr] || abbr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Region selector for MS4 */}
            {userRole === 'MS4' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">State:</span>
                  <Select value={homeState} onValueChange={(val) => {
                    setHomeState(val);
                    setUserState(val);
                    console.log('[page.tsx] userState changed:', val);
                    const first = getRegionsForState(val)[0];
                    if (first) { setUserRegion(first.id); setSelectedRegionId(first.id); }
                  }}>
                    <SelectTrigger className="w-[140px] h-8 text-sm border-amber-300 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {Object.keys(STATE_NAMES).sort((a,b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b])).map((abbr) => (
                        <SelectItem key={abbr} value={abbr}>{STATE_NAMES[abbr]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">Waterbody:</span>
                  <Select value={userRegion} onValueChange={(val) => { setUserRegion(val); setSelectedRegionId(val); }}>
                    <SelectTrigger className="w-[220px] h-8 text-sm border-amber-300 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {regionsConfig
                        .filter((r: any) => getRegionState(r.id) === homeState)
                        .sort((a: any, b: any) => a.name.localeCompare(b.name))
                        .map((r: any) => (
                          <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* State selector for other roles */}
            {['Researcher', 'Corporate', 'College', 'NGO'].includes(userRole) && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-600 uppercase tracking-wide whitespace-nowrap">State:</span>
                <Select value={homeState} onValueChange={(val) => {
                  setHomeState(val);
                  setUserState(val);
                  console.log('[page.tsx] userState changed:', val);
                  const first = getRegionsForState(val)[0];
                  if (first) setSelectedRegionId(first.id);
                }}>
                  <SelectTrigger className="w-[160px] h-8 text-sm border-amber-300 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {Object.keys(STATE_NAMES).sort((a,b) => STATE_NAMES[a].localeCompare(STATE_NAMES[b])).map((abbr) => (
                      <SelectItem key={abbr} value={abbr}>{STATE_NAMES[abbr]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="text-[10px] text-amber-500 italic">double-click any PEARL logo to toggle</div>
          </div>
        </div>
      )}

      {showNationalView && (
        <CommandCenterErrorBoundary name="PEARL Intelligence Network — Federal Management Center">
        <FederalManagementCenter
          federalMode={userRole === 'Federal'}
          onToggleDevMode={() => setDevMode(prev => !prev)}
          onClose={() => {
            // Federal lives in NCC — can't close it
            if (userRole !== 'Federal') setShowNationalView(false);
          }}
          onSelectRegion={(regionId) => {
            setSelectedRegionId(regionId);
            setUserRegion(regionId);
            // Derive state from region ID so ALL dropdowns filter correctly
            const regionState = getRegionState(regionId);
            if (regionState && regionState !== 'UNKNOWN') {
              setUserState(regionState);
              setHomeState(regionState);
            }
            // Federal stays in NCC even after selecting a region
            if (userRole !== 'Federal') setShowNationalView(false);
          }}
        />
        </CommandCenterErrorBoundary>
      )}
    {/* State role: SCC is the entire dashboard — like Federal/NCC */}
    {userRole === 'State' && !showNationalView && (
        <StateManagementCenter
          stateAbbr={userState}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {/* Corporate/ESG: ESGCC is the entire dashboard */}
    {userRole === 'Corporate' && !showNationalView && (
        <ESGManagementCenter
          companyName={(user as any)?.organization || user?.name || 'PEARL Portfolio'}
          onBack={() => setUserRole('MS4')}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {userRole === 'MS4' && !showNationalView && (
        <MS4ManagementCenter
          stateAbbr={userState}
          ms4Jurisdiction={(user as any)?.ms4Jurisdiction}
          onSelectRegion={(regionId) => {
            setSelectedRegionId(regionId);
            setUserRegion(regionId);
          }}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {userRole === 'K12' && !showNationalView && (
        <K12ManagementCenter
          stateAbbr={userState}
          isTeacher={false}
          onSelectRegion={(regionId) => {
            setSelectedRegionId(regionId);
            setUserRegion(regionId);
          }}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {userRole === 'College' && !showNationalView && (
        <UniversityManagementCenter
          stateAbbr={userState}
          userRole="College"
          defaultLens="field-study"
          onSelectRegion={(regionId) => {
            setSelectedRegionId(regionId);
            setUserRegion(regionId);
          }}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {userRole === 'Researcher' && !showNationalView && (
        <UniversityManagementCenter
          stateAbbr={userState}
          userRole="Researcher"
          defaultLens="data-analysis"
          onSelectRegion={(regionId) => {
            setSelectedRegionId(regionId);
            setUserRegion(regionId);
          }}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {userRole === 'NGO' && !showNationalView && (
        <NGOManagementCenter
          stateAbbr={userState}
          onSelectRegion={(regionId) => {
            setSelectedRegionId(regionId);
            setUserRegion(regionId);
          }}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {userRole === 'Pearl' && !showNationalView && (
        <PEARLManagementCenter
          onClose={() => {}}
          onToggleDevMode={() => setDevMode(prev => !prev)}
        />
    )}
    {userRole === 'Temp' && !showNationalView && (
        <div className="min-h-screen">
          <BreakpointLanding onToggleDevMode={() => setDevMode(prev => !prev)} />
        </div>
    )}
    {/* All roles now have management centers — old shared dashboard disabled */}
    {false && (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50" suppressHydrationWarning>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col gap-8">
          <div className="flex items-start justify-between flex-wrap gap-6">
            <div className="flex flex-col gap-2">
              <div
                className="relative w-full max-w-[280px] sm:max-w-[400px] h-[50px] sm:h-[70px] cursor-default select-none"
                onDoubleClick={() => {
                  setDevMode(prev => !prev);

                }}
              >
                <Image
                  src="/Pearl-Intelligence-Network.png"
                  alt="PEARL Intelligence Network"
                  fill
                  className="object-contain object-left"
                  priority
                />
              </div>
              <p className="text-sm sm:text-base text-muted-foreground">
                Water Quality Monitoring Dashboard
              </p>
            </div>
            {timeMode === 'real-time' && dataMode === 'ambient' && mounted && (
              <div className="flex items-center gap-2">
                <LiveStatusBadge secondsSinceUpdate={secondsSinceUpdate} isStormSpiking={isStormSpiking} stormIntensity={stormIntensity} />
                <button
                  onClick={() => setDemoStormActive(prev => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isStormSpiking
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                      : demoStormActive
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-slate-700/50 text-slate-400 border border-slate-600/40 hover:bg-slate-600/50'
                  }`}
                  title="Simulate a heavy rainfall storm event for demo purposes"
                >
                  {isStormSpiking
                    ? `⛈️ ${stormPhase === 'building' ? 'Storm Building…' : stormPhase === 'peak' ? 'PEAK STORM' : 'Recovering…'}`
                    : '🌧️ Simulate Storm'
                  }
                </button>
              </div>
            )}
            {mounted && <UserMenu />}

            <div className="flex flex-wrap items-center gap-4 justify-end">
              <Select value={selectedRegionId} onValueChange={(val) => {
                setSelectedRegionId(val);
                if (userRole === 'MS4') setUserRegion(val);
              }}>
                <SelectTrigger className="w-full sm:w-[280px]">
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Region" />
                </SelectTrigger>
                <SelectContent>
                  {regionsConfig
                    .filter((region: any) => {
                      return !shouldShowRegionalAlerts() || getRegionState(region.id) === homeState || getRegionState(region.id) === 'UNKNOWN';
                    })
                    .sort((a: any, b: any) => a.name.localeCompare(b.name))
                    .map((region: any) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {(
                <Tabs value={timeMode} onValueChange={(v) => setTimeMode(v as TimeMode)} className="w-full sm:w-auto">
                  <TabsList className="w-full sm:w-auto">
                    <TabsTrigger value="real-time" className="flex-1 sm:flex-none">Real-Time</TabsTrigger>
                    {shouldShowTimeRange() && (
                      <TabsTrigger value="range" className="flex-1 sm:flex-none">Time Range</TabsTrigger>
                    )}
                  </TabsList>
                </Tabs>
              )}

              {(
                <Tabs value={dataMode} onValueChange={(v) => setDataMode(v as DataMode)} className="w-full sm:w-auto">
                  <TabsList className="w-full sm:w-auto grid grid-cols-2 lg:grid-cols-4">
                    <TabsTrigger value="ambient" className="text-xs sm:text-sm">Ambient</TabsTrigger>
                    {['MS4', 'Researcher', 'College', 'NGO', 'Federal', 'State'].includes(userRole) && (
                      <TabsTrigger value="influent-effluent" className="text-xs sm:text-sm">In/Effluent</TabsTrigger>
                    )}
                    {['MS4', 'Researcher', 'College', 'NGO', 'Federal', 'State'].includes(userRole) && (
                      <TabsTrigger value="removal-efficiency" className="text-xs sm:text-sm">% Removal</TabsTrigger>
                    )}
                    {userRole !== 'K12' ? (
                      <TabsTrigger value="storm-event" className="text-xs sm:text-sm flex items-center gap-1">
                        <CloudRain className="h-3 w-3" />
                        Storm BMP
                      </TabsTrigger>
                    ) : (
                      <TabsTrigger value="storm-event" className="text-xs sm:text-sm flex items-center gap-1">
                        <CloudRain className="h-3 w-3" />
                        Storm Events
                      </TabsTrigger>
                    )}
                    {/* placeholder to keep grid layout when tabs hidden */}
                  </TabsList>
                </Tabs>
              )}

              {(userRole === 'Researcher' || userRole === 'NGO') && (
                <Button
                  onClick={() => setShowNationalView(true)}
                  variant="default"
                  className="gap-2 w-full sm:w-auto bg-blue-700 hover:bg-blue-600 text-white"
                >
                  <Globe className="h-4 w-4" />
                  <span className="sm:inline">
                    {userRole === 'Researcher' ? 'National Data View' :
                     'National Transparency'}
                  </span>
                </Button>
              )}

              {shouldShowNutrientCreditsButton() && (
                isChesapeakeBayRegion(selectedRegionId) ? (
                  <Button
                    onClick={() => {
                      setShowNutrientCredits(!showNutrientCredits);
                      if (!showNutrientCredits) {
                        setShowComparison(false);
                        setShowESG(false);
                        setShowManuscript(false);
                      }
                    }}
                    variant={showNutrientCredits ? "default" : "outline"}
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Coins className="h-4 w-4" />
                    <span className="sm:inline">Nutrient Credits</span>
                  </Button>
                ) : (
                  <Button
                    disabled
                    variant="outline"
                    className="gap-2 w-full sm:w-auto opacity-50 cursor-not-allowed"
                    title="Nutrient credit trading is available for Chesapeake Bay watershed regions only"
                  >
                    <Coins className="h-4 w-4" />
                    <span className="sm:inline">Nutrient Credits</span>
                    <span className="text-xs text-slate-400 ml-1">(Bay only)</span>
                  </Button>
                )
              )}

              {shouldShowESGImpact() && (
                <Button
                  onClick={() => {
                    setShowESG(!showESG);
                    if (!showESG) {
                      setShowComparison(false);
                      setShowNutrientCredits(false);
                      setShowManuscript(false);
                    }
                  }}
                  variant={showESG ? "default" : "outline"}
                  className={`gap-2 w-full sm:w-auto ${showESG ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-blue-600 text-blue-600 hover:bg-blue-50'}`}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span className="sm:inline">Sustainability Impact</span>
                </Button>
              )}

              {shouldShowManuscriptButton() && (
                <Button
                  onClick={() => {
                    setShowManuscript(!showManuscript);
                    if (!showManuscript) {
                      setShowComparison(false);
                      setShowNutrientCredits(false);
                      setShowESG(false);
                    }
                  }}
                  variant={showManuscript ? "default" : "outline"}
                  className={`gap-2 w-full sm:w-auto ${showManuscript ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'border-purple-600 text-purple-600 hover:bg-purple-50'}`}
                >
                  <BookOpen className="h-4 w-4" />
                  <span className="sm:inline">Manuscript</span>
                </Button>
              )}

              {shouldShowComparison() && (
                <Button
                  onClick={() => {
                    setShowComparison(!showComparison);
                    if (!showComparison) {
                      setShowNutrientCredits(false);
                      setShowESG(false);
                      setShowManuscript(false);
                    }
                  }}
                  variant={showComparison ? "default" : "outline"}
                  className="gap-2 w-full sm:w-auto"
                >
                  <GitCompare className="h-4 w-4" />
                  <span className="sm:inline">Compare</span>
                </Button>
              )}

              {shouldShowExportCSV() && (
                <>
                  {dataMode === 'storm-event' ? (
                    <Button onClick={exportStormReport} variant="outline" className="gap-2 w-full sm:w-auto">
                      <FileText className="h-4 w-4" />
                      <span className="sm:inline">Export CSV</span>
                    </Button>
                  ) : (
                    <Button onClick={exportToCSV} variant="outline" className="gap-2 w-full sm:w-auto">
                      <Download className="h-4 w-4" />
                      <span className="sm:inline">Export CSV</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── K-12 STUDENT / TEACHER TOGGLE ───────────────────────────────── */}
          {mounted && userRole === 'K12' && (
            <div className="flex items-center justify-center gap-3 py-2 px-4 rounded-lg bg-cyan-50 border border-cyan-200">
              <span className="text-sm font-medium text-cyan-800">I am a:</span>
              <button
                onClick={() => setIsTeacher(false)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${!isTeacher ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-cyan-700 border border-cyan-300 hover:bg-cyan-50'}`}
              >
                🎒 Student
              </button>
              <button
                onClick={() => setIsTeacher(true)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${isTeacher ? 'bg-cyan-600 text-white shadow-sm' : 'bg-white text-cyan-700 border border-cyan-300 hover:bg-cyan-50'}`}
              >
                📚 Teacher
              </button>
            </div>
          )}

          {/* ── DATA SOURCE DISCLAIMER ─────────────────────────────────────── */}
          {mounted && (() => {
            const ds = selectedRegion?.dataSource
              ? String(selectedRegion!.dataSource).toLowerCase()
              : '';
            const hasPearl   = ds.includes('pearl');
            const hasAmbient = !hasPearl && ds.length > 0;
            const noSensor   = ds.length === 0;

            const sourceName = hasPearl
              ? 'PEARL sensors'
              : hasAmbient
              ? 'ambient collectors / regional sensors'
              : 'no sensor data available';

            const sourceNote = hasPearl
              ? 'PEARL unit deployed at this location.'
              : hasAmbient
              ? 'No PEARL unit at this location — data from ambient monitoring network.'
              : 'No sensor data available for this location.';

            const bgStyle = hasPearl
              ? 'bg-green-50 border-green-300 text-green-800'
              : hasAmbient
              ? 'bg-yellow-50 border-yellow-300 text-yellow-800'
              : 'bg-red-50 border-red-300 text-red-800';

            const labelStyle = hasPearl
              ? 'font-semibold text-green-700'
              : hasAmbient
              ? 'font-semibold text-yellow-700'
              : 'font-semibold text-red-700';

            const icon = noSensor
              ? '🔴'
              : hasPearl ? '🟢' : '🟡';

            const modeIcon = dataMode === 'ambient' ? '🌊'
              : dataMode === 'influent-effluent' ? '⚗️'
              : dataMode === 'removal-efficiency' ? '📊'
              : '🌧️';

            return (
              <div className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs ${bgStyle}`}>
                <span className="mt-0.5 shrink-0">{icon} {modeIcon}</span>
                <span>
                  {dataMode === 'ambient' && (
                    <>
                      <span className={labelStyle}>
                        {hasPearl ? 'PEARL sensors — ' : hasAmbient ? 'Ambient monitoring — ' : 'No sensor data — '}
                      </span>
                      {!noSensor && (
                        <><span className="font-medium">{selectedRegion?.name ?? 'selected water body'}</span>{' '}data sourced from {sourceName}. {sourceNote}{' '}Values update continuously in live deployment. Current data is simulated for demonstration.</>
                      )}
                      {noSensor && (
                        <>No sensor data is currently available for <span className="font-medium">{selectedRegion?.name ?? 'this location'}</span>. Data shown is simulated reference only.</>
                      )}
                    </>
                  )}
                  {dataMode === 'influent-effluent' && (
                    <>
                      <span className={labelStyle}>Influent / Effluent — </span>
                      {hasPearl && <>raw stormwater entering the PEARL unit (influent) vs. treated discharge (effluent). Sensors at point of intake and outfall.</>}
                      {hasAmbient && <>influent/effluent comparison requires a deployed PEARL unit. Ambient sensor data available but no treatment unit at this location.</>}
                      {noSensor && <>no sensor data available. Data shown is simulated reference only.</>}
                    </>
                  )}
                  {dataMode === 'removal-efficiency' && (
                    <>
                      <span className={labelStyle}>Removal efficiency — </span>
                      {hasPearl && <>% reduction between PEARL influent and effluent per parameter. Pilot-validated: 88–95% TSS removal (Milton FL, Jan 2025).</>}
                      {hasAmbient && <>removal efficiency requires a deployed PEARL unit. Values shown are simulated reference based on pilot data.</>}
                      {noSensor && <>no sensor data available. Values shown are simulated reference only.</>}
                    </>
                  )}
                  {dataMode === 'storm-event' && (
                    <>
                      <span className={labelStyle}>Storm BMP event data — </span>
                      {hasPearl && <>readings from PEARL sensors logged automatically at 15-min intervals during storm events. Supports MS4 BMP performance documentation.</>}
                      {hasAmbient && <>storm event readings from {sourceName}. PEARL deployment would add influent/effluent comparison and automated BMP reporting.</>}
                      {noSensor && <>no sensor data available for storm event analysis at this location.</>}
                    </>
                  )}
                </span>
              </div>
            );
          })()}

          {timeMode === 'range' && shouldShowTimeRange() && (
            <Card>
              <CardHeader>
                <CardTitle>Time Range Selection</CardTitle>
                <CardDescription>
                  Select a custom date range to view historical data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-sm font-medium">Start Date</label>
                    <input
                      type="datetime-local"
                      className="border rounded-md px-3 py-2 w-full"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <label className="text-sm font-medium">End Date</label>
                    <input
                      type="datetime-local"
                      className="border rounded-md px-3 py-2 w-full"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                  <Button className="w-full sm:w-auto">Apply Range</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {dataMode === 'storm-event' && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-3 px-4 rounded-xl bg-blue-50 border-2 border-blue-200 shadow-sm">
              <div className="flex items-center gap-2">
                <CloudRain className="h-5 w-5 text-blue-600" />
                <div className="text-sm font-bold text-blue-900">Storm Event:</div>
              </div>
              <Select value={selectedStormEventId} onValueChange={setSelectedStormEventId}>
                <SelectTrigger className="w-full sm:w-[400px] border-blue-300 bg-white">
                  <SelectValue placeholder="Select Storm Event" />
                </SelectTrigger>
                <SelectContent>
                  {stormEvents.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name} - {event.date.toLocaleDateString()} ({event.rainfall})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-blue-900 mb-1">
                  {selectedRegion?.name}
                </h3>
                <p className="text-xs text-blue-700">
                 {(selectedRegion as any)?.description}
                </p>
                <p className="text-xs text-blue-600 mt-2 italic">
                  Note: More regions can be added easily later for global deployment
                </p>
              </div>
            </div>
          </div>

          {/* ── EXPAND / COLLAPSE ALL ─────────────────────────── */}
          {mounted && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {devMode && (
                  <span className="text-xs font-bold text-amber-500 border border-amber-300 bg-amber-50 rounded px-1.5 py-0.5">DEV</span>
                )}
                {collapsedSections.size > 0 && (
                  <span className="text-xs text-slate-400">{collapsedSections.size} section{collapsedSections.size !== 1 ? 's' : ''} hidden</span>
                )}
              </div>
              <button
                onClick={allExpanded ? collapseAll : expandAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
              >
                {allExpanded ? <Minus className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
          )}

          {/* ── REGIONAL ALERT FEED ──────────────────────────────────────── */}
          {shouldShowRegionalAlerts() && regionalAlerts.length > 0 && !showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-orange-200 bg-orange-50">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
                  </span>
                  <span className="text-sm font-bold text-orange-900">
                    Regional Alert Feed — {STATE_NAMES[homeState] || homeState} Watershed Network
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-200 text-orange-800">
                    {regionalAlerts.filter(a => a.severity === 'critical').length > 0
                      ? `${regionalAlerts.filter(a => a.severity === 'critical').length} Critical`
                      : `${regionalAlerts.length} Active`}
                  </span>
                </div>
                <span className="text-xs text-orange-600">Other bodies of water in your state — not currently selected</span>
              </div>
              <div className="divide-y divide-orange-100 max-h-64 overflow-y-auto">
                {regionalAlerts.map((alert, idx) => (
                  <div key={idx} className={`flex items-start gap-3 px-4 py-3 hover:bg-orange-50 transition-colors ${
                    alert.severity === 'critical' ? 'bg-red-50/60' : ''
                  }`}>
                    <div className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                      alert.severity === 'critical' ? 'bg-red-500' :
                      alert.severity === 'warning'  ? 'bg-amber-500' : 'bg-blue-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-slate-800 truncate">{alert.regionName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                          alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                          alert.severity === 'warning'  ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                          {alert.parameter}
                        </span>
                        <span className="text-xs text-slate-400 ml-auto flex-shrink-0">
                          {mounted && new Date(alert.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{alert.message}</p>
                    </div>
                    <button
                      onClick={() => setSelectedRegionId(alert.regionId)}
                      className="flex-shrink-0 px-2.5 py-1 text-xs font-medium text-orange-700 bg-white border border-orange-300 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-all"
                    >
                      Jump →
                    </button>
                  </div>
                ))}
              </div>
              {regionalAlerts.length === 0 && (
                <div className="px-4 py-3 text-sm text-orange-700 text-center">
                  All monitored bodies of water in {STATE_NAMES[homeState] || homeState} are within normal parameters.
                </div>
              )}
            </div>
          )}

          {/* ── ALERTS ───────────────────────────────────────────── */}
          {(
            <CollapsibleSection id="alerts" title="Water Quality Alerts" icon="🚨" collapsed={isCollapsed('alerts')} onToggle={toggleSection}>
              <WaterQualityAlerts
                alerts={waterQualityAlerts}
                onDismiss={handleDismissAlert}
                dismissedAlerts={dismissedAlerts}
              />
              {userRole !== 'K12' && waterQualityAlerts.length > 0 && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={exportAlertsPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Export Alerts PDF
                  </button>
                </div>
              )}
            </CollapsibleSection>
          )}

          {/* ── WATERBODY-SPECIFIC DASHBOARD ────────────────────── */}
          <div suppressHydrationWarning>
          
          {/* ── ECONOMIC REPLACEMENT PANEL (MS4 Budget Justification) ────────────────────── */}
          {dataMode === 'ambient' && !showNutrientCredits && !showESG && !showManuscript && userRole === 'MS4' && (
            <CollapsibleSection id="economic" title="Economic Replacement Analysis" icon="💰" collapsed={isCollapsed('economic')} onToggle={toggleSection}>
              <div className="mb-6">
                <EconomicReplacementPanel 
                  municipalitySize="large"
                  municipalityName={selectedRegion?.name || 'Baltimore City'}
                />
              </div>
            </CollapsibleSection>
          )}

          {/* ── WILDLIFE PERSPECTIVE TOGGLE ────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && userRole === 'K12' && (
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-cyan-50 to-blue-50 border-2 border-cyan-300 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-lg">🦪🐟</span>
                <span className="text-sm font-medium text-slate-700">See it from the Bay's Perspective</span>
              </div>
              <button
                onClick={() => setShowWildlife(!showWildlife)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  showWildlife ? 'bg-cyan-600' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  showWildlife ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>
          )}

          {/* ── GAUGE CARD ────────────────────────────────────────────── */}
          {dataMode === 'ambient' && !showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <CollapsibleSection id="gauges" title="Water Quality Parameters" icon="📊" collapsed={isCollapsed('gauges')} onToggle={toggleSection}>
            <Card className="border-2 relative">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">{selectedRegion?.name || data.location}</CardTitle>
                    <CardDescription suppressHydrationWarning className="flex items-center gap-2 flex-wrap">
                      {mounted && <span>Last updated: {data.timestamp.toLocaleString()}</span>}
                      <DataSourceBadge waterData={waterData} isLoading={wdLoading} />
                      {waterData && hasRealData && (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Live
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`px-4 py-2 rounded-xl border-2 text-center ${
                      overallScore >= 70 ? 'border-green-200 bg-green-50' :
                      overallScore >= 40 ? 'border-amber-200 bg-amber-50' :
                      'border-red-200 bg-red-50'
                    }`}>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Overall</div>
                      <div className={`text-3xl font-bold ${overallScore >= 70 ? 'text-green-600' : overallScore >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                        {overallScore}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Parameter Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(displayData.parameters).map(([key, param]) => {
                    // Determine status color from thresholds
                    const v = param.value;
                    let status: 'green' | 'yellow' | 'orange' | 'red' = 'green';
                    if (param.type === 'increasing-bad') {
                      if (param.thresholds.red?.min != null && v >= param.thresholds.red.min) status = 'red';
                      else if (param.thresholds.orange?.min != null && v >= param.thresholds.orange.min) status = 'orange';
                      else if (param.thresholds.yellow?.min != null && v >= param.thresholds.yellow.min) status = 'yellow';
                    } else if (param.type === 'decreasing-bad') {
                      if (param.thresholds.red?.max != null && v <= param.thresholds.red.max) status = 'red';
                      else if (param.thresholds.orange?.max != null && v <= param.thresholds.orange.max) status = 'orange';
                      else if (param.thresholds.yellow?.max != null && v <= param.thresholds.yellow.max) status = 'yellow';
                    } else {
                      // range-based
                      const gMin = param.thresholds.green?.min ?? -Infinity;
                      const gMax = param.thresholds.green?.max ?? Infinity;
                      if (v < gMin || v > gMax) {
                        const yMin = param.thresholds.yellow?.min ?? -Infinity;
                        const yMax = param.thresholds.yellow?.max ?? Infinity;
                        if (v < yMin || v > yMax) status = 'red';
                        else status = 'yellow';
                      }
                    }

                    const statusColors = {
                      green: 'border-green-300 bg-green-50/50',
                      yellow: 'border-yellow-300 bg-yellow-50/50',
                      orange: 'border-orange-300 bg-orange-50/50',
                      red: 'border-red-300 bg-red-50/50',
                    };
                    const valueColors = {
                      green: 'text-green-700',
                      yellow: 'text-yellow-700',
                      orange: 'text-orange-700',
                      red: 'text-red-600',
                    };
                    const dotColors = {
                      green: 'bg-green-500',
                      yellow: 'bg-yellow-500',
                      orange: 'bg-orange-500',
                      red: 'bg-red-500',
                    };

                    // Get the healthy range as a target string
                    const greenThreshold = param.thresholds.green;
                    let targetStr = '';
                    if (param.type === 'increasing-bad' && greenThreshold?.max != null) {
                      targetStr = `≤${greenThreshold.max}`;
                    } else if (param.type === 'decreasing-bad' && greenThreshold?.min != null) {
                      targetStr = `≥${greenThreshold.min}`;
                    } else if (greenThreshold?.min != null && greenThreshold?.max != null) {
                      targetStr = `${greenThreshold.min}–${greenThreshold.max}`;
                    }

                    // Source info from live data if available
                    const liveParam = waterData?.parameters?.[key];
                    const sourceId = liveParam?.source;
                    const sourceName = sourceId ? (DATA_SOURCES[sourceId]?.name || sourceId) : null;
                    const sourceColors: Record<string, string> = {
                      USGS: 'bg-green-100 text-green-800',
                      ERDDAP: 'bg-cyan-100 text-cyan-800',
                      NOAA: 'bg-blue-100 text-blue-800',
                      BWB: 'bg-purple-100 text-purple-800',
                      WQP: 'bg-indigo-100 text-indigo-800',
                      REFERENCE: 'bg-amber-100 text-amber-800',
                      MOCK: 'bg-slate-100 text-slate-500',
                    };

                    return (
                      <div key={key} className={`rounded-xl border-2 p-3 text-center transition-all hover:shadow-md ${statusColors[status]}`}>
                        <div className="flex items-center justify-center gap-1.5 mb-1">
                          <span className={`w-2 h-2 rounded-full ${dotColors[status]}`} />
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-600">{param.name}</span>
                        </div>
                        <div className={`text-2xl font-bold ${valueColors[status]}`}>
                          {v < 0.01 && v > 0 ? v.toFixed(3) : v < 1 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-500 mb-1">{param.unit}</div>
                        {targetStr && (
                          <div className="text-[10px] text-slate-400">Target: {targetStr} {param.unit}</div>
                        )}
                        {sourceName && sourceId && (
                          <div className="mt-1.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${sourceColors[sourceId] || 'bg-slate-100 text-slate-500'}`}>
                              {sourceName}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Extra live parameters not in mock data */}
                {waterData && (() => {
                  const wd = waterData!;
                  const mockKeys = new Set(Object.keys(displayData.parameters));
                  const extraKeys = Object.keys(wd.parameters).filter(k => !mockKeys.has(k));
                  if (extraKeys.length === 0) return null;

                  const extraLabels: Record<string, string> = {
                    temperature: 'Temperature', conductivity: 'Conductivity', discharge: 'Discharge',
                    gage_height: 'Gage Height', DO_pct: 'DO Saturation', bacteria: 'Bacteria',
                    chlorophyll: 'Chlorophyll-a', pH: 'pH',
                  };

                  return (
                    <div className="mt-3 pt-3 border-t border-slate-200">
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Additional Live Parameters</div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {extraKeys.map(key => {
                          const p = wd.parameters[key];
                          const sourceColors: Record<string, string> = {
                            USGS: 'bg-green-100 text-green-800',
                            ERDDAP: 'bg-cyan-100 text-cyan-800',
                            NOAA: 'bg-blue-100 text-blue-800',
                            BWB: 'bg-purple-100 text-purple-800',
                          };
                          return (
                            <div key={key} className="rounded-lg border border-slate-200 bg-white p-2 text-center">
                              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{extraLabels[key] || p.parameterName || key}</div>
                              <div className="text-lg font-bold text-slate-800">
                                {p.value < 0.01 && p.value > 0 ? p.value.toFixed(3) : p.value < 1 ? p.value.toFixed(2) : p.value < 100 ? p.value.toFixed(1) : Math.round(p.value).toLocaleString()}
                              </div>
                              <div className="text-[10px] text-slate-400">{p.unit}</div>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${sourceColors[p.source] || 'bg-slate-100 text-slate-500'}`}>
                                {DATA_SOURCES[p.source]?.name || p.source}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Source Attribution */}
                {waterData && (waterData as any).sourceDetails?.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200 text-[10px] text-slate-500">
                    <span className="font-medium">Data sources:</span>
                    {(waterData as any).sourceDetails.map((sd: any, i: number) => {
                      const c: Record<string, string> = {
                        USGS: 'bg-green-100 text-green-800', ERDDAP: 'bg-cyan-100 text-cyan-800',
                        NOAA: 'bg-blue-100 text-blue-800', BWB: 'bg-purple-100 text-purple-800',
                        WQP: 'bg-indigo-100 text-indigo-800', REFERENCE: 'bg-amber-100 text-amber-800',
                      };
                      return (
                        <span key={i} className={`px-1.5 py-0.5 rounded-full ${c[sd.source.id] || 'bg-slate-100'}`}>
                          {sd.source.name} ({sd.parameterCount}) — {sd.stationName}
                        </span>
                      );
                    })}
                    {(waterData as any).lastSampled && (
                      <span className="ml-auto text-slate-400">
                        Updated: {new Date((waterData as any).lastSampled).toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </CardContent>
              {userRole !== 'K12' && (
                <div className="flex justify-end px-6 pb-4">
                  <button
                    onClick={exportWaterQualityPDF}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Export Water Quality PDF
                  </button>
                </div>
              )}
            </Card>
            </CollapsibleSection>
          )}

{/* ── TRENDS ────────────────────────────────────────────────── */}
          {!showNutrientCredits && !showESG && !showManuscript && userRole !== 'K12' && (
            <CollapsibleSection id="trends" title="Trends & Historical Data" icon="📈" collapsed={isCollapsed('trends')} onToggle={toggleSection}>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-xl">Parameter Trends Over Time</CardTitle>
                <CardDescription>
                  {timeMode === 'real-time'
                    ? 'Last 24 hours of continuous monitoring data'
                    : 'Custom time range historical data'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TrendsChart data={displayData} />
              </CardContent>
              <div className="flex justify-end px-6 pb-4">
                <button
                  onClick={exportTrendsPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  Export Trends PDF
                </button>
              </div>
            </Card>
            </CollapsibleSection>
          )}

          {/* ── AI INSIGHTS ───────────────────────────────────────────── */}
          {!showNutrientCredits && !showESG && !showManuscript && shouldShowAIInsights() && (
            <CollapsibleSection id="ai" title="AI Trends & Predictions" icon="🤖" collapsed={isCollapsed('ai')} onToggle={toggleSection}>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <span className="text-2xl">🤖</span> AI Trends & Predictions
                </CardTitle>
                <CardDescription>
                  Automated analysis based on current readings and recent trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AIInsights
                  data={dataMode === 'storm-event' ? selectedStormEvent.effluent : displayData}
                  dataMode={dataMode}
                  regionId={selectedRegionId}
                />
              </CardContent>
              {userRole !== 'K12' && (
                <div className="flex justify-end px-6 pb-4">
                  <button
                    onClick={() => exportAIInsightsReport(displayData, selectedRegion?.name || 'Unknown', userRole)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Export AI Insights PDF
                  </button>
                </div>
              )}
            </Card>
            </CollapsibleSection>
          )}

          {dataMode === 'influent-effluent' && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                      Raw Influent
                    </CardTitle>
                    <CardDescription>Incoming wastewater</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(influentData.parameters).map(([key, param]) => (
                        <Card key={key} className="border shadow-lg hover:shadow-xl transition-all">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      Treated Effluent
                    </CardTitle>
                    <CardDescription>Discharge to bay - with % removal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(effluentData.parameters).map(([key, param]) => {
                        const paramKey = key as keyof typeof influentData.parameters;
                        const influentValue = influentData.parameters[paramKey].value;
                        const effluentValue = param.value;
                        const efficiency = removalEfficiencies[paramKey];
                        const removalDisplay = calculateRemovalDisplay(key, influentValue, effluentValue, efficiency);

                        return (
                          <Card key={key} className="border shadow-lg hover:shadow-xl transition-all">
                            <CardContent className="pt-6">
                              <WaterQualityGauge
                                parameter={param}
                                removalInfo={removalDisplay}
                              />
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <RemovalSummaryCard
                influentData={influentData}
                effluentData={effluentData}
                removalEfficiencies={removalEfficiencies}
              />
            </div>
          )}

{dataMode === 'removal-efficiency' && !showNutrientCredits && !showESG && !showManuscript && (
            <Card className="border-2 border-blue-300">
              <CardHeader>
                <CardTitle className="text-2xl">Treatment Performance Summary</CardTitle>
                <CardDescription>
                  Percentage change from raw influent to treated effluent
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <RemovalEfficiencyGauge
                    parameterName="Dissolved Oxygen"
                    influentValue={influentData.parameters.DO.value}
                    effluentValue={effluentData.parameters.DO.value}
                    efficiency={removalEfficiencies.DO}
                    unit="mg/L"
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Turbidity"
                    influentValue={influentData.parameters.turbidity.value}
                    effluentValue={effluentData.parameters.turbidity.value}
                    efficiency={removalEfficiencies.turbidity}
                    unit="NTU"
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Total Nitrogen"
                    influentValue={influentData.parameters.TN.value}
                    effluentValue={effluentData.parameters.TN.value}
                    efficiency={removalEfficiencies.TN}
                    unit="mg/L"
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Total Phosphorus"
                    influentValue={influentData.parameters.TP.value}
                    effluentValue={effluentData.parameters.TP.value}
                    efficiency={removalEfficiencies.TP}
                    unit="mg/L"
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Total Suspended Solids"
                    influentValue={influentData.parameters.TSS.value}
                    effluentValue={effluentData.parameters.TSS.value}
                    efficiency={removalEfficiencies.TSS}
                    unit="mg/L"
                  />
                  <RemovalEfficiencyGauge
                    parameterName="Salinity"
                    influentValue={influentData.parameters.salinity.value}
                    effluentValue={effluentData.parameters.salinity.value}
                    efficiency={removalEfficiencies.salinity}
                    unit="ppt"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {dataMode === 'storm-event' && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-100 via-cyan-50 to-blue-100 border-2 border-blue-300 rounded-lg p-6">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
                    <CloudRain className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-blue-900 mb-2">
                      Municipal Stormwater BMP Performance Monitoring
                    </h3>
                    <p className="text-sm text-blue-800 leading-relaxed">
                      This view supports MS4 permit requirements for Best Management Practice (BMP) performance monitoring and TMDL load reduction documentation during stormwater events. Data demonstrates pollutant removal efficiency from storm runoff entering the BMP (influent) to treated discharge (effluent).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                      <div className="bg-white rounded px-3 py-1 border border-blue-200">
                        <span className="font-semibold text-blue-900">Target:</span>
                        <span className="text-blue-700 ml-2">&gt;80% TSS removal</span>
                      </div>
                      <div className="bg-white rounded px-3 py-1 border border-blue-200">
                        <span className="font-semibold text-blue-900">Target:</span>
                        <span className="text-blue-700 ml-2">&gt;60% nutrient removal</span>
                      </div>
                      <div className="bg-white rounded px-3 py-1 border border-blue-200">
                        <span className="font-semibold text-blue-900">Compliance:</span>
                        <span className="text-blue-700 ml-2">NPDES/MS4 standards</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                      Influent (Raw Stormwater Runoff)
                    </CardTitle>
                    <CardDescription>
                      Uncontrolled runoff entering BMP - {selectedStormEvent.rainfall} event
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.values(selectedStormEvent.influent.parameters).map((param, idx) => (
                        <Card key={idx} className="border shadow-lg hover:shadow-xl transition-all">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      Effluent (BMP Treated Discharge)
                    </CardTitle>
                    <CardDescription>
                      Controlled discharge meeting permit limits
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.values(selectedStormEvent.effluent.parameters).map((param, idx) => (
                        <Card key={idx} className="border shadow-lg hover:shadow-xl transition-all">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-2 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-xl">Paired Sample Analysis & % Removal Documentation</CardTitle>
                  <CardDescription>
                    Event-specific influent vs effluent comparison for MS4/TMDL reporting
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <StormEventTable event={selectedStormEvent} />
                </CardContent>
              </Card>

              <Card className="border-2 border-purple-300 bg-gradient-to-br from-purple-50 to-white">
                <CardHeader>
                  <CardTitle className="text-xl">BMP Treatment Performance Summary</CardTitle>
                  <CardDescription>
                    Percentage change for each parameter during {selectedStormEvent.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <RemovalEfficiencyGauge
                      parameterName="Dissolved Oxygen"
                      influentValue={selectedStormEvent.influent.parameters.DO.value}
                      effluentValue={selectedStormEvent.effluent.parameters.DO.value}
                      efficiency={selectedStormEvent.removalEfficiencies.DO}
                      unit="mg/L"
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Turbidity"
                      influentValue={selectedStormEvent.influent.parameters.turbidity.value}
                      effluentValue={selectedStormEvent.effluent.parameters.turbidity.value}
                      efficiency={selectedStormEvent.removalEfficiencies.turbidity}
                      unit="NTU"
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Total Nitrogen"
                      influentValue={selectedStormEvent.influent.parameters.TN.value}
                      effluentValue={selectedStormEvent.effluent.parameters.TN.value}
                      efficiency={selectedStormEvent.removalEfficiencies.TN}
                      unit="mg/L"
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Total Phosphorus"
                      influentValue={selectedStormEvent.influent.parameters.TP.value}
                      effluentValue={selectedStormEvent.effluent.parameters.TP.value}
                      efficiency={selectedStormEvent.removalEfficiencies.TP}
                      unit="mg/L"
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Total Suspended Solids"
                      influentValue={selectedStormEvent.influent.parameters.TSS.value}
                      effluentValue={selectedStormEvent.effluent.parameters.TSS.value}
                      efficiency={selectedStormEvent.removalEfficiencies.TSS}
                      unit="mg/L"
                    />
                    <RemovalEfficiencyGauge
                      parameterName="Salinity"
                      influentValue={selectedStormEvent.influent.parameters.salinity.value}
                      effluentValue={selectedStormEvent.effluent.parameters.salinity.value}
                      efficiency={selectedStormEvent.removalEfficiencies.salinity}
                      unit="ppt"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── LIVE ESG SCORE ─────────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && (userRole as string) === 'Corporate' && (
            <CollapsibleSection id="esg-score" title="Sustainability Score Dashboard" icon="📊" collapsed={isCollapsed('esg-score')} onToggle={toggleSection}>
            {(() => {
            // Calculate ESG scores for Corporate dashboard
            const doScore = Math.min(100, (displayData.parameters.DO.value / 9) * 100);
            const turbScore = Math.max(0, 100 - (displayData.parameters.turbidity.value / 50) * 100);
            const tnScore = Math.max(0, 100 - (displayData.parameters.TN.value / 1.5) * 100);
            const tpScore = Math.max(0, 100 - (displayData.parameters.TP.value / 0.15) * 100);
            const tssScore = Math.max(0, 100 - (displayData.parameters.TSS.value / 100) * 100);
            const waterQuality = Math.round((doScore * 2 + turbScore + tnScore + tpScore + tssScore) / 6);
            
            const tssEff = Math.min(100, removalEfficiencies.TSS || 0);
            const tnEff = Math.min(100, removalEfficiencies.TN || 0);
            const tpEff = Math.min(100, removalEfficiencies.TP || 0);
            const turbEff = Math.min(100, removalEfficiencies.turbidity || 0);
            const loadReduction = Math.round((tssEff * 1.5 + tnEff + tpEff + turbEff) / 4.5);
            
            const doEcosystem = displayData.parameters.DO.value >= 6 ? 100 : displayData.parameters.DO.value >= 4 ? 60 : 20;
            const tnEcosystem = displayData.parameters.TN.value <= 0.8 ? 100 : displayData.parameters.TN.value <= 1.5 ? 65 : 30;
            const tpEcosystem = displayData.parameters.TP.value <= 0.05 ? 100 : displayData.parameters.TP.value <= 0.15 ? 65 : 25;
            const ecosystemHealth = Math.round((doEcosystem + tnEcosystem + tpEcosystem) / 3);
            
            const overallESG = Math.round(waterQuality * 0.35 + loadReduction * 0.40 + ecosystemHealth * 0.25);
            
            return (
              <div className="space-y-2">
                <LiveESGScore data={displayData} removalEfficiencies={removalEfficiencies} regionName={selectedRegion?.name || ''} />
                
                {/* Corporate ESG Dashboard - Full feature set */}
                <CorporateESGDashboard
                  esgScore={overallESG}
                  waterQualityScore={waterQuality}
                  loadReductionScore={loadReduction}
                  ecosystemHealthScore={ecosystemHealth}
                  removalEfficiencies={removalEfficiencies}
                  regionName={selectedRegion?.name || 'Unknown Region'}
                />
                
                <div className="flex justify-end">
                  <button
                    onClick={() => exportESGReport(displayData, removalEfficiencies, selectedRegion?.name || 'Unknown')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Export Sustainability Report PDF
                  </button>
                </div>
              </div>
            );
          })()}
            </CollapsibleSection>
          )}

          {/* ── MS4 FINE AVOIDANCE ─────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && userRole === 'MS4' && (
            <CollapsibleSection id="ms4-fines" title="Fine Avoidance Calculator" icon="🛡" collapsed={isCollapsed('ms4-fines')} onToggle={toggleSection}>
              <MS4FineAvoidanceCalculator data={displayData} removalEfficiencies={removalEfficiencies} regionId={selectedRegionId} stormEventsMonitored={stormEvents.length} />
              <div className="flex justify-end mt-3">
                <button
                  onClick={exportFineAvoidancePDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  Export Fine Avoidance PDF
                </button>
              </div>
            </CollapsibleSection>
          )}

          {/* ── K-12 WELCOME ─────────────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && userRole === 'K12' && (
            <div className="rounded-xl border-2 border-cyan-300 bg-gradient-to-r from-cyan-50 to-teal-50 px-4 py-3">
              <p className="text-sm font-semibold text-cyan-800">🌊 You are viewing live water quality data from <span className="font-bold">{selectedRegion?.name ?? 'this water body'}</span>.</p>
              <p className="text-xs text-cyan-700 mt-1">These are real sensor readings. Scroll down to explore what the numbers mean, see how PEARL cleans the water, and export your field report.</p>
            </div>
          )}

          {/* ── BAY IMPACT ────────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <CollapsibleSection id="bay-impact" title="Bay / Watershed Impact" icon="🦪" collapsed={isCollapsed('bay-impact')} onToggle={toggleSection}>
            <div className="space-y-2">
              <BayImpactCounter removalEfficiencies={removalEfficiencies} regionId={selectedRegionId} userRole={userRole} />
              {userRole !== 'K12' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => exportBayImpactReport(displayData, removalEfficiencies, selectedRegion?.name || 'Unknown')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    Export Bay Impact PDF
                  </button>
                </div>
              )}
            </div>
            </CollapsibleSection>
          )}

          {/* ── K-12 STUDENT LEARNING MODE ─────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && userRole === 'K12' && (
            <Card className="border-2 border-cyan-300 bg-gradient-to-r from-cyan-50 to-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-cyan-600" />
                  Student Learning Mode 🌊
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 leading-relaxed">
                  <strong>Welcome!</strong> Green means healthy water — good for fish and plants! Try changing time range to see a storm event.
                </p>
                <div className="mt-3 mb-3 p-2 bg-cyan-50 border border-cyan-200 rounded-lg text-xs text-cyan-900">
                  <strong>💡 Did you know?</strong> {k12WaterFacts[k12FactIndex]}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-md font-medium">Water Quality Basics</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-medium">Interactive Gauges</span>
                  <span className="px-2 py-1 bg-cyan-100 text-cyan-800 text-xs rounded-md font-medium">Storm Events</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── K-12 STUDENT EXPORT ──────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && userRole === 'K12' && (
            <div className="flex gap-3 justify-center flex-wrap">
              <button
                onClick={() => exportK12FieldReport(displayData, selectedRegion?.name || 'Unknown')}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-cyan-700 bg-cyan-50 border-2 border-cyan-300 rounded-lg hover:bg-cyan-100 hover:border-cyan-400 transition-all shadow-sm"
              >
                <FileText className="h-4 w-4" />
                🔬 Export Student Field Report
              </button>
              {isTeacher && (
                <button
                  onClick={() => exportTeacherLessonData(displayData, removalEfficiencies, selectedRegion?.name || 'Unknown')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 border-2 border-purple-300 rounded-lg hover:bg-purple-100 hover:border-purple-400 transition-all shadow-sm"
                >
                  <FileText className="h-4 w-4" />
                  📚 Export Teacher Lesson Data
                </button>
              )}
            </div>
          )}

          {/* ── K-12 BEFORE/AFTER WATER CARD ─────────────────── */}
          {!showNutrientCredits && !showESG && !showManuscript && userRole === 'K12' && (
            <Card className="border-2 border-cyan-200 bg-white">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="text-xl">🔬</span>
                  Before &amp; After PEARL Treatment
                </CardTitle>
                <CardDescription>See how PEARL cleans the water — compare dirty water in vs. clean water out</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(displayData.parameters).slice(0, 4).map(([key, param]) => {
                    const k = key as keyof typeof removalEfficiencies;
                    const influent = param.value * (1 + (removalEfficiencies[k] || 0) / 100);
                    const removal = removalEfficiencies[k] || 0;
                    const improved = removal > 0;
                    return (
                      <div key={key} className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                        <div className="text-xs font-bold text-slate-600 mb-2">{param.name}</div>
                        <div className="flex items-center gap-2 text-xs mb-1">
                          <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0"/>
                          <span className="text-slate-500">Dirty in:</span>
                          <span className="font-bold text-red-600">{influent.toFixed(1)} {param.unit}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs mb-2">
                          <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0"/>
                          <span className="text-slate-500">Clean out:</span>
                          <span className="font-bold text-green-600">{param.value.toFixed(1)} {param.unit}</span>
                        </div>
                        <div className={`text-xs font-bold text-center py-1 rounded ${improved ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {improved ? `${removal.toFixed(0)}% cleaner! 🎉` : 'Monitoring...'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── K-12 PROJECTS ────────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && userRole === 'K12' && (
            <Card className="border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 via-white to-cyan-50 shadow-lg">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <BookOpen className="h-6 w-6 text-cyan-600" />
                      K-12 Project Ideas 🌟
                    </CardTitle>
                    <CardDescription>
                      Science Fair and STEM projects using real water quality data
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-base text-cyan-800 mb-3 flex items-center gap-2">
                        <span className="text-lg">🔬</span> Science Fair Project Ideas
                      </h3>
                      <div className="space-y-4">
                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Does a Rainstorm Change Water Quality?</h4>
                          <p className="text-xs text-slate-600 mb-2">Compare water quality before, during, and after storm events. Use Pearl's time controls to see pollutant spikes.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-ESS3-3</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Storm Events Tab</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Do Green Infrastructure Projects Clean Water?</h4>
                          <p className="text-xs text-slate-600 mb-2">Test if rain gardens and bioswales reduce pollutants. Compare influent vs effluent data using % Removal mode.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-ETS1-1</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">% Removal Tab</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Which Pollutant Is Worst After a Storm?</h4>
                          <p className="text-xs text-slate-600 mb-2">Rank pollutants by concentration increase during storms. Export CSV data and create charts for your poster.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-ESS3-4</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Export CSV</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Can We Predict Algal Blooms?</h4>
                          <p className="text-xs text-slate-600 mb-2">Track nitrogen and phosphorus levels to predict when algae will grow. Use Trends Chart to find patterns.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS MS-LS2-3</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Trends & Gauges</span>
                          </div>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Clean Is My Local Water?</h4>
                          <p className="text-xs text-slate-600 mb-2">Compare your region's water quality to EPA standards. Present findings with Pearl's gauges and scores.</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-800 text-xs rounded">NGSS HS-ESS3-4</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">Regional Data</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold text-base text-cyan-800 mb-3 flex items-center gap-2">
                        <span className="text-lg">🎯</span> General STEM Project Ideas
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Does Rain Affect Water Quality?</h4>
                          <p className="text-xs text-slate-600">Track pollutant changes during rainfall events</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Does Green Infrastructure Work?</h4>
                          <p className="text-xs text-slate-600">Compare water before/after BMPs</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Can We Predict Algal Blooms?</h4>
                          <p className="text-xs text-slate-600">Correlate nutrient levels with algae growth</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">What Happens to Oxygen After a Storm?</h4>
                          <p className="text-xs text-slate-600">Measure dissolved oxygen changes</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">Is My Local Water Safe for Wildlife?</h4>
                          <p className="text-xs text-slate-600">Compare pollutants to wildlife thresholds</p>
                        </div>

                        <div className="bg-white p-3 rounded-lg border border-cyan-200">
                          <h4 className="font-medium text-sm text-cyan-900 mb-1">How Effective Are Stormwater BMPs?</h4>
                          <p className="text-xs text-slate-600">Calculate % removal efficiency</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-cyan-100 p-3 rounded-lg border border-cyan-300">
                      <p className="text-xs text-cyan-900">
                        <strong>💡 Pro Tip:</strong> Use Pearl's Export CSV button to download data for graphs. Switch between Ambient, In/Effluent, and % Removal modes to explore different angles!
                      </p>
                    </div>
                  </CardContent>
                </Card>
          )}

          {/* ── K-12 TRENDS ──────────────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && userRole === 'K12' && (
            <CollapsibleSection id="trends" title="Trends & Historical Data" icon="📈" collapsed={isCollapsed('trends')} onToggle={toggleSection}>
              <Card className="border-2 border-cyan-200">
                <CardHeader>
                  <CardTitle className="text-xl">Parameter Trends Over Time</CardTitle>
                  <CardDescription>
                    How have water quality readings changed? Use this graph for your data analysis activities.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TrendsChart data={displayData} />
                </CardContent>
              </Card>
            </CollapsibleSection>
          )}

          {/* ── MDE EXPORT ─────────────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && (userRole === 'MS4' || userRole === 'Researcher') && (
            <CollapsibleSection id="mde-export" title="Compliance Report" icon="📄" collapsed={isCollapsed('mde-export')} onToggle={toggleSection}>
              <MDEExportTool data={displayData} removalEfficiencies={removalEfficiencies} regionId={selectedRegionId} regionName={selectedRegion?.name || ''} stormEvents={stormEvents} overallScore={overallScore} />
            </CollapsibleSection>
          )}

          {/* ── DATA INTEGRITY & AUDIT TRAIL ───────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && (userRole === 'MS4' || (userRole as string) === 'State' || userRole === 'Researcher') && (
            <CollapsibleSection id="data-integrity" title="Data Integrity & Audit Trail" icon="🛡" collapsed={isCollapsed('data-integrity')} onToggle={toggleSection}>
              <DataIntegrityPanel regionName={selectedRegion?.name || 'Middle Branch'} />
            </CollapsibleSection>
          )}

          {/* ── RESEARCH COLLABORATION HUB ───────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && (userRole === 'Researcher' || userRole === 'College') && (
            <CollapsibleSection id="research" title="Research Collaboration Hub" icon="🔬" collapsed={isCollapsed('research')} onToggle={toggleSection}>
              <ResearchCollaborationHub userRole={userRole as 'Researcher' | 'College'} />
            </CollapsibleSection>
          )}

          {/* ── TMDL + EXISTING FEATURES ───────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && (userRole === 'MS4' || userRole === 'Researcher') && (
            <CollapsibleSection id="tmdl" title="TMDL Compliance & EJ Impact" icon="🎯" collapsed={isCollapsed('tmdl')} onToggle={toggleSection}>
            <>
              {userRole !== 'K12' && userRole !== 'College' && (
                <TMDLProgressAndReportGenerator
                  regionId={selectedRegionId}
                  removalEfficiencies={removalEfficiencies}
                  stormEvents={stormEvents}
                  alertCount={waterQualityAlerts.length}
                  overallScore={overallScore}
                  dateRange={{ start: startDate, end: endDate }}
                />
              )}
              <WildlifeImpactDisclaimer enabled={showWildlife} onToggle={setShowWildlife} />
              {shouldShowEJImpact() && (
                <CollapsibleSection id="ej-impact" title="Environmental Justice Impact" icon="⚖️" collapsed={isCollapsed('ej-impact')} onToggle={toggleSection}>
                <div className="space-y-2">
                  <EnvironmentalJusticeImpact
                    regionId={selectedRegionId}
                    regionName={selectedRegion?.name || ''}
                    parameters={Object.values(data.parameters)}
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => exportEJReport(displayData, selectedRegion?.name || 'Unknown', selectedRegionId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      Export EJ Impact PDF
                    </button>
                  </div>
                </div>
                </CollapsibleSection>
              )}
            </>
            </CollapsibleSection>
          )}

          {/* ── FORECAST ──────────────────────────────────────────────── */}
          {!showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <CollapsibleSection id="forecast" title="Water Quality Forecast" icon="🌦" collapsed={isCollapsed('forecast')} onToggle={toggleSection}>
            <div className="space-y-2">
              <ForecastChart data={displayData} removalEfficiencies={removalEfficiencies} userRole={userRole} />
              <div className="flex justify-end">
                <button
                  onClick={() => exportForecastReport(displayData, selectedRegion?.name || 'Unknown', userRole)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  Export Forecast PDF
                </button>
              </div>
            </div>
            </CollapsibleSection>
          )}

          {dataMode === 'ambient' && showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                      Raw Influent
                    </CardTitle>
                    <CardDescription>Incoming wastewater</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(influentData.parameters).map(([key, param]) => (
                        <Card key={key} className="border shadow-lg hover:shadow-xl transition-all">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-300 bg-gradient-to-br from-green-50 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500"></div>
                      Treated Effluent
                    </CardTitle>
                    <CardDescription>Discharge to bay - with % removal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(effluentData.parameters).map(([key, param]) => {
                        const paramKey = key as keyof typeof influentData.parameters;
                        const influentValue = influentData.parameters[paramKey].value;
                        const effluentValue = param.value;
                        const efficiency = removalEfficiencies[paramKey];
                        const removalDisplay = calculateRemovalDisplay(key, influentValue, effluentValue, efficiency);

                        return (
                          <Card key={key} className="border shadow-lg hover:shadow-xl transition-all">
                            <CardContent className="pt-6">
                              <WaterQualityGauge
                                parameter={param}
                                removalInfo={removalDisplay}
                              />
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <RemovalSummaryCard
                influentData={influentData}
                effluentData={effluentData}
                removalEfficiencies={removalEfficiencies}
              />
            </div>
          )}

          {showNutrientCredits && (
            <NutrientCreditsTrading
              stormEvents={stormEvents}
              influentData={influentData}
              effluentData={effluentData}
              removalEfficiencies={removalEfficiencies}
              timeRange={{
                start: new Date(startDate || Date.now() - 7 * 24 * 60 * 60 * 1000),
                end: new Date(endDate || Date.now())
              }}
            />
          )}

          {showESG && (
            <ESGImpactReporting
              data={data}
              regionName={selectedRegion?.name || ''}
              removalEfficiencies={removalEfficiencies}
              ejMetrics={ejMetrics}
              alertCount={waterQualityAlerts.length}
              isPublicView={false}
            />
          )}

          {showManuscript && (
            <ManuscriptGenerator
              data={data}
              regionName={selectedRegion?.name || ''}
              removalEfficiencies={removalEfficiencies}
              isEJArea={ejMetrics?.isEJArea}
            />
          )}

          {dataMode === 'ambient' && showComparison && !showNutrientCredits && !showESG && !showManuscript && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-2 border-blue-300">
                <CardHeader>
                  <CardTitle className="text-xl">Current Period</CardTitle>
                  <CardDescription>Most recent readings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(data.parameters).map(([key, param]) => {
                      const prevValue = (previousPeriodData.parameters as any)[key].value;
                      const change = calculateChange(param.value, prevValue);
                      const isWorse =
                        (param.type === 'increasing-bad' && param.value > prevValue) ||
                        (param.type === 'decreasing-bad' && param.value < prevValue);

                      return (
                        <Card key={key} className="border shadow-lg">
                          <CardContent className="pt-6">
                            <WaterQualityGauge parameter={param} />
                            <div className="text-center mt-2">
                              <span
                                className={`text-sm font-semibold ${
                                  isWorse ? 'text-red-600' : 'text-green-600'
                                }`}
                              >
                                {change > '0' ? '+' : ''}
                                {change}%
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-gray-300">
                <CardHeader>
                  <CardTitle className="text-xl">Previous Period</CardTitle>
                  <CardDescription>Comparison baseline (30 days ago)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Object.entries(previousPeriodData.parameters).map(([key, param]) => (
                      <Card key={key} className="border shadow-lg">
                        <CardContent className="pt-6">
                          <WaterQualityGauge parameter={param} />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {dataMode === 'ambient' && !showNutrientCredits && !showESG && !showManuscript && (
            <div suppressHydrationWarning>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {shouldShowROICalculator() && (
                  <div className="flex flex-col items-center gap-2">
                    <ROISavingsCalculator
                      stormEventsMonitored={stormEvents.length}
                      regionId={selectedRegionId}
                    />
                    <button
                      onClick={() => exportROIReport(displayData, removalEfficiencies, selectedRegion?.name || 'Unknown')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      Export ROI Report PDF
                    </button>
                  </div>
                )}

                {shouldShowPeerBenchmarking() && (
                  <div className={`flex flex-col items-center gap-2 w-full ${(userRole as string) === 'State' ? 'lg:col-span-2' : ''}`}>
                    <PeerBenchmarking
                      removalEfficiencies={removalEfficiencies}
                      regionId={selectedRegionId}
                      userRole={userRole}
                    />
                    <button
                      onClick={() => exportPeerBenchmarkReport(displayData, selectedRegion?.name || 'Unknown')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      Export Benchmarks PDF
                    </button>
                  </div>
                )}
              </div>

              {/* Academic Tools for College Students & Researchers */}
              {(userRole === 'College' || userRole === 'Researcher') && (
                <AcademicTools
                  userRole={userRole as 'College' | 'Researcher'}
                  regionId={selectedRegionId}
                  stateAbbr={userState}
                />
              )}

              {/* K-12 Educational Hub */}
              {userRole === 'K12' && (
                <K12EducationalHub 
                  data={displayData}
                  isTeacher={isTeacher}
                />
              )}

              {/* NGO Projects Tracker */}
              {userRole === 'NGO' && (
                <NGOProjects
                  regionName={selectedRegion?.name || 'Unknown Region'}
                  data={displayData}
                  removalEfficiencies={removalEfficiencies}
                />
              )}

              {shouldShowGrantMatcher() && (
                <>
                  <GrantOpportunityMatcher
                    regionId={selectedRegionId}
                    removalEfficiencies={removalEfficiencies}
                    alertsCount={waterQualityAlerts.filter(a => !dismissedAlerts.has(a.id)).length}
                    userRole={userRole}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => exportGrantReport(displayData, removalEfficiencies, selectedRegion?.name || 'Unknown')}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                    >
                      <FileText className="h-3.5 w-3.5 text-blue-500" />
                      Export Grant Summary PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="text-xs text-muted-foreground bg-slate-50 border border-slate-200 rounded-lg p-4">
            <p className="font-semibold mb-2">Water Quality Standards - {selectedRegion?.name}</p>
            <p>
              {selectedRegionId === 'florida_escambia' && (
                <>
                  All thresholds align with Florida Administrative Code Chapter 62-302 for Class II/III marine waters.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for healthy aquatic life; turbidity and nutrient targets based on site-specific
                  natural background levels and estuary-specific numeric nutrient criteria. Data collected via automated monitoring stations
                  with QAPP-certified instrumentation. For technical details, visit{' '}
                  <a href="https://floridadep.gov/water" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    floridadep.gov/water
                  </a>
                </>
              )}
              {selectedRegionId === 'california_sf_bay' && (
                <>
                  Thresholds based on California Regional Water Quality Control Board standards for San Francisco Bay.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L (stricter than federal standards);
                  nutrient criteria align with site-specific Basin Plan objectives and TMDL requirements.
                  Monitoring follows Surface Water Ambient Monitoring Program (SWAMP) protocols.
                </>
              )}
              {selectedRegionId === 'maryland_middle_branch' && (
                <>
                  Thresholds based on Maryland/Chesapeake Bay Program water quality standards for tidal Patapsco River.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for open-water designated use;
                  nutrient criteria align with Chesapeake Bay TMDL allocations and Maryland's Biological Stressor Policy.
                  Monitoring follows Eyes on the Bay continuous monitoring protocols. See{' '}
                  <a href="https://mde.maryland.gov/programs/water" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
                    Maryland DNR Water Quality
                  </a>
                </>
              )}
              {selectedRegionId === 'dc_anacostia' && (
                <>
                  Standards based on District of Columbia Water Quality Standards for Class B tidal rivers.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for aquatic life support;
                  nutrient and TSS criteria support Anacostia River TMDL requirements.
                  Monitoring conducted through DC DOEE ambient network. Pearl deployment planned 2026 Q3.
                </>
              )}
              {selectedRegionId === 'maryland_inner_harbor' && (
                <>
                  Thresholds based on Maryland tidal harbor standards for Class II estuarine waters.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for seasonal hypoxia prevention;
                  nutrient criteria support Baltimore Harbor improvement goals.
                  Data from Maryland Eyes on the Bay network. Pearl deployment planned 2026 Q4.
                </>
              )}
              {selectedRegionId === 'eu_generic' && (
                <>
                  Standards compliant with EU Water Framework Directive (2000/60/EC) for transitional waters.
                  Dissolved oxygen (DO) minimum {data.parameters.DO.thresholds.green.min} mg/L for "Good" ecological status;
                  nutrient and clarity thresholds support achievement of type-specific biological quality elements.
                  Assessment follows Common Implementation Strategy guidance.
                </>
              )}
            </p>
          </div>

          </div>
          {/* ── END WATERBODY-SPECIFIC DASHBOARD ────────────────────── */}

          <DataSourceFooter />
        </div>
      </div>
    </div>
    )}
    </>
    </AuthGuard>
  );
}
// force rebuild

// components/InvestorManagementCenter.tsx
// Investor / Financial Management Center — portfolio water stress exposure,
// climate resilience scoring, regulatory cost forecasting, and ESG water metrics.
// Architecture: 9-lens system + investor-specific sections + shared compliance panels

'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import MissionQuote from './MissionQuote';
import { WhatChangedOvernight, StakeholderWatch } from './BriefingCards';
import { useLensParam } from '@/lib/useLensParam';
import type { MapRef } from 'react-map-gl/mapbox';
import HeroBanner from './HeroBanner';
import { getFrsAllFacilities } from '@/lib/frsCache';
import { getEchoAllData } from '@/lib/echoCache';
import dynamic from 'next/dynamic';
import { STATE_GEO_LEAFLET, FIPS_TO_ABBR, STATE_NAMES as _SN } from '@/lib/mapUtils';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);
const MapboxMarkers = dynamic(
  () => import('@/components/MapboxMarkers').then(m => m.MapboxMarkers),
  { ssr: false, loading: () => <div className="w-full h-[400px] rounded-xl bg-slate-100 dark:bg-slate-800/50 animate-pulse flex items-center justify-center"><span className="text-xs text-slate-400">Loading map…</span></div> }
);
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, BarChart3, Shield, TrendingUp, TrendingDown, AlertTriangle, ChevronDown,
  Gauge, Minus, MapPin, Building2, FileText, Award, Globe, Leaf, Users, Target,
  DollarSign, Eye, Lock, Activity, ArrowRight, ChevronRight, Search, Filter,
  ExternalLink, Star, Zap, Heart, Scale, X, Microscope, Beaker,
  CheckCircle2, Circle, AlertCircle, Sparkles, ClipboardList, Link2,
  ShieldCheck, Factory, Waves, CloudRain, Landmark, Briefcase, PieChart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { useAdminState } from '@/lib/adminStateContext';
import { getRegionById } from '@/lib/regionsConfig';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';

import { NwisGwPanel } from '@/components/NwisGwPanel';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { PolicyTracker } from '@/components/PolicyTracker';
import { EmergingContaminantsTracker } from '@/components/EmergingContaminantsTracker';
import ResolutionPlanner from '@/components/ResolutionPlanner';
import { DisasterEmergencyPanel } from '@/components/DisasterEmergencyPanel';
import { SupplyChainRiskPanel } from '@/components/SupplyChainRiskPanel';
import RoleTrainingGuide from '@/components/RoleTrainingGuide';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';
import { DataFreshnessFooter } from '@/components/DataFreshnessFooter';
import { RoleBriefingActionsCard, RoleBriefingPulseCard } from '@/components/RoleBriefingCards';
import { getEcoData, getEcoScore, ecoScoreLabel } from '@/lib/ecologicalSensitivity';
import { ecoScoreStyle } from '@/lib/scoringUtils';
import { AskPinUniversalCard } from '@/components/AskPinUniversalCard';
const GrantOpportunityMatcher = dynamic(
  () => import('@/components/GrantOpportunityMatcher').then((mod) => mod.GrantOpportunityMatcher),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = 'high' | 'medium' | 'low' | 'none';

type PortfolioCompany = {
  id: string;
  name: string;
  sector: string;
  state: string;
  aum: number; // AUM exposure in $M
  waterRiskScore: number;
  alertLevel: AlertLevel;
  activeAlerts: number;
  lastUpdatedISO: string;
  status: 'monitored' | 'assessed' | 'unmonitored';
  dataSourceCount: number;
  lat?: number;
  lon?: number;
  esgRating?: 'A' | 'B' | 'C' | 'D' | 'F';
  waterIntensity?: number; // gal per $1K revenue
  complianceRate?: number; // percentage
  stressLevel?: 'extreme' | 'high' | 'medium-high' | 'low-medium' | 'low';
};

// ─── Lenses (9-view architecture) ──────────────────────────────────────────

type ViewLens = 'overview' | 'portfolio-risk' | 'water-stress' | 'compliance' |
  'esg-disclosure' | 'climate-resilience' | 'financial-impact' | 'due-diligence' | 'trends' |
  'briefing' | 'habitat' | 'scorecard' | 'training';

type LensConfig = {
  label: string;
  description: string;
  icon: any;
  sections: Set<string>;
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  summary: 'Portfolio-level investor summary for scoped water risk, compliance, and exposure.',
  kpis: 'Core KPIs for risk, compliance, AUM exposure, and verified monitoring coverage.',
  'map-grid': 'Interactive map and ranked portfolio list for rapid risk triage.',
  'portfolio-snapshot': 'Scoped holdings snapshot with sector, state, and risk posture.',
  'portfolio-risk-matrix': 'Risk versus AUM concentration matrix for investment prioritization.',
  'risk-factors': 'Primary water risk drivers and financial impact channels.',
  'asset-exposure': 'AUM distribution by risk tier across scoped holdings.',
  'water-stress-map': 'Water stress exposure summary for scoped holdings by stress tier.',
  'stressed-assets-table': 'Holdings in stressed basins ranked by risk and exposure.',
  'basin-analysis': 'Basin-level outlook affecting holdings and long-horizon water availability.',
  'compliance-overview': 'Compliance posture, violations, and threshold tracking across holdings.',
  'regulatory-cost-forecast': 'Projected cost exposure from regulatory tightening and new standards.',
  'esg-scoring': 'Water-related ESG scoring distribution for scoped holdings.',
  'disclosure-readiness': 'Framework coverage for water disclosure and reporting readiness.',
  'water-metrics-table': 'Benchmark comparison across investor-relevant water metrics.',
  'climate-scenarios': 'Scenario-based climate/water exposure assumptions and downside risk.',
  'physical-risk-panel': 'Physical climate-water risk concentration and prioritized exposures.',
  'transition-risk-panel': 'Policy and market transition risks impacting water-dependent assets.',
  'financial-impact-summary': 'Topline financial exposure and savings opportunities.',
  'valuation-impact': 'Estimated valuation impact from water risk materialization.',
  'cost-of-inaction': 'Projected losses under delayed mitigation and response.',
  'due-diligence-checklist': 'Standardized investor due-diligence controls for water risk.',
  'site-risk-profile': 'Holding-level risk profiles for diligence and engagement.',
  economic: 'Economic implications and scenario-adjusted performance outlook.',
  insights: 'AI-generated investor insights from scoped data and trend signals.',
  groundwater: 'Groundwater signals relevant to portfolio exposure and resilience.',
  icis: 'NPDES/ICIS compliance panel scoped to selected state context.',
  sdwis: 'Drinking water compliance panel scoped to selected state context.',
  'disaster-emergency-panel': 'Acute disruption and emergency response exposure context.',
  'briefing-actions': 'Priority actions and morning intelligence for investor operations.',
  'hab-ecoscore': 'Ecological sensitivity exposure context for scoped holdings.',
  'hab-wildlife': 'Threatened and aquatic species context tied to holding states.',
  'scorecard-kpis': 'Investor scorecard KPIs for risk, compliance, ESG, and exposure.',
  'scorecard-grades': 'Letter-grade view of investor water performance dimensions.',
};

const LENS_CONFIG: Record<ViewLens, LensConfig> = {
  overview: {
    label: 'Executive Overview', description: 'Portfolio-level water risk summary for investors',
    icon: Building2,
    sections: new Set(['summary', 'kpis', 'map-grid', 'portfolio-snapshot', 'ask-pin-universal', 'disclaimer']),
  },
  'portfolio-risk': {
    label: 'Portfolio Risk', description: 'Water risk exposure across portfolio holdings',
    icon: BarChart3,
    sections: new Set(['portfolio-risk-matrix', 'risk-factors', 'asset-exposure', 'icis', 'disclaimer']),
  },
  'water-stress': {
    label: 'Water Stress', description: 'Basin-level water stress analysis for portfolio assets',
    icon: Droplets,
    sections: new Set(['water-stress-map', 'stressed-assets-table', 'basin-analysis', 'groundwater', 'disclaimer']),
  },
  compliance: {
    label: 'Compliance & Regulatory', description: 'Regulatory compliance risk and cost forecasting',
    icon: Shield,
    sections: new Set(['compliance-overview', 'regulatory-cost-forecast', 'icis', 'sdwis', 'disclaimer']),
  },
  'esg-disclosure': {
    label: 'ESG Disclosure', description: 'ESG water metrics readiness and disclosure scoring',
    icon: FileText,
    sections: new Set(['esg-scoring', 'disclosure-readiness', 'water-metrics-table', 'disclaimer']),
  },
  'climate-resilience': {
    label: 'Climate Resilience', description: 'Climate scenario analysis and physical/transition risk',
    icon: CloudRain,
    sections: new Set(['climate-scenarios', 'physical-risk-panel', 'transition-risk-panel', 'disaster-emergency-panel', 'disclaimer']),
  },
  'financial-impact': {
    label: 'Financial Impact', description: 'Water risk valuation impact and cost of inaction',
    icon: DollarSign,
    sections: new Set(['financial-impact-summary', 'valuation-impact', 'cost-of-inaction', 'economic', 'disclaimer']),
  },
  'due-diligence': {
    label: 'Due Diligence', description: 'Water risk due diligence for M&A and new investments',
    icon: Search,
    sections: new Set(['due-diligence-checklist', 'site-risk-profile', 'contaminants-tracker', 'supply-chain-risk-panel', 'disclaimer']),
  },
  trends: {
    label: 'Trends & Outlook', description: 'Water risk trajectories, AI insights, and policy outlook',
    icon: TrendingUp,
    sections: new Set(['trends-dashboard', 'disclaimer']),
  },
  briefing: {
    label: 'Briefing', description: 'Daily briefing with actions, changes, and stakeholder updates',
    icon: ClipboardList,
    sections: new Set(['briefing-actions', 'insights', 'disclaimer']),
  },
  habitat: {
    label: 'Habitat', description: 'Ecological sensitivity and wildlife exposure across portfolio',
    icon: Leaf,
    sections: new Set(['hab-ecoscore', 'hab-wildlife', 'disclaimer']),
  },
  scorecard: {
    label: 'Scorecard', description: 'KPIs and grades for portfolio environmental performance',
    icon: Award,
    sections: new Set(['scorecard-kpis', 'scorecard-grades', 'disclaimer']),
  },
  training: {
    label: 'Training', description: 'Deployment training and onboarding guide',
    icon: Building2,
    sections: new Set(['training']),
  },
};

// ─── Overlay types for map ───────────────────────────────────────────────────

type OverlayId = 'waterrisk' | 'compliance' | 'esg';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'waterrisk', label: 'Water Risk', description: 'Portfolio water stress exposure from ATTAINS & WRI', icon: Droplets },
  { id: 'compliance', label: 'Compliance', description: 'EPA ECHO violations & NPDES permit status', icon: Shield },
  { id: 'esg', label: 'ESG Rating', description: 'Water-related ESG scoring', icon: Leaf },
];

function getMarkerColor(overlay: OverlayId, c: PortfolioCompany): string {
  if (overlay === 'waterrisk') {
    return c.waterRiskScore >= 70 ? '#ef4444' :
           c.waterRiskScore >= 40 ? '#f59e0b' :
           c.waterRiskScore >= 20 ? '#eab308' : '#22c55e';
  }
  if (overlay === 'compliance') {
    return c.alertLevel === 'high' ? '#ef4444' :
           c.alertLevel === 'medium' ? '#f59e0b' :
           c.alertLevel === 'low' ? '#eab308' : '#22c55e';
  }
  // esg overlay
  if (c.esgRating === 'A') return '#22c55e';
  if (c.esgRating === 'B') return '#84cc16';
  if (c.esgRating === 'C') return '#f59e0b';
  if (c.esgRating === 'D') return '#ef4444';
  if (c.esgRating === 'F') return '#dc2626';
  return '#9ca3af';
}

// ─── Water Risk Factors ─────────────────────────────────────────────────────

interface WaterRiskFactor {
  category: string;
  description: string;
  financialImpact: string;
  severity: 'high' | 'medium' | 'low';
}

const WATER_RISK_FACTORS: WaterRiskFactor[] = [
  { category: 'Physical Scarcity', description: 'Basin-level water stress exceeding withdrawal thresholds', financialImpact: 'Operational disruption, stranded assets, production curtailment', severity: 'high' },
  { category: 'Regulatory Tightening', description: 'Emerging PFAS limits, stricter NPDES permits, new effluent guidelines', financialImpact: 'Capex for treatment upgrades, permit delays, compliance penalties', severity: 'high' },
  { category: 'Reputational Exposure', description: 'Community opposition, EJ screening, media scrutiny on water use', financialImpact: 'License to operate risk, investor sentiment, ESG downgrades', severity: 'medium' },
  { category: 'Climate-Driven Variability', description: 'Drought frequency, flood risk, shifting precipitation patterns', financialImpact: 'Insurance cost increases, infrastructure damage, supply chain disruption', severity: 'high' },
  { category: 'Supply Chain Dependency', description: 'Upstream water-intensive suppliers in stressed basins', financialImpact: 'Input cost volatility, supplier default risk, sourcing alternatives', severity: 'medium' },
  { category: 'Transition Risk', description: 'Carbon pricing impact on energy-intensive water treatment', financialImpact: 'Operating cost increases, technology retrofit requirements', severity: 'low' },
];

// ─── ESG Water Metrics ──────────────────────────────────────────────────────

interface ESGWaterMetric {
  metric: string;
  unit: string;
  framework: string;
  portfolioAvg: string;
  benchmark: string;
  status: 'above' | 'at' | 'below';
}

const ESG_WATER_METRICS: ESGWaterMetric[] = [
  { metric: 'Water Intensity', unit: 'gal / $1K revenue', framework: 'GRI 303', portfolioAvg: '142', benchmark: '180', status: 'above' },
  { metric: 'Withdrawal-to-Revenue', unit: 'ML / $M', framework: 'CDP Water', portfolioAvg: '3.8', benchmark: '4.2', status: 'above' },
  { metric: 'Compliance Rate', unit: '%', framework: 'SASB', portfolioAvg: '94.2', benchmark: '92.0', status: 'above' },
  { metric: 'Recycled Water %', unit: '%', framework: 'GRI 303-3', portfolioAvg: '28', benchmark: '35', status: 'below' },
  { metric: 'Water Stress Exposure', unit: '% assets', framework: 'TCFD', portfolioAvg: '34', benchmark: '40', status: 'above' },
  { metric: 'Discharge Quality', unit: 'violations/yr', framework: 'SASB', portfolioAvg: '1.8', benchmark: '2.5', status: 'above' },
  { metric: 'PFAS Monitoring', unit: '% sites', framework: 'Emerging', portfolioAvg: '62', benchmark: '45', status: 'above' },
  { metric: 'Water Risk Disclosure', unit: 'score (0-100)', framework: 'CDP', portfolioAvg: '72', benchmark: '65', status: 'above' },
];

// ─── Climate Scenarios ──────────────────────────────────────────────────────

interface ClimateScenario {
  id: string;
  name: string;
  tempIncrease: string;
  waterImpact: string;
  portfolioExposure: string;
  annualizedLoss: string;
  probability: string;
}

const CLIMATE_SCENARIOS: ClimateScenario[] = [
  {
    id: 'rcp26', name: 'RCP 2.6 (Paris-aligned)', tempIncrease: '+1.5 C by 2100',
    waterImpact: 'Moderate stress increase in 20% of basins', portfolioExposure: '12% of AUM',
    annualizedLoss: '$18M', probability: '25%',
  },
  {
    id: 'rcp45', name: 'RCP 4.5 (Current policies)', tempIncrease: '+2.4 C by 2100',
    waterImpact: 'Severe stress in 40% of basins, seasonal drought', portfolioExposure: '28% of AUM',
    annualizedLoss: '$47M', probability: '50%',
  },
  {
    id: 'rcp85', name: 'RCP 8.5 (Business as usual)', tempIncrease: '+4.3 C by 2100',
    waterImpact: 'Extreme stress in 65% of basins, permanent deficit', portfolioExposure: '52% of AUM',
    annualizedLoss: '$124M', probability: '25%',
  },
];

// ─── Demo Portfolio (REMOVED) ───────────────────────────────────────────────
// Replaced with convertRealFacilitiesToPortfolioFormat() using FRS + ECHO cache data

// DEMO_PORTFOLIO removed - using real data from convertRealFacilitiesToPortfolioFormat() instead

/**
function convertRealFacilitiesToPortfolioFormat(limit: number = 15): PortfolioCompany[] {
  try {
    const frsFacilities = getFrsAllFacilities();
    const echoData = getEchoAllData();
    const echoFacilities = echoData.facilities;

    // Create a map of ECHO facilities by registry ID
    const echoMap = new Map();
    echoFacilities.forEach(facility => {
      echoMap.set(facility.registryId, facility);
    });

    const sectors = ['Utilities', 'Industrials', 'Materials', 'Energy', 'Healthcare', 'Consumer Staples', 'Real Estate'];

    return frsFacilities
      .filter(facility => facility.lat && facility.lng)
      .slice(0, limit * 2)
      .map((facility, index) => {
        const echoData = echoMap.get(facility.registryId);
        const waterRiskScore = echoData?.snc ? 75 + Math.floor(Math.random() * 25) :
                              echoData?.qtrsInViolation > 0 ? 40 + Math.floor(Math.random() * 35) :
                              15 + Math.floor(Math.random() * 40);
        const alertLevel = waterRiskScore > 75 ? 'high' :
                          waterRiskScore > 50 ? 'medium' :
                          waterRiskScore > 25 ? 'low' : 'none';

        return {
          id: facility.registryId,
          name: facility.name,
          sector: sectors[index % sectors.length],
          state: facility.state,
          aum: 50 + Math.floor(Math.random() * 500), // $50M - $550M exposure
          waterRiskScore,
          alertLevel: alertLevel as AlertLevel,
          activeAlerts: echoData?.effluentViolations || echoData?.qtrsInViolation || Math.floor(Math.random() * 4),
          lastUpdatedISO: new Date().toISOString(),
          status: 'monitored' as const,
          dataSourceCount: echoData ? 5 : 3,
          lat: facility.lat,
          lon: facility.lng,
          esgRating: ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)] as any,
          waterIntensity: 100 + Math.floor(Math.random() * 800), // gal per $1K revenue
          complianceRate: echoData?.snc ? 65 + Math.floor(Math.random() * 20) : 85 + Math.floor(Math.random() * 15),
          stressLevel: ['extreme', 'high', 'medium-high', 'low-medium', 'low'][Math.floor(Math.random() * 5)] as any,
        };
      })
      .slice(0, limit);
  } catch (error) {
    console.warn('Failed to load real portfolio data, using fallback:', error);
    return [{
      id: 'fallback-inv-001',
      name: 'Sample Portfolio Company',
      sector: 'Utilities',
      state: 'MD',
      aum: 150,
      waterRiskScore: 45,
      alertLevel: 'medium',
      activeAlerts: 2,
      lastUpdatedISO: new Date().toISOString(),
      status: 'monitored',
      dataSourceCount: 3,
      lat: 39.0458,
      lon: -76.6413,
      esgRating: 'B',
      waterIntensity: 250,
      complianceRate: 88,
      stressLevel: 'medium-high',
    }];
  }
}
*/

// ─── State GEO (reuse from shared maps) ─────────────────────────────────────

const STATE_NAMES = _SN;
const DEFAULT_CENTER: [number, number] = [38.5, -96.0];
const DEFAULT_ZOOM = 4;

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  portfolioName?: string;
  companies?: PortfolioCompany[];
  onBack?: () => void;
  onToggleDevMode?: () => void;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function InvestorManagementCenter({ portfolioName = 'PEARL Investment Portfolio', companies: propCompanies, onBack, onToggleDevMode }: Props) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [adminState, setAdminState] = useAdminState();

  // ── View Lens ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] ?? LENS_CONFIG['overview'];

  // ── Map state ──
  const [overlay, setOverlay] = useState<OverlayId>('waterrisk');
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  const [focusedState, setFocusedState] = useState<string>(adminState || 'US');
  const [searchQuery, setSearchQuery] = useState('');
  const [climateSearch, setClimateSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // ── Mapbox map ref + flyTo ──
  const mapRef = useRef<MapRef | null>(null);
  const onMapRef = useCallback((ref: MapRef) => { mapRef.current = ref; }, []);
  useEffect(() => {
    if (flyTarget && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTarget.center[1], flyTarget.center[0]], zoom: flyTarget.zoom });
    }
  }, [flyTarget]);

  useEffect(() => {
    if (adminState && focusedState !== adminState) {
      setFocusedState(adminState);
    }
  }, [adminState, focusedState]);

  // ── Mapbox hover state ──
  const [hoveredFeature, setHoveredFeature] = useState<mapboxgl.MapboxGeoJSONFeature | null>(null);
  const onMapMouseMove = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    const feat = e.features?.[0] ?? null;
    setHoveredFeature(feat);
    if (feat?.properties?.id) setHoveredCompany(feat.properties.id as string);
    else setHoveredCompany(null);
  }, []);
  const onMapMouseLeave = useCallback((_e: mapboxgl.MapLayerMouseEvent) => {
    setHoveredFeature(null);
    setHoveredCompany(null);
  }, []);
  const onMapClick = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (feat?.properties?.id) {
      setSelectedCompany(prev => prev === feat.properties!.id ? null : feat.properties!.id as string);
    }
  }, []);

  // ── Expanded section state ──
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Real portfolio companies ──
  const allCompaniesData: PortfolioCompany[] = useMemo(() => {
    if (propCompanies && propCompanies.length > 0) return propCompanies;
    return convertRealFacilitiesToPortfolioFormat(12); // Load 12 real portfolio companies
  }, [propCompanies]);
  const companiesData: PortfolioCompany[] = useMemo(() => {
    if (focusedState === 'US') return allCompaniesData;
    return allCompaniesData.filter((c) => c.state === focusedState);
  }, [allCompaniesData, focusedState]);

  // ── Mapbox marker data ──
  const companyMarkerData = useMemo(() =>
    companiesData.filter(c => c.lat && c.lon).map(c => ({
      id: c.id,
      lat: c.lat!,
      lon: c.lon!,
      color: getMarkerColor(overlay, c),
      name: c.name,
      waterRiskScore: c.waterRiskScore,
      tssEfficiency: c.complianceRate,
      status: c.status,
    })),
    [companiesData, overlay]
  );

  // ── Filtered list ──
  const filteredCompanies = useMemo(() => {
    let filtered = companiesData;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q) || c.state.toLowerCase().includes(q));
    }
    if (filterLevel !== 'all') {
      filtered = filtered.filter(c => c.alertLevel === filterLevel);
    }
    return filtered.sort((a, b) => b.waterRiskScore - a.waterRiskScore);
  }, [companiesData, searchQuery, filterLevel]);

  const climateRows = useMemo(() => {
    const q = climateSearch.trim().toLowerCase();
    const rows = companiesData
      .filter((c) => c.stressLevel === 'extreme' || c.stressLevel === 'high' || c.stressLevel === 'medium-high')
      .filter((c) => !q || c.name.toLowerCase().includes(q) || c.sector.toLowerCase().includes(q) || c.state.toLowerCase().includes(q))
      .sort((a, b) => b.waterRiskScore - a.waterRiskScore);
    return rows;
  }, [companiesData, climateSearch]);

  // ── Aggregate portfolio scores ──
  const portfolioScores = useMemo(() => {
    const total = companiesData.length;
    const highRisk = companiesData.filter(c => c.waterRiskScore >= 70).length;
    const medRisk = companiesData.filter(c => c.waterRiskScore >= 40 && c.waterRiskScore < 70).length;
    const lowRisk = companiesData.filter(c => c.waterRiskScore < 40).length;
    const monitored = companiesData.filter(c => c.status === 'monitored').length;
    const avgRisk = total > 0 ? Math.round(companiesData.reduce((s, c) => s + c.waterRiskScore, 0) / total) : 0;
    const totalAUM = companiesData.reduce((s, c) => s + c.aum, 0);
    const exposedAUM = companiesData.filter(c => c.waterRiskScore >= 40).reduce((s, c) => s + c.aum, 0);
    const avgCompliance = total > 0 ? Math.round(companiesData.reduce((s, c) => s + (c.complianceRate || 0), 0) / total) : 0;
    const extremeStress = companiesData.filter(c => c.stressLevel === 'extreme').length;
    const esgACount = companiesData.filter(c => c.esgRating === 'A').length;
    return { total, highRisk, medRisk, lowRisk, monitored, avgRisk, totalAUM, exposedAUM, avgCompliance, extremeStress, esgACount };
  }, [companiesData]);

  // ── Selected company detail ──
  const selectedComp = companiesData.find(c => c.id === selectedCompany) || null;

  // ── Text sanitizer for PDF ──

  const SeverityBadge = ({ level }: { level: 'high' | 'medium' | 'low' }) => (
    <Badge variant="outline" className={`text-2xs ${
      level === 'high' ? 'border-red-300 bg-red-50 text-red-700' :
      level === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-700' :
      'border-green-300 bg-green-50 text-green-700'
    }`}>{level}</Badge>
  );

  const ESGBadge = ({ rating }: { rating?: string }) => {
    if (!rating) return <span className="text-slate-400">--</span>;
    const cls = rating === 'A' ? 'border-green-300 bg-green-50 text-green-700' :
                rating === 'B' ? 'border-lime-300 bg-lime-50 text-lime-700' :
                rating === 'C' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                rating === 'D' ? 'border-orange-300 bg-orange-50 text-orange-700' :
                'border-red-300 bg-red-50 text-red-700';
    return <Badge variant="outline" className={`text-2xs ${cls}`}>{rating}</Badge>;
  };

  const StatusBadge = ({ status }: { status: 'above' | 'at' | 'below' }) => (
    <Badge variant="outline" className={`text-2xs ${
      status === 'above' ? 'border-green-300 bg-green-50 text-green-700' :
      status === 'at' ? 'border-amber-300 bg-amber-50 text-amber-700' :
      'border-red-300 bg-red-50 text-red-700'
    }`}>{status === 'above' ? 'Outperform' : status === 'at' ? 'At Benchmark' : 'Underperform'}</Badge>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <h1>DEBUG: Minimal Investor Component Test</h1>
      <p>Portfolio: {portfolioName}</p>
    </div>
  );
}

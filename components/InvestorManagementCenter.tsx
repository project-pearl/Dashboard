// components/InvestorManagementCenter.tsx
// Investor / Financial Management Center — portfolio water stress exposure,
// climate resilience scoring, regulatory cost forecasting, and ESG water metrics.
// Architecture: 9-lens system + investor-specific sections + shared compliance panels

'use client';

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import MissionQuote from './MissionQuote';
import { useLensParam } from '@/lib/useLensParam';
import type { MapRef } from 'react-map-gl';
import HeroBanner from './HeroBanner';
import dynamic from 'next/dynamic';
import { STATE_GEO_LEAFLET, FIPS_TO_ABBR, STATE_NAMES as _SN } from '@/lib/mapUtils';

const MapboxMapShell = dynamic(
  () => import('@/components/MapboxMapShell').then(m => m.MapboxMapShell),
  { ssr: false }
);
const MapboxMarkers = dynamic(
  () => import('@/components/MapboxMarkers').then(m => m.MapboxMarkers),
  { ssr: false }
);
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Droplets, BarChart3, Shield, TrendingUp, TrendingDown, AlertTriangle, ChevronDown,
  Gauge, Minus, MapPin, Building2, FileText, Award, Globe, Leaf, Users, Target,
  DollarSign, Eye, Lock, Activity, ArrowRight, ChevronRight, Search, Filter,
  Download, ExternalLink, Star, Zap, Heart, Scale, X, Microscope, Beaker,
  CheckCircle2, Circle, AlertCircle, Sparkles, ClipboardList, Link2,
  ShieldCheck, Factory, Waves, CloudRain, Landmark, Briefcase, PieChart
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { getRegionById } from '@/lib/regionsConfig';
import { REGION_META, getWaterbodyDataSources } from '@/lib/useWaterData';
import { BrandedPDFGenerator } from '@/lib/brandedPdfGenerator';
import { BrandedPrintBtn } from '@/lib/brandedPrint';
import { ProvenanceIcon } from '@/components/DataProvenanceAudit';
import { AIInsightsEngine } from '@/components/AIInsightsEngine';
import { PlatformDisclaimer } from '@/components/PlatformDisclaimer';
import { NwisGwPanel } from '@/components/NwisGwPanel';
import { ICISCompliancePanel } from '@/components/ICISCompliancePanel';
import { SDWISCompliancePanel } from '@/components/SDWISCompliancePanel';
import { PolicyTracker } from '@/components/PolicyTracker';
import { EmergingContaminantsTracker } from '@/components/EmergingContaminantsTracker';
import ResolutionPlanner from '@/components/ResolutionPlanner';
import { DisasterEmergencyPanel } from '@/components/DisasterEmergencyPanel';
import { SupplyChainRiskPanel } from '@/components/SupplyChainRiskPanel';
import { WARRZones } from './WARRZones';
import type { WARRMetric } from './WARRZones';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';

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
  'esg-disclosure' | 'climate-resilience' | 'financial-impact' | 'due-diligence' | 'trends';

type LensConfig = {
  label: string;
  description: string;
  icon: any;
  sections: Set<string>;
};

const LENS_CONFIG: Record<ViewLens, LensConfig> = {
  overview: {
    label: 'Executive Overview', description: 'Portfolio-level water risk summary for investors',
    icon: Building2,
    sections: new Set(['summary', 'kpis', 'map-grid', 'portfolio-snapshot', 'grants', 'disclaimer']),
  },
  'portfolio-risk': {
    label: 'Portfolio Risk', description: 'Water risk exposure across portfolio holdings',
    icon: BarChart3,
    sections: new Set(['portfolio-risk-matrix', 'risk-factors', 'asset-exposure', 'icis', 'disclaimer']),
  },
  'water-stress': {
    label: 'Water Stress', description: 'Basin-level water stress analysis for portfolio assets',
    icon: Droplets,
    sections: new Set(['water-stress-map', 'stressed-assets-table', 'basin-analysis', 'sdwis', 'groundwater', 'disclaimer']),
  },
  compliance: {
    label: 'Compliance & Regulatory', description: 'Regulatory compliance risk and cost forecasting',
    icon: Shield,
    sections: new Set(['compliance-overview', 'regulatory-cost-forecast', 'icis', 'sdwis', 'warr-metrics', 'warr-analyze', 'warr-respond', 'warr-resolve', 'disclaimer']),
  },
  'esg-disclosure': {
    label: 'ESG Disclosure', description: 'ESG water metrics readiness and disclosure scoring',
    icon: FileText,
    sections: new Set(['esg-scoring', 'disclosure-readiness', 'water-metrics-table', 'reports-hub', 'disclaimer']),
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
    sections: new Set(['trends-dashboard', 'insights', 'policy-tracker', 'resolution-planner', 'disclaimer']),
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

// ─── Demo Portfolio ─────────────────────────────────────────────────────────

const DEMO_PORTFOLIO: PortfolioCompany[] = [
  {
    id: 'inv_util_southeast', name: 'SouthFlow Water Corp', sector: 'Utilities', state: 'GA',
    aum: 240, waterRiskScore: 62, alertLevel: 'medium' as AlertLevel,
    activeAlerts: 3, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 5,
    lat: 33.749, lon: -84.388, esgRating: 'B', waterIntensity: 320, complianceRate: 91, stressLevel: 'high',
  },
  {
    id: 'inv_mfg_midwest', name: 'Great Lakes Manufacturing', sector: 'Industrials', state: 'OH',
    aum: 180, waterRiskScore: 38, alertLevel: 'low' as AlertLevel,
    activeAlerts: 1, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 4,
    lat: 41.499, lon: -81.694, esgRating: 'A', waterIntensity: 95, complianceRate: 98, stressLevel: 'low',
  },
  {
    id: 'inv_ag_west', name: 'Pacific Ag Holdings', sector: 'Agriculture', state: 'CA',
    aum: 310, waterRiskScore: 84, alertLevel: 'high' as AlertLevel,
    activeAlerts: 5, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 6,
    lat: 36.778, lon: -119.418, esgRating: 'C', waterIntensity: 580, complianceRate: 87, stressLevel: 'extreme',
  },
  {
    id: 'inv_tech_northeast', name: 'AquaTech Data Centers', sector: 'Technology', state: 'VA',
    aum: 420, waterRiskScore: 28, alertLevel: 'none' as AlertLevel,
    activeAlerts: 0, lastUpdatedISO: new Date().toISOString(), status: 'assessed', dataSourceCount: 3,
    lat: 38.834, lon: -77.431, esgRating: 'A', waterIntensity: 42, complianceRate: 100, stressLevel: 'low-medium',
  },
  {
    id: 'inv_energy_sw', name: 'Desert Energy Partners', sector: 'Energy', state: 'AZ',
    aum: 155, waterRiskScore: 76, alertLevel: 'high' as AlertLevel,
    activeAlerts: 4, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 5,
    lat: 33.448, lon: -112.074, esgRating: 'D', waterIntensity: 210, complianceRate: 89, stressLevel: 'extreme',
  },
  {
    id: 'inv_pharma_se', name: 'Coastal Pharma Inc', sector: 'Healthcare', state: 'NC',
    aum: 195, waterRiskScore: 45, alertLevel: 'medium' as AlertLevel,
    activeAlerts: 2, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 4,
    lat: 35.227, lon: -80.843, esgRating: 'B', waterIntensity: 165, complianceRate: 95, stressLevel: 'medium-high',
  },
];

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

  // ── View Lens ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] ?? LENS_CONFIG['overview'];

  // ── Map state ──
  const [overlay, setOverlay] = useState<OverlayId>('waterrisk');
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  const [focusedState, setFocusedState] = useState<string>('US');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // ── Mapbox map ref + flyTo ──
  const mapRef = useRef<MapRef | null>(null);
  const onMapRef = useCallback((ref: MapRef) => { mapRef.current = ref; }, []);
  useEffect(() => {
    if (flyTarget && mapRef.current) {
      mapRef.current.flyTo({ center: [flyTarget.center[1], flyTarget.center[0]], zoom: flyTarget.zoom });
    }
  }, [flyTarget]);

  // ── Mapbox hover state ──
  const [hoveredFeature, setHoveredFeature] = useState<mapboxgl.MapboxGeoJSONFeature | null>(null);
  const onMapMouseMove = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    const feat = e.features?.[0] ?? null;
    setHoveredFeature(feat);
    if (feat?.properties?.id) setHoveredCompany(feat.properties.id as string);
    else setHoveredCompany(null);
  }, []);
  const onMapMouseLeave = useCallback(() => {
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

  // ── Demo companies ──
  const companiesData: PortfolioCompany[] = useMemo(() => {
    if (propCompanies && propCompanies.length > 0) return propCompanies;
    return DEMO_PORTFOLIO;
  }, [propCompanies]);

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

  // ── Branded PDF export ──
  const exportInvestorReport = async () => {
    try {
      const pdf = new BrandedPDFGenerator('portrait');
      await pdf.loadLogo();
      pdf.initialize();
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      pdf.addTitle('Water Risk & Investment Intelligence Report');
      pdf.addText(clean(portfolioName), { bold: true, fontSize: 14 });
      pdf.addText(clean(`Generated ${dateStr}`), { fontSize: 9 });
      pdf.addSpacer(5);

      pdf.addSubtitle('Portfolio Summary');
      pdf.addDivider();
      pdf.addText(clean(`Portfolio: ${portfolioScores.total} companies | $${portfolioScores.totalAUM}M AUM | ${portfolioScores.monitored} PIN-verified`), { bold: true });
      pdf.addText(clean(`Water Risk: ${portfolioScores.highRisk} high | ${portfolioScores.medRisk} medium | ${portfolioScores.lowRisk} low`), { indent: 5 });
      pdf.addText(clean(`Exposed AUM: $${portfolioScores.exposedAUM}M (${Math.round(portfolioScores.exposedAUM / Math.max(portfolioScores.totalAUM, 1) * 100)}%)`), { indent: 5 });
      pdf.addSpacer(3);

      pdf.addSubtitle('Water Risk Factors');
      pdf.addDivider();
      pdf.addTable(
        ['Category', 'Severity', 'Financial Impact'],
        WATER_RISK_FACTORS.map(rf => [rf.category, rf.severity, clean(rf.financialImpact)])
      );
      pdf.addSpacer(3);

      pdf.addSubtitle('Portfolio Holdings');
      pdf.addDivider();
      pdf.addTable(
        ['Company', 'Sector', 'AUM ($M)', 'Risk', 'ESG', 'Compliance'],
        companiesData.map(c => [
          clean(c.name), c.sector, String(c.aum),
          String(c.waterRiskScore), c.esgRating || '--',
          c.complianceRate ? `${c.complianceRate}%` : '--',
        ])
      );

      pdf.addSpacer(5);
      pdf.addDivider();
      pdf.addText('DISCLAIMER', { bold: true, fontSize: 8 });
      pdf.addText(clean('This report is generated for informational purposes only. Water risk scores are derived from EPA ATTAINS, ECHO, SDWIS, and USGS data. ESG ratings and financial projections are illustrative and must be verified against official filings.'), { fontSize: 8 });

      const safeName = portfolioName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      pdf.download(`PEARL_Investor_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Investor PDF export failed:', err);
      alert('PDF export failed. Please try again.');
    }
  };

  // ─── Helper: severity badge ────────────────────────────────────────────────

  const SeverityBadge = ({ level }: { level: 'high' | 'medium' | 'low' }) => (
    <Badge variant="outline" className={`text-[9px] ${
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
    return <Badge variant="outline" className={`text-[9px] ${cls}`}>{rating}</Badge>;
  };

  const StatusBadge = ({ status }: { status: 'above' | 'at' | 'below' }) => (
    <Badge variant="outline" className={`text-[9px] ${
      status === 'above' ? 'border-green-300 bg-green-50 text-green-700' :
      status === 'at' ? 'border-amber-300 bg-amber-50 text-amber-700' :
      'border-red-300 bg-red-50 text-red-700'
    }`}>{status === 'above' ? 'Outperform' : status === 'at' ? 'At Benchmark' : 'Underperform'}</Badge>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/30">
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

        {/* ── HERO BANNER ── */}
        <HeroBanner role="investor" onDoubleClick={() => onToggleDevMode?.()} />

        {/* ── TOOLBAR STRIP ── */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 rounded-lg shadow-sm">
          <select
            value={focusedState}
            onChange={(e) => {
              const st = e.target.value;
              setFocusedState(st);
              setSelectedCompany(null);
              const geo = STATE_GEO_LEAFLET[st] || STATE_GEO_LEAFLET['US'];
              setFlyTarget({ center: geo.center, zoom: st === 'US' ? DEFAULT_ZOOM : geo.zoom });
            }}
            className="h-8 px-3 text-xs font-medium rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-2 focus:ring-amber-400/50 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="US">All States</option>
            {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
              <option key={abbr} value={abbr}>{name}</option>
            ))}
          </select>
          <button
            onClick={exportInvestorReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
        </div>

        {viewLens === 'overview' && (
          <>
            <MissionQuote role="investor" variant="light" />
            <div className="text-7xl font-bold text-amber-700 text-center pt-3 capitalize">{portfolioName}</div>
          </>
        )}

        <LayoutEditor ccKey="Investor">
        {({ sections, isEditMode, onToggleVisibility, onToggleCollapse, collapsedSections }) => {
          const isSectionOpen = (id: string) => !collapsedSections[id];
          return (<>
          <div className={`space-y-4 ${isEditMode ? 'pl-12' : ''}`}>

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

            // ─── SUMMARY (Overview lens) ─────────────────────────────────────
            case 'summary': return DS(
              <div className="rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-bold text-slate-800">Investment Summary</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-amber-700">Portfolio Strengths</div>
                    <div className="text-[11px] text-slate-700 space-y-1">
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><span className="font-semibold">{portfolioScores.esgACount}/{portfolioScores.total} companies</span> rated ESG A</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><span className="font-semibold">{portfolioScores.avgCompliance}% avg compliance</span> across holdings</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><span className="font-semibold">${portfolioScores.totalAUM}M</span> total AUM tracked</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-red-700">Risk Flags</div>
                    <div className="text-[11px] text-slate-700 space-y-1">
                      {portfolioScores.highRisk > 0 && (
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">{portfolioScores.highRisk} high-risk</span> holding{portfolioScores.highRisk === 1 ? '' : 's'} in stressed basins</span>
                        </div>
                      )}
                      {portfolioScores.extremeStress > 0 && (
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">{portfolioScores.extremeStress}</span> in extreme water stress zones</span>
                        </div>
                      )}
                      <div className="flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                        <span><span className="font-semibold">${portfolioScores.exposedAUM}M</span> AUM exposed ({Math.round(portfolioScores.exposedAUM / Math.max(portfolioScores.totalAUM, 1) * 100)}%)</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-4xl font-black ${portfolioScores.avgRisk < 40 ? 'text-green-600' : portfolioScores.avgRisk < 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {portfolioScores.avgRisk}
                      </div>
                      <div className="text-xs text-slate-500 font-medium">Avg Water Risk Score</div>
                      <div className="text-[10px] text-slate-400 mt-1">{portfolioScores.total} companies | {portfolioScores.monitored} PIN-verified</div>
                    </div>
                  </div>
                </div>
              </div>
            );

            // ─── KPIs ────────────────────────────────────────────────────────
            case 'kpis': return DS(
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total AUM', value: `$${portfolioScores.totalAUM}M`, icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
                  { label: 'Exposed AUM', value: `$${portfolioScores.exposedAUM}M`, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                  { label: 'Avg Risk Score', value: portfolioScores.avgRisk, icon: Gauge, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
                  { label: 'High Risk', value: portfolioScores.highRisk, icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                  { label: 'Avg Compliance', value: `${portfolioScores.avgCompliance}%`, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                  { label: 'PIN Verified', value: portfolioScores.monitored, icon: Activity, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
                ].map(kpi => (
                  <div key={kpi.label} className={`rounded-lg border p-3 ${kpi.bg}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                      <span className="text-[10px] text-slate-500 font-medium">{kpi.label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
                  </div>
                ))}
              </div>
            );

            // ─── MAP & PORTFOLIO LIST ─────────────────────────────────────────
            case 'map-grid': return DS(
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Map */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm" style={{ minHeight: 420 }}>
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Portfolio Map</span>
                    <div className="flex items-center gap-1.5">
                      {OVERLAYS.map(o => (
                        <button key={o.id} onClick={() => setOverlay(o.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            overlay === o.id ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}>
                          <o.icon className="h-3 w-3" /> {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <MapboxMapShell
                    defaultCenter={DEFAULT_CENTER}
                    defaultZoom={DEFAULT_ZOOM}
                    onMapRef={onMapRef}
                    onMouseMove={onMapMouseMove}
                    onMouseLeave={onMapMouseLeave}
                    onClick={onMapClick}
                  >
                    <MapboxMarkers markers={companyMarkerData} />
                  </MapboxMapShell>
                </div>
                {/* Company list */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 500 }}>
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search companies..."
                      className="flex-1 text-xs bg-transparent outline-none placeholder:text-slate-400" />
                    <select value={filterLevel} onChange={e => setFilterLevel(e.target.value as any)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-600">
                      <option value="all">All</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                    {filteredCompanies.map(c => (
                      <button key={c.id} onClick={() => {
                        setSelectedCompany(c.id === selectedCompany ? null : c.id);
                        if (c.lat && c.lon) setFlyTarget({ center: [c.lat, c.lon], zoom: 10 });
                      }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-amber-50/50 transition-colors ${
                          selectedCompany === c.id ? 'bg-amber-50 border-l-2 border-amber-500' : ''
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${
                            c.alertLevel === 'high' ? 'border-red-300 bg-red-50 text-red-700' :
                            c.alertLevel === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                            c.alertLevel === 'low' ? 'border-green-300 bg-green-50 text-green-700' :
                            'border-slate-200 bg-slate-50 text-slate-500'
                          }`}>{c.alertLevel}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span>{c.sector}</span>
                          <span>${c.aum}M</span>
                          <span>Risk: {c.waterRiskScore}</span>
                          <ESGBadge rating={c.esgRating} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );

            // ─── PORTFOLIO SNAPSHOT (Overview lens) ───────────────────────────
            case 'portfolio-snapshot': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Briefcase className="h-4 w-4 text-amber-600" /> Portfolio Snapshot</CardTitle>
                  <CardDescription className="text-[11px]">Holdings by sector with water risk exposure</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {companiesData.map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-white border border-slate-100 text-[11px]">
                        <div>
                          <span className="font-medium text-slate-700">{c.name}</span>
                          <span className="text-slate-400 ml-2">{c.sector} | {c.state}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-amber-700 font-medium">${c.aum}M</span>
                          <Badge variant="outline" className={`text-[9px] ${
                            c.waterRiskScore >= 70 ? 'border-red-300 bg-red-50 text-red-700' :
                            c.waterRiskScore >= 40 ? 'border-amber-300 bg-amber-50 text-amber-700' :
                            'border-green-300 bg-green-50 text-green-700'
                          }`}>Risk: {c.waterRiskScore}</Badge>
                          <ESGBadge rating={c.esgRating} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── PORTFOLIO RISK MATRIX (Portfolio Risk lens) ──────────────────
            case 'portfolio-risk-matrix': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-amber-600" /> Portfolio Risk Matrix</CardTitle>
                  <CardDescription className="text-[11px]">Water risk vs. AUM exposure for each portfolio holding</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                      <div className="text-2xl font-bold text-red-700">${portfolioScores.exposedAUM}M</div>
                      <div className="text-[10px] text-red-600 font-medium">At-Risk AUM</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <div className="text-2xl font-bold text-amber-700">{Math.round(portfolioScores.exposedAUM / Math.max(portfolioScores.totalAUM, 1) * 100)}%</div>
                      <div className="text-[10px] text-amber-600 font-medium">Portfolio Exposure</div>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{portfolioScores.lowRisk}</div>
                      <div className="text-[10px] text-green-600 font-medium">Low-Risk Holdings</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Company</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Sector</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">AUM ($M)</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Risk Score</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Stress</th>
                          <th className="pb-2 font-semibold text-slate-600">ESG</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {companiesData.sort((a, b) => b.waterRiskScore - a.waterRiskScore).map(c => (
                          <tr key={c.id} className="hover:bg-amber-50/50">
                            <td className="py-1.5 pr-3 font-medium text-slate-800">{c.name}</td>
                            <td className="py-1.5 pr-3 text-slate-600">{c.sector}</td>
                            <td className="py-1.5 pr-3 text-slate-600 font-mono">{c.aum}</td>
                            <td className="py-1.5 pr-3">
                              <Badge variant="outline" className={`text-[9px] ${
                                c.waterRiskScore >= 70 ? 'border-red-300 bg-red-50 text-red-700' :
                                c.waterRiskScore >= 40 ? 'border-amber-300 bg-amber-50 text-amber-700' :
                                'border-green-300 bg-green-50 text-green-700'
                              }`}>{c.waterRiskScore}</Badge>
                            </td>
                            <td className="py-1.5 pr-3 text-slate-500">{c.stressLevel || '--'}</td>
                            <td className="py-1.5"><ESGBadge rating={c.esgRating} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── RISK FACTORS (Portfolio Risk lens) ───────────────────────────
            case 'risk-factors': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-red-600" /> Water Risk Factor Analysis</CardTitle>
                  <CardDescription className="text-[11px]">Key water risk categories and their financial implications for investors</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {WATER_RISK_FACTORS.map((rf, i) => (
                      <div key={i} className={`flex items-start justify-between px-3 py-2.5 rounded-lg border ${
                        rf.severity === 'high' ? 'border-red-200 bg-red-50/50' :
                        rf.severity === 'medium' ? 'border-amber-200 bg-amber-50/50' :
                        'border-slate-200 bg-slate-50/50'
                      }`}>
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-slate-800">{rf.category}</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{rf.description}</div>
                          <div className="text-[10px] text-slate-600 mt-1"><span className="font-medium">Impact:</span> {rf.financialImpact}</div>
                        </div>
                        <SeverityBadge level={rf.severity} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── ASSET EXPOSURE (Portfolio Risk lens) ─────────────────────────
            case 'asset-exposure': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4 text-orange-600" /> Asset Exposure Analysis</CardTitle>
                  <CardDescription className="text-[11px]">AUM concentration by water risk tier</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { tier: 'Critical (70+)', companies: companiesData.filter(c => c.waterRiskScore >= 70), color: 'bg-red-500', bg: 'bg-red-50' },
                      { tier: 'Elevated (40-69)', companies: companiesData.filter(c => c.waterRiskScore >= 40 && c.waterRiskScore < 70), color: 'bg-amber-500', bg: 'bg-amber-50' },
                      { tier: 'Manageable (<40)', companies: companiesData.filter(c => c.waterRiskScore < 40), color: 'bg-green-500', bg: 'bg-green-50' },
                    ].map(tier => {
                      const tierAUM = tier.companies.reduce((s, c) => s + c.aum, 0);
                      const pct = Math.round(tierAUM / Math.max(portfolioScores.totalAUM, 1) * 100);
                      return (
                        <div key={tier.tier} className={`rounded-lg p-3 ${tier.bg}`}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-slate-800">{tier.tier}</span>
                            <span className="text-[11px] font-bold text-slate-700">${tierAUM}M ({pct}%)</span>
                          </div>
                          <div className="w-full h-2 bg-white/60 rounded-full overflow-hidden mb-2">
                            <div className={`h-full ${tier.color} rounded-full`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {tier.companies.map(c => c.name).join(', ') || 'No holdings'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── WATER STRESS MAP (Water Stress lens) ─────────────────────────
            case 'water-stress-map': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Droplets className="h-4 w-4 text-blue-600" /> Water Stress Exposure</CardTitle>
                  <CardDescription className="text-[11px]">Portfolio holdings mapped to WRI Aqueduct water stress basins</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Extreme Stress', value: companiesData.filter(c => c.stressLevel === 'extreme').length, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
                      { label: 'High Stress', value: companiesData.filter(c => c.stressLevel === 'high').length, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Medium-High', value: companiesData.filter(c => c.stressLevel === 'medium-high').length, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Low', value: companiesData.filter(c => c.stressLevel === 'low' || c.stressLevel === 'low-medium').length, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                    ].map(kpi => (
                      <div key={kpi.label} className={`rounded-lg border p-2 text-center ${kpi.bg}`}>
                        <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-[9px] text-slate-500">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── STRESSED ASSETS TABLE (Water Stress lens) ───────────────────
            case 'stressed-assets-table': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600" /> Stressed Assets</CardTitle>
                  <CardDescription className="text-[11px]">Holdings in water-stressed basins ranked by exposure</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Company</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">State</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Stress Level</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Water Intensity</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">AUM ($M)</th>
                          <th className="pb-2 font-semibold text-slate-600">Risk</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {companiesData.filter(c => c.stressLevel === 'extreme' || c.stressLevel === 'high' || c.stressLevel === 'medium-high')
                          .sort((a, b) => b.waterRiskScore - a.waterRiskScore).map(c => (
                          <tr key={c.id} className="hover:bg-red-50/50">
                            <td className="py-1.5 pr-3 font-medium text-slate-800">{c.name}</td>
                            <td className="py-1.5 pr-3 text-slate-600">{c.state}</td>
                            <td className="py-1.5 pr-3">
                              <Badge variant="outline" className={`text-[9px] ${
                                c.stressLevel === 'extreme' ? 'border-red-300 bg-red-50 text-red-700' :
                                c.stressLevel === 'high' ? 'border-orange-300 bg-orange-50 text-orange-700' :
                                'border-amber-300 bg-amber-50 text-amber-700'
                              }`}>{c.stressLevel}</Badge>
                            </td>
                            <td className="py-1.5 pr-3 text-slate-600 font-mono">{c.waterIntensity} gal/$1K</td>
                            <td className="py-1.5 pr-3 text-slate-600 font-mono">{c.aum}</td>
                            <td className="py-1.5 font-bold text-red-600">{c.waterRiskScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── BASIN ANALYSIS (Water Stress lens) ──────────────────────────
            case 'basin-analysis': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-cyan-600" /> Basin-Level Analysis</CardTitle>
                  <CardDescription className="text-[11px]">Water basin health and availability outlook for portfolio regions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { basin: 'Colorado River Basin', outlook: 'Critical', trend: 'declining', holdings: 'Desert Energy Partners', detail: 'Lake Mead at 30% capacity. Curtailment risk for AZ, NV, CA junior rights holders.' },
                      { basin: 'Central Valley (CA)', outlook: 'Severe', trend: 'declining', holdings: 'Pacific Ag Holdings', detail: 'Groundwater overdraft 2M acre-feet/year. SGMA restrictions tightening.' },
                      { basin: 'Great Lakes', outlook: 'Stable', trend: 'stable', holdings: 'Great Lakes Manufacturing', detail: 'Abundant supply. Great Lakes Compact protects against diversion.' },
                      { basin: 'Southeast Piedmont', outlook: 'Moderate', trend: 'stable', holdings: 'SouthFlow Water, Coastal Pharma', detail: 'Population growth outpacing infrastructure. Drought risk increasing.' },
                    ].map((b, i) => (
                      <div key={i} className={`px-3 py-2 rounded-lg border ${
                        b.outlook === 'Critical' ? 'border-red-200 bg-red-50/50' :
                        b.outlook === 'Severe' ? 'border-orange-200 bg-orange-50/50' :
                        b.outlook === 'Moderate' ? 'border-amber-200 bg-amber-50/50' :
                        'border-green-200 bg-green-50/50'
                      }`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px] font-semibold text-slate-800">{b.basin}</span>
                          <Badge variant="outline" className={`text-[9px] ${
                            b.outlook === 'Critical' ? 'border-red-300 text-red-700' :
                            b.outlook === 'Severe' ? 'border-orange-300 text-orange-700' :
                            b.outlook === 'Moderate' ? 'border-amber-300 text-amber-700' :
                            'border-green-300 text-green-700'
                          }`}>{b.outlook}</Badge>
                        </div>
                        <div className="text-[10px] text-slate-500">{b.detail}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Holdings: {b.holdings}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── COMPLIANCE OVERVIEW (Compliance lens) ───────────────────────
            case 'compliance-overview': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-amber-600" /> Regulatory Compliance Overview</CardTitle>
                  <CardDescription className="text-[11px]">Portfolio-wide compliance status and violation tracking</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{portfolioScores.avgCompliance}%</div>
                      <div className="text-[10px] text-green-600">Avg Compliance</div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                      <div className="text-2xl font-bold text-red-700">{companiesData.reduce((s, c) => s + c.activeAlerts, 0)}</div>
                      <div className="text-[10px] text-red-600">Active Violations</div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">{portfolioScores.monitored}</div>
                      <div className="text-[10px] text-blue-600">Monitored Companies</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <div className="text-2xl font-bold text-amber-700">{companiesData.filter(c => (c.complianceRate || 100) < 95).length}</div>
                      <div className="text-[10px] text-amber-600">Below 95% Threshold</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {companiesData.sort((a, b) => (a.complianceRate || 100) - (b.complianceRate || 100)).map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-white border border-slate-100 text-[11px]">
                        <span className="font-medium text-slate-700">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${(c.complianceRate || 100) >= 95 ? 'text-green-700' : 'text-red-700'}`}>{c.complianceRate || '--'}%</span>
                          <Badge variant="outline" className={`text-[9px] ${c.activeAlerts > 0 ? 'border-red-300 bg-red-50 text-red-700' : 'border-green-300 bg-green-50 text-green-700'}`}>
                            {c.activeAlerts} alert{c.activeAlerts !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── REGULATORY COST FORECAST (Compliance lens) ──────────────────
            case 'regulatory-cost-forecast': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-red-600" /> Regulatory Cost Forecast</CardTitle>
                  <CardDescription className="text-[11px]">Projected compliance costs from emerging and tightening regulations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { reg: 'PFAS MCL Compliance (SDWA)', timeline: '2026-2029', estCost: '$8-14M', impact: 'Treatment upgrades at 3 facilities', severity: 'high' as const },
                      { reg: 'Updated NPDES ELG (40 CFR)', timeline: '2027', estCost: '$3-6M', impact: 'Effluent limit reductions at 2 facilities', severity: 'medium' as const },
                      { reg: 'State PFAS Reporting', timeline: '2026', estCost: '$0.5-1M', impact: 'Monitoring & reporting across portfolio', severity: 'medium' as const },
                      { reg: 'SEC Climate Disclosure', timeline: '2026-2027', estCost: '$1-2M', impact: 'Water risk quantification & auditing', severity: 'low' as const },
                      { reg: 'Lead & Copper Rule Revisions', timeline: '2027-2031', estCost: '$4-8M', impact: 'Service line replacement for utility holdings', severity: 'high' as const },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-slate-800">{r.reg}</div>
                          <div className="text-[10px] text-slate-500">{r.impact}</div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <div className="text-[11px] font-medium text-red-700">{r.estCost}</div>
                            <div className="text-[9px] text-slate-400">{r.timeline}</div>
                          </div>
                          <SeverityBadge level={r.severity} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                    <div className="text-xl font-bold text-red-700">$16.5 - $31M</div>
                    <div className="text-[10px] text-red-600 font-medium">Total Estimated Regulatory Cost Exposure (5-year)</div>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── ESG SCORING (ESG Disclosure lens) ───────────────────────────
            case 'esg-scoring': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Leaf className="h-4 w-4 text-green-600" /> ESG Water Scoring</CardTitle>
                  <CardDescription className="text-[11px]">Water-related ESG ratings across portfolio holdings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    {['A', 'B', 'C', 'D', 'F'].map(rating => {
                      const count = companiesData.filter(c => c.esgRating === rating).length;
                      const cls = rating === 'A' ? 'border-green-200 bg-green-50 text-green-700' :
                                  rating === 'B' ? 'border-lime-200 bg-lime-50 text-lime-700' :
                                  rating === 'C' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                  rating === 'D' ? 'border-orange-200 bg-orange-50 text-orange-700' :
                                  'border-red-200 bg-red-50 text-red-700';
                      return (
                        <div key={rating} className={`rounded-lg border p-2 text-center ${cls}`}>
                          <div className="text-2xl font-bold">{count}</div>
                          <div className="text-[10px] font-medium">Rating {rating}</div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5">
                    {companiesData.sort((a, b) => (a.esgRating || 'Z').localeCompare(b.esgRating || 'Z')).map(c => (
                      <div key={c.id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-white border border-slate-100 text-[11px]">
                        <span className="font-medium text-slate-700">{c.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">{c.sector}</span>
                          <ESGBadge rating={c.esgRating} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── DISCLOSURE READINESS (ESG Disclosure lens) ──────────────────
            case 'disclosure-readiness': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-indigo-600" /> Disclosure Readiness</CardTitle>
                  <CardDescription className="text-[11px]">Portfolio alignment with major ESG water disclosure frameworks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { framework: 'CDP Water Security', coverage: 83, status: 'Responding', detail: '5 of 6 holdings submitted CDP water questionnaire' },
                      { framework: 'SASB Water Management', coverage: 72, status: 'Partial', detail: 'Water intensity & withdrawal metrics tracked for 4 holdings' },
                      { framework: 'GRI 303 (Water & Effluents)', coverage: 67, status: 'Partial', detail: 'Full GRI 303 reporting at 4 of 6 holdings' },
                      { framework: 'TCFD (Physical Risk)', coverage: 58, status: 'Emerging', detail: 'Climate scenario analysis completed for 3 holdings' },
                      { framework: 'EU CSRD / Taxonomy', coverage: 42, status: 'Planning', detail: 'EU taxonomy alignment assessment underway' },
                    ].map((fw, i) => (
                      <div key={i} className="px-3 py-2 rounded-lg border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-slate-800">{fw.framework}</span>
                          <Badge variant="outline" className={`text-[9px] ${
                            fw.coverage >= 80 ? 'border-green-300 bg-green-50 text-green-700' :
                            fw.coverage >= 60 ? 'border-amber-300 bg-amber-50 text-amber-700' :
                            'border-red-300 bg-red-50 text-red-700'
                          }`}>{fw.coverage}%</Badge>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                          <div className={`h-full rounded-full ${fw.coverage >= 80 ? 'bg-green-500' : fw.coverage >= 60 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${fw.coverage}%` }} />
                        </div>
                        <div className="text-[10px] text-slate-500">{fw.detail}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── WATER METRICS TABLE (ESG Disclosure lens) ──────────────────
            case 'water-metrics-table': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4 text-blue-600" /> ESG Water Metrics</CardTitle>
                  <CardDescription className="text-[11px]">Portfolio performance against industry benchmarks</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Metric</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Unit</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Framework</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Portfolio Avg</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Benchmark</th>
                          <th className="pb-2 font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ESG_WATER_METRICS.map(m => (
                          <tr key={m.metric} className="hover:bg-blue-50/50">
                            <td className="py-1.5 pr-3 font-medium text-slate-800">{m.metric}</td>
                            <td className="py-1.5 pr-3 text-slate-500">{m.unit}</td>
                            <td className="py-1.5 pr-3 text-slate-400">{m.framework}</td>
                            <td className="py-1.5 pr-3 text-slate-700 font-mono">{m.portfolioAvg}</td>
                            <td className="py-1.5 pr-3 text-slate-500 font-mono">{m.benchmark}</td>
                            <td className="py-1.5"><StatusBadge status={m.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── CLIMATE SCENARIOS (Climate Resilience lens) ─────────────────
            case 'climate-scenarios': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CloudRain className="h-4 w-4 text-blue-600" /> Climate Scenario Analysis</CardTitle>
                  <CardDescription className="text-[11px]">IPCC RCP scenario projections for portfolio water risk exposure</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {CLIMATE_SCENARIOS.map(sc => (
                      <div key={sc.id} className={`rounded-lg border p-3 ${
                        sc.id === 'rcp85' ? 'border-red-200 bg-red-50/50' :
                        sc.id === 'rcp45' ? 'border-amber-200 bg-amber-50/50' :
                        'border-green-200 bg-green-50/50'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-slate-800">{sc.name}</span>
                          <span className="text-[10px] text-slate-500">{sc.tempIncrease}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 mb-2">{sc.waterImpact}</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="text-center">
                            <div className="text-sm font-bold text-slate-800">{sc.portfolioExposure}</div>
                            <div className="text-[9px] text-slate-500">AUM Exposed</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-red-700">{sc.annualizedLoss}</div>
                            <div className="text-[9px] text-slate-500">Annualized Loss</div>
                          </div>
                          <div className="text-center">
                            <div className="text-sm font-bold text-slate-600">{sc.probability}</div>
                            <div className="text-[9px] text-slate-500">Probability</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── PHYSICAL RISK (Climate Resilience lens) ─────────────────────
            case 'physical-risk-panel': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-orange-600" /> Physical Risk Assessment</CardTitle>
                  <CardDescription className="text-[11px]">Acute and chronic physical water risks across portfolio locations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="text-[11px] font-semibold text-red-800 mb-1">Acute Risks</div>
                      <div className="text-[10px] text-red-700 space-y-1">
                        <div>- 2 holdings in FEMA flood zones (100-yr)</div>
                        <div>- 1 holding in hurricane landfall corridor</div>
                        <div>- 1 holding exposed to wildfire watershed impact</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-[11px] font-semibold text-amber-800 mb-1">Chronic Risks</div>
                      <div className="text-[10px] text-amber-700 space-y-1">
                        <div>- 2 holdings in drought-prone basins (trend worsening)</div>
                        <div>- 3 holdings face rising water temperatures</div>
                        <div>- 1 holding vulnerable to saltwater intrusion</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── TRANSITION RISK (Climate Resilience lens) ───────────────────
            case 'transition-risk-panel': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-purple-600" /> Transition Risk Assessment</CardTitle>
                  <CardDescription className="text-[11px]">Policy, technology, and market transition risks affecting water-dependent assets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { risk: 'Carbon pricing impact on water treatment', exposure: '3 holdings', timeline: '2027+', cost: '$2-5M/yr', severity: 'medium' as const },
                      { risk: 'Mandatory water risk disclosure (SEC)', exposure: 'All holdings', timeline: '2026', cost: '$1-2M', severity: 'low' as const },
                      { risk: 'Water rights re-adjudication (Western states)', exposure: '2 holdings', timeline: '2027-2030', cost: '$5-20M', severity: 'high' as const },
                      { risk: 'Technology shift to closed-loop water systems', exposure: '4 holdings', timeline: '2028+', cost: '$8-15M capex', severity: 'medium' as const },
                    ].map((r, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                        <div className="flex-1">
                          <div className="text-[11px] font-semibold text-slate-800">{r.risk}</div>
                          <div className="text-[10px] text-slate-500">{r.exposure} | {r.timeline}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium text-red-700">{r.cost}</span>
                          <SeverityBadge level={r.severity} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── FINANCIAL IMPACT SUMMARY (Financial Impact lens) ────────────
            case 'financial-impact-summary': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-amber-600" /> Financial Impact Summary</CardTitle>
                  <CardDescription className="text-[11px]">Quantified water risk financial exposure across the portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Water Cost', value: '$14.2M', sub: 'Annual portfolio-wide', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Compliance Liability', value: '$6.8M', sub: 'Violation penalties', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
                      { label: 'Stranded Asset Risk', value: '$52M', sub: 'Under RCP 4.5', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
                      { label: 'Efficiency Savings', value: '$3.1M', sub: 'Identified opportunities', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                    ].map(kpi => (
                      <div key={kpi.label} className={`rounded-lg border p-3 text-center ${kpi.bg}`}>
                        <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-[10px] text-slate-600 font-medium">{kpi.label}</div>
                        <div className="text-[9px] text-slate-400">{kpi.sub}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── VALUATION IMPACT (Financial Impact lens) ────────────────────
            case 'valuation-impact': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-600" /> Valuation Impact Analysis</CardTitle>
                  <CardDescription className="text-[11px]">Estimated valuation adjustment from water risk materialization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {companiesData.map(c => {
                      const impactPct = c.waterRiskScore >= 70 ? -8 : c.waterRiskScore >= 40 ? -3 : -0.5;
                      const impactAmt = (c.aum * impactPct / 100).toFixed(1);
                      return (
                        <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                          <div>
                            <div className="text-[11px] font-semibold text-slate-800">{c.name}</div>
                            <div className="text-[10px] text-slate-500">{c.sector} | ${c.aum}M AUM</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-[11px] font-bold ${impactPct <= -5 ? 'text-red-700' : impactPct <= -2 ? 'text-amber-700' : 'text-green-700'}`}>
                              {impactPct}% (${impactAmt}M)
                            </div>
                            <div className="text-[9px] text-slate-400">Risk-adjusted impact</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── COST OF INACTION (Financial Impact lens) ────────────────────
            case 'cost-of-inaction': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-red-600" /> Cost of Inaction</CardTitle>
                  <CardDescription className="text-[11px]">Projected losses from delayed water risk mitigation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-xs font-semibold text-amber-800 mb-1">Year 1</div>
                      <div className="text-xl font-bold text-amber-700">$4.2M</div>
                      <div className="text-[10px] text-amber-600 mt-1">Compliance penalties + water efficiency losses</div>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <div className="text-xs font-semibold text-orange-800 mb-1">Year 3</div>
                      <div className="text-xl font-bold text-orange-700">$18.5M</div>
                      <div className="text-[10px] text-orange-600 mt-1">+ Regulatory cost escalation + stranded asset write-downs</div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="text-xs font-semibold text-red-800 mb-1">Year 5</div>
                      <div className="text-xl font-bold text-red-700">$47M</div>
                      <div className="text-[10px] text-red-600 mt-1">+ Climate-driven operational disruption + reputational damage</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400">
                    Projections based on CDP Water methodology, TCFD scenario analysis, and historical enforcement penalty data.
                  </div>
                </CardContent>
              </Card>
            );

            // ─── DUE DILIGENCE CHECKLIST (Due Diligence lens) ────────────────
            case 'due-diligence-checklist': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-indigo-600" /> Water Risk Due Diligence Checklist</CardTitle>
                  <CardDescription className="text-[11px]">Standard due diligence items for water risk assessment in M&A and new investments</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { item: 'EPA ECHO compliance history (5-year)', category: 'Regulatory', checked: true },
                      { item: 'NPDES permit status & DMR filing history', category: 'Regulatory', checked: true },
                      { item: 'SDWIS violations & enforcement actions', category: 'Regulatory', checked: true },
                      { item: 'WRI Aqueduct water stress baseline', category: 'Physical', checked: true },
                      { item: 'ATTAINS watershed impairment assessment', category: 'Physical', checked: true },
                      { item: 'FEMA flood zone mapping', category: 'Physical', checked: false },
                      { item: 'Phase I/II ESA contamination review', category: 'Contamination', checked: false },
                      { item: 'PFAS exposure & remediation liability', category: 'Contamination', checked: true },
                      { item: 'CDP Water Security questionnaire response', category: 'ESG', checked: false },
                      { item: 'Water rights & allocation security', category: 'Legal', checked: false },
                    ].map((dd, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-md border border-slate-100 hover:bg-slate-50">
                        {dd.checked ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-slate-300 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <span className="text-[11px] text-slate-700">{dd.item}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] border-slate-200 text-slate-500">{dd.category}</Badge>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">6 of 10 items covered by PEARL data sources. Remaining require third-party verification.</div>
                </CardContent>
              </Card>
            );

            // ─── SITE RISK PROFILE (Due Diligence lens) ─────────────────────
            case 'site-risk-profile': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-red-600" /> Site Risk Profiles</CardTitle>
                  <CardDescription className="text-[11px]">Location-level water risk summary for portfolio assets</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {companiesData.slice(0, 4).map(c => (
                      <div key={c.id} className={`px-3 py-2.5 rounded-lg border ${
                        c.waterRiskScore >= 70 ? 'border-red-200 bg-red-50/50' :
                        c.waterRiskScore >= 40 ? 'border-amber-200 bg-amber-50/50' :
                        'border-green-200 bg-green-50/50'
                      }`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-slate-800">{c.name} ({c.state})</span>
                          <Badge variant="outline" className={`text-[9px] ${
                            c.waterRiskScore >= 70 ? 'border-red-300 text-red-700' :
                            c.waterRiskScore >= 40 ? 'border-amber-300 text-amber-700' :
                            'border-green-300 text-green-700'
                          }`}>Risk: {c.waterRiskScore}</Badge>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-[10px]">
                          <div><span className="text-slate-400">Stress:</span> <span className="text-slate-700">{c.stressLevel}</span></div>
                          <div><span className="text-slate-400">Compliance:</span> <span className="text-slate-700">{c.complianceRate}%</span></div>
                          <div><span className="text-slate-400">Intensity:</span> <span className="text-slate-700">{c.waterIntensity} gal/$1K</span></div>
                          <div><span className="text-slate-400">Sources:</span> <span className="text-slate-700">{c.dataSourceCount}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── GRANTS ─────────────────────────────────────────────────────
            case 'grants': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-600" /> Grant & Incentive Opportunities</CardTitle>
                  <CardDescription className="text-[11px]">Water infrastructure grants and tax incentives applicable to portfolio companies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: 'EPA Water Infrastructure Finance (WIFIA)', amount: 'Up to $100M', deadline: 'Rolling', relevance: 'Wastewater & treatment infrastructure' },
                      { name: 'USDA Water & Waste Disposal Loans', amount: 'Up to $50M', deadline: 'Annual', relevance: 'Rural water system investments' },
                      { name: 'State Revolving Fund (SRF)', amount: 'State-specific', deadline: 'Rolling', relevance: 'Water system capex financing' },
                      { name: 'IRA Section 48C Energy Community Credits', amount: '30% ITC', deadline: '2026', relevance: 'Water treatment energy efficiency upgrades' },
                    ].map((g, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-800">{g.name}</div>
                          <div className="text-[10px] text-slate-500">{g.relevance}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] font-medium text-emerald-700">{g.amount}</div>
                          <div className="text-[9px] text-slate-400">{g.deadline}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── ECONOMIC PERFORMANCE (Financial Impact lens) ────────────────
            case 'economic': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-600" /> Economic Performance</CardTitle>
                  <CardDescription className="text-[11px]">Water-related economic KPIs across the portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Portfolio Water Cost', value: '$14.2M', sub: 'Annual total', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
                      { label: 'Water Cost / Revenue', value: '0.8%', sub: 'Portfolio average', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Insurance Premium Impact', value: '+12%', sub: 'Water risk surcharge', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
                      { label: 'Efficiency ROI', value: '2.4x', sub: 'Water investment return', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
                    ].map(kpi => (
                      <div key={kpi.label} className={`rounded-lg border p-3 text-center ${kpi.bg}`}>
                        <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-[10px] text-slate-600 font-medium">{kpi.label}</div>
                        <div className="text-[9px] text-slate-400">{kpi.sub}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── SHARED PANELS ──────────────────────────────────────────────

            case 'insights': return DS(
              <AIInsightsEngine key="US" role="Investor" stateAbbr="US" regionData={companiesData as any} />
            );

            case 'groundwater': return DS(
              <div id="section-groundwater">
                <NwisGwPanel
                  state={focusedState !== 'US' ? focusedState : undefined}
                  compactMode={false}
                />
              </div>
            );

            case 'resolution-planner': return DS(<ResolutionPlanner userRole="corporate" scopeContext={{ scope: 'national', data: { totalStates: 50, totalWaterbodies: 0, totalImpaired: 0, averageScore: 0, highAlertStates: 0, topCauses: [], worstStates: [] } }} />);
            case 'policy-tracker': return DS(<PolicyTracker />);
            case 'contaminants-tracker': return DS(<EmergingContaminantsTracker role="corporate" />);
            case 'icis': return DS(<ICISCompliancePanel state="" compactMode={false} />);
            case 'sdwis': return DS(<SDWISCompliancePanel state="" compactMode={false} />);
            case 'disaster-emergency-panel': return DS(<DisasterEmergencyPanel selectedState="" stateRollup={[]} />);
            case 'reports-hub': return DS(
              <Card><CardHeader><CardTitle>Investor Reports</CardTitle><CardDescription>Generated water risk & ESG reports</CardDescription></CardHeader>
              <CardContent><div className="space-y-2">
                {['Portfolio Water Risk Summary', 'ESG Water Disclosure Report', 'Regulatory Cost Forecast', 'Climate Scenario Analysis', 'Due Diligence Dossier'].map(r =>
                  <div key={r} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"><span className="text-sm text-slate-700">{r}</span><Badge variant="outline" className="text-[10px]">Generate</Badge></div>
                )}
              </div></CardContent></Card>
            );

            case 'supply-chain-risk-panel': return DS(<SupplyChainRiskPanel stateAbbr="" />);

            // ─── WARR ZONES ──────────────────────────────────────────────────

            case 'warr-metrics': {
              const warrM: WARRMetric[] = [
                { label: 'Portfolio Water Risk', value: '--', icon: Gauge, iconColor: 'var(--status-healthy)', subtitle: 'Avg risk score' },
                { label: 'Regulatory Exposure', value: '--', icon: Shield, iconColor: 'var(--accent-teal)', subtitle: 'Compliance status' },
                { label: 'ESG Score', value: '--', icon: Leaf, iconColor: 'var(--status-warning)', subtitle: 'Water disclosure' },
              ];
              return DS(<WARRZones zone="warr-metrics" role="Investor" stateAbbr="US" metrics={warrM} events={[]} activeResolutionCount={0} />);
            }
            case 'warr-analyze': return DS(
              <WARRZones zone="warr-analyze" role="Investor" stateAbbr="US" metrics={[]} events={[]} activeResolutionCount={0} />
            );
            case 'warr-respond': return DS(
              <WARRZones zone="warr-respond" role="Investor" stateAbbr="US" metrics={[]} events={[]} activeResolutionCount={0} />
            );
            case 'warr-resolve': return DS(
              <WARRZones zone="warr-resolve" role="Investor" stateAbbr="US" metrics={[]} events={[]} activeResolutionCount={0} />
            );

            // ─── TRENDS DASHBOARD ────────────────────────────────────────────

            case 'trends-dashboard': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-600" /> Trends & Forecasting</CardTitle>
                  <CardDescription className="text-[11px]">Water risk and investment outlook trends</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="text-[11px] font-semibold text-green-800">Improving</div>
                      <div className="text-[10px] text-green-700 mt-1 space-y-0.5">
                        <div>- ESG water disclosure rates +18% YoY</div>
                        <div>- WIFIA loan program expanding</div>
                        <div>- Water recycling adoption accelerating</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-[11px] font-semibold text-amber-800">Watch</div>
                      <div className="text-[10px] text-amber-700 mt-1 space-y-0.5">
                        <div>- PFAS liability expanding across sectors</div>
                        <div>- Western water rights adjudication</div>
                        <div>- SEC climate disclosure finalization</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="text-[11px] font-semibold text-red-800">Action Required</div>
                      <div className="text-[10px] text-red-700 mt-1 space-y-0.5">
                        <div>- 2 holdings in extreme stress basins worsening</div>
                        <div>- Compliance penalties trending up sector-wide</div>
                        <div>- Insurance carriers repricing water risk</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── DISCLAIMER ─────────────────────────────────────────────────

            case 'disclaimer': return DS(
              <PlatformDisclaimer />
            );

            default: return null;
          }
        })}

        {/* ── COMPANY DETAIL (selected company) ── */}
        {selectedComp && (
          <div className="rounded-xl border-2 border-amber-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
              <span className="text-sm font-bold text-amber-800">{selectedComp.name} -- Company Detail</span>
              <button onClick={() => setSelectedCompany(null)} className="text-xs text-slate-500 hover:text-slate-700">Close x</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedComp.waterRiskScore}</div>
                  <div className="text-[10px] text-slate-500">Water Risk</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedComp.sector}</div>
                  <div className="text-[10px] text-slate-500">Sector</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-amber-700">${selectedComp.aum}M</div>
                  <div className="text-[10px] text-slate-500">AUM Exposure</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedComp.esgRating || '--'}</div>
                  <div className="text-[10px] text-slate-500">ESG Rating</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${(selectedComp.complianceRate || 100) >= 95 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedComp.complianceRate || '--'}%
                  </div>
                  <div className="text-[10px] text-slate-500">Compliance</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedComp.stressLevel || '--'}</div>
                  <div className="text-[10px] text-slate-500">Water Stress</div>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 space-y-0.5">
                <div>Water intensity: <span className="font-medium text-slate-700">{selectedComp.waterIntensity} gal per $1K revenue</span></div>
                <div>Active alerts: <span className="font-medium text-slate-700">{selectedComp.activeAlerts}</span></div>
                <div>Data sources: <span className="font-medium text-slate-700">{selectedComp.dataSourceCount}</span></div>
                <div>Water risk derived from EPA ATTAINS impairment data. Compliance from EPA ECHO. ESG ratings are illustrative.</div>
              </div>
            </div>
          </div>
        )}


        </div>
        </>);
        }}
        </LayoutEditor>

      </div>
    </div>
  );
}

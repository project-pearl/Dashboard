// components/BiotechManagementCenter.tsx
// Biotech / Pharma Management Center — process water purity, pharmaceutical effluent,
// dual FDA/EPA compliance, and API contaminant tracking.
// Architecture: 9-lens system + biotech-specific sections + shared compliance panels

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
  CheckCircle2, Circle, AlertCircle, Sparkles, ClipboardList, Link2, FlaskConical, Package,
  ShieldCheck, Factory, Waves, Pill, TestTubes, Syringe
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
import { WaterStewardshipPanel } from '@/components/WaterStewardshipPanel';
import { FacilityOperationsPanel } from '@/components/FacilityOperationsPanel';
import { SupplyChainRiskPanel } from '@/components/SupplyChainRiskPanel';
import { WARRZones } from './WARRZones';
import type { WARRMetric } from './WARRZones';
import { LayoutEditor } from './LayoutEditor';
import { DraggableSection } from './DraggableSection';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertLevel = 'high' | 'medium' | 'low' | 'none';

type FacilityRow = {
  id: string;
  name: string;
  state: string;
  type: 'manufacturing' | 'rnd' | 'formulation' | 'warehouse' | 'office' | 'other';
  alertLevel: AlertLevel;
  activeAlerts: number;
  lastUpdatedISO: string;
  status: 'monitored' | 'assessed' | 'unmonitored';
  dataSourceCount: number;
  waterRiskScore: number;
  attainsId?: string;
  lat?: number;
  lon?: number;
  gallonsTreated?: number;
  tnReduced?: number;
  tpReduced?: number;
  tssReduced?: number;
  tssEfficiency?: number;
  receivingWaterbody?: string;
  huc12?: string;
  ejScore?: number;
  // Biotech-specific
  uspGrade?: 'Purified' | 'WFI' | 'Highly Purified' | 'Clean Steam';
  gmpCompliant?: boolean;
  fdaInspectionDate?: string;
  npdespermit?: string;
};

// ─── Lenses (9-view architecture) ──────────────────────────────────────────

type ViewLens = 'overview' | 'process-water' | 'discharge-effluent' | 'compliance' |
  'contaminants' | 'facility-operations' | 'gmp-quality' | 'supply-chain' | 'trends';

type LensConfig = {
  label: string;
  description: string;
  icon: any;
  sections: Set<string>;
};

const LENS_CONFIG: Record<ViewLens, LensConfig> = {
  overview: {
    label: 'Executive Overview', description: 'Portfolio-level Biotech/Pharma summary for leadership',
    icon: Building2,
    sections: new Set(['summary', 'kpis', 'map-grid', 'gmp-status', 'grants', 'disclaimer']),
  },
  'process-water': {
    label: 'Process Water Quality', description: 'USP water grades, purification KPIs, and process water monitoring',
    icon: Droplets,
    sections: new Set(['usp-water-specs', 'purified-water-kpis', 'process-water-alerts', 'sdwis', 'groundwater', 'disclaimer']),
  },
  'discharge-effluent': {
    label: 'Discharge & Effluent', description: 'Pharmaceutical effluent discharge and NPDES compliance',
    icon: Waves,
    sections: new Set(['discharge-overview', 'effluent-limits', 'api-discharge', 'icis', 'map-grid', 'disclaimer']),
  },
  compliance: {
    label: 'Regulatory Compliance', description: 'Dual FDA/EPA regulatory compliance and permit management',
    icon: Shield,
    sections: new Set(['compliance-overview', 'permit-status', 'fda-epa-matrix', 'icis', 'sdwis', 'warr-metrics', 'warr-analyze', 'warr-respond', 'warr-resolve', 'disclaimer']),
  },
  contaminants: {
    label: 'Pharma Contaminants', description: 'API contaminant tracking and PFAS in manufacturing',
    icon: AlertTriangle,
    sections: new Set(['contaminants-tracker', 'api-tracking', 'pfas-manufacturing', 'disclaimer']),
  },
  'facility-operations': {
    label: 'Facility Operations', description: 'Facility-level water operations, map, and stewardship',
    icon: Factory,
    sections: new Set(['facility-operations-panel', 'map-grid', 'kpis', 'water-stewardship-panel', 'disclaimer']),
  },
  'gmp-quality': {
    label: 'GMP & Quality Systems', description: 'Good manufacturing practice frameworks and quality systems',
    icon: ClipboardList,
    sections: new Set(['gmp-frameworks', 'usp-validation', 'quality-audit-log', 'batch-water-tracking', 'disclaimer']),
  },
  'supply-chain': {
    label: 'Supply Chain & Risk', description: 'Supply chain water risk and economic analysis',
    icon: Link2,
    sections: new Set(['supply-chain-risk-panel', 'economic', 'disclaimer']),
  },
  trends: {
    label: 'Trends & Outlook', description: 'Water risk trajectories, AI insights, disaster response, and resolution planning',
    icon: TrendingUp,
    sections: new Set(['trends-dashboard', 'insights', 'disaster-emergency-panel', 'resolution-planner', 'policy-tracker', 'disclaimer']),
  },
};

// ─── Overlay types for map ───────────────────────────────────────────────────

type OverlayId = 'waterrisk' | 'compliance' | 'gmp';

const OVERLAYS: { id: OverlayId; label: string; description: string; icon: any }[] = [
  { id: 'waterrisk', label: 'Water Risk', description: 'Facility water stress exposure from ATTAINS & WRI Aqueduct', icon: Droplets },
  { id: 'compliance', label: 'Compliance Status', description: 'EPA ECHO violations & NPDES permit status', icon: Shield },
  { id: 'gmp', label: 'GMP Status', description: 'FDA cGMP compliance and inspection readiness', icon: ClipboardList },
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
  // gmp overlay
  if (f.gmpCompliant === true) return '#22c55e';
  if (f.gmpCompliant === false) return '#ef4444';
  return '#9ca3af';
}

// ─── GMP Frameworks ─────────────────────────────────────────────────────────

interface GMPFramework {
  id: string;
  name: string;
  authority: string;
  authorityBadge: string;
  coverage: number;
  requirements: string[];
}

const GMP_FRAMEWORKS: GMPFramework[] = [
  {
    id: 'fda-cgmp', name: 'FDA cGMP (21 CFR 211)', authority: 'FDA',
    authorityBadge: 'bg-blue-100 text-blue-800',
    coverage: 92,
    requirements: ['Process water quality (USP specs)', 'Equipment cleaning validation', 'Environmental monitoring', 'Water system qualification (IQ/OQ/PQ)'],
  },
  {
    id: 'epa-npdes', name: 'EPA NPDES Permit Program', authority: 'EPA',
    authorityBadge: 'bg-green-100 text-green-800',
    coverage: 88,
    requirements: ['Effluent limitation guidelines (40 CFR 439)', 'Discharge monitoring reports (DMRs)', 'Stormwater pollution prevention (SWPPP)', 'Pretreatment standards'],
  },
  {
    id: 'epa-rcra', name: 'EPA RCRA (Hazardous Waste)', authority: 'EPA',
    authorityBadge: 'bg-green-100 text-green-800',
    coverage: 85,
    requirements: ['Solvent waste characterization', 'Wastewater treatment residuals', 'Container management', 'Land disposal restrictions (LDR)'],
  },
  {
    id: 'ich-q7', name: 'ICH Q7 (API Manufacturing)', authority: 'ICH',
    authorityBadge: 'bg-purple-100 text-purple-800',
    coverage: 78,
    requirements: ['API intermediate water quality', 'Process water specifications', 'Cleaning validation for API contact', 'Environmental controls for API areas'],
  },
  {
    id: 'who-gmp', name: 'WHO GMP (Annex 2)', authority: 'WHO',
    authorityBadge: 'bg-cyan-100 text-cyan-800',
    coverage: 72,
    requirements: ['Water purification system design', 'Microbiological monitoring', 'Chemical quality specifications', 'Distribution system maintenance'],
  },
  {
    id: 'ema-note', name: 'EMA Note for Guidance on Water', authority: 'EMA',
    authorityBadge: 'bg-amber-100 text-amber-800',
    coverage: 65,
    requirements: ['Water quality for pharma use', 'Generation and storage systems', 'Monitoring and alert/action limits', 'Qualification and validation'],
  },
];

// ─── USP Water Grades ───────────────────────────────────────────────────────

interface USPWaterGrade {
  grade: string;
  conductivity: string;
  toc: string;
  microbial: string;
  endotoxin: string;
  applications: string[];
}

const USP_WATER_GRADES: USPWaterGrade[] = [
  {
    grade: 'Purified Water (USP)', conductivity: '<= 1.3 uS/cm @ 25C', toc: '<= 500 ppb',
    microbial: '<= 100 CFU/mL', endotoxin: 'Not specified',
    applications: ['Cleaning of equipment', 'Formulation of non-parenteral products', 'Reagent preparation', 'General lab use'],
  },
  {
    grade: 'Water for Injection (WFI)', conductivity: '<= 1.3 uS/cm @ 25C', toc: '<= 500 ppb',
    microbial: '<= 10 CFU/100 mL', endotoxin: '<= 0.25 EU/mL',
    applications: ['Parenteral product formulation', 'Final rinse of parenteral containers', 'API synthesis requiring WFI', 'Biological product manufacturing'],
  },
  {
    grade: 'Highly Purified Water (EP)', conductivity: '<= 1.1 uS/cm @ 20C', toc: '<= 500 ppb',
    microbial: '<= 10 CFU/100 mL', endotoxin: '<= 0.25 EU/mL',
    applications: ['European Pharmacopoeia compliance', 'Non-parenteral dosage forms requiring high purity', 'Cleaning of product-contact surfaces'],
  },
  {
    grade: 'Clean Steam', conductivity: '<= 1.3 uS/cm (condensate)', toc: '<= 500 ppb (condensate)',
    microbial: 'Sterile (post-use)', endotoxin: '<= 0.25 EU/mL (condensate)',
    applications: ['Autoclave sterilization', 'SIP (sterilize-in-place) systems', 'Humidification of clean areas', 'Direct product contact sterilization'],
  },
];

// ─── Pharma Effluent Parameters (40 CFR 439 ELG) ───────────────────────────

interface EffluentParam {
  parameter: string;
  dailyMax: string;
  monthlyAvg: string;
  unit: string;
  cfr439Ref: string;
  concern: 'high' | 'medium' | 'low';
}

const PHARMA_EFFLUENT_PARAMS: EffluentParam[] = [
  { parameter: 'BOD5', dailyMax: '237', monthlyAvg: '110', unit: 'mg/L', cfr439Ref: 'Subpart A', concern: 'medium' },
  { parameter: 'TSS', dailyMax: '325', monthlyAvg: '168', unit: 'mg/L', cfr439Ref: 'Subpart A', concern: 'medium' },
  { parameter: 'COD', dailyMax: '856', monthlyAvg: '504', unit: 'mg/L', cfr439Ref: 'Subpart A', concern: 'medium' },
  { parameter: 'pH', dailyMax: '6.0-9.0', monthlyAvg: '6.0-9.0', unit: 'SU', cfr439Ref: 'Subpart A', concern: 'low' },
  { parameter: 'Cyanide (Total)', dailyMax: '33.5', monthlyAvg: '9.4', unit: 'ug/L', cfr439Ref: 'Subpart C', concern: 'high' },
  { parameter: 'Acetonitrile', dailyMax: '5.00', monthlyAvg: '2.52', unit: 'mg/L', cfr439Ref: 'Subpart D', concern: 'medium' },
  { parameter: 'Methanol', dailyMax: '5.54', monthlyAvg: '2.52', unit: 'mg/L', cfr439Ref: 'Subpart D', concern: 'medium' },
  { parameter: 'APIs (active pharma ingredients)', dailyMax: 'Site-specific', monthlyAvg: 'Site-specific', unit: 'ug/L', cfr439Ref: 'Monitoring', concern: 'high' },
  { parameter: 'PFAS (total)', dailyMax: 'Emerging', monthlyAvg: 'Emerging', unit: 'ng/L', cfr439Ref: 'Draft guidance', concern: 'high' },
  { parameter: 'Ammonia-N', dailyMax: '34.7', monthlyAvg: '19.1', unit: 'mg/L', cfr439Ref: 'Subpart A', concern: 'medium' },
];

// ─── FDA/EPA Dual-Regulatory Crosswalk ──────────────────────────────────────

interface RegulatoryRow {
  area: string;
  fdaRequirement: string;
  epaRequirement: string;
  overlap: 'high' | 'moderate' | 'low';
  pearlCoverage: 'full' | 'partial' | 'planned';
}

const FDA_EPA_MATRIX: RegulatoryRow[] = [
  { area: 'Process Water', fdaRequirement: 'USP <1231> Water for Pharma Purposes', epaRequirement: 'Source water protection (SDWA)', overlap: 'moderate', pearlCoverage: 'full' },
  { area: 'Wastewater Discharge', fdaRequirement: 'Cleaning validation (residual limits)', epaRequirement: 'NPDES permit / 40 CFR 439 ELGs', overlap: 'high', pearlCoverage: 'full' },
  { area: 'Solvent Recovery', fdaRequirement: 'ICH Q3D elemental impurities', epaRequirement: 'RCRA hazardous waste (40 CFR 261)', overlap: 'moderate', pearlCoverage: 'partial' },
  { area: 'API Impact', fdaRequirement: 'Product quality / cross-contamination', epaRequirement: 'Emerging contaminant monitoring', overlap: 'high', pearlCoverage: 'full' },
  { area: 'Stormwater', fdaRequirement: 'Facility GMP exterior controls', epaRequirement: 'SWPPP / MSGP industrial stormwater', overlap: 'low', pearlCoverage: 'partial' },
  { area: 'Air Emissions', fdaRequirement: 'Solvent vapor controls (GMP)', epaRequirement: 'CAA / NESHAP pharma MACT', overlap: 'low', pearlCoverage: 'planned' },
  { area: 'Bioburden', fdaRequirement: 'USP <61>/<62> microbial limits', epaRequirement: 'Pathogen discharge limits (fecal coliform)', overlap: 'moderate', pearlCoverage: 'partial' },
  { area: 'Emergency Response', fdaRequirement: 'Drug shortage notification (FDCA 506C)', epaRequirement: 'EPCRA / TRI reporting', overlap: 'moderate', pearlCoverage: 'full' },
];

// ─── Demo Facilities ────────────────────────────────────────────────────────

const DEMO_FACILITIES: FacilityRow[] = [
  {
    id: 'bt_rtp_main', name: 'RTP Biologics Campus', state: 'NC', type: 'manufacturing', alertLevel: 'low' as AlertLevel,
    activeAlerts: 1, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 5, waterRiskScore: 32,
    lat: 35.899, lon: -78.863, gallonsTreated: 890000, tnReduced: 62.4, tpReduced: 14.2, tssReduced: 2180, tssEfficiency: 94,
    receivingWaterbody: 'Northeast Creek', huc12: '030202010101', ejScore: 22,
    uspGrade: 'WFI', gmpCompliant: true, fdaInspectionDate: '2025-09-15', npdespermit: 'NC0089234',
  },
  {
    id: 'bt_nj_api', name: 'NJ API Synthesis Plant', state: 'NJ', type: 'manufacturing', alertLevel: 'high' as AlertLevel,
    activeAlerts: 4, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 6, waterRiskScore: 74,
    lat: 40.514, lon: -74.363, gallonsTreated: 1450000, tnReduced: 198.6, tpReduced: 42.8, tssReduced: 5240, tssEfficiency: 87,
    receivingWaterbody: 'Raritan River', huc12: '020401050301', ejScore: 68,
    uspGrade: 'Purified', gmpCompliant: true, fdaInspectionDate: '2025-11-02', npdespermit: 'NJ0112876',
  },
  {
    id: 'bt_ca_bio', name: 'San Diego Bioprocess Center', state: 'CA', type: 'manufacturing', alertLevel: 'medium' as AlertLevel,
    activeAlerts: 2, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 4, waterRiskScore: 58,
    lat: 32.884, lon: -117.224, gallonsTreated: 620000, tnReduced: 44.8, tpReduced: 11.6, tssReduced: 1680, tssEfficiency: 91,
    receivingWaterbody: 'Los Penasquitos Creek', ejScore: 35,
    uspGrade: 'WFI', gmpCompliant: true, fdaInspectionDate: '2025-06-20', npdespermit: 'CA0198765',
  },
  {
    id: 'bt_ma_rd', name: 'Cambridge R&D Lab', state: 'MA', type: 'rnd', alertLevel: 'none' as AlertLevel,
    activeAlerts: 0, lastUpdatedISO: new Date().toISOString(), status: 'assessed', dataSourceCount: 2, waterRiskScore: 18,
    lat: 42.363, lon: -71.092, gallonsTreated: 45000, tnReduced: 3.2, tpReduced: 0.8, tssReduced: 120, tssEfficiency: 96,
    receivingWaterbody: 'Charles River', ejScore: 41,
    uspGrade: 'Purified', gmpCompliant: true, fdaInspectionDate: '2024-12-10',
  },
  {
    id: 'bt_in_form', name: 'Indianapolis Formulation', state: 'IN', type: 'formulation', alertLevel: 'medium' as AlertLevel,
    activeAlerts: 3, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 5, waterRiskScore: 52,
    lat: 39.791, lon: -86.148, gallonsTreated: 780000, tnReduced: 86.2, tpReduced: 22.4, tssReduced: 2840, tssEfficiency: 89,
    receivingWaterbody: 'White River', huc12: '051202011101', ejScore: 55,
    uspGrade: 'Highly Purified', gmpCompliant: false, fdaInspectionDate: '2025-03-08', npdespermit: 'IN0054321',
  },
  {
    id: 'bt_pr_sterile', name: 'Juncos Sterile Fill', state: 'PR', type: 'manufacturing', alertLevel: 'low' as AlertLevel,
    activeAlerts: 1, lastUpdatedISO: new Date().toISOString(), status: 'monitored', dataSourceCount: 4, waterRiskScore: 38,
    lat: 18.228, lon: -65.921, gallonsTreated: 340000, tnReduced: 28.6, tpReduced: 7.2, tssReduced: 980, tssEfficiency: 93,
    receivingWaterbody: 'Rio Valenciano', ejScore: 48,
    uspGrade: 'WFI', gmpCompliant: true, fdaInspectionDate: '2025-07-28', npdespermit: 'PR0076543',
  },
];

// ─── State GEO (reuse from shared maps) ─────────────────────────────────────

const STATE_NAMES = _SN;
const DEFAULT_CENTER: [number, number] = [38.5, -96.0];
const DEFAULT_ZOOM = 4;

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  companyName?: string;
  facilities?: FacilityRow[];
  onBack?: () => void;
  onToggleDevMode?: () => void;
};

// ─── Main Component ──────────────────────────────────────────────────────────

export function BiotechManagementCenter({ companyName = 'PEARL Biotech Portfolio', facilities: propFacilities, onBack, onToggleDevMode }: Props) {
  const { user, logout } = useAuth();
  const router = useRouter();

  // ── View Lens ──
  const [viewLens, setViewLens] = useLensParam<ViewLens>('overview');
  const lens = LENS_CONFIG[viewLens] ?? LENS_CONFIG['overview'];

  // ── Map state ──
  const [overlay, setOverlay] = useState<OverlayId>('waterrisk');
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [hoveredFacility, setHoveredFacility] = useState<string | null>(null);
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
    if (feat?.properties?.id) setHoveredFacility(feat.properties.id as string);
    else setHoveredFacility(null);
  }, []);
  const onMapMouseLeave = useCallback(() => {
    setHoveredFeature(null);
    setHoveredFacility(null);
  }, []);
  const onMapClick = useCallback((e: mapboxgl.MapLayerMouseEvent) => {
    const feat = e.features?.[0];
    if (feat?.properties?.id) {
      setSelectedFacility(prev => prev === feat.properties!.id ? null : feat.properties!.id as string);
    }
  }, []);

  // ── Expanded section state ──
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggleSection = (id: string) => setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));

  // ── Demo facilities ──
  const facilitiesData: FacilityRow[] = useMemo(() => {
    if (propFacilities && propFacilities.length > 0) return propFacilities;
    return DEMO_FACILITIES;
  }, [propFacilities]);

  // ── Waterbody markers for focused state ──
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
      const alertLevel: AlertLevel = sources.length >= 3 ? 'high' : sources.length >= 2 ? 'medium' : sources.length >= 1 ? 'low' : 'none';
      markers.push({ id, name: (meta as any).name || id, lat, lon, alertLevel, status: sources.length > 0 ? 'assessed' : 'unmonitored', dataSourceCount: sources.length });
    }
    return markers;
  }, [focusedState]);

  // ── Mapbox marker data (facilities) ──
  const facilityMarkerData = useMemo(() =>
    facilitiesData.filter(f => f.lat && f.lon).map(f => ({
      id: f.id,
      lat: f.lat!,
      lon: f.lon!,
      color: getMarkerColor(overlay, f),
      name: f.name,
      waterRiskScore: f.waterRiskScore,
      tssEfficiency: f.tssEfficiency,
      status: f.status,
    })),
    [facilitiesData, overlay]
  );

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
    const totalGallons = facilitiesData.reduce((s, f) => s + (f.gallonsTreated || 0), 0);
    const totalTN = facilitiesData.reduce((s, f) => s + (f.tnReduced || 0), 0);
    const totalTP = facilitiesData.reduce((s, f) => s + (f.tpReduced || 0), 0);
    const totalTSS = facilitiesData.reduce((s, f) => s + (f.tssReduced || 0), 0);
    const monitoredWithEff = facilitiesData.filter(f => f.tssEfficiency && f.tssEfficiency > 0);
    const avgTSSEff = monitoredWithEff.length > 0 ? Math.round(monitoredWithEff.reduce((s, f) => s + (f.tssEfficiency || 0), 0) / monitoredWithEff.length) : 0;
    const gmpCompliantCount = facilitiesData.filter(f => f.gmpCompliant === true).length;
    const wfiCount = facilitiesData.filter(f => f.uspGrade === 'WFI').length;
    const ejHighCount = facilitiesData.filter(f => (f.ejScore || 0) >= 60).length;
    return { total, highRisk, medRisk, lowRisk, monitored, avgRisk, totalGallons, totalTN, totalTP, totalTSS, avgTSSEff, gmpCompliantCount, wfiCount, ejHighCount };
  }, [facilitiesData]);

  // ── Selected facility detail ──
  const selectedFac = facilitiesData.find(f => f.id === selectedFacility) || null;

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
  const exportBiotechReport = async () => {
    try {
      const pdf = new BrandedPDFGenerator('portrait');
      await pdf.loadLogo();
      pdf.initialize();
      const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      pdf.addTitle('Biotech / Pharma Water Intelligence Report');
      pdf.addText(clean(companyName), { bold: true, fontSize: 14 });
      pdf.addText(clean(`Generated ${dateStr}`), { fontSize: 9 });
      pdf.addSpacer(5);

      pdf.addSubtitle('Executive Summary');
      pdf.addDivider();
      pdf.addText(clean(`Portfolio: ${portfolioScores.total} facilities | ${portfolioScores.monitored} PIN-verified | ${portfolioScores.gmpCompliantCount} GMP compliant`), { bold: true });
      pdf.addText(clean(`Water Risk: ${portfolioScores.highRisk} high | ${portfolioScores.medRisk} medium | ${portfolioScores.lowRisk} low`), { indent: 5 });
      pdf.addText(clean(`WFI-capable facilities: ${portfolioScores.wfiCount} of ${portfolioScores.total}`), { indent: 5 });
      pdf.addSpacer(3);

      pdf.addSubtitle('GMP Framework Coverage');
      pdf.addDivider();
      pdf.addTable(
        ['Framework', 'Authority', 'Coverage'],
        GMP_FRAMEWORKS.map(fw => [clean(fw.name), fw.authority, `${fw.coverage}%`])
      );
      pdf.addSpacer(3);

      pdf.addSubtitle('Effluent Parameters (40 CFR 439)');
      pdf.addDivider();
      pdf.addTable(
        ['Parameter', 'Daily Max', 'Monthly Avg', 'Unit'],
        PHARMA_EFFLUENT_PARAMS.map(p => [p.parameter, p.dailyMax, p.monthlyAvg, p.unit])
      );
      pdf.addSpacer(3);

      pdf.addSubtitle('Facility Summary');
      pdf.addDivider();
      pdf.addTable(
        ['Facility', 'State', 'USP Grade', 'GMP', 'Risk', 'Status'],
        facilitiesData.map(f => [
          clean(f.name), f.state, f.uspGrade || '--',
          f.gmpCompliant ? 'Yes' : f.gmpCompliant === false ? 'No' : '--',
          String(f.waterRiskScore),
          f.status === 'monitored' ? 'Verified' : f.status === 'assessed' ? 'Assessed' : 'Pending',
        ])
      );

      pdf.addSpacer(5);
      pdf.addDivider();
      pdf.addText('DISCLAIMER', { bold: true, fontSize: 8 });
      pdf.addText(clean('This report is generated for informational purposes only. Data from EPA ECHO, SDWIS, ATTAINS, and USGS. FDA compliance status is illustrative and must be verified against official FDA records.'), { fontSize: 8 });

      const safeName = companyName.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
      pdf.download(`PEARL_Biotech_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error('Biotech PDF export failed:', err);
      alert('PDF export failed. Please try again.');
    }
  };

  // ─── Helper: concern badge ────────────────────────────────────────────────

  const ConcernBadge = ({ level }: { level: 'high' | 'medium' | 'low' }) => (
    <Badge variant="outline" className={`text-[9px] ${
      level === 'high' ? 'border-red-300 bg-red-50 text-red-700' :
      level === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-700' :
      'border-green-300 bg-green-50 text-green-700'
    }`}>{level}</Badge>
  );

  const OverlapBadge = ({ level }: { level: 'high' | 'moderate' | 'low' }) => (
    <Badge variant="outline" className={`text-[9px] ${
      level === 'high' ? 'border-purple-300 bg-purple-50 text-purple-700' :
      level === 'moderate' ? 'border-blue-300 bg-blue-50 text-blue-700' :
      'border-slate-300 bg-slate-50 text-slate-700'
    }`}>{level}</Badge>
  );

  const CoverageBadge = ({ level }: { level: 'full' | 'partial' | 'planned' }) => (
    <Badge variant="outline" className={`text-[9px] ${
      level === 'full' ? 'border-green-300 bg-green-50 text-green-700' :
      level === 'partial' ? 'border-amber-300 bg-amber-50 text-amber-700' :
      'border-slate-300 bg-slate-50 text-slate-700'
    }`}>{level === 'full' ? 'PIN Full' : level === 'partial' ? 'PIN Partial' : 'Planned'}</Badge>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      <div className="max-w-[1600px] mx-auto p-4 space-y-4">

        {/* ── HERO BANNER ── */}
        <HeroBanner role="biotech" onDoubleClick={() => onToggleDevMode?.()} />

        {/* ── TOOLBAR STRIP ── */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 rounded-lg shadow-sm">
          <select
            value={focusedState}
            onChange={(e) => {
              const st = e.target.value;
              setFocusedState(st);
              setSelectedFacility(null);
              const geo = STATE_GEO_LEAFLET[st] || STATE_GEO_LEAFLET['US'];
              setFlyTarget({ center: geo.center, zoom: st === 'US' ? DEFAULT_ZOOM : geo.zoom });
            }}
            className="h-8 px-3 text-xs font-medium rounded-lg border border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100 focus:ring-2 focus:ring-violet-400/50 focus:outline-none transition-colors cursor-pointer"
          >
            <option value="US">All States</option>
            {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
              <option key={abbr} value={abbr}>{name}</option>
            ))}
          </select>
          <button
            onClick={exportBiotechReport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 transition-colors shadow-sm"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </button>
        </div>

        {viewLens === 'overview' && (
          <>
            <MissionQuote role="biotech" variant="light" />
            <div className="text-7xl font-bold text-violet-700 text-center pt-3 capitalize">{companyName}</div>
          </>
        )}

        <LayoutEditor ccKey="Biotech">
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
              <div className="rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-violet-50 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Microscope className="h-4 w-4 text-violet-600" />
                  <span className="text-sm font-bold text-slate-800">Executive Summary</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-violet-700">Key Strengths</div>
                    <div className="text-[11px] text-slate-700 space-y-1">
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><span className="font-semibold">{portfolioScores.gmpCompliantCount}/{portfolioScores.total} facilities</span> FDA cGMP compliant</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span><span className="font-semibold">{portfolioScores.wfiCount} WFI-capable</span> facilities (USP grade)</span>
                      </div>
                      {portfolioScores.avgTSSEff > 0 && (
                        <div className="flex items-start gap-1.5">
                          <TrendingUp className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">{portfolioScores.avgTSSEff}% avg TSS removal</span> across wastewater treatment</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-amber-700">Risk Flags</div>
                    <div className="text-[11px] text-slate-700 space-y-1">
                      {portfolioScores.highRisk > 0 && (
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-red-500 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">{portfolioScores.highRisk} high-risk</span> facilit{portfolioScores.highRisk === 1 ? 'y' : 'ies'} in impaired watersheds</span>
                        </div>
                      )}
                      {(portfolioScores.total - portfolioScores.gmpCompliantCount) > 0 && (
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">{portfolioScores.total - portfolioScores.gmpCompliantCount}</span> facilit{(portfolioScores.total - portfolioScores.gmpCompliantCount) === 1 ? 'y' : 'ies'} with GMP gaps</span>
                        </div>
                      )}
                      {portfolioScores.ejHighCount > 0 && (
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span><span className="font-semibold">{portfolioScores.ejHighCount}</span> facilit{portfolioScores.ejHighCount === 1 ? 'y' : 'ies'} in EJ communities</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center">
                      <div className={`text-4xl font-black ${portfolioScores.gmpCompliantCount === portfolioScores.total ? 'text-green-600' : portfolioScores.gmpCompliantCount > portfolioScores.total / 2 ? 'text-amber-600' : 'text-red-600'}`}>
                        {Math.round((portfolioScores.gmpCompliantCount / Math.max(portfolioScores.total, 1)) * 100)}%
                      </div>
                      <div className="text-xs text-slate-500 font-medium">GMP Compliance Rate</div>
                      <div className="text-[10px] text-slate-400 mt-1">{portfolioScores.total} facilities | {portfolioScores.monitored} PIN-verified</div>
                    </div>
                  </div>
                </div>
              </div>
            );

            // ─── KPIs ────────────────────────────────────────────────────────
            case 'kpis': return DS(
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total Facilities', value: portfolioScores.total, icon: Building2, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200' },
                  { label: 'GMP Compliant', value: portfolioScores.gmpCompliantCount, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                  { label: 'WFI Capable', value: portfolioScores.wfiCount, icon: Droplets, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                  { label: 'High Risk', value: portfolioScores.highRisk, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                  { label: 'Avg TSS Eff.', value: `${portfolioScores.avgTSSEff}%`, icon: Gauge, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
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

            // ─── MAP & FACILITY LIST ─────────────────────────────────────────
            case 'map-grid': return DS(
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Map */}
                <div className="lg:col-span-2 rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm" style={{ minHeight: 420 }}>
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">Facility Map</span>
                    <div className="flex items-center gap-1.5">
                      {OVERLAYS.map(o => (
                        <button key={o.id} onClick={() => setOverlay(o.id)}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                            overlay === o.id ? 'bg-violet-100 text-violet-800 border border-violet-300' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                          }`}>
                          <o.icon className="h-3 w-3" /> {o.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <MapboxMapShell
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    onMapRef={onMapRef}
                    onMouseMove={onMapMouseMove}
                    onMouseLeave={onMapMouseLeave}
                    onClick={onMapClick}
                  >
                    <MapboxMarkers data={facilityMarkerData} />
                  </MapboxMapShell>
                </div>
                {/* Facility list */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 500 }}>
                  <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <Search className="h-3.5 w-3.5 text-slate-400" />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search facilities..."
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
                    {filteredFacilities.map(f => (
                      <button key={f.id} onClick={() => {
                        setSelectedFacility(f.id === selectedFacility ? null : f.id);
                        if (f.lat && f.lon) setFlyTarget({ center: [f.lat, f.lon], zoom: 12 });
                      }}
                        className={`w-full text-left px-3 py-2.5 hover:bg-violet-50/50 transition-colors ${
                          selectedFacility === f.id ? 'bg-violet-50 border-l-2 border-violet-500' : ''
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-800">{f.name}</span>
                          <Badge variant="outline" className={`text-[9px] ${
                            f.alertLevel === 'high' ? 'border-red-300 bg-red-50 text-red-700' :
                            f.alertLevel === 'medium' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                            f.alertLevel === 'low' ? 'border-green-300 bg-green-50 text-green-700' :
                            'border-slate-200 bg-slate-50 text-slate-500'
                          }`}>{f.alertLevel}</Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span>{f.state}</span>
                          <span>Risk: {f.waterRiskScore}</span>
                          {f.uspGrade && <Badge variant="outline" className="text-[8px] border-blue-200 bg-blue-50 text-blue-700">{f.uspGrade}</Badge>}
                          {f.gmpCompliant === true && <Badge variant="outline" className="text-[8px] border-green-200 bg-green-50 text-green-700">GMP</Badge>}
                          {f.gmpCompliant === false && <Badge variant="outline" className="text-[8px] border-red-200 bg-red-50 text-red-700">GMP Gap</Badge>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );

            // ─── GMP STATUS (Overview lens) ──────────────────────────────────
            case 'gmp-status': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-violet-600" /> GMP Regulatory Status</CardTitle>
                  <CardDescription className="text-[11px]">Current good manufacturing practice compliance across facilities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{portfolioScores.gmpCompliantCount}</div>
                      <div className="text-[10px] text-green-600 font-medium">FDA cGMP Compliant</div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-center">
                      <div className="text-2xl font-bold text-red-700">{portfolioScores.total - portfolioScores.gmpCompliantCount}</div>
                      <div className="text-[10px] text-red-600 font-medium">Requires Remediation</div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">{portfolioScores.wfiCount}</div>
                      <div className="text-[10px] text-blue-600 font-medium">WFI Grade Qualified</div>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {facilitiesData.map(f => (
                      <div key={f.id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-white border border-slate-100 text-[11px]">
                        <span className="font-medium text-slate-700">{f.name}</span>
                        <div className="flex items-center gap-2">
                          {f.uspGrade && <Badge variant="outline" className="text-[9px] border-blue-200 text-blue-700">{f.uspGrade}</Badge>}
                          {f.gmpCompliant === true && <Badge variant="outline" className="text-[9px] border-green-300 bg-green-50 text-green-700">Compliant</Badge>}
                          {f.gmpCompliant === false && <Badge variant="outline" className="text-[9px] border-red-300 bg-red-50 text-red-700">Gap Found</Badge>}
                          {f.fdaInspectionDate && <span className="text-slate-400">Last FDA: {new Date(f.fdaInspectionDate).toLocaleDateString()}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── USP WATER SPECIFICATIONS (Process Water lens) ───────────────
            case 'usp-water-specs': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Droplets className="h-4 w-4 text-blue-600" /> USP Water Grade Specifications</CardTitle>
                  <CardDescription className="text-[11px]">Pharmacopeial water quality requirements per USP &lt;1231&gt;</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Grade</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Conductivity</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">TOC</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Microbial</th>
                          <th className="pb-2 font-semibold text-slate-600">Endotoxin</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {USP_WATER_GRADES.map(g => (
                          <tr key={g.grade} className="hover:bg-blue-50/50">
                            <td className="py-2 pr-3 font-semibold text-slate-800">{g.grade}</td>
                            <td className="py-2 pr-3 text-slate-600">{g.conductivity}</td>
                            <td className="py-2 pr-3 text-slate-600">{g.toc}</td>
                            <td className="py-2 pr-3 text-slate-600">{g.microbial}</td>
                            <td className="py-2 text-slate-600">{g.endotoxin}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 text-[10px] text-slate-400">
                    Source: USP &lt;1231&gt; Water for Pharmaceutical Purposes. EP = European Pharmacopoeia equivalent.
                  </div>
                </CardContent>
              </Card>
            );

            // ─── PURIFIED WATER KPIs (Process Water lens) ────────────────────
            case 'purified-water-kpis': return DS(
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'WFI Systems Online', value: portfolioScores.wfiCount, sub: 'USP Water for Injection', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: Droplets },
                  { label: 'Total Gal. Processed', value: `${(portfolioScores.totalGallons / 1_000_000).toFixed(1)}M`, sub: 'All water treatment', color: 'text-cyan-600', bg: 'bg-cyan-50 border-cyan-200', icon: Waves },
                  { label: 'Avg Conductivity', value: '0.92 uS', sub: 'Across WFI loops', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', icon: Activity },
                  { label: 'Bioburden Alert', value: '0', sub: 'Action limit exceedances', color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: ShieldCheck },
                ].map(kpi => (
                  <div key={kpi.label} className={`rounded-lg border p-3 ${kpi.bg}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                      <span className="text-[10px] text-slate-500 font-medium">{kpi.label}</span>
                    </div>
                    <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                    <div className="text-[9px] text-slate-400 mt-0.5">{kpi.sub}</div>
                  </div>
                ))}
              </div>
            );

            // ─── PROCESS WATER ALERTS (Process Water lens) ───────────────────
            case 'process-water-alerts': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> Process Water Alerts</CardTitle>
                  <CardDescription className="text-[11px]">Real-time alert and action limit exceedances across water systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { facility: 'NJ API Synthesis Plant', system: 'WFI Loop A', param: 'TOC', value: '480 ppb', limit: '500 ppb', status: 'alert', time: '2h ago' },
                      { facility: 'Indianapolis Formulation', system: 'PW Generation', param: 'Conductivity', value: '1.28 uS/cm', limit: '1.3 uS/cm', status: 'alert', time: '4h ago' },
                      { facility: 'San Diego Bioprocess', system: 'WFI Storage Tank 3', param: 'Microbial', value: '< 1 CFU/100mL', limit: '10 CFU/100mL', status: 'ok', time: '1h ago' },
                    ].map((a, i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${
                        a.status === 'alert' ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'
                      }`}>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-800">{a.facility} - {a.system}</div>
                          <div className="text-[10px] text-slate-500">{a.param}: <span className="font-medium">{a.value}</span> (limit: {a.limit})</div>
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className={`text-[9px] ${a.status === 'alert' ? 'border-amber-300 text-amber-700' : 'border-green-300 text-green-700'}`}>
                            {a.status === 'alert' ? 'Near Limit' : 'Normal'}
                          </Badge>
                          <div className="text-[9px] text-slate-400 mt-0.5">{a.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── DISCHARGE OVERVIEW (Discharge & Effluent lens) ──────────────
            case 'discharge-overview': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Waves className="h-4 w-4 text-cyan-600" /> Discharge Overview</CardTitle>
                  <CardDescription className="text-[11px]">Pharmaceutical wastewater discharge summary across NPDES-permitted facilities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    {[
                      { label: 'Active NPDES Permits', value: facilitiesData.filter(f => f.npdespermit).length, color: 'text-cyan-700', bg: 'bg-cyan-50 border-cyan-200' },
                      { label: 'Total Discharge (gal)', value: `${(portfolioScores.totalGallons / 1_000_000).toFixed(1)}M`, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'TN Removed (lbs)', value: portfolioScores.totalTN.toFixed(0), color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
                      { label: 'TSS Removed (lbs)', value: portfolioScores.totalTSS.toLocaleString(), color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
                    ].map(kpi => (
                      <div key={kpi.label} className={`rounded-lg border p-2 text-center ${kpi.bg}`}>
                        <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                        <div className="text-[9px] text-slate-500">{kpi.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    {facilitiesData.filter(f => f.npdespermit).map(f => (
                      <div key={f.id} className="flex items-center justify-between px-3 py-1.5 rounded-md bg-white border border-slate-100 text-[11px]">
                        <div>
                          <span className="font-medium text-slate-700">{f.name}</span>
                          <span className="text-slate-400 ml-2">Permit: {f.npdespermit}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <span>{f.gallonsTreated ? `${(f.gallonsTreated / 1000).toFixed(0)}K gal` : '--'}</span>
                          <span>to {f.receivingWaterbody || 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── EFFLUENT LIMITS (Discharge & Effluent lens) ─────────────────
            case 'effluent-limits': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-slate-600" /> Effluent Limitation Guidelines (40 CFR 439)</CardTitle>
                  <CardDescription className="text-[11px]">Federal pharmaceutical manufacturing effluent standards</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Parameter</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Daily Max</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Monthly Avg</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Unit</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">CFR Ref</th>
                          <th className="pb-2 font-semibold text-slate-600">Concern</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {PHARMA_EFFLUENT_PARAMS.map(p => (
                          <tr key={p.parameter} className="hover:bg-slate-50/50">
                            <td className="py-1.5 pr-3 font-medium text-slate-800">{p.parameter}</td>
                            <td className="py-1.5 pr-3 text-slate-600 font-mono text-[10px]">{p.dailyMax}</td>
                            <td className="py-1.5 pr-3 text-slate-600 font-mono text-[10px]">{p.monthlyAvg}</td>
                            <td className="py-1.5 pr-3 text-slate-500">{p.unit}</td>
                            <td className="py-1.5 pr-3 text-slate-400">{p.cfr439Ref}</td>
                            <td className="py-1.5"><ConcernBadge level={p.concern} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── API DISCHARGE MONITORING (Discharge & Effluent lens) ────────
            case 'api-discharge': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600" /> API Discharge Monitoring</CardTitle>
                  <CardDescription className="text-[11px]">Active pharmaceutical ingredient concentrations in wastewater discharge</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { api: 'Acetaminophen', conc: '12.4 ug/L', limit: 'No federal limit', trend: 'stable', risk: 'low' as const },
                      { api: 'Ibuprofen', conc: '8.7 ug/L', limit: 'No federal limit', trend: 'decreasing', risk: 'low' as const },
                      { api: 'Metformin', conc: '142 ug/L', limit: 'Monitoring only', trend: 'increasing', risk: 'medium' as const },
                      { api: 'Ciprofloxacin', conc: '0.34 ug/L', limit: 'PNEC: 0.5 ug/L', trend: 'stable', risk: 'high' as const },
                      { api: 'Estradiol (E2)', conc: '0.008 ug/L', limit: 'PNEC: 0.01 ug/L', trend: 'stable', risk: 'high' as const },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-800">{row.api}</div>
                          <div className="text-[10px] text-slate-500">Measured: <span className="font-mono">{row.conc}</span> | {row.limit}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-medium ${row.trend === 'increasing' ? 'text-red-600' : row.trend === 'decreasing' ? 'text-green-600' : 'text-slate-500'}`}>
                            {row.trend === 'increasing' ? '^ Rising' : row.trend === 'decreasing' ? 'v Falling' : '~ Stable'}
                          </span>
                          <ConcernBadge level={row.risk} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] text-slate-400">PNEC = Predicted No Effect Concentration. Monitoring data is illustrative.</div>
                </CardContent>
              </Card>
            );

            // ─── COMPLIANCE OVERVIEW (Compliance lens) ───────────────────────
            case 'compliance-overview': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4 text-violet-600" /> Regulatory Compliance Overview</CardTitle>
                  <CardDescription className="text-[11px]">Dual FDA/EPA compliance status across the biotech portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                      <div className="text-2xl font-bold text-green-700">{portfolioScores.gmpCompliantCount}</div>
                      <div className="text-[10px] text-green-600">FDA cGMP OK</div>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                      <div className="text-2xl font-bold text-blue-700">{facilitiesData.filter(f => f.npdespermit).length}</div>
                      <div className="text-[10px] text-blue-600">NPDES Permitted</div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
                      <div className="text-2xl font-bold text-amber-700">{facilitiesData.reduce((s, f) => s + f.activeAlerts, 0)}</div>
                      <div className="text-[10px] text-amber-600">Active Alerts</div>
                    </div>
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center">
                      <div className="text-2xl font-bold text-purple-700">{GMP_FRAMEWORKS.length}</div>
                      <div className="text-[10px] text-purple-600">Frameworks Tracked</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── PERMIT STATUS (Compliance lens) ─────────────────────────────
            case 'permit-status': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-blue-600" /> Permit Status</CardTitle>
                  <CardDescription className="text-[11px]">NPDES discharge permits and FDA facility registrations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {facilitiesData.map(f => (
                      <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-slate-100 hover:bg-slate-50">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-800">{f.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {f.npdespermit ? `NPDES: ${f.npdespermit}` : 'No NPDES permit'}
                            {f.fdaInspectionDate && ` | FDA inspection: ${new Date(f.fdaInspectionDate).toLocaleDateString()}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {f.npdespermit && <Badge variant="outline" className="text-[9px] border-cyan-200 text-cyan-700">NPDES</Badge>}
                          {f.gmpCompliant && <Badge variant="outline" className="text-[9px] border-green-200 text-green-700">cGMP</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── FDA/EPA DUAL REGULATORY MATRIX (Compliance lens) ────────────
            case 'fda-epa-matrix': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-purple-600" /> FDA / EPA Dual-Regulatory Crosswalk</CardTitle>
                  <CardDescription className="text-[11px]">Where FDA pharmaceutical and EPA environmental requirements intersect</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Area</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">FDA Requirement</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">EPA Requirement</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Overlap</th>
                          <th className="pb-2 font-semibold text-slate-600">PIN Coverage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {FDA_EPA_MATRIX.map(row => (
                          <tr key={row.area} className="hover:bg-purple-50/50">
                            <td className="py-2 pr-3 font-semibold text-slate-800">{row.area}</td>
                            <td className="py-2 pr-3 text-slate-600">{row.fdaRequirement}</td>
                            <td className="py-2 pr-3 text-slate-600">{row.epaRequirement}</td>
                            <td className="py-2 pr-3"><OverlapBadge level={row.overlap} /></td>
                            <td className="py-2"><CoverageBadge level={row.pearlCoverage} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── API TRACKING (Contaminants lens) ────────────────────────────
            case 'api-tracking': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 text-red-600" /> Active Pharmaceutical Ingredient Tracking</CardTitle>
                  <CardDescription className="text-[11px]">Monitoring APIs in wastewater and receiving waters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { class: 'Antibiotics', examples: 'Ciprofloxacin, Amoxicillin, Azithromycin', concern: 'Antimicrobial resistance in aquatic ecosystems', level: 'high' as const },
                      { class: 'Endocrine Disruptors', examples: 'Estradiol, Ethinylestradiol, Bisphenol-A', concern: 'Reproductive effects at ng/L concentrations', level: 'high' as const },
                      { class: 'Analgesics/NSAIDs', examples: 'Ibuprofen, Acetaminophen, Diclofenac', concern: 'Ecosystem toxicity at ug/L levels', level: 'medium' as const },
                      { class: 'Antidiabetics', examples: 'Metformin, Sitagliptin', concern: 'High environmental persistence; widespread detection', level: 'medium' as const },
                      { class: 'Oncology Agents', examples: 'Cyclophosphamide, 5-FU, Methotrexate', concern: 'Cytotoxic/mutagenic; requires specialized treatment', level: 'high' as const },
                    ].map((row, i) => (
                      <div key={i} className="px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-slate-800">{row.class}</span>
                          <ConcernBadge level={row.level} />
                        </div>
                        <div className="text-[10px] text-slate-500">Examples: {row.examples}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">Concern: {row.concern}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── PFAS IN MANUFACTURING (Contaminants lens) ───────────────────
            case 'pfas-manufacturing': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" /> PFAS in Pharmaceutical Manufacturing</CardTitle>
                  <CardDescription className="text-[11px]">Per- and polyfluoroalkyl substances in pharma processes and wastewater</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-[11px] font-semibold text-amber-800 mb-1">Regulatory Landscape</div>
                      <div className="text-[10px] text-amber-700 space-y-1">
                        <div>- EPA PFAS Strategic Roadmap: PFOA/PFOS MCL finalized at 4 ppt (2024)</div>
                        <div>- FDA investigating PFAS in drug packaging and medical devices</div>
                        <div>- NPDES permits increasingly include PFAS monitoring requirements</div>
                        <div>- State-level PFAS discharge limits emerging (MI, ME, NH, NJ)</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 p-3">
                      <div className="text-[11px] font-semibold text-slate-800 mb-1">Pharma-Specific PFAS Sources</div>
                      <div className="text-[10px] text-slate-600 space-y-1">
                        <div>- PTFE-lined equipment and gaskets in API processing</div>
                        <div>- Fluorinated solvents in synthesis pathways</div>
                        <div>- Packaging materials with PFAS coatings</div>
                        <div>- Firefighting foam (AFFF) at manufacturing sites</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-red-50 border border-red-200 p-2 text-center">
                        <div className="text-sm font-bold text-red-700">4 ppt</div>
                        <div className="text-[9px] text-red-600">PFOA/PFOS MCL</div>
                      </div>
                      <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-center">
                        <div className="text-sm font-bold text-amber-700">70 ppt</div>
                        <div className="text-[9px] text-amber-600">Prev. Health Advisory</div>
                      </div>
                      <div className="rounded-md bg-blue-50 border border-blue-200 p-2 text-center">
                        <div className="text-sm font-bold text-blue-700">TBD</div>
                        <div className="text-[9px] text-blue-600">Effluent Guidelines</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── GMP FRAMEWORKS (GMP & Quality lens) ─────────────────────────
            case 'gmp-frameworks': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4 text-purple-600" /> GMP Regulatory Frameworks</CardTitle>
                  <CardDescription className="text-[11px]">Key regulatory frameworks governing pharmaceutical water quality and manufacturing</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {GMP_FRAMEWORKS.map(fw => (
                      <div key={fw.id} className="rounded-lg border border-slate-200 p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-800">{fw.name}</span>
                            <Badge className={`text-[9px] ${fw.authorityBadge}`}>{fw.authority}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className={`h-full rounded-full ${fw.coverage >= 85 ? 'bg-green-500' : fw.coverage >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${fw.coverage}%` }} />
                            </div>
                            <span className="text-[10px] font-medium text-slate-600">{fw.coverage}%</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {fw.requirements.map((req, i) => (
                            <span key={i} className="text-[9px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{req}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── USP VALIDATION (GMP & Quality lens) ─────────────────────────
            case 'usp-validation': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> USP Water System Validation</CardTitle>
                  <CardDescription className="text-[11px]">IQ/OQ/PQ validation status for pharmaceutical water systems</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {facilitiesData.map(f => (
                      <div key={f.id} className="flex items-center justify-between px-3 py-2 rounded-md border border-slate-100">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-800">{f.name}</div>
                          <div className="text-[10px] text-slate-500">{f.uspGrade || 'Not classified'} | {f.state}</div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[9px] border-green-200 text-green-700">IQ</Badge>
                          <Badge variant="outline" className="text-[9px] border-green-200 text-green-700">OQ</Badge>
                          <Badge variant="outline" className={`text-[9px] ${f.gmpCompliant ? 'border-green-200 text-green-700' : 'border-amber-200 text-amber-700'}`}>
                            PQ {f.gmpCompliant ? 'Pass' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── QUALITY AUDIT LOG (GMP & Quality lens) ──────────────────────
            case 'quality-audit-log': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-slate-600" /> Quality Audit Log</CardTitle>
                  <CardDescription className="text-[11px]">Recent FDA inspections, internal audits, and CAPA actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { date: '2025-11-02', facility: 'NJ API Synthesis Plant', type: 'FDA Inspection', result: 'NAI', notes: 'No Action Indicated. Water system fully compliant.' },
                      { date: '2025-09-15', facility: 'RTP Biologics Campus', type: 'FDA Inspection', result: 'NAI', notes: 'WFI system validated. Minor documentation update recommended.' },
                      { date: '2025-07-28', facility: 'Juncos Sterile Fill', type: 'FDA Inspection', result: 'VAI', notes: 'Voluntary Action Indicated. CAPA for trending procedure update.' },
                      { date: '2025-06-20', facility: 'San Diego Bioprocess', type: 'Internal Audit', result: 'Pass', notes: 'Annual water system qualification confirmed.' },
                      { date: '2025-03-08', facility: 'Indianapolis Formulation', type: 'FDA Inspection', result: 'OAI', notes: 'Official Action Indicated. Water system revalidation required.' },
                    ].map((audit, i) => (
                      <div key={i} className="px-3 py-2 rounded-lg border border-slate-100 hover:bg-slate-50">
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-slate-800">{audit.facility}</span>
                            <Badge variant="outline" className="text-[9px]">{audit.type}</Badge>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[9px] ${
                              audit.result === 'NAI' || audit.result === 'Pass' ? 'border-green-300 bg-green-50 text-green-700' :
                              audit.result === 'VAI' ? 'border-amber-300 bg-amber-50 text-amber-700' :
                              'border-red-300 bg-red-50 text-red-700'
                            }`}>{audit.result}</Badge>
                            <span className="text-[10px] text-slate-400">{audit.date}</span>
                          </div>
                        </div>
                        <div className="text-[10px] text-slate-500">{audit.notes}</div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );

            // ─── BATCH WATER TRACKING (GMP & Quality lens) ───────────────────
            case 'batch-water-tracking': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4 text-indigo-600" /> Batch Water Tracking</CardTitle>
                  <CardDescription className="text-[11px]">Water quality records linked to production batch lots for traceability</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 text-left">
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Batch ID</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Facility</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Water Grade</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">Conductivity</th>
                          <th className="pb-2 font-semibold text-slate-600 pr-3">TOC</th>
                          <th className="pb-2 font-semibold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[
                          { batch: 'BT-2026-0218', facility: 'RTP Biologics', grade: 'WFI', cond: '0.88 uS', toc: '312 ppb', pass: true },
                          { batch: 'BT-2026-0217', facility: 'NJ API Synthesis', grade: 'Purified', cond: '1.12 uS', toc: '428 ppb', pass: true },
                          { batch: 'BT-2026-0216', facility: 'San Diego Bio', grade: 'WFI', cond: '0.94 uS', toc: '289 ppb', pass: true },
                          { batch: 'BT-2026-0215', facility: 'Indianapolis', grade: 'HP Water', cond: '1.05 uS', toc: '465 ppb', pass: true },
                          { batch: 'BT-2026-0214', facility: 'Juncos Sterile', grade: 'WFI', cond: '0.91 uS', toc: '298 ppb', pass: true },
                        ].map(row => (
                          <tr key={row.batch} className="hover:bg-indigo-50/30">
                            <td className="py-1.5 pr-3 font-mono text-[10px] text-slate-800">{row.batch}</td>
                            <td className="py-1.5 pr-3 text-slate-700">{row.facility}</td>
                            <td className="py-1.5 pr-3"><Badge variant="outline" className="text-[9px] border-blue-200 text-blue-700">{row.grade}</Badge></td>
                            <td className="py-1.5 pr-3 font-mono text-[10px] text-slate-600">{row.cond}</td>
                            <td className="py-1.5 pr-3 font-mono text-[10px] text-slate-600">{row.toc}</td>
                            <td className="py-1.5">
                              <Badge variant="outline" className={`text-[9px] ${row.pass ? 'border-green-300 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-700'}`}>
                                {row.pass ? 'Pass' : 'Fail'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );

            // ─── ECONOMIC PERFORMANCE (Supply Chain lens) ────────────────────
            case 'economic': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-600" /> Economic Performance</CardTitle>
                  <CardDescription className="text-[11px]">Water cost analysis, treatment ROI, and compliance economics</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Water Cost / Facility', value: '$2.4M', sub: 'Annual avg', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                      { label: 'Treatment Cost', value: '$8.20', sub: 'Per 1000 gal', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
                      { label: 'Non-Compliance Risk', value: '$12M', sub: 'Est. annual exposure', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
                      { label: 'WFI Generation', value: '$0.42', sub: 'Per gallon', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
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

            // ─── GRANTS ─────────────────────────────────────────────────────
            case 'grants': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Star className="h-4 w-4 text-amber-600" /> Grant & Funding Opportunities</CardTitle>
                  <CardDescription className="text-[11px]">Relevant water quality and manufacturing grants for biotech facilities</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[
                      { name: 'EPA Water Infrastructure Finance (WIFIA)', amount: 'Up to $100M', deadline: 'Rolling', relevance: 'Wastewater treatment upgrades' },
                      { name: 'USDA BioPreferred Program', amount: 'Varies', deadline: 'Annual', relevance: 'Biobased manufacturing processes' },
                      { name: 'NIH SBIR/STTR Phase II', amount: 'Up to $1.5M', deadline: 'Quarterly', relevance: 'Green chemistry & water recycling R&D' },
                      { name: 'State Revolving Fund (SRF)', amount: 'State-specific', deadline: 'Rolling', relevance: 'Water system infrastructure' },
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

            // ─── SHARED PANELS ──────────────────────────────────────────────

            case 'insights': return DS(
              <AIInsightsEngine key="US" role={"Biotech" as any} stateAbbr="US" regionData={facilitiesData as any} />
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
              <Card><CardHeader><CardTitle>Biotech Reports</CardTitle><CardDescription>Generated biotech/pharma compliance reports</CardDescription></CardHeader>
              <CardContent><div className="space-y-2">
                {['Annual Water Quality Report', 'FDA cGMP Compliance Summary', 'NPDES Discharge Summary', '40 CFR 439 Effluent Report', 'PFAS Monitoring Report'].map(r =>
                  <div key={r} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50"><span className="text-sm text-slate-700">{r}</span><Badge variant="outline" className="text-[10px]">Generate</Badge></div>
                )}
              </div></CardContent></Card>
            );

            case 'water-stewardship-panel': return DS(<WaterStewardshipPanel stateAbbr="" />);
            case 'facility-operations-panel': return DS(<FacilityOperationsPanel stateAbbr="" />);
            case 'supply-chain-risk-panel': return DS(<SupplyChainRiskPanel stateAbbr="" />);

            // ─── WARR ZONES ──────────────────────────────────────────────────

            case 'warr-metrics': {
              const warrM: WARRMetric[] = [
                { label: 'Process Water Purity', value: '--', icon: Gauge, iconColor: 'var(--status-healthy)', subtitle: 'USP compliance' },
                { label: 'Discharge Compliance', value: '--', icon: Shield, iconColor: 'var(--accent-teal)', subtitle: 'NPDES status' },
                { label: 'GMP Score', value: '--', icon: AlertTriangle, iconColor: 'var(--status-warning)', subtitle: 'FDA readiness' },
              ];
              return DS(<WARRZones zone="warr-metrics" role="Biotech" stateAbbr="US" metrics={warrM} events={[]} activeResolutionCount={0} />);
            }
            case 'warr-analyze': return DS(
              <WARRZones zone="warr-analyze" role="Biotech" stateAbbr="US" metrics={[]} events={[]} activeResolutionCount={0} />
            );
            case 'warr-respond': return DS(
              <WARRZones zone="warr-respond" role="Biotech" stateAbbr="US" metrics={[]} events={[]} activeResolutionCount={0} />
            );
            case 'warr-resolve': return DS(
              <WARRZones zone="warr-resolve" role="Biotech" stateAbbr="US" metrics={[]} events={[]} activeResolutionCount={0} />
            );

            // ─── TRENDS DASHBOARD (placeholder) ─────────────────────────────

            case 'trends-dashboard': return DS(
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-indigo-600" /> Trends & Forecasting</CardTitle>
                  <CardDescription className="text-[11px]">Water quality and regulatory compliance trends across the biotech portfolio</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="text-[11px] font-semibold text-green-800">Improving</div>
                      <div className="text-[10px] text-green-700 mt-1 space-y-0.5">
                        <div>- TSS removal efficiency +3.2% YoY</div>
                        <div>- WFI system uptime 99.7%</div>
                        <div>- FDA inspection outcomes trending NAI</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <div className="text-[11px] font-semibold text-amber-800">Watch</div>
                      <div className="text-[10px] text-amber-700 mt-1 space-y-0.5">
                        <div>- PFAS regulatory landscape evolving</div>
                        <div>- API discharge limits under review</div>
                        <div>- Water scarcity risk at CA facility</div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="text-[11px] font-semibold text-red-800">Action Required</div>
                      <div className="text-[10px] text-red-700 mt-1 space-y-0.5">
                        <div>- NJ facility effluent limits tightening Q3</div>
                        <div>- Indianapolis GMP revalidation overdue</div>
                        <div>- New state PFAS requirements pending</div>
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

        {/* ── FACILITY DETAIL (selected facility) ── */}
        {selectedFac && (
          <div className="rounded-xl border-2 border-violet-200 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-violet-50 border-b border-violet-200 flex items-center justify-between">
              <span className="text-sm font-bold text-violet-800">{selectedFac.name} -- Facility Detail</span>
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
                  <div className="text-xl font-bold text-slate-800">{selectedFac.uspGrade || '--'}</div>
                  <div className="text-[10px] text-slate-500">USP Grade</div>
                </div>
                <div className="text-center">
                  <div className={`text-xl font-bold ${selectedFac.gmpCompliant ? 'text-green-600' : selectedFac.gmpCompliant === false ? 'text-red-600' : 'text-slate-400'}`}>
                    {selectedFac.gmpCompliant ? 'Yes' : selectedFac.gmpCompliant === false ? 'No' : '--'}
                  </div>
                  <div className="text-[10px] text-slate-500">GMP Compliant</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.activeAlerts}</div>
                  <div className="text-[10px] text-slate-500">Active Alerts</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-800">{selectedFac.dataSourceCount}</div>
                  <div className="text-[10px] text-slate-500">Data Sources</div>
                </div>
              </div>
              {(selectedFac.gallonsTreated || 0) > 0 && (
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
                  <div className="rounded-md bg-violet-50 p-2 text-center">
                    <div className="text-sm font-bold text-violet-700">{selectedFac.tssReduced?.toLocaleString() || '--'}</div>
                    <div className="text-[9px] text-violet-600">lbs TSS</div>
                  </div>
                </div>
              )}
              <div className="text-[10px] text-slate-500 space-y-0.5">
                {selectedFac.receivingWaterbody && <div>Receiving waterbody: <span className="font-medium text-slate-700">{selectedFac.receivingWaterbody}</span></div>}
                {selectedFac.npdespermit && <div>NPDES Permit: <span className="font-mono text-slate-600">{selectedFac.npdespermit}</span></div>}
                {selectedFac.fdaInspectionDate && <div>Last FDA Inspection: <span className="font-medium text-slate-700">{new Date(selectedFac.fdaInspectionDate).toLocaleDateString()}</span></div>}
                {selectedFac.huc12 && <div>HUC-12: <span className="font-mono text-slate-600">{selectedFac.huc12}</span></div>}
                <div>Water risk derived from EPA ATTAINS impairment data. Compliance from EPA ECHO. GMP status from facility self-reporting.</div>
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

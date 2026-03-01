/**
 * Site Intelligence Dashboard — TypeScript interfaces for the
 * /api/site-intelligence response and its sub-structures.
 */

import type { WqpRecord } from './wqpCache';
import type { SdwisSystem, SdwisViolation, SdwisEnforcement } from './sdwisCache';
import type { IcisPermit, IcisViolation, IcisDmr, IcisEnforcement, IcisInspection } from './icisCache';
import type { EchoFacility, EchoViolation } from './echoCache';
import type { TriFacility } from './triCache';
import type { WaterRiskScoreResult } from './waterRiskScore';
import type { FemaDeclaration } from './femaCache';

// ─── Census Geocoder ─────────────────────────────────────────────────────────

export interface CensusGeo {
  fips: string;
  county: string;
  tract: string;
  congressionalDistrict: string;
  stateFips: string;
}

// ─── FEMA Flood Zone ────────────────────────────────────────────────────────

export interface FloodZone {
  zone: string;        // e.g. "A", "AE", "X"
  sfha: boolean;       // Special Flood Hazard Area
  zoneSubtype: string;
}

// ─── USFWS Critical Habitat ─────────────────────────────────────────────────

export interface CriticalHabitatResult {
  species: string;
  status: string;       // ESA status (Endangered / Threatened)
  distanceMi: number;
  listingDate: string;
  scientificName: string;
}

// ─── EPA SEMS (Superfund) ───────────────────────────────────────────────────

export interface SuperfundSite {
  name: string;
  distanceMi: number;
  nplStatus: string;
  epaId: string;
  city: string;
  state: string;
}

// ─── EPA Brownfields ────────────────────────────────────────────────────────

export interface BrownfieldSite {
  name: string;
  distanceMi: number;
  status: string;
  city: string;
  state: string;
}

// ─── EJScreen ───────────────────────────────────────────────────────────────

export interface EJScreenData {
  demographicIndex: number | null;
  pm25: number | null;
  ozone: number | null;
  wastewater: number | null;
  superfundProximity: number | null;
  rmpProximity: number | null;
  hazWaste: number | null;
  [key: string]: unknown;
}

// ─── Composite report ───────────────────────────────────────────────────────

export interface SiteIntelligenceReport {
  location: {
    lat: number;
    lng: number;
    state: string;
    label: string;
    zip?: string;
    huc8?: string;
    hucName?: string;
    hucDistance?: number;
  };
  census: CensusGeo | null;
  floodZone: FloodZone | null;
  environmentalProfile: {
    wqpRecords: WqpRecord[];
    attains: { impaired: number; total: number; topCauses: string[] } | null;
    ejscreen: EJScreenData | null;
  };
  speciesHabitat: {
    criticalHabitat: CriticalHabitatResult[];
  };
  contamination: {
    superfund: SuperfundSite[];
    brownfields: BrownfieldSite[];
    echoFacilities: EchoFacility[];
    echoViolations: EchoViolation[];
    triReleases: TriFacility[];
    pfasDetections: number;
  };
  regulatory: {
    sdwisSystems: SdwisSystem[];
    sdwisViolations: SdwisViolation[];
    sdwisEnforcement: SdwisEnforcement[];
    icisPermits: IcisPermit[];
    icisViolations: IcisViolation[];
    icisDmr: IcisDmr[];
    icisEnforcement: IcisEnforcement[];
    icisInspections: IcisInspection[];
  };
  femaDeclarations: FemaDeclaration[];
  waterScore: WaterRiskScoreResult | null;
  riskForecast: RiskForecastResult | null;
  generatedAt: string;
}

// ─── Risk Summary traffic-light indicators ──────────────────────────────────

export type RiskLevel = 'green' | 'amber' | 'red' | 'gray';

export interface RiskIndicator {
  label: string;
  level: RiskLevel;
  detail: string;
  panelId: string; // scroll-to target
}

// ─── Risk Forecast types ────────────────────────────────────────────────────

export type RiskForecastCategory =
  | 'infrastructure-failure'
  | 'impairment-breach'
  | 'enforcement-probability'
  | 'capacity-exceedance'
  | 'cascading-impact'
  | 'recovery-timeline'
  | 'public-health-exposure'
  | 'intervention-roi';

export type ConfidenceTier = 'HIGH' | 'MODERATE' | 'LOW';

export interface ContributingFactor {
  name: string;
  value: number;
  weight: number;
  direction: 'positive' | 'neutral' | 'negative';
}

export interface RiskPrediction {
  category: RiskForecastCategory;
  label: string;
  probability: number;         // 0-100
  riskLevel: RiskLevel;
  timeframe: string;
  confidence: ConfidenceTier;
  summary: string;
  factors: ContributingFactor[];
  icon: string;                // Lucide icon name
}

export interface RiskForecastResult {
  predictions: RiskPrediction[];
  overallRiskLevel: RiskLevel;
  generatedAt: string;
  dataCompleteness: number;    // 0-100
}

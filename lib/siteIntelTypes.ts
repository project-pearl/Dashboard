/**
 * Site Intelligence Dashboard — TypeScript interfaces for the
 * /api/site-intelligence response and its sub-structures.
 */

import type { WqpRecord } from './wqpCache';
import type { SdwisSystem, SdwisViolation } from './sdwisCache';
import type { IcisPermit, IcisViolation } from './icisCache';
import type { EchoFacility, EchoViolation } from './echoCache';
import type { TriFacility } from './triCache';
import type { WaterRiskScoreResult } from './waterRiskScore';

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
    icisPermits: IcisPermit[];
    icisViolations: IcisViolation[];
  };
  waterScore: WaterRiskScoreResult | null;
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

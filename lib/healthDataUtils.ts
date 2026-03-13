// lib/healthDataUtils.ts
// Shared utilities for health data integration across hospital, outbreak, and environmental health caches

import { haversineDistance } from './geoUtils';

// ─── Shared Types ────────────────────────────────────────────────────────────

export interface HealthLocation {
  lat: number;
  lng: number;
  state: string;
  county?: string;
}

export interface MilitaryInstallationRef {
  id: string;
  name: string;
  lat: number;
  lng: number;
  branch: string;
  country: string;
}

export interface ProximityResult {
  nearestInstallationId: string;
  nearestInstallationName: string;
  distanceKm: number;
  distanceMiles: number;
}

// ─── Hospital Data Types ─────────────────────────────────────────────────────

export interface HospitalFacility {
  facilityId: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  facilityType: 'acute_care' | 'critical_access' | 'specialty' | 'psychiatric' | 'rehabilitation';
  ownership: 'government' | 'nonprofit' | 'for_profit' | 'tribal';
  emergencyServices: boolean;
  capacity?: {
    totalBeds?: number;
    icuBeds?: number;
    operatingRooms?: number;
  };
  services: string[];
  certifications: string[];
  qualityRating?: number; // CMS star rating
  proximityToMilitary?: ProximityResult;
  lastUpdated: string;
}

// ─── Waterborne Illness Types ────────────────────────────────────────────────

export interface WaterborneOutbreak {
  outbreakId: string;
  reportId: string;
  state: string;
  county: string;
  city?: string;
  lat: number;
  lng: number;
  reportDate: string;
  onsetDate?: string;
  illnessType: 'gastroenteritis' | 'legionella' | 'hepatitis_a' | 'cryptosporidium' | 'giardia' | 'shigella' | 'other';
  caseCount: number;
  hospitalizations?: number;
  deaths?: number;
  suspectedSource: 'drinking_water' | 'recreational_water' | 'well_water' | 'unknown';
  waterSystemId?: string; // Link to SDWIS system
  facilityType?: 'hotel' | 'restaurant' | 'school' | 'nursing_home' | 'recreational' | 'residential' | 'other';
  investigationStatus: 'reported' | 'investigation' | 'confirmed' | 'ruled_out' | 'resolved';
  contaminant?: string;
  sourceConfirmed: boolean;
  proximityToMilitary?: ProximityResult;
  correlatedViolations?: string[]; // Related SDWIS violation IDs
  lastUpdated: string;
}

// ─── Environmental Health Types ──────────────────────────────────────────────

export interface EnvironmentalHealthMetric {
  locationId: string;
  locationType: 'county' | 'zip' | 'census_tract' | 'state';
  state: string;
  county: string;
  zipCode?: string;
  lat: number;
  lng: number;
  population: number;
  demographics: {
    medianIncome?: number;
    minorityPercent?: number;
    under18Percent?: number;
    over65Percent?: number;
  };
  healthOutcomes: {
    asthmaRateAdult?: number; // per 100k
    asthmaRateChild?: number; // per 100k
    respiratoryHospitalizations?: number; // per 100k
    gastrointestinalHospitalizations?: number; // per 100k
    cancerIncidence?: number; // per 100k
    lifeExpectancy?: number;
  };
  environmentalExposures: {
    airQualityIndex?: number;
    pm25Concentration?: number; // μg/m³
    ozoneConcentration?: number; // ppb
    waterViolationDensity?: number; // violations per capita
    proximityToHazardousWaste?: number; // km to nearest site
    industrialFacilityDensity?: number; // facilities per sq km
  };
  environmentalJustice: {
    ejScreenPercentile?: number; // EPA EJScreen percentile
    cumulativeImpactScore?: number;
    vulnerabilityScore?: number;
  };
  proximityToMilitary?: ProximityResult;
  lastUpdated: string;
}

// ─── Summary Types (for UI cards) ────────────────────────────────────────

export interface NationalMortalityContext {
  topCauses: Array<{
    causeCode: string;
    causeLabel: string;
    category: string;
    totalDeaths: number;
    avgRate: number;
    trend: 'rising' | 'stable' | 'declining' | null;
  }>;
  yearRange: [number, number] | null;
  cacheBuilt: string | null;
}

export interface HpsaSummary {
  totalDesignations: number;
  primaryCare: number;
  dentalHealth: number;
  mentalHealth: number;
  highSeverity: number;
  ruralCount: number;
  totalPopulationServed: number;
  avgScore: number;
  overlappingWithViolations: number; // county FIPS overlap with SDWIS
}

// ─── Spatial Utility Functions ───────────────────────────────────────────────

/**
 * Find the nearest military installation to a given location
 */
export function findNearestInstallation(
  location: HealthLocation,
  installations: MilitaryInstallationRef[]
): ProximityResult | null {
  if (installations.length === 0) return null;

  let nearest: MilitaryInstallationRef | null = null;
  let minDistance = Infinity;

  for (const installation of installations) {
    const distance = haversineDistance(
      location.lat,
      location.lng,
      installation.lat,
      installation.lng
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearest = installation;
    }
  }

  if (!nearest) return null;

  return {
    nearestInstallationId: nearest.id,
    nearestInstallationName: nearest.name,
    distanceKm: minDistance,
    distanceMiles: minDistance * 0.621371,
  };
}

/**
 * Filter locations within a specified radius of military installations
 */
export function filterByMilitaryProximity<T extends { lat: number; lng: number }>(
  locations: T[],
  installations: MilitaryInstallationRef[],
  maxDistanceKm: number = 80 // ~50 miles default
): T[] {
  return locations.filter(location => {
    return installations.some(installation => {
      const distance = haversineDistance(
        location.lat,
        location.lng,
        installation.lat,
        installation.lng
      );
      return distance <= maxDistanceKm;
    });
  });
}

/**
 * Correlate waterborne outbreaks with nearby water system violations
 */
export function correlateOutbreakWithViolations(
  outbreak: WaterborneOutbreak,
  violations: Array<{ id: string; lat?: number; lng?: number; violationDate: string; systemId: string }>
): string[] {
  const correlatedViolations: string[] = [];
  const maxDistanceKm = 10; // 6 miles radius for correlation
  const maxTimeDays = 90; // Consider violations within 90 days

  const outbreakDate = new Date(outbreak.reportDate);

  violations.forEach(violation => {
    if (!violation.lat || !violation.lng) return;

    // Check temporal correlation
    const violationDate = new Date(violation.violationDate);
    const daysDiff = Math.abs((outbreakDate.getTime() - violationDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > maxTimeDays) return;

    // Check spatial correlation
    const distance = haversineDistance(
      outbreak.lat,
      outbreak.lng,
      violation.lat,
      violation.lng
    );

    if (distance <= maxDistanceKm) {
      correlatedViolations.push(violation.id);
    }
  });

  return correlatedViolations;
}

/**
 * Calculate environmental health risk score based on multiple factors
 */
export function calculateEnvironmentalRiskScore(metric: EnvironmentalHealthMetric): number {
  let score = 0;
  let factors = 0;

  // Air quality component (0-25 points)
  if (metric.environmentalExposures.airQualityIndex !== undefined) {
    const aqi = metric.environmentalExposures.airQualityIndex;
    if (aqi > 150) score += 25;      // Unhealthy
    else if (aqi > 100) score += 18; // Unhealthy for sensitive groups
    else if (aqi > 50) score += 10;  // Moderate
    else score += 2;                 // Good
    factors++;
  }

  // Water violations component (0-25 points)
  if (metric.environmentalExposures.waterViolationDensity !== undefined) {
    const density = metric.environmentalExposures.waterViolationDensity;
    score += Math.min(25, density * 1000); // Scale violations per capita
    factors++;
  }

  // Health outcomes component (0-25 points)
  if (metric.healthOutcomes.respiratoryHospitalizations !== undefined) {
    const rate = metric.healthOutcomes.respiratoryHospitalizations;
    score += Math.min(25, rate / 100); // Scale hospitalization rate
    factors++;
  }

  // Environmental justice component (0-25 points)
  if (metric.environmentalJustice.ejScreenPercentile !== undefined) {
    score += (metric.environmentalJustice.ejScreenPercentile / 100) * 25;
    factors++;
  }

  // Return normalized score (0-100)
  return factors > 0 ? Math.round((score / factors) * 4) : 0;
}

/**
 * Generate correlation summary between health and environmental data
 */
export interface HealthEnvironmentCorrelation {
  correlationType: 'positive' | 'negative' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number; // 0-1
  description: string;
}

export function analyzeHealthEnvironmentCorrelation(
  healthOutcome: number,
  environmentalFactor: number,
  outcomeType: string,
  factorType: string
): HealthEnvironmentCorrelation {
  // Simple correlation analysis - could be enhanced with statistical methods
  const correlation = healthOutcome * environmentalFactor;

  let correlationType: 'positive' | 'negative' | 'neutral' = 'neutral';
  let strength: 'weak' | 'moderate' | 'strong' = 'weak';
  let confidence = 0.5;

  // Determine correlation direction and strength based on known relationships
  if (factorType.includes('violation') || factorType.includes('pollution')) {
    if (correlation > 0.7) {
      correlationType = 'positive';
      strength = 'strong';
      confidence = 0.8;
    } else if (correlation > 0.4) {
      correlationType = 'positive';
      strength = 'moderate';
      confidence = 0.6;
    }
  }

  return {
    correlationType,
    strength,
    confidence,
    description: `${strength} ${correlationType} correlation between ${outcomeType} and ${factorType}`,
  };
}

// ─── Data Validation Utilities ───────────────────────────────────────────────

export function validateHealthLocation<T extends Partial<HealthLocation>>(location: T): location is T & HealthLocation {
  return !!(
    location.lat &&
    location.lng &&
    location.state &&
    location.lat >= -90 &&
    location.lat <= 90 &&
    location.lng >= -180 &&
    location.lng <= 180
  );
}

export function validateHospitalFacility(hospital: Partial<HospitalFacility>): hospital is HospitalFacility {
  return !!(
    hospital.facilityId &&
    hospital.name &&
    validateHealthLocation(hospital) &&
    hospital.address &&
    hospital.city &&
    hospital.zipCode &&
    hospital.facilityType &&
    hospital.ownership &&
    typeof hospital.emergencyServices === 'boolean'
  );
}

export function validateWaterborneOutbreak(outbreak: Partial<WaterborneOutbreak>): outbreak is WaterborneOutbreak {
  return !!(
    outbreak.outbreakId &&
    outbreak.reportId &&
    validateHealthLocation(outbreak) &&
    outbreak.reportDate &&
    outbreak.illnessType &&
    outbreak.caseCount &&
    outbreak.caseCount > 0 &&
    outbreak.suspectedSource &&
    outbreak.investigationStatus
  );
}

export function validateEnvironmentalHealthMetric(metric: Partial<EnvironmentalHealthMetric>): metric is EnvironmentalHealthMetric {
  return !!(
    metric.locationId &&
    metric.locationType &&
    validateHealthLocation(metric) &&
    metric.population &&
    metric.population > 0 &&
    (metric.healthOutcomes || metric.environmentalExposures)
  );
}
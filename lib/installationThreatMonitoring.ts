/**
 * Installation Atmospheric Threat Monitoring — Comprehensive atmospheric dispersion
 * monitoring for all military installations covering explosions, chemical releases,
 * industrial accidents, and environmental threats.
 *
 * Expands beyond burn pit monitoring to protect all personnel from airborne threats
 * including blast debris, chemical plumes, industrial fallout, and radiological dispersion.
 */

import { estimatePlumeArrival, findTargetsAtRisk, Wind } from './plumeProjection';
import { haversineKm } from './geoUtils';
import { getNdbcCache } from './ndbcCache';
import installationsJson from '@/data/military-installations-fixed.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface MilitaryInstallation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  type: 'installation' | 'embassy';
  state: string | null;
  burnPitHistory: boolean;
}

export interface ThreatScenario {
  type: 'explosion' | 'chemical_release' | 'industrial_accident' | 'radiological' | 'biological' | 'burn_pit';
  severity: 'minor' | 'moderate' | 'major' | 'catastrophic';
  sourceDescription: string;
  particulateType: string; // e.g., "blast debris", "chlorine gas", "radioactive particles"
  hazardRadius: number; // km - immediate danger zone
  dispersalRadius: number; // km - maximum affected area
  exposureThresholds: {
    immediate: number; // minutes - immediate action required
    evacuation: number; // minutes - evacuation threshold
    extended: number; // hours - extended monitoring required
  };
}

export interface InstallationThreatAssessment {
  installationId: string;
  installationName: string;
  branch: string;
  region: string;
  personnelCount: number;
  currentRiskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  threats: Array<{
    scenario: ThreatScenario;
    probability: number; // 0-1 likelihood score
    impactRadius: number; // km affected
    estimatedCasualties: number;
    timeToImpact?: number; // minutes if threat detected
    windAlignment: 'favorable' | 'concerning' | 'dangerous';
    recommendations: string[];
  }>;
  atmosphericConditions: {
    windSpeed: number; // m/s
    windDirection: number; // degrees
    stability: 'very_unstable' | 'unstable' | 'neutral' | 'stable' | 'very_stable';
    visibility: number; // km
    temperature: number; // celsius
  };
  nearbyThreats: Array<{
    type: 'industrial_facility' | 'chemical_plant' | 'ammunition_depot' | 'nuclear_facility' | 'transportation_route';
    name: string;
    distance: number; // km
    threatLevel: 'low' | 'moderate' | 'high';
    description: string;
  }>;
  protectiveActions: {
    currentFPCON: 'normal' | 'alpha' | 'bravo' | 'charlie' | 'delta';
    recommendedFPCON: 'normal' | 'alpha' | 'bravo' | 'charlie' | 'delta';
    shelterInPlace: boolean;
    evacuationZones: string[];
    respiratoryProtection: 'none' | 'surgical_mask' | 'n95' | 'full_face' | 'scba';
  };
  nextAssessment: Date;
}

export interface AtmosphericThreatAlert {
  installationId: string;
  installationName: string;
  alertLevel: 'watch' | 'warning' | 'emergency';
  threatType: ThreatScenario['type'];
  message: string;
  affectedArea: string;
  estimatedDuration: number; // hours
  protectiveActions: string[];
  timeToImpact?: number; // minutes
  plumePath: Array<{ lat: number; lng: number; time: number }>; // tracking points
  timestamp: Date;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** All military installations requiring atmospheric threat monitoring */
const ALL_INSTALLATIONS: MilitaryInstallation[] = (installationsJson as any[])
  .filter(inst => inst.type === 'installation')
  .map(inst => ({
    id: inst.id,
    name: inst.name,
    lat: inst.lat,
    lng: inst.lng,
    region: inst.region,
    branch: inst.branch,
    type: inst.type,
    state: inst.state,
    burnPitHistory: inst.burnPitHistory || false,
  }));

/** Estimated personnel counts by installation type and region */
const PERSONNEL_ESTIMATES: Record<string, number> = {
  // Major bases
  'camp-arifjan': 13000,
  'al-udeid': 11000,
  'ramstein': 9000,
  'camp-humphreys': 8500,
  'camp-buehring': 8000,
  'camp-bondsteel': 7000,
  'yokota': 6500,
  'incirlik': 6000,
  'kadena': 12000,
  'al-dhafra': 5000,
  'camp-lemonnier': 4000,
  'ali-al-salem': 4000,
  'diego-garcia': 1500,
  'prince-sultan': 3000,
  'aviano': 4500,
  'grafenwoehr': 6000,
  'rota': 3000,
  'sigonella': 3500,
  'andersen': 6000,
  'pearl-harbor-hickam': 8000,
  // CONUS bases (larger populations)
  'fort-liberty': 50000,
  'fort-hood': 45000,
  'camp-pendleton': 40000,
  'jblm': 25000,
  'norfolk': 75000,
  'nellis': 8500,
  'eglin': 13000,
  'fort-campbell': 30000,
  'travis': 5000,
  'niamey': 800,
};

/** Standard threat scenarios by installation type */
const THREAT_SCENARIOS: Record<string, ThreatScenario[]> = {
  'overseas': [
    {
      type: 'explosion',
      severity: 'major',
      sourceDescription: 'Vehicle-borne IED or indirect fire impact',
      particulateType: 'blast debris, concrete dust, metal fragments',
      hazardRadius: 0.5,
      dispersalRadius: 5.0,
      exposureThresholds: { immediate: 2, evacuation: 10, extended: 120 },
    },
    {
      type: 'chemical_release',
      severity: 'major',
      sourceDescription: 'Industrial facility release or transportation accident',
      particulateType: 'toxic vapors, chlorine, ammonia, petroleum products',
      hazardRadius: 2.0,
      dispersalRadius: 25.0,
      exposureThresholds: { immediate: 5, evacuation: 30, extended: 360 },
    },
    {
      type: 'industrial_accident',
      severity: 'moderate',
      sourceDescription: 'Nearby industrial facility accident or fire',
      particulateType: 'smoke, particulates, toxic combustion products',
      hazardRadius: 1.0,
      dispersalRadius: 10.0,
      exposureThresholds: { immediate: 10, evacuation: 60, extended: 480 },
    },
  ],
  'conus': [
    {
      type: 'explosion',
      severity: 'moderate',
      sourceDescription: 'Training accident or ordnance incident',
      particulateType: 'blast debris, propellant residue',
      hazardRadius: 0.3,
      dispersalRadius: 2.0,
      exposureThresholds: { immediate: 5, evacuation: 15, extended: 60 },
    },
    {
      type: 'chemical_release',
      severity: 'moderate',
      sourceDescription: 'Transportation or industrial chemical release',
      particulateType: 'industrial chemicals, fuel vapors',
      hazardRadius: 1.0,
      dispersalRadius: 15.0,
      exposureThresholds: { immediate: 10, evacuation: 45, extended: 240 },
    },
  ],
};

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get all military installations requiring atmospheric threat monitoring.
 */
export function getAllMilitaryInstallations(): MilitaryInstallation[] {
  return ALL_INSTALLATIONS;
}

/**
 * Assess atmospheric threat conditions for a specific installation.
 */
export async function assessInstallationThreats(
  installationId: string,
  timeOfDay: 'day' | 'night' = 'day',
): Promise<InstallationThreatAssessment | null> {
  const installation = ALL_INSTALLATIONS.find(inst => inst.id === installationId);
  if (!installation) return null;

  const personnelCount = PERSONNEL_ESTIMATES[installationId] || 2000;

  // Get current wind/weather data
  const ndbcResult = getNdbcCache(installation.lat, installation.lng);
  let windSpeed = 5; // default m/s
  let windDirection = 270; // default west
  let temperature = 20; // default celsius

  if (ndbcResult?.stations?.length > 0) {
    // Find nearest station with wind data
    let bestStation = null;
    let bestDistance = Infinity;

    for (const station of ndbcResult.stations) {
      if (!station.observation?.windSpeed || !station.observation?.windDir) continue;
      const distance = haversineKm(installation.lat, installation.lng, station.lat, station.lng);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestStation = station;
      }
    }

    if (bestStation?.observation) {
      windSpeed = bestStation.observation.windSpeed;
      windDirection = bestStation.observation.windDir;
      temperature = bestStation.observation.temperature || 20;
    }
  }

  // Assess atmospheric stability
  const stability = assessAtmosphericStability(windSpeed, temperature, timeOfDay);

  // Determine threat scenarios based on location
  const isOverseas = installation.region !== 'conus';
  const scenarios = isOverseas ? THREAT_SCENARIOS.overseas : THREAT_SCENARIOS.conus;

  // Add burn pit scenario if applicable
  const threats = scenarios.map(scenario => {
    const windAlignment = assessWindAlignment(windSpeed, windDirection);
    const impactRadius = calculateThreatRadius(scenario, windSpeed, stability);
    const estimatedCasualties = Math.round(personnelCount * 0.1 * (impactRadius / 10)); // rough estimate

    return {
      scenario,
      probability: calculateThreatProbability(scenario, installation, isOverseas),
      impactRadius,
      estimatedCasualties,
      windAlignment,
      recommendations: generateThreatRecommendations(scenario, windAlignment, impactRadius),
    };
  });

  // Add burn pit threat if applicable
  if (installation.burnPitHistory) {
    threats.push({
      scenario: {
        type: 'burn_pit',
        severity: 'moderate',
        sourceDescription: 'On-base burn pit operations',
        particulateType: 'PM2.5, dioxins, volatile organic compounds',
        hazardRadius: 0.5,
        dispersalRadius: 5.0,
        exposureThresholds: { immediate: 60, evacuation: 180, extended: 720 },
      },
      probability: 0.8, // High if burn pits are active
      impactRadius: Math.min(5.0, 2.0 + windSpeed * 0.3),
      estimatedCasualties: Math.round(personnelCount * 0.05),
      windAlignment: assessWindAlignment(windSpeed, windDirection),
      recommendations: [
        'Monitor air quality continuously',
        'Limit burn pit operations during stable atmospheric conditions',
        'Issue respiratory protection for sensitive personnel',
      ],
    });
  }

  // Calculate overall risk level
  const maxThreatLevel = Math.max(...threats.map(t => t.probability * (t.scenario.severity === 'catastrophic' ? 4 : t.scenario.severity === 'major' ? 3 : t.scenario.severity === 'moderate' ? 2 : 1)));
  const currentRiskLevel: InstallationThreatAssessment['currentRiskLevel'] =
    maxThreatLevel >= 3 ? 'extreme' :
    maxThreatLevel >= 2 ? 'high' :
    maxThreatLevel >= 1 ? 'moderate' : 'low';

  // Identify nearby threats
  const nearbyThreats = await identifyNearbyThreats(installation.lat, installation.lng);

  // Determine protective actions
  const protectiveActions = determineProtectiveActions(currentRiskLevel, threats);

  return {
    installationId,
    installationName: installation.name,
    branch: installation.branch,
    region: installation.region,
    personnelCount,
    currentRiskLevel,
    threats,
    atmosphericConditions: {
      windSpeed,
      windDirection,
      stability,
      visibility: 10, // km - default
      temperature,
    },
    nearbyThreats,
    protectiveActions,
    nextAssessment: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
  };
}

/**
 * Generate atmospheric threat alerts for all installations.
 */
export async function generateInstallationThreatAlerts(): Promise<AtmosphericThreatAlert[]> {
  const alerts: AtmosphericThreatAlert[] = [];

  for (const installation of ALL_INSTALLATIONS) {
    const assessment = await assessInstallationThreats(installation.id);
    if (!assessment) continue;

    // Generate alerts based on threat level and conditions
    if (assessment.currentRiskLevel === 'extreme' || assessment.currentRiskLevel === 'high') {
      const primaryThreat = assessment.threats.sort((a, b) => b.probability - a.probability)[0];

      if (primaryThreat) {
        alerts.push({
          installationId: installation.id,
          installationName: installation.name,
          alertLevel: assessment.currentRiskLevel === 'extreme' ? 'emergency' : 'warning',
          threatType: primaryThreat.scenario.type,
          message: `${assessment.currentRiskLevel.toUpperCase()} atmospheric threat: ${primaryThreat.scenario.sourceDescription}. ${primaryThreat.windAlignment === 'dangerous' ? 'Adverse wind conditions detected.' : ''}`,
          affectedArea: `${primaryThreat.impactRadius}km radius`,
          estimatedDuration: primaryThreat.scenario.exposureThresholds.extended / 60,
          protectiveActions: primaryThreat.recommendations,
          plumePath: [], // Would be populated with actual dispersion modeling
          timestamp: new Date(),
        });
      }
    }
  }

  return alerts;
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function assessAtmosphericStability(windSpeed: number, temperature: number, timeOfDay: 'day' | 'night') {
  if (windSpeed < 2) return timeOfDay === 'day' ? 'unstable' : 'very_stable';
  if (windSpeed < 3) return timeOfDay === 'day' ? 'neutral' : 'stable';
  if (windSpeed < 5) return 'neutral';
  return timeOfDay === 'day' ? 'unstable' : 'neutral';
}

function assessWindAlignment(windSpeed: number, windDirection: number): 'favorable' | 'concerning' | 'dangerous' {
  if (windSpeed < 2) return 'dangerous'; // Stagnant conditions
  if (windSpeed > 15) return 'concerning'; // High dispersion but long transport
  return 'favorable'; // Normal dispersion
}

function calculateThreatRadius(scenario: ThreatScenario, windSpeed: number, stability: string): number {
  let radius = scenario.dispersalRadius;

  // Adjust for wind
  if (windSpeed < 2) radius *= 0.5; // Limited dispersion
  else if (windSpeed > 10) radius *= 1.5; // Enhanced dispersion

  // Adjust for stability
  if (stability === 'very_stable') radius *= 0.6;
  else if (stability === 'very_unstable') radius *= 1.3;

  return Math.min(50, Math.max(0.5, radius)); // 0.5-50km range
}

function calculateThreatProbability(scenario: ThreatScenario, installation: MilitaryInstallation, isOverseas: boolean): number {
  let baseProbability = 0.1; // 10% base

  // Adjust for region
  if (isOverseas) baseProbability *= 2.0; // Higher overseas threat
  if (installation.region === 'middle-east') baseProbability *= 1.5; // Higher Middle East threat

  // Adjust for threat type
  if (scenario.type === 'explosion' && isOverseas) baseProbability *= 2.0;
  if (scenario.type === 'chemical_release') baseProbability *= 1.2; // Industrial activity

  return Math.min(1.0, baseProbability);
}

function generateThreatRecommendations(scenario: ThreatScenario, windAlignment: string, impactRadius: number): string[] {
  const recs: string[] = [];

  if (scenario.severity === 'catastrophic' || scenario.severity === 'major') {
    recs.push('Implement immediate shelter-in-place procedures');
    recs.push('Issue emergency notifications to all personnel');
  }

  if (windAlignment === 'dangerous') {
    recs.push('Monitor atmospheric conditions continuously');
    recs.push('Prepare for potential evacuation');
  }

  if (scenario.type === 'chemical_release') {
    recs.push('Issue full respiratory protection');
    recs.push('Seal buildings and activate positive pressure systems');
  }

  if (scenario.type === 'explosion') {
    recs.push('Account for all personnel');
    recs.push('Secure area for potential secondary devices');
  }

  recs.push(`Monitor ${impactRadius.toFixed(1)}km radius for affected areas`);

  return recs;
}

async function identifyNearbyThreats(lat: number, lng: number) {
  // This would integrate with industrial facility databases, transportation routes, etc.
  // For now, return placeholder data
  return [
    {
      type: 'transportation_route' as const,
      name: 'Highway chemical transport route',
      distance: 5.0,
      threatLevel: 'moderate' as const,
      description: 'Major highway with hazmat transport',
    },
  ];
}

function determineProtectiveActions(riskLevel: string, threats: any[]) {
  return {
    currentFPCON: 'normal' as const,
    recommendedFPCON: riskLevel === 'extreme' ? 'charlie' as const : riskLevel === 'high' ? 'bravo' as const : 'normal' as const,
    shelterInPlace: riskLevel === 'extreme',
    evacuationZones: riskLevel === 'extreme' ? ['Downwind areas'] : [],
    respiratoryProtection: riskLevel === 'extreme' ? 'scba' as const : riskLevel === 'high' ? 'full_face' as const : 'none' as const,
  };
}

/**
 * Get comprehensive threat monitoring dashboard for all installations.
 */
export async function getAllInstallationThreats() {
  const assessments = await Promise.all(
    ALL_INSTALLATIONS.map(inst => assessInstallationThreats(inst.id))
  );

  const validAssessments = assessments.filter(Boolean) as InstallationThreatAssessment[];
  const alerts = await generateInstallationThreatAlerts();

  const riskCounts = {
    minimal: validAssessments.filter(a => a.currentRiskLevel === 'minimal').length,
    low: validAssessments.filter(a => a.currentRiskLevel === 'low').length,
    moderate: validAssessments.filter(a => a.currentRiskLevel === 'moderate').length,
    high: validAssessments.filter(a => a.currentRiskLevel === 'high').length,
    extreme: validAssessments.filter(a => a.currentRiskLevel === 'extreme').length,
  };

  return {
    timestamp: new Date(),
    totalInstallations: ALL_INSTALLATIONS.length,
    assessments: validAssessments,
    alerts,
    summary: {
      totalPersonnel: validAssessments.reduce((sum, a) => sum + a.personnelCount, 0),
      installationsAtRisk: riskCounts.high + riskCounts.extreme,
      riskDistribution: riskCounts,
      criticalAlerts: alerts.filter(a => a.alertLevel === 'emergency').length,
    },
    byRegion: {
      'middle-east': validAssessments.filter(a => a.region === 'middle-east'),
      'indo-pacific': validAssessments.filter(a => a.region === 'indo-pacific'),
      africa: validAssessments.filter(a => a.region === 'africa'),
      europe: validAssessments.filter(a => a.region === 'europe'),
      conus: validAssessments.filter(a => a.region === 'conus'),
    },
  };
}
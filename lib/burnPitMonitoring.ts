/**
 * Burn Pit Atmospheric Monitoring — Real-time particulate dispersion tracking
 * for installations with burn pit operations.
 *
 * Monitors atmospheric conditions that could affect personnel exposure to
 * particulates from burn pits, including dioxins, PHCs, and other harmful compounds.
 * Provides installation-specific alerts based on wind patterns and atmospheric stability.
 */

import { estimatePlumeArrival, findTargetsAtRisk, Wind } from './plumeProjection';
import { haversineKm } from './geoUtils';
import { getNdbcCache } from './ndbcCache';
import installationsJson from '@/data/military-installations-fixed.json';
import { getBurnPitConfig, getAllBurnPitConfigs, BurnPitInstallationConfig } from './burnPitConfig';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BurnPitInstallation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  type: 'installation' | 'embassy';
}

export interface BurnPitAlert {
  installationId: string;
  installationName: string;
  severity: 'low' | 'moderate' | 'high' | 'extreme';
  alertType: 'wind_direction' | 'atmospheric_stability' | 'particulate_risk' | 'evacuation_required';
  message: string;
  recommendations: string[];
  windSpeed: number; // m/s
  windDirection: number; // degrees
  estimatedExposureRadius: number; // km
  timestamp: Date;
}

export interface AtmosphericConditions {
  windSpeed: number; // m/s
  windDirection: number; // degrees
  stability: 'very_unstable' | 'unstable' | 'neutral' | 'stable' | 'very_stable';
  mixingHeight: number; // meters
  temperature: number; // celsius
  relativeHumidity: number; // percentage
}

export interface BurnPitRiskAssessment {
  installationId: string;
  installationName: string;
  riskLevel: 'minimal' | 'low' | 'moderate' | 'high' | 'extreme';
  particulateDispersionRadius: number; // km
  personnelAtRisk: number; // estimated count
  windAlignment: 'favorable' | 'concerning' | 'dangerous';
  atmosphericStability: 'dispersive' | 'neutral' | 'accumulative';
  recommendations: string[];
  nextUpdate: Date;
}

// ── Constants ────────────────────────────────────────────────────────────────

/** EPA exposure thresholds for burn pit particulates (μg/m³) */
const PARTICULATE_THRESHOLDS = {
  PM25: {
    minimal: 12,    // WHO annual guideline
    moderate: 35,   // EPA 24-hr standard
    high: 55,       // Unhealthy for sensitive groups
    extreme: 150,   // Unhealthy for all
  },
  PM10: {
    minimal: 20,    // WHO annual guideline
    moderate: 50,   // WHO 24-hr guideline
    high: 150,      // EPA 24-hr standard
    extreme: 250,   // Hazardous
  },
} as const;

/** Wind speed thresholds for particulate dispersion (m/s) */
const WIND_THRESHOLDS = {
  calm: 2,          // Particulate accumulation risk
  moderate: 5,      // Normal dispersion
  high: 10,         // Rapid dispersion but wide spread
  extreme: 15,      // Extreme dispersal, long-range transport
} as const;

/** Burn pit installations with particulate monitoring */
const BURN_PIT_INSTALLATIONS: BurnPitInstallation[] = (installationsJson as any[])
  .filter(inst => inst.burnPitHistory === true)
  .map(inst => ({
    id: inst.id,
    name: inst.name,
    lat: inst.lat,
    lng: inst.lng,
    region: inst.region,
    branch: inst.branch,
    type: inst.type || 'installation',
  }));

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * Get all installations with burn pit history requiring atmospheric monitoring.
 */
export function getBurnPitInstallations(): BurnPitInstallation[] {
  return BURN_PIT_INSTALLATIONS;
}

/**
 * Assess atmospheric stability for particulate dispersion.
 * Uses simplified Pasquill-Gifford classification.
 */
function assessAtmosphericStability(
  windSpeed: number,
  temperature: number,
  timeOfDay: 'day' | 'night',
): AtmosphericConditions['stability'] {
  // Simplified stability assessment
  if (windSpeed < 2) {
    return timeOfDay === 'day' ? 'unstable' : 'very_stable';
  } else if (windSpeed < 3) {
    return timeOfDay === 'day' ? 'neutral' : 'stable';
  } else if (windSpeed < 5) {
    return 'neutral';
  } else {
    return timeOfDay === 'day' ? 'unstable' : 'neutral';
  }
}

/**
 * Calculate particulate dispersion radius based on atmospheric conditions.
 * Uses simplified Gaussian plume parameters.
 */
function calculateDispersionRadius(
  windSpeed: number,
  stability: AtmosphericConditions['stability'],
  sourceStrength = 1.0, // normalized burn pit intensity
): number {
  // Base radius in km
  let baseRadius = 2.0;

  // Wind speed factor
  if (windSpeed < WIND_THRESHOLDS.calm) {
    baseRadius *= 0.5; // Localized accumulation
  } else if (windSpeed > WIND_THRESHOLDS.high) {
    baseRadius *= 3.0; // Wide dispersion
  }

  // Stability factor
  switch (stability) {
    case 'very_unstable':
      baseRadius *= 1.5; // Good mixing, wider dispersion
      break;
    case 'unstable':
      baseRadius *= 1.2;
      break;
    case 'stable':
      baseRadius *= 0.8; // Limited mixing
      break;
    case 'very_stable':
      baseRadius *= 0.4; // Poor dispersion, accumulation
      break;
    default: // neutral
      baseRadius *= 1.0;
  }

  return Math.max(0.5, Math.min(50, baseRadius)); // 0.5-50km range
}

/**
 * Assess burn pit particulate risk for a specific installation.
 */
export async function assessBurnPitRisk(
  installationId: string,
  timeOfDay: 'day' | 'night' = 'day',
): Promise<BurnPitRiskAssessment | null> {
  const installation = BURN_PIT_INSTALLATIONS.find(inst => inst.id === installationId);
  if (!installation) return null;

  const config = getBurnPitConfig(installationId);
  if (!config) {
    console.warn(`No burn pit configuration found for installation: ${installationId}`);
    // Fall back to basic assessment without config
  }

  // Get current wind data
  const ndbcResult = getNdbcCache(installation.lat, installation.lng);
  if (!ndbcResult || ndbcResult.stations.length === 0) {
    return {
      installationId,
      installationName: installation.name,
      riskLevel: 'moderate', // Default when no wind data
      particulateDispersionRadius: 2.0,
      personnelAtRisk: 1000, // Estimated base personnel
      windAlignment: 'concerning',
      atmosphericStability: 'neutral',
      recommendations: [
        'No current wind data available',
        'Use local meteorological observations',
        'Consider suspending burn pit operations until conditions are known',
        'Monitor personnel for respiratory symptoms',
      ],
      nextUpdate: new Date(Date.now() + 30 * 60 * 1000), // 30 min
    };
  }

  // Find nearest weather station with wind data
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

  if (!bestStation?.observation) {
    return {
      installationId,
      installationName: installation.name,
      riskLevel: 'moderate',
      particulateDispersionRadius: 2.0,
      personnelAtRisk: 1000,
      windAlignment: 'concerning',
      atmosphericStability: 'neutral',
      recommendations: [
        'No wind observations available from nearby stations',
        'Use on-base meteorological equipment',
        'Default to conservative burn pit protocols',
      ],
      nextUpdate: new Date(Date.now() + 30 * 60 * 1000),
    };
  }

  const obs = bestStation.observation;
  const windSpeed = obs.windSpeed; // m/s
  const windDirection = obs.windDir; // degrees
  const temperature = obs.temperature || 20; // default if missing

  // Assess atmospheric conditions
  const stability = assessAtmosphericStability(windSpeed, temperature, timeOfDay);
  const dispersionRadius = calculateDispersionRadius(windSpeed, stability);

  // Determine risk level based on conditions
  let riskLevel: BurnPitRiskAssessment['riskLevel'] = 'minimal';
  let windAlignment: BurnPitRiskAssessment['windAlignment'] = 'favorable';
  let atmosphericStability: BurnPitRiskAssessment['atmosphericStability'] = 'dispersive';

  // Wind speed assessment using installation-specific thresholds
  const calmThreshold = config?.windThresholds.calm || WIND_THRESHOLDS.calm;
  const transportThreshold = config?.windThresholds.transport || WIND_THRESHOLDS.extreme;

  if (windSpeed < calmThreshold) {
    riskLevel = 'high'; // Particulate accumulation
    windAlignment = 'dangerous';
    atmosphericStability = 'accumulative';
  } else if (windSpeed > transportThreshold) {
    riskLevel = 'moderate'; // Wide dispersal but long-range transport
    windAlignment = 'concerning';
  }

  // Stability assessment
  if (stability === 'very_stable' || stability === 'stable') {
    riskLevel = Math.max(riskLevel === 'minimal' ? 0 :
                        riskLevel === 'low' ? 1 :
                        riskLevel === 'moderate' ? 2 :
                        riskLevel === 'high' ? 3 : 4, 2) as any; // Bump to at least moderate
    atmosphericStability = 'accumulative';
  }

  // Estimate personnel at risk using installation configuration
  const basePersonnelCount = config?.personnelCount || 2000; // Default estimate
  const exposureRatio = Math.min(1.0, dispersionRadius / 5.0); // Assume 5km covers most of base
  const personnelAtRisk = Math.round(basePersonnelCount * exposureRatio);

  // Generate recommendations
  const recommendations: string[] = [];

  if (riskLevel === 'extreme') {
    recommendations.push('IMMEDIATE: Cease all burn pit operations');
    recommendations.push('Evacuate personnel from downwind areas');
    recommendations.push('Issue respiratory protection orders');
    recommendations.push('Activate emergency medical protocols');
  } else if (riskLevel === 'high') {
    recommendations.push('Suspend burn pit operations until conditions improve');
    recommendations.push('Issue health advisories to personnel');
    recommendations.push('Restrict outdoor activities in affected areas');
    recommendations.push('Monitor air quality continuously');
  } else if (riskLevel === 'moderate') {
    recommendations.push('Limit burn pit operations to essential waste only');
    recommendations.push('Advise sensitive individuals to avoid downwind areas');
    recommendations.push('Increase air quality monitoring frequency');
    recommendations.push('Prepare for escalation if conditions worsen');
  } else {
    recommendations.push('Normal burn pit operations may proceed');
    recommendations.push('Continue routine air quality monitoring');
    recommendations.push('Monitor weather conditions for changes');
  }

  return {
    installationId,
    installationName: installation.name,
    riskLevel,
    particulateDispersionRadius: Math.round(dispersionRadius * 10) / 10,
    personnelAtRisk,
    windAlignment,
    atmosphericStability,
    recommendations,
    nextUpdate: new Date(Date.now() + 15 * 60 * 1000), // 15 min updates
  };
}

/**
 * Generate burn pit alerts for all installations based on current atmospheric conditions.
 */
export async function generateBurnPitAlerts(): Promise<BurnPitAlert[]> {
  const alerts: BurnPitAlert[] = [];
  const currentHour = new Date().getUTCHours();
  const timeOfDay = (currentHour >= 6 && currentHour < 18) ? 'day' : 'night';

  for (const installation of BURN_PIT_INSTALLATIONS) {
    const assessment = await assessBurnPitRisk(installation.id, timeOfDay);
    if (!assessment) continue;

    // Generate alerts based on risk level
    if (assessment.riskLevel === 'extreme') {
      alerts.push({
        installationId: installation.id,
        installationName: installation.name,
        severity: 'extreme',
        alertType: 'evacuation_required',
        message: `EXTREME PARTICULATE RISK: Atmospheric conditions pose immediate health hazard. Cease burn pit operations and evacuate downwind areas within ${assessment.particulateDispersionRadius}km.`,
        recommendations: assessment.recommendations,
        windSpeed: 0, // Will be filled from weather data
        windDirection: 0,
        estimatedExposureRadius: assessment.particulateDispersionRadius,
        timestamp: new Date(),
      });
    } else if (assessment.riskLevel === 'high') {
      alerts.push({
        installationId: installation.id,
        installationName: installation.name,
        severity: 'high',
        alertType: 'particulate_risk',
        message: `HIGH PARTICULATE RISK: ${assessment.atmosphericStability === 'accumulative' ? 'Poor atmospheric dispersion' : 'Adverse wind conditions'} detected. Suspend burn pit operations.`,
        recommendations: assessment.recommendations,
        windSpeed: 0,
        windDirection: 0,
        estimatedExposureRadius: assessment.particulateDispersionRadius,
        timestamp: new Date(),
      });
    } else if (assessment.riskLevel === 'moderate') {
      alerts.push({
        installationId: installation.id,
        installationName: installation.name,
        severity: 'moderate',
        alertType: 'atmospheric_stability',
        message: `MODERATE PARTICULATE RISK: Atmospheric conditions may affect burn pit dispersion. Monitor closely and limit operations.`,
        recommendations: assessment.recommendations,
        windSpeed: 0,
        windDirection: 0,
        estimatedExposureRadius: assessment.particulateDispersionRadius,
        timestamp: new Date(),
      });
    }
  }

  return alerts;
}

/**
 * Check if burn pit operations should be suspended at a specific installation.
 */
export async function shouldSuspendBurnPitOps(installationId: string): Promise<{
  suspend: boolean;
  reason: string;
  estimatedClearTime?: Date;
}> {
  const assessment = await assessBurnPitRisk(installationId);
  if (!assessment) {
    return {
      suspend: true,
      reason: 'Unable to assess atmospheric conditions',
    };
  }

  if (assessment.riskLevel === 'extreme' || assessment.riskLevel === 'high') {
    return {
      suspend: true,
      reason: `${assessment.riskLevel.toUpperCase()} particulate risk due to ${assessment.atmosphericStability === 'accumulative' ? 'poor atmospheric dispersion' : 'adverse wind conditions'}`,
      estimatedClearTime: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours typical
    };
  }

  return {
    suspend: false,
    reason: `Current conditions acceptable for burn pit operations (${assessment.riskLevel} risk)`,
  };
}

/**
 * Get real-time burn pit monitoring dashboard data for all installations.
 */
export async function getBurnPitMonitoringDashboard() {
  const assessments = await Promise.all(
    BURN_PIT_INSTALLATIONS.map(inst => assessBurnPitRisk(inst.id))
  );

  const validAssessments = assessments.filter(Boolean) as BurnPitRiskAssessment[];
  const alerts = await generateBurnPitAlerts();

  // Summary statistics
  const riskCounts = {
    minimal: validAssessments.filter(a => a.riskLevel === 'minimal').length,
    low: validAssessments.filter(a => a.riskLevel === 'low').length,
    moderate: validAssessments.filter(a => a.riskLevel === 'moderate').length,
    high: validAssessments.filter(a => a.riskLevel === 'high').length,
    extreme: validAssessments.filter(a => a.riskLevel === 'extreme').length,
  };

  const totalPersonnelAtRisk = validAssessments.reduce((sum, a) => sum + a.personnelAtRisk, 0);
  const suspensionRequired = validAssessments.filter(a =>
    a.riskLevel === 'extreme' || a.riskLevel === 'high'
  ).length;

  return {
    timestamp: new Date(),
    totalInstallations: BURN_PIT_INSTALLATIONS.length,
    assessments: validAssessments,
    alerts,
    summary: {
      riskDistribution: riskCounts,
      totalPersonnelAtRisk,
      installationsRequiringSuspension: suspensionRequired,
      highestRiskInstallation: validAssessments.sort((a, b) => {
        const riskOrder = { minimal: 0, low: 1, moderate: 2, high: 3, extreme: 4 };
        return riskOrder[b.riskLevel] - riskOrder[a.riskLevel];
      })[0]?.installationName || 'None',
    },
    regions: {
      'middle-east': validAssessments.filter(a =>
        BURN_PIT_INSTALLATIONS.find(i => i.id === a.installationId)?.region === 'middle-east'
      ),
      africa: validAssessments.filter(a =>
        BURN_PIT_INSTALLATIONS.find(i => i.id === a.installationId)?.region === 'africa'
      ),
      'indo-pacific': validAssessments.filter(a =>
        BURN_PIT_INSTALLATIONS.find(i => i.id === a.installationId)?.region === 'indo-pacific'
      ),
      europe: validAssessments.filter(a =>
        BURN_PIT_INSTALLATIONS.find(i => i.id === a.installationId)?.region === 'europe'
      ),
    },
  };
}
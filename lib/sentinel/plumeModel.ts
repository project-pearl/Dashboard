/* ------------------------------------------------------------------ */
/*  Gaussian Plume Model — Wind-Aware Threat Scoring                  */
/*                                                                    */
/*  Estimates whether a target (installation, water intake, facility) */
/*  is downwind of a hazard source and computes:                      */
/*   - Arrival time and exposure category                             */
/*   - Evacuation zone dimensions (Pasquill-Gifford dispersion)      */
/*   - Scoring adjustment for the Sentinel compound pattern engine    */
/*                                                                    */
/*  Key constraint: we cannot know what is burning or releasing.      */
/*  All thresholds use EPA ERG "unknown material" protective action   */
/*  distances, refined by atmospheric stability class.                */
/* ------------------------------------------------------------------ */

import type { ChangeEvent } from './types';
import type { NdbcStation } from '../ndbcCache';
import { getNdbcCache } from '../ndbcCache';
import { getSdwisCache } from '../sdwisCache';
import { getEchoCache } from '../echoCache';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface PlumeTarget {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'installation' | 'water-intake' | 'industrial' | 'embassy';
}

export type ExposureCategory = 'direct' | 'partial' | 'perpendicular' | 'upwind';

/**
 * Pasquill-Gifford atmospheric stability classes.
 *
 * A = very unstable (sunny, light wind)  → wide, fast-dispersing plume
 * D = neutral (overcast or strong wind)  → moderate plume
 * F = very stable (clear night, calm)    → narrow, far-reaching plume (worst case)
 */
export type StabilityClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface PlumeResult {
  distanceKm: number;
  bearingDeg: number;
  alignmentDeg: number;
  downwindDistanceKm: number;
  crosswindDistanceKm: number;
  arrivalTimeHours: number | null;
  exposure: ExposureCategory;
  windDirDeg: number;
  windSpeedMs: number;
}

export interface EvacuationZone {
  stabilityClass: StabilityClass;
  /** All-direction isolation radius (m) — per EPA ERG for unknown material */
  innerRadiusM: number;
  /** Downwind protective action distance (m) */
  downwindExtentM: number;
  /** Crosswind half-width at the downwind extent (m) */
  crosswindHalfWidthM: number;
  /** Direction the plume travels — opposite of meteorological wind dir (0–360°) */
  blowDirectionDeg: number;
  /** Whether night-time stability was assumed (more conservative) */
  isNighttime: boolean;
}

export interface AffectedTarget {
  id: string;
  name: string;
  category: PlumeTarget['category'];
  distanceKm: number;
  exposure: ExposureCategory;
  arrivalTimeHours: number | null;
  inEvacZone: boolean;
}

/* ------------------------------------------------------------------ */
/*  Geo Utilities                                                     */
/* ------------------------------------------------------------------ */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const EARTH_RADIUS_KM = 6371;

/** Haversine distance between two lat/lng points in km. */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLat = (lat2 - lat1) * DEG2RAD;
  const dLng = (lng2 - lng1) * DEG2RAD;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) *
    Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing from point A to point B in degrees (0–360). */
function bearingDeg(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const dLng = (lng2 - lng1) * DEG2RAD;
  const y = Math.sin(dLng) * Math.cos(lat2 * DEG2RAD);
  const x =
    Math.cos(lat1 * DEG2RAD) * Math.sin(lat2 * DEG2RAD) -
    Math.sin(lat1 * DEG2RAD) * Math.cos(lat2 * DEG2RAD) * Math.cos(dLng);
  return ((Math.atan2(y, x) * RAD2DEG) + 360) % 360;
}

/** Shortest angular difference (0–180). */
function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/* ------------------------------------------------------------------ */
/*  Pasquill-Gifford Atmospheric Stability                            */
/* ------------------------------------------------------------------ */

/**
 * Estimate atmospheric stability class from wind speed and time of day.
 *
 * Simplified Turner (1970) method. Without solar radiation and cloud
 * cover data we use a conservative day/night split:
 *
 * | Wind (m/s) | Day        | Night      |
 * |------------|------------|------------|
 * |   < 2      | A (unstab) | F (stable) |
 * |   2–3      | B          | F          |
 * |   3–5      | C          | E          |
 * |   5–6      | D          | D          |
 * |   > 6      | D          | D          |
 */
export function estimateStabilityClass(
  windSpeedMs: number,
  isDaytime: boolean,
): StabilityClass {
  if (windSpeedMs >= 5) return 'D';

  if (isDaytime) {
    if (windSpeedMs < 2) return 'A';
    if (windSpeedMs < 3) return 'B';
    return 'C';
  }

  // Nighttime — more stable, plume travels further
  if (windSpeedMs < 3) return 'F';
  return 'E';
}

/**
 * Briggs (1973) dispersion coefficients for open/rural terrain.
 *
 * Returns sigma_y and sigma_z in metres for a given downwind distance x (metres).
 * These define the Gaussian plume width at each distance.
 */
export function dispersionCoefficients(
  xMetres: number,
  stability: StabilityClass,
): { sigmaY: number; sigmaZ: number } {
  const x = Math.max(1, xMetres); // avoid zero

  switch (stability) {
    case 'A':
      return {
        sigmaY: 0.22 * x * (1 + 0.0001 * x) ** -0.5,
        sigmaZ: 0.20 * x,
      };
    case 'B':
      return {
        sigmaY: 0.16 * x * (1 + 0.0001 * x) ** -0.5,
        sigmaZ: 0.12 * x,
      };
    case 'C':
      return {
        sigmaY: 0.11 * x * (1 + 0.0001 * x) ** -0.5,
        sigmaZ: 0.08 * x * (1 + 0.0002 * x) ** -0.5,
      };
    case 'D':
      return {
        sigmaY: 0.08 * x * (1 + 0.0001 * x) ** -0.5,
        sigmaZ: 0.06 * x * (1 + 0.0015 * x) ** -0.5,
      };
    case 'E':
      return {
        sigmaY: 0.06 * x * (1 + 0.0001 * x) ** -0.5,
        sigmaZ: 0.03 * x * (1 + 0.0003 * x) ** -1,
      };
    case 'F':
      return {
        sigmaY: 0.04 * x * (1 + 0.0001 * x) ** -0.5,
        sigmaZ: 0.016 * x * (1 + 0.0003 * x) ** -1,
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Evacuation Zone Computation                                       */
/* ------------------------------------------------------------------ */

/**
 * Compute protective action zones for an unknown hazardous release.
 *
 * Since we cannot identify the material, we use EPA ERG Table 1
 * "unknown material" as the baseline, then refine using Pasquill-Gifford
 * dispersion to give a plume-shaped (not circular) evacuation zone:
 *
 * - Inner zone: 200m all-direction isolation (ERG unknown large spill)
 * - Downwind zone: distance where Gaussian concentration drops to 10%
 *   of the source-adjacent level, using stability-dependent dispersion
 * - Crosswind width: 2.15 × sigma_y at the downwind extent
 *   (where concentration drops to 10% of the centreline at that distance)
 *
 * EPA ERG reference distances for unknown material (large spill):
 *   Day:   1.1 km downwind
 *   Night: 3.5 km downwind
 *
 * Our model refines these based on actual wind speed and stability.
 */
export function computeEvacuationZone(
  windSpeedMs: number,
  isDaytime: boolean,
  windDirDeg: number,
): EvacuationZone {
  const stability = estimateStabilityClass(windSpeedMs, isDaytime);
  const blowDir = (windDirDeg + 180) % 360;

  // Inner isolation: 200m for unknown large spill (EPA ERG Table 1)
  const innerRadiusM = 200;

  // Downwind extent: find distance where concentration drops to 10% of max.
  //
  // Ground-level centreline concentration ∝ 1 / (sigma_y × sigma_z).
  // At x=0 (hypothetical) concentration is max. We find x where
  //   sigma_y(x) × sigma_z(x) = 10 × sigma_y(x₀) × sigma_z(x₀)
  // where x₀ = innerRadiusM (the reference near-source point).
  //
  // We solve iteratively since sigma equations are nonlinear.
  const refSigma = dispersionCoefficients(innerRadiusM, stability);
  const refProduct = refSigma.sigmaY * refSigma.sigmaZ;
  const thresholdProduct = refProduct * 10; // 10× dispersion = 10% concentration

  // EPA ERG bounds: don't go below day/night minimums
  const ergMinM = isDaytime ? 1100 : 3500;

  let downwindExtentM = ergMinM;
  // Step outward in 100m increments to find where dispersion exceeds threshold
  for (let x = innerRadiusM + 100; x <= 10000; x += 100) {
    const s = dispersionCoefficients(x, stability);
    if (s.sigmaY * s.sigmaZ >= thresholdProduct) {
      downwindExtentM = Math.max(ergMinM, x);
      break;
    }
    if (x === 10000) {
      // Reached max search distance — use ERG fallback
      downwindExtentM = Math.max(ergMinM, 10000);
    }
  }

  // Crosswind half-width at the downwind extent
  // 10% of centreline: exp(-0.5 × (y/σ_y)²) = 0.10 → y = σ_y × √(2 × ln(10)) ≈ 2.15 × σ_y
  const extentSigma = dispersionCoefficients(downwindExtentM, stability);
  const crosswindHalfWidthM = Math.round(2.146 * extentSigma.sigmaY);

  return {
    stabilityClass: stability,
    innerRadiusM,
    downwindExtentM: Math.round(downwindExtentM),
    crosswindHalfWidthM,
    blowDirectionDeg: Math.round(blowDir * 10) / 10,
    isNighttime: !isDaytime,
  };
}

/** Check if a target falls within the evacuation zone. */
export function isInEvacZone(
  sourceLat: number, sourceLng: number,
  targetLat: number, targetLng: number,
  zone: EvacuationZone,
): boolean {
  const distKm = haversineKm(sourceLat, sourceLng, targetLat, targetLng);
  const distM = distKm * 1000;

  // Inside inner isolation radius → always in zone
  if (distM <= zone.innerRadiusM) return true;

  // Check if within the plume-shaped zone
  const brng = bearingDeg(sourceLat, sourceLng, targetLat, targetLng);
  const alignment = angleDiff(zone.blowDirectionDeg, brng);

  // Upwind or far off-axis → not in zone
  if (alignment > 90) return false;

  const alignRad = alignment * DEG2RAD;
  const downwindM = distM * Math.cos(alignRad);
  const crosswindM = Math.abs(distM * Math.sin(alignRad));

  return downwindM <= zone.downwindExtentM && crosswindM <= zone.crosswindHalfWidthM;
}

/* ------------------------------------------------------------------ */
/*  Plume Arrival Estimate                                            */
/* ------------------------------------------------------------------ */

export function estimatePlumeArrival(
  sourceLat: number, sourceLng: number,
  targetLat: number, targetLng: number,
  windDirDeg: number,
  windSpeedMs: number,
): PlumeResult {
  const distKm = haversineKm(sourceLat, sourceLng, targetLat, targetLng);
  const bearingToTarget = bearingDeg(sourceLat, sourceLng, targetLat, targetLng);
  const blowDir = (windDirDeg + 180) % 360;
  const alignment = angleDiff(blowDir, bearingToTarget);

  const alignRad = alignment * DEG2RAD;
  const downwindKm = distKm * Math.cos(alignRad);
  const crosswindKm = distKm * Math.sin(alignRad);

  let exposure: ExposureCategory;
  if (alignment > 90) exposure = 'upwind';
  else if (alignment > 60) exposure = 'perpendicular';
  else if (alignment > 30) exposure = 'partial';
  else exposure = 'direct';

  let arrivalTimeHours: number | null = null;
  if (downwindKm > 0 && windSpeedMs > 0.5) {
    arrivalTimeHours = (downwindKm * 1000) / windSpeedMs / 3600;
  }

  return {
    distanceKm: Math.round(distKm * 100) / 100,
    bearingDeg: Math.round(bearingToTarget * 10) / 10,
    alignmentDeg: Math.round(alignment * 10) / 10,
    downwindDistanceKm: Math.round(downwindKm * 100) / 100,
    crosswindDistanceKm: Math.round(crosswindKm * 100) / 100,
    arrivalTimeHours: arrivalTimeHours != null
      ? Math.round(arrivalTimeHours * 100) / 100
      : null,
    exposure,
    windDirDeg,
    windSpeedMs,
  };
}

/* ------------------------------------------------------------------ */
/*  Scoring Adjustment                                                */
/* ------------------------------------------------------------------ */

/**
 * Map a plume result to a scoring adjustment (additive to pattern multiplier).
 *
 * | Exposure   | Arrival      | Adjustment |
 * |------------|--------------|------------|
 * | direct     | < 1 hr       | +0.50      |
 * | direct     | 1–4 hr       | +0.30      |
 * | direct     | > 4 hr       | +0.15      |
 * | partial    | any          | +0.15      |
 * | perp/upwind| any          | +0.00      |
 */
export function computePlumeAdjustment(result: PlumeResult): number {
  if (result.exposure === 'upwind' || result.exposure === 'perpendicular') return 0;
  if (result.exposure === 'partial') return 0.15;
  if (result.arrivalTimeHours != null) {
    if (result.arrivalTimeHours < 1) return 0.50;
    if (result.arrivalTimeHours <= 4) return 0.30;
    return 0.15;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/*  Wind Lookup                                                       */
/* ------------------------------------------------------------------ */

/** Find the nearest NDBC buoy with valid wind data to the given point. */
export function getNearestWind(
  lat: number, lng: number,
): { windDirDeg: number; windSpeedMs: number; stationId: string } | null {
  const result = getNdbcCache(lat, lng);
  if (!result || result.stations.length === 0) return null;

  let bestStation: NdbcStation | null = null;
  let bestDist = Infinity;

  for (const s of result.stations) {
    if (s.observation?.windDir == null || s.observation?.windSpeed == null) continue;
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d < bestDist) {
      bestDist = d;
      bestStation = s;
    }
  }

  if (!bestStation?.observation?.windDir || !bestStation?.observation?.windSpeed) {
    return null;
  }

  return {
    windDirDeg: bestStation.observation.windDir,
    windSpeedMs: bestStation.observation.windSpeed,
    stationId: bestStation.id,
  };
}

/* ------------------------------------------------------------------ */
/*  Dynamic Target Loading                                            */
/* ------------------------------------------------------------------ */

/**
 * Gather plume targets near a source location from multiple registries.
 *
 * Pulls from:
 * 1. SDWIS — drinking water system intakes (critical: contaminants settle into supply)
 * 2. ECHO  — industrial NPDES facilities (potential secondary release if impacted)
 *
 * These are dynamic lookups using the spatial grid caches (3×3 neighborhood).
 */
export function getDynamicTargets(sourceLat: number, sourceLng: number): PlumeTarget[] {
  const targets: PlumeTarget[] = [];

  // SDWIS water intakes
  const sdwis = getSdwisCache(sourceLat, sourceLng);
  if (sdwis) {
    for (const sys of sdwis.systems) {
      if (sys.lat && sys.lng) {
        targets.push({
          id: `sdwis-${sys.pwsid}`,
          name: `${sys.name} (${sys.type}, pop ${sys.population.toLocaleString()})`,
          lat: sys.lat,
          lng: sys.lng,
          category: 'water-intake',
        });
      }
    }
  }

  // ECHO industrial facilities
  const echo = getEchoCache(sourceLat, sourceLng);
  if (echo) {
    for (const fac of echo.facilities) {
      if (fac.lat && fac.lng) {
        targets.push({
          id: `echo-${fac.registryId}`,
          name: fac.name,
          lat: fac.lat,
          lng: fac.lng,
          category: 'industrial',
        });
      }
    }
  }

  return targets;
}

/* ------------------------------------------------------------------ */
/*  Pattern-Level Plume Assessment (Full)                             */
/* ------------------------------------------------------------------ */

/** Max distance (km) to consider a target "near" a hazard source. */
const PLUME_MAX_RANGE_KM = 100;

export interface PlumeAssessment {
  adjustment: number;
  bestExposure: ExposureCategory;
  targetId: string;
  targetName: string;
  arrivalTimeHours: number | null;
  windStationId: string;
  evacuationZone: EvacuationZone;
  affectedTargets: AffectedTarget[];
}

/**
 * Assess plume exposure for a set of matched events against all nearby targets.
 *
 * 1. Extract lat/lng from matched events
 * 2. Look up nearest NDBC wind data
 * 3. Compute evacuation zone (Pasquill-Gifford + EPA ERG)
 * 4. Gather static targets (installations) + dynamic targets (SDWIS, ECHO)
 * 5. For each source × target pair, compute plume arrival
 * 6. Return worst-case adjustment + full list of affected targets
 */
export function assessPlumeForPattern(
  matchedEvents: ChangeEvent[],
  staticTargets: PlumeTarget[],
): PlumeAssessment | null {
  const geoEvents = matchedEvents.filter(
    e => e.geography.lat != null && e.geography.lng != null,
  );
  if (geoEvents.length === 0) return null;

  // Estimate daytime using UTC hour (crude but sufficient without timezone data)
  const utcHour = new Date().getUTCHours();
  const isDaytime = utcHour >= 12 && utcHour <= 24; // ~06:00–18:00 in US timezones

  let bestAssessment: PlumeAssessment | null = null;
  let bestAdj = 0;

  for (const evt of geoEvents) {
    const srcLat = evt.geography.lat!;
    const srcLng = evt.geography.lng!;

    const wind = getNearestWind(srcLat, srcLng);
    if (!wind) continue;

    // Compute evacuation zone for this source + wind
    const zone = computeEvacuationZone(wind.windSpeedMs, isDaytime, wind.windDirDeg);

    // Merge static targets (installations) + dynamic targets (water intakes, facilities)
    const dynamicTargets = getDynamicTargets(srcLat, srcLng);
    const allTargets = [...staticTargets, ...dynamicTargets];

    const affected: AffectedTarget[] = [];
    let currentBestAdj = 0;
    let currentBestTarget: PlumeTarget | null = null;
    let currentBestPlume: PlumeResult | null = null;

    for (const target of allTargets) {
      const dist = haversineKm(srcLat, srcLng, target.lat, target.lng);
      if (dist > PLUME_MAX_RANGE_KM) continue;

      const plume = estimatePlumeArrival(
        srcLat, srcLng,
        target.lat, target.lng,
        wind.windDirDeg,
        wind.windSpeedMs,
      );

      const inZone = isInEvacZone(srcLat, srcLng, target.lat, target.lng, zone);
      const adj = computePlumeAdjustment(plume);

      // Track all targets within range that have any exposure
      if (plume.exposure !== 'upwind' || inZone) {
        affected.push({
          id: target.id,
          name: target.name,
          category: target.category,
          distanceKm: plume.distanceKm,
          exposure: plume.exposure,
          arrivalTimeHours: plume.arrivalTimeHours,
          inEvacZone: inZone,
        });
      }

      if (adj > currentBestAdj) {
        currentBestAdj = adj;
        currentBestTarget = target;
        currentBestPlume = plume;
      }
    }

    if (currentBestAdj > bestAdj && currentBestTarget && currentBestPlume) {
      bestAdj = currentBestAdj;
      // Sort affected: evacuation zone first, then by arrival time
      affected.sort((a, b) => {
        if (a.inEvacZone !== b.inEvacZone) return a.inEvacZone ? -1 : 1;
        return (a.arrivalTimeHours ?? 999) - (b.arrivalTimeHours ?? 999);
      });

      bestAssessment = {
        adjustment: currentBestAdj,
        bestExposure: currentBestPlume.exposure,
        targetId: currentBestTarget.id,
        targetName: currentBestTarget.name,
        arrivalTimeHours: currentBestPlume.arrivalTimeHours,
        windStationId: wind.stationId,
        evacuationZone: zone,
        affectedTargets: affected,
      };
    }
  }

  return bestAssessment;
}

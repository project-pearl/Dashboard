/**
 * Plume Projection — wind-driven contaminant/smoke travel-time estimation.
 *
 * Given a source point, target point, and wind vector, estimates how long
 * until airborne material (smoke plume, chemical release, etc.) reaches
 * the target. Used by Sentinel scoring and fire-AQ risk assessment.
 */

import { haversineKm, calculateBearing } from './geoUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export interface Wind {
  speedMps: number;      // wind speed in m/s
  directionDeg: number;  // meteorological wind direction (degrees, 0-360)
                         // i.e. direction wind is coming FROM
}

export interface PlumeEstimate {
  hoursToTarget: number | null;  // null if wind not blowing toward target
  distanceKm: number;
  bearingToTarget: number;       // degrees 0-360
  windComponentMps: number;      // m/s component toward target (negative = away)
  alignment: 'direct' | 'partial' | 'perpendicular' | 'away';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert mph to m/s. */
export function mphToMps(mph: number): number {
  return mph * 0.44704;
}

/** Convert knots to m/s. */
export function knotsToMps(knots: number): number {
  return knots * 0.514444;
}

/**
 * Convert meteorological wind direction (direction wind comes FROM)
 * to the direction wind is blowing TOWARD.
 */
function windTowardDirection(meteoDir: number): number {
  return (meteoDir + 180) % 360;
}

// ── Core ─────────────────────────────────────────────────────────────────────

/**
 * Estimate travel time for airborne material from source to target,
 * given the current wind vector.
 *
 * Wind direction follows meteorological convention: the direction wind
 * is coming FROM (e.g. 270° = wind from the west, blowing eastward).
 *
 * Returns null hoursToTarget when wind has no component toward target.
 */
export function estimatePlumeArrival(
  sourceLat: number,
  sourceLng: number,
  targetLat: number,
  targetLng: number,
  wind: Wind,
): PlumeEstimate {
  const distanceKm = haversineKm(sourceLat, sourceLng, targetLat, targetLng);
  const bearingToTarget = calculateBearing(sourceLat, sourceLng, targetLat, targetLng);

  // Default when wind data is missing
  if (!wind?.speedMps || wind.speedMps <= 0 || wind.directionDeg == null) {
    return {
      hoursToTarget: null,
      distanceKm,
      bearingToTarget,
      windComponentMps: 0,
      alignment: 'away',
    };
  }

  // Wind blows TOWARD = meteo direction + 180°
  const windToward = windTowardDirection(wind.directionDeg);
  const windTowardRad = (windToward * Math.PI) / 180;
  const targetRad = (bearingToTarget * Math.PI) / 180;

  // Dot product: component of wind velocity in the source→target direction
  const component = wind.speedMps * Math.cos(windTowardRad - targetRad);

  // Classify alignment
  const angleDiff = Math.abs(((windToward - bearingToTarget + 540) % 360) - 180);
  let alignment: PlumeEstimate['alignment'];
  if (angleDiff <= 30) alignment = 'direct';
  else if (angleDiff <= 60) alignment = 'partial';
  else if (angleDiff <= 120) alignment = 'perpendicular';
  else alignment = 'away';

  if (component <= 0) {
    return {
      hoursToTarget: null,
      distanceKm,
      bearingToTarget,
      windComponentMps: component,
      alignment,
    };
  }

  const hours = (distanceKm * 1000) / component / 3600;

  return {
    hoursToTarget: Math.round(hours * 10) / 10,
    distanceKm: Math.round(distanceKm * 10) / 10,
    bearingToTarget: Math.round(bearingToTarget * 10) / 10,
    windComponentMps: Math.round(component * 100) / 100,
    alignment,
  };
}

/**
 * Check multiple targets and return those at risk (wind blowing toward them),
 * sorted by soonest arrival.
 */
export function findTargetsAtRisk(
  sourceLat: number,
  sourceLng: number,
  targets: { lat: number; lng: number; id: string }[],
  wind: Wind,
  maxHours = 48,
): (PlumeEstimate & { id: string })[] {
  const results: (PlumeEstimate & { id: string })[] = [];

  for (const t of targets) {
    const est = estimatePlumeArrival(sourceLat, sourceLng, t.lat, t.lng, wind);
    if (est.hoursToTarget != null && est.hoursToTarget <= maxHours) {
      results.push({ ...est, id: t.id });
    }
  }

  results.sort((a, b) => (a.hoursToTarget ?? Infinity) - (b.hoursToTarget ?? Infinity));
  return results;
}

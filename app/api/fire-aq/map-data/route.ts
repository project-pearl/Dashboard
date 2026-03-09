// app/api/fire-aq/map-data/route.ts
// Combined map data endpoint: fire detections + installations + state AQI + wind arrows.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { ensureWarmed as ensureFirmsWarmed, getFirmsAllRegions, type FirmsDetection } from '@/lib/firmsCache';
import { ensureWarmed as ensureAqWarmed, getAirQualityAllStates } from '@/lib/airQualityCache';
import { getNdbcCache } from '@/lib/ndbcCache';
import installationsJson from '@/data/military-installations.json';

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  burnPitHistory: boolean;
}

const INSTALLATIONS: Installation[] = installationsJson as Installation[];

// Grid cluster resolution for wind arrows (0.5°)
const WIND_GRID_RES = 0.5;

function windGridKey(lat: number, lng: number): string {
  return `${(Math.round(lat / WIND_GRID_RES) * WIND_GRID_RES).toFixed(1)},${(Math.round(lng / WIND_GRID_RES) * WIND_GRID_RES).toFixed(1)}`;
}

function msToKnots(ms: number): number {
  return Math.round(ms * 1.94384 * 10) / 10;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await Promise.all([ensureFirmsWarmed(), ensureAqWarmed()]);

  // Fire detections
  const regions = getFirmsAllRegions();
  const detections: FirmsDetection[] = [];
  for (const r of regions) {
    for (const d of r.detections) {
      detections.push(d);
    }
  }

  // State AQI map
  const aqStates = getAirQualityAllStates();
  const stateAqi: Record<string, number | null> = {};
  for (const s of aqStates) {
    stateAqi[s.state] = s.usAqi;
  }

  // Wind arrows — group fire detections into 0.5° clusters, find nearest NDBC station
  const clusterMap = new Map<string, { sumLat: number; sumLng: number; count: number }>();
  for (const d of detections) {
    const key = windGridKey(d.lat, d.lng);
    const c = clusterMap.get(key);
    if (c) {
      c.sumLat += d.lat;
      c.sumLng += d.lng;
      c.count++;
    } else {
      clusterMap.set(key, { sumLat: d.lat, sumLng: d.lng, count: 1 });
    }
  }

  const windArrows: Array<{
    fireLat: number;
    fireLng: number;
    windDir: number;
    windSpeedKt: number;
  }> = [];

  for (const cluster of clusterMap.values()) {
    const cLat = cluster.sumLat / cluster.count;
    const cLng = cluster.sumLng / cluster.count;

    const result = getNdbcCache(cLat, cLng);
    if (!result || result.stations.length === 0) continue;

    // Find nearest station with wind data
    let bestStation: typeof result.stations[0] | null = null;
    let bestDist = Infinity;
    for (const s of result.stations) {
      if (s.observation?.windDir == null || s.observation?.windSpeed == null) continue;
      const dlat = s.lat - cLat;
      const dlng = s.lng - cLng;
      const dist = dlat * dlat + dlng * dlng;
      if (dist < bestDist) {
        bestDist = dist;
        bestStation = s;
      }
    }

    if (bestStation?.observation?.windDir != null && bestStation?.observation?.windSpeed != null) {
      windArrows.push({
        fireLat: cLat,
        fireLng: cLng,
        windDir: bestStation.observation.windDir,
        windSpeedKt: msToKnots(bestStation.observation.windSpeed),
      });
    }
  }

  return NextResponse.json({
    detections,
    installations: INSTALLATIONS,
    stateAqi,
    windArrows,
  });
}

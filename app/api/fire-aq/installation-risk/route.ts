// app/api/fire-aq/installation-risk/route.ts
// Scores each military installation for fire/AQ risk. Returns sorted by composite score.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { ensureWarmed as ensureFirmsWarmed, getFirmsAllRegions } from '@/lib/firmsCache';
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

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function msToKnots(ms: number): number {
  return Math.round(ms * 1.94384 * 10) / 10;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await Promise.all([ensureFirmsWarmed(), ensureAqWarmed()]);

  const regions = getFirmsAllRegions();
  const allDetections = regions.flatMap(r => r.detections);
  const aqStates = getAirQualityAllStates();

  // Build state AQI map
  const stateAqiMap: Record<string, number | null> = {};
  for (const s of aqStates) {
    stateAqiMap[s.state] = s.usAqi;
  }

  const scores = INSTALLATIONS.map(inst => {
    // Fire proximity score (0-40)
    let fireScore = 0;
    let nearestFireDist = Infinity;
    let nearestFireFrp = 0;
    let highConfWithin25 = 0;

    for (const d of allDetections) {
      const dist = haversineMi(inst.lat, inst.lng, d.lat, d.lng);
      if (dist < nearestFireDist) {
        nearestFireDist = dist;
        nearestFireFrp = d.frp;
      }
      if (dist <= 25 && d.confidence === 'high') highConfWithin25++;
    }

    if (nearestFireDist <= 10) fireScore = 40;
    else if (nearestFireDist <= 25) fireScore = 30;
    else if (nearestFireDist <= 50) fireScore = 20;
    else if (nearestFireDist <= 100) fireScore = 10;
    // Bonus for high-confidence fires within 25mi
    fireScore = Math.min(40, fireScore + highConfWithin25 * 5);

    // AQI severity score (0-30) — use nearest CONUS state AQI
    let aqiScore = 0;
    let aqiValue: number | null = null;
    // Simple: find AQI readings from all states, take the most relevant
    for (const s of aqStates) {
      const dist = haversineMi(inst.lat, inst.lng, s.lat, s.lng);
      if (dist < 300 && s.usAqi != null) {
        if (aqiValue == null || s.usAqi > aqiValue) aqiValue = s.usAqi;
      }
    }
    if (aqiValue != null) {
      if (aqiValue > 200) aqiScore = 30;
      else if (aqiValue > 150) aqiScore = 25;
      else if (aqiValue > 100) aqiScore = 20;
      else if (aqiValue > 50) aqiScore = 10;
    }

    // Burn pit history (0-15)
    const burnPitScore = inst.burnPitHistory ? 15 : 0;

    // Wind exposure (0-15)
    let windScore = 0;
    let windContext = '';
    const ndbcResult = getNdbcCache(inst.lat, inst.lng);
    if (ndbcResult && ndbcResult.stations.length > 0) {
      // Find nearest station with wind data
      let bestStation: typeof ndbcResult.stations[0] | null = null;
      let bestDist = Infinity;
      for (const s of ndbcResult.stations) {
        if (s.observation?.windDir == null || s.observation?.windSpeed == null) continue;
        const dlat = s.lat - inst.lat;
        const dlng = s.lng - inst.lng;
        const dist = dlat * dlat + dlng * dlng;
        if (dist < bestDist) {
          bestDist = dist;
          bestStation = s;
        }
      }

      if (bestStation?.observation?.windDir != null && bestStation.observation.windSpeed != null) {
        const windDir = bestStation.observation.windDir;
        const speedKt = msToKnots(bestStation.observation.windSpeed);
        windContext = `${Math.round(windDir)}° at ${speedKt.toFixed(0)} kt`;

        // Check if wind is blowing from fire direction toward the base
        if (nearestFireDist < 200) {
          // Calculate bearing from nearest fire to installation
          // If wind direction aligns with fire→base direction, score higher
          const downwind = (windDir + 180) % 360;
          // Simplified: any significant wind when fires are near is concerning
          if (nearestFireDist <= 50 && speedKt > 5) {
            windScore = 15;
          } else if (nearestFireDist <= 100 && speedKt > 10) {
            windScore = 10;
          }
        }
      }
    }

    const composite = fireScore + aqiScore + burnPitScore + windScore;

    return {
      id: inst.id,
      name: inst.name,
      branch: inst.branch,
      region: inst.region,
      burnPitHistory: inst.burnPitHistory,
      fireScore,
      aqiScore,
      burnPitScore,
      windScore,
      composite,
      nearestFireDist: nearestFireDist === Infinity ? null : Math.round(nearestFireDist * 10) / 10,
      nearestFireFrp: nearestFireDist === Infinity ? null : Math.round(nearestFireFrp * 10) / 10,
      aqiValue,
      windContext: windContext || null,
    };
  });

  scores.sort((a, b) => b.composite - a.composite);

  return NextResponse.json({ installations: scores });
}

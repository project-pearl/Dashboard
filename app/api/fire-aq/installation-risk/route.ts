// app/api/fire-aq/installation-risk/route.ts
// Scores each military installation/embassy for fire/AQ risk. Returns sorted by composite score.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { ensureWarmed as ensureFirmsWarmed, getFirmsAllRegions } from '@/lib/firmsCache';
import { ensureWarmed as ensureAqWarmed, getAirQualityAllStates } from '@/lib/airQualityCache';
import { getNdbcCache } from '@/lib/ndbcCache';
import { ensureWarmed as ensureUsdmWarmed, getUsdmByState } from '@/lib/usdmCache';
import { ensureWarmed as ensureSeismicWarmed, getSeismicAll } from '@/lib/seismicCache';
import { ensureWarmed as ensureDamWarmed, getDamAll } from '@/lib/damCache';
import installationsJson from '@/data/military-installations.json';

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  burnPitHistory: boolean;
  type?: 'installation' | 'embassy';
  state?: string | null;
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

  await Promise.all([ensureFirmsWarmed(), ensureAqWarmed(), ensureUsdmWarmed(), ensureSeismicWarmed(), ensureDamWarmed()]);

  const regions = getFirmsAllRegions();
  const allDetections = regions.flatMap(r => r.detections);
  const aqStates = getAirQualityAllStates();

  // Build state AQI map
  const stateAqiMap: Record<string, number | null> = {};
  for (const s of aqStates) {
    stateAqiMap[s.state] = s.usAqi;
  }

  const elevated = request.nextUrl.searchParams.get('elevated') === 'true';

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

    // Drought score (0-10) — CONUS only, area-weighted from USDM
    let droughtScore = 0;
    let droughtLevel: string | null = null;
    if (inst.state) {
      const drought = getUsdmByState(inst.state);
      if (drought) {
        if (drought.d4 > 5) { droughtScore = 10; droughtLevel = 'D4 Exceptional'; }
        else if (drought.d3 > 15) { droughtScore = 8; droughtLevel = 'D3 Extreme'; }
        else if (drought.d2 > 25) { droughtScore = 6; droughtLevel = 'D2 Severe'; }
        else if (drought.d1 > 30) { droughtScore = 3; droughtLevel = 'D1 Moderate'; }
        else if (drought.d0 > 30) { droughtScore = 1; droughtLevel = 'D0 Abnormally Dry'; }
      }
    }

    // Seismic score (0-15) — proximity to recent earthquakes
    let seismicScore = 0;
    let nearestQuakeDist: number | null = null;
    let nearestQuakeMag: number | null = null;
    const earthquakes = getSeismicAll();
    for (const eq of earthquakes) {
      const dist = haversineMi(inst.lat, inst.lng, eq.lat, eq.lng);
      if (nearestQuakeDist === null || dist < nearestQuakeDist) {
        nearestQuakeDist = Math.round(dist * 10) / 10;
        nearestQuakeMag = eq.mag;
      }
      if (eq.mag >= 6 && dist <= 50) { seismicScore = Math.max(seismicScore, 15); }
      else if (eq.mag >= 5 && dist <= 100) { seismicScore = Math.max(seismicScore, 12); }
      else if (eq.mag >= 4 && dist <= 100) { seismicScore = Math.max(seismicScore, 8); }
      else if (eq.mag >= 3 && dist <= 150) { seismicScore = Math.max(seismicScore, 4); }
      else if (eq.mag >= 2.5 && dist <= 200) { seismicScore = Math.max(seismicScore, 2); }
    }

    // Dam proximity score (0-10) — high-hazard dams nearby (CONUS only)
    let damScore = 0;
    let nearestDamDist: number | null = null;
    let nearestDamName: string | null = null;
    const dams = getDamAll();
    for (const dam of dams) {
      const dist = haversineMi(inst.lat, inst.lng, dam.lat, dam.lng);
      if (nearestDamDist === null || dist < nearestDamDist) {
        nearestDamDist = Math.round(dist * 10) / 10;
        nearestDamName = dam.name;
      }
      let score = 0;
      if (dist <= 5) score = 10;
      else if (dist <= 10) score = 7;
      else if (dist <= 25) score = 4;
      if (score > 0 && (dam.conditionAssessment === 'Poor' || dam.conditionAssessment === 'Unsatisfactory')) {
        score = Math.min(10, score + 2);
      }
      damScore = Math.max(damScore, score);
    }

    const composite = fireScore + aqiScore + burnPitScore + windScore + droughtScore + seismicScore + damScore;

    return {
      id: inst.id,
      name: inst.name,
      branch: inst.branch,
      region: inst.region,
      type: inst.type || 'installation' as const,
      burnPitHistory: inst.burnPitHistory,
      fireScore,
      aqiScore,
      burnPitScore,
      windScore,
      droughtScore,
      seismicScore,
      damScore,
      composite,
      nearestFireDist: nearestFireDist === Infinity ? null : Math.round(nearestFireDist * 10) / 10,
      nearestFireFrp: nearestFireDist === Infinity ? null : Math.round(nearestFireFrp * 10) / 10,
      aqiValue,
      windContext: windContext || null,
      droughtLevel,
      nearestQuakeDist: earthquakes.length > 0 ? nearestQuakeDist : null,
      nearestQuakeMag: earthquakes.length > 0 ? nearestQuakeMag : null,
      nearestDamDist: dams.length > 0 ? nearestDamDist : null,
      nearestDamName: dams.length > 0 ? nearestDamName : null,
    };
  });

  scores.sort((a, b) => b.composite - a.composite);

  const total = scores.length;
  const filtered = elevated ? scores.filter(s => s.composite >= 25) : scores;

  return NextResponse.json({ installations: filtered, total });
}

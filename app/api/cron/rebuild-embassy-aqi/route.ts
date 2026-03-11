// app/api/cron/rebuild-embassy-aqi/route.ts
// Cron endpoint — fetches real-time AQI for all military installations & embassies
// from the WAQI/AQICN API. Runs hourly.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setEmbassyAqiCache,
  getEmbassyAqiCacheStatus,
  isEmbassyAqiBuildInProgress,
  setEmbassyAqiBuildInProgress,
  appendEmbassyAqiTrend,
  type EmbassyAqiReading,
  type EmbassyAqiTrendSnapshot,
} from '@/lib/embassyAqiCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import installationsJson from '@/data/military-installations.json';

const FETCH_TIMEOUT_MS = 15_000;
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

interface Installation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  branch: string;
  burnPitHistory: boolean;
  type?: 'installation' | 'embassy';
}

const INSTALLATIONS: Installation[] = installationsJson as Installation[];

/* ------------------------------------------------------------------ */
/*  Haversine                                                          */
/* ------------------------------------------------------------------ */

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ------------------------------------------------------------------ */
/*  Fetch single facility from WAQI                                    */
/* ------------------------------------------------------------------ */

async function fetchFacilityAqi(
  inst: Installation,
  token: string,
): Promise<EmbassyAqiReading> {
  const now = new Date().toISOString();
  const base: EmbassyAqiReading = {
    facilityId: inst.id,
    facilityName: inst.name,
    lat: inst.lat,
    lng: inst.lng,
    region: inst.region,
    type: inst.type || 'installation',
    aqi: null,
    dominantPol: null,
    pm25: null, pm10: null, o3: null, no2: null, so2: null, co: null,
    stationName: null,
    stationDistanceMi: null,
    timestamp: null,
    fetchedAt: now,
    forecast: [],
  };

  try {
    const url = `https://api.waqi.info/feed/geo:${inst.lat};${inst.lng}/?token=${token}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[rebuild-embassy-aqi] ${inst.id} HTTP ${res.status}`);
      return base;
    }

    const json = await res.json();
    if (json.status !== 'ok' || !json.data) {
      return base;
    }

    const d = json.data;

    // AQI & dominant pollutant
    base.aqi = typeof d.aqi === 'number' ? d.aqi : null;
    base.dominantPol = d.dominantpol || null;

    // Individual pollutant readings from iaqi
    const iaqi = d.iaqi || {};
    base.pm25 = iaqi.pm25?.v ?? null;
    base.pm10 = iaqi.pm10?.v ?? null;
    base.o3 = iaqi.o3?.v ?? null;
    base.no2 = iaqi.no2?.v ?? null;
    base.so2 = iaqi.so2?.v ?? null;
    base.co = iaqi.co?.v ?? null;

    // Station metadata
    if (d.city) {
      base.stationName = d.city.name || null;
      if (d.city.geo && Array.isArray(d.city.geo) && d.city.geo.length >= 2) {
        const stationLat = d.city.geo[0];
        const stationLng = d.city.geo[1];
        base.stationDistanceMi = Math.round(haversineMi(inst.lat, inst.lng, stationLat, stationLng) * 10) / 10;
      }
    }

    // Measurement timestamp
    if (d.time?.iso) {
      base.timestamp = d.time.iso;
    }

    // 3-day forecast
    if (d.forecast?.daily) {
      const daily = d.forecast.daily;
      const pm25Forecast = daily.pm25 || [];
      const o3Forecast = daily.o3 || [];
      // Build up to 3 days
      const days = new Set<string>();
      for (const f of [...pm25Forecast, ...o3Forecast]) {
        if (f.day) days.add(f.day);
      }
      const sortedDays = [...days].sort().slice(0, 3);
      base.forecast = sortedDays.map(day => {
        const pm25Entry = pm25Forecast.find((f: any) => f.day === day);
        const o3Entry = o3Forecast.find((f: any) => f.day === day);
        return {
          day,
          pm25Avg: pm25Entry?.avg ?? null,
          pm25Max: pm25Entry?.max ?? null,
          o3Avg: o3Entry?.avg ?? null,
        };
      });
    }

    return base;
  } catch (err: any) {
    console.warn(`[rebuild-embassy-aqi] ${inst.id} fetch error:`, err.message);
    return base;
  }
}

/* ------------------------------------------------------------------ */
/*  Batch helper                                                       */
/* ------------------------------------------------------------------ */

async function fetchInBatches(
  facilities: Installation[],
  token: string,
): Promise<EmbassyAqiReading[]> {
  const results: EmbassyAqiReading[] = [];
  for (let i = 0; i < facilities.length; i += BATCH_SIZE) {
    const batch = facilities.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(inst => fetchFacilityAqi(inst, token)),
    );
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
    // Delay between batches (skip after last batch)
    if (i + BATCH_SIZE < facilities.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }
  return results;
}

/* ------------------------------------------------------------------ */
/*  GET Handler                                                        */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = process.env.WAQI_API_TOKEN;
  if (!token) {
    return NextResponse.json({ status: 'skipped', reason: 'WAQI_API_TOKEN not configured' });
  }

  if (isEmbassyAqiBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Embassy AQI build already in progress',
      cache: getEmbassyAqiCacheStatus(),
    });
  }

  setEmbassyAqiBuildInProgress(true);
  const start = Date.now();

  try {
    const readings = await fetchInBatches(INSTALLATIONS, token);

    const withAqi = readings.filter(r => r.aqi != null).length;
    if (readings.length === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getEmbassyAqiCacheStatus(),
      });
    }

    // Build keyed map
    const readingsMap: Record<string, EmbassyAqiReading> = {};
    for (const r of readings) {
      readingsMap[r.facilityId] = r;
    }

    const built = new Date().toISOString();
    await setEmbassyAqiCache(readingsMap, built);

    // Append trend snapshot
    const aqiValues = readings.filter(r => r.aqi != null).map(r => r.aqi!);
    const byFacility: EmbassyAqiTrendSnapshot['byFacility'] = {};
    for (const r of readings) {
      byFacility[r.facilityId] = { aqi: r.aqi, dominantPol: r.dominantPol };
    }
    await appendEmbassyAqiTrend({
      timestamp: built,
      facilityCount: readings.length,
      avgAqi: aqiValues.length > 0 ? Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length) : null,
      maxAqi: aqiValues.length > 0 ? Math.max(...aqiValues) : null,
      byFacility,
    });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    recordCronRun('rebuild-embassy-aqi', 'success', Date.now() - start);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      facilityCount: readings.length,
      withAqi,
      withoutAqi: readings.length - withAqi,
      cache: getEmbassyAqiCacheStatus(),
    });
  } catch (err: any) {
    console.error('[rebuild-embassy-aqi] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-embassy-aqi' } });
    notifySlackCronFailure({ cronName: 'rebuild-embassy-aqi', error: err.message || 'build failed', duration: Date.now() - start });
    recordCronRun('rebuild-embassy-aqi', 'error', Date.now() - start, err.message);
    return NextResponse.json(
      { status: 'error', error: err?.message || 'Embassy AQI build failed' },
      { status: 500 },
    );
  } finally {
    setEmbassyAqiBuildInProgress(false);
  }
}

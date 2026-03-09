// app/api/cron/rebuild-air-quality/route.ts
// Cron endpoint — builds state-level air quality with monitor-aware confidence.
// Primary source: AirNow (if AIRNOW_API_KEY configured), fallback: Open-Meteo.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { STATE_GEO } from '@/lib/mapUtils';
import {
  setAirQualityCache,
  getAirQualityCacheStatus,
  isAirQualityBuildInProgress,
  setAirQualityBuildInProgress,
  appendAqiTrend,
  type AirQualityStateReading,
  type AqiTrendSnapshot,
} from '@/lib/airQualityCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const OPEN_METEO_BASE = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const AIRNOW_BASE = 'https://www.airnowapi.org/aq/observation/latLong/current/';
const CENSUS_GEOCODER_BASE = 'https://geocoding.geo.census.gov/geocoder/geographies/coordinates';
const FETCH_TIMEOUT_MS = 20_000;
const CONCURRENCY = 8;
const ZIP_SAMPLE_SIZE = 15;
const ZIP_SAMPLE_RADIUS_MI = 150;

const STATES = Object.entries(STATE_GEO)
  .filter(([abbr]) => abbr !== 'US')
  .map(([abbr, geo]) => ({ abbr, lat: geo.center[0], lng: geo.center[1] }));

let _zipCentroids: Record<string, [number, number]> | null = null;
function getZipCentroids(): Record<string, [number, number]> {
  if (!_zipCentroids) {
    _zipCentroids = require('@/lib/zipCentroids.json') as Record<string, [number, number]>;
  }
  return _zipCentroids;
}

function parseNum(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestZipSamples(lat: number, lng: number, maxCount = ZIP_SAMPLE_SIZE): string[] {
  const zips = getZipCentroids();
  const scored: Array<{ zip: string; d: number }> = [];
  for (const [zip, [zLat, zLng]] of Object.entries(zips)) {
    // Quick bbox prune before haversine.
    if (Math.abs(zLat - lat) > 2.5 || Math.abs(zLng - lng) > 3.0) continue;
    const d = haversineMi(lat, lng, zLat, zLng);
    if (d <= ZIP_SAMPLE_RADIUS_MI) scored.push({ zip, d });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, maxCount).map((s) => s.zip);
}

async function fetchCountyAtPoint(lat: number, lng: number): Promise<{ county: string | null; countyFips: string | null }> {
  try {
    const url = `${CENSUS_GEOCODER_BASE}?x=${lng}&y=${lat}&benchmark=Public_AR_Current&vintage=Current_Current&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return { county: null, countyFips: null };
    const data = await res.json();
    const county = data?.result?.geographies?.['Counties']?.[0];
    if (!county) return { county: null, countyFips: null };
    return {
      county: county.NAME || null,
      countyFips: county.GEOID || null,
    };
  } catch {
    return { county: null, countyFips: null };
  }
}

async function sampleCountyCoverage(lat: number, lng: number): Promise<Array<{ name: string; fips: string | null }>> {
  // Five-point sample approximates a county footprint around the monitoring centroid.
  const points: Array<[number, number]> = [
    [lat, lng],
    [lat + 0.8, lng],
    [lat - 0.8, lng],
    [lat, lng + 0.8],
    [lat, lng - 0.8],
  ];
  const seen = new Set<string>();
  const out: Array<{ name: string; fips: string | null }> = [];
  for (const [pLat, pLng] of points) {
    const c = await fetchCountyAtPoint(pLat, pLng);
    if (!c.county) continue;
    const key = `${c.county}|${c.countyFips || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: c.county, fips: c.countyFips });
  }
  return out;
}

async function fetchOpenMeteo(lat: number, lng: number): Promise<AirQualityStateReading | null> {
  const url = new URL(OPEN_METEO_BASE);
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('current', 'us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const current = json?.current;
  if (!current) return null;

  return {
    state: '',
    lat,
    lng,
    timestamp: typeof current.time === 'string' ? current.time : null,
    provider: 'open-meteo',
    monitorCount: 0,
    nearestMonitorDistanceMi: null,
    confidence: 'low',
    impactedCounty: null,
    impactedCountyFips: null,
    impactedCounties: [],
    impactedZips: [],
    impactedZipCount: 0,
    usAqi: parseNum(current.us_aqi),
    pm25: parseNum(current.pm2_5),
    pm10: parseNum(current.pm10),
    ozone: parseNum(current.ozone),
    no2: parseNum(current.nitrogen_dioxide),
    so2: parseNum(current.sulphur_dioxide),
    co: parseNum(current.carbon_monoxide),
  };
}

async function fetchAirNow(lat: number, lng: number, apiKey: string): Promise<AirQualityStateReading | null> {
  const url = new URL(AIRNOW_BASE);
  url.searchParams.set('format', 'application/json');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lng));
  url.searchParams.set('distance', '75');
  url.searchParams.set('API_KEY', apiKey);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) return null;

  let bestAqi: number | null = null;
  let pm25: number | null = null;
  let pm10: number | null = null;
  let ozone: number | null = null;
  let no2: number | null = null;
  let so2: number | null = null;
  let co: number | null = null;
  let nearest: number | null = null;
  let timestamp: string | null = null;
  const monitorKeys = new Set<string>();

  for (const row of rows) {
    const aqi = parseNum(row?.AQI);
    const p = String(row?.ParameterName || '').toUpperCase();
    const mLat = parseNum(row?.Latitude);
    const mLng = parseNum(row?.Longitude);
    if (mLat != null && mLng != null) {
      monitorKeys.add(`${mLat.toFixed(4)},${mLng.toFixed(4)}`);
      const d = haversineMi(lat, lng, mLat, mLng);
      nearest = nearest == null ? d : Math.min(nearest, d);
    }
    if (aqi != null) bestAqi = bestAqi == null ? aqi : Math.max(bestAqi, aqi);
    if (!timestamp && row?.DateObserved) {
      const dateObserved = String(row.DateObserved);
      const hour = row?.HourObserved != null ? String(row.HourObserved).padStart(2, '0') : '00';
      timestamp = `${dateObserved}T${hour}:00:00Z`;
    }
    if (aqi == null) continue;
    if (p === 'PM2.5') pm25 = pm25 == null ? aqi : Math.max(pm25, aqi);
    if (p === 'PM10') pm10 = pm10 == null ? aqi : Math.max(pm10, aqi);
    if (p === 'O3' || p === 'OZONE') ozone = ozone == null ? aqi : Math.max(ozone, aqi);
    if (p === 'NO2') no2 = no2 == null ? aqi : Math.max(no2, aqi);
    if (p === 'SO2') so2 = so2 == null ? aqi : Math.max(so2, aqi);
    if (p === 'CO') co = co == null ? aqi : Math.max(co, aqi);
  }

  const monitorCount = monitorKeys.size || rows.length;
  const confidence: 'high' | 'medium' | 'low' =
    monitorCount >= 3 && nearest != null && nearest <= 25 ? 'high' :
    monitorCount >= 1 ? 'medium' : 'low';

  return {
    state: '',
    lat,
    lng,
    timestamp,
    provider: 'airnow',
    monitorCount,
    nearestMonitorDistanceMi: nearest != null ? Math.round(nearest * 10) / 10 : null,
    confidence,
    impactedCounty: null,
    impactedCountyFips: null,
    impactedCounties: [],
    impactedZips: [],
    impactedZipCount: 0,
    usAqi: bestAqi,
    pm25,
    pm10,
    ozone,
    no2,
    so2,
    co,
  };
}

async function fetchStateAirQuality(state: string, lat: number, lng: number): Promise<AirQualityStateReading | null> {
  const airNowKey = process.env.AIRNOW_API_KEY;
  const [countyGeo, countyCoverage, core] = await Promise.all([
    fetchCountyAtPoint(lat, lng),
    sampleCountyCoverage(lat, lng),
    (async () => {
      if (airNowKey) {
        const airNow = await fetchAirNow(lat, lng, airNowKey);
        if (airNow) return airNow;
      }
      return fetchOpenMeteo(lat, lng);
    })(),
  ]);
  if (!core) return null;

  const impactedZips = nearestZipSamples(lat, lng);
  return {
    ...core,
    state,
    impactedCounty: countyGeo.county,
    impactedCountyFips: countyGeo.countyFips,
    impactedCounties: countyCoverage,
    impactedZips,
    impactedZipCount: impactedZips.length,
  };
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isAirQualityBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Air quality build already in progress',
      airNowConfigured: Boolean(process.env.AIRNOW_API_KEY),
      cache: getAirQualityCacheStatus(),
    });
  }

  setAirQualityBuildInProgress(true);
  const start = Date.now();

  try {
    const states: Record<string, AirQualityStateReading> = {};
    let failures = 0;
    let airNowCount = 0;
    let fallbackCount = 0;

    for (let i = 0; i < STATES.length; i += CONCURRENCY) {
      const batch = STATES.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map((s) => fetchStateAirQuality(s.abbr, s.lat, s.lng)));
      for (let j = 0; j < results.length; j++) {
        const stateAbbr = batch[j].abbr;
        const result = results[j];
        if (result.status === 'fulfilled' && result.value) {
          states[stateAbbr] = result.value;
          if (result.value.provider === 'airnow') airNowCount += 1; else fallbackCount += 1;
        } else {
          failures += 1;
        }
      }
    }

    const stateCount = Object.keys(states).length;
    if (stateCount === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        failures,
        airNowConfigured: Boolean(process.env.AIRNOW_API_KEY),
        cache: getAirQualityCacheStatus(),
      });
    }

    await setAirQualityCache({
      _meta: {
        built: new Date().toISOString(),
        stateCount,
        provider: airNowCount > 0 ? 'airnow+open-meteo-fallback' : 'open-meteo',
      },
      states,
    });

    // Append AQI trend snapshot for sparkline history
    const stateReadings: AqiTrendSnapshot['stateReadings'] = {};
    for (const [abbr, reading] of Object.entries(states)) {
      stateReadings[abbr] = { usAqi: reading.usAqi, pm25: reading.pm25, ozone: reading.ozone };
    }
    await appendAqiTrend({ timestamp: new Date().toISOString(), stateReadings });

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    recordCronRun('rebuild-air-quality', 'success', Date.now() - start);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stateCount,
      failures,
      airNowConfigured: Boolean(process.env.AIRNOW_API_KEY),
      providerBreakdown: { airNow: airNowCount, openMeteoFallback: fallbackCount },
      cache: getAirQualityCacheStatus(),
    });
  } catch (err: any) {
    console.error('[Air Quality Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-air-quality' } });
    notifySlackCronFailure({ cronName: 'rebuild-air-quality', error: err.message || 'build failed', duration: Date.now() - start });
    recordCronRun('rebuild-air-quality', 'error', Date.now() - start, err.message);
    return NextResponse.json(
      { status: 'error', error: err?.message || 'Air quality build failed' },
      { status: 500 },
    );
  } finally {
    setAirQualityBuildInProgress(false);
  }
}

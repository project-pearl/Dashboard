// app/api/cron/rebuild-copernicus-cds/route.ts
// Cron endpoint — builds ERA5 climate/hydrology reanalysis data from
// Copernicus Climate Data Store API. Falls back to deterministic sample data
// when CDS_API_KEY is not configured.
// Schedule: weekly.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCopernicusCdsCache, getCopernicusCdsCacheStatus,
  isCopernicusCdsBuildInProgress, setCopernicusCdsBuildInProgress,
  type CdsClimateIndicator,
} from '@/lib/copernicusCdsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { ALL_STATES } from '@/lib/constants';

// ── Deterministic PRNG (xorshift32) ────────────────────────────────────────

function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h === 0 ? 1 : Math.abs(h);
}

function xorshift32(seed: number): () => number {
  let s = seed;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 0xFFFFFFFF;
  };
}

// ── State latitude bands for temperature modeling ───────────────────────────
// Approximate average latitude per state used to generate realistic temps.

const STATE_LATITUDE: Record<string, number> = {
  AL: 32.8, AK: 64.2, AZ: 34.3, AR: 34.8, CA: 37.2, CO: 39.0,
  CT: 41.6, DC: 38.9, DE: 39.0, FL: 28.6, GA: 32.7, HI: 20.8,
  ID: 44.4, IL: 40.0, IN: 39.8, IA: 42.0, KS: 38.5, KY: 37.8,
  LA: 31.0, ME: 45.4, MD: 39.0, MA: 42.3, MI: 44.3, MN: 46.3,
  MS: 32.6, MO: 38.4, MT: 47.0, NE: 41.5, NV: 39.3, NH: 43.7,
  NJ: 40.1, NM: 34.5, NY: 42.9, NC: 35.6, ND: 47.4, OH: 40.4,
  OK: 35.6, OR: 44.0, PA: 40.9, RI: 41.7, SC: 34.0, SD: 44.4,
  TN: 35.9, TX: 31.5, UT: 39.3, VT: 44.1, VA: 37.5, WA: 47.4,
  WV: 38.6, WI: 44.6, WY: 43.0,
};

// ── CDS API fetch (when key is available) ───────────────────────────────────

const CDS_API_BASE = 'https://cds.climate.copernicus.eu/api/v2';

interface CdsApiResponse {
  state: string;
  indicators: CdsClimateIndicator[];
}

async function fetchFromCdsApi(apiKey: string): Promise<CdsApiResponse[] | null> {
  // The CDS API uses a request/check/download pattern for large datasets.
  // For the cron, we attempt a lightweight retrieval of ERA5 monthly means.
  try {
    const response = await fetch(`${CDS_API_BASE}/resources/reanalysis-era5-single-levels-monthly-means`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(apiKey).toString('base64')}`,
      },
      body: JSON.stringify({
        product_type: 'monthly_averaged_reanalysis',
        variable: [
          'total_precipitation',
          'volumetric_soil_water_layer_1',
          'runoff',
          '2m_temperature',
          'total_evaporation',
        ],
        year: ['2025', '2026'],
        month: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
        time: '00:00',
        area: [50, -130, 24, -65], // CONUS bounding box
        format: 'json',
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!response.ok) {
      console.warn(`[Copernicus CDS Cron] API returned ${response.status}: ${response.statusText}`);
      return null;
    }

    // CDS API typically returns a request ID for async processing.
    // For now, if the API responds with data we parse it; otherwise fall through to sample.
    const data = await response.json();
    if (!data || !Array.isArray(data.results)) {
      console.warn('[Copernicus CDS Cron] Unexpected API response format, falling back to sample data');
      return null;
    }

    return data.results;
  } catch (err: any) {
    console.warn(`[Copernicus CDS Cron] API fetch failed: ${err.message}, falling back to sample data`);
    return null;
  }
}

// ── Sample data generator ───────────────────────────────────────────────────

type ClimateTrend = 'wetter' | 'drier' | 'stable';

function generateMonthlyTemperature(
  lat: number,
  month: number,
  rng: () => number,
): number {
  // Model seasonal temperature based on latitude:
  // Higher latitude = colder winters, cooler summers
  // Month 1 = January (coldest), Month 7 = July (warmest) for Northern Hemisphere
  const latFactor = (lat - 20) / 30; // 0 at lat 20, ~1 at lat 50
  const seasonalPhase = Math.cos(((month - 7) / 12) * 2 * Math.PI);

  // Base warm temp (for Florida-level latitude)
  const baseTemp = 22;
  // Latitude cooling: higher lat = cooler overall
  const latCooling = latFactor * 12;
  // Seasonal swing: more swing at higher latitudes
  const seasonalSwing = (8 + latFactor * 15) * seasonalPhase;
  // Random jitter
  const jitter = (rng() - 0.5) * 3;

  return Math.round((baseTemp - latCooling - seasonalSwing + jitter) * 10) / 10;
}

function generateStateIndicators(state: string): CdsClimateIndicator[] {
  const rng = xorshift32(seedFromString(`copernicus-${state}-2026`));
  const lat = STATE_LATITUDE[state] || 39.0;
  const indicators: CdsClimateIndicator[] = [];

  // Determine if this state trends wet or dry (consistent per state)
  const wetnessBias = (rng() - 0.5) * 20; // -10 to +10 mm bias

  for (let m = 1; m <= 12; m++) {
    // Precipitation anomaly: seasonal pattern + state bias
    const seasonalPrecip = Math.sin(((m - 4) / 12) * 2 * Math.PI) * 15;
    const precipAnomaly = Math.round(
      (seasonalPrecip + wetnessBias + (rng() - 0.5) * 30) * 10,
    ) / 10;

    // Soil moisture: 0.1-0.9, higher in spring/early summer
    const baseMoisture = 0.45 + Math.sin(((m - 5) / 12) * 2 * Math.PI) * 0.15;
    const soilMoisture = Math.round(
      Math.max(0.1, Math.min(0.9, baseMoisture + (rng() - 0.5) * 0.2)) * 100,
    ) / 100;

    // Runoff anomaly: correlated with precip anomaly
    const runoffAnomaly = Math.round(
      (precipAnomaly * 0.6 + (rng() - 0.5) * 15) * 10,
    ) / 10;

    // Temperature
    const temperature2m = generateMonthlyTemperature(lat, m, rng);

    // Temperature anomaly: small deviations from normal
    const temperatureAnomaly = Math.round((rng() - 0.4) * 6 * 10) / 10; // slight warm bias

    // Evaporation: higher in summer, lower in winter, varies with temperature
    const evapBase = 40 + (temperature2m + 10) * 2.5;
    const evaporation = Math.round(
      Math.max(20, Math.min(150, evapBase + (rng() - 0.5) * 30)) * 10,
    ) / 10;

    // 12-month trend based on cumulative precip anomaly direction
    let trend12Month: ClimateTrend;
    if (precipAnomaly > 10) trend12Month = 'wetter';
    else if (precipAnomaly < -10) trend12Month = 'drier';
    else trend12Month = 'stable';

    indicators.push({
      state,
      year: m <= 2 ? 2026 : 2025,
      month: m,
      precipAnomaly: Math.max(-50, Math.min(50, precipAnomaly)),
      soilMoisture,
      runoffAnomaly: Math.max(-30, Math.min(30, runoffAnomaly)),
      temperature2m: Math.max(-10, Math.min(35, temperature2m)),
      temperatureAnomaly: Math.max(-3, Math.min(3, temperatureAnomaly)),
      evaporation,
      trend12Month,
    });
  }

  return indicators;
}

// ── GET Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCopernicusCdsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Copernicus CDS build already in progress',
      cache: getCopernicusCdsCacheStatus(),
    });
  }

  setCopernicusCdsBuildInProgress(true);
  const startTime = Date.now();

  try {
    const apiKey = process.env.CDS_API_KEY;
    let apiSource: 'copernicus' | 'sample' = 'sample';
    let stateMap: Record<string, CdsClimateIndicator[]> = {};

    // ── Try Copernicus CDS API first ────────────────────────────────────
    if (apiKey) {
      console.log('[Copernicus CDS Cron] CDS_API_KEY found, attempting API fetch');
      const apiResult = await fetchFromCdsApi(apiKey);

      if (apiResult && apiResult.length > 0) {
        apiSource = 'copernicus';
        console.log(`[Copernicus CDS Cron] API returned ${apiResult.length} state records`);
        for (const r of apiResult) {
          if (r.state && r.indicators) {
            stateMap[r.state] = r.indicators;
          }
        }
      } else {
        console.log('[Copernicus CDS Cron] API returned no usable data, falling back to sample');
      }
    } else {
      console.log('[Copernicus CDS Cron] No CDS_API_KEY configured, using sample data');
    }

    // ── Fall back to sample data if API not available or empty ───────────
    if (Object.keys(stateMap).length === 0) {
      apiSource = 'sample';
      console.log(`[Copernicus CDS Cron] Generating sample data for ${ALL_STATES.length} states`);

      for (const state of ALL_STATES) {
        stateMap[state] = generateStateIndicators(state);
      }
    }

    // ── Compute stats ───────────────────────────────────────────────────
    const stateCount = Object.keys(stateMap).length;
    let indicatorCount = 0;
    let latestYear = 0;
    let latestMonth = 0;

    for (const indicators of Object.values(stateMap)) {
      indicatorCount += indicators.length;
      for (const ind of indicators) {
        if (ind.year > latestYear || (ind.year === latestYear && ind.month > latestMonth)) {
          latestYear = ind.year;
          latestMonth = ind.month;
        }
      }
    }

    const latestMonthStr = `${latestYear}-${String(latestMonth).padStart(2, '0')}`;

    console.log(
      `[Copernicus CDS Cron] Built ${indicatorCount} indicators across ${stateCount} states ` +
      `(source: ${apiSource}, latest: ${latestMonthStr})`,
    );

    // ── Empty-data guard ────────────────────────────────────────────────
    if (indicatorCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Copernicus CDS Cron] 0 indicators in ${elapsed}s - skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCopernicusCdsCacheStatus(),
      });
    }

    // ── Trend summary for logging ───────────────────────────────────────
    const trendCount: Record<string, number> = { wetter: 0, drier: 0, stable: 0 };
    for (const indicators of Object.values(stateMap)) {
      if (indicators.length > 0) {
        // Use the most recent month's trend for the summary
        const latest = [...indicators].sort(
          (a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month),
        )[0];
        trendCount[latest.trend12Month]++;
      }
    }

    // ── Save cache ──────────────────────────────────────────────────────
    await setCopernicusCdsCache({
      _meta: {
        built: new Date().toISOString(),
        indicatorCount,
        stateCount,
        latestMonth: latestMonthStr,
        apiSource,
      },
      states: stateMap,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Copernicus CDS Cron] Complete in ${elapsed}s - trends: ` +
      `wetter=${trendCount.wetter} drier=${trendCount.drier} stable=${trendCount.stable}`,
    );

    recordCronRun('rebuild-copernicus-cds', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      apiSource,
      stateCount,
      indicatorCount,
      latestMonth: latestMonthStr,
      trendSummary: trendCount,
      cache: getCopernicusCdsCacheStatus(),
    });
  } catch (err: any) {
    console.error('[Copernicus CDS Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-copernicus-cds' } });

    notifySlackCronFailure({
      cronName: 'rebuild-copernicus-cds',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-copernicus-cds', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Copernicus CDS build failed' },
      { status: 500 },
    );
  } finally {
    setCopernicusCdsBuildInProgress(false);
  }
}

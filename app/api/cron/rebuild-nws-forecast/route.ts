// app/api/cron/rebuild-nws-forecast/route.ts
// Cron endpoint — fetches NWS weather forecasts for key monitoring locations
// across priority states (state capitals and military installations).
// Computes 7-day precip totals, temperature extremes, and violation risk scores
// from heavy precipitation events. Grid-indexed for spatial lookups.
// Schedule: twice daily via Vercel cron (6 AM / 6 PM UTC).

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setNwsForecastCache, getNwsForecastCacheStatus,
  isNwsForecastBuildInProgress, setNwsForecastBuildInProgress,
  type NwsForecast, type NwsForecastPeriod,
} from '@/lib/nwsForecastCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const NWS_POINTS_BASE = 'https://api.weather.gov/points';
const DELAY_MS = 1000; // NWS rate limit: ~1 req/sec
const FETCH_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 5000;
const USER_AGENT = '(PIN Dashboard, admin@pin-dashboard.com)';

const NWS_HEADERS = {
  Accept: 'application/json',
  'User-Agent': USER_AGENT,
};

// Key monitoring locations: 2-3 per priority state (state capitals + key installations)
interface MonitoringLocation {
  name: string;
  state: string;
  lat: number;
  lng: number;
  type: 'capital' | 'military' | 'water-system';
}

const MONITORING_LOCATIONS: MonitoringLocation[] = [
  // Maryland
  { name: 'Annapolis, MD', state: 'MD', lat: 38.9784, lng: -76.4922, type: 'capital' },
  { name: 'Fort Detrick', state: 'MD', lat: 39.4363, lng: -77.4381, type: 'military' },
  { name: 'Aberdeen Proving Ground', state: 'MD', lat: 39.4668, lng: -76.1282, type: 'military' },
  // Virginia
  { name: 'Richmond, VA', state: 'VA', lat: 37.5407, lng: -77.4360, type: 'capital' },
  { name: 'Norfolk Naval Station', state: 'VA', lat: 36.9461, lng: -76.3155, type: 'military' },
  { name: 'Langley AFB', state: 'VA', lat: 37.0833, lng: -76.3605, type: 'military' },
  // DC
  { name: 'Washington, DC', state: 'DC', lat: 38.9072, lng: -77.0369, type: 'capital' },
  // Pennsylvania
  { name: 'Harrisburg, PA', state: 'PA', lat: 40.2732, lng: -76.8867, type: 'capital' },
  { name: 'Philadelphia, PA', state: 'PA', lat: 39.9526, lng: -75.1652, type: 'water-system' },
  // Delaware
  { name: 'Dover, DE', state: 'DE', lat: 39.1582, lng: -75.5244, type: 'capital' },
  { name: 'Dover AFB', state: 'DE', lat: 39.1301, lng: -75.4668, type: 'military' },
  // Florida
  { name: 'Tallahassee, FL', state: 'FL', lat: 30.4383, lng: -84.2807, type: 'capital' },
  { name: 'NAS Jacksonville', state: 'FL', lat: 30.2358, lng: -81.6806, type: 'military' },
  { name: 'NAS Pensacola', state: 'FL', lat: 30.3537, lng: -87.3186, type: 'military' },
  // West Virginia
  { name: 'Charleston, WV', state: 'WV', lat: 38.3498, lng: -81.6326, type: 'capital' },
  { name: 'Kanawha Valley WTP', state: 'WV', lat: 38.3607, lng: -81.7288, type: 'water-system' },
  // California
  { name: 'Sacramento, CA', state: 'CA', lat: 38.5816, lng: -121.4944, type: 'capital' },
  { name: 'Travis AFB', state: 'CA', lat: 38.2627, lng: -121.9274, type: 'military' },
  { name: 'MCAS Miramar', state: 'CA', lat: 32.8684, lng: -117.1425, type: 'military' },
  // Texas
  { name: 'Austin, TX', state: 'TX', lat: 30.2672, lng: -97.7431, type: 'capital' },
  { name: 'Fort Cavazos (Hood)', state: 'TX', lat: 31.1349, lng: -97.7756, type: 'military' },
  // New York
  { name: 'Albany, NY', state: 'NY', lat: 42.6526, lng: -73.7562, type: 'capital' },
  { name: 'Fort Drum', state: 'NY', lat: 44.0550, lng: -75.7579, type: 'military' },
  // New Jersey
  { name: 'Trenton, NJ', state: 'NJ', lat: 40.2171, lng: -74.7429, type: 'capital' },
  { name: 'JB McGuire-Dix-Lakehurst', state: 'NJ', lat: 40.0157, lng: -74.5936, type: 'military' },
  // Ohio
  { name: 'Columbus, OH', state: 'OH', lat: 39.9612, lng: -82.9988, type: 'capital' },
  { name: 'Wright-Patterson AFB', state: 'OH', lat: 39.8261, lng: -84.0484, type: 'military' },
  // North Carolina
  { name: 'Raleigh, NC', state: 'NC', lat: 35.7796, lng: -78.6382, type: 'capital' },
  { name: 'Camp Lejeune', state: 'NC', lat: 34.6204, lng: -77.3868, type: 'military' },
  // Massachusetts
  { name: 'Boston, MA', state: 'MA', lat: 42.3601, lng: -71.0589, type: 'capital' },
  { name: 'Otis ANGB', state: 'MA', lat: 41.6584, lng: -70.5215, type: 'military' },
  // Georgia
  { name: 'Atlanta, GA', state: 'GA', lat: 33.7490, lng: -84.3880, type: 'capital' },
  { name: 'Fort Moore (Benning)', state: 'GA', lat: 32.3593, lng: -84.9486, type: 'military' },
  // Illinois
  { name: 'Springfield, IL', state: 'IL', lat: 39.7817, lng: -89.6501, type: 'capital' },
  { name: 'Chicago WTP', state: 'IL', lat: 41.8781, lng: -87.6298, type: 'water-system' },
  // Michigan
  { name: 'Lansing, MI', state: 'MI', lat: 42.7325, lng: -84.5555, type: 'capital' },
  { name: 'Battle Creek ANGB', state: 'MI', lat: 42.3073, lng: -85.2516, type: 'military' },
  // Washington
  { name: 'Olympia, WA', state: 'WA', lat: 47.0379, lng: -122.9007, type: 'capital' },
  { name: 'NAS Whidbey Island', state: 'WA', lat: 48.3515, lng: -122.6557, type: 'military' },
  { name: 'JB Lewis-McChord', state: 'WA', lat: 47.0866, lng: -122.5805, type: 'military' },
  // Oregon
  { name: 'Salem, OR', state: 'OR', lat: 44.9429, lng: -123.0351, type: 'capital' },
  { name: 'Portland WTP', state: 'OR', lat: 45.5051, lng: -122.6750, type: 'water-system' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function gridKey(lat: number, lng: number): string {
  return `${(Math.floor(lat * 10) / 10).toFixed(1)},${(Math.floor(lng * 10) / 10).toFixed(1)}`;
}

/**
 * Extract precipitation amount in inches from a forecast detail string.
 * NWS forecasts describe precip in text like "chance of rain" with quantities.
 */
function extractPrecipInches(period: any): number {
  const detail = (period.detailedForecast || '').toLowerCase();
  const shortForecast = (period.shortForecast || '').toLowerCase();

  // Check for quantitative precip amounts
  const amountMatch = detail.match(/(\d+(?:\.\d+)?)\s*(?:to\s*(\d+(?:\.\d+)?))?\s*inch(?:es)?/);
  if (amountMatch) {
    const low = parseFloat(amountMatch[1]);
    const high = amountMatch[2] ? parseFloat(amountMatch[2]) : low;
    return (low + high) / 2;
  }

  // Estimate from probability and intensity keywords
  const probMatch = detail.match(/(\d+)\s*percent/);
  const prob = probMatch ? parseInt(probMatch[1], 10) / 100 : 0;

  if (detail.includes('heavy rain') || detail.includes('heavy snow')) return 1.5 * prob;
  if (detail.includes('rain') || detail.includes('showers') || detail.includes('thunderstorm')) return 0.5 * prob;
  if (detail.includes('drizzle') || detail.includes('light rain')) return 0.15 * prob;
  if (detail.includes('snow') || detail.includes('sleet')) return 0.3 * prob;
  if (shortForecast.includes('rain') || shortForecast.includes('showers')) return 0.3 * prob;

  return 0;
}

/**
 * Compute violation risk score from precipitation forecast.
 * Heavy rainfall increases risk of stormwater overflows and CSO events.
 * Score: 0-100.
 */
function computeViolationRiskScore(precipTotal7d: number, maxTemp7d: number, minTemp7d: number): number {
  let score = 0;

  // Heavy precipitation risk (major factor)
  if (precipTotal7d > 5.0) score += 40;
  else if (precipTotal7d > 3.0) score += 30;
  else if (precipTotal7d > 2.0) score += 20;
  else if (precipTotal7d > 1.0) score += 10;
  else if (precipTotal7d > 0.5) score += 5;

  // Temperature extremes (freeze-thaw cycles stress infrastructure)
  if (minTemp7d < 20 && maxTemp7d > 40) score += 15; // freeze-thaw
  if (maxTemp7d > 95) score += 10; // extreme heat → algal bloom risk
  if (minTemp7d < 0) score += 10; // pipe freeze risk

  // Rapid temperature swing → snowmelt flood risk
  const tempSwing = maxTemp7d - minTemp7d;
  if (tempSwing > 50) score += 15;
  else if (tempSwing > 35) score += 10;

  return Math.min(score, 100);
}

/**
 * Fetch NWS forecast for a single monitoring location.
 * Two-step process: /points → get gridpoint URL → /gridpoints forecast.
 */
async function fetchLocationForecast(
  loc: MonitoringLocation,
): Promise<NwsForecast | null> {
  // Step 1: Get grid point metadata
  const pointsUrl = `${NWS_POINTS_BASE}/${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
  const pointsResp = await fetch(pointsUrl, {
    headers: NWS_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!pointsResp.ok) {
    throw new Error(`NWS points ${loc.name}: ${pointsResp.status} ${pointsResp.statusText}`);
  }

  const pointsJson = await pointsResp.json();
  const forecastUrl = pointsJson?.properties?.forecast;
  const office = pointsJson?.properties?.gridId || '';
  const gridX = pointsJson?.properties?.gridX;
  const gridY = pointsJson?.properties?.gridY;

  if (!forecastUrl) {
    console.warn(`[NWS Forecast Cron] ${loc.name}: No forecast URL in points response`);
    return null;
  }

  // Step 2: Get the actual forecast
  await delay(300); // Brief delay between the two calls
  const forecastResp = await fetch(forecastUrl, {
    headers: NWS_HEADERS,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!forecastResp.ok) {
    throw new Error(`NWS forecast ${loc.name}: ${forecastResp.status} ${forecastResp.statusText}`);
  }

  const forecastJson = await forecastResp.json();
  const rawPeriods = forecastJson?.properties?.periods;

  if (!Array.isArray(rawPeriods) || rawPeriods.length === 0) {
    console.warn(`[NWS Forecast Cron] ${loc.name}: No forecast periods`);
    return null;
  }

  // Parse forecast periods (NWS returns ~14 periods = 7 days)
  const periods: NwsForecastPeriod[] = rawPeriods.map((p: any) => ({
    number: p.number ?? 0,
    name: p.name || '',
    temperature: p.temperature ?? 0,
    windSpeed: p.windSpeed || '',
    shortForecast: p.shortForecast || '',
    detailedForecast: p.detailedForecast || '',
    precipProbability: p.probabilityOfPrecipitation?.value ?? null,
    precipAmount: extractPrecipInches(p) || null,
  }));

  // Compute 7-day aggregates
  const temps = periods.map(p => p.temperature);
  const maxTemp7d = Math.max(...temps);
  const minTemp7d = Math.min(...temps);
  const precipTotal7d = Math.round(
    periods.reduce((sum, p) => sum + (p.precipAmount ?? 0), 0) * 100,
  ) / 100;

  const violationRiskScore = computeViolationRiskScore(precipTotal7d, maxTemp7d, minTemp7d);

  return {
    locationId: `${loc.state}-${loc.name.replace(/[^a-zA-Z0-9]/g, '-')}`,
    locationName: loc.name,
    lat: loc.lat,
    lng: loc.lng,
    state: loc.state,
    gridId: office,
    gridX: gridX ?? 0,
    gridY: gridY ?? 0,
    periods,
    precipTotal7d,
    maxTemp7d,
    minTemp7d,
    violationRiskScore,
  };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNwsForecastBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWS forecast build already in progress',
      cache: getNwsForecastCacheStatus(),
    });
  }

  setNwsForecastBuildInProgress(true);
  const startTime = Date.now();

  try {
    const allForecasts: NwsForecast[] = [];
    const processedLocations: string[] = [];
    const failedLocations: string[] = [];

    // ── Fetch all locations sequentially (NWS rate limit) ───────────────
    for (let i = 0; i < MONITORING_LOCATIONS.length; i++) {
      const loc = MONITORING_LOCATIONS[i];

      try {
        const forecast = await fetchLocationForecast(loc);
        if (forecast) {
          allForecasts.push(forecast);
          processedLocations.push(loc.name);
          console.log(
            `[NWS Forecast Cron] ${loc.name}: ${forecast.periods.length} periods, ` +
            `precip=${forecast.precipTotal7d}in, risk=${forecast.violationRiskScore}`,
          );
        } else {
          failedLocations.push(loc.name);
        }
      } catch (err: any) {
        console.warn(`[NWS Forecast Cron] ${loc.name} failed: ${err.message}`);
        failedLocations.push(loc.name);
      }

      // Rate-limit delay (not after the last one)
      if (i < MONITORING_LOCATIONS.length - 1) {
        await delay(DELAY_MS);
      }
    }

    // ── Retry failed locations ──────────────────────────────────────────
    if (failedLocations.length > 0) {
      console.log(`[NWS Forecast Cron] Retrying ${failedLocations.length} failed locations...`);
      await delay(RETRY_DELAY_MS);

      const retryLocs = MONITORING_LOCATIONS.filter(l => failedLocations.includes(l.name));
      const stillFailed: string[] = [];

      for (let i = 0; i < retryLocs.length; i++) {
        const loc = retryLocs[i];
        try {
          const forecast = await fetchLocationForecast(loc);
          if (forecast) {
            allForecasts.push(forecast);
            processedLocations.push(loc.name);
            console.log(`[NWS Forecast Cron] ${loc.name}: RETRY OK`);
          } else {
            stillFailed.push(loc.name);
          }
        } catch (err: any) {
          console.warn(`[NWS Forecast Cron] ${loc.name}: RETRY FAILED — ${err.message}`);
          stillFailed.push(loc.name);
        }

        if (i < retryLocs.length - 1) {
          await delay(DELAY_MS);
        }
      }

      // Update failedLocations to only those that still failed
      failedLocations.length = 0;
      failedLocations.push(...stillFailed);
    }

    // ── Build grid index ────────────────────────────────────────────────
    const grid: Record<string, { forecasts: NwsForecast[] }> = {};
    for (const f of allForecasts) {
      const key = gridKey(f.lat, f.lng);
      if (!grid[key]) grid[key] = { forecasts: [] };
      grid[key].forecasts.push(f);
    }

    // ── Build state summaries ───────────────────────────────────────────
    const stateSummaries: Record<string, {
      state: string;
      locationCount: number;
      avgPrecip7d: number;
      maxPrecip7d: number;
      avgRiskScore: number;
      maxRiskScore: number;
      maxTemp7d: number;
      minTemp7d: number;
    }> = {};

    const byState: Record<string, NwsForecast[]> = {};
    for (const f of allForecasts) {
      if (!byState[f.state]) byState[f.state] = [];
      byState[f.state].push(f);
    }

    for (const [state, forecasts] of Object.entries(byState)) {
      const precips = forecasts.map(f => f.precipTotal7d);
      const risks = forecasts.map(f => f.violationRiskScore);
      const maxTemps = forecasts.map(f => f.maxTemp7d);
      const minTemps = forecasts.map(f => f.minTemp7d);

      stateSummaries[state] = {
        state,
        locationCount: forecasts.length,
        avgPrecip7d: Math.round((precips.reduce((a, b) => a + b, 0) / precips.length) * 100) / 100,
        maxPrecip7d: Math.max(...precips),
        avgRiskScore: Math.round(risks.reduce((a, b) => a + b, 0) / risks.length),
        maxRiskScore: Math.max(...risks),
        maxTemp7d: Math.max(...maxTemps),
        minTemp7d: Math.min(...minTemps),
      };
    }

    // ── Empty-data guard ────────────────────────────────────────────────
    if (allForecasts.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NWS Forecast Cron] 0 forecasts in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getNwsForecastCacheStatus(),
      });
    }

    // ── Compute high-risk count ─────────────────────────────────────────
    const highRiskCount = allForecasts.filter(f => f.violationRiskScore >= 40).length;
    const avgRiskScore = Math.round(
      allForecasts.reduce((sum, f) => sum + f.violationRiskScore, 0) / allForecasts.length,
    );

    // ── Save cache ──────────────────────────────────────────────────────
    await setNwsForecastCache({
      _meta: {
        built: new Date().toISOString(),
        locationCount: allForecasts.length,
        statesCovered: Object.keys(byState).length,
        highRiskCount,
      },
      states: byState,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NWS Forecast Cron] Complete in ${elapsed}s — ${allForecasts.length} forecasts, ` +
      `${Object.keys(grid).length} cells, ${Object.keys(stateSummaries).length} states, ` +
      `${highRiskCount} high-risk locations`,
    );

    recordCronRun('rebuild-nws-forecast', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      forecastCount: allForecasts.length,
      processedLocations: processedLocations.length,
      failedLocations,
      gridCells: Object.keys(grid).length,
      statesWithData: Object.keys(stateSummaries).length,
      highRiskCount,
      avgRiskScore,
      cache: getNwsForecastCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NWS Forecast Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-nws-forecast' } });

    notifySlackCronFailure({
      cronName: 'rebuild-nws-forecast',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-nws-forecast', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NWS forecast build failed' },
      { status: 500 },
    );
  } finally {
    setNwsForecastBuildInProgress(false);
  }
}

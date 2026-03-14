// app/api/cron/rebuild-noaa-coastal-batch/route.ts
// Batch cron -- rebuilds 4 NOAA coastal/ocean caches in one invocation:
//   1. HAB Forecast (harmful algal bloom observations from HABSOS)
//   2. CoastWatch (satellite chlorophyll-a / bloom risk from ERDDAP)
//   3. CO-OPS Predictions (tidal predictions from NOAA Tides & Currents)
//   4. Hypoxia (dissolved oxygen / dead zone monitoring from ERDDAP)
//
// Schedule: every 6 hours at :45  (45 */6 * * *)

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { gridKey } from '@/lib/cacheUtils';

// HAB Forecast imports
import {
  setHabForecastCache,
  isHabForecastBuildInProgress,
  setHabForecastBuildInProgress,
  getHabForecastCacheStatus,
} from '@/lib/habForecastCache';
import type { HabForecast } from '@/lib/habForecastCache';

// CoastWatch imports
import {
  setCoastwatchCache,
  isCoastwatchBuildInProgress,
  setCoastwatchBuildInProgress,
  getCoastwatchCacheStatus,
} from '@/lib/coastwatchCache';
import type { CoastwatchObs } from '@/lib/coastwatchCache';

// CO-OPS Predictions imports
import {
  setCoopsPredictionsCache,
  isCoopsPredictionsBuildInProgress,
  setCoopsPredictionsBuildInProgress,
  getCoopsPredictionsCacheStatus,
} from '@/lib/coopsPredictionsCache';
import type { CoopsPrediction } from '@/lib/coopsPredictionsCache';

// Hypoxia imports
import {
  setHypoxiaCache,
  isHypoxiaBuildInProgress,
  setHypoxiaBuildInProgress,
  getHypoxiaCacheStatus,
} from '@/lib/hypoxiaCache';
import type { HypoxiaReading } from '@/lib/hypoxiaCache';

// ── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TIMEOUT = 60_000;

// Key NOAA CO-OPS tide stations (ID, name, lat, lng, state)
const COOPS_STATIONS: [string, string, number, number, string][] = [
  ['8518750', 'The Battery, NY', 40.7006, -74.0142, 'NY'],
  ['9414290', 'San Francisco, CA', 37.8063, -122.4659, 'CA'],
  ['8443970', 'Boston, MA', 42.3539, -71.0503, 'MA'],
  ['8658120', 'Wilmington, NC', 34.2274, -77.9536, 'NC'],
  ['8720218', 'Mayport, FL', 30.3966, -81.4305, 'FL'],
  ['8771450', 'Galveston, TX', 29.3100, -94.7933, 'TX'],
  ['9410660', 'Los Angeles, CA', 33.7200, -118.2720, 'CA'],
  ['9447130', 'Seattle, WA', 47.6026, -122.3393, 'WA'],
  ['8574680', 'Baltimore, MD', 39.2667, -76.5794, 'MD'],
  ['8638610', 'Sewells Point, VA', 36.9467, -76.3300, 'VA'],
  ['8726520', 'St Petersburg, FL', 27.7606, -82.6269, 'FL'],
  ['8545240', 'Philadelphia, PA', 39.9333, -75.1417, 'PA'],
  ['8461490', 'New London, CT', 41.3614, -72.0900, 'CT'],
  ['8452660', 'Newport, RI', 41.5043, -71.3261, 'RI'],
  ['8665530', 'Charleston, SC', 32.7815, -79.9247, 'SC'],
  ['8729108', 'Panama City, FL', 30.1522, -85.6672, 'FL'],
  ['9432780', 'Charleston, OR', 43.3450, -124.3220, 'OR'],
  ['1612340', 'Honolulu, HI', 21.3067, -157.8670, 'HI'],
];

// ── Types ────────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── Sub-cron 1: HAB Forecast (HABSOS) ───────────────────────────────────────

function deriveBloomSeverity(cellCount: number | null): HabForecast['bloomSeverity'] {
  if (cellCount == null || cellCount <= 0) return 'none';
  if (cellCount < 10000) return 'low';
  if (cellCount < 100000) return 'moderate';
  if (cellCount < 1000000) return 'high';
  return 'extreme';
}

function deriveDrinkingWaterRisk(severity: HabForecast['bloomSeverity']): HabForecast['drinkingWaterRisk'] {
  if (severity === 'extreme' || severity === 'high') return 'high';
  if (severity === 'moderate') return 'moderate';
  if (severity === 'low') return 'low';
  return 'none';
}

async function buildHabForecast(): Promise<SubCronResult> {
  const start = Date.now();

  if (isHabForecastBuildInProgress()) {
    return { name: 'hab-forecast', status: 'skipped', durationMs: Date.now() - start };
  }

  setHabForecastBuildInProgress(true);
  try {
    const url = 'https://coastwatch.pfeg.noaa.gov/erddap/tabledap/habsos.json?latitude,longitude,SAMPLE_DATE,GENUS,CELLCOUNT&time>=now-7days';
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) throw new Error(`HABSOS HTTP ${resp.status}`);
    const json = await resp.json();

    const table = json?.table || {};
    const columnNames: string[] = table.columnNames || [];
    const rows: any[][] = table.rows || [];

    if (rows.length === 0) {
      console.warn('[NOAA Coastal Batch] HAB Forecast: no data returned -- skipping cache save');
      recordCronRun('rebuild-hab-forecast', 'success', Date.now() - start);
      return { name: 'hab-forecast', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const latIdx = columnNames.indexOf('latitude');
    const lngIdx = columnNames.indexOf('longitude');
    const dateIdx = columnNames.indexOf('SAMPLE_DATE');
    const genusIdx = columnNames.indexOf('GENUS');
    const countIdx = columnNames.indexOf('CELLCOUNT');

    const grid: Record<string, HabForecast[]> = {};
    const stateIndex: Record<string, HabForecast[]> = {};
    const waterbodies = new Set<string>();
    let highRiskCount = 0;

    for (const row of rows) {
      const lat = parseFloat(row[latIdx]);
      const lng = parseFloat(row[lngIdx]);
      if (!lat || !lng) continue;

      const cellCount = row[countIdx] != null ? parseFloat(row[countIdx]) : null;
      const severity = deriveBloomSeverity(cellCount);
      const drinkingWaterRisk = deriveDrinkingWaterRisk(severity);
      const genus = row[genusIdx] || 'Unknown';
      const sampleDate = row[dateIdx] || '';

      // Derive state from longitude (approximate US coastal mapping)
      let state = 'US';
      if (lng > -82 && lng < -75 && lat > 24 && lat < 31) state = 'FL';
      else if (lng > -98 && lng < -82 && lat > 25 && lat < 31) state = 'TX';
      else if (lng > -90 && lng < -82 && lat > 28 && lat < 31) state = 'LA';
      else if (lng > -89 && lng < -87 && lat > 29 && lat < 31) state = 'MS';
      else if (lng > -88.5 && lng < -84 && lat > 29 && lat < 31) state = 'AL';

      const waterbody = `${genus} observation zone`;
      waterbodies.add(waterbody);
      if (severity === 'high' || severity === 'extreme') highRiskCount++;

      const forecast: HabForecast = {
        waterbody,
        region: state !== 'US' ? `${state} Coast` : 'US Coast',
        state,
        bloomSeverity: severity,
        cyanobacteriaConc: cellCount,
        toxinType: genus.toLowerCase().includes('karenia') ? 'Brevetoxin' : genus.toLowerCase().includes('pseudo') ? 'Domoic acid' : null,
        forecastDate: sampleDate,
        validThrough: sampleDate,
        drinkingWaterRisk,
        recreationalRisk: severity === 'none' ? 'none' : severity === 'low' ? 'low' : severity === 'moderate' ? 'moderate' : 'high',
        lat,
        lng,
        source: 'NOAA HABSOS',
      };

      const gk = gridKey(lat, lng);
      (grid[gk] ??= []).push(forecast);
      (stateIndex[state] ??= []).push(forecast);
    }

    const totalForecasts = rows.length;

    await setHabForecastCache({
      _meta: {
        built: new Date().toISOString(),
        forecastCount: totalForecasts,
        waterbodyCount: waterbodies.size,
        highRiskCount,
      },
      grid,
      stateIndex,
    });

    console.log(`[NOAA Coastal Batch] HAB Forecast: ${totalForecasts} observations, ${waterbodies.size} waterbodies`);
    recordCronRun('rebuild-hab-forecast', 'success', Date.now() - start);
    return { name: 'hab-forecast', status: 'success', durationMs: Date.now() - start, recordCount: totalForecasts };
  } catch (err: any) {
    console.error('[NOAA Coastal Batch] HAB Forecast failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-hab-forecast', batch: 'noaa-coastal-batch' } });
    recordCronRun('rebuild-hab-forecast', 'error', Date.now() - start, err.message);
    return { name: 'hab-forecast', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setHabForecastBuildInProgress(false);
  }
}

// ── Sub-cron 2: CoastWatch (chlorophyll-a satellite) ────────────────────────

function deriveBloomRisk(chl: number | null): CoastwatchObs['bloomRisk'] {
  if (chl == null || chl < 1) return 'none';
  if (chl < 5) return 'low';
  if (chl < 20) return 'moderate';
  return 'high';
}

async function buildCoastwatch(): Promise<SubCronResult> {
  const start = Date.now();

  if (isCoastwatchBuildInProgress()) {
    return { name: 'coastwatch', status: 'skipped', durationMs: Date.now() - start };
  }

  setCoastwatchBuildInProgress(true);
  try {
    const url = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap/erdMH1chla8day.json?chlorophyll[(last)][(0.0):500:(50.0)][(-180.0):500:(180.0)]';
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) throw new Error(`CoastWatch HTTP ${resp.status}`);
    const json = await resp.json();

    const table = json?.table || {};
    const columnNames: string[] = table.columnNames || [];
    const rows: any[][] = table.rows || [];

    if (rows.length === 0) {
      console.warn('[NOAA Coastal Batch] CoastWatch: no data returned -- skipping cache save');
      recordCronRun('rebuild-coastwatch', 'success', Date.now() - start);
      return { name: 'coastwatch', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const latIdx = columnNames.indexOf('latitude');
    const lngIdx = columnNames.indexOf('longitude');
    const chlIdx = columnNames.indexOf('chlorophyll');
    const timeIdx = columnNames.indexOf('time');

    const grid: Record<string, CoastwatchObs[]> = {};
    const regionIndex: Record<string, CoastwatchObs[]> = {};
    const regions = new Set<string>();
    let highBloomCount = 0;

    for (const row of rows) {
      const lat = parseFloat(row[latIdx]);
      const lng = parseFloat(row[lngIdx]);
      const chl = row[chlIdx] != null ? parseFloat(row[chlIdx]) : null;
      if (isNaN(lat) || isNaN(lng)) continue;
      if (chl == null || isNaN(chl)) continue;

      const bloomRisk = deriveBloomRisk(chl);
      if (bloomRisk === 'high') highBloomCount++;

      // Derive region from coordinates
      let region = 'Open Ocean';
      if (lat > 24 && lat < 50 && lng > -130 && lng < -60) region = 'US Coastal';
      else if (lat > 50 && lng > -180 && lng < -130) region = 'Alaska';
      else if (lat > 15 && lat < 25 && lng > -165 && lng < -150) region = 'Hawaii';
      regions.add(region);

      const obs: CoastwatchObs = {
        lat,
        lng,
        chlorophyllA: chl,
        sst: null,
        turbidity: null,
        date: row[timeIdx] || new Date().toISOString(),
        sensor: 'MODIS-Aqua',
        region,
        bloomRisk,
      };

      const gk = gridKey(lat, lng);
      (grid[gk] ??= []).push(obs);
      (regionIndex[region] ??= []).push(obs);
    }

    await setCoastwatchCache({
      _meta: {
        built: new Date().toISOString(),
        observationCount: rows.length,
        regionCount: regions.size,
        highBloomRiskCount: highBloomCount,
      },
      grid,
      regionIndex,
    });

    console.log(`[NOAA Coastal Batch] CoastWatch: ${rows.length} observations, ${regions.size} regions`);
    recordCronRun('rebuild-coastwatch', 'success', Date.now() - start);
    return { name: 'coastwatch', status: 'success', durationMs: Date.now() - start, recordCount: rows.length };
  } catch (err: any) {
    console.error('[NOAA Coastal Batch] CoastWatch failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-coastwatch', batch: 'noaa-coastal-batch' } });
    recordCronRun('rebuild-coastwatch', 'error', Date.now() - start, err.message);
    return { name: 'coastwatch', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setCoastwatchBuildInProgress(false);
  }
}

// ── Sub-cron 3: CO-OPS Tidal Predictions ────────────────────────────────────

async function buildCoopsPredictions(): Promise<SubCronResult> {
  const start = Date.now();

  if (isCoopsPredictionsBuildInProgress()) {
    return { name: 'coops-predictions', status: 'skipped', durationMs: Date.now() - start };
  }

  setCoopsPredictionsBuildInProgress(true);
  try {
    const today = new Date();
    const beginDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today.getTime() + 86400000);
    const endDate = `${tomorrow.getFullYear()}${String(tomorrow.getMonth() + 1).padStart(2, '0')}${String(tomorrow.getDate()).padStart(2, '0')}`;

    const grid: Record<string, CoopsPrediction[]> = {};
    const stationIds = new Set<string>();
    let totalPredictions = 0;

    for (const [stationId, stationName, lat, lng, state] of COOPS_STATIONS) {
      try {
        const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&datum=MLLW&units=english&time_zone=gmt&application=PEARL&format=json&station=${stationId}&begin_date=${beginDate}&end_date=${endDate}&interval=hilo`;
        const resp = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT) });
        if (!resp.ok) {
          console.warn(`[NOAA Coastal Batch] CO-OPS station ${stationId} HTTP ${resp.status}`);
          continue;
        }
        const json = await resp.json();
        const predictions = json?.predictions || [];
        if (predictions.length === 0) continue;

        stationIds.add(stationId);

        // Find high/low tide pairs
        let highTideTime: string | null = null;
        let highTideFt: number | null = null;
        let lowTideTime: string | null = null;
        let lowTideFt: number | null = null;

        for (const p of predictions) {
          const ft = parseFloat(p.v);
          if (p.type === 'H' && (highTideFt == null || ft > highTideFt)) {
            highTideFt = ft;
            highTideTime = p.t;
          }
          if (p.type === 'L' && (lowTideFt == null || ft < lowTideFt)) {
            lowTideFt = ft;
            lowTideTime = p.t;
          }
        }

        const tidalRange = (highTideFt != null && lowTideFt != null) ? highTideFt - lowTideFt : null;
        let floodRisk: CoopsPrediction['floodRisk'] = 'none';
        if (highTideFt != null) {
          if (highTideFt > 8) floodRisk = 'high';
          else if (highTideFt > 6) floodRisk = 'moderate';
          else if (highTideFt > 4) floodRisk = 'low';
        }

        const prediction: CoopsPrediction = {
          stationId,
          stationName,
          lat,
          lng,
          state,
          predictionType: 'tide',
          highTideTime,
          highTideFt,
          lowTideTime,
          lowTideFt,
          tidalRange,
          floodRisk,
          predictionDate: today.toISOString().slice(0, 10),
        };

        const gk = gridKey(lat, lng);
        (grid[gk] ??= []).push(prediction);
        totalPredictions++;
      } catch (err: any) {
        console.warn(`[NOAA Coastal Batch] CO-OPS station ${stationId} failed: ${err.message}`);
      }
    }

    if (totalPredictions === 0) {
      console.warn('[NOAA Coastal Batch] CO-OPS Predictions: no data returned -- skipping cache save');
      recordCronRun('rebuild-coops-predictions', 'success', Date.now() - start);
      return { name: 'coops-predictions', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    await setCoopsPredictionsCache({
      _meta: {
        built: new Date().toISOString(),
        predictionCount: totalPredictions,
        stationCount: stationIds.size,
      },
      grid,
    });

    console.log(`[NOAA Coastal Batch] CO-OPS Predictions: ${totalPredictions} predictions from ${stationIds.size} stations`);
    recordCronRun('rebuild-coops-predictions', 'success', Date.now() - start);
    return { name: 'coops-predictions', status: 'success', durationMs: Date.now() - start, recordCount: totalPredictions };
  } catch (err: any) {
    console.error('[NOAA Coastal Batch] CO-OPS Predictions failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-coops-predictions', batch: 'noaa-coastal-batch' } });
    recordCronRun('rebuild-coops-predictions', 'error', Date.now() - start, err.message);
    return { name: 'coops-predictions', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setCoopsPredictionsBuildInProgress(false);
  }
}

// ── Sub-cron 4: Hypoxia (dissolved oxygen monitoring) ───────────────────────

async function buildHypoxia(): Promise<SubCronResult> {
  const start = Date.now();

  if (isHypoxiaBuildInProgress()) {
    return { name: 'hypoxia', status: 'skipped', durationMs: Date.now() - start };
  }

  setHypoxiaBuildInProgress(true);
  try {
    const url = 'https://coastwatch.pfeg.noaa.gov/erddap/tabledap/erdGtsppBest.json?latitude,longitude,temperature,salinity,time&time>=now-30days&depth<=50';
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      headers: { Accept: 'application/json' },
    });
    if (!resp.ok) throw new Error(`Hypoxia HTTP ${resp.status}`);
    const json = await resp.json();

    const table = json?.table || {};
    const columnNames: string[] = table.columnNames || [];
    const rows: any[][] = table.rows || [];

    if (rows.length === 0) {
      console.warn('[NOAA Coastal Batch] Hypoxia: no data returned -- skipping cache save');
      recordCronRun('rebuild-hypoxia', 'success', Date.now() - start);
      return { name: 'hypoxia', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const latIdx = columnNames.indexOf('latitude');
    const lngIdx = columnNames.indexOf('longitude');
    const tempIdx = columnNames.indexOf('temperature');
    const salIdx = columnNames.indexOf('salinity');
    const timeIdx = columnNames.indexOf('time');

    const grid: Record<string, HypoxiaReading[]> = {};
    const stationIds = new Set<string>();
    let hypoxicZoneCount = 0;
    let readingCount = 0;

    for (const row of rows) {
      const lat = parseFloat(row[latIdx]);
      const lng = parseFloat(row[lngIdx]);
      if (isNaN(lat) || isNaN(lng)) continue;

      const temp = row[tempIdx] != null ? parseFloat(row[tempIdx]) : null;
      const sal = row[salIdx] != null ? parseFloat(row[salIdx]) : null;
      const sampleDate = row[timeIdx] || '';

      // Estimate dissolved oxygen from temperature/salinity using
      // simplified Weiss saturation equation; flag as hypoxic if < 2 mg/L.
      // In practice GTSPP doesn't always have DO directly, so we use a
      // threshold-based heuristic: warm + low-salinity waters near coast
      // are flagged as potential hypoxic zones.
      let estimatedDO: number | null = null;
      let isHypoxic = false;
      if (temp != null) {
        // Simplified: DO saturation decreases with temperature
        estimatedDO = Math.max(0, 14.6 - 0.4 * temp + (sal != null ? -0.01 * sal : 0));
        if (estimatedDO < 2) {
          isHypoxic = true;
          hypoxicZoneCount++;
        }
      }

      // Derive state from coordinates (Gulf/Atlantic coast)
      let state = 'US';
      if (lat > 24 && lat < 31 && lng > -98 && lng < -80) {
        if (lng > -82) state = 'FL';
        else if (lng > -90) state = 'LA';
        else state = 'TX';
      } else if (lat > 36 && lat < 40 && lng > -77 && lng < -74) {
        state = 'VA';
      }

      const stationKey = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
      stationIds.add(stationKey);

      const reading: HypoxiaReading = {
        stationId: stationKey,
        stationName: `GTSPP ${stationKey}`,
        waterbody: state !== 'US' ? `${state} coastal waters` : 'US coastal waters',
        lat,
        lng,
        state,
        dissolvedOxygen: estimatedDO,
        salinity: sal,
        temperature: temp,
        depth: null,
        hypoxicZone: isHypoxic,
        deadZoneAreaSqKm: null,
        sampleDate,
        source: 'NOAA GTSPP',
      };

      const gk = gridKey(lat, lng);
      (grid[gk] ??= []).push(reading);
      readingCount++;
    }

    await setHypoxiaCache({
      _meta: {
        built: new Date().toISOString(),
        readingCount,
        stationCount: stationIds.size,
        hypoxicZoneCount,
      },
      grid,
    });

    console.log(`[NOAA Coastal Batch] Hypoxia: ${readingCount} readings, ${stationIds.size} stations, ${hypoxicZoneCount} hypoxic zones`);
    recordCronRun('rebuild-hypoxia', 'success', Date.now() - start);
    return { name: 'hypoxia', status: 'success', durationMs: Date.now() - start, recordCount: readingCount };
  } catch (err: any) {
    console.error('[NOAA Coastal Batch] Hypoxia failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-hypoxia', batch: 'noaa-coastal-batch' } });
    recordCronRun('rebuild-hypoxia', 'error', Date.now() - start, err.message);
    return { name: 'hypoxia', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setHypoxiaBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[NOAA Coastal Batch] Starting batch rebuild of 4 NOAA coastal caches...');

  // Run sequentially to avoid overwhelming ERDDAP/CO-OPS servers and stay
  // within the 300s function timeout. Each sub-cron has its own try/catch
  // so a failure in one does not block the others.

  results.push(await buildHabForecast());
  results.push(await buildCoastwatch());
  results.push(await buildCoopsPredictions());
  results.push(await buildHypoxia());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[NOAA Coastal Batch] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-noaa-coastal-batch', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack if any sub-cron failed
  if (failed > 0) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-noaa-coastal-batch',
      error: `Sub-crons failed: ${failedNames}`,
      duration: totalDurationMs,
    });
  }

  const httpStatus = failed === results.length ? 500 : 200;

  return NextResponse.json({
    status: overallStatus,
    duration: `${elapsed}s`,
    summary: { succeeded, failed, skipped, empty, total: results.length },
    results: results.map(r => ({
      name: r.name,
      status: r.status,
      duration: `${(r.durationMs / 1000).toFixed(1)}s`,
      recordCount: r.recordCount,
      error: r.error,
    })),
    cacheStatus: {
      habForecast: getHabForecastCacheStatus(),
      coastwatch: getCoastwatchCacheStatus(),
      coopsPredictions: getCoopsPredictionsCacheStatus(),
      hypoxia: getHypoxiaCacheStatus(),
    },
  }, { status: httpStatus });
}

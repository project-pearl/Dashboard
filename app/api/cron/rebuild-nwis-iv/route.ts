// app/api/cron/rebuild-nwis-iv/route.ts
// Cron endpoint — fetches USGS NWIS Instantaneous Values (IV) for real-time
// surface water quality across 19 priority states. Runs every 30 minutes.
// Fetches DO, pH, temperature, conductivity, turbidity, discharge, gage height.
// After caching, runs the threshold alert engine to detect exceedances.

import { NextRequest, NextResponse } from 'next/server';
import {
  setUsgsIvCache, getUsgsIvCacheStatus,
  isNwisIvBuildInProgress, setNwisIvBuildInProgress,
  getExistingGrid, gridKey,
  USGS_PARAM_MAP, IV_PARAMETER_CODES,
  type UsgsIvSite, type UsgsIvReading,
} from '@/lib/nwisIvCache';
import { evaluateThresholds } from '@/lib/usgsAlertEngine';
import { setAlertsBulk } from '@/lib/usgsAlertCache';
import { fetchAllSignals } from '@/lib/signals';
import { archiveSignals } from '@/lib/signalArchiveCache';
import { ALL_STATES } from '@/lib/constants';

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

// ── Config ───────────────────────────────────────────────────────────────────

const NWIS_IV_BASE = 'https://waterservices.usgs.gov/nwis/iv/';
const CONCURRENCY = 6;   // Fetch 6 states at a time
const RETRY_DELAY_MS = 5000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Parse USGS IV JSON response into site + reading records.
 * Keeps only the latest reading per site+parameter (deduplication).
 */
function parseIvResponse(
  json: any,
  stateAbbr: string,
): { sites: UsgsIvSite[]; readings: UsgsIvReading[] } {
  const sites: UsgsIvSite[] = [];
  const readings: UsgsIvReading[] = [];

  const timeSeries = json?.value?.timeSeries;
  if (!Array.isArray(timeSeries)) return { sites, readings };

  // Track sites and latest reading per site+param
  const siteMap = new Map<string, UsgsIvSite>();
  const latestReading = new Map<string, UsgsIvReading>(); // key: siteNumber|paramCd

  for (const ts of timeSeries) {
    const src = ts.sourceInfo;
    const variable = ts.variable;
    if (!src || !variable) continue;

    const siteCode = src.siteCode?.[0]?.value || '';
    if (!siteCode) continue;

    const geo = src.geoLocation?.geogLocation;
    const lat = parseFloat(geo?.latitude || '');
    const lng = parseFloat(geo?.longitude || '');
    if (isNaN(lat) || isNaN(lng) || lat === 0) continue;

    const roundedLat = Math.round(lat * 100000) / 100000;
    const roundedLng = Math.round(lng * 100000) / 100000;

    // Extract site metadata
    if (!siteMap.has(siteCode)) {
      const props = src.siteProperty || [];
      const getProp = (name: string) =>
        props.find((p: any) => p.name === name)?.value || '';

      siteMap.set(siteCode, {
        siteNumber: siteCode,
        siteName: src.siteName || '',
        siteType: getProp('siteTypeCd') || 'ST',
        state: stateAbbr,
        huc: getProp('hucCd') || '',
        lat: roundedLat,
        lng: roundedLng,
        parameterCodes: [],
      });
    }

    // Track which parameters this site has
    const paramCd = variable.variableCode?.[0]?.value || '';
    const paramName = USGS_PARAM_MAP[paramCd] || paramCd;
    const unit = variable.unit?.unitCode || '';
    const noData = variable.noDataValue ?? -999999;

    const site = siteMap.get(siteCode)!;
    if (!site.parameterCodes.includes(paramCd)) {
      site.parameterCodes.push(paramCd);
    }

    // Find the latest non-null reading for this site+param
    const values = ts.values?.[0]?.value;
    if (!Array.isArray(values)) continue;

    for (const v of values) {
      const val = parseFloat(v.value);
      if (isNaN(val) || val === noData) continue;

      const dedupeKey = `${siteCode}|${paramCd}`;
      const existing = latestReading.get(dedupeKey);
      const dateTime = v.dateTime || '';

      if (!existing || dateTime > existing.dateTime) {
        latestReading.set(dedupeKey, {
          siteNumber: siteCode,
          dateTime,
          parameterCd: paramCd,
          parameterName: paramName,
          value: Math.round(val * 1000) / 1000,
          unit,
          qualifier: Array.isArray(v.qualifiers) ? v.qualifiers.join(',') : (v.qualifiers || ''),
          lat: roundedLat,
          lng: roundedLng,
        });
      }
    }
  }

  return {
    sites: Array.from(siteMap.values()),
    readings: Array.from(latestReading.values()),
  };
}

/**
 * Fetch IV data for a single state.
 */
async function fetchStateIv(
  stateAbbr: string,
  timeoutMs = 45_000,
): Promise<{ sites: UsgsIvSite[]; readings: UsgsIvReading[] }> {
  const url = `${NWIS_IV_BASE}?format=json&stateCd=${stateAbbr}` +
    `&parameterCd=${IV_PARAMETER_CODES}` +
    `&period=P1D&siteStatus=active&siteType=ST,LK,ES`;

  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!resp.ok) {
    throw new Error(`USGS IV API ${stateAbbr}: ${resp.status} ${resp.statusText}`);
  }

  const json = await resp.json();
  return parseIvResponse(json, stateAbbr);
}

/**
 * Process states in batches of CONCURRENCY.
 */
async function fetchAllStates(states: readonly string[]): Promise<{
  allSites: UsgsIvSite[];
  allReadings: UsgsIvReading[];
  processedStates: string[];
  stateResults: Record<string, { sites: number; readings: number }>;
}> {
  const allSites: UsgsIvSite[] = [];
  const allReadings: UsgsIvReading[] = [];
  const processedStates: string[] = [];
  const stateResults: Record<string, { sites: number; readings: number }> = {};

  // Process in batches of CONCURRENCY
  for (let i = 0; i < states.length; i += CONCURRENCY) {
    const batch = states.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(st => fetchStateIv(st)),
    );

    for (let j = 0; j < batch.length; j++) {
      const stateAbbr = batch[j];
      const result = results[j];

      if (result.status === 'fulfilled') {
        const { sites, readings } = result.value;
        allSites.push(...sites);
        allReadings.push(...readings);
        processedStates.push(stateAbbr);
        stateResults[stateAbbr] = { sites: sites.length, readings: readings.length };
        console.log(`[NWIS-IV Cron] ${stateAbbr}: ${sites.length} sites, ${readings.length} readings`);
      } else {
        console.warn(`[NWIS-IV Cron] ${stateAbbr} failed: ${result.reason?.message || result.reason}`);
        stateResults[stateAbbr] = { sites: 0, readings: 0 };
      }
    }
  }

  return { allSites, allReadings, processedStates, stateResults };
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isNwisIvBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWIS-IV build already in progress',
      cache: getUsgsIvCacheStatus(),
    });
  }

  setNwisIvBuildInProgress(true);
  const startTime = Date.now();

  try {
    // ── Fetch all states ────────────────────────────────────────────────
    const { allSites, allReadings, processedStates, stateResults } =
      await fetchAllStates(ALL_STATES);

    // ── Retry failed states ─────────────────────────────────────────────
    const failedStates = ALL_STATES.filter(s => !processedStates.includes(s));
    if (failedStates.length > 0) {
      console.log(`[NWIS-IV Cron] Retrying ${failedStates.length} failed states...`);
      await delay(RETRY_DELAY_MS);

      const retryResults = await Promise.allSettled(
        failedStates.map(st => fetchStateIv(st, 60_000)),
      );

      for (let i = 0; i < failedStates.length; i++) {
        const stateAbbr = failedStates[i];
        const result = retryResults[i];
        if (result.status === 'fulfilled') {
          allSites.push(...result.value.sites);
          allReadings.push(...result.value.readings);
          processedStates.push(stateAbbr);
          stateResults[stateAbbr] = {
            sites: result.value.sites.length,
            readings: result.value.readings.length,
          };
          console.log(`[NWIS-IV Cron] ${stateAbbr}: RETRY OK`);
        } else {
          console.warn(`[NWIS-IV Cron] ${stateAbbr}: RETRY FAILED — ${result.reason?.message || result.reason}`);
        }
      }
    }

    // ── Run threshold alert engine ──────────────────────────────────────
    const siteNames = new Map<string, string>();
    const siteStates = new Map<string, string>();
    for (const s of allSites) {
      siteNames.set(s.siteNumber, s.siteName);
      siteStates.set(s.siteNumber, s.state);
    }

    const allAlerts = evaluateThresholds(allReadings, siteNames, siteStates);

    // Group alerts by state for storage
    const alertsByState: Record<string, typeof allAlerts> = {};
    for (const alert of allAlerts) {
      const st = alert.state || 'UNKNOWN';
      if (!alertsByState[st]) alertsByState[st] = [];
      alertsByState[st].push(alert);
    }

    // Save alerts (single bulk write)
    if (allAlerts.length > 0) {
      await setAlertsBulk(alertsByState);
    }

    // ── Archive signals from authoritative feeds ────────────────────────
    let archivedCount = 0;
    try {
      const { signals } = await fetchAllSignals({ limit: 100 });
      if (signals.length > 0) {
        await archiveSignals(signals);
        archivedCount = signals.length;
      }
    } catch (e: any) {
      console.warn(`[NWIS-IV Cron] Signal archive failed (non-blocking): ${e.message}`);
    }

    const alertSummary = {
      total: allAlerts.length,
      critical: allAlerts.filter(a => a.severity === 'critical').length,
      warning: allAlerts.filter(a => a.severity === 'warning').length,
    };

    console.log(
      `[NWIS-IV Cron] Alerts: ${alertSummary.total} fired ` +
      `(${alertSummary.critical} critical, ${alertSummary.warning} warning)` +
      ` | Signals archived: ${archivedCount}`
    );

    // ── Merge into grid ─────────────────────────────────────────────────
    // Start from existing grid to preserve data from previous runs
    const existingGrid = getExistingGrid();
    const grid: Record<string, { sites: UsgsIvSite[]; readings: UsgsIvReading[] }> = {};

    // Copy existing cells for states NOT in this run (preserves data)
    if (existingGrid) {
      for (const [key, cell] of Object.entries(existingGrid)) {
        // Check if any site in this cell belongs to a processed state
        const cellStates = new Set(cell.sites.map(s => s.state));
        const isProcessedState = [...cellStates].some(s => processedStates.includes(s));
        if (!isProcessedState) {
          grid[key] = cell;
        }
      }
    }

    const emptyCell = () => ({
      sites: [] as UsgsIvSite[],
      readings: [] as UsgsIvReading[],
    });

    for (const s of allSites) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].sites.push(s);
    }
    for (const r of allReadings) {
      const key = gridKey(r.lat, r.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].readings.push(r);
    }

    // ── Count totals (including preserved cells) ────────────────────────
    let totalSites = 0;
    let totalReadings = 0;
    for (const cell of Object.values(grid)) {
      totalSites += cell.sites.length;
      totalReadings += cell.readings.length;
    }

    // ── Store in cache ──────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        siteCount: totalSites,
        readingCount: totalReadings,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    if (allSites.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NWIS-IV Cron] 0 sites fetched in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getUsgsIvCacheStatus(),
      });
    }

    await setUsgsIvCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NWIS-IV Cron] Build complete in ${elapsed}s — ` +
      `${totalSites} sites, ${totalReadings} readings, ` +
      `${Object.keys(grid).length} cells, ${allAlerts.length} alerts`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      sites: totalSites,
      readings: totalReadings,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
      alerts: alertSummary,
      signalsArchived: archivedCount,
      states: stateResults,
      cache: getUsgsIvCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NWIS-IV Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NWIS-IV build failed' },
      { status: 500 },
    );
  } finally {
    setNwisIvBuildInProgress(false);
  }
}

// app/api/cron/rebuild-nwis-gw/route.ts
// Cron endpoint — fetches USGS NWIS groundwater level data (gwlevels, IV-GW,
// DV-GW) for all 51 states using time-budgeted self-chaining.
// Each invocation processes as many states as it can within 230s, then
// self-chains to the next chunk via ?offset=N.
// Schedule: daily via Vercel cron (8 AM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import {
  setNwisGwCache, getNwisGwCacheStatus,
  isNwisGwBuildInProgress, setNwisGwBuildInProgress,
  getExistingGrid, getExistingStatesProcessed,
  ensureWarmed,
  gridKey,
  type NwisGwSite, type NwisGwLevel, type NwisGwTrend,
} from '@/lib/nwisGwCache';

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

// ── Config ───────────────────────────────────────────────────────────────────

const NWIS_BASE = 'https://waterservices.usgs.gov/nwis';
const TIME_BUDGET_MS = 230_000;  // 230s — leave 70s margin for save + response
const MAX_CHAIN_DEPTH = 10;      // Safety: stop after 10 hops
const CONCURRENCY = 3;           // Fetch 3 states at a time within budget

// GW parameter codes: depth-to-water, GW level NGVD29, GW level NAVD88
const GW_PARAMS = '72019,62610,62611';

import { ALL_STATES } from '@/lib/constants';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse USGS NWIS WaterML JSON response into site + level records.
 */
function parseNwisResponse(
  json: any,
  stateAbbr: string,
  isRealtime: boolean,
): { sites: NwisGwSite[]; levels: NwisGwLevel[] } {
  const sites: NwisGwSite[] = [];
  const levels: NwisGwLevel[] = [];

  const timeSeries = json?.value?.timeSeries;
  if (!Array.isArray(timeSeries)) return { sites, levels };

  const seenSites = new Set<string>();

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

    // Extract site metadata (deduplicate by siteCode)
    if (!seenSites.has(siteCode)) {
      seenSites.add(siteCode);

      const props = src.siteProperty || [];
      const getProp = (name: string) =>
        props.find((p: any) => p.name === name)?.value || '';

      sites.push({
        siteNumber: siteCode,
        siteName: src.siteName || '',
        aquiferCode: getProp('aquiferCode'),
        wellDepth: src.wellDepthFeet ? parseFloat(src.wellDepthFeet) : null,
        state: stateAbbr,
        county: getProp('countyCode') || getProp('countyCd') || '',
        huc: getProp('hucCd') || '',
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
      });
    }

    // Extract values
    const paramCd = variable.variableCode?.[0]?.value || '';
    const paramName = variable.variableName || '';
    const unit = variable.unit?.unitCode || 'ft';
    const noData = variable.noDataValue ?? -999999;

    const values = ts.values?.[0]?.value;
    if (!Array.isArray(values)) continue;

    for (const v of values) {
      const val = parseFloat(v.value);
      if (isNaN(val) || val === noData) continue;

      levels.push({
        siteNumber: siteCode,
        dateTime: v.dateTime || '',
        value: Math.round(val * 100) / 100,
        unit,
        parameterCd: paramCd,
        parameterName: paramName,
        qualifier: Array.isArray(v.qualifiers) ? v.qualifiers.join(',') : (v.qualifiers || ''),
        isRealtime,
        lat: Math.round(lat * 100000) / 100000,
        lng: Math.round(lng * 100000) / 100000,
      });
    }
  }

  return { sites, levels };
}

/**
 * Compute trends from DV levels per site.
 */
function computeTrends(
  sites: Map<string, NwisGwSite>,
  dvLevels: NwisGwLevel[],
): NwisGwTrend[] {
  // Group DV levels by site
  const bySite = new Map<string, NwisGwLevel[]>();
  for (const l of dvLevels) {
    const arr = bySite.get(l.siteNumber) || [];
    arr.push(l);
    bySite.set(l.siteNumber, arr);
  }

  const trends: NwisGwTrend[] = [];
  const now = Date.now();
  const d30 = 30 * 24 * 60 * 60 * 1000;
  const d90 = 90 * 24 * 60 * 60 * 1000;

  for (const [siteNum, siteLevels] of bySite) {
    if (siteLevels.length === 0) continue;

    // Sort by date descending
    siteLevels.sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));

    const latest = siteLevels[0];
    const site = sites.get(siteNum);

    // Compute rolling averages
    const vals30d: number[] = [];
    const vals90d: number[] = [];
    for (const l of siteLevels) {
      const dt = new Date(l.dateTime).getTime();
      if (!isNaN(dt)) {
        if (now - dt <= d30) vals30d.push(l.value);
        if (now - dt <= d90) vals90d.push(l.value);
      }
    }

    const avg30d = vals30d.length > 0 ? vals30d.reduce((a, b) => a + b, 0) / vals30d.length : null;
    const avg90d = vals90d.length > 0 ? vals90d.reduce((a, b) => a + b, 0) / vals90d.length : null;

    let trend: 'rising' | 'falling' | 'stable' | 'unknown' = 'unknown';
    let trendMagnitude = 0;

    if (avg30d !== null && vals30d.length >= 3) {
      const recent7d = siteLevels
        .filter(l => now - new Date(l.dateTime).getTime() <= 7 * 24 * 60 * 60 * 1000)
        .map(l => l.value);

      if (recent7d.length > 0) {
        const recentAvg = recent7d.reduce((a, b) => a + b, 0) / recent7d.length;
        const diff = recentAvg - avg30d;

        const isDepthParam = latest.parameterCd === '72019';
        const normalizedDiff = isDepthParam ? -diff : diff;

        trendMagnitude = Math.round(Math.abs(normalizedDiff) * 100) / 100;

        if (Math.abs(normalizedDiff) < 0.5) {
          trend = 'stable';
        } else if (normalizedDiff > 0) {
          trend = 'rising';
        } else {
          trend = 'falling';
        }
      }
    }

    trends.push({
      siteNumber: siteNum,
      siteName: site?.siteName || '',
      latestLevel: latest.value,
      latestDate: latest.dateTime,
      avgLevel30d: avg30d !== null ? Math.round(avg30d * 100) / 100 : null,
      avgLevel90d: avg90d !== null ? Math.round(avg90d * 100) / 100 : null,
      trend,
      trendMagnitude,
      lat: latest.lat,
      lng: latest.lng,
    });
  }

  return trends;
}

/**
 * Fetch GW data for a single state (3 endpoints in parallel).
 */
async function fetchStateGw(stateAbbr: string): Promise<{
  sites: NwisGwSite[];
  levels: NwisGwLevel[];
  trends: NwisGwTrend[];
}> {
  const siteMap = new Map<string, NwisGwSite>();
  let stateLevels: NwisGwLevel[] = [];
  let dvLevels: NwisGwLevel[] = [];

  const gwUrl = `${NWIS_BASE}/gwlevels/?format=json&stateCd=${stateAbbr}&period=P365D&siteStatus=active`;
  const ivUrl = `${NWIS_BASE}/iv/?format=json&stateCd=${stateAbbr}&parameterCd=${GW_PARAMS}&siteType=GW&period=P7D&siteStatus=active`;
  const dvUrl = `${NWIS_BASE}/dv/?format=json&stateCd=${stateAbbr}&parameterCd=${GW_PARAMS}&siteType=GW&period=P90D&siteStatus=active`;

  const fetchOpts = { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(45_000) };

  const [gwResult, ivResult, dvResult] = await Promise.allSettled([
    fetch(gwUrl, fetchOpts).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(ivUrl, fetchOpts).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch(dvUrl, fetchOpts).then(r => r.ok ? r.json() : null).catch(() => null),
  ]);

  const gwJson = gwResult.status === 'fulfilled' ? gwResult.value : null;
  if (gwJson) {
    const parsed = parseNwisResponse(gwJson, stateAbbr, false);
    for (const s of parsed.sites) siteMap.set(s.siteNumber, s);
    stateLevels.push(...parsed.levels);
  }

  const ivJson = ivResult.status === 'fulfilled' ? ivResult.value : null;
  if (ivJson) {
    const parsed = parseNwisResponse(ivJson, stateAbbr, true);
    for (const s of parsed.sites) {
      if (!siteMap.has(s.siteNumber)) siteMap.set(s.siteNumber, s);
    }
    stateLevels.push(...parsed.levels);
  }

  const dvJson = dvResult.status === 'fulfilled' ? dvResult.value : null;
  if (dvJson) {
    const parsed = parseNwisResponse(dvJson, stateAbbr, false);
    for (const s of parsed.sites) {
      if (!siteMap.has(s.siteNumber)) siteMap.set(s.siteNumber, s);
    }
    dvLevels = parsed.levels;
  }

  const dedupedSites = Array.from(siteMap.values());

  // Deduplicate levels by siteNumber|dateTime|parameterCd
  const levelMap = new Map<string, NwisGwLevel>();
  for (const l of stateLevels) {
    const key = `${l.siteNumber}|${l.dateTime}|${l.parameterCd}`;
    if (!levelMap.has(key)) levelMap.set(key, l);
  }

  // Cap levels per site to limit cache size
  const latestPerSite = new Map<string, NwisGwLevel[]>();
  for (const l of levelMap.values()) {
    const arr = latestPerSite.get(l.siteNumber) || [];
    arr.push(l);
    latestPerSite.set(l.siteNumber, arr);
  }
  const cappedLevels: NwisGwLevel[] = [];
  for (const [, siteLevels] of latestPerSite) {
    siteLevels.sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));
    cappedLevels.push(...siteLevels.slice(0, 30));
  }

  const trends = computeTrends(siteMap, dvLevels);

  return { sites: dedupedSites, levels: cappedLevels, trends };
}

/**
 * Trigger the next chunk via self-chain.
 */
async function triggerNextChunk(
  cronSecret: string | undefined,
  offset: number,
  depth: number,
  failed: string[],
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_ORIGIN ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!baseUrl) return;

  const params = new URLSearchParams();
  params.set('offset', String(offset));
  params.set('depth', String(depth + 1));
  if (failed.length > 0) params.set('failed', failed.join(','));
  const url = `${baseUrl}/api/cron/rebuild-nwis-gw?${params}`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['authorization'] = `Bearer ${cronSecret}`;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  try {
    await fetch(url, { headers, signal: ac.signal });
  } catch {
    // AbortError is expected
  } finally {
    clearTimeout(timer);
  }
  console.log(`[NWIS-GW Chain] Triggered depth=${depth + 1}, offset=${offset}`);
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse chain params
  const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0', 10);
  const depth = parseInt(request.nextUrl.searchParams.get('depth') || '0', 10);
  const failedParam = request.nextUrl.searchParams.get('failed') || '';
  const previouslyFailed = failedParam ? failedParam.split(',').filter(Boolean) : [];

  // Load existing cache from blob for merging
  await ensureWarmed();

  // Prevent concurrent builds (only on first chunk)
  if (offset === 0 && isNwisGwBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWIS-GW build already in progress',
      cache: getNwisGwCacheStatus(),
    });
  }

  // Safety: stop infinite chains
  if (depth >= MAX_CHAIN_DEPTH) {
    return NextResponse.json({
      status: 'chain-limit',
      reason: `Reached max chain depth (${MAX_CHAIN_DEPTH})`,
      depth,
      cache: getNwisGwCacheStatus(),
    });
  }

  setNwisGwBuildInProgress(true);
  const startTime = Date.now();
  const stateResults: Record<string, Record<string, number>> = {};

  try {
    // Build the queue: remaining states from offset, plus any previously failed
    const remaining = ALL_STATES.slice(offset);
    const retryStates = previouslyFailed.filter(s => !(remaining as readonly string[]).includes(s));
    const queue = [...remaining, ...retryStates];

    if (queue.length === 0) {
      setNwisGwBuildInProgress(false);
      return NextResponse.json({
        status: 'no-op',
        reason: 'All states already processed',
        cache: getNwisGwCacheStatus(),
      });
    }

    const allSites: NwisGwSite[] = [];
    const allLevels: NwisGwLevel[] = [];
    const allTrends: NwisGwTrend[] = [];
    const processedStates: string[] = [];
    const failedStates: string[] = [];
    let statesConsumed = 0;  // How many from ALL_STATES we attempted (not retries)

    // Process states with semaphore, respecting time budget
    let qIdx = 0;
    let runningCount = 0;
    let budgetExhausted = false;

    await new Promise<void>((resolve) => {
      function next() {
        if (qIdx >= queue.length && runningCount === 0) return resolve();
        if (budgetExhausted && runningCount === 0) return resolve();

        while (runningCount < CONCURRENCY && qIdx < queue.length && !budgetExhausted) {
          // Check time budget before starting a new state
          if (Date.now() - startTime > TIME_BUDGET_MS) {
            budgetExhausted = true;
            if (runningCount === 0) return resolve();
            return;
          }

          const stateAbbr = queue[qIdx];
          const isRetry = qIdx >= remaining.length;
          qIdx++;
          if (!isRetry) statesConsumed++;
          runningCount++;

          (async () => {
            try {
              console.log(`[NWIS-GW Cron] Fetching ${stateAbbr}${isRetry ? ' (retry)' : ''}...`);
              const result = await fetchStateGw(stateAbbr);

              allSites.push(...result.sites);
              allLevels.push(...result.levels);
              allTrends.push(...result.trends);
              processedStates.push(stateAbbr);

              stateResults[stateAbbr] = {
                sites: result.sites.length,
                levels: result.levels.length,
                trends: result.trends.length,
              };

              console.log(
                `[NWIS-GW Cron] ${stateAbbr}: ${result.sites.length} sites, ` +
                `${result.levels.length} levels, ${result.trends.length} trends`
              );
            } catch (e) {
              console.warn(`[NWIS-GW Cron] ${stateAbbr} failed:`, e instanceof Error ? e.message : e);
              stateResults[stateAbbr] = { sites: 0, levels: 0, trends: 0 };
              failedStates.push(stateAbbr);
            } finally {
              runningCount--;
              next();
            }
          })();
        }
      }
      next();
    });

    // ── Merge into grid: start from existing, replace processed states ────
    const existingGrid = getExistingGrid();
    const existingStates = new Set(getExistingStatesProcessed());
    const grid: Record<string, { sites: NwisGwSite[]; levels: NwisGwLevel[]; trends: NwisGwTrend[] }> = {};

    // Copy existing cells for states NOT in this chunk (preserves previous data)
    if (existingGrid) {
      for (const [key, cell] of Object.entries(existingGrid)) {
        const cellStates = new Set(cell.sites.map(s => s.state));
        const isProcessedState = [...cellStates].some(s => processedStates.includes(s));
        if (!isProcessedState) {
          grid[key] = cell;
        }
      }
    }

    const emptyCell = () => ({
      sites: [] as NwisGwSite[],
      levels: [] as NwisGwLevel[],
      trends: [] as NwisGwTrend[],
    });

    for (const s of allSites) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].sites.push(s);
    }
    for (const l of allLevels) {
      const key = gridKey(l.lat, l.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].levels.push(l);
    }
    for (const t of allTrends) {
      const key = gridKey(t.lat, t.lng);
      if (!grid[key]) grid[key] = emptyCell();
      grid[key].trends.push(t);
    }

    // Merge states processed lists
    const allStatesProcessed = [
      ...new Set([...existingStates, ...processedStates]),
    ];

    // Count totals (including preserved cells)
    let totalSites = 0;
    let totalLevels = 0;
    let totalTrends = 0;
    for (const cell of Object.values(grid)) {
      totalSites += cell.sites.length;
      totalLevels += cell.levels.length;
      totalTrends += cell.trends.length;
    }

    // ── Save (even partial) — always save to preserve progress ──────────
    if (allSites.length > 0 || existingGrid) {
      const cacheData = {
        _meta: {
          built: new Date().toISOString(),
          siteCount: totalSites,
          levelCount: totalLevels,
          trendCount: totalTrends,
          statesProcessed: allStatesProcessed,
          gridCells: Object.keys(grid).length,
        },
        grid,
      };
      await setNwisGwCache(cacheData);
    }

    // ── Self-chain if there are more states ──────────────────────────────
    const nextOffset = offset + statesConsumed;
    const moreStates = nextOffset < ALL_STATES.length;
    const hasFailedToRetry = failedStates.length > 0;
    const willChain = moreStates || hasFailedToRetry;

    if (willChain) {
      const chainOffset = moreStates ? nextOffset : ALL_STATES.length;
      await triggerNextChunk(cronSecret, chainOffset, depth, failedStates);
    }

    setNwisGwBuildInProgress(false);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NWIS-GW Cron] Chunk complete in ${elapsed}s — ` +
      `${processedStates.length} states this chunk, ${allStatesProcessed.length} total, ` +
      `${totalSites} sites, ${totalLevels} levels, ${totalTrends} trends`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      depth,
      offset,
      nextOffset: willChain ? nextOffset : null,
      statesThisChunk: processedStates.length,
      statesFailed: failedStates,
      totalStatesProcessed: allStatesProcessed.length,
      sites: totalSites,
      levels: totalLevels,
      trends: totalTrends,
      gridCells: Object.keys(grid).length,
      selfChained: willChain,
      states: stateResults,
      cache: getNwisGwCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NWIS-GW Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NWIS-GW build failed' },
      { status: 500 },
    );
  } finally {
    setNwisGwBuildInProgress(false);
  }
}

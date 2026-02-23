// app/api/cron/rebuild-nwis-gw/route.ts
// Cron endpoint — fetches USGS NWIS groundwater level data (gwlevels, IV-GW,
// DV-GW) for priority states, computes trends, deduplicates, and populates
// the in-memory spatial cache for instant lookups.
// Schedule: daily via Vercel cron (8 AM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import {
  setNwisGwCache, getNwisGwCacheStatus,
  isNwisGwBuildInProgress, setNwisGwBuildInProgress,
  gridKey,
  type NwisGwSite, type NwisGwLevel, type NwisGwTrend,
} from '@/lib/nwisGwCache';

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

// ── Config ───────────────────────────────────────────────────────────────────

const NWIS_BASE = 'https://waterservices.usgs.gov/nwis';
const STATE_DELAY_MS = 2000;

// GW parameter codes: depth-to-water, GW level NGVD29, GW level NAVD88
const GW_PARAMS = '72019,62610,62611';

import { PRIORITY_STATES } from '@/lib/constants';

// USGS state code mapping (FIPS)
const STATE_TO_FIPS: Record<string, string> = {
  MD: '24', VA: '51', DC: '11', PA: '42', DE: '10', FL: '12', WV: '54',
  CA: '06', TX: '48', NY: '36', NJ: '34', OH: '39', NC: '37', MA: '25',
  GA: '13', IL: '17', MI: '26', WA: '53', OR: '41',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

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

    // Determine trend: compare recent 7-day avg to 30-day avg
    // For depth-to-water (72019): rising value = water dropping; for elevation params: rising = water rising
    // We normalize: "rising" always means water table is getting higher (good)
    let trend: 'rising' | 'falling' | 'stable' | 'unknown' = 'unknown';
    let trendMagnitude = 0;

    if (avg30d !== null && vals30d.length >= 3) {
      const recent7d = siteLevels
        .filter(l => now - new Date(l.dateTime).getTime() <= 7 * 24 * 60 * 60 * 1000)
        .map(l => l.value);

      if (recent7d.length > 0) {
        const recentAvg = recent7d.reduce((a, b) => a + b, 0) / recent7d.length;
        const diff = recentAvg - avg30d;

        // For depth-to-water (72019), positive diff means deeper = falling water table
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

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isNwisGwBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWIS-GW build already in progress',
      cache: getNwisGwCacheStatus(),
    });
  }

  setNwisGwBuildInProgress(true);
  const startTime = Date.now();
  const stateResults: Record<string, Record<string, number>> = {};

  try {
    const allSites: NwisGwSite[] = [];
    const allLevels: NwisGwLevel[] = [];
    const allTrends: NwisGwTrend[] = [];
    const processedStates: string[] = [];

    for (const stateAbbr of PRIORITY_STATES) {
      try {
        console.log(`[NWIS-GW Cron] Fetching ${stateAbbr}...`);

        const siteMap = new Map<string, NwisGwSite>();
        let stateLevels: NwisGwLevel[] = [];
        let dvLevels: NwisGwLevel[] = [];

        // Fetch all 3 endpoints in parallel
        const gwUrl = `${NWIS_BASE}/gwlevels/?format=json&stateCd=${stateAbbr}&period=P365D&siteStatus=active`;
        const ivUrl = `${NWIS_BASE}/iv/?format=json&stateCd=${stateAbbr}&parameterCd=${GW_PARAMS}&siteType=GW&period=P7D&siteStatus=active`;
        const dvUrl = `${NWIS_BASE}/dv/?format=json&stateCd=${stateAbbr}&parameterCd=${GW_PARAMS}&siteType=GW&period=P90D&siteStatus=active`;

        const fetchOpts = { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(45_000) };

        const [gwResult, ivResult, dvResult] = await Promise.allSettled([
          fetch(gwUrl, fetchOpts).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(ivUrl, fetchOpts).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(dvUrl, fetchOpts).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);

        // Process gwlevels
        const gwJson = gwResult.status === 'fulfilled' ? gwResult.value : null;
        if (gwJson) {
          const parsed = parseNwisResponse(gwJson, stateAbbr, false);
          for (const s of parsed.sites) siteMap.set(s.siteNumber, s);
          stateLevels.push(...parsed.levels);
        }

        // Process IV
        const ivJson = ivResult.status === 'fulfilled' ? ivResult.value : null;
        if (ivJson) {
          const parsed = parseNwisResponse(ivJson, stateAbbr, true);
          for (const s of parsed.sites) {
            if (!siteMap.has(s.siteNumber)) siteMap.set(s.siteNumber, s);
          }
          stateLevels.push(...parsed.levels);
        }

        // Process DV
        const dvJson = dvResult.status === 'fulfilled' ? dvResult.value : null;
        if (dvJson) {
          const parsed = parseNwisResponse(dvJson, stateAbbr, false);
          for (const s of parsed.sites) {
            if (!siteMap.has(s.siteNumber)) siteMap.set(s.siteNumber, s);
          }
          dvLevels = parsed.levels;
        }

        // Deduplicate sites
        const dedupedSites = Array.from(siteMap.values());

        // Deduplicate levels by siteNumber|dateTime|parameterCd
        const levelMap = new Map<string, NwisGwLevel>();
        for (const l of stateLevels) {
          const key = `${l.siteNumber}|${l.dateTime}|${l.parameterCd}`;
          if (!levelMap.has(key)) levelMap.set(key, l);
        }
        const dedupedLevels = Array.from(levelMap.values());

        // Keep only latest N levels per site to limit cache size
        const latestPerSite = new Map<string, NwisGwLevel[]>();
        for (const l of dedupedLevels) {
          const arr = latestPerSite.get(l.siteNumber) || [];
          arr.push(l);
          latestPerSite.set(l.siteNumber, arr);
        }
        const cappedLevels: NwisGwLevel[] = [];
        for (const [, siteLevels] of latestPerSite) {
          siteLevels.sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));
          cappedLevels.push(...siteLevels.slice(0, 30)); // Keep last 30 per site
        }

        // Compute trends from DV data
        const stateTrends = computeTrends(siteMap, dvLevels);

        for (const s of dedupedSites) allSites.push(s);
        for (const l of cappedLevels) allLevels.push(l);
        for (const t of stateTrends) allTrends.push(t);
        processedStates.push(stateAbbr);

        stateResults[stateAbbr] = {
          sites: dedupedSites.length,
          levels: cappedLevels.length,
          trends: stateTrends.length,
        };

        console.log(
          `[NWIS-GW Cron] ${stateAbbr}: ${dedupedSites.length} sites, ` +
          `${cappedLevels.length} levels, ${stateTrends.length} trends`
        );
      } catch (e) {
        console.warn(`[NWIS-GW Cron] ${stateAbbr} failed:`, e instanceof Error ? e.message : e);
        stateResults[stateAbbr] = { sites: 0, levels: 0, trends: 0 };
      }

      // Rate limit delay between states
      await delay(STATE_DELAY_MS);
    }

    // ── Retry failed states ───────────────────────────────────────────────
    const failedStates = PRIORITY_STATES.filter(s => !processedStates.includes(s));
    if (failedStates.length > 0) {
      console.log(`[NWIS-GW Cron] Retrying ${failedStates.length} failed states...`);
      for (const stateAbbr of failedStates) {
        await delay(5000);
        try {
          const retryOpts = { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(60_000) };
          const gwUrl = `${NWIS_BASE}/gwlevels/?format=json&stateCd=${stateAbbr}&period=P365D&siteStatus=active`;
          const ivUrl = `${NWIS_BASE}/iv/?format=json&stateCd=${stateAbbr}&parameterCd=${GW_PARAMS}&siteType=GW&period=P7D&siteStatus=active`;
          const dvUrl = `${NWIS_BASE}/dv/?format=json&stateCd=${stateAbbr}&parameterCd=${GW_PARAMS}&siteType=GW&period=P90D&siteStatus=active`;

          const [gwR, ivR, dvR] = await Promise.allSettled([
            fetch(gwUrl, retryOpts).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(ivUrl, retryOpts).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(dvUrl, retryOpts).then(r => r.ok ? r.json() : null).catch(() => null),
          ]);

          const retrySiteMap = new Map<string, NwisGwSite>();
          const retryLevels: NwisGwLevel[] = [];
          if (gwR.status === 'fulfilled' && gwR.value) {
            const p = parseNwisResponse(gwR.value, stateAbbr, false);
            for (const s of p.sites) retrySiteMap.set(s.siteNumber, s);
            retryLevels.push(...p.levels);
          }
          if (ivR.status === 'fulfilled' && ivR.value) {
            const p = parseNwisResponse(ivR.value, stateAbbr, true);
            for (const s of p.sites) if (!retrySiteMap.has(s.siteNumber)) retrySiteMap.set(s.siteNumber, s);
            retryLevels.push(...p.levels);
          }
          let retryDvLevels: NwisGwLevel[] = [];
          if (dvR.status === 'fulfilled' && dvR.value) {
            const p = parseNwisResponse(dvR.value, stateAbbr, false);
            for (const s of p.sites) if (!retrySiteMap.has(s.siteNumber)) retrySiteMap.set(s.siteNumber, s);
            retryDvLevels = p.levels;
          }

          for (const s of retrySiteMap.values()) allSites.push(s);
          for (const l of retryLevels) allLevels.push(l);
          for (const t of computeTrends(retrySiteMap, retryDvLevels)) allTrends.push(t);
          processedStates.push(stateAbbr);
          stateResults[stateAbbr] = { sites: retrySiteMap.size, levels: retryLevels.length, trends: 0 };
          console.log(`[NWIS-GW Cron] ${stateAbbr}: RETRY OK`);
        } catch (e) {
          console.warn(`[NWIS-GW Cron] ${stateAbbr}: RETRY FAILED — ${e instanceof Error ? e.message : e}`);
        }
      }
    }

    // ── Build Grid Index ───────────────────────────────────────────────────
    const grid: Record<string, {
      sites: NwisGwSite[];
      levels: NwisGwLevel[];
      trends: NwisGwTrend[];
    }> = {};

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

    // ── Store in memory ────────────────────────────────────────────────────
    const cacheData = {
      _meta: {
        built: new Date().toISOString(),
        siteCount: allSites.length,
        levelCount: allLevels.length,
        trendCount: allTrends.length,
        statesProcessed: processedStates,
        gridCells: Object.keys(grid).length,
      },
      grid,
    };

    if (allSites.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NWIS-GW Cron] 0 sites fetched in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getNwisGwCacheStatus() });
    }

    await setNwisGwCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[NWIS-GW Cron] Build complete in ${elapsed}s — ` +
      `${allSites.length} sites, ${allLevels.length} levels, ` +
      `${allTrends.length} trends, ${Object.keys(grid).length} cells`
    );

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      sites: allSites.length,
      levels: allLevels.length,
      trends: allTrends.length,
      gridCells: Object.keys(grid).length,
      statesProcessed: processedStates.length,
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

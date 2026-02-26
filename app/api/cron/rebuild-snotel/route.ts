// app/api/cron/rebuild-snotel/route.ts
// Cron endpoint — fetches NRCS SNOTEL snowpack station data.
// Step 1: Fetch station inventory. Step 2: Fetch latest daily reports.
// Schedule: daily at 12 PM UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSnotelCache, getSnotelCacheStatus,
  isSnotelBuildInProgress, setSnotelBuildInProgress,
  gridKey,
  type SnotelStation,
} from '@/lib/snotelCache';

// ── Config ───────────────────────────────────────────────────────────────────

const INVENTORY_URL = 'https://wcc.sc.egov.usda.gov/reportGenerator/view_csv/customMultipleStationReport/daily/start_of_period/state=%22XX%22%20AND%20network=%22SNTL%22/0,0/stationId,name,state,network,elevation,latitude,longitude';
const REPORT_URL_BASE = 'https://wcc.sc.egov.usda.gov/reportGenerator/view_csv/customSingleStationReport/daily/start_of_period';
const CONCURRENCY = 10;
const FETCH_TIMEOUT_MS = 15_000;
const DELAY_MS = 200;

// States with SNOTEL stations
const SNOTEL_STATES = [
  'AK', 'AZ', 'CA', 'CO', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY',
  'NH', 'VT', 'SD', 'MN', 'WI', 'MI', 'ME',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function parseNum(v: string | undefined): number | null {
  if (!v || v.trim() === '' || v.trim() === '-') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

interface StationMeta {
  id: string;
  name: string;
  state: string;
  elevation: number;
  lat: number;
  lng: number;
}

async function fetchStationInventory(): Promise<StationMeta[]> {
  // Fetch all SNOTEL stations in one request
  const url = 'https://wcc.sc.egov.usda.gov/reportGenerator/view_csv/customMultipleStationReport/daily/start_of_period/network=%22SNTL%22/0,0/stationId,name,state.code,elevation,latitude,longitude';
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Station inventory: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n');

  const stations: StationMeta[] = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('-') || line.trim() === '') continue;
    // CSV: stationId, name, state, elevation, lat, lng
    const parts = line.split(',').map(p => p.trim());
    if (parts.length < 6) continue;

    const lat = parseFloat(parts[4]);
    const lng = parseFloat(parts[5]);
    if (isNaN(lat) || isNaN(lng)) continue;

    stations.push({
      id: parts[0],
      name: parts[1],
      state: parts[2],
      elevation: parseFloat(parts[3]) || 0,
      lat,
      lng,
    });
  }

  return stations;
}

async function fetchStationReport(stationId: string, state: string): Promise<{
  snowWaterEquiv: number | null;
  snowDepth: number | null;
  precip: number | null;
  avgTemp: number | null;
  observedDate: string | null;
} | null> {
  const url = `${REPORT_URL_BASE}/${stationId}:${state}:SNTL/0,0/WTEQ::value,SNWD::value,PREC::value,TAVG::value`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.split('\n');

    // Find last data line (skip comments starting with #)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#') || line.startsWith('-')) continue;
      // CSV: date, SWE, snow depth, precip, avg temp
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) continue;

      return {
        snowWaterEquiv: parseNum(parts[1]),
        snowDepth: parseNum(parts[2]),
        precip: parseNum(parts[3]),
        avgTemp: parseNum(parts[4]),
        observedDate: parts[0] || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isSnotelBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SNOTEL build already in progress',
      cache: getSnotelCacheStatus(),
    });
  }

  setSnotelBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Fetch station inventory
    console.log('[SNOTEL Cron] Fetching station inventory...');
    const inventory = await fetchStationInventory();
    console.log(`[SNOTEL Cron] ${inventory.length} SNOTEL stations in inventory`);

    // Filter to SNOTEL states
    const targetStations = inventory.filter(s =>
      SNOTEL_STATES.includes(s.state.toUpperCase())
    );
    console.log(`[SNOTEL Cron] ${targetStations.length} stations in SNOTEL states`);

    // Step 2: Fetch latest reports in batches
    const stations: SnotelStation[] = [];
    let fetchErrors = 0;

    for (let i = 0; i < targetStations.length; i += CONCURRENCY) {
      const batch = targetStations.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (meta) => {
          const report = await fetchStationReport(meta.id, meta.state);
          return {
            id: meta.id,
            name: meta.name,
            state: meta.state,
            lat: meta.lat,
            lng: meta.lng,
            elevation: meta.elevation,
            snowWaterEquiv: report?.snowWaterEquiv ?? null,
            snowDepth: report?.snowDepth ?? null,
            precip: report?.precip ?? null,
            avgTemp: report?.avgTemp ?? null,
            observedDate: report?.observedDate ?? null,
          } as SnotelStation;
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled') {
          stations.push(r.value);
        } else {
          fetchErrors++;
        }
      }

      if (i + CONCURRENCY < targetStations.length) await delay(DELAY_MS);
    }

    // Build grid index
    const grid: Record<string, { stations: SnotelStation[] }> = {};
    for (const s of stations) {
      const key = gridKey(s.lat, s.lng);
      if (!grid[key]) grid[key] = { stations: [] };
      grid[key].stations.push(s);
    }

    // Empty-data guard
    if (stations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[SNOTEL Cron] 0 stations in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getSnotelCacheStatus(),
      });
    }

    await setSnotelCache({
      _meta: {
        built: new Date().toISOString(),
        stationCount: stations.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const withSWE = stations.filter(s => s.snowWaterEquiv !== null).length;
    console.log(`[SNOTEL Cron] Complete in ${elapsed}s — ${stations.length} stations, ${withSWE} with SWE data`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stationCount: stations.length,
      withSWEData: withSWE,
      gridCells: Object.keys(grid).length,
      fetchErrors,
      cache: getSnotelCacheStatus(),
    });

  } catch (err: any) {
    console.error('[SNOTEL Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'SNOTEL build failed' },
      { status: 500 },
    );
  } finally {
    setSnotelBuildInProgress(false);
  }
}

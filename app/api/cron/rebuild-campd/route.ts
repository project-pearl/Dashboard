// app/api/cron/rebuild-campd/route.ts
// Cron endpoint — fetches EPA Clean Air Markets (CAMPD) facility + emissions data
// from the EASEY API (api.epa.gov/easey/).
// Schedule: daily at 8 PM UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setCampdCache,
  getCampdCacheStatus,
  isCampdBuildInProgress,
  setCampdBuildInProgress,
  gridKey,
  type CampdFacility,
} from '@/lib/campdCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const EASEY_BASE = 'https://api.epa.gov/easey';
const FETCH_TIMEOUT_MS = 60_000;
const EMISSIONS_YEAR = 2023; // Latest full year of data

function getApiKey(): string {
  return process.env.EPA_API_KEY || process.env.DATA_GOV_API_KEY || '';
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

interface RawFacility {
  facilityId?: string | number;
  facilityName?: string;
  stateCode?: string;
  countyName?: string;
  latitude?: number | string;
  longitude?: number | string;
  operatingStatus?: string;
  primaryFuelInfo?: string;
  [key: string]: any;
}

interface RawEmission {
  facilityId?: string | number;
  so2Mass?: number | string;
  noxMass?: number | string;
  co2Mass?: number | string;
  heatInput?: number | string;
  grossLoad?: number | string;
  year?: number;
  [key: string]: any;
}

async function fetchWithKey(endpoint: string): Promise<any> {
  const apiKey = getApiKey();
  const separator = endpoint.includes('?') ? '&' : '?';
  const url = `${EASEY_BASE}${endpoint}${apiKey ? `${separator}api_key=${apiKey}` : ''}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`CAMPD API ${endpoint}: HTTP ${res.status}`);
  }

  return res.json();
}

// ── Fetch facilities ────────────────────────────────────────────────────────

async function fetchFacilities(): Promise<Map<string, RawFacility>> {
  const facilities = new Map<string, RawFacility>();

  try {
    // EASEY facilities endpoint - get all active power plants
    const data = await fetchWithKey('/facilities?programCodeInfo=ARP&page=1&perPage=5000');
    const rows: RawFacility[] = Array.isArray(data) ? data : (data?.data || data?.results || []);

    for (const row of rows) {
      const id = String(row.facilityId || '');
      if (!id) continue;
      const lat = parseNum(row.latitude);
      const lng = parseNum(row.longitude);
      if (lat === 0 && lng === 0) continue;
      facilities.set(id, row);
    }
  } catch (err: any) {
    console.warn(`[CAMPD Cron] Facilities fetch: ${err.message}`);
  }

  return facilities;
}

// ── Fetch emissions ─────────────────────────────────────────────────────────

async function fetchEmissions(): Promise<Map<string, RawEmission>> {
  const emissions = new Map<string, RawEmission>();

  try {
    const data = await fetchWithKey(
      `/emissions/apportioned/annual?year=${EMISSIONS_YEAR}&page=1&perPage=5000`
    );
    const rows: RawEmission[] = Array.isArray(data) ? data : (data?.data || data?.results || []);

    for (const row of rows) {
      const id = String(row.facilityId || '');
      if (!id) continue;

      // Aggregate if facility appears multiple times (multiple units)
      const existing = emissions.get(id);
      if (existing) {
        existing.so2Mass = parseNum(existing.so2Mass) + parseNum(row.so2Mass);
        existing.noxMass = parseNum(existing.noxMass) + parseNum(row.noxMass);
        existing.co2Mass = parseNum(existing.co2Mass) + parseNum(row.co2Mass);
        existing.heatInput = parseNum(existing.heatInput) + parseNum(row.heatInput);
        existing.grossLoad = parseNum(existing.grossLoad) + parseNum(row.grossLoad);
      } else {
        emissions.set(id, { ...row });
      }
    }
  } catch (err: any) {
    console.warn(`[CAMPD Cron] Emissions fetch: ${err.message}`);
  }

  return emissions;
}

// ── Fetch compliance ────────────────────────────────────────────────────────

async function fetchCompliance(): Promise<Map<string, string>> {
  const compliance = new Map<string, string>();

  try {
    const data = await fetchWithKey(
      `/compliance/allowance?year=${EMISSIONS_YEAR}&page=1&perPage=5000`
    );
    const rows = Array.isArray(data) ? data : (data?.data || data?.results || []);

    for (const row of rows) {
      const id = String(row.facilityId || '');
      if (!id) continue;
      compliance.set(id, row.complianceStatus || row.programCodeInfo || 'Unknown');
    }
  } catch (err: any) {
    console.warn(`[CAMPD Cron] Compliance fetch: ${err.message}`);
  }

  return compliance;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isCampdBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'CAMPD build already in progress',
      cache: getCampdCacheStatus(),
    });
  }

  setCampdBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Fetch all three datasets in parallel
    const [facilitiesMap, emissionsMap, complianceMap] = await Promise.all([
      fetchFacilities(),
      fetchEmissions(),
      fetchCompliance(),
    ]);

    console.log(`[CAMPD Cron] Fetched ${facilitiesMap.size} facilities, ${emissionsMap.size} emission records, ${complianceMap.size} compliance records`);

    // Merge into CampdFacility records
    const allFacilities: CampdFacility[] = [];
    let totalSo2 = 0;
    let totalNox = 0;

    for (const [id, fac] of facilitiesMap) {
      const lat = parseNum(fac.latitude);
      const lng = parseNum(fac.longitude);
      if (lat === 0 && lng === 0) continue;

      const em = emissionsMap.get(id);
      const so2 = parseNum(em?.so2Mass);
      const nox = parseNum(em?.noxMass);
      const co2 = parseNum(em?.co2Mass);

      totalSo2 += so2;
      totalNox += nox;

      allFacilities.push({
        facilityId: id,
        facilityName: fac.facilityName || '',
        state: fac.stateCode || '',
        county: fac.countyName || '',
        lat,
        lng,
        so2Tons: Math.round(so2 * 100) / 100,
        noxTons: Math.round(nox * 100) / 100,
        co2Tons: Math.round(co2 * 100) / 100,
        heatInput: parseNum(em?.heatInput),
        grossLoad: parseNum(em?.grossLoad),
        operatingStatus: fac.operatingStatus || '',
        primaryFuelType: fac.primaryFuelInfo || '',
        complianceStatus: complianceMap.get(id) || 'Unknown',
        year: EMISSIONS_YEAR,
      });
    }

    // Build grid index
    const grid: Record<string, { facilities: CampdFacility[] }> = {};
    for (const f of allFacilities) {
      const key = gridKey(f.lat, f.lng);
      if (!grid[key]) grid[key] = { facilities: [] };
      grid[key].facilities.push(f);
    }

    // Empty-data guard
    if (allFacilities.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[CAMPD Cron] 0 facilities in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getCampdCacheStatus(),
      });
    }

    await setCampdCache({
      _meta: {
        built: new Date().toISOString(),
        facilityCount: allFacilities.length,
        gridCells: Object.keys(grid).length,
        year: EMISSIONS_YEAR,
        totalSo2Tons: Math.round(totalSo2),
        totalNoxTons: Math.round(totalNox),
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[CAMPD Cron] Complete in ${elapsed}s — ${allFacilities.length} facilities`);

    recordCronRun('rebuild-campd', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      facilityCount: allFacilities.length,
      gridCells: Object.keys(grid).length,
      year: EMISSIONS_YEAR,
      cache: getCampdCacheStatus(),
    });

  } catch (err: any) {
    console.error('[CAMPD Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-campd' } });
    notifySlackCronFailure({ cronName: 'rebuild-campd', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-campd', 'error', Date.now() - startTime, err.message);

    return NextResponse.json(
      { status: 'error', error: err.message || 'CAMPD build failed' },
      { status: 500 },
    );
  } finally {
    setCampdBuildInProgress(false);
  }
}

// app/api/cron/rebuild-usbr/route.ts
// Cron endpoint — fetches Bureau of Reclamation RISE reservoir levels.
// Schedule: every 6 hours at :15.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setUsbrCache, getUsbrCacheStatus,
  isUsbrBuildInProgress, setUsbrBuildInProgress,
  type ReservoirReading,
} from '@/lib/usbrCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const RISE_API = 'https://data.usbr.gov/rise/api';
const FETCH_TIMEOUT_MS = 20_000;

// ── Catalog & Data Fetch ────────────────────────────────────────────────────

interface CatalogLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  state: string | null;
  catalogItems: { id: number; parameterName: string; unitName: string }[];
}

async function fetchLocationCatalog(): Promise<CatalogLocation[]> {
  const res = await fetch(
    `${RISE_API}/location?itemsPerPage=200&locationTypeName=Lake%2FReservoir`,
    { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json' } },
  );
  if (!res.ok) throw new Error(`RISE location catalog: HTTP ${res.status}`);
  const data = await res.json();
  const items = data?.data || [];

  const locations: CatalogLocation[] = [];
  for (const loc of items) {
    const attrs = loc.attributes || loc;
    const catalogItems: CatalogLocation['catalogItems'] = [];

    // Parse related catalog items
    const related = attrs.catalogItems?.data || attrs.catalogItems || [];
    for (const ci of related) {
      const ciAttrs = ci.attributes || ci;
      catalogItems.push({
        id: ciAttrs.id || ci.id,
        parameterName: ciAttrs.parameterName || '',
        unitName: ciAttrs.unitName || '',
      });
    }

    locations.push({
      id: attrs.id || loc.id,
      name: attrs.locationName || attrs.name || '',
      lat: parseFloat(attrs.latitude) || 0,
      lng: parseFloat(attrs.longitude) || 0,
      state: attrs.state || null,
      catalogItems,
    });
  }

  return locations;
}

async function fetchLatestResult(catalogItemId: number): Promise<{ value: number; timestamp: string } | null> {
  try {
    const res = await fetch(
      `${RISE_API}/result/download?type=json&itemId=${catalogItemId}&order=DESC&itemsPerPage=1`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { Accept: 'application/json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rows = data?.data || data || [];
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      value: parseFloat(row.result || row.value) || 0,
      timestamp: row.dateTime || row.timestamp || '',
    };
  } catch {
    return null;
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isUsbrBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'USBR build already in progress',
      cache: getUsbrCacheStatus(),
    });
  }

  setUsbrBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Fetch location catalog
    const locations = await fetchLocationCatalog();
    console.log(`[USBR Cron] Fetched ${locations.length} reservoir locations`);

    // Step 2: For each location, fetch latest storage + elevation + inflow + release
    const reservoirs: ReservoirReading[] = [];

    for (const loc of locations) {
      // Find catalog items by parameter name
      const storageCi = loc.catalogItems.find(ci =>
        ci.parameterName.toLowerCase().includes('storage') && ci.unitName.toLowerCase().includes('acre'));
      const elevCi = loc.catalogItems.find(ci =>
        ci.parameterName.toLowerCase().includes('elevation') && ci.unitName.toLowerCase().includes('ft'));
      const inflowCi = loc.catalogItems.find(ci =>
        ci.parameterName.toLowerCase().includes('inflow') && ci.unitName.toLowerCase().includes('cfs'));
      const releaseCi = loc.catalogItems.find(ci =>
        ci.parameterName.toLowerCase().includes('release') && ci.unitName.toLowerCase().includes('cfs'));

      // Skip locations with no meaningful data items
      if (!storageCi && !elevCi) continue;

      // Fetch all available metrics in parallel
      const [storageResult, elevResult, inflowResult, releaseResult] = await Promise.all([
        storageCi ? fetchLatestResult(storageCi.id) : null,
        elevCi ? fetchLatestResult(elevCi.id) : null,
        inflowCi ? fetchLatestResult(inflowCi.id) : null,
        releaseCi ? fetchLatestResult(releaseCi.id) : null,
      ]);

      const storageAcreFt = storageResult?.value ?? null;
      const timestamp = storageResult?.timestamp || elevResult?.timestamp || new Date().toISOString();

      reservoirs.push({
        locationId: loc.id,
        locationName: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        state: loc.state,
        storageAcreFt,
        capacityAcreFt: null,  // RISE doesn't always expose capacity
        pctFull: null,         // Will be computed downstream if capacity is known
        elevationFt: elevResult?.value ?? null,
        inflowCfs: inflowResult?.value ?? null,
        releaseCfs: releaseResult?.value ?? null,
        timestamp,
      });
    }

    // Empty-data guard
    if (reservoirs.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[USBR Cron] No reservoirs found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getUsbrCacheStatus(),
      });
    }

    await setUsbrCache({
      _meta: { built: new Date().toISOString(), reservoirCount: reservoirs.length },
      reservoirs,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[USBR Cron] Complete in ${elapsed}s — ${reservoirs.length} reservoirs`);

    recordCronRun('rebuild-usbr', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      reservoirCount: reservoirs.length,
      catalogLocations: locations.length,
      cache: getUsbrCacheStatus(),
    });

  } catch (err: any) {
    console.error('[USBR Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-usbr' } });
    notifySlackCronFailure({ cronName: 'rebuild-usbr', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-usbr', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'USBR build failed' },
      { status: 500 },
    );
  } finally {
    setUsbrBuildInProgress(false);
  }
}

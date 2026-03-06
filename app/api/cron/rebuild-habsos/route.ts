// app/api/cron/rebuild-habsos/route.ts
// Cron endpoint — fetches HABSOS harmful algal bloom observations from ArcGIS REST.
// Queries last 30 days of HAB cell count data and builds a spatial grid cache.
// Schedule: daily via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setHabsosCache, getHabsosCacheStatus,
  isHabsosBuildInProgress, setHabsosBuildInProgress,
  gridKey,
  type HabObservation,
} from '@/lib/habsosCache';
import { enqueueEvents } from '@/lib/sentinel/eventQueue';
import type { ChangeEvent, SeverityHint } from '@/lib/sentinel/types';

// ── Config ───────────────────────────────────────────────────────────────────

const HABSOS_URL = 'https://gis.ngdc.noaa.gov/arcgis/rest/services/EnvironmentalMonitoring/HABSOSViewBase/MapServer/0/query';
const FETCH_TIMEOUT_MS = 60_000;

function parseNum(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function formatEpoch(epoch: number | null): string {
  if (!epoch) return '';
  try {
    return new Date(epoch).toISOString();
  } catch {
    return '';
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isHabsosBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'HABSOS build already in progress',
      cache: getHabsosCacheStatus(),
    });
  }

  setHabsosBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log('[HABSOS Cron] Fetching HAB observations (last 30 days)...');

    const params = new URLSearchParams({
      where: 'SAMPLE_DATE>CURRENT_TIMESTAMP-30',
      outFields: 'LATITUDE,LONGITUDE,STATE,GENUS,CELLCOUNT,SAMPLE_DATE,DESCRIPTION',
      f: 'json',
      resultRecordCount: '2000',
    });

    const res = await fetch(`${HABSOS_URL}?${params.toString()}`, {
      headers: { 'User-Agent': 'PEARL-Platform/1.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`HABSOS API: HTTP ${res.status}`);
    const json = await res.json();

    const features: any[] = json?.features || [];
    console.log(`[HABSOS Cron] Received ${features.length} features`);

    // Parse observations
    const observations: HabObservation[] = [];
    for (const f of features) {
      const attrs = f.attributes || f.properties || {};
      const lat = parseNum(attrs.LATITUDE || attrs.latitude);
      const lng = parseNum(attrs.LONGITUDE || attrs.longitude);

      if (lat === 0 && lng === 0) continue; // skip invalid coords

      observations.push({
        lat,
        lng,
        state: attrs.STATE || attrs.state || '',
        genus: attrs.GENUS || attrs.genus || '',
        cellCount: parseNum(attrs.CELLCOUNT || attrs.cellcount),
        sampleDate: formatEpoch(attrs.SAMPLE_DATE || attrs.sample_date) || '',
        description: attrs.DESCRIPTION || attrs.description || '',
      });
    }

    // Build grid index
    const grid: Record<string, { observations: HabObservation[] }> = {};
    for (const obs of observations) {
      const key = gridKey(obs.lat, obs.lng);
      if (!grid[key]) grid[key] = { observations: [] };
      grid[key].observations.push(obs);
    }

    // Empty-data guard — HABs are seasonal, 0 records is valid but we still save
    // Only skip if the API itself returned an error structure
    if (features.length === 0 && json?.error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[HABSOS Cron] API error in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getHabsosCacheStatus(),
      });
    }

    await setHabsosCache({
      _meta: {
        built: new Date().toISOString(),
        observationCount: observations.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    // Push high-cell-count observations as sentinel events
    const nowIso = new Date().toISOString();
    const sentinelEvents: ChangeEvent[] = [];
    for (const obs of observations) {
      if (obs.cellCount < 20_000) continue;
      let severityHint: SeverityHint = 'LOW';
      if (obs.cellCount > 500_000) severityHint = 'CRITICAL';
      else if (obs.cellCount > 100_000) severityHint = 'HIGH';
      else if (obs.cellCount > 20_000) severityHint = 'MODERATE';

      sentinelEvents.push({
        eventId: crypto.randomUUID(),
        source: 'HABSOS',
        detectedAt: nowIso,
        sourceTimestamp: obs.sampleDate || null,
        changeType: 'THRESHOLD_CROSSED',
        geography: {
          stateAbbr: obs.state || undefined,
          lat: obs.lat,
          lng: obs.lng,
        },
        severityHint,
        payload: {
          genus: obs.genus,
          cellCount: obs.cellCount,
          description: obs.description,
        },
        metadata: {
          sourceRecordId: `habsos:${obs.state}:${obs.genus}:${obs.sampleDate}`,
          currentValue: obs.cellCount,
        },
      });
    }

    let sentinelPushed = 0;
    if (sentinelEvents.length > 0) {
      const added = await enqueueEvents(sentinelEvents);
      sentinelPushed = added.length;
      console.log(`[HABSOS Cron] Pushed ${sentinelPushed} sentinel events`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[HABSOS Cron] Complete in ${elapsed}s — ${observations.length} observations, ${Object.keys(grid).length} cells`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      observationCount: observations.length,
      gridCells: Object.keys(grid).length,
      sentinelPushed,
      cache: getHabsosCacheStatus(),
    });

  } catch (err: any) {
    console.error('[HABSOS Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'HABSOS build failed' },
      { status: 500 },
    );
  } finally {
    setHabsosBuildInProgress(false);
  }
}

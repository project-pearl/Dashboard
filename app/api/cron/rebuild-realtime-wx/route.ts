// app/api/cron/rebuild-realtime-wx/route.ts
// Batch cron -- rebuilds 2 realtime weather/hazard caches in one invocation:
//   1. NEXRAD QPE (IEM NEXRAD radar precipitation estimates -- every 15 min)
//   2. Volcano (USGS Volcano Observatory alerts -- every 30 min effective)
//
// Replaces 2 individual cron routes to conserve Vercel cron slots:
//   rebuild-nexrad-qpe, rebuild-volcano
//
// Schedule: every 15 minutes (*/15 * * * *)

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';
import { gridKey } from '@/lib/cacheUtils';

// NEXRAD QPE imports
import {
  setNexradQpeCache,
  isNexradQpeBuildInProgress,
  setNexradQpeBuildInProgress,
  getNexradQpeCacheStatus,
} from '@/lib/nexradQpeCache';

// Volcano imports
import {
  setVolcanoCache,
  isVolcanoBuildInProgress,
  setVolcanoBuildInProgress,
  getVolcanoCacheStatus,
} from '@/lib/volcanoCache';

// ── Types ───────────────────────────────────────────────────────────────────

interface SubCronResult {
  name: string;
  status: 'success' | 'skipped' | 'empty' | 'error';
  durationMs: number;
  recordCount?: number;
  error?: string;
}

// ── Sub-cron builders ───────────────────────────────────────────────────────

async function buildNexradQpe(): Promise<SubCronResult> {
  const start = Date.now();

  if (isNexradQpeBuildInProgress()) {
    return { name: 'nexrad-qpe', status: 'skipped', durationMs: Date.now() - start };
  }

  setNexradQpeBuildInProgress(true);
  try {
    const res = await fetch(
      'https://mesonet.agron.iastate.edu/geojson/nexrad_attr.geojson',
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) throw new Error(`IEM NEXRAD API returned HTTP ${res.status}`);
    const geojson = await res.json();
    const features = geojson?.features || [];

    if (features.length === 0) {
      console.warn('[Realtime WX] NEXRAD QPE: no data returned -- skipping cache save');
      recordCronRun('rebuild-nexrad-qpe', 'success', Date.now() - start);
      return { name: 'nexrad-qpe', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    const grid: Record<string, any[]> = {};
    let cellCount = 0;
    let maxPrecipMm = 0;
    let flashFloodHighCount = 0;

    for (const feature of features) {
      const coords = feature.geometry?.coordinates;
      if (!coords) continue;
      const lng = coords[0];
      const lat = coords[1];
      if (!lat || !lng) continue;

      const props = feature.properties || {};
      const precip1h = parseFloat(props.precip_1h || props.precipIn1h || '0') || 0;
      const precip3h = parseFloat(props.precip_3h || props.precipIn3h || '0') || 0;
      const precip24h = parseFloat(props.precip_24h || props.precipIn24h || '0') || 0;

      // Classify flash flood risk based on 1-hour precipitation
      const flashFloodRisk = precip1h >= 75 ? 'extreme'
        : precip1h >= 50 ? 'high'
        : precip1h >= 25 ? 'moderate'
        : precip1h >= 10 ? 'low'
        : 'none';

      if (flashFloodRisk === 'high' || flashFloodRisk === 'extreme') flashFloodHighCount++;
      const maxP = Math.max(precip1h, precip3h, precip24h);
      if (maxP > maxPrecipMm) maxPrecipMm = maxP;

      const cell = {
        lat,
        lng,
        precipMm1h: precip1h,
        precipMm3h: precip3h,
        precipMm24h: precip24h,
        radarSite: props.nexrad || props.radar_id || '',
        validTime: props.valid || props.valid_time || new Date().toISOString(),
        flashFloodRisk,
      };

      const key = gridKey(lat, lng);
      if (!grid[key]) grid[key] = [];
      grid[key].push(cell);
      cellCount++;
    }

    await setNexradQpeCache({
      _meta: {
        built: new Date().toISOString(),
        cellCount,
        maxPrecipMm,
        flashFloodHighCount,
      },
      grid,
    });

    console.log(`[Realtime WX] NEXRAD QPE: ${cellCount} cells, max ${maxPrecipMm.toFixed(1)}mm, ${flashFloodHighCount} high flood risk`);
    recordCronRun('rebuild-nexrad-qpe', 'success', Date.now() - start);
    return { name: 'nexrad-qpe', status: 'success', durationMs: Date.now() - start, recordCount: cellCount };
  } catch (err: any) {
    console.error('[Realtime WX] NEXRAD QPE failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-nexrad-qpe', batch: 'realtime-wx' } });
    recordCronRun('rebuild-nexrad-qpe', 'error', Date.now() - start, err.message);
    return { name: 'nexrad-qpe', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setNexradQpeBuildInProgress(false);
  }
}

async function buildVolcano(): Promise<SubCronResult> {
  const start = Date.now();

  // Volcano only runs every other invocation (30 min effective)
  // Skip when the current minute mark is not on a 30-min boundary
  const now = new Date();
  if (now.getMinutes() % 30 !== 0) {
    console.log('[Realtime WX] Volcano: skipping (runs every 30 min)');
    return { name: 'volcano', status: 'skipped', durationMs: Date.now() - start };
  }

  if (isVolcanoBuildInProgress()) {
    return { name: 'volcano', status: 'skipped', durationMs: Date.now() - start };
  }

  setVolcanoBuildInProgress(true);
  try {
    const res = await fetch(
      'https://volcanoes.usgs.gov/vsc/api/volcanoApi/volcanoesGVP',
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) throw new Error(`USGS Volcano API returned HTTP ${res.status}`);
    const rawData = await res.json();
    const volcanoes = Array.isArray(rawData) ? rawData : rawData?.features || rawData?.volcanoes || [];

    if (volcanoes.length === 0) {
      console.warn('[Realtime WX] Volcano: no data returned -- skipping cache save');
      recordCronRun('rebuild-volcano', 'success', Date.now() - start);
      return { name: 'volcano', status: 'empty', durationMs: Date.now() - start, recordCount: 0 };
    }

    let elevatedCount = 0;
    const alerts = volcanoes.map((v: any) => {
      const alertLevel = (v.alert_level || v.alertLevel || 'normal').toLowerCase();
      if (alertLevel !== 'normal') elevatedCount++;

      const colorCode = alertLevel === 'warning' ? 'red'
        : alertLevel === 'watch' ? 'orange'
        : alertLevel === 'advisory' ? 'yellow'
        : 'green';

      return {
        volcanoId: String(v.vnum || v.volcano_number || v.id || ''),
        volcanoName: v.volcano_name || v.volcanoName || v.name || '',
        state: (v.state || v.region || '').toUpperCase().substring(0, 2),
        alertLevel: alertLevel as any,
        colorCode: colorCode as any,
        lat: parseFloat(v.latitude || v.lat || '0') || 0,
        lng: parseFloat(v.longitude || v.lng || v.lon || '0') || 0,
        elevation: parseFloat(v.elev || v.elevation || '0') || 0,
        volcanoType: v.primary_volcano_type || v.volcanoType || v.type || '',
        lastEruption: v.last_eruption_year || v.lastEruption || null,
        observatoryName: v.observatory || v.observatoryName || '',
        updateTime: v.update_time || v.updateTime || new Date().toISOString(),
      };
    });

    await setVolcanoCache({
      _meta: {
        built: new Date().toISOString(),
        alertCount: alerts.length,
        elevatedCount,
      },
      alerts,
    });

    console.log(`[Realtime WX] Volcano: ${alerts.length} volcanoes, ${elevatedCount} elevated alerts`);
    recordCronRun('rebuild-volcano', 'success', Date.now() - start);
    return { name: 'volcano', status: 'success', durationMs: Date.now() - start, recordCount: alerts.length };
  } catch (err: any) {
    console.error('[Realtime WX] Volcano failed:', err.message);
    Sentry.captureException(err, { tags: { cron: 'rebuild-volcano', batch: 'realtime-wx' } });
    recordCronRun('rebuild-volcano', 'error', Date.now() - start, err.message);
    return { name: 'volcano', status: 'error', durationMs: Date.now() - start, error: err.message };
  } finally {
    setVolcanoBuildInProgress(false);
  }
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const batchStart = Date.now();
  const results: SubCronResult[] = [];

  console.log('[Realtime WX] Starting batch rebuild of 2 realtime weather/hazard caches...');

  // Run sequentially. Each sub-cron has its own try/catch so a failure
  // in one does not block the others.

  results.push(await buildNexradQpe());
  results.push(await buildVolcano());

  const totalDurationMs = Date.now() - batchStart;
  const elapsed = (totalDurationMs / 1000).toFixed(1);
  const succeeded = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const empty = results.filter(r => r.status === 'empty').length;

  console.log(`[Realtime WX] Complete in ${elapsed}s -- ${succeeded} succeeded, ${failed} failed, ${skipped} skipped, ${empty} empty`);

  // Record overall batch cron run
  const overallStatus = failed === results.length ? 'error' : 'success';
  recordCronRun('rebuild-realtime-wx', overallStatus, totalDurationMs,
    failed > 0 ? `${failed}/${results.length} sub-crons failed` : undefined);

  // Notify Slack only if ALL sub-crons failed (since volcano skips alternate runs)
  if (failed === results.length) {
    const failedNames = results.filter(r => r.status === 'error').map(r => r.name).join(', ');
    notifySlackCronFailure({
      cronName: 'rebuild-realtime-wx',
      error: `All sub-crons failed: ${failedNames}`,
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
      nexradQpe: getNexradQpeCacheStatus(),
      volcano: getVolcanoCacheStatus(),
    },
  }, { status: httpStatus });
}

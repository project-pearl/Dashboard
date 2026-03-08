// app/api/cron/rebuild-hefs/route.ts
// Cron endpoint — fetches HEFS ensemble forecast data for flooding NWPS gauges.
// Loads NWPS cache, filters for minor/moderate/major flood gauges (max 100),
// fetches HEFS ensemble quantiles for each.
// Schedule: every 6 hours via Vercel cron.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setHefsCache, getHefsCacheStatus,
  isHefsBuildInProgress, setHefsBuildInProgress,
  gridKey,
  type HefsEnsemble,
} from '@/lib/hefsCache';
import {
  getNwpsAllGauges,
  ensureWarmed as ensureNwpsWarmed,
} from '@/lib/nwpsCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const HEFS_BASE = 'https://api.water.noaa.gov/hefs/v1';
const FETCH_TIMEOUT_MS = 15_000;
const CONCURRENCY = 5;
const DELAY_MS = 300;
const MAX_GAUGES = 100;

function parseNum(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isHefsBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'HEFS build already in progress',
      cache: getHefsCacheStatus(),
    });
  }

  setHefsBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Ensure NWPS cache is loaded
    await ensureNwpsWarmed();
    const allGauges = getNwpsAllGauges();

    if (allGauges.length === 0) {
      console.warn('[HEFS Cron] No NWPS gauges available — skipping');
      return NextResponse.json({
        status: 'empty',
        reason: 'NWPS cache empty',
        cache: getHefsCacheStatus(),
      });
    }

    // Filter to flooding gauges only
    const floodingGauges = allGauges.filter(g =>
      g.status === 'minor' || g.status === 'moderate' || g.status === 'major'
    );

    // Cap at MAX_GAUGES to stay within time budget
    const targetGauges = floodingGauges.slice(0, MAX_GAUGES);
    console.log(`[HEFS Cron] ${floodingGauges.length} flooding gauges found, processing ${targetGauges.length}`);

    if (targetGauges.length === 0) {
      // No flooding gauges — save empty cache (valid state)
      console.log('[HEFS Cron] No flooding gauges — saving empty cache');
      await setHefsCache({
        _meta: {
          built: new Date().toISOString(),
          ensembleCount: 0,
          gridCells: 0,
        },
        grid: {},
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      return NextResponse.json({
        status: 'complete',
        duration: `${elapsed}s`,
        floodingGauges: 0,
        ensembleCount: 0,
        cache: getHefsCacheStatus(),
      });
    }

    // Fetch HEFS ensembles
    const ensembles: HefsEnsemble[] = [];
    let fetchErrors = 0;

    for (let i = 0; i < targetGauges.length; i += CONCURRENCY) {
      const batch = targetGauges.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (gauge) => {
          try {
            // Try primary HEFS endpoint
            const url = `${HEFS_BASE}/ensembles?lid=${gauge.lid}&type=forecast`;
            const res = await fetch(url, {
              headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
              signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            });

            if (!res.ok) {
              // Try alternative endpoint
              const altUrl = `${HEFS_BASE}/hindcasts/${gauge.lid}`;
              const altRes = await fetch(altUrl, {
                headers: { 'User-Agent': 'PEARL-Platform/1.0', 'Accept': 'application/json' },
                signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
              });

              if (!altRes.ok) {
                fetchErrors++;
                // Return ensemble with null quantiles (gauge is flooding but no HEFS data)
                return {
                  lid: gauge.lid,
                  name: gauge.name,
                  lat: gauge.lat,
                  lng: gauge.lng,
                  state: gauge.state,
                  quantiles: null,
                  validTime: '',
                  members: 0,
                } as HefsEnsemble;
              }

              const altData = await altRes.json();
              return parseHefsResponse(altData, gauge);
            }

            const data = await res.json();
            return parseHefsResponse(data, gauge);
          } catch (err) {
            fetchErrors++;
            // Return basic entry even if HEFS fails — the gauge IS flooding
            return {
              lid: gauge.lid,
              name: gauge.name,
              lat: gauge.lat,
              lng: gauge.lng,
              state: gauge.state,
              quantiles: null,
              validTime: '',
              members: 0,
            } as HefsEnsemble;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          ensembles.push(r.value);
        }
      }

      if (i + CONCURRENCY < targetGauges.length) await delay(DELAY_MS);
    }

    // Build grid index
    const grid: Record<string, { ensembles: HefsEnsemble[] }> = {};
    for (const e of ensembles) {
      const key = gridKey(e.lat, e.lng);
      if (!grid[key]) grid[key] = { ensembles: [] };
      grid[key].ensembles.push(e);
    }

    await setHefsCache({
      _meta: {
        built: new Date().toISOString(),
        ensembleCount: ensembles.length,
        gridCells: Object.keys(grid).length,
      },
      grid,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[HEFS Cron] Complete in ${elapsed}s — ${ensembles.length} ensembles, ${Object.keys(grid).length} cells, ${fetchErrors} errors`);

    recordCronRun('rebuild-hefs', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      floodingGauges: floodingGauges.length,
      processed: targetGauges.length,
      ensembleCount: ensembles.length,
      gridCells: Object.keys(grid).length,
      fetchErrors,
      cache: getHefsCacheStatus(),
    });

  } catch (err: any) {
    console.error('[HEFS Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-hefs' } });

    notifySlackCronFailure({ cronName: 'rebuild-hefs', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-hefs', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'HEFS build failed' },
      { status: 500 },
    );
  } finally {
    setHefsBuildInProgress(false);
  }
}

// ── HEFS Response Parser ────────────────────────────────────────────────────

function parseHefsResponse(data: any, gauge: { lid: string; name: string; lat: number; lng: number; state: string }): HefsEnsemble {
  try {
    // HEFS response may have various formats — try common structures
    // Format 1: { ensembles: [{ timesteps: [{ quantiles: {...} }] }] }
    // Format 2: { data: { quantiles: {...}, members: [...] } }
    // Format 3: { forecasts: [{ values: [...] }] }

    let quantiles: HefsEnsemble['quantiles'] = null;
    let validTime = '';
    let members = 0;

    if (data?.ensembles && Array.isArray(data.ensembles)) {
      const ensemble = data.ensembles[0];
      members = data.ensembles.length;

      if (ensemble?.timesteps?.[0]) {
        const ts = ensemble.timesteps[0];
        validTime = ts.validTime || ts.time || '';
        if (ts.quantiles) {
          quantiles = {
            q10: parseNum(ts.quantiles.q10 ?? ts.quantiles['0.1']),
            q25: parseNum(ts.quantiles.q25 ?? ts.quantiles['0.25']),
            q50: parseNum(ts.quantiles.q50 ?? ts.quantiles['0.5']),
            q75: parseNum(ts.quantiles.q75 ?? ts.quantiles['0.75']),
            q90: parseNum(ts.quantiles.q90 ?? ts.quantiles['0.9']),
          };
        }
      } else if (ensemble?.values && Array.isArray(ensemble.values)) {
        // Compute quantiles from raw ensemble members
        const values = ensemble.values
          .map((v: any) => parseNum(typeof v === 'object' ? v.value : v))
          .filter((v: number | null): v is number => v !== null)
          .sort((a: number, b: number) => a - b);

        if (values.length > 0) {
          members = values.length;
          const pct = (p: number) => values[Math.floor(p * (values.length - 1))] ?? null;
          quantiles = {
            q10: pct(0.1),
            q25: pct(0.25),
            q50: pct(0.5),
            q75: pct(0.75),
            q90: pct(0.9),
          };
        }
      }
    } else if (data?.data) {
      // Alternative response format
      const d = data.data;
      if (d.quantiles) {
        quantiles = {
          q10: parseNum(d.quantiles.q10 ?? d.quantiles['0.1']),
          q25: parseNum(d.quantiles.q25 ?? d.quantiles['0.25']),
          q50: parseNum(d.quantiles.q50 ?? d.quantiles['0.5']),
          q75: parseNum(d.quantiles.q75 ?? d.quantiles['0.75']),
          q90: parseNum(d.quantiles.q90 ?? d.quantiles['0.9']),
        };
      }
      members = d.memberCount || d.members?.length || 0;
      validTime = d.validTime || d.time || '';
    } else if (data?.forecasts && Array.isArray(data.forecasts)) {
      members = data.forecasts.length;
      if (data.forecasts[0]?.validTime) {
        validTime = data.forecasts[0].validTime;
      }
      // Compute quantiles from forecast members' first timestep
      const values = data.forecasts
        .map((f: any) => {
          const val = f.values?.[0] ?? f.value ?? f.stage ?? f.flow;
          return parseNum(typeof val === 'object' ? val.value : val);
        })
        .filter((v: number | null): v is number => v !== null)
        .sort((a: number, b: number) => a - b);

      if (values.length > 0) {
        const pct = (p: number) => values[Math.floor(p * (values.length - 1))] ?? null;
        quantiles = {
          q10: pct(0.1),
          q25: pct(0.25),
          q50: pct(0.5),
          q75: pct(0.75),
          q90: pct(0.9),
        };
      }
    }

    return {
      lid: gauge.lid,
      name: gauge.name,
      lat: gauge.lat,
      lng: gauge.lng,
      state: gauge.state,
      quantiles,
      validTime,
      members,
    };
  } catch {
    return {
      lid: gauge.lid,
      name: gauge.name,
      lat: gauge.lat,
      lng: gauge.lng,
      state: gauge.state,
      quantiles: null,
      validTime: '',
      members: 0,
    };
  }
}

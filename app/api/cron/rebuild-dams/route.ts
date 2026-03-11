// app/api/cron/rebuild-dams/route.ts
// Cron endpoint — fetches high-hazard dams from USACE National Inventory of Dams.
// Source: https://nid.sec.usace.army.mil/api/nation/dams
// Schedule: daily at 5:30 AM UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setDamCache, getDamCacheStatus,
  isDamBuildInProgress, setDamBuildInProgress,
  type DamRecord,
} from '@/lib/damCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const NID_BASE = 'https://nid.sec.usace.army.mil/api/nation/dams';
const FETCH_TIMEOUT_MS = 30_000;
const RETRY_DELAY_MS = 5_000;

// All 50 US states + DC
const CONUS_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
  'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT',
  'VT','VA','WA','WV','WI','WY',
];

async function fetchState(state: string): Promise<DamRecord[]> {
  const url = `${NID_BASE}?hazard=H&stateId=${state}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PEARL-Platform/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`NID API ${state}: HTTP ${res.status}`);
  const rawDams: any[] = await res.json();

  return rawDams
    .filter((d: any) => d.latitude != null && d.longitude != null)
    .map((d: any) => ({
      id: String(d.nidId || d.federalId || d.otherDamId || ''),
      name: d.damName || d.name || 'Unknown Dam',
      lat: parseFloat(d.latitude),
      lng: parseFloat(d.longitude),
      state: state.toUpperCase(),
      hazard: d.hazardPotentialClassification || 'H',
      height: d.nidHeight != null ? parseFloat(d.nidHeight) : null,
      storageAcreFt: d.nidStorage != null ? parseFloat(d.nidStorage) : null,
      damType: d.primaryDamType || null,
      conditionAssessment: d.conditionAssessment || null,
    }));
}

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isDamBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Dam build already in progress',
      cache: getDamCacheStatus(),
    });
  }

  setDamBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log(`[Dam Cron] Fetching high-hazard dams for ${CONUS_STATES.length} states...`);

    // Fetch in parallel batches of 10
    const allDams: DamRecord[] = [];
    const failedStates: string[] = [];

    for (let i = 0; i < CONUS_STATES.length; i += 10) {
      const batch = CONUS_STATES.slice(i, i + 10);
      const results = await Promise.allSettled(batch.map(s => fetchState(s)));

      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled') {
          allDams.push(...r.value);
        } else {
          failedStates.push(batch[j]);
          console.warn(`[Dam Cron] Failed for ${batch[j]}: ${r.reason?.message}`);
        }
      }
    }

    // Retry failed states once
    if (failedStates.length > 0) {
      console.log(`[Dam Cron] Retrying ${failedStates.length} failed states...`);
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));

      const retryResults = await Promise.allSettled(failedStates.map(s => fetchState(s)));
      for (let j = 0; j < retryResults.length; j++) {
        const r = retryResults[j];
        if (r.status === 'fulfilled') {
          allDams.push(...r.value);
        } else {
          console.warn(`[Dam Cron] Retry failed for ${failedStates[j]}: ${r.reason?.message}`);
        }
      }
    }

    // Empty-data guard
    if (allDams.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Dam Cron] 0 dams in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getDamCacheStatus(),
      });
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const deduped = allDams.filter(d => {
      if (!d.id || seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    await setDamCache({
      _meta: {
        built: new Date().toISOString(),
        damCount: deduped.length,
      },
      dams: deduped,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Dam Cron] Complete in ${elapsed}s — ${deduped.length} high-hazard dams`);

    recordCronRun('rebuild-dams', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      damCount: deduped.length,
      cache: getDamCacheStatus(),
    });

  } catch (err: any) {
    console.error('[Dam Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-dams' } });
    notifySlackCronFailure({ cronName: 'rebuild-dams', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-dams', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Dam build failed' },
      { status: 500 },
    );
  } finally {
    setDamBuildInProgress(false);
  }
}

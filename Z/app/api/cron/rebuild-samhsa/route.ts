// app/api/cron/rebuild-samhsa/route.ts
// Cron — fetches SAMHSA treatment facility data from the Treatment Locator API.
// Schedule: daily 1:00 AM UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSAMHSACache, getSAMHSACacheStatus, isBuildInProgress, setBuildInProgress,
  processSAMHSAData, buildSAMHSACacheData,
} from '@/lib/samhsaCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

const SAMHSA_API = 'https://findtreatment.gov/locator/listing';
const FETCH_TIMEOUT_MS = 30_000;
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (isBuildInProgress()) return NextResponse.json({ status: 'skipped', reason: 'build in progress', cache: getSAMHSACacheStatus() });

  setBuildInProgress(true);
  const startTime = Date.now();
  try {
    const allRaw: any[] = [];
    for (let i = 0; i < STATES.length; i += 5) {
      const batch = STATES.slice(i, i + 5);
      const results = await Promise.allSettled(batch.map(async (state) => {
        try {
          const res = await fetch(`${SAMHSA_API}?sType=SA&sAddr=${state}&pageSize=500&page=1`, {
            headers: { 'User-Agent': 'PEARL-Platform/1.0', Accept: 'application/json' },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        } catch { return []; }
      }));
      for (const r of results) if (r.status === 'fulfilled' && Array.isArray(r.value)) allRaw.push(...r.value);
    }
    console.log(`[SAMHSA Cron] Fetched ${allRaw.length} raw facilities`);
    if (allRaw.length === 0) { recordCronRun('rebuild-samhsa', 'success', Date.now() - startTime); return NextResponse.json({ status: 'empty' }); }

    const records = processSAMHSAData(allRaw);
    const cacheData = await buildSAMHSACacheData(records);
    await setSAMHSACache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SAMHSA Cron] Complete in ${elapsed}s — ${records.length} facilities`);
    recordCronRun('rebuild-samhsa', 'success', Date.now() - startTime);
    return NextResponse.json({ status: 'complete', duration: `${elapsed}s`, recordCount: records.length });
  } catch (err: any) {
    console.error('[SAMHSA Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-samhsa' } });
    notifySlackCronFailure({ cronName: 'rebuild-samhsa', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-samhsa', 'error', Date.now() - startTime, err.message);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  } finally { setBuildInProgress(false); }
}

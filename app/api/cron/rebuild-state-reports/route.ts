// app/api/cron/rebuild-state-reports/route.ts
// Cron endpoint — builds state-level data reports by aggregating WQP, ATTAINS,
// and station registry data. Runs after WQP cron completes.
// Schedule: daily via Vercel cron (5:30 AM UTC) or manual trigger.

import { NextRequest, NextResponse } from 'next/server';
import { buildStateReports } from '@/lib/stateReportCache';

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    console.log('[State Reports Cron] Starting build...');
    const stateReports = buildStateReports();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`[State Reports Cron] Build complete in ${elapsed}s — ${stateReports._meta.stateCount} states`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      stateCount: stateReports._meta.stateCount,
      built: stateReports._meta.built,
    });
  } catch (err: any) {
    console.error('[State Reports Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'State reports build failed' },
      { status: 500 },
    );
  }
}

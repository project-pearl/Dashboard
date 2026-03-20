// app/api/cron/rebuild-force-protection/route.ts
// Weekly cron — builds Force Protection Intelligence derived cache by
// cross-joining SDWIS, PFAS, DoD PFAS, EPA PFAS, Cyber Risk, Water
// Availability, ATTAINS, and Flood Impact caches per installation.
// Schedule: Sundays at 4:15 AM UTC (after upstream caches are fresh).

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  buildForceProtectionCache,
  setForceProtectionCache,
  getForceProtectionCacheStatus,
  isForceProtectionBuildInProgress,
  setForceProtectionBuildInProgress,
} from '@/lib/forceProtectionCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// Warm upstream caches
import { ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { ensureWarmed as warmPfas } from '@/lib/pfasCache';
import { ensureWarmed as warmDodPfas } from '@/lib/dodPfasCache';
import { ensureWarmed as warmEpaPfas } from '@/lib/epaPfasAnalyticsCache';
import { ensureWarmed as warmCyberRisk } from '@/lib/cyberRiskCache';
import { ensureWarmed as warmWaterAvail } from '@/lib/usgsWaterAvailCache';
import { ensureWarmed as warmAttains } from '@/lib/attainsCache';
import { ensureWarmed as warmFloodImpact } from '@/lib/floodImpactCache';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isForceProtectionBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Force protection build already in progress',
      cache: getForceProtectionCacheStatus(),
    });
  }

  setForceProtectionBuildInProgress(true);
  const startTime = Date.now();

  try {
    console.log('[Force Protection Cron] Starting build — warming upstream caches');

    // Warm all upstream caches in parallel
    await Promise.allSettled([
      warmSdwis(),
      warmPfas(),
      warmDodPfas(),
      warmEpaPfas(),
      warmCyberRisk(),
      warmWaterAvail(),
      warmAttains(),
      warmFloodImpact(),
    ]);

    console.log('[Force Protection Cron] Upstream caches warmed, running cross-join');

    const assessments = buildForceProtectionCache();

    // Empty-data guard
    if (assessments.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Force Protection Cron] 0 assessments in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getForceProtectionCacheStatus(),
      });
    }

    const avgScore = Math.round(assessments.reduce((s, a) => s + a.riskScore, 0) / assessments.length);
    const elevatedCount = assessments.filter(a => a.riskLevel === 'elevated' || a.riskLevel === 'high' || a.riskLevel === 'critical').length;
    const gapCount = assessments.reduce((s, a) => s + a.coverageGaps.length, 0);

    await setForceProtectionCache({
      _meta: {
        built: new Date().toISOString(),
        installationCount: assessments.length,
        avgRiskScore: avgScore,
        elevatedCount,
        gapCount,
      },
      assessments,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Force Protection Cron] Complete in ${elapsed}s`);

    recordCronRun('rebuild-force-protection', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      installationCount: assessments.length,
      avgRiskScore: avgScore,
      elevatedCount,
      gapCount,
      cache: getForceProtectionCacheStatus(),
    });
  } catch (err: any) {
    console.error('[Force Protection Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-force-protection' } });
    notifySlackCronFailure({
      cronName: 'rebuild-force-protection',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });
    recordCronRun('rebuild-force-protection', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Force protection build failed' },
      { status: 500 },
    );
  } finally {
    setForceProtectionBuildInProgress(false);
  }
}

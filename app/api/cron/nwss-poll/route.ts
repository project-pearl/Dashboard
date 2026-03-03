/* ------------------------------------------------------------------ */
/*  NWSS Pathogen Poll — Cron Route                                   */
/*                                                                    */
/*  Fetches pathogen concentration data from CDC NWSS Socrata API     */
/*  for SARS-CoV-2, Influenza A, Mpox, and RSV datasets.             */
/*                                                                    */
/*  Schedule: Saturday 7 AM UTC (data updates Fridays) + fallback     */
/*            Wednesday 7 AM UTC (catches mid-week corrections)       */
/*                                                                    */
/*  Incremental: Only fetches records since last poll (sinceDate).    */
/*  Full refresh: First Saturday of month (90-day trailing window).   */
/* ------------------------------------------------------------------ */

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { fetchAllPathogens } from '@/lib/nwss/fetch';
import { computeBaselines, detectAnomalies } from '@/lib/nwss/baseline';
import {
  setNwssCache, getNwssCacheStatus, getNwssPollState,
  isNwssBuildInProgress, setNwssBuildInProgress,
  getNwssRecords, ensureWarmed,
} from '@/lib/nwss/nwssCache';
import {
  ALL_PATHOGENS, REGION_3_STATES,
  type PathogenType, type NWSSRecord, type NWSSCacheData, type NWSSPollState,
} from '@/lib/nwss/types';

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

/* ------------------------------------------------------------------ */
/*  GET Handler                                                       */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isNwssBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'NWSS pathogen poll already in progress',
      cache: getNwssCacheStatus(),
    });
  }

  setNwssBuildInProgress(true);
  const startTime = Date.now();

  try {
    await ensureWarmed();

    // Determine fetch strategy
    const now = new Date();
    const isFirstSaturdayOfMonth = now.getUTCDay() === 6 && now.getUTCDate() <= 7;
    const isForceRefresh = request.nextUrl.searchParams.get('full') === 'true';
    const isFullRefresh = isFirstSaturdayOfMonth || isForceRefresh;

    // Calculate sinceDate for incremental fetch
    let sinceDate: string | undefined;
    if (!isFullRefresh) {
      const pollState = getNwssPollState();
      // Find the most recent poll across all pathogens
      if (pollState?.lastPollAt) {
        const dates = Object.values(pollState.lastPollAt).filter(Boolean) as string[];
        if (dates.length > 0) {
          sinceDate = dates.sort().pop(); // most recent date
        }
      }
      // Default: 14 days back if no prior poll
      if (!sinceDate) {
        const d = new Date();
        d.setDate(d.getDate() - 14);
        sinceDate = d.toISOString().split('T')[0];
      }
    } else {
      // Full refresh: 90-day trailing window
      const d = new Date();
      d.setDate(d.getDate() - 90);
      sinceDate = d.toISOString().split('T')[0];
    }

    console.log(
      `[NWSS Poll] Starting ${isFullRefresh ? 'FULL' : 'incremental'} poll ` +
      `(since ${sinceDate || 'beginning'})`,
    );

    // Fetch all pathogens — Region 3 states for validation scope
    const freshRecords = await fetchAllPathogens(ALL_PATHOGENS, { sinceDate });

    // Merge with existing data if incremental
    const mergedRecords = {} as Record<PathogenType, NWSSRecord[]>;
    let totalRecords = 0;
    const pathogenCounts = {} as Record<PathogenType, number>;
    const allSewersheds = new Set<string>();
    const allStates = new Set<string>();

    for (const pathogen of ALL_PATHOGENS) {
      const fresh = freshRecords[pathogen] || [];

      if (isFullRefresh) {
        // Full refresh — use only fresh data
        mergedRecords[pathogen] = fresh;
      } else {
        // Incremental — merge with existing, deduplicate by recordId
        const existing = getNwssRecords(pathogen);
        const byId = new Map<string, NWSSRecord>();

        for (const r of existing) byId.set(r.recordId, r);
        for (const r of fresh) byId.set(r.recordId, r); // fresh overwrites

        mergedRecords[pathogen] = [...byId.values()];
      }

      pathogenCounts[pathogen] = mergedRecords[pathogen].length;
      totalRecords += mergedRecords[pathogen].length;

      for (const r of mergedRecords[pathogen]) {
        allSewersheds.add(r.sewershedId);
        if (r.jurisdiction) allStates.add(r.jurisdiction);
      }
    }

    // Compute baselines from all available data
    const allRecordsFlat = Object.values(mergedRecords).flat();
    const baselines = computeBaselines(allRecordsFlat);

    // Detect anomalies
    const anomalies = detectAnomalies(allRecordsFlat, baselines);

    // Update poll state
    const pollNow = new Date().toISOString();
    const pollState: NWSSPollState = {
      lastPollAt: {
        'sars-cov-2': pollNow,
        'influenza-a': pollNow,
        'mpox': pollNow,
        'rsv': pollNow,
      },
      lastFullRefreshAt: isFullRefresh ? pollNow : (getNwssPollState()?.lastFullRefreshAt ?? null),
    };

    // Build and save cache
    const cacheData: NWSSCacheData = {
      _meta: {
        built: pollNow,
        pathogenCounts,
        totalRecords,
        stateCount: allStates.size,
        sewershedCount: allSewersheds.size,
        anomalyCount: anomalies.length,
      },
      records: mergedRecords,
      baselines,
      anomalies,
      pollState,
    };

    if (totalRecords === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[NWSS Poll] 0 records in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getNwssCacheStatus(),
      });
    }

    await setNwssCache(cacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const anomalyWarning = anomalies.filter(a => a.level === 'anomalous').length;
    const anomalyCritical = anomalies.filter(a => a.level === 'extreme').length;

    console.log(
      `[NWSS Poll] Complete in ${elapsed}s — ${totalRecords} records, ` +
      `${allSewersheds.size} sewersheds, ${anomalies.length} anomalies ` +
      `(${anomalyCritical} critical, ${anomalyWarning} warning)`,
    );

    return NextResponse.json({
      status: 'complete',
      mode: isFullRefresh ? 'full_refresh' : 'incremental',
      duration: `${elapsed}s`,
      totalRecords,
      pathogenCounts,
      sewersheds: allSewersheds.size,
      states: allStates.size,
      baselines: Object.keys(baselines).length,
      anomalies: {
        total: anomalies.length,
        critical: anomalyCritical,
        warning: anomalyWarning,
        elevated: anomalies.filter(a => a.level === 'elevated').length,
      },
      cache: getNwssCacheStatus(),
    });

  } catch (err: any) {
    console.error('[NWSS Poll] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'NWSS poll failed' },
      { status: 500 },
    );
  } finally {
    setNwssBuildInProgress(false);
  }
}

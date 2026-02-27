import { NextResponse } from 'next/server';
import { ensureWarmed as warmWqp } from '@/lib/wqpCache';
import { ensureWarmed as warmIcis } from '@/lib/icisCache';
import { ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { ensureWarmed as warmAttains } from '@/lib/attainsCache';
import { collectForHuc, getAllHuc8s } from '@/lib/indices/hucDataCollector';
import { computePermitRiskExposure } from '@/lib/indices/permitRiskExposure';
import { computeInfrastructureFailure } from '@/lib/indices/infrastructureFailure';
import { computePearlLoadVelocity } from '@/lib/indices/pearlLoadVelocity';
import { computeWatershedRecovery } from '@/lib/indices/watershedRecovery';
import { isCoastalHuc, applyTidalModifiers } from '@/lib/indices/tidalModifiers';
import { computeProjections, type ScoreHistoryEntry } from '@/lib/indices/projections';
import { INDEX_WEIGHTS } from '@/lib/indices/config';
import {
  isBuildInProgress,
  setBuildInProgress,
  ensureWarmed as warmIndices,
  setIndicesCache,
  appendScoreHistory,
  getScoreHistory,
  getCacheStatus,
} from '@/lib/indices/indicesCache';
import type { HucIndices, IndexScore } from '@/lib/indices/types';
import { HUC_BATCH_SIZE } from '@/lib/indices/config';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Indices build already in progress',
      cache: getCacheStatus(),
    });
  }

  setBuildInProgress(true);
  const startMs = Date.now();

  try {
    // Warm all source caches in parallel
    await Promise.all([warmWqp(), warmIcis(), warmSdwis(), warmAttains(), warmIndices()]);

    const allHucs = getAllHuc8s();
    const results: Record<string, HucIndices> = {};
    const historyEntries: Record<string, ScoreHistoryEntry> = {};
    const todayISO = new Date().toISOString().slice(0, 10);
    let totalConfidence = 0;
    let scoredCount = 0;

    // Process HUCs in batches
    for (let i = 0; i < allHucs.length; i += HUC_BATCH_SIZE) {
      const batch = allHucs.slice(i, i + HUC_BATCH_SIZE);

      const batchResults = await Promise.all(batch.map(async (huc8) => {
        const data = collectForHuc(huc8);
        if (!data) return null;

        // Run all 4 index engines
        const pearlLoadVelocity = computePearlLoadVelocity(data);
        const infrastructureFailure = computeInfrastructureFailure(data);
        const watershedRecovery = computeWatershedRecovery(data);
        const permitRiskExposure = computePermitRiskExposure(data);

        // Apply tidal modifiers for coastal HUCs
        if (isCoastalHuc(huc8)) {
          applyTidalModifiers({ pearlLoadVelocity, infrastructureFailure, watershedRecovery, permitRiskExposure });
        }

        // Compute composite (weighted average)
        const composite = Math.round(
          pearlLoadVelocity.value * INDEX_WEIGHTS.pearlLoadVelocity +
          infrastructureFailure.value * INDEX_WEIGHTS.infrastructureFailure +
          watershedRecovery.value * INDEX_WEIGHTS.watershedRecovery +
          permitRiskExposure.value * INDEX_WEIGHTS.permitRiskExposure
        );

        // Composite confidence = minimum across all indices
        const compositeConfidence = Math.min(
          pearlLoadVelocity.confidence,
          infrastructureFailure.confidence,
          watershedRecovery.confidence,
          permitRiskExposure.confidence,
        );

        // Projections from score history
        const history = getScoreHistory(huc8);
        const { projection7d, projection30d } = computeProjections(history, composite, compositeConfidence);

        const hucIndices: HucIndices = {
          huc8,
          stateAbbr: data.stateAbbr,
          pearlLoadVelocity,
          infrastructureFailure,
          watershedRecovery,
          permitRiskExposure,
          composite,
          compositeConfidence,
          projection7d,
          projection30d,
        };

        return { huc8, hucIndices, composite };
      }));

      for (const result of batchResults) {
        if (!result) continue;
        results[result.huc8] = result.hucIndices;
        historyEntries[result.huc8] = { date: todayISO, composite: result.composite };
        totalConfidence += result.hucIndices.compositeConfidence;
        scoredCount++;
      }
    }

    // Empty-data guard
    if (scoredCount === 0) {
      console.warn('[Indices Cron] 0 HUCs scored — skipping cache save to preserve existing data');
      return NextResponse.json({
        status: 'empty',
        reason: '0 HUCs scored, source caches may be cold',
        elapsed: Date.now() - startMs,
      });
    }

    const avgConfidence = Math.round(totalConfidence / scoredCount);
    const built = new Date().toISOString();

    // Save indices + history
    await setIndicesCache(results, { built, totalHucs: scoredCount, avgConfidence });
    await appendScoreHistory(historyEntries);

    return NextResponse.json({
      status: 'ok',
      totalHucs: scoredCount,
      avgConfidence,
      elapsed: Date.now() - startMs,
      built,
    });
  } catch (err: any) {
    console.error('[Indices Cron] Build failed:', err);
    return NextResponse.json({
      status: 'error',
      error: err?.message ?? 'Unknown error',
      elapsed: Date.now() - startMs,
    }, { status: 500 });
  } finally {
    setBuildInProgress(false);
  }
}

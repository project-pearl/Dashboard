/**
 * HUC-14 Premium Tier Rebuild Cron
 *
 * POST /api/cron/rebuild-huc14-premium
 * Builds PIN Precision+ sub-subwatershed analysis for high-value regions.
 * Runs daily at 4:00 AM UTC (after standard HUC-12 indices complete).
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectForHuc14 } from '@/lib/indices/huc14DataCollector';
import { computeHuc14Indices } from '@/lib/indices/huc14Indices';
import { setHuc14Cache, appendHuc14History, buildLockManager } from '@/lib/indices/huc14Cache';
import { getHuc14Coverage, HIGH_VALUE_REGIONS, getPremiumTierStats } from '@/lib/indices/huc14Regions';

export const dynamic = 'force-dynamic';
export const maxDuration = 1800; // 30 minutes for premium processing

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`[HUC-14 Premium Rebuild] Starting at ${timestamp}`);

  // Check for existing build
  if (buildLockManager.isBuildInProgress()) {
    const timeRemaining = buildLockManager.getBuildTimeout() -
      (Date.now() - buildLockManager.getBuildStartTime());

    return NextResponse.json({
      status: 'building',
      message: 'HUC-14 premium build already in progress',
      timeRemaining: Math.round(timeRemaining / 1000)
    }, { status: 423 });
  }

  buildLockManager.setBuildInProgress(true);

  try {
    // Get target HUC-12s for HUC-14 analysis
    const targetHuc12s = getHuc14Coverage();
    console.log(`[HUC-14 Premium] Processing ${targetHuc12s.length} premium HUC-12 regions`);

    const allIndices: Record<string, any> = {};
    const allRawData: Record<string, any> = {};
    const historyEntries: Record<string, any> = {};

    let processedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Process in smaller batches for premium tier (more intensive)
    const batchSize = 3; // Smaller batches for HUC-14 processing

    for (let i = 0; i < targetHuc12s.length; i += batchSize) {
      const batch = targetHuc12s.slice(i, i + batchSize);

      console.log(`[HUC-14 Premium] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(targetHuc12s.length/batchSize)}`);

      const batchPromises = batch.map(async (huc12) => {
        try {
          // Generate HUC-14s for this HUC-12
          // In production, this would come from NHDPlus HR dataset
          const huc14s = generateHuc14sForHuc12(huc12);

          for (const huc14 of huc14s) {
            try {
              // Collect enhanced data for HUC-14
              const data = collectForHuc14(huc14);

              // Compute premium indices
              const indices = computeHuc14Indices(data);

              allIndices[huc14] = indices;
              allRawData[huc14] = data;

              // Create history entry
              historyEntries[huc14] = {
                date: timestamp,
                premiumScore: indices.premiumScore,
                confidence: indices.premiumConfidence,
                dataQuality: indices.dataQuality,
                facilityCount: data.facilityInventory.length,
                contaminantSources: data.contaminantSources.length
              };

              processedCount++;
            } catch (huc14Error) {
              console.error(`[HUC-14 Premium] Failed to process HUC-14 ${huc14}:`, huc14Error);
              errors.push(`HUC-14 ${huc14}: ${huc14Error instanceof Error ? huc14Error.message : String(huc14Error)}`);
              errorCount++;
            }
          }
        } catch (huc12Error) {
          console.error(`[HUC-14 Premium] Failed to process HUC-12 ${huc12}:`, huc12Error);
          errors.push(`HUC-12 ${huc12}: ${huc12Error instanceof Error ? huc12Error.message : String(huc12Error)}`);
          errorCount++;
        }
      });

      await Promise.allSettled(batchPromises);

      // Progress logging
      const progress = Math.round(((i + batchSize) / targetHuc12s.length) * 100);
      console.log(`[HUC-14 Premium] Progress: ${progress}% (${processedCount} HUC-14s processed)`);
    }

    // Save cache if we have data
    if (processedCount > 0) {
      console.log(`[HUC-14 Premium] Saving ${processedCount} HUC-14 indices to cache`);
      await setHuc14Cache(allIndices, allRawData);
      await appendHuc14History(historyEntries);
    }

    const duration = Date.now() - startTime;
    const premiumStats = getPremiumTierStats();

    // Success response
    const response = {
      status: 'success',
      message: `HUC-14 premium tier rebuild completed`,
      duration: Math.round(duration / 1000),
      statistics: {
        targetRegions: targetHuc12s.length,
        processedHuc14s: processedCount,
        errorCount,
        coverage: processedCount > 0 ? Math.round((processedCount / (targetHuc12s.length * 8)) * 100) : 0,
        premiumStats
      },
      regionBreakdown: {
        metropolitan: HIGH_VALUE_REGIONS.filter(r => r.type === 'metropolitan').length,
        infrastructure: HIGH_VALUE_REGIONS.filter(r => r.type === 'infrastructure').length,
        superfund: HIGH_VALUE_REGIONS.filter(r => r.type === 'superfund').length,
        military: HIGH_VALUE_REGIONS.filter(r => r.type === 'military').length
      },
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Limit error reporting
    };

    console.log(`[HUC-14 Premium] Completed in ${Math.round(duration / 1000)}s: ${processedCount} HUC-14s processed`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('[HUC-14 Premium] Critical error during rebuild:', error);

    return NextResponse.json({
      status: 'error',
      message: 'HUC-14 premium rebuild failed',
      error: error instanceof Error ? error.message : String(error),
      duration: Math.round((Date.now() - startTime) / 1000)
    }, { status: 500 });

  } finally {
    buildLockManager.setBuildInProgress(false);
  }
}

/**
 * Generate HUC-14 codes for a given HUC-12
 * In production, this would come from NHDPlus HR dataset
 */
function generateHuc14sForHuc12(huc12: string): string[] {
  const huc14s: string[] = [];

  // Generate 6-10 HUC-14s per HUC-12 (typical range)
  const count = Math.floor(Math.random() * 5) + 6; // 6-10 HUC-14s

  for (let i = 1; i <= count; i++) {
    const suffix = i.toString().padStart(2, '0');
    huc14s.push(huc12 + suffix);
  }

  return huc14s;
}

/**
 * GET endpoint for build status
 */
export async function GET() {
  const isBuilding = buildLockManager.isBuildInProgress();
  const buildTime = buildLockManager.getBuildStartTime();

  let timeRemaining = 0;
  let progress = 0;

  if (isBuilding && buildTime) {
    timeRemaining = buildLockManager.getBuildTimeout() - (Date.now() - buildTime);
    progress = Math.max(0, Math.min(100,
      ((Date.now() - buildTime) / buildLockManager.getBuildTimeout()) * 100
    ));
  }

  const targetHuc12s = getHuc14Coverage();
  const premiumStats = getPremiumTierStats();

  return NextResponse.json({
    status: isBuilding ? 'building' : 'idle',
    building: isBuilding,
    progress: Math.round(progress),
    timeRemaining: Math.max(0, timeRemaining),
    targetRegions: targetHuc12s.length,
    estimatedHuc14s: targetHuc12s.length * 8,
    currentStats: premiumStats,
    nextBuild: '4:00 AM UTC daily'
  });
}
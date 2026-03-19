/**
 * HUC-8 Coverage Status API
 *
 * GET /api/huc-coverage
 * Returns comprehensive coverage report for 14-layer composite index system
 */

import { NextResponse } from 'next/server';
import { generateCoverageReport, hasFullCoverage, getStatesWithGaps } from '@/lib/indices/coverageValidator';
import { getCacheStatus } from '@/lib/indices/indicesCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
  try {
    const coverageReport = generateCoverageReport();
    const cacheStatus = getCacheStatus();
    const hasFullCov = hasFullCoverage();
    const stateGaps = getStatesWithGaps();

    return NextResponse.json({
      status: 'success',
      coverage: coverageReport,
      cacheStatus: {
        built: cacheStatus.built,
        source: cacheStatus.source,
        avgConfidence: cacheStatus.avgConfidence,
      },
      fullCoverage: hasFullCov,
      stateGaps,
      summary: {
        message: hasFullCov
          ? '✅ Full 14-layer coverage achieved across all watersheds'
          : `⚠️ Coverage at ${coverageReport.coveragePercent}% - ${coverageReport.missingHucs.length} HUCs need processing`,
        recommendation: hasFullCov
          ? 'All decisions in PIN are now pulling from 14-layer composite index'
          : 'Run rebuild-indices cron to process remaining watersheds',
      },
    });
  } catch (error) {
    console.error('Coverage report error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to generate coverage report',
      },
      { status: 500 }
    );
  }
}
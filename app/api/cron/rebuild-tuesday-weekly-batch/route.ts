/**
 * Tuesday Weekly Batch - Weekly Cron Consolidation
 * Runs: Every Tuesday at 4 AM UTC
 *
 * Consolidates:
 * - rebuild-edna
 */

import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes total for batch
export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[Tuesday Weekly Batch] Starting weekly batch operations...');

  const results = {
    'edna': null as any,
  };

  try {
    console.log('[Tuesday Weekly Batch] Processing edna...');
    try {
      const ednaResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/rebuild-edna`);
      results['edna'] = {
        status: ednaResponse.status,
        success: ednaResponse.ok
      };
    } catch (error) {
      results['edna'] = { status: 'error', error: error.message };
    }

    const successCount = Object.values(results).filter(r => r?.success).length;
    console.log(`[Tuesday Weekly Batch] Completed: ${successCount}/1 operations successful`);

    return NextResponse.json({
      success: true,
      completed: new Date().toISOString(),
      results,
      summary: `${successCount}/1 operations completed successfully`
    });

  } catch (error) {
    console.error('[Tuesday Weekly Batch] Batch operation failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}
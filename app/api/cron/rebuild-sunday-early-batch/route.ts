/**
 * Sunday Early Batch - Weekly Cron Consolidation
 * Runs: Every Sunday at 2 AM UTC
 *
 * Consolidates:
 * - rebuild-force-protection
 * - rebuild-hhs-weekly-batch
 */

import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes total for batch
export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[Sunday Early Batch] Starting weekly batch operations...');

  const results = {
    'force-protection': null as any,
    'hhs-weekly-batch': null as any,
  };

  try {
    // Execute batch operations in sequence to avoid overwhelming the system
    console.log('[Sunday Early Batch] Processing force-protection...');
    try {
      const forceProtectionResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/rebuild-force-protection`);
      results['force-protection'] = {
        status: forceProtectionResponse.status,
        success: forceProtectionResponse.ok
      };
    } catch (error) {
      results['force-protection'] = { status: 'error', error: error.message };
    }

    console.log('[Sunday Early Batch] Processing hhs-weekly-batch...');
    try {
      const hhsResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/rebuild-hhs-weekly-batch`);
      results['hhs-weekly-batch'] = {
        status: hhsResponse.status,
        success: hhsResponse.ok
      };
    } catch (error) {
      results['hhs-weekly-batch'] = { status: 'error', error: error.message };
    }

    const successCount = Object.values(results).filter(r => r?.success).length;
    console.log(`[Sunday Early Batch] Completed: ${successCount}/2 operations successful`);

    return NextResponse.json({
      success: true,
      completed: new Date().toISOString(),
      results,
      summary: `${successCount}/2 operations completed successfully`
    });

  } catch (error) {
    console.error('[Sunday Early Batch] Batch operation failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}
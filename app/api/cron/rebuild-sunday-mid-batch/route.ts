/**
 * Sunday Mid Batch - Weekly Cron Consolidation
 * Runs: Every Sunday at 16 PM UTC
 *
 * Consolidates:
 * - rebuild-nars
 * - rebuild-datagov
 * - rebuild-coops-derived
 * - rebuild-nasa-stream
 * - rebuild-ipac
 */

import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes total for batch
export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[Sunday Mid Batch] Starting weekly batch operations...');

  const operations = [
    'rebuild-nars',
    'rebuild-datagov',
    'rebuild-coops-derived',
    'rebuild-nasa-stream',
    'rebuild-ipac'
  ];

  const results = {};

  try {
    // Execute operations sequentially to avoid resource conflicts
    for (const operation of operations) {
      console.log(`[Sunday Mid Batch] Processing ${operation}...`);
      try {
        const response = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/cron/${operation}`);
        results[operation] = {
          status: response.status,
          success: response.ok
        };
      } catch (error) {
        results[operation] = { status: 'error', error: error.message };
      }
    }

    const successCount = Object.values(results).filter(r => r?.success).length;
    console.log(`[Sunday Mid Batch] Completed: ${successCount}/${operations.length} operations successful`);

    return NextResponse.json({
      success: true,
      completed: new Date().toISOString(),
      results,
      summary: `${successCount}/${operations.length} operations completed successfully`
    });

  } catch (error) {
    console.error('[Sunday Mid Batch] Batch operation failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}
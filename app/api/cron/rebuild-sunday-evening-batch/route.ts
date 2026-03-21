/**
 * Sunday Evening Batch - Weekly Cron Consolidation
 * Runs: Every Sunday at 19 PM UTC
 *
 * Consolidates:
 * - rebuild-usgs-water-avail
 * - rebuild-usda-cdc-batch
 * - rebuild-demographics-batch
 * - rebuild-sam
 * - rebuild-usaspending
 * - rebuild-cyber-risk
 * - rebuild-gemstat
 * - rebuild-weekly-infra-batch
 */

import { NextResponse } from 'next/server';

export const maxDuration = 300; // 5 minutes total for batch
export const dynamic = 'force-dynamic';

export async function GET() {
  console.log('[Sunday Evening Batch] Starting weekly batch operations...');

  const operations = [
    'rebuild-usgs-water-avail',
    'rebuild-usda-cdc-batch',
    'rebuild-demographics-batch',
    'rebuild-sam',
    'rebuild-usaspending',
    'rebuild-cyber-risk',
    'rebuild-gemstat',
    'rebuild-weekly-infra-batch'
  ];

  const results = {};

  try {
    // Execute operations sequentially to avoid resource conflicts
    for (const operation of operations) {
      console.log(`[Sunday Evening Batch] Processing ${operation}...`);
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
    console.log(`[Sunday Evening Batch] Completed: ${successCount}/${operations.length} operations successful`);

    return NextResponse.json({
      success: true,
      completed: new Date().toISOString(),
      results,
      summary: `${successCount}/${operations.length} operations completed successfully`
    });

  } catch (error) {
    console.error('[Sunday Evening Batch] Batch operation failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
}
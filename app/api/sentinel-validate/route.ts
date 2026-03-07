/* ------------------------------------------------------------------ */
/*  PIN Sentinel — On-Demand Validation Endpoint                      */
/*  Runs all attack scenarios and returns a ScoreReport.               */
/* ------------------------------------------------------------------ */

import { NextResponse } from 'next/server';
import { runValidation } from '@/lib/sentinel/__tests__/runValidation';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  // Auth check — fail closed when CRON_SECRET is unset
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const scenarioParam = url.searchParams.get('scenario');
    const scenarioNames = scenarioParam ? [scenarioParam] : undefined;

    const report = await runValidation(scenarioNames);

    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[sentinel-validate] Error:', message);
    return NextResponse.json({ error: 'Validation error' }, { status: 500 });
  }
}

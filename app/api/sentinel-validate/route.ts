/* ------------------------------------------------------------------ */
/*  PIN Sentinel — On-Demand Validation Endpoint                      */
/*  Runs all attack scenarios and returns a ScoreReport.               */
/* ------------------------------------------------------------------ */

import { NextResponse } from 'next/server';
import { runValidation } from '@/lib/sentinel/__tests__/runValidation';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: Request) {
  // Auth check — require CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

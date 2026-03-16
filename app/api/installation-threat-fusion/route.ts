/* ------------------------------------------------------------------ */
/*  Cross-Domain Threat Fusion — API Route                             */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { computeThreatFusion } from '@/lib/threatFusion';
import { ensureWarmed as warmSentinel } from '@/lib/sentinel/scoringEngine';
import { ensureWarmed as warmCyber } from '@/lib/cyberRiskCache';
import { ensureWarmed as warmFirms } from '@/lib/firmsCache';
import { ensureWarmed as warmAq } from '@/lib/airQualityCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const installationId = request.nextUrl.searchParams.get('installationId');
  if (!installationId) {
    return NextResponse.json({ error: 'Missing ?installationId parameter' }, { status: 400 });
  }

  try {
    // Warm all caches in parallel
    await Promise.all([warmSentinel(), warmCyber(), warmFirms(), warmAq()]);

    const result = await computeThreatFusion(installationId);
    if (!result) {
      return NextResponse.json(
        { error: `Installation "${installationId}" not found or overseas (no CONUS data)` },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`[installation-threat-fusion] Error: ${err.message}`);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

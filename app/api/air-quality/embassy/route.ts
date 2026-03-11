// app/api/air-quality/embassy/route.ts
// Serves embassy/installation AQI readings from the WAQI cache.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import {
  ensureWarmed,
  ensureTrendWarmed,
  getEmbassyAqiAll,
  getEmbassyAqiForFacility,
  getEmbassyAqiByRegion,
  getEmbassyAqiCacheStatus,
  getEmbassyAqiTrendHistory,
} from '@/lib/embassyAqiCache';

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureWarmed();

  const facilityParam = req.nextUrl.searchParams.get('facility');
  const regionParam = req.nextUrl.searchParams.get('region');
  const wantTrends = req.nextUrl.searchParams.get('trends') === 'true';

  // Single facility lookup
  if (facilityParam) {
    const reading = getEmbassyAqiForFacility(facilityParam);
    if (!reading) {
      return NextResponse.json({ ok: false, error: `Facility not found: ${facilityParam}` }, { status: 404 });
    }
    return NextResponse.json({ ok: true, reading, cache: getEmbassyAqiCacheStatus() });
  }

  // Region filter
  let readings = regionParam
    ? getEmbassyAqiByRegion(regionParam)
    : getEmbassyAqiAll();

  let trendHistory: any = undefined;
  if (wantTrends) {
    await ensureTrendWarmed();
    trendHistory = getEmbassyAqiTrendHistory();
  }

  return NextResponse.json({
    ok: true,
    count: readings.length,
    readings,
    ...(trendHistory !== undefined ? { trendHistory } : {}),
    cache: getEmbassyAqiCacheStatus(),
  });
}

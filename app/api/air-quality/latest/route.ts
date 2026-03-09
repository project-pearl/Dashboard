import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWarmed,
  ensureAqTrendWarmed,
  getAirQualityCacheStatus,
  getAirQualityForState,
  getAqiTrendHistory,
} from '@/lib/airQualityCache';

export async function GET(req: NextRequest) {
  await ensureWarmed();

  const stateParam = req.nextUrl.searchParams.get('state');
  const state = (stateParam || '').trim().toUpperCase();
  if (!state) {
    return NextResponse.json(
      { ok: false, error: 'Missing required query param: state' },
      { status: 400 },
    );
  }

  const wantTrends = req.nextUrl.searchParams.get('trends') === 'true';
  const reading = getAirQualityForState(state);
  const cache = getAirQualityCacheStatus();

  let trendHistory: any = undefined;
  if (wantTrends) {
    await ensureAqTrendWarmed();
    const all = getAqiTrendHistory();
    // Extract just this state's readings from the full trend history
    trendHistory = all.map(snap => ({
      timestamp: snap.timestamp,
      ...(snap.stateReadings[state] || { usAqi: null, pm25: null, ozone: null }),
    }));
  }

  return NextResponse.json({
    ok: true,
    state,
    reading,
    ...(trendHistory !== undefined ? { trendHistory } : {}),
    cache,
  });
}

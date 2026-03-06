import { NextRequest, NextResponse } from 'next/server';
import {
  ensureWarmed,
  getAirQualityCacheStatus,
  getAirQualityForState,
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

  const reading = getAirQualityForState(state);
  const cache = getAirQualityCacheStatus();

  return NextResponse.json({
    ok: true,
    state,
    reading,
    cache,
  });
}

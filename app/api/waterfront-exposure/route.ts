import { NextRequest, NextResponse } from 'next/server';
import { getExposureDataLive, getAllExposureDataLive } from '@/lib/waterfrontExposureLive';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const all = searchParams.get('all');

  if (all === 'true') {
    return NextResponse.json(getAllExposureDataLive());
  }

  if (state) {
    const data = getExposureDataLive(state);
    if (data.medianHomeValue === 0) {
      return NextResponse.json({ error: `Unknown state: ${state}` }, { status: 404 });
    }
    return NextResponse.json(data);
  }

  return NextResponse.json({ error: 'Provide ?state=XX or ?all=true' }, { status: 400 });
}

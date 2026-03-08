export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import { ensureWarmed, getCronHealthSummary, getCronHistory } from '@/lib/cronHealth';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureWarmed();

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary: getCronHealthSummary(),
    history: getCronHistory(),
  });
}

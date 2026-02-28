export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
  ensureWarmed,
  getNwisGwAllSites,
  getNwisGwAllTrends,
} from '@/lib/nwisGwCache';

export async function GET() {
  await ensureWarmed();
  const sites = getNwisGwAllSites();
  const trends = getNwisGwAllTrends();
  return NextResponse.json({ sites, trends });
}

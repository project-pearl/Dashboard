// app/api/tri-releases/emergency-summary/route.ts
// Serves a summary of top TRI chemical releases from existing triCache.
// No new cache or cron — TRI is already rebuilt daily at 6 PM UTC.

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ensureWarmed, getTriAllFacilities } from '@/lib/triCache';

export async function GET() {
  await ensureWarmed();

  const facilities = getTriAllFacilities();

  let totalReleases = 0;
  let carcinogenFacilities = 0;
  for (const f of facilities) {
    totalReleases += f.totalReleases;
    if (f.carcinogenReleases > 0) carcinogenFacilities++;
  }

  const topFacilities = [...facilities]
    .sort((a, b) => b.totalReleases - a.totalReleases)
    .slice(0, 20)
    .map(f => ({
      facilityName: f.facilityName,
      state: f.state,
      totalReleases: f.totalReleases,
      carcinogenReleases: f.carcinogenReleases,
      topChemical: f.topChemicals[0] || 'N/A',
    }));

  return NextResponse.json({
    totalFacilities: facilities.length,
    totalReleases,
    carcinogenFacilities,
    topFacilities,
  });
}

// app/api/superfund-sites/route.ts
// Serves Superfund NPL site data from superfundCache.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ensureWarmed, getSuperfundSites, getSuperfundSitesAll } from '@/lib/superfundCache';

export async function GET(request: NextRequest) {
  await ensureWarmed();

  const state = request.nextUrl.searchParams.get('state')?.toUpperCase();

  const sites = state ? (getSuperfundSites(state) ?? []) : getSuperfundSitesAll();

  // Aggregate
  const byState: Record<string, number> = {};
  let activeNpl = 0;
  let proposedNpl = 0;
  for (const s of sites) {
    byState[s.stateAbbr] = (byState[s.stateAbbr] || 0) + 1;
    const statusLower = (s.status || '').toLowerCase();
    if (statusLower.includes('final') || statusLower.includes('active') || statusLower === 'npl site') {
      activeNpl++;
    } else if (statusLower.includes('proposed')) {
      proposedNpl++;
    }
  }

  const topBySiteScore = [...sites]
    .filter(s => s.siteScore != null && s.siteScore > 0)
    .sort((a, b) => (b.siteScore ?? 0) - (a.siteScore ?? 0))
    .slice(0, 20)
    .map(s => ({
      siteEpaId: s.siteEpaId,
      siteName: s.siteName,
      stateAbbr: s.stateAbbr,
      city: s.city,
      status: s.status,
      siteScore: s.siteScore,
      listingDate: s.listingDate,
    }));

  return NextResponse.json({
    totalSites: sites.length,
    activeNpl,
    proposedNpl,
    byState,
    topBySiteScore,
  });
}

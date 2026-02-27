import { NextRequest, NextResponse } from 'next/server';
import { getAttainsCache, type CachedWaterbody } from '@/lib/attainsCache';
import { ensureWarmed } from '@/lib/attainsCache';
import { extractHuc8 } from '@/lib/huc8Utils';

export const dynamic = 'force-dynamic';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request: NextRequest) {
  await ensureWarmed();

  const { searchParams } = request.nextUrl;
  const mode = searchParams.get('mode');
  const state = searchParams.get('state');
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

  const { states } = getAttainsCache();

  // Collect waterbodies from relevant states
  function getWaterbodies(stateFilter?: string | null): CachedWaterbody[] {
    const wbs: CachedWaterbody[] = [];
    const entries = stateFilter
      ? [[stateFilter, states[stateFilter]] as const].filter(([, v]) => v)
      : Object.entries(states);
    for (const [, summary] of entries) {
      if (summary) wbs.push(...summary.waterbodies);
    }
    return wbs;
  }

  try {
    switch (mode) {
      case 'name': {
        const q = (searchParams.get('q') || '').trim().toLowerCase();
        if (!q || q.length < 2) {
          return NextResponse.json({ results: [], total: 0 });
        }
        const all = getWaterbodies(state);
        const matches = all
          .filter(wb => wb.name.toLowerCase().includes(q))
          .slice(0, limit);
        return NextResponse.json({ results: matches, total: matches.length });
      }

      case 'huc': {
        const huc8 = (searchParams.get('huc8') || '').trim();
        if (!huc8 || huc8.length < 8) {
          return NextResponse.json({ results: [], total: 0 });
        }
        const all = getWaterbodies(state);
        const matches = all
          .filter(wb => {
            const wbHuc = extractHuc8(wb.id);
            return wbHuc === huc8;
          })
          .slice(0, limit);
        return NextResponse.json({ results: matches, total: matches.length });
      }

      case 'ms4': {
        const ms4Name = (searchParams.get('ms4') || '').trim().toLowerCase();
        if (!ms4Name || !state) {
          return NextResponse.json({ results: [], total: 0 });
        }
        // Search waterbodies in the same state — name contains jurisdiction name
        const all = getWaterbodies(state);
        const matches = all
          .filter(wb => wb.name.toLowerCase().includes(ms4Name))
          .slice(0, limit);
        return NextResponse.json({ results: matches, total: matches.length });
      }

      case 'nearby': {
        const lat = parseFloat(searchParams.get('lat') || '');
        const lng = parseFloat(searchParams.get('lng') || '');
        const radius = parseFloat(searchParams.get('radius') || '25');
        if (isNaN(lat) || isNaN(lng)) {
          return NextResponse.json({ results: [], total: 0 });
        }
        const all = getWaterbodies(state);
        const withDist = all
          .filter(wb => wb.lat != null && wb.lon != null)
          .map(wb => ({
            ...wb,
            _dist: haversineKm(lat, lng, wb.lat!, wb.lon!),
          }))
          .filter(wb => wb._dist <= radius)
          .sort((a, b) => a._dist - b._dist)
          .slice(0, limit);
        // Strip internal _dist field for response
        const results = withDist.map(({ _dist, ...rest }) => ({
          ...rest,
          distance: Math.round(_dist * 10) / 10,
        }));
        return NextResponse.json({ results, total: results.length });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid mode. Use: name, huc, ms4, nearby' },
          { status: 400 },
        );
    }
  } catch (e: any) {
    console.error('[waterbody-search]', e.message);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}

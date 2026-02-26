// app/api/nldi/[siteId]/route.ts
// On-demand proxy for USGS NLDI (Hydro-Linked Navigation).
// Returns GeoJSON flowlines for a given NWIS site.
// No cache — results are unique per site + direction + distance.

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';

const NLDI_BASE = 'https://labs.waterdata.usgs.gov/api/nldi/linked-data';
const VALID_MODES = ['UM', 'DM', 'UT', 'DD'] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  const { siteId } = await params;
  const url = new URL(request.url);
  const mode = (url.searchParams.get('mode') || 'DM').toUpperCase();
  const distance = parseInt(url.searchParams.get('distance') || '50', 10);

  if (!VALID_MODES.includes(mode as any)) {
    return NextResponse.json(
      { error: `Invalid mode. Must be one of: ${VALID_MODES.join(', ')}` },
      { status: 400 },
    );
  }

  if (isNaN(distance) || distance < 1 || distance > 500) {
    return NextResponse.json(
      { error: 'Distance must be between 1 and 500 km' },
      { status: 400 },
    );
  }

  const nldiUrl = `${NLDI_BASE}/nwissite/USGS-${siteId}/navigation/${mode}/flowlines?distance=${distance}`;

  try {
    const res = await fetch(nldiUrl, {
      headers: {
        'User-Agent': 'PEARL-Platform/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(25_000),
    });

    if (res.status === 404) {
      return NextResponse.json(
        { error: `Site USGS-${siteId} not found in NLDI` },
        { status: 404 },
      );
    }

    if (!res.ok) {
      console.error(`[NLDI Proxy] Upstream error: HTTP ${res.status} for ${nldiUrl}`);
      return NextResponse.json(
        { error: 'NLDI upstream API error', upstream: res.status },
        { status: 502 },
      );
    }

    const geojson = await res.json();
    return NextResponse.json(geojson, {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' },
    });
  } catch (err: any) {
    console.error(`[NLDI Proxy] Fetch failed for ${siteId}:`, err.message);
    return NextResponse.json(
      { error: 'Failed to fetch from NLDI', message: err.message },
      { status: 502 },
    );
  }
}

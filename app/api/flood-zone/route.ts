// app/api/flood-zone/route.ts
// On-demand FEMA NFHL Flood Zone lookup — queries Layer 28 for a lat/lng point.
// Returns authoritative flood zone determination (AE, VE, X, etc.) and SFHA status.

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';

const NFHL_URL = 'https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query';
const FETCH_TIMEOUT_MS = 10_000;

/** Zones that are Special Flood Hazard Areas (1% annual chance flood) */
const SFHA_ZONES = new Set(['A', 'AE', 'AH', 'AO', 'AR', 'A99', 'V', 'VE']);

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') || '');
  const lng = parseFloat(searchParams.get('lng') || '');

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'Missing or invalid lat/lng parameters' },
      { status: 400 },
    );
  }

  try {
    const params = new URLSearchParams({
      geometry: `${lng},${lat}`,
      geometryType: 'esriGeometryPoint',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: 'FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE',
      returnGeometry: 'false',
      f: 'json',
    });

    const res = await fetch(`${NFHL_URL}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`NFHL API returned ${res.status}`);
    }

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message || 'NFHL query error');
    }

    const features = data.features || [];
    if (features.length === 0) {
      return NextResponse.json({
        floodZone: null,
        sfha: false,
        zoneSubtype: null,
        staticBfe: null,
        message: 'No flood zone data at this location',
      });
    }

    const attrs = features[0].attributes;
    const floodZone = attrs.FLD_ZONE || null;
    const zoneSubtype = attrs.ZONE_SUBTY || null;
    const sfha = attrs.SFHA_TF === 'T' || (floodZone ? SFHA_ZONES.has(floodZone) : false);
    const staticBfe = attrs.STATIC_BFE != null ? attrs.STATIC_BFE : null;

    return NextResponse.json({
      floodZone,
      sfha,
      zoneSubtype,
      staticBfe,
      lat,
      lng,
    });
  } catch (err: any) {
    console.error('[Flood Zone] Query failed:', err.message);
    return NextResponse.json(
      { error: err.message || 'Flood zone lookup failed' },
      { status: 502 },
    );
  }
}

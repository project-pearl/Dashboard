// app/api/firms/latest/route.ts
// Returns latest NASA FIRMS fire detection data.
// ?region=middle-east  → return region summary
// ?lat=X&lng=Y&radius=50 → return nearby detections

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import {
  ensureWarmed,
  getFirmsAllRegions,
  getFirmsForRegion,
  getFirmsNearPoint,
  getFirmsCacheStatus,
} from '@/lib/firmsCache';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await ensureWarmed();

  const { searchParams } = new URL(request.url);
  const region = searchParams.get('region');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const radius = searchParams.get('radius');

  const cacheStatus = getFirmsCacheStatus();

  // Nearby point query
  if (lat && lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    const radiusNum = parseFloat(radius || '50');
    if (isNaN(latNum) || isNaN(lngNum)) {
      return NextResponse.json({ error: 'Invalid lat/lng' }, { status: 400 });
    }
    const detections = getFirmsNearPoint(latNum, lngNum, radiusNum);
    return NextResponse.json({
      detections,
      count: detections.length,
      query: { lat: latNum, lng: lngNum, radiusMi: radiusNum },
      cache: cacheStatus,
    });
  }

  // Single region query
  if (region) {
    const data = getFirmsForRegion(region);
    if (!data) {
      return NextResponse.json({ error: `Region '${region}' not found`, cache: cacheStatus }, { status: 404 });
    }
    return NextResponse.json({ region: data, cache: cacheStatus });
  }

  // All regions summary
  const allRegions = getFirmsAllRegions();
  return NextResponse.json({
    regions: allRegions.map(r => ({
      region: r.region,
      label: r.label,
      detectionCount: r.detectionCount,
      highConfidenceCount: r.highConfidenceCount,
      maxFrp: r.maxFrp,
    })),
    totalDetections: allRegions.reduce((sum, r) => sum + r.detectionCount, 0),
    cache: cacheStatus,
  });
}

// app/api/firms/latest/route.ts
// Returns latest NASA FIRMS fire detection data.
// ?region=middle-east  → return region summary
// ?lat=X&lng=Y&radius=50 → return nearby detections

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import {
  ensureWarmed,
  ensureTrendWarmed,
  getFirmsAllRegions,
  getFirmsForRegion,
  getFirmsNearPoint,
  getFirmsCacheStatus,
  getFirmsTrendHistory,
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
  const wantTrends = searchParams.get('trends') === 'true';

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
      // Return empty region instead of 404 — cache may not be warm yet
      return NextResponse.json({
        region: { region, label: region, bbox: [0, 0, 0, 0], detectionCount: 0, highConfidenceCount: 0, maxFrp: 0, detections: [] },
        cache: cacheStatus,
      });
    }
    return NextResponse.json({ region: data, cache: cacheStatus });
  }

  // All regions summary
  const allRegions = getFirmsAllRegions();
  const dateSet = new Set<string>();
  for (const r of allRegions) {
    for (const d of r.detections) {
      if (d.acq_date) dateSet.add(d.acq_date);
    }
  }
  const distinctDates = [...dateSet].sort().reverse();

  let trendHistory: any = undefined;
  if (wantTrends) {
    await ensureTrendWarmed();
    trendHistory = getFirmsTrendHistory();
  }

  return NextResponse.json({
    regions: allRegions.map(r => ({
      region: r.region,
      label: r.label,
      detectionCount: r.detectionCount,
      highConfidenceCount: r.highConfidenceCount,
      maxFrp: r.maxFrp,
    })),
    totalDetections: allRegions.reduce((sum, r) => sum + r.detectionCount, 0),
    distinctDates,
    ...(trendHistory !== undefined ? { trendHistory } : {}),
    cache: cacheStatus,
  });
}

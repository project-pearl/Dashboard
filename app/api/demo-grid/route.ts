/**
 * /api/demo-grid — Public endpoint for the /demo command center.
 *
 * Returns USGS IV site coordinates as GeoJSON + ATTAINS impairment percentages
 * per state for the choropleth layer. No auth required.
 */

import { NextResponse } from 'next/server';
import { ensureWarmed as warmNwis, getExistingGrid, getUsgsIvCacheStatus } from '@/lib/nwisIvCache';
import { ensureWarmed as warmAttains, getAttainsCacheSummary } from '@/lib/attainsCache';

export const dynamic = 'force-dynamic';

const MAX_POINTS = 20_000;

export async function GET() {
  // Warm both caches in parallel
  await Promise.all([warmNwis(), warmAttains()]);

  // ── USGS IV sites → GeoJSON ──────────────────────────────────────────
  const grid = getExistingGrid();
  const ivStatus = getUsgsIvCacheStatus();

  const features: GeoJSON.Feature[] = [];
  const seen = new Set<string>();

  if (grid) {
    for (const cell of Object.values(grid)) {
      for (const site of cell.sites) {
        if (seen.has(site.siteNumber)) continue;
        seen.add(site.siteNumber);
        if (
          site.lat == null || site.lng == null ||
          !isFinite(site.lat) || !isFinite(site.lng)
        ) continue;
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [site.lng, site.lat] },
          properties: {
            id: site.siteNumber,
            name: site.siteName,
            state: site.state,
            siteType: site.siteType,
          },
        });
        if (features.length >= MAX_POINTS) break;
      }
      if (features.length >= MAX_POINTS) break;
    }
  }

  const sites: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  // ── ATTAINS impairment by state ──────────────────────────────────────
  const attainsSummary = getAttainsCacheSummary();
  const impairmentByState: Record<string, number> = {};

  for (const [st, summary] of Object.entries(attainsSummary.states)) {
    const total = summary.high + summary.medium + summary.low + summary.none;
    if (total > 0) {
      impairmentByState[st] = Math.round(
        ((summary.high + summary.medium) / total) * 100,
      );
    }
  }

  return NextResponse.json({
    sites,
    totalMonitoringPoints: ivStatus.loaded ? ivStatus.siteCount : features.length,
    lastUpdated: ivStatus.loaded ? ivStatus.built : new Date().toISOString(),
    impairmentByState,
  });
}

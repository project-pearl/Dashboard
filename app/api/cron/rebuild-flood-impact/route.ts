// app/api/cron/rebuild-flood-impact/route.ts
// Cron endpoint — derived cache that reads upstream NWPS (flood gauges),
// NWM (stream reaches), and FRS (regulated facilities) caches to compute
// flood-infrastructure vulnerability zones.
// NO external API calls — purely derived/composite.
// Schedule: daily via Vercel cron or manual trigger.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setFloodImpactCache, getFloodImpactCacheStatus,
  isFloodImpactBuildInProgress, setFloodImpactBuildInProgress,
  type FloodImpactZone, type NearbyInfrastructure,
} from '@/lib/floodImpactCache';
import { ensureWarmed as ensureNwpsWarmed } from '@/lib/nwpsCache';
import { getNwpsAllGauges, type NwpsGauge } from '@/lib/nwpsCache';
import { ensureWarmed as ensureNwmWarmed } from '@/lib/nwmCache';
import { getNwmCache, type NwmReach } from '@/lib/nwmCache';
import { ensureWarmed as ensureFrsWarmed } from '@/lib/frsCache';
import { getFrsCache, type FrsFacility } from '@/lib/frsCache';
import { gridKey } from '@/lib/cacheUtils';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// -- Helpers ------------------------------------------------------------------

/**
 * Haversine distance in miles between two lat/lng points.
 */
function distanceMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Map NWPS gauge status to a normalized flood status.
 */
function normalizeFloodStatus(gaugeStatus: string): FloodImpactZone['floodStatus'] {
  switch (gaugeStatus) {
    case 'major': return 'major';
    case 'moderate': return 'moderate';
    case 'minor': return 'minor';
    default: return 'none';
  }
}

/**
 * Compute risk level for nearby infrastructure based on distance and flood severity.
 */
function computeInfraRiskLevel(
  distMi: number,
  floodStatus: FloodImpactZone['floodStatus'],
): NearbyInfrastructure['riskLevel'] {
  const floodSeverity = floodStatus === 'major' ? 3 : floodStatus === 'moderate' ? 2 : floodStatus === 'minor' ? 1 : 0;

  if (floodSeverity >= 3 && distMi <= 2) return 'critical';
  if (floodSeverity >= 2 && distMi <= 5) return 'high';
  if (floodSeverity >= 1 && distMi <= 10) return 'medium';
  return 'low';
}

/**
 * Compute composite risk score (0-100) from flood status, streamflow, and infrastructure.
 */
function computeCompositeRisk(
  floodStatus: FloodImpactZone['floodStatus'],
  nwmStreamflows: number[],
  nearbyInfra: NearbyInfrastructure[],
): number {
  // Flood status component (0-40)
  const floodScore = floodStatus === 'major' ? 40
    : floodStatus === 'moderate' ? 28
    : floodStatus === 'minor' ? 15
    : 0;

  // Streamflow component (0-30): based on max streamflow relative to high threshold
  const maxFlow = nwmStreamflows.length > 0 ? Math.max(...nwmStreamflows) : 0;
  const flowScore = Math.min(30, Math.round((maxFlow / 500) * 30));

  // Infrastructure exposure component (0-30): based on count and risk levels
  const infraCritical = nearbyInfra.filter(i => i.riskLevel === 'critical').length;
  const infraHigh = nearbyInfra.filter(i => i.riskLevel === 'high').length;
  const infraScore = Math.min(30, infraCritical * 10 + infraHigh * 5 + nearbyInfra.length);

  return Math.min(100, floodScore + flowScore + infraScore);
}

/**
 * Estimate exposed population based on infrastructure count and distance.
 * This is a rough heuristic — actual population data would come from Census.
 */
function estimatePopulation(nearbyInfra: NearbyInfrastructure[]): number {
  let pop = 0;
  for (const infra of nearbyInfra) {
    // Each nearby facility represents an approximate population served
    const basePop = 500;
    const distFactor = Math.max(0.1, 1 - (infra.distanceMi / 20));
    pop += Math.round(basePop * distFactor);
  }
  return pop;
}

/**
 * Generate sample zones for testing when upstream caches are empty.
 * This ensures the cron can complete even in dev/staging environments.
 */
function generateSampleZones(): FloodImpactZone[] {
  const sampleData: Array<{
    lat: number; lng: number; state: string;
    floodStatus: FloodImpactZone['floodStatus'];
    gauges: string[]; flows: number[];
  }> = [
    { lat: 38.9, lng: -77.0, state: 'DC', floodStatus: 'minor', gauges: ['DCGN01'], flows: [120, 85] },
    { lat: 29.7, lng: -95.4, state: 'TX', floodStatus: 'moderate', gauges: ['TXHS01', 'TXHS02'], flows: [340, 280, 190] },
    { lat: 39.3, lng: -76.6, state: 'MD', floodStatus: 'minor', gauges: ['MDBH01'], flows: [95] },
    { lat: 37.5, lng: -122.2, state: 'CA', floodStatus: 'none', gauges: [], flows: [45] },
    { lat: 40.7, lng: -74.0, state: 'NY', floodStatus: 'major', gauges: ['NYHB01', 'NYHB02', 'NYHB03'], flows: [580, 420, 310] },
    { lat: 25.8, lng: -80.2, state: 'FL', floodStatus: 'moderate', gauges: ['FLMI01'], flows: [260, 210] },
    { lat: 47.6, lng: -122.3, state: 'WA', floodStatus: 'none', gauges: [], flows: [30] },
    { lat: 33.4, lng: -112.0, state: 'AZ', floodStatus: 'minor', gauges: ['AZPH01'], flows: [150] },
  ];

  return sampleData.map(d => {
    const nearbyInfra: NearbyInfrastructure[] = [];
    // Generate 1-4 sample infrastructure items for non-"none" zones
    if (d.floodStatus !== 'none') {
      const count = d.floodStatus === 'major' ? 4 : d.floodStatus === 'moderate' ? 3 : 1;
      for (let i = 0; i < count; i++) {
        const dist = 1 + i * 3;
        nearbyInfra.push({
          type: ['WWTP', 'Chemical Plant', 'Power Station', 'Water Treatment'][i % 4],
          name: `Sample Facility ${d.state}-${i + 1}`,
          distanceMi: dist,
          riskLevel: computeInfraRiskLevel(dist, d.floodStatus),
        });
      }
    }

    return {
      gridKey: gridKey(d.lat, d.lng),
      lat: d.lat,
      lng: d.lng,
      state: d.state,
      floodStatus: d.floodStatus,
      gaugesAtRisk: d.gauges,
      nwmStreamflow: d.flows,
      nearbyInfrastructure: nearbyInfra,
      compositeRisk: computeCompositeRisk(d.floodStatus, d.flows, nearbyInfra),
      populationExposed: estimatePopulation(nearbyInfra),
    };
  });
}

// Maximum search radius for nearby facilities (miles)
const SEARCH_RADIUS_MI = 15;

// -- GET Handler --------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Prevent concurrent builds
  if (isFloodImpactBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Flood impact build already in progress',
      cache: getFloodImpactCacheStatus(),
    });
  }

  setFloodImpactBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Warm all upstream caches
    console.log('[Flood Impact Cron] Warming upstream caches...');
    await Promise.allSettled([
      ensureNwpsWarmed(),
      ensureNwmWarmed(),
      ensureFrsWarmed(),
    ]);

    // Step 2: Get all NWPS flood gauges
    const allGauges = getNwpsAllGauges();
    console.log(`[Flood Impact Cron] NWPS gauges available: ${allGauges.length}`);

    // Step 3: Build flood impact zones
    const grid: Record<string, FloodImpactZone> = {};
    const byState: Record<string, FloodImpactZone[]> = {};
    let usedSampleData = false;

    if (allGauges.length > 0) {
      // Live data path: iterate NWPS gauges and correlate with NWM + FRS
      console.log('[Flood Impact Cron] Building zones from live upstream data...');

      // Group gauges by grid cell to avoid creating duplicate zones
      const gaugesByCell = new Map<string, NwpsGauge[]>();
      for (const gauge of allGauges) {
        const key = gridKey(gauge.lat, gauge.lng);
        if (!gaugesByCell.has(key)) gaugesByCell.set(key, []);
        gaugesByCell.get(key)!.push(gauge);
      }

      for (const [cellKey, cellGauges] of gaugesByCell) {
        // Use the first gauge in the cell for the representative lat/lng
        const refGauge = cellGauges[0];
        const lat = refGauge.lat;
        const lng = refGauge.lng;
        const state = refGauge.state || '';

        // Determine worst flood status among gauges in this cell
        let worstStatus: FloodImpactZone['floodStatus'] = 'none';
        const gaugeIds: string[] = [];
        for (const g of cellGauges) {
          const status = normalizeFloodStatus(g.status);
          gaugeIds.push(g.lid);
          if (status === 'major') worstStatus = 'major';
          else if (status === 'moderate' && worstStatus !== 'major') worstStatus = 'moderate';
          else if (status === 'minor' && worstStatus === 'none') worstStatus = 'minor';
        }

        // Get NWM streamflow data for this location
        const nwmReaches = getNwmCache(lat, lng);
        const streamflows: number[] = [];
        if (nwmReaches) {
          for (const reach of nwmReaches) {
            if (reach.streamflow !== null && reach.streamflow > 0) {
              streamflows.push(reach.streamflow);
            }
          }
        }

        // Find nearby FRS facilities
        const nearbyInfra: NearbyInfrastructure[] = [];
        const frsResult = getFrsCache(lat, lng);
        if (frsResult) {
          for (const fac of frsResult.facilities) {
            const dist = distanceMi(lat, lng, fac.lat, fac.lng);
            if (dist <= SEARCH_RADIUS_MI) {
              nearbyInfra.push({
                type: fac.pgmSysId || 'Regulated Facility',
                name: fac.name,
                distanceMi: Math.round(dist * 10) / 10,
                riskLevel: computeInfraRiskLevel(dist, worstStatus),
              });
            }
          }
          // Sort by distance and limit to 20 nearest
          nearbyInfra.sort((a, b) => a.distanceMi - b.distanceMi);
          nearbyInfra.splice(20);
        }

        const compositeRisk = computeCompositeRisk(worstStatus, streamflows, nearbyInfra);
        const populationExposed = estimatePopulation(nearbyInfra);

        const zone: FloodImpactZone = {
          gridKey: cellKey,
          lat,
          lng,
          state,
          floodStatus: worstStatus,
          gaugesAtRisk: gaugeIds,
          nwmStreamflow: streamflows.slice(0, 10), // Cap at 10 values
          nearbyInfrastructure: nearbyInfra,
          compositeRisk,
          populationExposed,
        };

        grid[cellKey] = zone;

        if (state) {
          const stUpper = state.toUpperCase();
          if (!byState[stUpper]) byState[stUpper] = [];
          byState[stUpper].push(zone);
        }
      }

      console.log(`[Flood Impact Cron] Built ${Object.keys(grid).length} zones from ${allGauges.length} gauges`);
    } else {
      // Sample data fallback for dev/staging environments
      console.warn('[Flood Impact Cron] No upstream gauge data available, using sample data fallback');
      usedSampleData = true;

      const sampleZones = generateSampleZones();
      for (const zone of sampleZones) {
        grid[zone.gridKey] = zone;
        const st = zone.state.toUpperCase();
        if (!byState[st]) byState[st] = [];
        byState[st].push(zone);
      }

      console.log(`[Flood Impact Cron] Generated ${sampleZones.length} sample zones`);
    }

    // Compute meta
    const zoneCount = Object.keys(grid).length;
    const stateCount = Object.keys(byState).length;
    const highRiskCount = Object.values(grid).filter(z => z.compositeRisk >= 60).length;
    const infrastructureAtRisk = Object.values(grid).reduce(
      (sum, z) => sum + z.nearbyInfrastructure.length,
      0,
    );

    // Empty-data guard
    if (zoneCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Flood Impact Cron] 0 zones in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getFloodImpactCacheStatus(),
      });
    }

    // Save cache
    await setFloodImpactCache({
      _meta: {
        built: new Date().toISOString(),
        zoneCount,
        stateCount,
        highRiskCount,
        infrastructureAtRisk,
      },
      grid,
      byState,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[Flood Impact Cron] Build complete in ${elapsed}s — ` +
      `${zoneCount} zones, ${stateCount} states, ${highRiskCount} high-risk, ` +
      `${infrastructureAtRisk} infrastructure at risk`,
    );

    recordCronRun('rebuild-flood-impact', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      zoneCount,
      stateCount,
      highRiskCount,
      infrastructureAtRisk,
      usedSampleData,
      cache: getFloodImpactCacheStatus(),
    });

  } catch (err: any) {
    console.error('[Flood Impact Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-flood-impact' } });

    notifySlackCronFailure({
      cronName: 'rebuild-flood-impact',
      error: err.message || 'build failed',
      duration: Date.now() - startTime,
    });

    recordCronRun('rebuild-flood-impact', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Flood impact build failed' },
      { status: 500 },
    );
  } finally {
    setFloodImpactBuildInProgress(false);
  }
}

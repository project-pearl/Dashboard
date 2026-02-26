// app/api/cache-status/route.ts
// Unified cache status endpoint — returns last-built timestamps, record counts,
// and staleness flags for all 12 cache modules.

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { getWqpCacheStatus, ensureWarmed as warmWqp } from '@/lib/wqpCache';
import { getCacheStatus as getAttainsCacheStatus, ensureWarmed as warmAttains } from '@/lib/attainsCache';
import { getCedenCacheStatus, ensureWarmed as warmCeden } from '@/lib/cedenCache';
import { getIcisCacheStatus, ensureWarmed as warmIcis } from '@/lib/icisCache';
import { getSdwisCacheStatus, ensureWarmed as warmSdwis } from '@/lib/sdwisCache';
import { getNwisGwCacheStatus, ensureWarmed as warmNwisGw } from '@/lib/nwisGwCache';
import { getEchoCacheStatus, ensureWarmed as warmEcho } from '@/lib/echoCache';
import { getFrsCacheStatus, ensureWarmed as warmFrs } from '@/lib/frsCache';
import { getPfasCacheStatus, ensureWarmed as warmPfas } from '@/lib/pfasCache';
import { getCacheStatus as getInsightsCacheStatus, ensureWarmed as warmInsights } from '@/lib/insightsCache';
import { getStateReportStatus, ensureWarmed as warmStateReports } from '@/lib/stateReportCache';
import { getBwbCacheStatus, ensureWarmed as warmBwb } from '@/lib/bwbCache';
import { getCdcNwssCacheStatus, ensureWarmed as warmCdcNwss } from '@/lib/cdcNwssCache';
import { getNdbcCacheStatus, ensureWarmed as warmNdbc } from '@/lib/ndbcCache';
import { getNasaCmrCacheStatus, ensureWarmed as warmNasaCmr } from '@/lib/nasaCmrCache';
import { getNarsCacheStatus, ensureWarmed as warmNars } from '@/lib/narsCache';
import { getDataGovCacheStatus, ensureWarmed as warmDataGov } from '@/lib/dataGovCache';
import { getUsaceCacheStatus, ensureWarmed as warmUsace } from '@/lib/usaceCache';
import { getStateIRCacheStatus } from '@/lib/stateIRCache';
import { getUsgsIvCacheStatus, ensureWarmed as warmNwisIv } from '@/lib/nwisIvCache';
import { getAlertCacheStatus, ensureWarmed as warmUsgsAlerts } from '@/lib/usgsAlertCache';
import { getNwsAlertCacheStatus, ensureWarmed as warmNwsAlerts } from '@/lib/nwsAlertCache';
import { getNwpsCacheStatus, ensureWarmed as warmNwps } from '@/lib/nwpsCache';
import { getCoopsCacheStatus, ensureWarmed as warmCoops } from '@/lib/coopsCache';
import { getSnotelCacheStatus, ensureWarmed as warmSnotel } from '@/lib/snotelCache';
import { getTriCacheStatus, ensureWarmed as warmTri } from '@/lib/triCache';

function staleness(built: string | null | undefined): { stale: boolean; ageHours: number | null } {
  if (!built) return { stale: true, ageHours: null };
  const ageMs = Date.now() - new Date(built).getTime();
  const ageHours = Math.round(ageMs / (1000 * 60 * 60) * 10) / 10;
  return { stale: ageHours > 48, ageHours };
}

export async function GET() {
  // Warm caches from blob storage in batches of 6 (avoid overwhelming network)
  const warmBatches = [
    [warmWqp, warmAttains, warmCeden, warmIcis, warmSdwis, warmNwisGw],
    [warmEcho, warmFrs, warmPfas, warmInsights, warmStateReports, warmBwb],
    [warmCdcNwss, warmNdbc, warmNasaCmr, warmNars, warmDataGov, warmUsace],
    [warmNwisIv, warmUsgsAlerts, warmNwsAlerts, warmNwps, warmCoops, warmSnotel],
    [warmTri],
  ];
  for (const batch of warmBatches) {
    await Promise.allSettled(batch.map(fn => fn()));
  }

  const wqp = getWqpCacheStatus();
  const attains = getAttainsCacheStatus();
  const ceden = getCedenCacheStatus();
  const icis = getIcisCacheStatus();
  const sdwis = getSdwisCacheStatus();
  const nwisGw = getNwisGwCacheStatus();
  const echo = getEchoCacheStatus();
  const frs = getFrsCacheStatus();
  const pfas = getPfasCacheStatus();
  const insights = getInsightsCacheStatus();
  const stateReports = getStateReportStatus();
  const bwb = getBwbCacheStatus();
  const cdcNwss = getCdcNwssCacheStatus();
  const ndbc = getNdbcCacheStatus();
  const nasaCmr = getNasaCmrCacheStatus();
  const nars = getNarsCacheStatus();
  const dataGov = getDataGovCacheStatus();
  const usace = getUsaceCacheStatus();
  const stateIR = getStateIRCacheStatus();
  const nwisIv = getUsgsIvCacheStatus();
  const usgsAlerts = getAlertCacheStatus();
  const nwsAlerts = getNwsAlertCacheStatus();
  const nwps = getNwpsCacheStatus();
  const coops = getCoopsCacheStatus();
  const snotel = getSnotelCacheStatus();
  const tri = getTriCacheStatus();

  const caches = {
    wqp: {
      ...wqp,
      ...staleness(wqp.loaded ? (wqp as any).built : null),
    },
    attains: {
      loaded: attains.status !== 'cold',
      source: attains.source,
      status: attains.status,
      statesLoaded: attains.statesLoaded.length,
      statesMissing: attains.statesMissing.length,
      ...staleness(attains.lastBuilt),
    },
    ceden: {
      ...ceden,
      ...staleness(ceden.loaded ? (ceden as any).built : null),
    },
    icis: {
      ...icis,
      ...staleness(icis.loaded ? (icis as any).built : null),
    },
    sdwis: {
      ...sdwis,
      ...staleness(sdwis.loaded ? (sdwis as any).built : null),
    },
    nwisGw: {
      ...nwisGw,
      ...staleness(nwisGw.loaded ? (nwisGw as any).built : null),
    },
    echo: {
      ...echo,
      ...staleness(echo.loaded ? (echo as any).built : null),
    },
    frs: {
      ...frs,
      ...staleness(frs.loaded ? (frs as any).built : null),
    },
    pfas: {
      ...pfas,
      ...staleness(pfas.loaded ? (pfas as any).built : null),
    },
    insights: {
      ...insights,
      ...staleness(insights.lastFullBuild),
    },
    stateReports: {
      ...stateReports,
      ...staleness(stateReports.built),
    },
    bwb: {
      ...bwb,
      ...staleness(bwb.loaded ? (bwb as any).built : null),
    },
    cdcNwss: {
      ...cdcNwss,
      ...staleness(cdcNwss.loaded ? (cdcNwss as any).built : null),
    },
    ndbc: {
      ...ndbc,
      ...staleness(ndbc.loaded ? (ndbc as any).built : null),
    },
    nasaCmr: {
      ...nasaCmr,
      ...staleness(nasaCmr.loaded ? (nasaCmr as any).built : null),
    },
    nars: {
      ...nars,
      ...staleness(nars.loaded ? (nars as any).built : null),
    },
    dataGov: {
      ...dataGov,
      ...staleness(dataGov.loaded ? (dataGov as any).built : null),
    },
    usace: {
      ...usace,
      ...staleness(usace.loaded ? (usace as any).built : null),
    },
    stateIR: {
      ...stateIR,
      ...staleness(stateIR.loaded ? (stateIR as any).generated : null),
    },
    nwisIv: {
      ...nwisIv,
      ...staleness(nwisIv.loaded ? (nwisIv as any).built : null),
    },
    usgsAlerts: {
      ...usgsAlerts,
      ...staleness(usgsAlerts.loaded ? (usgsAlerts as any).built : null),
    },
    nwsAlerts: {
      ...nwsAlerts,
      ...staleness(nwsAlerts.loaded ? (nwsAlerts as any).built : null),
    },
    nwps: {
      ...nwps,
      ...staleness(nwps.loaded ? (nwps as any).built : null),
    },
    coops: {
      ...coops,
      ...staleness(coops.loaded ? (coops as any).built : null),
    },
    snotel: {
      ...snotel,
      ...staleness(snotel.loaded ? (snotel as any).built : null),
    },
    tri: {
      ...tri,
      ...staleness(tri.loaded ? (tri as any).built : null),
    },
  };

  const loadedCount = Object.values(caches).filter((c: any) => c.loaded !== false && c.status !== 'cold' && c.status !== 'idle').length;
  const staleCount = Object.values(caches).filter((c: any) => c.stale).length;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    summary: {
      total: Object.keys(caches).length,
      loaded: loadedCount,
      stale: staleCount,
    },
    caches,
  });
}

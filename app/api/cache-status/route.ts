// app/api/cache-status/route.ts
// Unified cache status endpoint — returns last-built timestamps, record counts,
// and staleness flags for all 12 cache modules.

import { NextResponse } from 'next/server';
import { getWqpCacheStatus } from '@/lib/wqpCache';
import { getCacheStatus as getAttainsCacheStatus } from '@/lib/attainsCache';
import { getCedenCacheStatus } from '@/lib/cedenCache';
import { getIcisCacheStatus } from '@/lib/icisCache';
import { getSdwisCacheStatus } from '@/lib/sdwisCache';
import { getNwisGwCacheStatus } from '@/lib/nwisGwCache';
import { getEchoCacheStatus } from '@/lib/echoCache';
import { getFrsCacheStatus } from '@/lib/frsCache';
import { getPfasCacheStatus } from '@/lib/pfasCache';
import { getCacheStatus as getInsightsCacheStatus } from '@/lib/insightsCache';
import { getStateReportStatus } from '@/lib/stateReportCache';
import { getBwbCacheStatus } from '@/lib/bwbCache';
import { getStateIRCacheStatus } from '@/lib/stateIRCache';

function staleness(built: string | null | undefined): { stale: boolean; ageHours: number | null } {
  if (!built) return { stale: true, ageHours: null };
  const ageMs = Date.now() - new Date(built).getTime();
  const ageHours = Math.round(ageMs / (1000 * 60 * 60) * 10) / 10;
  return { stale: ageHours > 48, ageHours };
}

export async function GET() {
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
  const stateIR = getStateIRCacheStatus();

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
    stateIR: {
      ...stateIR,
      ...staleness(stateIR.loaded ? (stateIR as any).generated : null),
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

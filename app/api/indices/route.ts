import { NextResponse } from 'next/server';
import {
  ensureWarmed,
  getIndicesForHuc,
  getAllIndices,
  getCacheStatus,
} from '@/lib/indices/indicesCache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/indices
 *   ?state=MD             → all HUC indices for a state
 *   ?huc8=02070001        → single HUC detail
 *   ?top=10&sort=composite → top-N riskiest HUCs
 */
export async function GET(request: Request) {
  await ensureWarmed();

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const huc8 = searchParams.get('huc8');
  const top = searchParams.get('top');
  const sort = searchParams.get('sort') || 'composite';

  const cacheStatus = getCacheStatus();

  // Single HUC lookup
  if (huc8) {
    const indices = getIndicesForHuc(huc8);
    if (!indices) {
      return NextResponse.json({ hucIndices: [], meta: { ...cacheStatus, totalHucs: 0 } });
    }
    return NextResponse.json({
      hucIndices: [indices],
      meta: { ...cacheStatus, totalHucs: 1 },
    });
  }

  let allIndices = getAllIndices();

  // Filter by state
  if (state) {
    allIndices = allIndices.filter(h => h.stateAbbr === state.toUpperCase());
  }

  // Sort
  if (sort === 'composite') {
    allIndices.sort((a, b) => b.composite - a.composite);
  } else if (sort === 'confidence') {
    allIndices.sort((a, b) => b.compositeConfidence - a.compositeConfidence);
  }

  // Top-N
  if (top) {
    const n = parseInt(top, 10);
    if (!Number.isNaN(n) && n > 0) {
      allIndices = allIndices.slice(0, n);
    }
  }

  return NextResponse.json({
    hucIndices: allIndices,
    meta: {
      ...cacheStatus,
      totalHucs: allIndices.length,
    },
  });
}

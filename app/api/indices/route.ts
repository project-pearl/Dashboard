import { NextResponse } from 'next/server';
import {
  ensureWarmed,
  getIndicesForHuc,
  getIndicesForHuc8,
  getAllIndices,
  getCacheStatus,
  getStateCompositeScore,
  getAllStateCompositeScores,
} from '@/lib/indices/indicesCache';
import { scoreToLetter } from '@/lib/waterQualityScore';

export const dynamic = 'force-dynamic';

/**
 * GET /api/indices
 *   ?state=MD                   → all HUC indices for a state
 *   ?huc12=020700020301         → single HUC-12 detail
 *   ?huc8=02070001              → all HUC-12s within HUC-8 (backwards compat)
 *   ?top=10&sort=composite      → top-N riskiest HUCs
 */
export async function GET(request: Request) {
  await ensureWarmed();

  const { searchParams } = new URL(request.url);
  const state = searchParams.get('state');
  const huc8 = searchParams.get('huc8');
  const huc12 = searchParams.get('huc12');
  const top = searchParams.get('top');
  const sort = searchParams.get('sort') || 'composite';

  const stateScores = searchParams.get('stateScores');
  const cacheStatus = getCacheStatus();

  // State composite scores (lightweight aggregate)
  if (stateScores === 'true') {
    const stateFilter = state?.toUpperCase();
    if (stateFilter) {
      const sc = getStateCompositeScore(stateFilter);
      return NextResponse.json({
        stateScores: sc
          ? { [stateFilter]: { ...sc, grade: scoreToLetter(sc.score) } }
          : {},
        meta: cacheStatus,
      });
    }
    const all = getAllStateCompositeScores();
    const withGrades: Record<string, any> = {};
    for (const [abbr, s] of Object.entries(all)) {
      withGrades[abbr] = { ...s, grade: scoreToLetter(s.score) };
    }
    return NextResponse.json({ stateScores: withGrades, meta: cacheStatus });
  }

  // Single HUC-12 lookup
  if (huc12) {
    const indices = getIndicesForHuc(huc12);
    if (!indices) {
      return NextResponse.json({ hucIndices: [], meta: { ...cacheStatus, totalHucs: 0 } });
    }
    return NextResponse.json({
      hucIndices: [indices],
      meta: { ...cacheStatus, totalHucs: 1 },
    });
  }

  // HUC-8 lookup (backwards compatibility - returns all HUC-12s within that HUC-8)
  if (huc8) {
    const indices = getIndicesForHuc8(huc8);
    return NextResponse.json({
      hucIndices: indices,
      meta: { ...cacheStatus, totalHucs: indices.length },
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

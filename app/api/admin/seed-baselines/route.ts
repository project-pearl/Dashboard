export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized } from '@/lib/apiAuth';
import {
  updateBaseline,
  persistBaselines,
  getAllBaselines,
  ensureWarmed,
} from '@/lib/sentinel/parameterBaselines';

/**
 * POST /api/admin/seed-baselines?state=DC&days=30
 *
 * Fetches historical USGS IV data and feeds values through the Welford
 * baseline algorithm so baselines start with count > 10 instead of cold.
 */

const SEED_PARAMS: Record<string, string> = {
  '00300': 'DO',
  '00095': 'conductivity',
  '63680': 'turbidity',
  '00400': 'pH',
  '00010': 'temperature',
};
const PARAM_CODES = Object.keys(SEED_PARAMS).join(',');

interface UsgsTimeSeries {
  sourceInfo: {
    siteCode: { value: string }[];
    siteProperty: { name: string; value: string }[];
  };
  variable: {
    variableCode: { value: string }[];
    noDataValue: number;
  };
  values: { value: { value: string; dateTime: string }[] }[];
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const state = request.nextUrl.searchParams.get('state') || 'DC';
  const days = Math.min(Number(request.nextUrl.searchParams.get('days')) || 30, 90);

  await ensureWarmed();

  const errors: string[] = [];
  let totalSamples = 0;

  try {
    const url =
      `https://waterservices.usgs.gov/nwis/iv/?format=json` +
      `&stateCd=${encodeURIComponent(state)}` +
      `&parameterCd=${PARAM_CODES}` +
      `&period=P${days}D` +
      `&siteStatus=active` +
      `&siteType=ST,LK,ES`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      errors.push(`USGS API returned ${res.status}: ${res.statusText}`);
      return NextResponse.json({ totalSamples: 0, baselineCount: 0, warmedBaselines: 0, errors });
    }

    const json = await res.json();
    const timeSeries: UsgsTimeSeries[] = json?.value?.timeSeries ?? [];

    for (const ts of timeSeries) {
      const paramCd = ts.variable?.variableCode?.[0]?.value;
      if (!paramCd || !SEED_PARAMS[paramCd]) continue;

      const hucProp = ts.sourceInfo?.siteProperty?.find(
        (p: { name: string }) => p.name === 'hucCd',
      );
      const huc8 = hucProp?.value?.slice(0, 8);
      if (!huc8 || huc8.length !== 8) continue;

      const noData = ts.variable.noDataValue;
      const readings = ts.values?.[0]?.value ?? [];

      for (const r of readings) {
        const val = parseFloat(r.value);
        if (isNaN(val) || val === noData) continue;
        updateBaseline(huc8, paramCd, val);
        totalSamples++;
      }
    }
  } catch (err) {
    errors.push(String(err));
  }

  await persistBaselines();

  const allBaselines = getAllBaselines();
  const baselineCount = Object.keys(allBaselines).length;
  const warmedBaselines = Object.values(allBaselines).filter(b => b.count >= 10).length;

  return NextResponse.json({
    totalSamples,
    baselineCount,
    warmedBaselines,
    errors,
  });
}

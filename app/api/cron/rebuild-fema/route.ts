// app/api/cron/rebuild-fema/route.ts
// Cron endpoint — fetches FEMA disaster declarations for the last 90 days,
// filters to water-relevant incident types, groups by state.
// Schedule: daily at 3:00 AM UTC.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setFemaCache, getFemaCacheStatus,
  isFemaBuildInProgress, setFemaBuildInProgress,
  type FemaDeclaration,
} from '@/lib/femaCache';

// ── Config ───────────────────────────────────────────────────────────────────

const FEMA_API = 'https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries';
const FETCH_TIMEOUT_MS = 30_000;

/** Incident types relevant to water quality (from sentinel femaAdapter) */
const WATER_INCIDENT_TYPES = new Set([
  'Flood', 'Hurricane', 'Severe Storm(s)', 'Typhoon',
  'Coastal Storm', 'Dam/Levee Break', 'Tornado',
  'Tropical Storm', 'Severe Ice Storm',
]);

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isFemaBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'FEMA build already in progress',
      cache: getFemaCacheStatus(),
    });
  }

  setFemaBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Fetch last 90 days of declarations
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const filterDate = `${String(ninetyDaysAgo.getFullYear())}-${String(ninetyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(ninetyDaysAgo.getDate()).padStart(2, '0')}`;

    const params = new URLSearchParams({
      '$filter': `declarationDate ge '${filterDate}'`,
      '$select': 'disasterNumber,state,declarationDate,incidentType,declarationTitle,declarationType,designatedArea,fipsStateCode,fipsCountyCode',
      '$orderby': 'declarationDate desc',
      '$top': '1000',
    });

    const res = await fetch(`${FEMA_API}?${params}`, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`FEMA API returned ${res.status}`);
    }

    const data = await res.json();
    const rawDeclarations = (data?.DisasterDeclarationsSummaries ?? []) as any[];

    // Filter to water-relevant types and map to FemaDeclaration
    const declarations: FemaDeclaration[] = [];
    for (const d of rawDeclarations) {
      const incidentType = d.incidentType ?? '';
      if (!WATER_INCIDENT_TYPES.has(incidentType)) continue;

      declarations.push({
        disasterNumber: d.disasterNumber ?? 0,
        state: d.state ?? '',
        declarationDate: d.declarationDate ?? '',
        incidentType,
        declarationTitle: d.declarationTitle ?? '',
        declarationType: d.declarationType ?? '',
        designatedArea: d.designatedArea ?? '',
        fipsStateCode: d.fipsStateCode ?? '',
        fipsCountyCode: d.fipsCountyCode ?? '',
      });
    }

    // Empty-data guard
    if (declarations.length === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[FEMA Cron] No water-relevant declarations found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        rawCount: rawDeclarations.length,
        cache: getFemaCacheStatus(),
      });
    }

    // Group by state
    const declsByState: Record<string, { declarations: FemaDeclaration[]; fetched: string }> = {};
    const now = new Date().toISOString();
    for (const d of declarations) {
      if (!d.state) continue;
      if (!declsByState[d.state]) {
        declsByState[d.state] = { declarations: [], fetched: now };
      }
      declsByState[d.state].declarations.push(d);
    }

    await setFemaCache(declsByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[FEMA Cron] Complete in ${elapsed}s — ${declarations.length} water declarations across ${Object.keys(declsByState).length} states`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalDeclarations: declarations.length,
      statesFetched: Object.keys(declsByState).length,
      rawCount: rawDeclarations.length,
      cache: getFemaCacheStatus(),
    });

  } catch (err: any) {
    console.error('[FEMA Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'FEMA build failed' },
      { status: 500 },
    );
  } finally {
    setFemaBuildInProgress(false);
  }
}

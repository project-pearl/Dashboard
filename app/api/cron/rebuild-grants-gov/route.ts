// app/api/cron/rebuild-grants-gov/route.ts
// Cron endpoint — fetches environmental grant opportunities from Grants.gov API.
// Uses search2 + fetchOpportunity endpoints (no API key needed — both are open).
// Schedule: daily at 19:00 UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setGrantsGovCache, getGrantsGovCacheStatus,
  isGrantsGovBuildInProgress, setGrantsGovBuildInProgress,
  type GrantsGovOpportunity,
} from '@/lib/grantsGovCache';

// ── Config ───────────────────────────────────────────────────────────────────

const SEARCH_URL = 'https://api.grants.gov/v1/api/search2';
const DETAIL_URL = 'https://api.grants.gov/v1/api/fetchOpportunity';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 4;
const BATCH_DELAY_MS = 500;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 4000, 8000];

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500);
}

async function fetchWithRetry(url: string, body: unknown): Promise<any> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.status === 429 && attempt < MAX_RETRIES) {
        console.warn(`[GrantsGov Cron] 429 on attempt ${attempt + 1}, retrying in ${RETRY_DELAYS[attempt]}ms`);
        await delay(RETRY_DELAYS[attempt]);
        continue;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
      }
      return await res.json();
    } catch (e) {
      if (attempt === MAX_RETRIES) throw e;
      console.warn(`[GrantsGov Cron] Attempt ${attempt + 1} failed: ${e instanceof Error ? e.message : e}`);
      await delay(RETRY_DELAYS[attempt]);
    }
  }
}

// Semaphore for concurrent detail fetches
async function runWithSemaphore<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  let idx = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (idx < tasks.length) {
      const i = idx++;
      results[i] = await tasks[i]();
      if (i % concurrency === concurrency - 1) await delay(BATCH_DELAY_MS);
    }
  });
  await Promise.all(workers);
  return results;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isGrantsGovBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Grants.gov build already in progress',
      cache: getGrantsGovCacheStatus(),
    });
  }

  setGrantsGovBuildInProgress(true);
  const startTime = Date.now();

  try {
    // Step 1: Search for environmental grants
    console.log('[GrantsGov Cron] Searching for environmental grants...');
    const allHits: any[] = [];
    let startRecord = 0;
    const pageSize = 100;

    while (true) {
      const searchBody = {
        fundingCategories: 'ENV|NR',
        oppStatuses: 'posted|forecasted',
        rows: pageSize,
        startRecordNum: startRecord,
      };
      const searchResult = await fetchWithRetry(SEARCH_URL, searchBody);
      const hits = searchResult?.oppHits || [];
      allHits.push(...hits);
      const totalHits = searchResult?.hitCount || 0;
      console.log(`[GrantsGov Cron] Page at offset ${startRecord}: ${hits.length} hits (total: ${totalHits})`);

      if (allHits.length >= totalHits || hits.length === 0) break;
      startRecord += pageSize;
      await delay(BATCH_DELAY_MS);
    }

    console.log(`[GrantsGov Cron] Found ${allHits.length} opportunities, fetching details...`);

    // Step 2: Enrich each opportunity with detail API
    const detailTasks = allHits.map(hit => async (): Promise<GrantsGovOpportunity | null> => {
      try {
        const oppId = String(hit.id || hit.opportunityId || '');
        if (!oppId) return null;

        const detail = await fetchWithRetry(DETAIL_URL, { opportunityId: Number(oppId) });
        const opp = detail?.opportunity || detail || {};
        const synopsis = opp.synopsis || {};
        const cfdaList = (opp.cfdas || []).map((c: any) => c.cfdaNumber || c.cfda || '').filter(Boolean);
        const eligibilities = (opp.eligibilities || []).map((e: any) => e.description || e.eligibility || '').filter(Boolean);

        return {
          opportunityId: oppId,
          opportunityNumber: hit.number || opp.number || '',
          title: hit.title || opp.title || '',
          agency: hit.agency || opp.owningAgency?.name || '',
          agencyCode: hit.agencyCode || opp.owningAgency?.code || '',
          fundingCategory: hit.fundingCategory || synopsis.fundingActivityCategory || '',
          status: (hit.oppStatus || opp.status || '').toLowerCase(),
          openDate: hit.openDate || synopsis.postingDate || '',
          closeDate: hit.closeDate || synopsis.responseDate || synopsis.archiveDate || '',
          awardFloor: Number(synopsis.awardFloor) || 0,
          awardCeiling: Number(synopsis.awardCeiling) || 0,
          estimatedFunding: Number(synopsis.estimatedFunding) || 0,
          description: stripHtml(synopsis.synopsisDesc || synopsis.description || ''),
          cfdaList,
          eligibilities,
          url: `https://grants.gov/search-results-detail/${oppId}`,
        };
      } catch (e) {
        console.warn(`[GrantsGov Cron] Detail fetch failed for ${hit.id}: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    });

    const results = await runWithSemaphore(detailTasks, CONCURRENCY);
    const opportunities: Record<string, GrantsGovOpportunity> = {};
    let postedCount = 0;
    let forecastedCount = 0;

    for (const opp of results) {
      if (!opp) continue;
      opportunities[opp.opportunityId] = opp;
      if (opp.status === 'posted') postedCount++;
      else if (opp.status === 'forecasted') forecastedCount++;
    }

    const oppCount = Object.keys(opportunities).length;
    console.log(`[GrantsGov Cron] Enriched ${oppCount} opportunities (${postedCount} posted, ${forecastedCount} forecasted)`);

    // Empty-data guard
    if (oppCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[GrantsGov Cron] 0 opportunities in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s`, cache: getGrantsGovCacheStatus() });
    }

    await setGrantsGovCache(opportunities, {
      built: new Date().toISOString(),
      opportunityCount: oppCount,
      postedCount,
      forecastedCount,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GrantsGov Cron] Built in ${elapsed}s — ${oppCount} opportunities`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      opportunities: oppCount,
      posted: postedCount,
      forecasted: forecastedCount,
      cache: getGrantsGovCacheStatus(),
    });

  } catch (err: any) {
    console.error('[GrantsGov Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Grants.gov build failed' },
      { status: 500 },
    );
  } finally {
    setGrantsGovBuildInProgress(false);
  }
}

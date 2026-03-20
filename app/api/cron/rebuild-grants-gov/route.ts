// app/api/cron/rebuild-grants-gov/route.ts
// Cron endpoint — fetches environmental grant opportunities from Grants.gov API.
// Uses search2 + fetchOpportunity endpoints (no API key needed — both are open).
// Schedule: daily at 19:00 UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setGrantCache, getBuildStatus, setBuildInProgress, addGrantOpportunity,
  type GrantOpportunity,
} from '@/lib/grantCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

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
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const buildStatus = getBuildStatus();
  if (buildStatus.inProgress) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Grant cache build already in progress',
      cache: buildStatus,
    });
  }

  setBuildInProgress(true);
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

    // Step 2: Enrich each opportunity with detail API and convert to unified format
    const detailTasks = allHits.map(hit => async (): Promise<GrantOpportunity | null> => {
      try {
        const oppId = String(hit.id || hit.opportunityId || '');
        if (!oppId) return null;

        const detail = await fetchWithRetry(DETAIL_URL, { opportunityId: Number(oppId) });
        const opp = detail?.opportunity || detail || {};
        const synopsis = opp.synopsis || {};
        const cfdaList = (opp.cfdas || []).map((c: any) => c.cfdaNumber || c.cfda || '').filter(Boolean);
        const eligibilities = (opp.eligibilities || []).map((e: any) => e.description || e.eligibility || '').filter(Boolean);

        // Convert to unified GrantOpportunity format
        const status = (hit.oppStatus || opp.status || '').toLowerCase();
        const openDate = hit.openDate || synopsis.postingDate || '';
        const closeDate = hit.closeDate || synopsis.responseDate || synopsis.archiveDate || '';
        const awardFloor = Number(synopsis.awardFloor) || 0;
        const awardCeiling = Number(synopsis.awardCeiling) || 0;
        const estimatedFunding = Number(synopsis.estimatedFunding) || 0;

        return {
          id: oppId,
          title: hit.title || opp.title || '',
          agency: hit.agency || opp.owningAgency?.name || '',
          funder: hit.agency || opp.owningAgency?.name || '',
          type: 'federal-grant' as const,
          status: status === 'posted' ? 'open' : status === 'forecasted' ? 'closed' : 'open',
          openDate,
          closeDate,
          fundingAmount: {
            min: awardFloor,
            max: awardCeiling,
            total: estimatedFunding,
          },
          awards: {
            anticipated: 1,
            typical: 1,
          },
          eligibility: eligibilities.map(e => {
            if (e.toLowerCase().includes('state')) return 'state-gov';
            if (e.toLowerCase().includes('local')) return 'local-gov';
            if (e.toLowerCase().includes('nonprofit')) return 'nonprofit';
            if (e.toLowerCase().includes('university') || e.toLowerCase().includes('college')) return 'university';
            if (e.toLowerCase().includes('tribe')) return 'tribe';
            if (e.toLowerCase().includes('private')) return 'private';
            return 'nonprofit';
          }),
          description: stripHtml(synopsis.synopsisDesc || synopsis.description || ''),
          waterQualityRelevance: 'Water quality and environmental protection funding opportunity from Grants.gov',
          requirements: eligibilities,
          matchingFunds: {
            required: false,
          },
          programs: ['CWA', 'SDWA'],
          keywords: [
            'environmental', 'water quality', 'grants.gov',
            ...(hit.fundingCategory ? [hit.fundingCategory] : []),
            ...cfdaList,
          ],
          cfda: cfdaList[0] || undefined,
          applicationUrl: `https://grants.gov/search-results-detail/${oppId}`,
          lastUpdated: new Date().toISOString(),
          tags: ['federal', 'environmental', 'grants.gov'],
        };
      } catch (e) {
        console.warn(`[GrantsGov Cron] Detail fetch failed for ${hit.id}: ${e instanceof Error ? e.message : e}`);
        return null;
      }
    });

    const results = await runWithSemaphore(detailTasks, CONCURRENCY);
    const grants: GrantOpportunity[] = results.filter((opp): opp is GrantOpportunity => opp !== null);

    let openCount = 0;
    let closedCount = 0;

    for (const grant of grants) {
      if (grant.status === 'open') openCount++;
      else if (grant.status === 'closed') closedCount++;
    }

    const grantCount = grants.length;
    console.log(`[Grants Cron] Enriched ${grantCount} opportunities (${openCount} open, ${closedCount} closed)`);

    // Empty-data guard
    if (grantCount === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[Grants Cron] 0 opportunities in ${elapsed}s — skipping cache save`);
      return NextResponse.json({ status: 'empty', duration: `${elapsed}s` });
    }

    // Create new cache data with grants
    const newCacheData = {
      _meta: {
        built: new Date().toISOString(),
        grantCount,
        openGrantCount: openCount,
        totalFunding: grants.reduce((sum, g) => sum + g.fundingAmount.total, 0),
        deadlineCount: grants.filter(g => g.closeDate).length,
        agenciesProcessed: [...new Set(grants.map(g => g.agency))],
        gridCells: 1, // Federal grants don't use geographic grid
        sourcesProcessed: ['grants.gov'],
      },
      grid: {
        federal: {
          grants,
          deadlines: grants
            .filter(g => g.closeDate && g.status === 'open')
            .map(g => {
              const daysRemaining = Math.ceil((new Date(g.closeDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
              return {
                grantId: g.id,
                title: g.title,
                agency: g.agency,
                closeDate: g.closeDate,
                daysRemaining,
                urgency: daysRemaining <= 7 ? 'critical' as const :
                         daysRemaining <= 14 ? 'urgent' as const :
                         daysRemaining <= 30 ? 'moderate' as const : 'normal' as const,
                fundingAmount: g.fundingAmount.total,
                applicationUrl: g.applicationUrl,
              };
            }),
        },
      },
      _buildInProgress: false,
      _buildStartedAt: null,
    };

    await setGrantCache(newCacheData);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Grants Cron] Built in ${elapsed}s — ${grantCount} opportunities`);

    recordCronRun('rebuild-grants-gov', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      grants: grantCount,
      open: openCount,
      closed: closedCount,
      totalFunding: grants.reduce((sum, g) => sum + g.fundingAmount.total, 0),
    });

  } catch (err: any) {
    console.error('[GrantsGov Cron] Build failed:', err);

    Sentry.captureException(err, { tags: { cron: 'rebuild-grants-gov' } });

    notifySlackCronFailure({ cronName: 'rebuild-grants-gov', error: err.message || 'build failed', duration: Date.now() - startTime });

    recordCronRun('rebuild-grants-gov', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'Grants.gov build failed' },
      { status: 500 },
    );
  } finally {
    setBuildInProgress(false);
  }
}

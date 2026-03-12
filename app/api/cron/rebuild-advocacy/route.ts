// app/api/cron/rebuild-advocacy/route.ts
// Cron endpoint — fetches congressional bills, hearings, and federal register
// comment periods relevant to water quality. Uses Congress.gov v3 API (requires
// CONGRESS_API_KEY) and Federal Register API (no key needed).
// Schedule: daily at 4:30 AM UTC.

export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import {
  setAdvocacyCache, getAdvocacyCacheStatus,
  isAdvocacyBuildInProgress, setAdvocacyBuildInProgress,
  type CachedBill, type CachedHearing, type CachedCommentPeriod,
} from '@/lib/advocacyCache';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const CONGRESS_API = 'https://api.congress.gov/v3';
const FED_REG_API = 'https://www.federalregister.gov/api/v1';
const FETCH_TIMEOUT_MS = 30_000;

const WQ_KEYWORDS = [
  'water quality', 'clean water', 'safe drinking water', 'pfas',
  'stormwater', 'wastewater', 'npdes', 'tmdl', 'watershed',
  'water infrastructure', 'water pollution', 'effluent', 'discharge',
  'water treatment', 'sewer', 'drinking water', 'water utility',
  'wetland', 'aquifer', 'groundwater', 'surface water',
];

const WQ_PATTERN = new RegExp(WQ_KEYWORDS.join('|'), 'i');

/** Committees that handle water legislation */
const WATER_COMMITTEES = [
  'environment', 'public works', 'water', 'natural resources', 'agriculture',
];

function matchesWaterKeywords(text: string): number {
  const lower = text.toLowerCase();
  return WQ_KEYWORDS.filter(kw => lower.includes(kw)).length;
}

function billLabel(type: string, number: number): string {
  switch (type) {
    case 'hr': return `H.R. ${number}`;
    case 's': return `S. ${number}`;
    case 'hjres': return `H.J.Res. ${number}`;
    case 'sjres': return `S.J.Res. ${number}`;
    case 'hconres': return `H.Con.Res. ${number}`;
    case 'sconres': return `S.Con.Res. ${number}`;
    case 'hres': return `H.Res. ${number}`;
    case 'sres': return `S.Res. ${number}`;
    default: return `${type.toUpperCase()} ${number}`;
  }
}

function billChamber(type: string): string {
  return type.startsWith('s') ? 'Senate' : 'House';
}

// ── Fetch Helpers ────────────────────────────────────────────────────────────

async function fetchBills(apiKey: string): Promise<CachedBill[]> {
  const bills: CachedBill[] = [];
  let offset = 0;
  const limit = 250;
  const congress = 119; // Current congress

  // Paginate through all bills
  while (true) {
    const url = `${CONGRESS_API}/bill/${congress}?api_key=${apiKey}&format=json&limit=${limit}&offset=${offset}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`[Advocacy Cron] Bills API HTTP ${res.status} at offset ${offset}`);
      break;
    }
    const data = await res.json();
    const items = data?.bills || [];
    if (items.length === 0) break;

    for (const b of items) {
      const title = b.title || '';
      const matches = matchesWaterKeywords(title);
      if (matches === 0) continue;

      const billType = (b.type || '').toLowerCase();
      const billNumber = b.number || 0;
      bills.push({
        id: `${billType}-${billNumber}-${congress}`,
        bill: billLabel(billType, billNumber),
        title: title.length > 200 ? title.slice(0, 197) + '...' : title,
        chamber: billChamber(billType),
        status: b.latestAction?.text
          ? (b.latestAction.text.length > 120 ? b.latestAction.text.slice(0, 117) + '...' : b.latestAction.text)
          : 'Introduced',
        statusDate: b.latestAction?.actionDate || '',
        relevance: matches >= 2 ? 'high' : 'medium',
        url: b.url
          ? `https://www.congress.gov/bill/${congress}th-congress/${billChamber(billType).toLowerCase()}-bill/${billNumber}`
          : `https://www.congress.gov/bill/${congress}th-congress/${billChamber(billType).toLowerCase()}-bill/${billNumber}`,
      });
    }

    offset += limit;
    // Congress.gov pagination: if fewer items than limit, we're done
    if (items.length < limit) break;
    // Safety cap: don't fetch more than 2000 bills
    if (offset >= 2000) break;
  }

  console.log(`[Advocacy Cron] Found ${bills.length} water-related bills`);
  return bills;
}

async function fetchHearings(apiKey: string): Promise<CachedHearing[]> {
  const url = `${CONGRESS_API}/committee-meeting/119?api_key=${apiKey}&format=json&limit=250`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) {
    console.warn(`[Advocacy Cron] Hearings API HTTP ${res.status}`);
    return [];
  }
  const data = await res.json();
  const items = data?.committeeMeetings || [];
  const now = new Date();
  const hearings: CachedHearing[] = [];

  for (const m of items) {
    const meetingDate = m.date ? new Date(m.date) : null;
    // Only future meetings
    if (!meetingDate || meetingDate < now) continue;

    // Filter by water-related committees
    const committees = m.committees || [];
    const committeeName = committees.map((c: any) => c.name || '').join(' ');
    const isWaterCommittee = WATER_COMMITTEES.some(kw =>
      committeeName.toLowerCase().includes(kw)
    );
    if (!isWaterCommittee) continue;

    const meetingType = m.type || 'Meeting';
    if (!['Hearing', 'Meeting', 'Markup'].includes(meetingType)) continue;

    const chamber = (m.chamber || '').charAt(0).toUpperCase() + (m.chamber || '').slice(1).toLowerCase();
    hearings.push({
      id: `meeting-${m.eventId || m.updateDate || meetingDate.toISOString()}`,
      title: (m.title || 'Untitled meeting').slice(0, 200),
      date: meetingDate.toISOString().split('T')[0],
      location: `${chamber}${committeeName ? ' — ' + committeeName : ''}`,
      type: meetingType,
      committee: committeeName.slice(0, 120),
      url: m.url || `https://www.congress.gov/committee-meeting/${m.eventId || ''}`,
    });
  }

  console.log(`[Advocacy Cron] Found ${hearings.length} upcoming water hearings`);
  return hearings;
}

async function fetchCommentPeriods(): Promise<CachedCommentPeriod[]> {
  const fields = [
    'title', 'agency_names', 'document_number', 'comments_close_on',
    'docket_ids', 'html_url', 'type', 'abstract',
  ].map(f => `fields[]=${f}`).join('&');

  // Fetch proposed rules and notices from EPA
  const types = ['PRORULE', 'NOTICE'];
  const allPeriods: CachedCommentPeriod[] = [];
  const now = new Date();

  for (const docType of types) {
    try {
      const url = `${FED_REG_API}/documents.json?conditions[agencies][]=environmental-protection-agency&conditions[type][]=${docType}&${fields}&per_page=50&order=newest`;
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        console.warn(`[Advocacy Cron] Federal Register (${docType}) HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const results = data?.results || [];

      for (const doc of results) {
        const closeDate = doc.comments_close_on ? new Date(doc.comments_close_on) : null;
        if (!closeDate || closeDate < now) continue;

        // Check for water quality relevance in title or abstract
        const searchText = `${doc.title || ''} ${doc.abstract || ''}`;
        if (!WQ_PATTERN.test(searchText)) continue;

        const daysRemaining = Math.ceil((closeDate.getTime() - now.getTime()) / 86400000);
        const docTypeLabel = doc.type === 'Proposed Rule' ? 'Rulemaking' : doc.type === 'Notice' ? 'Notice' : doc.type || 'Notice';

        allPeriods.push({
          id: doc.document_number || `fr-${Date.now()}`,
          title: (doc.title || 'Untitled').slice(0, 200),
          agency: Array.isArray(doc.agency_names) ? doc.agency_names.join(', ') : (doc.agency_names || 'EPA'),
          daysRemaining,
          closeDate: closeDate.toISOString().split('T')[0],
          type: docTypeLabel,
          docketId: Array.isArray(doc.docket_ids) ? (doc.docket_ids[0] || '') : (doc.docket_ids || ''),
          url: doc.html_url || '',
        });
      }
    } catch (e: any) {
      console.warn(`[Advocacy Cron] Federal Register (${docType}): ${e.message}`);
    }
  }

  // Sort by days remaining (most urgent first)
  allPeriods.sort((a, b) => a.daysRemaining - b.daysRemaining);

  console.log(`[Advocacy Cron] Found ${allPeriods.length} open water-related comment periods`);
  return allPeriods;
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isAdvocacyBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'Advocacy build already in progress',
      cache: getAdvocacyCacheStatus(),
    });
  }

  setAdvocacyBuildInProgress(true);
  const startTime = Date.now();

  try {
    const congressKey = process.env.CONGRESS_API_KEY;

    // Step 1 & 2: Fetch bills and hearings (requires API key)
    let bills: CachedBill[] = [];
    let hearings: CachedHearing[] = [];

    if (congressKey) {
      const [billsResult, hearingsResult] = await Promise.allSettled([
        fetchBills(congressKey),
        fetchHearings(congressKey),
      ]);
      bills = billsResult.status === 'fulfilled' ? billsResult.value : [];
      hearings = hearingsResult.status === 'fulfilled' ? hearingsResult.value : [];

      if (billsResult.status === 'rejected') {
        console.warn(`[Advocacy Cron] Bills fetch failed: ${billsResult.reason}`);
      }
      if (hearingsResult.status === 'rejected') {
        console.warn(`[Advocacy Cron] Hearings fetch failed: ${hearingsResult.reason}`);
      }
    } else {
      console.warn('[Advocacy Cron] CONGRESS_API_KEY not set — skipping bills and hearings');
    }

    // Step 3: Fetch comment periods (no API key needed)
    let commentPeriods: CachedCommentPeriod[] = [];
    try {
      commentPeriods = await fetchCommentPeriods();
    } catch (e: any) {
      console.warn(`[Advocacy Cron] Comment periods fetch failed: ${e.message}`);
    }

    // Empty-data guard: skip save if all 3 arrays are empty
    if (bills.length === 0 && hearings.length === 0 && commentPeriods.length === 0) {
      console.warn('[Advocacy Cron] All fetches returned empty — preserving existing cache');
      const duration = Date.now() - startTime;
      recordCronRun('rebuild-advocacy', 'success', duration, 'All empty — cache preserved');
      return NextResponse.json({
        status: 'empty',
        reason: 'All sources returned 0 results — existing cache preserved',
        duration,
        cache: getAdvocacyCacheStatus(),
      });
    }

    // Step 4: Save
    const cacheData = {
      bills,
      hearings,
      commentPeriods,
      meta: {
        built: new Date().toISOString(),
        billCount: bills.length,
        hearingCount: hearings.length,
        commentCount: commentPeriods.length,
      },
    };
    await setAdvocacyCache(cacheData);

    const duration = Date.now() - startTime;
    recordCronRun('rebuild-advocacy', 'success', duration);

    return NextResponse.json({
      status: 'complete',
      duration,
      billCount: bills.length,
      hearingCount: hearings.length,
      commentCount: commentPeriods.length,
      hasCongressKey: !!congressKey,
      cache: getAdvocacyCacheStatus(),
    });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    Sentry.captureException(err, { tags: { cron: 'rebuild-advocacy' } });
    notifySlackCronFailure({ cronName: 'rebuild-advocacy', error: err.message, duration });
    recordCronRun('rebuild-advocacy', 'error', duration, err.message);
    return NextResponse.json({ status: 'error', error: err.message }, { status: 500 });
  } finally {
    setAdvocacyBuildInProgress(false);
  }
}

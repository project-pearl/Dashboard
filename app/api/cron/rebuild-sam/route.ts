// app/api/cron/rebuild-sam/route.ts
// Cron endpoint — fetches registered water-infrastructure contractors from SAM.gov Entity API.
// Requires SAM_GOV_API_KEY env var. Rate limited to 1,000 requests/day.
// Schedule: weekly Sunday at 20:00 UTC via Vercel cron.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setSamCache, getSamCacheStatus,
  isSamBuildInProgress, setSamBuildInProgress,
  type SamEntity,
} from '@/lib/samGovCache';
import { PRIORITY_STATES } from '@/lib/constants';

// ── Config ───────────────────────────────────────────────────────────────────

const SAM_API_BASE = 'https://api.sam.gov/entity-information/v3/entities';
const FETCH_TIMEOUT_MS = 30_000;
const DELAY_MS = 2000;
const PAGE_SIZE = 10;
const MAX_PAGES_PER_STATE = 50;
const REQUEST_SAFETY_LIMIT = 900; // bail before hitting 1,000/day limit

// Water/environmental infrastructure NAICS codes
const NAICS_CODES = [
  '924110', // Administration of Air and Water Resource and Solid Waste Management Programs
  '237110', // Water and Sewer Line and Related Structures Construction
  '221310', // Water Supply and Irrigation Systems
  '541620', // Environmental Consulting Services
  '562910', // Remediation Services
  '541380', // Testing Laboratories
].join('~');

// ── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.SAM_GOV_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { status: 'error', error: 'SAM_GOV_API_KEY not configured' },
      { status: 500 },
    );
  }

  if (isSamBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'SAM.gov build already in progress',
      cache: getSamCacheStatus(),
    });
  }

  setSamBuildInProgress(true);
  const startTime = Date.now();
  let requestCount = 0;

  try {
    const entitiesByState: Record<string, SamEntity[]> = {};
    let totalEntities = 0;
    const stateErrors: string[] = [];

    for (const state of PRIORITY_STATES) {
      if (requestCount >= REQUEST_SAFETY_LIMIT) {
        console.warn(`[SAM Cron] Request safety limit reached (${requestCount}), stopping`);
        break;
      }

      console.log(`[SAM Cron] Fetching entities for ${state}...`);
      const stateEntities: SamEntity[] = [];
      const seenUei = new Set<string>();
      let page = 0;

      try {
        while (page < MAX_PAGES_PER_STATE) {
          if (requestCount >= REQUEST_SAFETY_LIMIT) break;

          const params = new URLSearchParams({
            api_key: apiKey,
            physicalAddressProvinceOrStateCode: state,
            naicsCode: NAICS_CODES,
            registrationStatus: 'A',
            samRegistered: 'Yes',
            includeSections: 'entityRegistration,coreData,assertions',
            page: String(page),
            size: String(PAGE_SIZE),
          });

          const res = await fetch(`${SAM_API_BASE}?${params}`, {
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: { 'User-Agent': 'PEARL-Platform/1.0' },
          });
          requestCount++;

          if (!res.ok) {
            const body = await res.text().catch(() => '');
            console.warn(`[SAM Cron] ${state} page ${page}: HTTP ${res.status} — ${body.slice(0, 200)}`);
            break;
          }

          const data = await res.json();
          const entities = data?.entityData || [];

          if (entities.length === 0) break;

          for (const entity of entities) {
            const reg = entity.entityRegistration || {};
            const core = entity.coreData || {};
            const physAddr = core.physicalAddress || {};
            const assertions = entity.assertions || {};

            const uei = reg.ueiSAM || '';
            if (!uei || seenUei.has(uei)) continue;
            seenUei.add(uei);

            stateEntities.push({
              ueiSAM: uei,
              cageCode: reg.cageCode || '',
              legalBusinessName: reg.legalBusinessName || '',
              dbaName: reg.dbaName || '',
              city: physAddr.city || '',
              stateCode: physAddr.stateOrProvinceCode || state,
              zipCode: physAddr.zipCode || '',
              primaryNaics: assertions.primaryNaics || '',
              naicsDescription: assertions.naicsDescription || '',
              businessType: (reg.businessTypes || []).map((bt: any) => bt.shortDescription || bt.businessType || '').filter(Boolean).join(', ') || '',
              registrationStatus: reg.registrationStatus || 'A',
              registrationDate: reg.registrationDate || '',
              expirationDate: reg.registrationExpirationDate || '',
              entityUrl: `https://sam.gov/entity/${uei}`,
            });
          }

          const totalRecords = data?.totalRecords || 0;
          if ((page + 1) * PAGE_SIZE >= totalRecords) break;
          page++;
          await delay(DELAY_MS);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn(`[SAM Cron] ${state} failed: ${msg}`);
        stateErrors.push(`${state}: ${msg}`);
      }

      if (stateEntities.length > 0) {
        entitiesByState[state] = stateEntities;
        totalEntities += stateEntities.length;
        console.log(`[SAM Cron] ${state}: ${stateEntities.length} entities (${page + 1} pages)`);
      }

      await delay(DELAY_MS);
    }

    console.log(`[SAM Cron] Total: ${totalEntities} entities across ${Object.keys(entitiesByState).length} states (${requestCount} requests)`);

    // Empty-data guard
    if (totalEntities === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[SAM Cron] 0 entities in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        requestCount,
        errors: stateErrors,
        cache: getSamCacheStatus(),
      });
    }

    await setSamCache(entitiesByState, {
      built: new Date().toISOString(),
      entityCount: totalEntities,
      statesLoaded: Object.keys(entitiesByState).length,
      requestCount,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[SAM Cron] Built in ${elapsed}s — ${totalEntities} entities`);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      entities: totalEntities,
      states: Object.keys(entitiesByState).length,
      requestCount,
      errors: stateErrors.length > 0 ? stateErrors : undefined,
      cache: getSamCacheStatus(),
    });

  } catch (err: any) {
    console.error('[SAM Cron] Build failed:', err);
    return NextResponse.json(
      { status: 'error', error: err.message || 'SAM.gov build failed', requestCount },
      { status: 500 },
    );
  } finally {
    setSamBuildInProgress(false);
  }
}

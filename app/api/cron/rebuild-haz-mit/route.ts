// app/api/cron/rebuild-haz-mit/route.ts
// Cron endpoint — fetches FEMA Hazard Mitigation Assistance Projects per state.
// Schedule: weekly on Sunday at 10:00 PM UTC.

export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import {
  setHazMitCache, getHazMitCacheStatus,
  isHazMitBuildInProgress, setHazMitBuildInProgress,
  type HazMitProject,
} from '@/lib/hazMitCache';
import { ALL_STATES } from '@/lib/constants';
import { isCronAuthorized } from '@/lib/apiAuth';
import * as Sentry from '@sentry/nextjs';
import { notifySlackCronFailure } from '@/lib/slackNotify';
import { recordCronRun } from '@/lib/cronHealth';

// ── Config ───────────────────────────────────────────────────────────────────

const HAZ_MIT_API = 'https://www.fema.gov/api/open/v4/HazardMitigationAssistanceProjects';
const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 10;

// ── Per-State Fetch ─────────────────────────────────────────────────────────

async function fetchProjectsForState(stateAbbr: string): Promise<HazMitProject[]> {
  const params = new URLSearchParams({
    '$filter': `state eq '${stateAbbr}'`,
    '$top': '10000',
    '$select': 'state,county,projectType,status,projectAmount,benefitCostRatio,federalShareObligated,dateApproved,numberOfProperties,programArea,recipient,subrecipient',
  });

  const res = await fetch(`${HAZ_MIT_API}?${params}`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    console.warn(`[HazMit Cron] ${stateAbbr}: HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items = data?.HazardMitigationAssistanceProjects || data?.items || [];
  const projects: HazMitProject[] = [];

  for (const item of items) {
    projects.push({
      state: item.state || stateAbbr,
      county: item.county || '',
      projectType: item.projectType || '',
      status: item.status || '',
      projectAmount: item.projectAmount ?? 0,
      benefitCostRatio: item.benefitCostRatio != null ? parseFloat(item.benefitCostRatio) || null : null,
      federalShareObligated: item.federalShareObligated ?? 0,
      dateApproved: item.dateApproved || null,
      numberOfProperties: item.numberOfProperties != null ? parseInt(item.numberOfProperties, 10) || null : null,
      programArea: item.programArea || '',
      recipient: item.recipient || '',
      subrecipient: item.subrecipient || '',
    });
  }

  return projects;
}

// ── GET Handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (isHazMitBuildInProgress()) {
    return NextResponse.json({
      status: 'skipped',
      reason: 'HazMit build already in progress',
      cache: getHazMitCacheStatus(),
    });
  }

  setHazMitBuildInProgress(true);
  const startTime = Date.now();

  try {
    const projectsByState: Record<string, { projects: HazMitProject[]; fetched: string }> = {};
    const now = new Date().toISOString();
    let totalProjects = 0;
    let statesFetched = 0;

    // Concurrency-limited state fetch
    const queue = [...ALL_STATES];
    let idx = 0;
    let running = 0;

    await new Promise<void>((resolve) => {
      function next() {
        if (idx >= queue.length && running === 0) return resolve();
        while (running < CONCURRENCY && idx < queue.length) {
          const st = queue[idx++];
          running++;
          (async () => {
            try {
              const projects = await fetchProjectsForState(st);
              projectsByState[st] = { projects, fetched: now };
              if (projects.length > 0) {
                totalProjects += projects.length;
                statesFetched++;
                console.log(`[HazMit Cron] ${st}: ${projects.length} projects`);
              }
            } catch (e: any) {
              console.warn(`[HazMit Cron] ${st}: ${e.message}`);
              projectsByState[st] = { projects: [], fetched: now };
            } finally {
              running--;
              next();
            }
          })();
        }
      }
      next();
    });

    // Empty-data guard
    if (totalProjects === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.warn(`[HazMit Cron] No projects found in ${elapsed}s — skipping cache save`);
      return NextResponse.json({
        status: 'empty',
        duration: `${elapsed}s`,
        cache: getHazMitCacheStatus(),
      });
    }

    await setHazMitCache(projectsByState);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[HazMit Cron] Complete in ${elapsed}s — ${totalProjects} projects across ${statesFetched} states`);

    recordCronRun('rebuild-haz-mit', 'success', Date.now() - startTime);

    return NextResponse.json({
      status: 'complete',
      duration: `${elapsed}s`,
      totalProjects,
      statesFetched,
      cache: getHazMitCacheStatus(),
    });

  } catch (err: any) {
    console.error('[HazMit Cron] Build failed:', err);
    Sentry.captureException(err, { tags: { cron: 'rebuild-haz-mit' } });
    notifySlackCronFailure({ cronName: 'rebuild-haz-mit', error: err.message || 'build failed', duration: Date.now() - startTime });
    recordCronRun('rebuild-haz-mit', 'error', Date.now() - startTime, err.message);
    return NextResponse.json(
      { status: 'error', error: err.message || 'HazMit build failed' },
      { status: 500 },
    );
  } finally {
    setHazMitBuildInProgress(false);
  }
}

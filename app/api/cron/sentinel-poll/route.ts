/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Poll Cron Route                                    */
/*  Runs every 5 min. Executes adapters at their configured intervals */
/*  based on a persistent poll counter.                               */
/* ------------------------------------------------------------------ */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

import type { ChangeSource, ChangeEvent } from '@/lib/sentinel/types';
import { POLL_INTERVALS, SENTINEL_FLAGS, BLOB_PATHS, DISK_PATHS } from '@/lib/sentinel/config';
import { enqueueEvents } from '@/lib/sentinel/eventQueue';
import {
  ensureWarmed as ensureHealthWarmed,
  getSourceState,
  recordSuccess,
  recordFailure,
  updateSourceState,
  shouldPoll,
} from '@/lib/sentinel/sentinelHealth';
import { ensureWarmed as ensureQueueWarmed } from '@/lib/sentinel/eventQueue';
import { saveCacheToBlob, loadCacheFromBlob } from '@/lib/blobPersistence';

// Adapters
import { pollNws }     from '@/lib/sentinel/adapters/nwsAdapter';
import { pollUsgs }    from '@/lib/sentinel/adapters/usgsAdapter';
import { pollNpdes }   from '@/lib/sentinel/adapters/npdesAdapter';
import { pollEcho }    from '@/lib/sentinel/adapters/echoAdapter';
import { pollAttains } from '@/lib/sentinel/adapters/attainsAdapter';
import { pollFema }    from '@/lib/sentinel/adapters/femaAdapter';
import { pollQpe }     from '@/lib/sentinel/adapters/qpeAdapter';
import { pollSso }     from '@/lib/sentinel/adapters/ssoAdapter';

// Existing caches (need warming for adapters that read them)
import { ensureWarmed as warmNws }     from '@/lib/nwsAlertCache';
import { ensureWarmed as warmNwisIv }  from '@/lib/nwisIvCache';
import { ensureWarmed as warmIcis }    from '@/lib/icisCache';
import { ensureWarmed as warmEcho }    from '@/lib/echoCache';
import { ensureWarmed as warmAttains } from '@/lib/attainsCache';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/* ------------------------------------------------------------------ */
/*  Poll Counter Persistence                                          */
/* ------------------------------------------------------------------ */

let _pollCount = 0;
let _pollCountLoaded = false;

async function loadPollCount(): Promise<number> {
  if (_pollCountLoaded) return _pollCount;
  _pollCountLoaded = true;

  // Try disk first
  try {
    const file = path.resolve(process.cwd(), DISK_PATHS.pollCounter);
    const raw = fs.readFileSync(file, 'utf-8');
    _pollCount = JSON.parse(raw).count ?? 0;
    return _pollCount;
  } catch { /* no disk */ }

  // Try blob
  const data = await loadCacheFromBlob<{ count: number }>(BLOB_PATHS.pollCounter);
  if (data?.count != null) _pollCount = data.count;
  return _pollCount;
}

async function savePollCount(count: number): Promise<void> {
  _pollCount = count;
  const payload = { count, updatedAt: new Date().toISOString() };

  try {
    const dir = path.resolve(process.cwd(), '.cache');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.resolve(process.cwd(), DISK_PATHS.pollCounter),
      JSON.stringify(payload)
    );
  } catch { /* non-fatal */ }

  await saveCacheToBlob(BLOB_PATHS.pollCounter, payload);
}

/* ------------------------------------------------------------------ */
/*  Adapter Registry                                                  */
/* ------------------------------------------------------------------ */

interface AdapterEntry {
  source: ChangeSource;
  /** Sync adapters read from caches, async ones call external APIs */
  poll: (state: any) => any;
  isAsync: boolean;
  /** Which existing cache needs warming (if any) */
  warmFn?: () => Promise<void>;
}

const ADAPTERS: AdapterEntry[] = [
  { source: 'NWS_ALERTS',       poll: pollNws,     isAsync: false, warmFn: warmNws },
  { source: 'USGS_IV',          poll: pollUsgs,    isAsync: false, warmFn: warmNwisIv },
  { source: 'NPDES_DMR',        poll: pollNpdes,   isAsync: false, warmFn: warmIcis },
  { source: 'ECHO_ENFORCEMENT', poll: pollEcho,    isAsync: false, warmFn: warmEcho },
  { source: 'ATTAINS',          poll: pollAttains, isAsync: false, warmFn: warmAttains },
  { source: 'FEMA_DISASTER',    poll: pollFema,    isAsync: true },
  { source: 'QPE_RAINFALL',     poll: pollQpe,     isAsync: true },
  { source: 'SSO_CSO',          poll: pollSso,     isAsync: true },
];

/* ------------------------------------------------------------------ */
/*  GET Handler                                                       */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SENTINEL_FLAGS.ENABLED) {
    return NextResponse.json({ status: 'disabled', reason: 'SENTINEL_ENABLED=false' });
  }

  const startTime = Date.now();

  try {
    // Warm sentinel state + event queue
    await Promise.all([ensureHealthWarmed(), ensureQueueWarmed()]);

    const pollCount = await loadPollCount();
    const nextCount = pollCount + 1;

    // Determine which adapters should run this cycle
    const adaptersToRun = ADAPTERS.filter(a => {
      const interval = POLL_INTERVALS[a.source];
      return nextCount % interval === 0 || nextCount === 1;
    });

    // Warm relevant existing caches in parallel
    const warmFns = adaptersToRun
      .filter(a => a.warmFn)
      .map(a => a.warmFn!());
    await Promise.allSettled(warmFns);

    // Run adapters
    const results: {
      source: ChangeSource;
      events: number;
      status: 'ok' | 'error' | 'skipped';
      error?: string;
    }[] = [];

    let totalEnqueued = 0;

    for (const adapter of adaptersToRun) {
      if (!shouldPoll(adapter.source)) {
        results.push({ source: adapter.source, events: 0, status: 'skipped' });
        continue;
      }

      try {
        const prevState = getSourceState(adapter.source);
        const result = adapter.isAsync
          ? await adapter.poll(prevState)
          : adapter.poll(prevState);

        const added = await enqueueEvents(result.events);
        totalEnqueued += added.length;

        // Update adapter state (knownIds, lastValues, etc.)
        await updateSourceState(adapter.source, result.updatedState);
        await recordSuccess(adapter.source);

        results.push({
          source: adapter.source,
          events: added.length,
          status: 'ok',
        });

        if (SENTINEL_FLAGS.LOG_ONLY && added.length > 0) {
          console.log(`[sentinel-poll] ${adapter.source}: ${added.length} new events (LOG_ONLY)`);
        }
      } catch (err: any) {
        await recordFailure(adapter.source, err.message);
        results.push({
          source: adapter.source,
          events: 0,
          status: 'error',
          error: err.message?.slice(0, 200),
        });
      }
    }

    await savePollCount(nextCount);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      status: 'complete',
      duration: `${duration}s`,
      pollCycle: nextCount,
      adaptersRun: adaptersToRun.length,
      totalEventsEnqueued: totalEnqueued,
      results,
    });
  } catch (err: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[sentinel-poll] Fatal error: ${err.message}`);
    return NextResponse.json({
      status: 'error',
      duration: `${duration}s`,
      error: err.message,
    }, { status: 500 });
  }
}

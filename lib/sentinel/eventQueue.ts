/* ------------------------------------------------------------------ */
/*  PIN Sentinel — 48h Rolling Event Queue                            */
/*  In-memory + disk + Vercel Blob (standard cache pattern)           */
/* ------------------------------------------------------------------ */

import fs from 'fs';
import path from 'path';
import type { ChangeEvent, ChangeSource, QueueStats } from './types';
import { TIME_DECAY_WINDOW_HOURS, BLOB_PATHS, DISK_PATHS } from './config';
import { shouldDeduplicate } from './deduplication';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';

/* ------------------------------------------------------------------ */
/*  Internal State                                                    */
/* ------------------------------------------------------------------ */

interface EventQueueData {
  events: ChangeEvent[];
  /** eventId[] indexed by huc8 for fast spatial lookups */
  hucIndex: Record<string, string[]>;
}

let _queue: EventQueueData | null = null;
let _diskLoaded = false;
let _blobChecked = false;

const EXPIRY_MS = TIME_DECAY_WINDOW_HOURS * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/*  Disk I/O                                                          */
/* ------------------------------------------------------------------ */

function diskPath(): string {
  return path.resolve(process.cwd(), DISK_PATHS.eventQueue);
}

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  try {
    const raw = fs.readFileSync(diskPath(), 'utf-8');
    const parsed = JSON.parse(raw) as EventQueueData;
    if (parsed?.events) _queue = parsed;
  } catch {
    // no disk cache yet
  }
}

function saveToDisk(): void {
  if (!_queue) return;
  try {
    const dir = path.dirname(diskPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(diskPath(), JSON.stringify(_queue));
  } catch {
    // non-fatal
  }
}

/* ------------------------------------------------------------------ */
/*  Blob Persistence                                                  */
/* ------------------------------------------------------------------ */

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_queue && _queue.events.length > 0) return;
  if (_blobChecked) return;
  _blobChecked = true;

  const data = await loadCacheFromBlob<EventQueueData>(BLOB_PATHS.eventQueue);
  if (data?.events && data.events.length > 0) {
    _queue = data;
    saveToDisk();
  }
}

async function persist(): Promise<void> {
  saveToDisk();
  if (_queue) {
    await saveCacheToBlob(BLOB_PATHS.eventQueue, _queue);
  }
}

/* ------------------------------------------------------------------ */
/*  Index Helpers                                                     */
/* ------------------------------------------------------------------ */

function rebuildHucIndex(events: ChangeEvent[]): Record<string, string[]> {
  const idx: Record<string, string[]> = {};
  for (const e of events) {
    const huc = e.geography.huc8;
    if (!huc) continue;
    if (!idx[huc]) idx[huc] = [];
    idx[huc].push(e.eventId);
  }
  return idx;
}

function ensureQueue(): EventQueueData {
  ensureDiskLoaded();
  if (!_queue) {
    _queue = { events: [], hucIndex: {} };
  }
  return _queue;
}

/* ------------------------------------------------------------------ */
/*  Core Operations                                                   */
/* ------------------------------------------------------------------ */

/** Remove events older than the decay window */
function expireOldEvents(q: EventQueueData): void {
  const cutoff = Date.now() - EXPIRY_MS;
  q.events = q.events.filter(e => new Date(e.detectedAt).getTime() > cutoff);
  q.hucIndex = rebuildHucIndex(q.events);
}

/**
 * Enqueue new events after dedup check.
 * Returns the events that were actually added.
 */
export async function enqueueEvents(incoming: ChangeEvent[]): Promise<ChangeEvent[]> {
  const q = ensureQueue();

  // Expire stale events first
  expireOldEvents(q);

  const added: ChangeEvent[] = [];

  for (const evt of incoming) {
    // Derive huc6 from huc8 if not set
    if (evt.geography.huc8 && !evt.geography.huc6) {
      evt.geography.huc6 = evt.geography.huc8.slice(0, 6);
    }

    if (shouldDeduplicate(evt, q.events)) continue;

    q.events.push(evt);
    added.push(evt);

    // Update hucIndex
    const huc = evt.geography.huc8;
    if (huc) {
      if (!q.hucIndex[huc]) q.hucIndex[huc] = [];
      q.hucIndex[huc].push(evt.eventId);
    }
  }

  // Sort descending by detectedAt
  q.events.sort((a, b) =>
    new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );

  await persist();
  return added;
}

/** Get events for a specific HUC-8 */
export function getEventsForHuc(huc8: string): ChangeEvent[] {
  const q = ensureQueue();
  const ids = q.hucIndex[huc8];
  if (!ids || ids.length === 0) return [];
  const idSet = new Set(ids);
  return q.events.filter(e => idSet.has(e.eventId));
}

/** Get events for a HUC-8 and all its adjacents */
export function getEventsForHucAndAdjacent(
  huc8: string,
  adjacentHucs: string[]
): ChangeEvent[] {
  const q = ensureQueue();
  const allHucs = new Set([huc8, ...adjacentHucs]);
  return q.events.filter(e => {
    const h = e.geography.huc8;
    return h ? allHucs.has(h) : false;
  });
}

/** Get all non-expired events */
export function getAllEvents(): ChangeEvent[] {
  const q = ensureQueue();
  expireOldEvents(q);
  return q.events;
}

/** Get all HUC-8 codes that currently have events */
export function getActiveHucs(): string[] {
  const q = ensureQueue();
  return Object.keys(q.hucIndex).filter(h => {
    const ids = q.hucIndex[h];
    return ids && ids.length > 0;
  });
}

/** Queue statistics for status endpoint */
export function getQueueStats(): QueueStats {
  const q = ensureQueue();
  expireOldEvents(q);

  const now = Date.now();
  const h1  = now - 1  * 60 * 60 * 1000;
  const h6  = now - 6  * 60 * 60 * 1000;
  const h24 = now - 24 * 60 * 60 * 1000;

  const bySource: Partial<Record<ChangeSource, number>> = {};
  let last1h = 0, last6h = 0, last24h = 0;

  for (const e of q.events) {
    const t = new Date(e.detectedAt).getTime();
    if (t > h1)  last1h++;
    if (t > h6)  last6h++;
    if (t > h24) last24h++;
    bySource[e.source] = (bySource[e.source] || 0) + 1;
  }

  return {
    total: q.events.length,
    last1h,
    last6h,
    last24h,
    bySource,
  };
}

/** Force-clear for testing */
export function _resetQueue(): void {
  _queue = null;
  _diskLoaded = false;
  _blobChecked = false;
}

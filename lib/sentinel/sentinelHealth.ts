/* ------------------------------------------------------------------ */
/*  PIN Sentinel — Per-Source Health Tracking                         */
/*  Blob-persisted, follows standard cache pattern                    */
/* ------------------------------------------------------------------ */

import fs from 'fs';
import path from 'path';
import type { ChangeSource, SentinelSourceState, SourceStatus } from './types';
import { BLOB_PATHS, DISK_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';

/* ------------------------------------------------------------------ */
/*  Internal State                                                    */
/* ------------------------------------------------------------------ */

type HealthMap = Record<ChangeSource, SentinelSourceState>;

let _health: HealthMap | null = null;
let _diskLoaded = false;
let _blobChecked = false;

const ALL_SOURCES: ChangeSource[] = [
  'NWS_ALERTS', 'NWPS_FLOOD', 'USGS_IV', 'SSO_CSO',
  'NPDES_DMR', 'QPE_RAINFALL', 'ATTAINS',
  'STATE_DISCHARGE', 'FEMA_DISASTER', 'ECHO_ENFORCEMENT',
];

const DEGRADED_THRESHOLD = 3;
const OFFLINE_THRESHOLD = 10;
const OFFLINE_BACKOFF_MS = 60 * 60 * 1000; // 1 hour

function defaultState(source: ChangeSource): SentinelSourceState {
  return {
    source,
    lastPollAt: null,
    lastSuccessAt: null,
    consecutiveFailures: 0,
    status: 'HEALTHY',
    knownIds: [],
  };
}

function freshHealthMap(): HealthMap {
  const m = {} as HealthMap;
  for (const s of ALL_SOURCES) m[s] = defaultState(s);
  return m;
}

/* ------------------------------------------------------------------ */
/*  Disk I/O                                                          */
/* ------------------------------------------------------------------ */

function diskPath(): string {
  return path.resolve(process.cwd(), DISK_PATHS.sourceHealth);
}

function ensureDiskLoaded(): void {
  if (_diskLoaded) return;
  _diskLoaded = true;
  try {
    const raw = fs.readFileSync(diskPath(), 'utf-8');
    const parsed = JSON.parse(raw) as HealthMap;
    if (parsed) _health = { ...freshHealthMap(), ...parsed };
  } catch {
    // no disk file yet
  }
}

function saveToDisk(): void {
  if (!_health) return;
  try {
    const dir = path.dirname(diskPath());
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(diskPath(), JSON.stringify(_health));
  } catch {
    // non-fatal
  }
}

/* ------------------------------------------------------------------ */
/*  Blob Persistence                                                  */
/* ------------------------------------------------------------------ */

export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_health) return;
  if (_blobChecked) return;
  _blobChecked = true;

  const data = await loadCacheFromBlob<HealthMap>(BLOB_PATHS.sourceHealth);
  if (data) {
    _health = { ...freshHealthMap(), ...data };
    saveToDisk();
  }
}

async function persist(): Promise<void> {
  saveToDisk();
  if (_health) {
    await saveCacheToBlob(BLOB_PATHS.sourceHealth, _health);
  }
}

function ensureHealth(): HealthMap {
  ensureDiskLoaded();
  if (!_health) _health = freshHealthMap();
  return _health;
}

/* ------------------------------------------------------------------ */
/*  Status Helpers                                                    */
/* ------------------------------------------------------------------ */

function deriveStatus(failures: number): SourceStatus {
  if (failures >= OFFLINE_THRESHOLD) return 'OFFLINE';
  if (failures >= DEGRADED_THRESHOLD) return 'DEGRADED';
  return 'HEALTHY';
}

/* ------------------------------------------------------------------ */
/*  Public API                                                        */
/* ------------------------------------------------------------------ */

export async function recordSuccess(source: ChangeSource): Promise<void> {
  const h = ensureHealth();
  const s = h[source] ?? defaultState(source);
  s.lastPollAt = new Date().toISOString();
  s.lastSuccessAt = s.lastPollAt;
  s.consecutiveFailures = 0;
  s.status = 'HEALTHY';
  h[source] = s;
  await persist();
}

export async function recordFailure(source: ChangeSource, _error?: string): Promise<void> {
  const h = ensureHealth();
  const s = h[source] ?? defaultState(source);
  s.lastPollAt = new Date().toISOString();
  s.consecutiveFailures += 1;
  s.status = deriveStatus(s.consecutiveFailures);
  h[source] = s;
  await persist();
}

export function getStatus(source: ChangeSource): SourceStatus {
  const h = ensureHealth();
  return h[source]?.status ?? 'HEALTHY';
}

export function getSourceState(source: ChangeSource): SentinelSourceState {
  const h = ensureHealth();
  return h[source] ?? defaultState(source);
}

export function getAllStatuses(): SentinelSourceState[] {
  const h = ensureHealth();
  return ALL_SOURCES.map(s => h[s] ?? defaultState(s));
}

/**
 * Should we poll this source right now?
 * Returns false if OFFLINE and last poll was < 1 hour ago (backoff).
 */
export function shouldPoll(source: ChangeSource): boolean {
  const h = ensureHealth();
  const s = h[source];
  if (!s || s.status !== 'OFFLINE') return true;

  const lastPoll = s.lastPollAt ? new Date(s.lastPollAt).getTime() : 0;
  return Date.now() - lastPoll >= OFFLINE_BACKOFF_MS;
}

/**
 * Update knownIds / lastValues / etc. without changing health status.
 * Used by adapters to persist state between polls.
 */
export async function updateSourceState(
  source: ChangeSource,
  partial: Partial<SentinelSourceState>
): Promise<void> {
  const h = ensureHealth();
  const s = h[source] ?? defaultState(source);
  Object.assign(s, partial);
  h[source] = s;
  await persist();
}

/** Summary counts for status endpoint */
export function getHealthSummary(): { healthy: number; degraded: number; offline: number } {
  const h = ensureHealth();
  let healthy = 0, degraded = 0, offline = 0;
  for (const s of ALL_SOURCES) {
    const st = h[s]?.status ?? 'HEALTHY';
    if (st === 'HEALTHY')  healthy++;
    if (st === 'DEGRADED') degraded++;
    if (st === 'OFFLINE')  offline++;
  }
  return { healthy, degraded, offline };
}

/** Force-clear for testing */
export function _resetHealth(): void {
  _health = null;
  _diskLoaded = false;
  _blobChecked = false;
}

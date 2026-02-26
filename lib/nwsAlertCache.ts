/**
 * NWS Alert Cache — stores National Weather Service alerts filtered to water-relevant events.
 *
 * State-keyed cache (like usgsAlertCache pattern — NOT grid-based).
 * Populated by /api/cron/rebuild-nws-alerts (every 30 min).
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';

// ── Types ────────────────────────────────────────────────────────────────────

export interface NwsAlert {
  id: string;
  event: string;
  severity: string;
  certainty: string;
  urgency: string;
  headline: string;
  description: string;
  areaDesc: string;
  onset: string | null;
  expires: string | null;
  senderName: string;
  affectedZones: string[];
}

interface NwsAlertCacheData {
  built: string;
  alerts: Record<string, { alerts: NwsAlert[]; fetched: string }>; // state → { alerts, fetched }
}

// ── Cache Singleton ──────────────────────────────────────────────────────────

let _cache: NwsAlertCacheData | null = null;
let _cacheSource: string | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'nws-alerts.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.alerts) return false;
    _cache = data;
    _cacheSource = 'disk';
    console.log(`[NWS Alert Cache] Loaded from disk (built ${data.built})`);
    return true;
  } catch {
    return false;
  }
}

function saveToDisk(): void {
  try {
    if (typeof process === 'undefined' || !_cache) return;
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(process.cwd(), '.cache');
    const file = path.join(dir, 'nws-alerts.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_cache);
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[NWS Alert Cache] Saved to disk`);
  } catch {
    // Disk save is optional
  }
}

let _diskLoaded = false;
function ensureDiskLoaded() {
  if (!_diskLoaded) {
    _diskLoaded = true;
    loadFromDisk();
  }
}

let _blobChecked = false;
export async function ensureWarmed(): Promise<void> {
  ensureDiskLoaded();
  if (_cache !== null) return;
  if (_blobChecked) return;
  _blobChecked = true;
  const data = await loadCacheFromBlob<NwsAlertCacheData>('cache/nws-alerts.json');
  if (data?.built && data?.alerts) {
    _cache = data;
    _cacheSource = 'blob';
    console.warn(`[NWS Alert Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Get alerts for a specific state. */
export function getNwsAlerts(state: string): NwsAlert[] | null {
  ensureDiskLoaded();
  if (!_cache) return null;
  const entry = _cache.alerts[state.toUpperCase()];
  if (!entry) return null;
  // Filter out expired alerts
  const now = Date.now();
  return entry.alerts.filter(a => !a.expires || new Date(a.expires).getTime() > now);
}

/** Get all alerts across all states. */
export function getNwsAlertsAll(): NwsAlert[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const now = Date.now();
  const all: NwsAlert[] = [];
  for (const entry of Object.values(_cache.alerts)) {
    for (const a of entry.alerts) {
      if (!a.expires || new Date(a.expires).getTime() > now) {
        all.push(a);
      }
    }
  }
  return all;
}

/** Bulk-set alerts for all states (single blob write). */
export async function setNwsAlertCache(
  alertsByState: Record<string, { alerts: NwsAlert[]; fetched: string }>
): Promise<void> {
  _cache = {
    built: new Date().toISOString(),
    alerts: alertsByState,
  };
  _cacheSource = 'memory (cron)';
  saveToDisk();
  await saveCacheToBlob('cache/nws-alerts.json', _cache);
}

// ── Build Lock ───────────────────────────────────────────────────────────────

let _buildInProgress = false;
let _buildStartedAt = 0;
const BUILD_LOCK_TIMEOUT_MS = 12 * 60 * 1000;

export function isNwsAlertBuildInProgress(): boolean {
  if (_buildInProgress && _buildStartedAt > 0 && Date.now() - _buildStartedAt > BUILD_LOCK_TIMEOUT_MS) {
    console.warn('[NWS Alert Cache] Auto-clearing stale build lock (>12 min)');
    _buildInProgress = false;
    _buildStartedAt = 0;
  }
  return _buildInProgress;
}

export function setNwsAlertBuildInProgress(v: boolean): void {
  _buildInProgress = v;
  _buildStartedAt = v ? Date.now() : 0;
}

// ── Status ───────────────────────────────────────────────────────────────────

export function getNwsAlertCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const allAlerts = getNwsAlertsAll();
  const statesWithAlerts = Object.entries(_cache.alerts)
    .filter(([, entry]) => entry.alerts.length > 0)
    .map(([state]) => state);
  return {
    loaded: true,
    source: _cacheSource || 'memory (cron)',
    built: _cache.built,
    alertCount: allAlerts.length,
    statesWithAlerts: statesWithAlerts.length,
  };
}

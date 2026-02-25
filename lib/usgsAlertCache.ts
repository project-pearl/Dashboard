/**
 * USGS Alert Cache — stores threshold alerts fired by the alert engine.
 *
 * Flat state→alerts map (not grid-based). Alerts expire after 24 hours.
 * Persisted to disk + Vercel Blob for cold-start survival.
 */

import { saveCacheToBlob, loadCacheFromBlob } from './blobPersistence';
import { type UsgsAlert, deduplicateAlerts, expireAlerts } from './usgsAlertEngine';

// Re-export the alert type for consumers
export type { UsgsAlert } from './usgsAlertEngine';

// ── Cache Singleton ──────────────────────────────────────────────────────────

interface AlertCacheData {
  built: string;
  alerts: Record<string, UsgsAlert[]>; // state → alerts
}

let _cache: AlertCacheData | null = null;

// ── Disk Persistence ────────────────────────────────────────────────────────

function loadFromDisk(): boolean {
  try {
    if (typeof process === 'undefined') return false;
    const fs = require('fs');
    const path = require('path');
    const file = path.join(process.cwd(), '.cache', 'usgs-alerts.json');
    if (!fs.existsSync(file)) return false;
    const raw = fs.readFileSync(file, 'utf-8');
    const data = JSON.parse(raw);
    if (!data?.built || !data?.alerts) return false;
    _cache = data;
    console.log(`[USGS Alert Cache] Loaded from disk (built ${data.built})`);
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
    const file = path.join(dir, 'usgs-alerts.json');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const payload = JSON.stringify(_cache);
    fs.writeFileSync(file, payload, 'utf-8');
    console.log(`[USGS Alert Cache] Saved to disk`);
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
  const data = await loadCacheFromBlob<AlertCacheData>('cache/usgs-alerts.json');
  if (data?.built && data?.alerts) {
    _cache = data;
    console.warn(`[USGS Alert Cache] Loaded from blob`);
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Get alerts for a specific state.
 */
export function getAlertsForState(state: string): UsgsAlert[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const alerts = _cache.alerts[state.toUpperCase()] || [];
  return expireAlerts(alerts);
}

/**
 * Get all alerts across all states.
 */
export function getAllAlerts(): UsgsAlert[] {
  ensureDiskLoaded();
  if (!_cache) return [];
  const all: UsgsAlert[] = [];
  for (const alerts of Object.values(_cache.alerts)) {
    all.push(...alerts);
  }
  return expireAlerts(all);
}

/**
 * Set alerts for a state (merges with existing, deduplicates, expires old).
 */
export async function setAlerts(state: string, newAlerts: UsgsAlert[]): Promise<void> {
  ensureDiskLoaded();
  if (!_cache) {
    _cache = { built: new Date().toISOString(), alerts: {} };
  }

  const upper = state.toUpperCase();
  const existing = _cache.alerts[upper] || [];
  const merged = deduplicateAlerts([...existing, ...newAlerts]);
  const fresh = expireAlerts(merged);

  _cache.alerts[upper] = fresh;
  _cache.built = new Date().toISOString();

  saveToDisk();
  await saveCacheToBlob('cache/usgs-alerts.json', _cache);
}

/**
 * Bulk-set alerts for multiple states at once (single blob write).
 */
export async function setAlertsBulk(alertsByState: Record<string, UsgsAlert[]>): Promise<void> {
  ensureDiskLoaded();
  if (!_cache) {
    _cache = { built: new Date().toISOString(), alerts: {} };
  }

  for (const [state, newAlerts] of Object.entries(alertsByState)) {
    const upper = state.toUpperCase();
    const existing = _cache.alerts[upper] || [];
    const merged = deduplicateAlerts([...existing, ...newAlerts]);
    _cache.alerts[upper] = expireAlerts(merged);
  }

  _cache.built = new Date().toISOString();
  saveToDisk();
  await saveCacheToBlob('cache/usgs-alerts.json', _cache);
}

/**
 * Get cache metadata for status endpoint.
 */
export function getAlertCacheStatus() {
  ensureDiskLoaded();
  if (!_cache) return { loaded: false, source: null as string | null };
  const allAlerts = getAllAlerts();
  const statesWithAlerts = Object.entries(_cache.alerts)
    .filter(([, alerts]) => expireAlerts(alerts).length > 0)
    .map(([state]) => state);
  return {
    loaded: true,
    source: 'memory',
    built: _cache.built,
    alertCount: allAlerts.length,
    criticalCount: allAlerts.filter(a => a.severity === 'critical').length,
    warningCount: allAlerts.filter(a => a.severity === 'warning').length,
    statesWithAlerts,
  };
}

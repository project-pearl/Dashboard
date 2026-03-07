/* ------------------------------------------------------------------ */
/*  PIN Alerts — Site-Level Throttle                                   */
/*  Persistence confirmation, per-site cooldown, recovery reset        */
/* ------------------------------------------------------------------ */

import type { AlertEvent, AlertSeverity } from './types';
import { BLOB_PATHS, SITE_COOLDOWN_MS, CRITICAL_PERSISTENCE_THRESHOLD, RECOVERY_GAP_MS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SiteThrottleEntry {
  lastFiredAt: string | null;     // ISO — last time an alert dispatched
  consecutiveBreaches: number;    // dispatch runs in a row with a candidate
  lastSeenAt: string;             // ISO — last time a candidate appeared
}

export interface SiteThrottleState {
  entries: Record<string, SiteThrottleEntry>;
}

/* ------------------------------------------------------------------ */
/*  Site Key Extraction                                                */
/* ------------------------------------------------------------------ */

/**
 * Strips severity/stage suffix from a dedupKey to normalize to site+parameter level.
 * Each trigger type has its own pattern; unrecognised keys are returned as-is.
 */
export function extractSiteKey(dedupKey: string): string {
  // deployment:ID:Dissolved Oxygen:critical → deployment:ID:Dissolved Oxygen
  // deployment:ID:classification:hypothesis:stage → deployment:ID:classification
  if (dedupKey.startsWith('deployment:')) {
    const parts = dedupKey.split(':');
    // classification rollup: deployment:ID:classification:hypothesis:stage
    if (parts.length >= 4 && parts[2] === 'classification') {
      return `${parts[0]}:${parts[1]}:classification`;
    }
    // per-param: deployment:ID:Parameter:severity
    if (parts.length >= 4) {
      return parts.slice(0, 3).join(':');
    }
    return dedupKey;
  }

  // usgs-iv-SITE-PARAM-severity:stage → usgs-iv-SITE-PARAM
  if (dedupKey.startsWith('usgs-iv-')) {
    // Strip trailing -severity:stage (e.g., -critical:escalation)
    return dedupKey.replace(/-(?:critical|warning|info)(?::.*)?$/, '');
  }

  // sentinel:HUC:stage:severity → sentinel:HUC
  if (dedupKey.startsWith('sentinel:')) {
    const parts = dedupKey.split(':');
    if (parts.length >= 3) return `${parts[0]}:${parts[1]}`;
    return dedupKey;
  }

  // nwss:SEWERSHED:PATHOGEN:severity → nwss:SEWERSHED:PATHOGEN
  if (dedupKey.startsWith('nwss:')) {
    const parts = dedupKey.split(':');
    if (parts.length >= 4) return parts.slice(0, 3).join(':');
    return dedupKey;
  }

  // fusion|PATTERN|STATE|severity → fusion|PATTERN|STATE
  if (dedupKey.startsWith('fusion|')) {
    const parts = dedupKey.split('|');
    if (parts.length >= 4) return parts.slice(0, 3).join('|');
    return dedupKey;
  }

  // beacon:BEACH:INDICATOR:severity → beacon:BEACH:INDICATOR
  if (dedupKey.startsWith('beacon:')) {
    const parts = dedupKey.split(':');
    if (parts.length >= 4) return parts.slice(0, 3).join(':');
    return dedupKey;
  }

  // hab:STATE:GENUS:severity → hab:STATE:GENUS
  if (dedupKey.startsWith('hab:')) {
    const parts = dedupKey.split(':');
    if (parts.length >= 4) return parts.slice(0, 3).join(':');
    return dedupKey;
  }

  // delta:SOURCE:METRIC:severity → delta:SOURCE:METRIC
  if (dedupKey.startsWith('delta:')) {
    const parts = dedupKey.split(':');
    if (parts.length >= 4) return parts.slice(0, 3).join(':');
    return dedupKey;
  }

  // custom:RULEID:severity → custom:RULEID
  if (dedupKey.startsWith('custom:')) {
    const parts = dedupKey.split(':');
    if (parts.length >= 3) return `${parts[0]}:${parts[1]}`;
    return dedupKey;
  }

  // attains:STATE:CATEGORY:severity → attains:STATE:CATEGORY
  if (dedupKey.startsWith('attains:')) {
    const parts = dedupKey.split(':');
    if (parts.length >= 4) return parts.slice(0, 3).join(':');
    return dedupKey;
  }

  // coordination-HUC6-TIMEBIN → coordination-HUC6
  if (dedupKey.startsWith('coordination-')) {
    const parts = dedupKey.split('-');
    if (parts.length >= 3) return `${parts[0]}-${parts[1]}`;
    return dedupKey;
  }

  // flood-forecast-LID-CATEGORY → as-is (no severity suffix)
  if (dedupKey.startsWith('flood-forecast-')) {
    return dedupKey;
  }

  return dedupKey;
}

/* ------------------------------------------------------------------ */
/*  Blob Persistence                                                   */
/* ------------------------------------------------------------------ */

export async function loadSiteThrottleState(): Promise<SiteThrottleState> {
  const data = await loadCacheFromBlob<SiteThrottleState>(BLOB_PATHS.siteThrottle);
  if (data && data.entries) return data;
  return { entries: {} };
}

export async function saveSiteThrottleState(state: SiteThrottleState): Promise<void> {
  await saveCacheToBlob(BLOB_PATHS.siteThrottle, state);
}

/* ------------------------------------------------------------------ */
/*  Breach Tracking                                                    */
/* ------------------------------------------------------------------ */

/**
 * Called once at the top of dispatch. Updates consecutive breach counters
 * and handles recovery resets for absent sites.
 */
export function updateSiteBreaches(
  candidates: AlertEvent[],
  state: SiteThrottleState,
): void {
  const now = new Date().toISOString();
  const nowMs = Date.now();

  // Collect unique siteKeys from current candidates
  const activeSiteKeys = new Set<string>();
  for (const c of candidates) {
    activeSiteKeys.add(extractSiteKey(c.dedupKey));
  }

  // Increment for present siteKeys
  for (const key of activeSiteKeys) {
    const existing = state.entries[key];
    if (existing) {
      existing.consecutiveBreaches++;
      existing.lastSeenAt = now;
    } else {
      state.entries[key] = {
        lastFiredAt: null,
        consecutiveBreaches: 1,
        lastSeenAt: now,
      };
    }
  }

  // Recovery: reset entries NOT in current batch that were last seen > RECOVERY_GAP_MS ago
  for (const [key, entry] of Object.entries(state.entries)) {
    if (activeSiteKeys.has(key)) continue;
    const lastSeenMs = new Date(entry.lastSeenAt).getTime();
    if (nowMs - lastSeenMs > RECOVERY_GAP_MS) {
      entry.consecutiveBreaches = 0;
      entry.lastFiredAt = null;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Throttle Decision                                                  */
/* ------------------------------------------------------------------ */

export function shouldThrottle(
  siteKey: string,
  severity: AlertSeverity,
  state: SiteThrottleState,
): boolean {
  const entry = state.entries[siteKey];
  if (!entry) return false;

  // Persistence gate: critical needs N consecutive runs before first fire
  if (severity === 'critical' && entry.consecutiveBreaches < CRITICAL_PERSISTENCE_THRESHOLD) {
    return true;
  }

  // Cooldown gate: suppress if fired recently
  if (entry.lastFiredAt) {
    const firedAtMs = new Date(entry.lastFiredAt).getTime();
    if (Date.now() - firedAtMs < SITE_COOLDOWN_MS) {
      return true;
    }
  }

  return false;
}

/* ------------------------------------------------------------------ */
/*  Post-Dispatch Marking                                              */
/* ------------------------------------------------------------------ */

export function markSiteFired(siteKey: string, state: SiteThrottleState): void {
  const entry = state.entries[siteKey];
  if (entry) {
    entry.lastFiredAt = new Date().toISOString();
  }
}

/* ------------------------------------------------------------------ */
/*  Housekeeping                                                       */
/* ------------------------------------------------------------------ */

const STALE_ENTRY_MS = 24 * 60 * 60_000; // 24 hours

export function purgeStaleSiteEntries(state: SiteThrottleState): void {
  const cutoff = Date.now() - STALE_ENTRY_MS;
  for (const [key, entry] of Object.entries(state.entries)) {
    if (new Date(entry.lastSeenAt).getTime() < cutoff) {
      delete state.entries[key];
    }
  }
}

/* ------------------------------------------------------------------ */
/*  PIN Alerts — Suppression Management                               */
/*  Blob persistence only (small dataset, admin-managed)              */
/* ------------------------------------------------------------------ */

import type { AlertSuppression } from './types';
import { BLOB_PATHS } from './config';
import { saveCacheToBlob, loadCacheFromBlob } from '../blobPersistence';

let _suppressions: AlertSuppression[] | null = null;
let _blobChecked = false;

export async function loadSuppressions(): Promise<AlertSuppression[]> {
  if (_suppressions) return _suppressions;
  if (!_blobChecked) {
    _blobChecked = true;
    const data = await loadCacheFromBlob<AlertSuppression[]>(BLOB_PATHS.suppressions);
    if (data && Array.isArray(data)) {
      _suppressions = data;
      return _suppressions;
    }
  }
  _suppressions = [];
  return _suppressions;
}

export async function saveSuppressions(items: AlertSuppression[]): Promise<void> {
  _suppressions = items;
  await saveCacheToBlob(BLOB_PATHS.suppressions, items);
}

/**
 * Check if a dedupKey matches any active (non-expired) suppression pattern.
 * Supports wildcard matching: `sentinel:*:critical` suppresses all sentinel critical alerts.
 */
export function isSuppressed(dedupKey: string, suppressions: AlertSuppression[]): boolean {
  const now = Date.now();
  return suppressions.some(s => {
    // Check expiration
    if (s.expiresAt && new Date(s.expiresAt).getTime() <= now) return false;
    return wildcardMatch(s.dedupKey, dedupKey);
  });
}

/**
 * Simple wildcard matching — `*` matches any substring within a segment.
 * E.g., `sentinel:*:critical` matches `sentinel:020700:critical`.
 */
function wildcardMatch(pattern: string, value: string): boolean {
  if (pattern === value) return true;
  if (!pattern.includes('*')) return false;

  const regex = new RegExp(
    '^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
  );
  return regex.test(value);
}
